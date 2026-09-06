/* ==========================================================================
   LISTA DE PRESENTES - RHEBECA & MATHEUS
   Versão: v.1.0.0
   Módulo: Banco de Dados Híbrido (IndexedDB Local + Supabase Sincronizado)
   ========================================================================== */

const DB_NAME = 'WeddingGiftList_RhebecaMatheus';
const DB_VERSION = 1;

class WeddingDB {
  constructor() {
    this.db = null;
    this.supabaseClient = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return this;

    // 1. Inicializar IndexedDB Local
    await this._initIndexedDB();

    // 2. Carregar configurações locais (incluindo credenciais Supabase se houver)
    const settings = await this.getSettings();
    if (settings && settings.supabaseUrl && settings.supabaseKey && window.supabase) {
      try {
        this.supabaseClient = window.supabase.createClient(settings.supabaseUrl, settings.supabaseKey);
        console.log('[WeddingDB v.1.0.0] Supabase conectado com sucesso.');
      } catch (err) {
        console.warn('[WeddingDB v.1.0.0] Falha ao conectar no Supabase. Operando modo IndexedDB offline:', err);
      }
    }

    // 3. Popular dados iniciais se vazio
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

  async saveGift(gift) {
    // 1. Grava no IndexedDB
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction('gifts', 'readwrite');
      const store = tx.objectStore('gifts');
      const request = store.put(gift);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // 2. Sincroniza com Supabase se configurado
    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('gifts').upsert(gift);
      } catch (err) {
        console.warn('[WeddingDB] Erro de sincronização com Supabase (saveGift):', err);
      }
    }

    return gift;
  }

  async deleteGift(id) {
    // 1. Exclui do IndexedDB local
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction('gifts', 'readwrite');
      const store = tx.objectStore('gifts');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // 2. Cascata no Supabase
    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('gifts').delete().eq('id', id);
      } catch (err) {
        console.warn('[WeddingDB] Erro de exclusão no Supabase (deleteGift):', err);
      }
    }
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

    // Se houver mensagem de felicitações, salva no mural também
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

  async addMessage(msg) {
    if (!msg.id) msg.id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    if (!msg.createdAt) msg.createdAt = new Date().toISOString();

    await new Promise((resolve, reject) => {
      const tx = this.db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const request = store.put(msg);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('messages').upsert(msg);
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

  async saveRsvp(rsvp) {
    if (!rsvp.id) rsvp.id = 'rsvp_' + Date.now();
    if (!rsvp.createdAt) rsvp.createdAt = new Date().toISOString();

    await new Promise((resolve, reject) => {
      const tx = this.db.transaction('rsvps', 'readwrite');
      const store = tx.objectStore('rsvps');
      const request = store.put(rsvp);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('rsvps').upsert(rsvp);
      } catch (err) {
        console.warn('[WeddingDB] Erro Supabase saveRsvp:', err);
      }
    }
    return rsvp;
  }

  // --- CONFIGURAÇÕES ---

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
      pixKey: 'rhebecaematheuscasamento@gmail.com',
      pixName: 'Rhebeca e Matheus',
      pixCity: 'São Paulo',
      weddingDate: '2026-11-21T16:30:00',
      supabaseUrl: '',
      supabaseKey: ''
    };
  }

  // --- DADOS INICIAIS ---

  async _seedInitialData() {
    const initialGifts = [
      {
        id: 'gift_1',
        title: 'Faqueiro 101 Peças em Aço Inox',
        category: 'cozinha',
        price: 850.00,
        isCota: false,
        status: 'available',
        description: 'Conjunto completo de talheres em aço inox com acabamento espelhado e estojo em madeira nobre.',
        imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'gift_2',
        title: 'Jogo de Panelas Cerâmica Antiaderente',
        category: 'cozinha',
        price: 1200.00,
        isCota: false,
        status: 'available',
        description: 'Linha premium em cerâmica atóxica verde oliva com pegadores em aço escovado.',
        imageUrl: 'https://images.unsplash.com/photo-1556911073-38141963c9e0?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'gift_3',
        title: 'Cafeteira Espresso para Grãos e Cápsulas',
        category: 'eletro',
        price: 1450.00,
        isCota: false,
        status: 'available',
        description: 'Bomba italiana de 19 bar com vaporizador integrado para cappuccinos e lattes perfeitos.',
        imageUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'gift_4',
        title: 'Jogo de Cama 400 Fios Cetim de Algodão',
        category: 'quarto',
        price: 680.00,
        isCota: false,
        status: 'available',
        description: 'Conforto e maciez com toque acetinado na cor pérola e detalhes em ponto ajour.',
        imageUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'gift_5',
        title: 'Fritadeira Elétrica Air Fryer 5.5L',
        category: 'eletro',
        price: 520.00,
        isCota: false,
        status: 'available',
        description: 'Painel digital touch, acabamento inox escovado e cesto antiaderente para refeições saudáveis.',
        imageUrl: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'gift_6',
        title: 'Aparelho de Jantar 30 Peças em Porcelana',
        category: 'cozinha',
        price: 980.00,
        isCota: false,
        status: 'available',
        description: 'Porcelana nobre esmaltada com filete dourado fosco e design atemporal.',
        imageUrl: 'https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'gift_7',
        title: 'Lava e Seca Inteligente 11kg',
        category: 'eletro',
        price: 3600.00,
        isCota: true,
        quotaValue: 360.00,
        quotaTotal: 10,
        quotaCurrent: 3,
        amountRaised: 1080.00,
        status: 'available',
        description: 'Motor inverter silencioso com conectividade Wi-Fi e inteligência artificial para cuidados com os tecidos.',
        imageUrl: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=600&q=80'
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
        description: 'Experiência gastronômica a dois em restaurante com vista panorâmica à luz de velas.',
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'gift_9',
        title: 'Passeio Inesquecível de Barco ao Pôr do Sol',
        category: 'cotas',
        price: 900.00,
        isCota: true,
        quotaValue: 150.00,
        quotaTotal: 6,
        quotaCurrent: 1,
        amountRaised: 150.00,
        status: 'available',
        description: 'Navegação pelas águas cristalinas com brinde de espumante e frutas frescas.',
        imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80'
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
        description: 'Ajude os noivos a voarem rumo ao destino dos sonhos para iniciar essa linda jornada.',
        imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80'
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

// Instância global disponível para o app
window.weddingDB = new WeddingDB();
