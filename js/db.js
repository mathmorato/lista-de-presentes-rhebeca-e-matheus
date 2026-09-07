/* ==========================================================================
   LISTA DE PRESENTES - RHEBECA & MATHEUS
   Versão: v.1.3.5
   Módulo: Banco de Dados Híbrido (IndexedDB Local + Supabase Sincronizado)
   ========================================================================== */

/* ==========================================================================
   CONFIGURAÇÃO ESTÁTICA DO SUPABASE (IMUTÁVEL NA WEB)
   Acesso e conexão direta embutidos no código-fonte.
   - URL: https://ttggcvricfkoqlorbmnv.supabase.co
   - Public/Anon Key: sb_publishable_vBEg1W6vNGeP2Ia2Fv9DuA_2YxFXirN
   - Project Ref: ttggcvricfkoqlorbmnv
   - Postgres URL: postgresql://postgres:[Mhmm*2738]@db.ttggcvricfkoqlorbmnv.supabase.co:5432/postgres
   - CLI Setup:
       supabase login
       supabase init
       supabase link --project-ref ttggcvricfkoqlorbmnv
   ========================================================================== */
const SUPABASE_CONFIG = Object.freeze({
  url: 'https://ttggcvricfkoqlorbmnv.supabase.co',
  anonKey: 'sb_publishable_vBEg1W6vNGeP2Ia2Fv9DuA_2YxFXirN',
  projectRef: 'ttggcvricfkoqlorbmnv',
  postgresUrl: 'postgresql://postgres:[Mhmm*2738]@db.ttggcvricfkoqlorbmnv.supabase.co:5432/postgres'
});

const DB_NAME = 'WeddingGiftList_RhebecaMatheus';
const DB_VERSION = 2;

class WeddingDB {
  constructor() {
    this.db = null;
    this.supabaseClient = null;
    this.isInitialized = false;
    this.onDataChangeCallback = null;
    this.isSyncing = false;
    this.autoSyncTimer = null;
    this.autoSyncIntervalSeconds = 15;
    this.lastSyncTime = null;
  }

  async init(onDataChange) {
    if (onDataChange) {
      this.onDataChangeCallback = onDataChange;
    }

    if (this.isInitialized) return this;

    // 1. Inicializar IndexedDB Local
    await this._initIndexedDB();

    // 2. Inicializar Supabase diretamente com credenciais estáticas do código-fonte (imutável pela interface web)
    const supabaseUrl = SUPABASE_CONFIG.url;
    const supabaseKey = SUPABASE_CONFIG.anonKey;

    if (window.supabase && supabaseUrl && supabaseKey) {
      try {
        this.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.log('[WeddingDB v.1.3.2] Supabase client inicializado:', supabaseUrl);

        // Ativar Supabase Realtime para sincronização instantânea
        this._setupRealtimeListeners();

        // Sincronizar em background bidirecionalmente entre IndexedDB e Supabase
        this.syncWithSupabase({ silent: true }).catch(err => {
          console.warn('[WeddingDB v.1.3.2] Sincronização inicial em background (IndexedDB ativo):', err);
        });

        // Iniciar sincronização automática periódica a cada 15 segundos
        this.startAutoSync(15);
      } catch (err) {
        console.warn('[WeddingDB v.1.3.2] Falha ao inicializar Supabase. Operando modo IndexedDB offline:', err);
      }
    }

    // 3. Expurgar permanentemente dados de exemplo legados do IndexedDB e registrar tombstones
    const legacyMockIds = ['gift_1', 'gift_2', 'gift_3', 'gift_4', 'gift_5', 'gift_6', 'gift_7', 'gift_8', 'gift_9', 'gift_10', 'gift_cota_1', 'gift_cota_2', 'gift_cota_3'];
    try {
      let tombstones = JSON.parse(localStorage.getItem('wedding_deleted_tombstones') || '[]');
      let modified = false;
      for (const mId of legacyMockIds) {
        if (!tombstones.includes(mId)) {
          tombstones.push(mId);
          modified = true;
        }
        await this._deleteGiftLocalOnly(mId);
      }
      if (modified) {
        localStorage.setItem('wedding_deleted_tombstones', JSON.stringify(tombstones));
      }
    } catch (_) {}

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

  /**
   * Inicia sincronização automática em background a cada N segundos (padrão: 15 segundos)
   */
  startAutoSync(intervalSeconds = 15) {
    this.stopAutoSync();
    this.autoSyncIntervalSeconds = intervalSeconds || 15;
    const intervalMs = this.autoSyncIntervalSeconds * 1000;
    console.log(`[WeddingDB v.1.3.0] AutoSync ativado: sincronizando a cada ${this.autoSyncIntervalSeconds} segundos.`);

    this.autoSyncTimer = setInterval(async () => {
      // Executa apenas se o dispositivo estiver online e não houver sincronização em curso
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }
      if (!this.isSyncing) {
        try {
          await this.syncWithSupabase({ silent: true });
        } catch (err) {
          console.warn('[WeddingDB v.1.3.0 AutoSync] Erro na sincronização periódica (silenciosa):', err.message || err);
        }
      }
    }, intervalMs);
  }

  /**
   * Para o ciclo de sincronização automática periódica
   */
  stopAutoSync() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
      console.log('[WeddingDB v.1.3.0] AutoSync pausado.');
    }
  }

  async syncWithSupabase(options = {}) {
    const isSilent = !!(options && options.silent);

    // Proteção contra chamadas simultâneas ou sobreposição de requisições a cada 15 segundos
    if (this.isSyncing) {
      if (!isSilent) console.log('[WeddingDB] Sincronização já em andamento, aguardando término...');
      return { success: true, message: 'Sincronização em andamento.', inProgress: true };
    }

    if (!this.supabaseClient) {
      const supabaseUrl = SUPABASE_CONFIG.url;
      const supabaseKey = SUPABASE_CONFIG.anonKey;
      if (window.supabase && supabaseUrl && supabaseKey) {
        this.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        this._setupRealtimeListeners();
      } else {
        return { success: false, message: 'Supabase não inicializado ou desconectado.' };
      }
    }

    this.isSyncing = true;

    try {
      if (!isSilent) {
        console.log('[WeddingDB v.1.3.2] Iniciando sincronização bidirecional completa com Supabase...');
      }

      // 0. Processar exclusões pendentes feitas em modo offline e carregar tombstones de itens deletados
      let pendingDeletes = [];
      try {
        pendingDeletes = JSON.parse(localStorage.getItem('wedding_deleted_gift_ids') || '[]');
      } catch (_) {}

      let tombstones = new Set();
      try {
        const storedTombstones = JSON.parse(localStorage.getItem('wedding_deleted_tombstones') || '[]');
        if (Array.isArray(storedTombstones)) tombstones = new Set(storedTombstones);
      } catch (_) {}

      for (const delId of pendingDeletes) {
        tombstones.add(delId);
      }

      if (pendingDeletes.length > 0) {
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
      if (giftsError) {
        if (giftsError.code === 'PGRST205' || (giftsError.message && giftsError.message.includes('Could not find the table'))) {
          throw new Error('As tabelas do banco ainda não foram criadas no Supabase. Por favor, execute o script "supabase_schema.sql" no SQL Editor do Supabase.');
        }
        throw giftsError;
      }

      // Filtrar e expurgar do Supabase qualquer item que esteja na lista de excluídos (tombstones)
      const sanitizedRemoteGifts = [];
      for (const rg of (remoteGifts || [])) {
        if (tombstones.has(rg.id)) {
          try {
            await this.supabaseClient.from('gifts').delete().eq('id', rg.id);
          } catch (_) {}
        } else {
          sanitizedRemoteGifts.push(rg);
        }
      }

      const localGifts = await this.getAllGifts({ includeTrash: true });
      const remoteMap = new Map(sanitizedRemoteGifts.map(rg => [rg.id, rg]));

      // 1a. Upload e Conciliação Bidirecional com base em timestamp (updatedAt)
      let uploadCount = 0;
      let downloadCount = 0;

      for (const localG of localGifts) {
        if (tombstones.has(localG.id)) {
          await this._deleteGiftLocalOnly(localG.id);
          continue;
        }

        const remoteG = remoteMap.get(localG.id);
        if (!remoteG) {
          // Presente existe apenas localmente -> Enviar para o Supabase
          const payload = this._mapToSupabaseGift(localG);
          const { error: upErr } = await this.supabaseClient.from('gifts').upsert(payload);
          if (!upErr) {
            remoteMap.set(localG.id, payload);
            uploadCount++;
          } else {
            console.warn('[WeddingDB] Falha ao enviar presente local para Supabase:', localG.id, upErr);
          }
        } else {
          // Presente existe em ambos: comparar timestamps de modificação
          const localTime = new Date(localG.updatedAt || 0).getTime();
          const remoteTime = new Date(remoteG.updated_at || 0).getTime();

          if (localTime > remoteTime) {
            // Local foi modificado mais recentemente -> Enviar para nuvem
            const payload = this._mapToSupabaseGift(localG);
            const { error: upErr } = await this.supabaseClient.from('gifts').upsert(payload);
            if (!upErr) {
              remoteMap.set(localG.id, payload);
              uploadCount++;
            }
          } else if (remoteTime > localTime) {
            // Nuvem tem dados mais recentes (ex.: reserva de convidado) -> Atualizar local
            const mappedRemote = this._mapFromSupabaseGift(remoteG);
            await this._saveGiftLocalOnly(mappedRemote);
            downloadCount++;
          }
        }
      }

      // 1b. Download de presentes remotos cadastrados na nuvem que não existem localmente
      for (const [rId, remoteG] of remoteMap.entries()) {
        if (tombstones.has(rId)) continue;
        const localExists = await this.getGiftById(rId);
        if (!localExists) {
          const mappedRemote = this._mapFromSupabaseGift(remoteG);
          await this._saveGiftLocalOnly(mappedRemote);
          downloadCount++;
        }
      }

      // 2. Sincronização de MENSAGENS (messages)
      let messagesSyncedCount = 0;
      let msgsChanged = 0;
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
              msgsChanged++;
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
              msgsChanged++;
            }
          }
        }
      } catch (errMsg) {
        console.warn('[WeddingDB] Aviso ao sincronizar mensagens:', errMsg);
      }

      // 3. Sincronização de CONFIRMAÇÃO DE PRESENÇA (rsvps)
      let rsvpsSyncedCount = 0;
      let rsvpsChanged = 0;
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
              rsvpsChanged++;
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
              rsvpsChanged++;
            }
          }
        }
      } catch (errRsvp) {
        console.warn('[WeddingDB] Aviso ao sincronizar RSVPs:', errRsvp);
      }

      const hasChanges = (uploadCount > 0) || (downloadCount > 0) || (msgsChanged > 0) || (rsvpsChanged > 0);

      // Notificar ouvintes apenas se dados foram alterados ou se for chamada manual
      if ((hasChanges || !isSilent) && this.onDataChangeCallback) {
        this.onDataChangeCallback('all');
      }

      const totalLocalGifts = (await this.getAllGifts()).length;
      this.lastSyncTime = new Date();
      const timeString = this.lastSyncTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (!isSilent) {
        console.log(`[WeddingDB v.1.3.0] Sincronização finalizada: ${totalLocalGifts} presentes, ${messagesSyncedCount} mensagens, ${rsvpsSyncedCount} RSVPs.`);
      }

      const syncResult = {
        success: true,
        giftsSynced: Math.max(totalLocalGifts, remoteMap.size),
        messagesSynced: messagesSyncedCount,
        rsvpsSynced: rsvpsSyncedCount,
        hasChanges,
        uploadCount,
        downloadCount,
        timestamp: this.lastSyncTime.toISOString(),
        timeString
      };

      // Disparar evento global para atualizar indicadores visuais na UI
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('wedding:sync-completed', {
          detail: {
            ...syncResult,
            silent: isSilent
          }
        }));
      }

      return syncResult;
    } catch (e) {
      console.error('[WeddingDB] Falha no processo de sincronização:', e);
      throw e;
    } finally {
      this.isSyncing = false;
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
      updatedAt: remote.updated_at || null,
      deletedAt: remote.deleted_at || (remote.status === 'trash' ? remote.updated_at : null)
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

  async getAllGifts(options = {}) {
    const includeTrash = options && options.includeTrash === true;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('gifts', 'readonly');
      const store = tx.objectStore('gifts');
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        if (includeTrash) {
          resolve(results);
        } else {
          resolve(results.filter(g => g.status !== 'trash'));
        }
      };
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
    gift.updatedAt = new Date().toISOString();
    await this._saveGiftLocalOnly(gift);

    if (this.supabaseClient) {
      try {
        const payload = this._mapToSupabaseGift(gift);
        const { error } = await this.supabaseClient.from('gifts').upsert(payload);
        if (error) {
          console.warn('[WeddingDB Supabase Sync Error]:', error.message);
          if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
            console.error('[WeddingDB] ATENÇÃO: As tabelas do Supabase não existem. Execute o script "supabase_schema.sql" no SQL Editor do Supabase.');
          }
        } else {
          console.log('[WeddingDB] Presente sincronizado com Supabase:', gift.title);
        }
      } catch (err) {
        console.warn('[WeddingDB] Erro de sincronização com Supabase (saveGift):', err);
      }
    }

    return gift;
  }

  async deleteGift(id) {
    await this._deleteGiftLocalOnly(id);

    // Registrar no tombstone permanente para evitar que o item ressurja da nuvem
    try {
      let tombstones = JSON.parse(localStorage.getItem('wedding_deleted_tombstones') || '[]');
      if (!tombstones.includes(id)) {
        tombstones.push(id);
        localStorage.setItem('wedding_deleted_tombstones', JSON.stringify(tombstones));
      }
    } catch (_) {}

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

  async deleteMultipleGifts(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;

    // 1. Remover todos os itens selecionados do cache local IndexedDB
    for (const id of ids) {
      await this._deleteGiftLocalOnly(id);
    }

    // Registrar no tombstone permanente
    try {
      let tombstones = JSON.parse(localStorage.getItem('wedding_deleted_tombstones') || '[]');
      let mod = false;
      for (const id of ids) {
        if (!tombstones.includes(id)) {
          tombstones.push(id);
          mod = true;
        }
      }
      if (mod) {
        localStorage.setItem('wedding_deleted_tombstones', JSON.stringify(tombstones));
      }
    } catch (_) {}

    // 2. Registrar IDs pendentes para proteção offline
    let pendingDeletes = [];
    try {
      pendingDeletes = JSON.parse(localStorage.getItem('wedding_deleted_gift_ids') || '[]');
    } catch (_) {}

    for (const id of ids) {
      if (!pendingDeletes.includes(id)) {
        pendingDeletes.push(id);
      }
    }
    localStorage.setItem('wedding_deleted_gift_ids', JSON.stringify(pendingDeletes));

    // 3. Remover em lote na base PostgreSQL do Supabase
    if (this.supabaseClient) {
      try {
        const { error } = await this.supabaseClient.from('gifts').delete().in('id', ids);
        if (error) {
          console.warn('[WeddingDB] Erro ao excluir em lote no Supabase:', error);
        } else {
          // Exclusão confirmada no Supabase: limpar pendências
          pendingDeletes = pendingDeletes.filter(x => !ids.includes(x));
          localStorage.setItem('wedding_deleted_gift_ids', JSON.stringify(pendingDeletes));
          console.log(`[WeddingDB v.1.3.0] ${ids.length} presentes excluídos e sincronizados no Supabase.`);
        }
      } catch (err) {
        console.warn('[WeddingDB] Falha de rede ao excluir em lote no Supabase:', err);
      }
    }

    if (this.onDataChangeCallback) {
      this.onDataChangeCallback('gifts');
    }
  }

  // --- LIXEIRA DE PRESENTES (RECUPERAÇÃO E EXCLUSÃO DEFINITIVA INTEGRADA AO SUPABASE) ---

  async getTrashGifts() {
    // 1. Sincronizar itens de lixeira remotos do Supabase se o cliente estiver disponível
    if (this.supabaseClient) {
      try {
        const { data: remoteTrash, error } = await this.supabaseClient
          .from('gifts')
          .select('*')
          .eq('status', 'trash');

        if (!error && Array.isArray(remoteTrash)) {
          for (const rt of remoteTrash) {
            const mapped = this._mapFromSupabaseGift(rt);
            const local = await this.getGiftById(rt.id);
            if (!local || local.status !== 'trash') {
              mapped.status = 'trash';
              if (!mapped.deletedAt) mapped.deletedAt = rt.updated_at || new Date().toISOString();
              await this._saveGiftLocalOnly(mapped);
            }
          }
        }
      } catch (err) {
        console.warn('[WeddingDB v.1.3.1] Erro ao sincronizar lixeira remota com Supabase:', err);
      }
    }

    const all = await this.getAllGifts({ includeTrash: true });
    return all.filter(g => g.status === 'trash').sort((a, b) => {
      const tA = new Date(a.deletedAt || a.updatedAt || 0).getTime();
      const tB = new Date(b.deletedAt || b.updatedAt || 0).getTime();
      return tB - tA; // Mais recentemente excluídos primeiro
    });
  }

  async trashGift(id) {
    const gift = await this.getGiftById(id);
    if (!gift) return null;

    gift.status = 'trash';
    gift.deletedAt = new Date().toISOString();
    gift.updatedAt = new Date().toISOString();

    await this._saveGiftLocalOnly(gift);

    let supabaseSynced = false;
    if (this.supabaseClient) {
      try {
        const payload = this._mapToSupabaseGift(gift);
        const { error } = await this.supabaseClient.from('gifts').upsert(payload);
        if (!error) {
          supabaseSynced = true;
          console.log('[WeddingDB v.1.3.1] Item movido para a lixeira e sincronizado no Supabase:', id);
        } else {
          console.warn('[WeddingDB v.1.3.1] Erro ao sincronizar status de lixeira no Supabase:', error);
        }
      } catch (err) {
        console.warn('[WeddingDB v.1.3.1] Falha de rede ao mover item para lixeira no Supabase:', err);
      }
    }

    if (this.onDataChangeCallback) {
      this.onDataChangeCallback('gifts');
    }
    return { gift, supabaseSynced };
  }

  async trashMultipleGifts(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const payloads = [];
    for (const id of ids) {
      const gift = await this.getGiftById(id);
      if (gift) {
        gift.status = 'trash';
        gift.deletedAt = new Date().toISOString();
        gift.updatedAt = new Date().toISOString();
        await this._saveGiftLocalOnly(gift);
        payloads.push(this._mapToSupabaseGift(gift));
      }
    }

    if (this.supabaseClient && payloads.length > 0) {
      try {
        await this.supabaseClient.from('gifts').upsert(payloads);
        console.log(`[WeddingDB v.1.3.1] ${payloads.length} itens movidos para a lixeira e sincronizados no Supabase.`);
      } catch (err) {
        console.warn('[WeddingDB v.1.3.1] Falha ao sincronizar exclusão em lote para lixeira no Supabase:', err);
      }
    }

    if (this.onDataChangeCallback) {
      this.onDataChangeCallback('gifts');
    }
  }

  async restoreGift(id) {
    const gift = await this.getGiftById(id);
    if (!gift) return null;

    // Se havia reserva anterior preservada, recupera status condizente, senão available
    gift.status = (gift.reservedBy || gift.approvalStatus) ? 'pending_approval' : 'available';
    delete gift.deletedAt;
    gift.updatedAt = new Date().toISOString();

    // Remover dos tombstones caso estivesse acidentalmente
    try {
      let tombstones = JSON.parse(localStorage.getItem('wedding_deleted_tombstones') || '[]');
      if (tombstones.includes(id)) {
        tombstones = tombstones.filter(x => x !== id);
        localStorage.setItem('wedding_deleted_tombstones', JSON.stringify(tombstones));
      }
    } catch (_) {}

    await this._saveGiftLocalOnly(gift);

    if (this.supabaseClient) {
      try {
        const payload = this._mapToSupabaseGift(gift);
        await this.supabaseClient.from('gifts').upsert(payload);
      } catch (err) {
        console.warn('[WeddingDB] Erro ao restaurar presente no Supabase:', err);
      }
    }

    if (this.onDataChangeCallback) {
      this.onDataChangeCallback('gifts');
    }
    return gift;
  }

  async permanentDeleteGift(id) {
    return await this.deleteGift(id);
  }

  async emptyTrash() {
    const trashed = await this.getTrashGifts();
    const ids = trashed.map(g => g.id);
    if (ids.length > 0) {
      await this.deleteMultipleGifts(ids);
    }
    return ids.length;
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

    if (gift.status === 'reserved' || gift.status === 'completed') {
      throw new Error('Este presente já foi reservado ou presenteado por outro convidado.');
    }

    // Marca como pendente de aprovação pelos noivos
    gift.status = 'pending_approval';
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

  /**
   * Aprova uma solicitação de presente enviada por convidado
   */
  async approveGift(id) {
    const gift = await this.getGiftById(id);
    if (!gift) throw new Error('Presente não encontrado.');

    gift.status = 'reserved'; // Status oficial de presente aprovado/confirmado
    await this.saveGift(gift);
    return gift;
  }

  /**
   * Permite aos noivos lançar ou editar manualmente quem deu o presente
   */
  async setGiftDonor(id, donorData) {
    const gift = await this.getGiftById(id);
    if (!gift) throw new Error('Presente não encontrado.');

    if (donorData.status === 'available') {
      return await this.unreserveGift(id);
    }

    gift.status = donorData.status || 'reserved'; // 'reserved' (Aprovado) ou 'pending_approval'
    gift.reservedBy = donorData.reservedBy || donorData.guestName || 'Convidado';
    gift.guestPhone = donorData.guestPhone || donorData.phone || '';
    gift.guestMessage = donorData.guestMessage || donorData.message || '';
    gift.reservedAt = donorData.reservedAt || (donorData.date ? new Date(donorData.date + 'T12:00:00').toISOString() : (gift.reservedAt || new Date().toISOString()));

    await this.saveGift(gift);

    const msgText = donorData.guestMessage || donorData.message || '';
    if (msgText && msgText.trim() !== '') {
      await this.addMessage({
        id: 'msg_' + Date.now(),
        author: gift.reservedBy,
        text: msgText,
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
    // Proteger e garantir que as credenciais do Supabase sejam sempre as fixadas no código
    settingsData.supabaseUrl = SUPABASE_CONFIG.url;
    settingsData.supabaseKey = SUPABASE_CONFIG.anonKey;

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
      supabaseUrl: SUPABASE_CONFIG.url,
      supabaseKey: SUPABASE_CONFIG.anonKey
    };
  }
}

window.weddingDB = new WeddingDB();
