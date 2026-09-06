/* ==========================================================================
   LISTA DE PRESENTES - RHEBECA & MATHEUS
   Versão: v.1.0.0
   Módulo: Aplicação Principal e Controle de Interface
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar Banco de Dados Híbrido
  await window.weddingDB.init();

  // 2. Inicializar Módulos do Sistema
  ThemeController.init();
  CountdownController.init();
  CatalogController.init();
  MessagesController.init();
  RsvpController.init();
  AdminController.init();

  // 3. Menu Mobile
  const menuToggle = document.getElementById('mobileMenuToggle');
  const navLinks = document.getElementById('navLinks');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('show');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('show');
      });
    });
  }
});

/* ==========================================================================
   GERENCIADOR DE TEMAS (Claro Padrão / Escuro Musgo Elegante)
   ========================================================================== */
const ThemeController = {
  init() {
    const toggleBtn = document.getElementById('themeToggleBtn');
    const savedTheme = localStorage.getItem('wedding_theme') || 'light';
    this.applyTheme(savedTheme);

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
      });
    }
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wedding_theme', theme);

    const iconSun = document.getElementById('iconThemeSun');
    const iconMoon = document.getElementById('iconThemeMoon');
    if (iconSun && iconMoon) {
      if (theme === 'dark') {
        iconSun.style.display = 'inline-block';
        iconMoon.style.display = 'none';
      } else {
        iconSun.style.display = 'none';
        iconMoon.style.display = 'inline-block';
      }
    }
  }
};

/* ==========================================================================
   CONTAGEM REGRESSIVA DO CASAMENTO
   ========================================================================== */
const CountdownController = {
  async init() {
    const settings = await window.weddingDB.getSettings();
    const targetDate = new Date(settings.weddingDate || '2026-11-21T16:30:00').getTime();

    const daysEl = document.getElementById('countdownDays');
    const hoursEl = document.getElementById('countdownHours');
    const minsEl = document.getElementById('countdownMins');
    const secsEl = document.getElementById('countdownSecs');

    const update = () => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        if (daysEl) daysEl.innerText = '00';
        if (hoursEl) hoursEl.innerText = '00';
        if (minsEl) minsEl.innerText = '00';
        if (secsEl) secsEl.innerText = '00';
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (daysEl) daysEl.innerText = String(days).padStart(2, '0');
      if (hoursEl) hoursEl.innerText = String(hours).padStart(2, '0');
      if (minsEl) minsEl.innerText = String(minutes).padStart(2, '0');
      if (secsEl) secsEl.innerText = String(seconds).padStart(2, '0');
    };

    update();
    setInterval(update, 1000);
  }
};

/* ==========================================================================
   CATÁLOGO DE PRESENTES E COTAS
   ========================================================================== */
const CatalogController = {
  currentFilter: 'all',
  searchQuery: '',
  allGifts: [],

  async init() {
    this.setupListeners();
    await this.refresh();
  },

  setupListeners() {
    // Filtro de Categorias
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.getAttribute('data-category');
        this.render();
      });
    });

    // Busca de Presentes
    const searchInput = document.getElementById('giftSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // Modal Fechamentos
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
        }
      });
    });
  },

  async refresh() {
    this.allGifts = await window.weddingDB.getAllGifts();
    this.updateSummaryStrip();
    this.render();
  },

  updateSummaryStrip() {
    const totalCount = this.allGifts.length;
    const reservedCount = this.allGifts.filter(g => g.status === 'reserved' || g.status === 'completed').length;
    
    // Total arrecadado em cotas
    const totalRaised = this.allGifts.reduce((sum, g) => sum + (g.amountRaised || 0), 0);

    const totalEl = document.getElementById('statTotalGifts');
    const reservedEl = document.getElementById('statReservedGifts');
    const raisedEl = document.getElementById('statTotalRaised');

    if (totalEl) totalEl.innerText = totalCount;
    if (reservedEl) reservedEl.innerText = reservedCount;
    if (raisedEl) raisedEl.innerText = formatCurrency(totalRaised);
  },

  render() {
    const grid = document.getElementById('giftsGrid');
    if (!grid) return;

    let filtered = this.allGifts.filter(gift => {
      const matchesCat = this.currentFilter === 'all' || gift.category === this.currentFilter;
      const matchesSearch = !this.searchQuery || 
        gift.title.toLowerCase().includes(this.searchQuery) ||
        (gift.description && gift.description.toLowerCase().includes(this.searchQuery));
      return matchesCat && matchesSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;">
          <svg class="icon-line lg" style="color: var(--color-olive-muted); margin-bottom: 1rem;" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h3 style="margin-bottom: 0.5rem;">Nenhum item encontrado</h3>
          <p>Tente ajustar os termos de pesquisa ou selecionar outra categoria.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(gift => this.createCardHTML(gift)).join('');

    // Bind dos botões de ação nos cards
    grid.querySelectorAll('.btn-presentear').forEach(btn => {
      btn.addEventListener('click', () => {
        const giftId = btn.getAttribute('data-id');
        this.openActionModal(giftId);
      });
    });
  },

  createCardHTML(gift) {
    const isReserved = gift.status === 'reserved';
    const isCompleted = gift.status === 'completed';

    let badgeHTML = '';
    if (gift.isCota) {
      badgeHTML = `<span class="gift-badge badge-cota">Cota Lua de Mel</span>`;
    } else if (isReserved) {
      badgeHTML = `<span class="gift-badge badge-reserved">Reservado</span>`;
    } else {
      badgeHTML = `<span class="gift-badge badge-available">Disponível</span>`;
    }

    let pricingHTML = '';
    let actionBtnHTML = '';

    if (gift.isCota) {
      const current = gift.quotaCurrent || 0;
      const total = gift.quotaTotal || 1;
      const pct = Math.min(100, Math.round((current / total) * 100));

      pricingHTML = `
        <div class="gift-pricing">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span class="price-main">${formatCurrency(gift.quotaValue || gift.price)}</span>
            <span class="price-sub">por cota</span>
          </div>
          <div class="cota-progress-box">
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%"></div>
            </div>
            <div class="progress-meta">
              <span>${current} de ${total} cotas</span>
              <span>${pct}% atingido</span>
            </div>
          </div>
        </div>
      `;

      actionBtnHTML = `
        <button class="btn btn-primary btn-block btn-presentear" data-id="${gift.id}">
          <svg class="icon-line sm" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Presentear com Cota Pix
        </button>
      `;
    } else {
      pricingHTML = `
        <div class="gift-pricing">
          <span class="price-main">${formatCurrency(gift.price)}</span>
          <span class="price-sub" style="display:block;">valor de referência</span>
        </div>
      `;

      if (isReserved) {
        actionBtnHTML = `
          <button class="btn btn-secondary btn-block" disabled>
            <svg class="icon-line sm" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>
            Já Reservado por Convidado
          </button>
        `;
      } else {
        actionBtnHTML = `
          <button class="btn btn-primary btn-block btn-presentear" data-id="${gift.id}">
            <svg class="icon-line sm" viewBox="0 0 24 24"><path d="M20 12V22H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zm0 0h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
            Presentear este Item
          </button>
        `;
      }
    }

    const fallbackImg = `
      <div class="gift-card-placeholder">
        <svg class="icon-line lg" viewBox="0 0 24 24"><path d="M20 12V22H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zm0 0h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
        <span>Rhebeca & Matheus</span>
      </div>
    `;

    const imgTag = gift.imageUrl 
      ? `<img src="${gift.imageUrl}" alt="${escapeHTML(gift.title)}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='${fallbackImg.replace(/"/g, "'")}';" />`
      : fallbackImg;

    return `
      <div class="gift-card" id="card_${gift.id}">
        <div class="gift-card-media">
          ${imgTag}
          ${badgeHTML}
        </div>
        <div class="gift-card-body">
          <div class="gift-category">${escapeHTML(gift.category)}</div>
          <h3 class="gift-title">${escapeHTML(gift.title)}</h3>
          <p class="gift-desc">${escapeHTML(gift.description || '')}</p>
          ${pricingHTML}
          <div style="margin-top: auto;">
            ${actionBtnHTML}
          </div>
        </div>
      </div>
    `;
  },

  async openActionModal(giftId) {
    const gift = await window.weddingDB.getGiftById(giftId);
    if (!gift) return;

    if (gift.isCota) {
      this.openCotaModal(gift);
    } else {
      this.openReserveModal(gift);
    }
  },

  async openReserveModal(gift) {
    const modal = document.getElementById('reserveModal');
    if (!modal) return;

    document.getElementById('reserveGiftTitle').innerText = gift.title;
    document.getElementById('reserveGiftPrice').innerText = formatCurrency(gift.price);
    document.getElementById('reserveGiftId').value = gift.id;

    document.getElementById('reserveGuestName').value = '';
    document.getElementById('reserveGuestPhone').value = '';
    document.getElementById('reserveGuestMessage').value = '';

    modal.classList.add('active');
  },

  async openCotaModal(gift) {
    const modal = document.getElementById('cotaModal');
    if (!modal) return;

    const settings = await window.weddingDB.getSettings();

    document.getElementById('cotaGiftTitle').innerText = gift.title;
    document.getElementById('cotaUnitValue').innerText = formatCurrency(gift.quotaValue);
    document.getElementById('cotaGiftId').value = gift.id;

    const countInput = document.getElementById('cotaCountInput');
    countInput.value = 1;

    const updateCalculatedTotal = () => {
      const count = parseInt(countInput.value) || 1;
      const total = count * gift.quotaValue;
      document.getElementById('cotaCalculatedTotal').innerText = formatCurrency(total);
    };
    countInput.oninput = updateCalculatedTotal;
    updateCalculatedTotal();

    // Pix Key info
    document.getElementById('pixKeyDisplay').innerText = settings.pixKey;
    document.getElementById('pixHolderDisplay').innerText = settings.pixName;

    // Gerar QR Code Dinâmico
    const qrImg = document.getElementById('pixQrCodeImg');
    const qrPayload = `PIX-${settings.pixKey}-${gift.title}`;
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrPayload)}`;

    document.getElementById('cotaGuestName').value = '';
    document.getElementById('cotaGuestPhone').value = '';
    document.getElementById('cotaGuestMessage').value = '';

    modal.classList.add('active');
  }
};

/* ==========================================================================
   RESERVA E COTAS (Submissão e Feedback)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Formulário de Reserva de Presente Físico
  const reserveForm = document.getElementById('reserveGiftForm');
  if (reserveForm) {
    reserveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const giftId = document.getElementById('reserveGiftId').value;
      const guestName = document.getElementById('reserveGuestName').value.trim();
      const phone = document.getElementById('reserveGuestPhone').value.trim();
      const message = document.getElementById('reserveGuestMessage').value.trim();

      if (!guestName) {
        showToast('Por favor, informe seu nome.', 'error');
        return;
      }

      try {
        await window.weddingDB.reserveGift(giftId, { guestName, phone, message });
        document.getElementById('reserveModal').classList.remove('active');
        showToast('Presente reservado com carinho! Os noivos agradecem de coração.', 'success');
        await CatalogController.refresh();
        await MessagesController.refresh();
      } catch (err) {
        showToast(err.message || 'Erro ao reservar presente.', 'error');
      }
    });
  }

  // 2. Formulário de Cota Pix
  const cotaForm = document.getElementById('cotaForm');
  if (cotaForm) {
    cotaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const giftId = document.getElementById('cotaGiftId').value;
      const guestName = document.getElementById('cotaGuestName').value.trim();
      const phone = document.getElementById('cotaGuestPhone').value.trim();
      const message = document.getElementById('cotaGuestMessage').value.trim();
      const count = parseInt(document.getElementById('cotaCountInput').value) || 1;

      if (!guestName) {
        showToast('Por favor, informe seu nome.', 'error');
        return;
      }

      try {
        const gift = await window.weddingDB.getGiftById(giftId);
        const amount = count * gift.quotaValue;

        await window.weddingDB.contributeCota(giftId, amount, count, { guestName, phone, message });
        document.getElementById('cotaModal').classList.remove('active');
        showToast('Contribuição registrada! Muito obrigado por abençoar a lua de mel!', 'success');
        await CatalogController.refresh();
        await MessagesController.refresh();
      } catch (err) {
        showToast(err.message || 'Erro ao registrar cota.', 'error');
      }
    });
  }

  // 3. Botão Copiar Chave Pix
  const btnCopyPix = document.getElementById('btnCopyPix');
  if (btnCopyPix) {
    btnCopyPix.addEventListener('click', async () => {
      const pixKey = document.getElementById('pixKeyDisplay').innerText;
      try {
        await navigator.clipboard.writeText(pixKey);
        showToast('Chave Pix copiada com sucesso!', 'success');
      } catch (err) {
        // Fallback
        const tempInput = document.createElement('input');
        tempInput.value = pixKey;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        showToast('Chave Pix copiada!', 'success');
      }
    });
  }
});

/* ==========================================================================
   MURAL DE MENSAGENS DE FELICITAÇÕES
   ========================================================================== */
const MessagesController = {
  async init() {
    const form = document.getElementById('guestMessageForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const author = document.getElementById('msgAuthorInput').value.trim();
        const text = document.getElementById('msgTextInput').value.trim();

        if (!author || !text) {
          showToast('Preencha seu nome e sua mensagem.', 'error');
          return;
        }

        await window.weddingDB.addMessage({ author, text });
        form.reset();
        showToast('Sua mensagem de carinho foi enviada aos noivos!', 'success');
        await this.refresh();
      });
    }

    await this.refresh();
  },

  async refresh() {
    const wall = document.getElementById('messagesWall');
    if (!wall) return;

    const messages = await window.weddingDB.getAllMessages();

    if (messages.length === 0) {
      wall.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--color-olive-muted);">
          <p>Seja o primeiro a deixar uma mensagem de carinho para Rhebeca e Matheus!</p>
        </div>
      `;
      return;
    }

    wall.innerHTML = messages.map(msg => `
      <div class="message-bubble">
        <div class="message-bubble-header">
          <span class="message-author">${escapeHTML(msg.author)}</span>
          <span class="message-time">${formatDate(msg.createdAt)}</span>
        </div>
        <p class="message-text">"${escapeHTML(msg.text)}"</p>
        ${msg.giftTitle ? `<div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-olive-primary); font-weight: 600;">Presente: ${escapeHTML(msg.giftTitle)}</div>` : ''}
      </div>
    `).join('');
  }
};

/* ==========================================================================
   RSVP (CONFIRMAÇÃO DE PRESENÇA)
   ========================================================================== */
const RsvpController = {
  init() {
    const form = document.getElementById('rsvpForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const guestName = document.getElementById('rsvpName').value.trim();
      const email = document.getElementById('rsvpEmail').value.trim();
      const phone = document.getElementById('rsvpPhone').value.trim();
      const companions = parseInt(document.getElementById('rsvpCompanions').value) || 0;
      const status = document.querySelector('input[name="rsvpStatus"]:checked').value;
      const dietary = document.getElementById('rsvpDietary').value.trim();

      if (!guestName) {
        showToast('Por favor, informe seu nome completo.', 'error');
        return;
      }

      await window.weddingDB.saveRsvp({
        guestName,
        email,
        phone,
        companions,
        status,
        dietary
      });

      form.reset();
      showToast('Presença confirmada com sucesso! Mal podemos esperar por esse grande dia!', 'success');
    });
  }
};

/* ==========================================================================
   PAINEL ADMINISTRATIVO DOS NOIVOS (v.1.0.0)
   ========================================================================== */
const AdminController = {
  currentTab: 'gifts',

  async init() {
    const openBtn = document.getElementById('btnOpenAdmin');
    const modal = document.getElementById('adminModal');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        modal.classList.add('active');
        this.render();
      });
    }

    // Tabs
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentTab = e.target.getAttribute('data-tab');
        this.render();
      });
    });

    // Formulário de Adicionar / Editar Item
    const giftForm = document.getElementById('adminGiftForm');
    if (giftForm) {
      giftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveGift();
      });
    }

    // Checkbox Cota no Form Admin
    const isCotaCheck = document.getElementById('adminGiftIsCota');
    const cotaFields = document.getElementById('adminCotaFields');
    if (isCotaCheck && cotaFields) {
      isCotaCheck.addEventListener('change', () => {
        cotaFields.style.display = isCotaCheck.checked ? 'block' : 'none';
      });
    }

    // Formulário de Configurações
    const settingsForm = document.getElementById('adminSettingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveSettings();
      });
    }
  },

  async render() {
    // Esconder todas as abas
    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');

    if (this.currentTab === 'gifts') {
      document.getElementById('adminTabGifts').style.display = 'block';
      await this.renderGiftsTable();
    } else if (this.currentTab === 'rsvps') {
      document.getElementById('adminTabRsvps').style.display = 'block';
      await this.renderRsvpsTable();
    } else if (this.currentTab === 'settings') {
      document.getElementById('adminTabSettings').style.display = 'block';
      await this.renderSettingsForm();
    }
  },

  async renderGiftsTable() {
    const tbody = document.getElementById('adminGiftsTableBody');
    if (!tbody) return;

    const gifts = await window.weddingDB.getAllGifts();

    if (gifts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">Nenhum item cadastrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = gifts.map(g => `
      <tr>
        <td><strong>${escapeHTML(g.title)}</strong></td>
        <td>${escapeHTML(g.category)}</td>
        <td>${g.isCota ? `${formatCurrency(g.quotaValue)}/cota (${g.quotaCurrent || 0}/${g.quotaTotal})` : formatCurrency(g.price)}</td>
        <td>
          <span class="gift-badge ${g.status === 'reserved' ? 'badge-reserved' : 'badge-available'}">
            ${g.status === 'reserved' ? `Reservado (${escapeHTML(g.reservedBy || '')})` : (g.status === 'completed' ? 'Concluído' : 'Disponível')}
          </span>
        </td>
        <td>
          <button class="btn btn-outline btn-admin-edit" data-id="${g.id}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; margin-right: 0.3rem;">Editar</button>
          <button class="btn btn-secondary btn-admin-del" data-id="${g.id}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; color: var(--color-error);">Excluir</button>
        </td>
      </tr>
    `).join('');

    // Ações
    tbody.querySelectorAll('.btn-admin-edit').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        await this.editGift(id);
      });
    });

    tbody.querySelectorAll('.btn-admin-del').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        if (confirm('Tem certeza que deseja excluir permanentemente este item?')) {
          await window.weddingDB.deleteGift(id);
          showToast('Item excluído da lista e sincronizado.', 'success');
          await this.renderGiftsTable();
          await CatalogController.refresh();
        }
      });
    });
  },

  async editGift(id) {
    const gift = await window.weddingDB.getGiftById(id);
    if (!gift) return;

    document.getElementById('adminGiftId').value = gift.id;
    document.getElementById('adminGiftTitle').value = gift.title;
    document.getElementById('adminGiftCategory').value = gift.category;
    document.getElementById('adminGiftPrice').value = gift.price;
    document.getElementById('adminGiftDesc').value = gift.description || '';
    document.getElementById('adminGiftImage').value = gift.imageUrl || '';

    const isCotaCheck = document.getElementById('adminGiftIsCota');
    isCotaCheck.checked = !!gift.isCota;
    document.getElementById('adminCotaFields').style.display = gift.isCota ? 'block' : 'none';
    if (gift.isCota) {
      document.getElementById('adminGiftQuotaVal').value = gift.quotaValue || '';
      document.getElementById('adminGiftQuotaTotal').value = gift.quotaTotal || '';
    }

    document.getElementById('adminGiftSubmitBtn').innerText = 'Salvar Alterações';
    document.getElementById('adminGiftCancelBtn').style.display = 'inline-flex';
    document.getElementById('adminGiftFormTitle').innerText = 'Editar Item da Lista';
  },

  resetGiftForm() {
    const form = document.getElementById('adminGiftForm');
    if (form) form.reset();
    document.getElementById('adminGiftId').value = '';
    document.getElementById('adminCotaFields').style.display = 'none';
    document.getElementById('adminGiftSubmitBtn').innerText = 'Adicionar à Lista';
    document.getElementById('adminGiftCancelBtn').style.display = 'none';
    document.getElementById('adminGiftFormTitle').innerText = 'Novo Presente ou Cota';
  },

  async handleSaveGift() {
    const id = document.getElementById('adminGiftId').value || ('gift_' + Date.now());
    const title = document.getElementById('adminGiftTitle').value.trim();
    const category = document.getElementById('adminGiftCategory').value;
    const price = parseFloat(document.getElementById('adminGiftPrice').value) || 0;
    const description = document.getElementById('adminGiftDesc').value.trim();
    const imageUrl = document.getElementById('adminGiftImage').value.trim();
    const isCota = document.getElementById('adminGiftIsCota').checked;

    if (!title) {
      showToast('O título do item é obrigatório.', 'error');
      return;
    }

    let existing = await window.weddingDB.getGiftById(id);
    const giftData = existing || {
      id,
      status: 'available',
      quotaCurrent: 0,
      amountRaised: 0
    };

    giftData.title = title;
    giftData.category = category;
    giftData.price = price;
    giftData.description = description;
    giftData.imageUrl = imageUrl;
    giftData.isCota = isCota;

    if (isCota) {
      giftData.quotaValue = parseFloat(document.getElementById('adminGiftQuotaVal').value) || (price / 5);
      giftData.quotaTotal = parseInt(document.getElementById('adminGiftQuotaTotal').value) || Math.round(price / giftData.quotaValue);
    }

    await window.weddingDB.saveGift(giftData);
    showToast('Item salvo com sucesso e sincronizado!', 'success');
    this.resetGiftForm();
    await this.renderGiftsTable();
    await CatalogController.refresh();
  },

  async renderRsvpsTable() {
    const tbody = document.getElementById('adminRsvpsTableBody');
    if (!tbody) return;

    const rsvps = await window.weddingDB.getAllRsvps();
    if (rsvps.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">Nenhuma confirmação de presença registrada ainda.</td></tr>`;
      return;
    }

    tbody.innerHTML = rsvps.map(r => `
      <tr>
        <td><strong>${escapeHTML(r.guestName)}</strong></td>
        <td>${escapeHTML(r.phone || '-')} / ${escapeHTML(r.email || '-')}</td>
        <td>${r.companions + 1} pessoa(s)</td>
        <td>
          <span class="gift-badge ${r.status === 'confirmed' ? 'badge-available' : 'badge-reserved'}">
            ${r.status === 'confirmed' ? 'Confirmado' : 'Não poderá ir'}
          </span>
        </td>
        <td>${escapeHTML(r.dietary || '-')}</td>
      </tr>
    `).join('');
  },

  async renderSettingsForm() {
    const settings = await window.weddingDB.getSettings();
    document.getElementById('settingPixKey').value = settings.pixKey || '';
    document.getElementById('settingPixName').value = settings.pixName || '';
    document.getElementById('settingPixCity').value = settings.pixCity || '';
    document.getElementById('settingWeddingDate').value = settings.weddingDate ? settings.weddingDate.substring(0, 16) : '';
    document.getElementById('settingSupabaseUrl').value = settings.supabaseUrl || '';
    document.getElementById('settingSupabaseKey').value = settings.supabaseKey || '';
  },

  async handleSaveSettings() {
    const newSettings = {
      pixKey: document.getElementById('settingPixKey').value.trim(),
      pixName: document.getElementById('settingPixName').value.trim(),
      pixCity: document.getElementById('settingPixCity').value.trim(),
      weddingDate: document.getElementById('settingWeddingDate').value,
      supabaseUrl: document.getElementById('settingSupabaseUrl').value.trim(),
      supabaseKey: document.getElementById('settingSupabaseKey').value.trim()
    };

    await window.weddingDB.saveSettings(newSettings);
    showToast('Configurações salvas e integradas com sucesso!', 'success');
    await CountdownController.init();
  }
};

/* ==========================================================================
   UTILITÁRIOS
   ========================================================================== */
function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSvg = type === 'success' 
    ? `<svg class="icon-line sm" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`
    : `<svg class="icon-line sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  toast.innerHTML = `
    ${iconSvg}
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }, 4000);
}
