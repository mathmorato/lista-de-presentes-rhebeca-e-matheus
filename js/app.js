/* ==========================================================================
   LISTA DE PRESENTES - RHEBECA & MATHEUS
   Versão: v.1.4.9
   Módulo: Aplicação Principal, Vitrine Pública e Extrator Inteligente
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar Banco de Dados Híbrido com listener de mudanças em tempo real
  await window.weddingDB.init((changeType) => {
    console.log('[App v.1.4.9] Mudança em tempo real recebida:', changeType);
    if (changeType === 'gifts' || changeType === 'all') {
      CatalogController.refresh();
      if (document.getElementById('adminModal') && typeof AdminController !== 'undefined') {
        AdminController.renderGiftsTable();
      }
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
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('.modal-close')) {
          modal.classList.remove('active');
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
    const reservedCount = this.allGifts.filter(g => g.status === 'reserved' || g.status === 'completed' || (g.reservedBy && g.reservedBy.trim() !== '')).length;
    const availableCount = Math.max(0, totalCount - reservedCount);

    const totalEl = document.getElementById('statTotalGifts');
    const reservedEl = document.getElementById('statReservedGifts');
    const availableEl = document.getElementById('statAvailableGifts') || document.getElementById('statTotalRaised');

    if (totalEl) totalEl.innerText = totalCount;
    if (reservedEl) reservedEl.innerText = reservedCount;
    if (availableEl) availableEl.innerText = availableCount;
  },

  render() {
    const grid = document.getElementById('giftsGrid');
    if (!grid) return;

    let filtered = this.allGifts.filter(gift => {
      if (gift.status === 'trash') return false;

      let giftCats = [];
      if (Array.isArray(gift.categories) && gift.categories.length > 0) {
        giftCats = gift.categories.map(c => String(c).trim().toLowerCase());
      } else if (gift.category) {
        giftCats = String(gift.category).split(',').map(c => String(c).trim().toLowerCase());
      }
      const matchCat = this.currentCategory === 'all' || 
        giftCats.includes(this.currentCategory) ||
        (this.currentCategory === 'casa' && (giftCats.includes('cama_banho') || giftCats.includes('cama') || giftCats.includes('banho'))) ||
        (this.currentCategory === 'cozinha' && (giftCats.includes('eletro') || giftCats.includes('cozinha')));

      const matchSearch = !this.searchQuery || 
        gift.title.toLowerCase().includes(this.searchQuery) ||
        (gift.description && gift.description.toLowerCase().includes(this.searchQuery));

      let matchPrice = true;
      const effectivePrice = gift.price || 0;
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
      const isReservedOrCompleted = gift.status === 'reserved' || gift.status === 'completed' || gift.status === 'pending_approval';
      if (this.currentAvailability === 'available') {
        matchAvail = !isReservedOrCompleted;
      } else if (this.currentAvailability === 'reserved') {
        matchAvail = isReservedOrCompleted;
      }

      return matchCat && matchSearch && matchPrice && matchAvail;
    });

    filtered.sort((a, b) => {
      // 1. Regra Oficial: Itens já presenteados / reservados SEMPRE ficam no fim da lista
      const isReservedA = a.status === 'reserved' || a.status === 'completed' || a.status === 'pending_approval' || (a.reservedBy && a.reservedBy.trim() !== '');
      const isReservedB = b.status === 'reserved' || b.status === 'completed' || b.status === 'pending_approval' || (b.reservedBy && b.reservedBy.trim() !== '');

      if (!isReservedA && isReservedB) return -1;
      if (isReservedA && !isReservedB) return 1;

      // 2. Ordenação interna do grupo (disponíveis ou já presenteados)
      const priceA = a.price || 0;
      const priceB = b.price || 0;

      if (this.currentSort === 'featured') {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return 0;
      } else if (this.currentSort === 'price_asc') {
        return priceA - priceB;
      } else if (this.currentSort === 'price_desc') {
        return priceB - priceA;
      } else if (this.currentSort === 'name_asc') {
        return (a.title || '').localeCompare(b.title || '', 'pt-BR');
      } else if (this.currentSort === 'name_desc') {
        return (b.title || '').localeCompare(a.title || '', 'pt-BR');
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
    const isPending = gift.status === 'pending_approval';

    let statusBadgeHTML = '';
    if (isReserved || isCompleted || isPending) {
      statusBadgeHTML = `<span class="gift-badge badge-reserved">Já Presenteado</span>`;
    }

    const featuredBadgeHTML = gift.isFeatured 
      ? `<span class="badge-featured">
           <svg class="icon-line sm" style="width: 14px; height: 14px;" viewBox="0 0 24 24">
             <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
           </svg>
           Mais Desejado
         </span>`
      : '';

    const pricingHTML = `
      <div class="gift-pricing">
        <span class="price-main">${formatCurrency(gift.price)}</span>
      </div>
    `;

    let actionBtnHTML = '';
    if (isReserved || isCompleted || isPending) {
      actionBtnHTML = `
        <button class="btn btn-secondary btn-block" disabled>
          <svg class="icon-line sm" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>
          Já Presenteado
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
          </div>
        </div>
      </div>
    `;
  },

  async openActionModal(giftId) {
    const gift = await window.weddingDB.getGiftById(giftId);
    if (!gift) return;
    this.openReserveModal(gift);
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

    const urlBox = document.getElementById('reserveGiftUrlBox');
    const urlInput = document.getElementById('reserveGiftUrlInput');
    const submitBtn = document.getElementById('btnSubmitReserve');
    const submitBtnText = document.getElementById('btnSubmitReserveText');

    let cleanUrl = (gift.productUrl || '').trim();
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    if (cleanUrl) {
      if (urlBox) urlBox.style.display = 'flex';
      if (urlInput) urlInput.value = cleanUrl;
      if (submitBtnText) submitBtnText.innerText = 'Enviar';
      if (submitBtn) {
        submitBtn.className = 'btn btn-primary';
        submitBtn.title = 'Enviar escolha, copiar link da loja e abrir o produto';
      }
    } else {
      if (urlBox) urlBox.style.display = 'none';
      if (urlInput) urlInput.value = '';
      if (submitBtnText) submitBtnText.innerText = 'Enviar';
      if (submitBtn) {
        submitBtn.className = 'btn btn-primary';
        submitBtn.title = 'Enviar confirmação de presente';
      }
    }

    modal.classList.add('active');
  },

  openStoreRedirectModal(gift, guestName) {
    const modal = document.getElementById('storeRedirectModal');
    if (!modal) return;

    let cleanUrl = (gift.productUrl || '').trim();
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const titleEl = document.getElementById('storeRedirectModalTitle');
    const descEl = document.getElementById('storeRedirectModalDesc');
    const inputEl = document.getElementById('storeProductUrlInput');
    const openBtn = document.getElementById('btnOpenStoreNewTab');
    const copyBtnText = document.getElementById('btnCopyStoreUrlText');

    if (titleEl) titleEl.innerText = 'Presente Confirmado!';
    if (descEl) {
      descEl.innerHTML = `Muito obrigado, <strong style="color: var(--color-olive-deep);">${escapeHTML(guestName)}</strong>!<br>Sua escolha de presentear <strong>"${escapeHTML(gift.title)}"</strong> para Rhebeca & Matheus foi registrada com sucesso.<br><br>Você pode acessar a loja virtual do produto em uma nova aba ou copiar o link oficial abaixo:`;
    }
    if (inputEl) inputEl.value = cleanUrl;
    if (openBtn) {
      openBtn.href = cleanUrl || '#';
      openBtn.onclick = (e) => {
        if (!cleanUrl || cleanUrl === '#') {
          e.preventDefault();
          showToast('Link da loja não disponível para este item.', 'warning');
        }
      };
    }
    if (copyBtnText) copyBtnText.innerText = 'Copiar Link';

    modal.classList.add('active');

    // Tenta também abrir em nova aba automaticamente em navegadores que permitem
    if (cleanUrl && cleanUrl !== '#') {
      try {
        window.open(cleanUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.log('Abertura direta bloqueada pelo navegador; modal disponível com os botões.', err);
      }
    }
  }
};

/* ==========================================================================
   SUBMISSÃO DE RESERVAS E COTAS PIX
   ========================================================================== */
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
        const gift = await window.weddingDB.getGiftById(giftId);
        let cleanUrl = gift ? (gift.productUrl || '').trim() : '';
        if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = 'https://' + cleanUrl;
        }

        // Se tiver link da loja virtual, copia para a área de transferência imediatamente no clique
        if (cleanUrl) {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(cleanUrl);
            } else {
              const ta = document.createElement('textarea');
              ta.value = cleanUrl;
              ta.style.position = 'fixed';
              ta.style.opacity = '0';
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
            }
          } catch (_) {}
        }

        // 1. Salvar no banco híbrido com status reservado e dados de quem presenteou
        await window.weddingDB.reserveGift(giftId, { guestName, phone, message });

        document.getElementById('reserveModal').classList.remove('active');
        await CatalogController.refresh();
        if (typeof MessagesController !== 'undefined' && MessagesController && typeof MessagesController.refresh === 'function') {
          await MessagesController.refresh();
        }

        // 2. Se o presente tiver link da loja virtual, abrir nova aba e mostrar tela de confirmação
        if (cleanUrl) {
          showToast(`Link copiado e presente confirmado com sucesso, ${guestName}! Redirecionando para a loja...`, 'success');
          CatalogController.openStoreRedirectModal(gift, guestName);
        } else {
          showToast(`Muito obrigado, ${guestName}! Sua escolha de presente para Rhebeca & Matheus foi registrada com sucesso.`, 'success');
        }
      } catch (err) {
        showToast(err.message || 'Erro ao reservar presente.', 'error');
      }
    });

    // Eventos do botão "Copiar Link" da caixa de link do modal de reserva
    const handleCopyReserveProductUrl = async () => {
      const giftId = document.getElementById('reserveGiftId').value;
      const gift = await window.weddingDB.getGiftById(giftId);
      let cleanUrl = gift ? (gift.productUrl || '').trim() : '';
      if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      if (!cleanUrl) {
        showToast('Link da loja não disponível para este item.', 'warning');
        return;
      }

      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(cleanUrl);
          copied = true;
        }
      } catch (_) {}

      if (!copied) {
        try {
          const ta = document.createElement('textarea');
          ta.value = cleanUrl;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          copied = document.execCommand('copy');
          document.body.removeChild(ta);
        } catch (_) {}
      }

      if (copied) {
        showToast('Link da loja copiado com sucesso!', 'success');
        const textEl = document.getElementById('btnCopyReserveGiftUrlText');
        if (textEl) textEl.innerText = 'Link Copiado!';
        setTimeout(() => {
          if (textEl) textEl.innerText = 'Copiar Link';
        }, 2500);
      } else {
        showToast('Não foi possível copiar automaticamente.', 'warning');
      }
    };

    const btnCopyReserveGiftUrl = document.getElementById('btnCopyReserveGiftUrl');
    if (btnCopyReserveGiftUrl) btnCopyReserveGiftUrl.addEventListener('click', handleCopyReserveProductUrl);
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

  const btnCopyStoreUrl = document.getElementById('btnCopyStoreUrl');
  if (btnCopyStoreUrl) {
    btnCopyStoreUrl.addEventListener('click', async () => {
      const inputEl = document.getElementById('storeProductUrlInput');
      const textToCopy = inputEl ? inputEl.value.trim() : '';
      if (!textToCopy) {
        showToast('Nenhum link da loja disponível para copiar.', 'warning');
        return;
      }

      try {
        await navigator.clipboard.writeText(textToCopy);
        showToast('Link da loja copiado com sucesso!', 'success');
        const label = document.getElementById('btnCopyStoreUrlText');
        if (label) {
          label.innerText = 'Copiado!';
          setTimeout(() => { label.innerText = 'Copiar Link'; }, 2500);
        }
      } catch (err) {
        if (inputEl) {
          inputEl.select();
          document.execCommand('copy');
        }
        showToast('Link da loja copiado!', 'success');
        const label = document.getElementById('btnCopyStoreUrlText');
        if (label) {
          label.innerText = 'Copiado!';
          setTimeout(() => { label.innerText = 'Copiar Link'; }, 2500);
        }
      }
    });
  }
});

/* ==========================================================================
   PAINEL ADMINISTRATIVO DOS NOIVOS (v.1.1.0) COM EXTRATOR APRIMORADO
   ========================================================================== */
const AdminController = {
  currentTab: 'gifts',

  async init() {
    const modal = document.getElementById('adminModal');
    if (!modal) return;

    const openBtn = document.getElementById('btnOpenAdmin');
    if (openBtn) {
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

    const imageFileInput = document.getElementById('adminGiftImageFile');
    if (imageFileInput) {
      imageFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            showToast('Processando foto anexada...', 'info');
            const dataUrl = await compressImageFile(file);
            document.getElementById('adminGiftImage').value = dataUrl;
            this.updateImagePreview(dataUrl);
            showToast('Foto anexada e otimizada com sucesso!', 'success');
          } catch (err) {
            showToast(err.message || 'Falha ao processar arquivo de imagem.', 'error');
          }
        }
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

    // Processo de Sincronização Manual com Supabase
    const handleManualSync = async (btnEl, iconEl, labelEl) => {
      if (!btnEl) return;
      btnEl.disabled = true;
      if (iconEl) iconEl.classList.add('icon-spin');
      const originalText = labelEl ? labelEl.innerText : '';
      if (labelEl) labelEl.innerText = 'Sincronizando...';

      showToast('Sincronizando dados com a nuvem Supabase...', 'info');

      try {
        const res = await window.weddingDB.syncWithSupabase();
        if (res && res.success) {
          const count = res.giftsSynced || 0;
          showToast(`Sincronização concluída! (${count} presentes alinhados)`, 'success');
          const timeString = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const syncLastTimeVal = document.getElementById('syncLastTimeVal');
          if (syncLastTimeVal) {
            syncLastTimeVal.innerText = `Sincronizado às ${timeString}`;
          }
          await this.render();
          await CatalogController.refresh();
        } else {
          showToast(res?.message || 'Aviso durante sincronização.', 'warning');
        }
      } catch (err) {
        console.error('[Admin] Erro na sincronização manual:', err);
        if (err.message && (err.message.includes('Data lost due to missing file') || err.message.includes('irrecoverable'))) {
          showToast('Reparando dados corrompidos do navegador e sincronizando com a nuvem...', 'info');
          try {
            await window.weddingDB._resetAndRebuildDatabase();
            await window.weddingDB.syncWithSupabase();
            await this.render();
            await CatalogController.refresh();
            showToast('Banco recuperado com sucesso!', 'success');
          } catch (healErr) {
            showToast('Falha na recuperação: ' + healErr.message, 'error');
          }
        } else {
          showToast('Falha na sincronização: ' + (err.message || 'Verifique sua conexão'), 'error');
        }
      } finally {
        btnEl.disabled = false;
        if (iconEl) iconEl.classList.remove('icon-spin');
        if (labelEl) labelEl.innerText = originalText;
      }
    };

    const btnHeaderSync = document.getElementById('btnAdminSyncHeader');
    if (btnHeaderSync) {
      btnHeaderSync.addEventListener('click', () => {
        const icon = document.getElementById('iconSyncHeader');
        const label = document.getElementById('labelSyncHeader');
        handleManualSync(btnHeaderSync, icon, label);
      });
    }

    const btnTriggerSyncNow = document.getElementById('btnTriggerSyncNow');
    if (btnTriggerSyncNow) {
      btnTriggerSyncNow.addEventListener('click', () => {
        const icon = document.getElementById('iconSyncBtn');
        const label = document.getElementById('labelSyncBtn');
        handleManualSync(btnTriggerSyncNow, icon, label);
      });
    }

    // Ouvinte global da sincronização periódica (15s) ou manual
    window.addEventListener('wedding:sync-completed', (e) => {
      const detail = e.detail || {};
      const syncLastTimeVal = document.getElementById('syncLastTimeVal');
      if (syncLastTimeVal && detail.timeString) {
        syncLastTimeVal.innerText = `Sincronizado às ${detail.timeString}`;
      }
      if (detail.hasChanges) {
        CatalogController.refresh();
      }
    });
  },

  updateImagePreview(url) {
    const previewBox = document.getElementById('adminImagePreviewBox');
    if (!previewBox) return;

    if (url && url.trim()) {
      previewBox.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
          <img src="${escapeHTML(url.trim())}" alt="Prévia do Presente" onerror="this.parentElement.innerHTML='<div style=\\'display: flex; flex-direction: column; align-items: center; gap: 0.35rem; color: var(--color-error); font-size: 0.8rem;\\'><svg class=\\'icon-line sm\\' viewBox=\\'0 0 24 24\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'></circle><line x1=\\'12\\' y1=\\'8\\' x2=\\'12\\' y2=\\'12\\'></line><line x1=\\'12\\' y1=\\'16\\' x2=\\'12.01\\' y2=\\'16\\'></line></svg><span>Falha ao carregar imagem</span></div>';">
          <span style="position: absolute; bottom: 8px; right: 8px; background: rgba(40, 54, 24, 0.78); color: #ffffff; font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; backdrop-filter: blur(2px); font-weight: 500;">Visão Completa</span>
        </div>
      `;
    } else {
      previewBox.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.4rem; color: var(--color-olive-muted);">
          <svg class="icon-line md" viewBox="0 0 24 24" style="color: var(--color-olive-frame); opacity: 0.7;">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span style="font-size: 0.82rem; font-weight: 500;">Prévia Retangular da Imagem</span>
          <span style="font-size: 0.72rem; opacity: 0.75;">Visão completa sem cortes</span>
        </div>
      `;
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
          <span class="table-status-badge ${g.status === 'reserved' ? 'badge-reserved' : (g.status === 'completed' ? 'badge-cota' : 'badge-available')}">
            ${g.status === 'reserved' 
              ? (g.reservedBy && g.reservedBy.trim() ? `Presenteado (${escapeHTML(g.reservedBy.trim())})` : 'Presenteado') 
              : (g.status === 'completed' ? 'Concluído' : 'Disponível')}
          </span>
        </td>
        <td>
          ${g.productUrl ? `<a href="${escapeHTML(g.productUrl)}" target="_blank" title="Abrir loja original" class="btn-table-link"><svg class="icon-line sm" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg> Loja</a>` : '<span style="color: var(--color-olive-muted); font-size: 0.85rem;">-</span>'}
        </td>
        <td>
          <div class="table-actions-wrapper">
            <button class="btn-table-action btn-table-edit btn-admin-edit" data-id="${g.id}" title="Editar presente ou cota">
              <svg class="icon-line sm" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Editar</span>
            </button>
            ${(g.status === 'reserved' || g.status === 'completed' || (g.quotaCurrent && g.quotaCurrent > 0)) ? `
              <button class="btn-table-action btn-table-unreserve btn-admin-unreserve" data-id="${g.id}" title="Retornar item para ficar disponível novamente">
                <svg class="icon-line sm" viewBox="0 0 24 24">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                <span>Retornar</span>
              </button>
            ` : ''}
            <button class="btn-table-action btn-table-delete btn-admin-del" data-id="${g.id}" title="Excluir presente da lista">
              <svg class="icon-line sm" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              <span>Excluir</span>
            </button>
          </div>
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
        await this.confirmUnreserveGift(id);
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
      deleteModal.removeEventListener('click', onBackdropClick);
    };

    const onBackdropClick = (e) => {
      if (e.target === deleteModal && deleteModalActions.style.display !== 'none') {
        closeModal();
      }
    };

    deleteModal.addEventListener('click', onBackdropClick);
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

  async confirmUnreserveGift(id) {
    const unreserveModal = document.getElementById('unreserveModal');
    const unreserveItemTitleText = document.getElementById('unreserveItemTitleText');
    const unreserveProgressBox = document.getElementById('unreserveProgressBox');
    const unreserveProgressBar = document.getElementById('unreserveProgressBar');
    const unreserveProgressStatusText = document.getElementById('unreserveProgressStatusText');
    const unreserveProgressPercent = document.getElementById('unreserveProgressPercent');
    const unreserveModalActions = document.getElementById('unreserveModalActions');
    const btnConfirmUnreserve = document.getElementById('btnConfirmUnreserve');
    const btnCancelUnreserve = document.getElementById('btnCancelUnreserve');

    if (!unreserveModal) return;

    const gift = await window.weddingDB.getGiftById(id);
    const itemTitle = gift ? gift.title : 'este presente';

    unreserveItemTitleText.innerHTML = `Tem certeza que deseja retornar <strong>"${escapeHTML(itemTitle)}"</strong>?<br><span style="font-size:0.83rem; color:var(--color-olive-muted);">O item ficará disponível novamente para todos os convidados na lista pública.</span>`;

    // Resetar estado do modal
    unreserveProgressBox.style.display = 'none';
    unreserveProgressBar.style.width = '0%';
    unreserveProgressPercent.innerText = '0%';
    unreserveProgressStatusText.innerText = 'Retornando item no cache e na nuvem...';
    unreserveModalActions.style.display = 'flex';

    unreserveModal.classList.add('active');

    const closeModal = () => {
      unreserveModal.classList.remove('active');
      unreserveModal.removeEventListener('click', onBackdropClick);
    };

    const onBackdropClick = (e) => {
      if (e.target === unreserveModal && unreserveModalActions.style.display !== 'none') {
        closeModal();
      }
    };

    unreserveModal.addEventListener('click', onBackdropClick);
    btnCancelUnreserve.onclick = closeModal;

    btnConfirmUnreserve.onclick = async () => {
      unreserveModalActions.style.display = 'none';
      unreserveProgressBox.style.display = 'block';

      // Etapa 1: Início do retorno (30%)
      unreserveProgressBar.style.width = '30%';
      unreserveProgressPercent.innerText = '30%';
      unreserveProgressStatusText.innerText = 'Limpando dados de reserva no cache local...';

      await new Promise(r => setTimeout(r, 200));

      // Executar retorno IndexedDB + Supabase
      await window.weddingDB.unreserveGift(id);

      // Etapa 2: Sincronização na nuvem (75%)
      unreserveProgressBar.style.width = '75%';
      unreserveProgressPercent.innerText = '75%';
      unreserveProgressStatusText.innerText = 'Sincronizando atualização com o Supabase...';

      await new Promise(r => setTimeout(r, 250));

      // Etapa 3: Conclusão (100%)
      unreserveProgressBar.style.width = '100%';
      unreserveProgressPercent.innerText = '100%';
      unreserveProgressStatusText.innerText = 'Item retornado com sucesso!';

      await new Promise(r => setTimeout(r, 200));

      closeModal();
      showToast(`"${itemTitle}" foi retornado e está disponível novamente!`, 'success');
      await this.renderGiftsTable();
      await this.renderReservationsTable();
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
          contactStr = contacts.length > 0 ? escapeHTML(contacts.join(', ')) : '';

          const msgs = g.contributions.map(c => c.message).filter(Boolean);
          messageStr = msgs.length > 0 ? `"${escapeHTML(msgs[msgs.length - 1])}"` : '';
        } else if (g.reservedBy) {
          guestListStr = escapeHTML(g.reservedBy);
          contactStr = escapeHTML(g.guestPhone || '');
          messageStr = g.guestMessage ? `"${escapeHTML(g.guestMessage)}"` : '';
        }
      } else {
        guestListStr = `<strong>${escapeHTML(g.reservedBy || 'Convidado')}</strong>`;
        contactStr = escapeHTML(g.guestPhone || '');
        messageStr = g.guestMessage ? `"${escapeHTML(g.guestMessage)}"` : '';
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
            <span class="table-status-badge ${g.isCota ? 'badge-cota' : 'badge-reserved'}">
              ${g.isCota ? 'Cota Lua de Mel' : 'Presente Físico'}
            </span>
          </td>
          <td>${guestListStr}</td>
          <td style="max-width: 220px; font-size: 0.85rem;">
            ${contactStr ? `<div><strong>Contato:</strong> ${contactStr}</div>` : ''}
            ${messageStr ? `<div style="color: var(--color-olive-muted); font-style: italic; margin-top: 0.2rem;">${messageStr}</div>` : ''}
          </td>
          <td>${progressDisplay}</td>
          <td>
            <div class="table-actions-wrapper">
              <button class="btn-table-action btn-table-unreserve btn-admin-unreserve" data-id="${g.id}" title="Retornar este item para ficar disponível novamente na vitrine pública">
                <svg class="icon-line sm" viewBox="0 0 24 24">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                <span>Retornar Item</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-admin-unreserve').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        await this.confirmUnreserveGift(id);
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

    const submitBtn = document.getElementById('adminGiftSubmitBtn');
    if (submitBtn) {
      submitBtn.innerHTML = `
        <svg class="icon-line sm" viewBox="0 0 24 24">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        <span>Salvar Alterações</span>
      `;
    }
    const cancelBtn = document.getElementById('adminGiftCancelBtn');
    if (cancelBtn) {
      cancelBtn.style.display = 'inline-flex';
    }
    document.getElementById('adminGiftFormTitle').innerText = 'Editar Item da Lista';
    document.getElementById('adminGiftForm').scrollIntoView({ behavior: 'smooth' });
  },

  resetGiftForm() {
    const form = document.getElementById('adminGiftForm');
    if (form) form.reset();
    document.getElementById('adminGiftId').value = '';
    const fileInput = document.getElementById('adminGiftImageFile');
    if (fileInput) fileInput.value = '';
    document.getElementById('adminCotaFields').style.display = 'none';
    const submitBtn = document.getElementById('adminGiftSubmitBtn');
    if (submitBtn) {
      submitBtn.innerHTML = `
        <svg class="icon-line sm" viewBox="0 0 24 24">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Adicionar à Lista</span>
      `;
    }
    const cancelBtn = document.getElementById('adminGiftCancelBtn');
    if (cancelBtn) {
      cancelBtn.style.display = 'none';
    }
    document.getElementById('adminGiftFormTitle').innerText = 'Cadastrar Novo Presente ou Cota';
    this.updateImagePreview('');
  },

  async handleSaveGift() {
    const id = document.getElementById('adminGiftId').value || ('gift_' + Date.now());
    const selectedCats = Array.from(document.querySelectorAll('input[name="adminGiftCategory"]:checked')).map(cb => cb.value);
    const category = selectedCats.length > 0 ? selectedCats.join(', ') : (document.getElementById('adminGiftCategory')?.value || 'cozinha');
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

    const whatsappInput = document.getElementById('settingWhatsappPhone');
    if (whatsappInput) whatsappInput.value = settings.whatsappPhone || '5564993409360';
  },

  async handleSaveSettings() {
    const currentSettings = await window.weddingDB.getSettings();
    const whatsappInput = document.getElementById('settingWhatsappPhone');

    const newSettings = {
      ...currentSettings,
      pixKey: document.getElementById('settingPixKey').value.trim(),
      pixName: document.getElementById('settingPixName').value.trim(),
      pixCity: document.getElementById('settingPixCity').value.trim(),
      weddingDate: document.getElementById('settingWeddingDate').value,
      welcomeMessage: document.getElementById('settingWelcomeMsg').value.trim(),
      ceremonyPlace: document.getElementById('settingCeremonyPlace').value.trim(),
      ceremonyCity: document.getElementById('settingCeremonyCity').value.trim(),
      whatsappPhone: whatsappInput ? whatsappInput.value.trim().replace(/\D/g, '') : (currentSettings.whatsappPhone || '5564993409360')
    };

    await window.weddingDB.saveSettings(newSettings);

    const heroSubtitle = document.querySelector('.hero-subtitle');
    if (heroSubtitle && newSettings.welcomeMessage) {
      heroSubtitle.innerText = newSettings.welcomeMessage;
    }

    showToast('Configurações salvas com sucesso!', 'success');
    await CountdownController.init();
  }
};

/* ==========================================================================
   UTILITÁRIOS
   ========================================================================== */
function compressImageFile(file, maxDimension = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Por favor, selecione um arquivo de imagem válido.'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Erro ao processar imagem.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}
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
