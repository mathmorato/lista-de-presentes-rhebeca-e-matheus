/* ==========================================================================
   LISTA DE PRESENTES - RHEBECA & MATHEUS
   Versão: v.1.0.8
   Módulo: Aplicação Principal, Vitrine Pública e Extrator Inteligente
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar Banco de Dados Híbrido com listener de mudanças em tempo real
  await window.weddingDB.init((changeType) => {
    console.log('[App v.1.0.8] Mudança em tempo real recebida:', changeType);
    if (changeType === 'gifts') {
      CatalogController.refresh();
      AdminController.renderGiftsTable();
    }
  });

  // 2. Inicializar Módulos do Sistema
  ThemeController.init();
  CountdownController.init();
  CatalogController.init();
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
   GERENCIADOR DE TEMAS (Modo Claro Padrão / Escuro Musgo Elegante)
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
   CONTAGEM REGRESSIVA DO CASAMENTO (09/01/2027 às 17:00)
   ========================================================================== */
const CountdownController = {
  async init() {
    const settings = await window.weddingDB.getSettings();
    const targetDate = new Date(settings.weddingDate || '2027-01-09T17:00:00').getTime();

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
   VITRINE PÚBLICA PARA CONVIDADOS (Busca, Filtros Avançados e Ordenação)
   ========================================================================== */
const CatalogController = {
  currentCategory: 'all',
  currentPriceRange: 'all',
  currentAvailability: 'all',
  currentSort: 'featured',
  searchQuery: '',
  allGifts: [],

  async init() {
    this.setupListeners();
    await this.refresh();
  },

  setupListeners() {
    // 1. Filtro por Categoria
    document.querySelectorAll('.category-chips .chip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.category-chips .chip-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentCategory = e.target.getAttribute('data-category');
        this.render();
      });
    });

    // 2. Busca Dinâmica por Nome ou Descrição
    const searchInput = document.getElementById('giftSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // 3. Filtro por Faixa de Preço
    const priceSelect = document.getElementById('filterPriceRange');
    if (priceSelect) {
      priceSelect.addEventListener('change', (e) => {
        this.currentPriceRange = e.target.value;
        this.render();
      });
    }

    // 4. Filtro por Disponibilidade
    const availSelect = document.getElementById('filterAvailability');
    if (availSelect) {
      availSelect.addEventListener('change', (e) => {
        this.currentAvailability = e.target.value;
        this.render();
      });
    }

    // 5. Ordenação
    const sortSelect = document.getElementById('sortGifts');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.render();
      });
    }

    // 6. Fechamento de Modais
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
      const matchCat = this.currentCategory === 'all' || gift.category === this.currentCategory;
      const matchSearch = !this.searchQuery || 
        gift.title.toLowerCase().includes(this.searchQuery) ||
        (gift.description && gift.description.toLowerCase().includes(this.searchQuery));

      let matchPrice = true;
      const effectivePrice = gift.isCota ? (gift.quotaValue || gift.price) : gift.price;
      if (this.currentPriceRange === 'under100') {
        matchPrice = effectivePrice <= 100;
      } else if (this.currentPriceRange === '100to300') {
        matchPrice = effectivePrice > 100 && effectivePrice <= 300;
      } else if (this.currentPriceRange === '300to600') {
        matchPrice = effectivePrice > 300 && effectivePrice <= 600;
      } else if (this.currentPriceRange === 'above600') {
        matchPrice = effectivePrice > 600;
      }

      let matchAvail = true;
      const isReservedOrCompleted = gift.status === 'reserved' || gift.status === 'completed';
      if (this.currentAvailability === 'available') {
        matchAvail = !isReservedOrCompleted;
      } else if (this.currentAvailability === 'reserved') {
        matchAvail = isReservedOrCompleted;
      }

      return matchCat && matchSearch && matchPrice && matchAvail;
    });

    filtered.sort((a, b) => {
      const priceA = a.isCota ? (a.quotaValue || a.price) : a.price;
      const priceB = b.isCota ? (b.quotaValue || b.price) : b.price;

      if (this.currentSort === 'featured') {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return 0;
      } else if (this.currentSort === 'price_asc') {
        return priceA - priceB;
      } else if (this.currentSort === 'price_desc') {
        return priceB - priceA;
      } else if (this.currentSort === 'name_asc') {
        return a.title.localeCompare(b.title);
      } else if (this.currentSort === 'name_desc') {
        return b.title.localeCompare(a.title);
      }
      return 0;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4.5rem 1rem;">
          <svg class="icon-line lg" style="color: var(--color-olive-muted); margin-bottom: 1rem;" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h3 style="margin-bottom: 0.5rem; font-size: 1.3rem;">Nenhum presente encontrado</h3>
          <p>Tente ajustar os filtros de pesquisa, faixa de preço ou categoria selecionada.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(gift => this.createCardHTML(gift)).join('');

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

    let statusBadgeHTML = '';
    if (gift.isCota) {
      statusBadgeHTML = `<span class="gift-badge badge-cota">Cota Lua de Mel</span>`;
    } else if (isReserved) {
      statusBadgeHTML = `<span class="gift-badge badge-reserved">Reservado</span>`;
    } else {
      statusBadgeHTML = `<span class="gift-badge badge-available">Disponível</span>`;
    }

    const featuredBadgeHTML = gift.isFeatured 
      ? `<span class="badge-featured">
           <svg class="icon-line sm" style="width: 14px; height: 14px;" viewBox="0 0 24 24">
             <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
           </svg>
           Mais Desejado
         </span>`
      : '';

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
            Já Reservado com Carinho
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

    const storeLinkHTML = gift.productUrl 
      ? `<a href="${escapeHTML(gift.productUrl)}" target="_blank" rel="noopener noreferrer" class="btn-store-link">
           <svg class="icon-line sm" style="width: 14px; height: 14px;" viewBox="0 0 24 24">
             <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
             <polyline points="15 3 21 3 21 9"></polyline>
             <line x1="10" y1="14" x2="21" y2="3"></line>
           </svg>
           Ver na loja original
         </a>`
      : '';

    const fallbackImg = `
      <div class="gift-card-placeholder">
        <svg class="icon-line lg" viewBox="0 0 24 24"><path d="M20 12V22H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zm0 0h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
        <span>Rhebeca & Matheus</span>
      </div>
    `;

    const imgTag = gift.imageUrl 
      ? `<img src="${escapeHTML(gift.imageUrl)}" alt="${escapeHTML(gift.title)}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='${fallbackImg.replace(/"/g, "'")}';" />`
      : fallbackImg;

    return `
      <div class="gift-card" id="card_${gift.id}">
        <div class="gift-card-media">
          ${imgTag}
          ${featuredBadgeHTML}
          ${statusBadgeHTML}
        </div>
        <div class="gift-card-body">
          <div class="gift-category">${escapeHTML(gift.category)}</div>
          <h3 class="gift-title">${escapeHTML(gift.title)}</h3>
          <p class="gift-desc">${escapeHTML(gift.description || '')}</p>
          ${pricingHTML}
          <div class="card-actions-wrapper">
            ${actionBtnHTML}
            ${storeLinkHTML}
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
      const total = count * (gift.quotaValue || gift.price);
      document.getElementById('cotaCalculatedTotal').innerText = formatCurrency(total);
    };
    countInput.oninput = updateCalculatedTotal;
    updateCalculatedTotal();

    document.getElementById('pixKeyDisplay').innerText = settings.pixKey;
    document.getElementById('pixHolderDisplay').innerText = settings.pixName;

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
   SUBMISSÃO DE RESERVAS E COTAS PIX
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
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
        const amount = count * (gift.quotaValue || gift.price);

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

  const btnCopyPix = document.getElementById('btnCopyPix');
  if (btnCopyPix) {
    btnCopyPix.addEventListener('click', async () => {
      const pixKey = document.getElementById('pixKeyDisplay').innerText;
      try {
        await navigator.clipboard.writeText(pixKey);
        showToast('Chave Pix copiada com sucesso!', 'success');
      } catch (err) {
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
   PAINEL ADMINISTRATIVO DOS NOIVOS (v.1.0.8) COM EXTRATOR APRIMORADO
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

    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentTab = e.target.getAttribute('data-tab');
        this.render();
      });
    });

    // 1. Extrator Inteligente Resiliente com Heurística
    const btnExtract = document.getElementById('btnExtractUrl');
    const urlInput = document.getElementById('extractUrlInput');
    if (btnExtract && urlInput) {
      btnExtract.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
          showToast('Cole o link do produto de qualquer loja virtual.', 'error');
          return;
        }

        const originalBtnText = btnExtract.innerHTML;
        btnExtract.disabled = true;
        btnExtract.innerHTML = `
          <svg class="icon-line sm" style="animation: spin 1s linear infinite;" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="16"></circle>
          </svg>
          Extraindo dados...
        `;

        try {
          showToast('Analisando produto da loja...', 'info');
          const data = await window.LinkExtractor.extractFromUrl(url);

          // Preencher formulário pré-salvamento
          document.getElementById('adminGiftId').value = '';
          document.getElementById('adminGiftTitle').value = data.title;
          document.getElementById('adminGiftPrice').value = data.price > 0 ? data.price : '';
          document.getElementById('adminGiftImage').value = data.imageUrl;
          document.getElementById('adminGiftProductUrl').value = data.productUrl;
          document.getElementById('adminGiftDesc').value = data.description;
          document.getElementById('adminGiftCategory').value = data.category || 'cozinha';

          this.updateImagePreview(data.imageUrl);

          document.getElementById('adminGiftFormTitle').innerText = `Revisar & Salvar Presente (${data.sourceStore})`;
          document.getElementById('adminGiftSubmitBtn').innerText = 'Salvar Item na Lista';
          document.getElementById('adminGiftForm').scrollIntoView({ behavior: 'smooth' });

          if (!data.price || data.price === 0) {
            showToast(`Produto identificado da ${data.sourceStore}! Por favor, informe o valor estimado (R$).`, 'success');
            const priceInput = document.getElementById('adminGiftPrice');
            if (priceInput) priceInput.focus();
          } else {
            showToast(`Dados extraídos da ${data.sourceStore}! Revise e confirme.`, 'success');
          }
        } catch (err) {
          showToast(err.message || 'Erro ao extrair link.', 'error');
        } finally {
          btnExtract.disabled = false;
          btnExtract.innerHTML = originalBtnText;
        }
      });
    }

    const imgInput = document.getElementById('adminGiftImage');
    if (imgInput) {
      imgInput.addEventListener('input', (e) => {
        this.updateImagePreview(e.target.value.trim());
      });
    }

    const giftForm = document.getElementById('adminGiftForm');
    if (giftForm) {
      giftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveGift();
      });
    }

    const isCotaCheck = document.getElementById('adminGiftIsCota');
    const cotaFields = document.getElementById('adminCotaFields');
    if (isCotaCheck && cotaFields) {
      isCotaCheck.addEventListener('change', () => {
        cotaFields.style.display = isCotaCheck.checked ? 'block' : 'none';
      });
    }

    const settingsForm = document.getElementById('adminSettingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveSettings();
      });
    }
  },

  updateImagePreview(url) {
    const previewBox = document.getElementById('adminImagePreviewBox');
    if (!previewBox) return;
    if (url) {
      previewBox.innerHTML = `<img src="${escapeHTML(url)}" alt="Preview" onerror="this.parentElement.innerHTML='<span style=\\'font-size: 0.8rem; color: var(--color-olive-muted);\\'>Falha ao carregar</span>';">`;
    } else {
      previewBox.innerHTML = `<span style="font-size: 0.8rem; color: var(--color-olive-muted);">Nenhuma imagem</span>`;
    }
  },

  async render() {
    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');

    if (this.currentTab === 'gifts') {
      document.getElementById('adminTabGifts').style.display = 'block';
      await this.renderGiftsTable();
    } else if (this.currentTab === 'reservations') {
      document.getElementById('adminTabReservations').style.display = 'block';
      await this.renderReservationsTable();
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
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">Nenhum item cadastrado ainda. Use o extrator por link acima para começar!</td></tr>`;
      return;
    }

    tbody.innerHTML = gifts.map(g => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button class="btn-icon btn-admin-star" data-id="${g.id}" title="${g.isFeatured ? 'Remover dos Mais Desejados' : 'Marcar como Mais Desejado'}" style="width: 28px; height: 28px; border: none; background: none; color: ${g.isFeatured ? 'var(--color-gold-accent)' : 'var(--color-olive-muted)'}; cursor: pointer;">
              <svg class="icon-line sm" viewBox="0 0 24 24" style="${g.isFeatured ? 'fill: var(--color-gold-accent);' : ''}">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </button>
            <strong>${escapeHTML(g.title)}</strong>
          </div>
        </td>
        <td>${escapeHTML(g.category)}</td>
        <td>${g.isCota ? `${formatCurrency(g.quotaValue)}/cota (${g.quotaCurrent || 0}/${g.quotaTotal})` : formatCurrency(g.price)}</td>
        <td>
          <span class="gift-badge ${g.status === 'reserved' ? 'badge-reserved' : (g.status === 'completed' ? 'badge-cota' : 'badge-available')}">
            ${g.status === 'reserved' ? `Reservado (${escapeHTML(g.reservedBy || '')})` : (g.status === 'completed' ? 'Concluído' : 'Disponível')}
          </span>
        </td>
        <td>
          ${g.productUrl ? `<a href="${escapeHTML(g.productUrl)}" target="_blank" title="Abrir link original" style="color: var(--color-olive-primary); font-size: 0.8rem; text-decoration: underline;">Loja</a>` : '-'}
        </td>
        <td>
          <button class="btn btn-outline btn-admin-edit" data-id="${g.id}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; margin-right: 0.3rem;">Editar</button>
          ${(g.status === 'reserved' || g.status === 'completed' || (g.quotaCurrent && g.quotaCurrent > 0)) ? `<button class="btn btn-outline btn-admin-unreserve" data-id="${g.id}" title="Liberar item para ficar disponível novamente" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; margin-right: 0.3rem; color: var(--color-gold-accent); border-color: var(--color-gold-accent);">Liberar</button>` : ''}
          <button class="btn btn-secondary btn-admin-del" data-id="${g.id}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; color: var(--color-error);">Excluir</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-admin-star').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        await window.weddingDB.toggleFeatured(id);
        await this.renderGiftsTable();
        await CatalogController.refresh();
      });
    });

    tbody.querySelectorAll('.btn-admin-edit').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        await this.editGift(id);
      });
    });

    tbody.querySelectorAll('.btn-admin-del').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        await this.confirmDeleteGift(id);
      });
    });

    tbody.querySelectorAll('.btn-admin-unreserve').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        if (confirm('Deseja liberar este presente para ficar disponível novamente na lista pública?')) {
          await window.weddingDB.unreserveGift(id);
          showToast('Presente liberado e disponível novamente!', 'success');
          await this.renderGiftsTable();
          await CatalogController.refresh();
        }
      });
    });
  },

  async confirmDeleteGift(id) {
    const deleteModal = document.getElementById('deleteModal');
    const deleteItemTitleText = document.getElementById('deleteItemTitleText');
    const deleteProgressBox = document.getElementById('deleteProgressBox');
    const deleteProgressBar = document.getElementById('deleteProgressBar');
    const deleteProgressStatusText = document.getElementById('deleteProgressStatusText');
    const deleteProgressPercent = document.getElementById('deleteProgressPercent');
    const deleteModalActions = document.getElementById('deleteModalActions');
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    const btnCancelDelete = document.getElementById('btnCancelDelete');

    if (!deleteModal) return;

    const gift = await window.weddingDB.getGiftById(id);
    const itemTitle = gift ? gift.title : 'este item';

    deleteItemTitleText.innerHTML = `Tem certeza que deseja excluir <strong>"${escapeHTML(itemTitle)}"</strong>?<br><span style="font-size:0.83rem; color:var(--color-olive-muted);">A exclusão removerá os dados permanentemente no cache local e no Supabase.</span>`;

    // Resetar estado do modal
    deleteProgressBox.style.display = 'none';
    deleteProgressBar.style.width = '0%';
    deleteProgressPercent.innerText = '0%';
    deleteProgressStatusText.innerText = 'Excluindo do cache e sincronizando...';
    deleteModalActions.style.display = 'flex';

    deleteModal.classList.add('active');

    const closeModal = () => {
      deleteModal.classList.remove('active');
    };

    btnCancelDelete.onclick = closeModal;

    btnConfirmDelete.onclick = async () => {
      // Ocultar botões e mostrar a barra de carregamento na própria tela
      deleteModalActions.style.display = 'none';
      deleteProgressBox.style.display = 'block';

      // Etapa 1: Início da remoção (30%)
      deleteProgressBar.style.width = '30%';
      deleteProgressPercent.innerText = '30%';
      deleteProgressStatusText.innerText = 'Removendo do cache local IndexedDB...';

      await new Promise(r => setTimeout(r, 200));

      // Executar exclusão local + nuvem (Supabase)
      await window.weddingDB.deleteGift(id);

      // Etapa 2: Sincronização em andamento (75%)
      deleteProgressBar.style.width = '75%';
      deleteProgressPercent.innerText = '75%';
      deleteProgressStatusText.innerText = 'Sincronizando exclusão com o Supabase...';

      await new Promise(r => setTimeout(r, 250));

      // Etapa 3: Conclusão (100%)
      deleteProgressBar.style.width = '100%';
      deleteProgressPercent.innerText = '100%';
      deleteProgressStatusText.innerText = 'Exclusão concluída com sucesso!';

      await new Promise(r => setTimeout(r, 200));

      closeModal();
      showToast(`Item "${itemTitle}" excluído e sincronizado!`, 'success');
      await this.renderGiftsTable();
      await CatalogController.refresh();
    };
  },

  async renderReservationsTable() {
    const tbody = document.getElementById('adminReservationsTableBody');
    if (!tbody) return;

    const gifts = await window.weddingDB.getAllGifts();
    const giftedItems = gifts.filter(g => 
      g.status === 'reserved' || 
      g.status === 'completed' || 
      (g.quotaCurrent && g.quotaCurrent > 0) || 
      (g.contributions && g.contributions.length > 0)
    );

    // Calcular Estatísticas dos Presenteados
    const reservedCount = gifts.filter(g => g.status === 'reserved' || g.status === 'completed').length;
    let totalCotasAmount = 0;
    const uniqueGuests = new Set();

    gifts.forEach(g => {
      if (g.amountRaised) totalCotasAmount += parseFloat(g.amountRaised);
      if (g.reservedBy) uniqueGuests.add(g.reservedBy.trim());
      if (g.contributions && Array.isArray(g.contributions)) {
        g.contributions.forEach(c => {
          if (c.guestName) uniqueGuests.add(c.guestName.trim());
        });
      }
    });

    const statReservedEl = document.getElementById('statTotalReserved');
    const statCotasEl = document.getElementById('statTotalCotasAmount');
    const statGuestsEl = document.getElementById('statTotalGuests');

    if (statReservedEl) statReservedEl.innerText = reservedCount;
    if (statCotasEl) statCotasEl.innerText = formatCurrency(totalCotasAmount);
    if (statGuestsEl) statGuestsEl.innerText = uniqueGuests.size;

    if (giftedItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--color-olive-muted);">Nenhum presente foi reservado ou contribuído ainda. Quando um convidado reservar um item ou pagar uma cota, ele aparecerá aqui!</td></tr>`;
      return;
    }

    tbody.innerHTML = giftedItems.map(g => {
      // Mapear convidados e mensagens
      let guestListStr = '-';
      let contactStr = '-';
      let messageStr = '-';

      if (g.isCota) {
        if (g.contributions && g.contributions.length > 0) {
          const names = g.contributions.map(c => `${escapeHTML(c.guestName)} (${c.quotaCount} cota${c.quotaCount > 1 ? 's' : ''})`);
          guestListStr = names.join('<br>');

          const contacts = g.contributions.map(c => c.phone || c.email).filter(Boolean);
          contactStr = contacts.length > 0 ? escapeHTML(contacts.join(', ')) : '-';

          const msgs = g.contributions.map(c => c.message).filter(Boolean);
          messageStr = msgs.length > 0 ? `"${escapeHTML(msgs[msgs.length - 1])}"` : '-';
        } else if (g.reservedBy) {
          guestListStr = escapeHTML(g.reservedBy);
          contactStr = escapeHTML(g.guestPhone || '-');
          messageStr = g.guestMessage ? `"${escapeHTML(g.guestMessage)}"` : '-';
        }
      } else {
        guestListStr = `<strong>${escapeHTML(g.reservedBy || 'Convidado')}</strong>`;
        contactStr = escapeHTML(g.guestPhone || '-');
        messageStr = g.guestMessage ? `"${escapeHTML(g.guestMessage)}"` : '-';
      }

      const progressDisplay = g.isCota 
        ? `<strong style="color: var(--color-olive-primary);">${formatCurrency(g.amountRaised || 0)}</strong><br><span style="font-size: 0.78rem; color: var(--color-olive-muted);">${g.quotaCurrent || 0}/${g.quotaTotal || 0} cotas</span>`
        : `<strong>${formatCurrency(g.price)}</strong>`;

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              ${g.imageUrl ? `<img src="${escapeHTML(g.imageUrl)}" alt="${escapeHTML(g.title)}" style="width: 40px; height: 40px; border-radius: var(--radius-sm); object-fit: cover; border: 1px solid var(--color-olive-border);">` : ''}
              <div>
                <strong>${escapeHTML(g.title)}</strong>
                ${g.isFeatured ? '<span style="font-size:0.72rem; background: var(--color-warning-light); color: var(--color-gold-accent); padding: 0.15rem 0.4rem; border-radius: 4px; margin-left: 0.35rem;">Destaque</span>' : ''}
              </div>
            </div>
          </td>
          <td>
            <span class="gift-badge ${g.isCota ? 'badge-cota' : 'badge-reserved'}">
              ${g.isCota ? 'Cota Lua de Mel' : 'Presente Físico'}
            </span>
          </td>
          <td>${guestListStr}</td>
          <td style="max-width: 220px; font-size: 0.85rem;">
            <div><strong>Contato:</strong> ${contactStr}</div>
            <div style="color: var(--color-olive-muted); font-style: italic; margin-top: 0.2rem;">${messageStr}</div>
          </td>
          <td>${progressDisplay}</td>
          <td>
            <button class="btn btn-outline btn-admin-unreserve" data-id="${g.id}" title="Liberar este item para ficar disponível novamente na vitrine pública" style="padding: 0.4rem 0.85rem; font-size: 0.82rem; color: var(--color-gold-accent); border-color: var(--color-gold-accent);">
              <svg class="icon-line sm" viewBox="0 0 24 24" style="margin-right: 0.25rem;">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              Liberar Item
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-admin-unreserve').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        const gift = await window.weddingDB.getGiftById(id);
        const itemTitle = gift ? gift.title : 'este presente';

        if (confirm(`Tem certeza que deseja liberar "${itemTitle}"?\n\nO item ficará disponível novamente para todos os convidados na lista e os dados de reserva serão limpos no cache local e no Supabase.`)) {
          await window.weddingDB.unreserveGift(id);
          showToast(`"${itemTitle}" foi liberado e está disponível novamente!`, 'success');
          await this.renderReservationsTable();
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
    document.getElementById('adminGiftProductUrl').value = gift.productUrl || '';
    document.getElementById('adminGiftFeatured').checked = !!gift.isFeatured;

    const isCotaCheck = document.getElementById('adminGiftIsCota');
    isCotaCheck.checked = !!gift.isCota;
    document.getElementById('adminCotaFields').style.display = gift.isCota ? 'block' : 'none';
    if (gift.isCota) {
      document.getElementById('adminGiftQuotaVal').value = gift.quotaValue || '';
      document.getElementById('adminGiftQuotaTotal').value = gift.quotaTotal || '';
    }

    this.updateImagePreview(gift.imageUrl);

    document.getElementById('adminGiftSubmitBtn').innerText = 'Salvar Alterações';
    document.getElementById('adminGiftCancelBtn').style.display = 'inline-flex';
    document.getElementById('adminGiftFormTitle').innerText = 'Editar Item da Lista';
    document.getElementById('adminGiftForm').scrollIntoView({ behavior: 'smooth' });
  },

  resetGiftForm() {
    const form = document.getElementById('adminGiftForm');
    if (form) form.reset();
    document.getElementById('adminGiftId').value = '';
    document.getElementById('adminCotaFields').style.display = 'none';
    document.getElementById('adminGiftSubmitBtn').innerText = 'Adicionar à Lista';
    document.getElementById('adminGiftCancelBtn').style.display = 'none';
    document.getElementById('adminGiftFormTitle').innerText = 'Cadastrar Novo Presente ou Cota';
    this.updateImagePreview('');
  },

  async handleSaveGift() {
    const id = document.getElementById('adminGiftId').value || ('gift_' + Date.now());
    const title = document.getElementById('adminGiftTitle').value.trim();
    const category = document.getElementById('adminGiftCategory').value;
    const price = parseFloat(document.getElementById('adminGiftPrice').value) || 0;
    const description = document.getElementById('adminGiftDesc').value.trim();
    const imageUrl = document.getElementById('adminGiftImage').value.trim();
    const productUrl = document.getElementById('adminGiftProductUrl').value.trim();
    const isFeatured = document.getElementById('adminGiftFeatured').checked;
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
    giftData.productUrl = productUrl;
    giftData.isFeatured = isFeatured;
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

  async renderSettingsForm() {
    const settings = await window.weddingDB.getSettings();
    document.getElementById('settingPixKey').value = settings.pixKey || '';
    document.getElementById('settingPixName').value = settings.pixName || '';
    document.getElementById('settingPixCity').value = settings.pixCity || 'São Luís de Montes Belos';
    document.getElementById('settingWeddingDate').value = settings.weddingDate ? settings.weddingDate.substring(0, 16) : '2027-01-09T17:00';
    document.getElementById('settingWelcomeMsg').value = settings.welcomeMessage || '';
    document.getElementById('settingCeremonyPlace').value = settings.ceremonyPlace || 'Igreja Batista Shalom';
    document.getElementById('settingCeremonyCity').value = settings.ceremonyCity || 'São Luís de Montes Belos - GO';
    document.getElementById('settingSupabaseUrl').value = settings.supabaseUrl || 'https://ttggcvricfkoqlorbmnv.supabase.co';
    document.getElementById('settingSupabaseKey').value = settings.supabaseKey || 'sb_publishable_vBEg1W6vNGeP2Ia2Fv9DuA_2YxFXirN';
  },

  async handleSaveSettings() {
    const newSettings = {
      pixKey: document.getElementById('settingPixKey').value.trim(),
      pixName: document.getElementById('settingPixName').value.trim(),
      pixCity: document.getElementById('settingPixCity').value.trim(),
      weddingDate: document.getElementById('settingWeddingDate').value,
      welcomeMessage: document.getElementById('settingWelcomeMsg').value.trim(),
      ceremonyPlace: document.getElementById('settingCeremonyPlace').value.trim(),
      ceremonyCity: document.getElementById('settingCeremonyCity').value.trim(),
      supabaseUrl: document.getElementById('settingSupabaseUrl').value.trim(),
      supabaseKey: document.getElementById('settingSupabaseKey').value.trim()
    };

    await window.weddingDB.saveSettings(newSettings);
    
    const heroSubtitle = document.querySelector('.hero-subtitle');
    if (heroSubtitle && newSettings.welcomeMessage) {
      heroSubtitle.innerText = newSettings.welcomeMessage;
    }

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

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg class="icon-line sm" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg class="icon-line sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  } else {
    iconSvg = `<svg class="icon-line sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  }

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
  }, 4500);
}
