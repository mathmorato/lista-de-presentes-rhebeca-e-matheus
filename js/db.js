/* ==========================================================================
   LISTA DE PRESENTES - RHEBECA & MATHEUS
   Versão: v.1.2.1
   Módulo: Banco de Dados Híbrido (IndexedDB Local + Supabase Sincronizado)
   ========================================================================== */

const DB_NAME = 'WeddingGiftList_RhebecaMatheus';
const DB_VERSION = 2;

class WeddingDB {
  constructor() {
    this.db = null;
    this.supabaseClient = null;
    this.isInitialized = false;
    this.onDataChangeCallback = null;
  }

  async init(onDataChange) {
    if (onDataChange) {
      this.onDataChangeCallback = onDataChange;
    }

    if (this.isInitialized) return this;

    // 1. Inicializar IndexedDB Local
    await this._initIndexedDB();

    // 2. Carregar configurações locais e inicializar Supabase com credenciais padrão ou salvas
    const settings = await this.getSettings();
    const supabaseUrl = settings.supabaseUrl || 'https://ttggcvricfkoqlorbmnv.supabase.co';
    const supabaseKey = settings.supabaseKey || 'sb_publishable_vBEg1W6vNGeP2Ia2Fv9DuA_2YxFXirN';

    if (window.supabase && supabaseUrl && supabaseKey) {
      try {
        this.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.log('[WeddingDB v.1.2.1] Supabase client inicializado:', supabaseUrl);

        // Ativar Supabase Realtime para sincronização instantânea
        this._setupRealtimeListeners();

        // Sincronizar em background bidirecionalmente entre IndexedDB e Supabase
        this.syncWithSupabase().catch(err => {
          console.warn('[WeddingDB v.1.2.1] Sincronização inicial em background (IndexedDB ativo):', err);
        });
      } catch (err) {
        console.warn('[WeddingDB v.1.2.1] Falha ao inicializar Supabase. Operando modo IndexedDB offline:', err);
      }
    }

    // 3. Popular dados iniciais se banco local estiver vazio
    const currentGifts = await this.getAllGifts();
    if (!currentGifts || currentGifts.length === 0) {
      await this._seedInitialData();
    }

    this.isInitialized = true;
    return this;
  }

  _initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('gifts')) {
          const giftsStore = db.createObjectStore('gifts', { keyPath: 'id' });
          giftsStore.createIndex('category', 'category', { unique: false });
          giftsStore.createIndex('status', 'status', { unique: false });
          giftsStore.createIndex('isFeatured', 'isFeatured', { unique: false });
        }

        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('rsvps')) {
          const rsvpStore = db.createObjectStore('rsvps', { keyPath: 'id' });
          rsvpStore.createIndex('guestName', 'guestName', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[WeddingDB] Erro ao abrir IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  _setupRealtimeListeners() {
    if (!this.supabaseClient) return;

    try {
      this.supabaseClient
        .channel('wedding-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gifts' }, async (payload) => {
          console.log('[WeddingDB Realtime] Mudança em gifts detectada no Supabase:', payload.eventType);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            await this._saveGiftLocalOnly(this._mapFromSupabaseGift(payload.new));
          } else if (payload.eventType === 'DELETE') {
            await this._deleteGiftLocalOnly(payload.old.id);
          }
          if (this.onDataChangeCallback) this.onDataChangeCallback('gifts');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async (payload) => {
          console.log('[WeddingDB Realtime] Nova mensagem detectada no Supabase:', payload);
          if (payload.eventType === 'INSERT') {
            await this._saveMessageLocalOnly({
              id: payload.new.id,
              author: payload.new.author,
              text: payload.new.text,
              giftTitle: payload.new.gift_title,
              createdAt: payload.new.created_at
            });
            if (this.onDataChangeCallback) this.onDataChangeCallback('messages');
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('[WeddingDB] Não foi possível ativar canal Realtime:', e);
    }
  }

  async syncWithSupabase() {
    if (!this.supabaseClient) {
      const settings = await this.getSettings();
      const supabaseUrl = settings.supabaseUrl || 'https://ttggcvricfkoqlorbmnv.supabase.co';
      const supabaseKey = settings.supabaseKey || 'sb_publishable_vBEg1W6vNGeP2Ia2Fv9DuA_2YxFXirN';
      if (window.supabase && supabaseUrl && supabaseKey) {
        this.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        this._setupRealtimeListeners();
      } else {
        return { success: false, message: 'Supabase não inicializado ou desconectado.' };
      }
    }

    try {
      console.log('[WeddingDB v.1.2.1] Iniciando sincronização bidirecional completa com Supabase...');

      // 0. Processar exclusões pendentes feitas em modo offline
      let pendingDeletes = [];
      try {
        pendingDeletes = JSON.parse(localStorage.getItem('wedding_deleted_gift_ids') || '[]');
      } catch (_) {}

      if (Array.isArray(pendingDeletes) && pendingDeletes.length > 0) {
        for (const delId of pendingDeletes) {
          try {
            await this.supabaseClient.from('gifts').delete().eq('id', delId);
          } catch (e) {
            console.warn('[WeddingDB] Falha ao expurgar item deletado offline no Supabase:', delId, e);
          }
        }
        localStorage.removeItem('wedding_deleted_gift_ids');
      }

      // 1. Sincronização de PRESENTES (gifts)
      const { data: remoteGifts, error: giftsError } = await this.supabaseClient.from('gifts').select('*');
      if (giftsError) throw giftsError;

      const localGifts = await this.getAllGifts();
      const remoteMap = new Map((remoteGifts || []).map(rg => [rg.id, rg]));
      const localMap = new Map((localGifts || []).map(lg => [lg.id, lg]));

      // 1a. Upload: Presentes locais que ainda não estão no Supabase (ex.: novos itens cadastrados offline)
      for (const localG of localGifts) {
        if (!remoteMap.has(localG.id)) {
          const payload = this._mapToSupabaseGift(localG);
          const { error: upErr } = await this.supabaseClient.from('gifts').upsert(payload);
          if (!upErr) {
            remoteMap.set(localG.id, payload);
          } else {
            console.warn('[WeddingDB] Falha ao enviar presente local para Supabase:', localG.id, upErr);
          }
        }
      }

      // 1b. Download: Presentes remotos para o IndexedDB local (ex.: reservas feitas por convidados em outros dispositivos)
      for (const [rId, remoteG] of remoteMap.entries()) {
        const mappedRemote = this._mapFromSupabaseGift(remoteG);
        await this._saveGiftLocalOnly(mappedRemote);
      }

      // 2. Sincronização de MENSAGENS (messages)
      let messagesSyncedCount = 0;
      try {
        const { data: remoteMsgs, error: msgErr } = await this.supabaseClient.from('messages').select('*');
        if (!msgErr && Array.isArray(remoteMsgs)) {
          messagesSyncedCount = remoteMsgs.length;
          const localMsgs = await this.getAllMessages();
          const remoteMsgIds = new Set(remoteMsgs.map(m => m.id));
          const localMsgIds = new Set(localMsgs.map(m => m.id));

          // Enviar mensagens locais ausentes na nuvem
          for (const lm of localMsgs) {
            if (!remoteMsgIds.has(lm.id)) {
              await this.supabaseClient.from('messages').upsert({
                id: lm.id,
                author: lm.author,
                text: lm.text,
                gift_title: lm.giftTitle || null,
                created_at: lm.createdAt
              });
            }
          }

          // Baixar mensagens remotas ausentes no IndexedDB
          for (const rm of remoteMsgs) {
            if (!localMsgIds.has(rm.id)) {
              await this._saveMessageLocalOnly({
                id: rm.id,
                author: rm.author,
                text: rm.text,
                giftTitle: rm.gift_title,
                createdAt: rm.created_at
              });
            }
          }
        }
      } catch (errMsg) {
        console.warn('[WeddingDB] Aviso ao sincronizar mensagens:', errMsg);
      }

      // 3. Sincronização de CONFIRMAÇÃO DE PRESENÇA (rsvps)
      let rsvpsSyncedCount = 0;
      try {
        const { data: remoteRsvps, error: rsvpErr } = await this.supabaseClient.from('rsvps').select('*');
        if (!rsvpErr && Array.isArray(remoteRsvps)) {
          rsvpsSyncedCount = remoteRsvps.length;
          const localRsvps = await this.getAllRsvps();
          const remoteRsvpIds = new Set(remoteRsvps.map(r => r.id));
          const localRsvpIds = new Set(localRsvps.map(r => r.id));

          // Enviar RSVPs locais para a nuvem
          for (const lr of localRsvps) {
            if (!remoteRsvpIds.has(lr.id)) {
              await this.supabaseClient.from('rsvps').upsert({
                id: lr.id,
                guest_name: lr.guestName,
                email: lr.email || null,
                phone: lr.phone || null,
                companions: lr.companions || 0,
                status: lr.status || 'confirmed',
                dietary: lr.dietary || null,
                created_at: lr.createdAt
              });
            }
          }

          // Baixar RSVPs remotos para o IndexedDB
          for (const rr of remoteRsvps) {
            if (!localRsvpIds.has(rr.id)) {
              await this._saveRsvpLocalOnly({
                id: rr.id,
                guestName: rr.guest_name,
                email: rr.email,
                phone: rr.phone,
                companions: rr.companions,
                status: rr.status,
                dietary: rr.dietary,
                createdAt: rr.created_at
              });
            }
          }
        }
      } catch (errRsvp) {
        console.warn('[WeddingDB] Aviso ao sincronizar RSVPs:', errRsvp);
      }

      // Notificar ouvintes que dados foram atualizados
      if (this.onDataChangeCallback) {
        this.onDataChangeCallback('all');
      }

      const totalLocalGifts = (await this.getAllGifts()).length;

      console.log(`[WeddingDB v.1.2.1] Sincronização finalizada: ${totalLocalGifts} presentes, ${messagesSyncedCount} mensagens, ${rsvpsSyncedCount} RSVPs.`);

      return {
        success: true,
        giftsSynced: Math.max(totalLocalGifts, remoteMap.size),
        messagesSynced: messagesSyncedCount,
        rsvpsSynced: rsvpsSyncedCount,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error('[WeddingDB] Falha no processo de sincronização:', e);
      throw e;
    }
  }

  // Compatibilidade com chamadas anteriores
  async syncFromSupabase() {
    return this.syncWithSupabase();
  }

  _mapFromSupabaseGift(remote) {
    return {
      id: remote.id,
      title: remote.title,
      category: remote.category,
      price: parseFloat(remote.price) || 0,
      isCota: !!remote.is_cota,
      quotaValue: parseFloat(remote.quota_value) || 0,
      quotaTotal: parseInt(remote.quota_total) || 0,
      quotaCurrent: parseInt(remote.quota_current) || 0,
      amountRaised: parseFloat(remote.amount_raised) || 0,
      status: remote.status || 'available',
      description: remote.description || '',
      imageUrl: remote.image_url || '',
      productUrl: remote.product_url || '',
      isFeatured: !!remote.is_featured,
      reservedBy: remote.reserved_by,
      guestPhone: remote.guest_phone,
      guestMessage: remote.guest_message,
      reservedAt: remote.reserved_at,
      contributions: remote.contributions || [],
      updatedAt: remote.updated_at || null
    };
  }

  _mapToSupabaseGift(local) {
    return {
      id: local.id,
      title: local.title,
      category: local.category,
      price: local.price,
      is_cota: !!local.isCota,
      quota_value: local.quotaValue || null,
      quota_total: local.quotaTotal || null,
      quota_current: local.quotaCurrent || 0,
      amount_raised: local.amountRaised || 0,
      status: local.status || 'available',
      description: local.description || '',
      image_url: local.imageUrl || '',
      product_url: local.productUrl || '',
      is_featured: !!local.isFeatured,
      reserved_by: local.reservedBy || null,
      guest_phone: local.guestPhone || null,
      guest_message: local.guestMessage || null,
      reserved_at: local.reservedAt || null,
      contributions: local.contributions || [],
      updated_at: local.updatedAt || new Date().toISOString()
    };
  }

  // --- MÉTODOS DE PRESENTES (GIFTS) ---

  async getAllGifts() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('gifts', 'readonly');
      const store = tx.objectStore('gifts');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getGiftById(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('gifts', 'readonly');
      const store = tx.objectStore('gifts');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async _saveGiftLocalOnly(gift) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('gifts', 'readwrite');
      const store = tx.objectStore('gifts');
      const request = store.put(gift);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async _deleteGiftLocalOnly(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('gifts', 'readwrite');
      const store = tx.objectStore('gifts');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveGift(gift) {
    if (!gift.updatedAt) {
      gift.updatedAt = new Date().toISOString();
    }
    await this._saveGiftLocalOnly(gift);

    if (this.supabaseClient) {
      try {
        const payload = this._mapToSupabaseGift(gift);
        const { error } = await this.supabaseClient.from('gifts').upsert(payload);
        if (error) console.warn('[WeddingDB Supabase Sync Error]:', error.message);
      } catch (err) {
        console.warn('[WeddingDB] Erro de sincronização com Supabase (saveGift):', err);
      }
    }

    return gift;
  }

  async deleteGift(id) {
    await this._deleteGiftLocalOnly(id);

    // Salvar ID para garantia de exclusão em caso de offline
    let pendingDeletes = [];
    try {
      pendingDeletes = JSON.parse(localStorage.getItem('wedding_deleted_gift_ids') || '[]');
    } catch (_) {}
    if (!pendingDeletes.includes(id)) {
      pendingDeletes.push(id);
      localStorage.setItem('wedding_deleted_gift_ids', JSON.stringify(pendingDeletes));
    }

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('gifts').delete().eq('id', id);
        // Exclusão confirmada na nuvem: remove da lista pendente
        pendingDeletes = pendingDeletes.filter(x => x !== id);
        localStorage.setItem('wedding_deleted_gift_ids', JSON.stringify(pendingDeletes));
      } catch (err) {
        console.warn('[WeddingDB] Erro de exclusão no Supabase (deleteGift):', err);
      }
    }
  }

  async unreserveGift(id) {
    const gift = await this.getGiftById(id);
    if (!gift) throw new Error('Presente não encontrado.');

    gift.status = 'available';
    gift.reservedBy = null;
    gift.guestPhone = null;
    gift.guestMessage = null;
    gift.reservedAt = null;
    gift.quotaCurrent = 0;
    gift.amountRaised = 0;
    gift.contributions = [];

    await this.saveGift(gift);
    return gift;
  }

  async toggleFeatured(id) {
    const gift = await this.getGiftById(id);
    if (!gift) return null;
    gift.isFeatured = !gift.isFeatured;
    await this.saveGift(gift);
    return gift;
  }

  async reserveGift(id, reservationData) {
    const gift = await this.getGiftById(id);
    if (!gift) throw new Error('Presente não encontrado.');

    if (gift.status === 'reserved') {
      throw new Error('Este presente já foi reservado por outro convidado.');
    }

    gift.status = 'reserved';
    gift.reservedBy = reservationData.guestName;
    gift.guestMessage = reservationData.message || '';
    gift.guestPhone = reservationData.phone || '';
    gift.reservedAt = new Date().toISOString();

    await this.saveGift(gift);

    if (reservationData.message && reservationData.message.trim() !== '') {
      await this.addMessage({
        id: 'msg_' + Date.now(),
        author: reservationData.guestName,
        text: reservationData.message,
        giftTitle: gift.title,
        createdAt: new Date().toISOString()
      });
    }

    return gift;
  }

  async contributeCota(id, amount, quotaCount, guestData) {
    const gift = await this.getGiftById(id);
    if (!gift) throw new Error('Cota não encontrada.');

    gift.quotaCurrent = (gift.quotaCurrent || 0) + quotaCount;
    gift.amountRaised = (gift.amountRaised || 0) + amount;

    if (!gift.contributions) gift.contributions = [];
    gift.contributions.push({
      guestName: guestData.guestName,
      amount,
      quotaCount,
      message: guestData.message,
      phone: guestData.phone,
      date: new Date().toISOString()
    });

    if (gift.quotaTotal && gift.quotaCurrent >= gift.quotaTotal) {
      gift.status = 'completed';
    }

    await this.saveGift(gift);

    if (guestData.message && guestData.message.trim() !== '') {
      await this.addMessage({
        id: 'msg_' + Date.now(),
        author: guestData.guestName,
        text: guestData.message,
        giftTitle: `${gift.title} (${quotaCount} cota${quotaCount > 1 ? 's' : ''})`,
        createdAt: new Date().toISOString()
      });
    }

    return gift;
  }

  // --- MURAL DE MENSAGENS ---

  async getAllMessages() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const request = store.getAll();

      request.onsuccess = () => {
        const msgs = request.result || [];
        msgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(msgs);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async _saveMessageLocalOnly(msg) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const request = store.put(msg);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addMessage(msg) {
    if (!msg.id) msg.id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    if (!msg.createdAt) msg.createdAt = new Date().toISOString();

    await this._saveMessageLocalOnly(msg);

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('messages').upsert({
          id: msg.id,
          author: msg.author,
          text: msg.text,
          gift_title: msg.giftTitle || null,
          created_at: msg.createdAt
        });
      } catch (err) {
        console.warn('[WeddingDB] Erro Supabase addMessage:', err);
      }
    }
    return msg;
  }

  // --- RSVP (CONFIRMAÇÃO DE PRESENÇA) ---

  async getAllRsvps() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('rsvps', 'readonly');
      const store = tx.objectStore('rsvps');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async _saveRsvpLocalOnly(rsvp) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('rsvps', 'readwrite');
      const store = tx.objectStore('rsvps');
      const request = store.put(rsvp);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveRsvp(rsvp) {
    if (!rsvp.id) rsvp.id = 'rsvp_' + Date.now();
    if (!rsvp.createdAt) rsvp.createdAt = new Date().toISOString();

    await this._saveRsvpLocalOnly(rsvp);

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('rsvps').upsert({
          id: rsvp.id,
          guest_name: rsvp.guestName,
          email: rsvp.email || null,
          phone: rsvp.phone || null,
          companions: rsvp.companions || 0,
          status: rsvp.status || 'confirmed',
          dietary: rsvp.dietary || null,
          created_at: rsvp.createdAt
        });
      } catch (err) {
        console.warn('[WeddingDB] Erro Supabase saveRsvp:', err);
      }
    }
    return rsvp;
  }

  // --- CONFIGURAÇÕES DO CASAMENTO ---

  async getSettings() {
    return new Promise((resolve) => {
      const tx = this.db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get('wedding_config');

      request.onsuccess = () => {
        resolve(request.result ? request.result.data : this._defaultSettings());
      };
      request.onerror = () => resolve(this._defaultSettings());
    });
  }

  async saveSettings(settingsData) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put({ key: 'wedding_config', data: settingsData });

      request.onsuccess = () => resolve(settingsData);
      request.onerror = () => reject(request.error);
    });
  }

  _defaultSettings() {
    return {
      groomName: 'Matheus',
      brideName: 'Rhebeca',
      coupleTitle: 'Rhebeca & Matheus',
      welcomeMessage: '“Assim, eles já não são dois, mas sim uma só carne. Portanto, o que Deus uniu, ninguém separe.” — Mateus 19:6',
      weddingDate: '2027-01-09T17:00:00',
      ceremonyPlace: 'Igreja Batista Shalom',
      ceremonyCity: 'São Luís de Montes Belos - GO',
      pixKey: 'rhebecaematheuscasamento@gmail.com',
      pixName: 'Rhebeca e Matheus',
      pixCity: 'São Luís de Montes Belos',
      whatsappPhone: '5564993409360',
      supabaseUrl: 'https://ttggcvricfkoqlorbmnv.supabase.co',
      supabaseKey: 'sb_publishable_vBEg1W6vNGeP2Ia2Fv9DuA_2YxFXirN'
    };
  }

  // --- DADOS INICIAIS ---

  async _seedInitialData() {
    const initialGifts = [
      {
        id: 'gift_1',
        title: 'Faqueiro 101 Peças em Aço Inox Nobre',
        category: 'cozinha',
        price: 850.00,
        isCota: false,
        status: 'available',
        isFeatured: true,
        description: 'Conjunto completo de talheres em aço inox com acabamento espelhado e estojo nobre.',
        imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=600&q=80',
        productUrl: 'https://www.amazon.com.br'
      },
      {
        id: 'gift_2',
        title: 'Jogo de Panelas Cerâmica Antiaderente Verde Oliva',
        category: 'cozinha',
        price: 1200.00,
        isCota: false,
        status: 'available',
        isFeatured: true,
        description: 'Linha premium em cerâmica atóxica com pegadores em aço escovado e tampas de vidro temperado.',
        imageUrl: 'https://images.unsplash.com/photo-1556911073-38141963c9e0?auto=format&fit=crop&w=600&q=80',
        productUrl: 'https://www.magazineluiza.com.br'
      },
      {
        id: 'gift_3',
        title: 'Cafeteira Espresso para Grãos e Cápsulas',
        category: 'eletro',
        price: 1450.00,
        isCota: false,
        status: 'available',
        isFeatured: true,
        description: 'Bomba italiana de 19 bar com vaporizador integrado para expressos, cappuccinos e lattes cremosos.',
        imageUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=600&q=80',
        productUrl: 'https://www.mercadolivre.com.br'
      },
      {
        id: 'gift_4',
        title: 'Jogo de Cama 400 Fios Cetim de Algodão Egípcio',
        category: 'quarto',
        price: 680.00,
        isCota: false,
        status: 'available',
        isFeatured: false,
        description: 'Toque acetinado ultra macio na tonalidade pérola com detalhes elegantes em ponto ajour.',
        imageUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80',
        productUrl: ''
      },
      {
        id: 'gift_5',
        title: 'Fritadeira Elétrica Air Fryer Digital 5.5L',
        category: 'eletro',
        price: 520.00,
        isCota: false,
        status: 'available',
        isFeatured: false,
        description: 'Painel digital sensível ao toque, cesto antiaderente e acabamento em inox escovado.',
        imageUrl: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=600&q=80',
        productUrl: ''
      },
      {
        id: 'gift_6',
        title: 'Aparelho de Jantar 30 Peças em Porcelana',
        category: 'sala',
        price: 980.00,
        isCota: false,
        status: 'available',
        isFeatured: false,
        description: 'Porcelana nobre esmaltada com suave filete dourado fosco e pratos de sobremesa refinados.',
        imageUrl: 'https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=600&q=80',
        productUrl: ''
      },
      {
        id: 'gift_7',
        title: 'Lava e Seca Inteligente 11kg Inverter',
        category: 'eletro',
        price: 3600.00,
        isCota: true,
        quotaValue: 360.00,
        quotaTotal: 10,
        quotaCurrent: 3,
        amountRaised: 1080.00,
        status: 'available',
        isFeatured: true,
        description: 'Motor inverter silencioso com inteligência artificial para cuidados com roupas e conectividade Wi-Fi.',
        imageUrl: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=600&q=80',
        productUrl: ''
      },
      {
        id: 'gift_8',
        title: 'Jantar Romântico com Degustação na Lua de Mel',
        category: 'cotas',
        price: 800.00,
        isCota: true,
        quotaValue: 160.00,
        quotaTotal: 5,
        quotaCurrent: 2,
        amountRaised: 320.00,
        status: 'available',
        isFeatured: true,
        description: 'Experiência gastronômica inesquecível em bistrô panorâmico com menu de 5 tempos à luz de velas.',
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
        productUrl: ''
      },
      {
        id: 'gift_9',
        title: 'Passeio Exclusivo de Veleiro ao Pôr do Sol',
        category: 'cotas',
        price: 900.00,
        isCota: true,
        quotaValue: 150.00,
        quotaTotal: 6,
        quotaCurrent: 1,
        amountRaised: 150.00,
        status: 'available',
        isFeatured: false,
        description: 'Navegação por enseadas de águas calmas com brinde de espumante e frutas frescas.',
        imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
        productUrl: ''
      },
      {
        id: 'gift_10',
        title: 'Cotas para Passagens Aéreas da Lua de Mel',
        category: 'cotas',
        price: 4000.00,
        isCota: true,
        quotaValue: 200.00,
        quotaTotal: 20,
        quotaCurrent: 8,
        amountRaised: 1600.00,
        status: 'available',
        isFeatured: true,
        description: 'Ajude os noivos a voarem rumo ao destino dos sonhos para celebrar o início dessa nova família.',
        imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80',
        productUrl: ''
      }
    ];

    for (const item of initialGifts) {
      await this.saveGift(item);
    }

    const initialMessages = [
      {
        id: 'msg_init_1',
        author: 'Dona Maria e Seu Carlos',
        text: 'Que este amor seja sempre a luz a iluminar os caminhos de vocês. Estamos muito felizes por celebrar essa união!',
        giftTitle: 'Aparelho de Jantar',
        createdAt: '2026-08-15T14:20:00Z'
      },
      {
        id: 'msg_init_2',
        author: 'Camila e Rodrigo',
        text: 'Rhebeca e Matheus, que honra testemunhar o início dessa família tão linda! Aproveitem muito a lua de mel!',
        giftTitle: 'Jantar Romântico na Lua de Mel',
        createdAt: '2026-08-28T19:45:00Z'
      }
    ];

    for (const msg of initialMessages) {
      await this.addMessage(msg);
    }
  }
}

window.weddingDB = new WeddingDB();
