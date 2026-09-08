/* ==========================================================================
   Painel Administrativo de Gerenciamento - Rhebeca & Matheus
   Versão: v.1.5.3
   Identidade visual: Branco e Verde Oliva
   Ícones: Linha/Outline SVG Inline Puro
   Página Exclusiva dos Noivos
   ========================================================================== */

function updateAdminStickyOffsets() {
  const topbar = document.getElementById('adminTopbar') || document.querySelector('.admin-topbar');
  let topbarH = 68;
  if (topbar) {
    const h = topbar.getBoundingClientRect().height || topbar.offsetHeight;
    if (h > 0) {
      topbarH = Math.round(h);
      document.documentElement.style.setProperty('--admin-topbar-height', `${topbarH}px`);
    }
  }

  const tabsWrapper = document.querySelector('.admin-tabs-sticky-wrapper');
  let tabsH = 54;
  if (tabsWrapper) {
    const h = tabsWrapper.getBoundingClientRect().height || tabsWrapper.offsetHeight;
    if (h > 0) {
      tabsH = Math.round(h);
      document.documentElement.style.setProperty('--admin-tabs-height', `${tabsH}px`);
    }
  }

  const stickyHeaderOffset = topbarH + tabsH;
  document.documentElement.style.setProperty('--admin-sticky-header-offset', `${stickyHeaderOffset}px`);

  // Detectar se há alguma barra de ações em massa visível na aba atual
  const activeTab = document.querySelector('.admin-tab-content:not([style*="display: none"])');
  let bulkBarH = 0;
  if (activeTab) {
    const bulkBar = activeTab.querySelector('.admin-bulk-actions-bar');
    if (bulkBar && bulkBar.style.display !== 'none' && bulkBar.offsetHeight > 0) {
      // Altura milimétrica exata da barra para encaixe contíguo com o thead
      bulkBarH = Math.round(bulkBar.getBoundingClientRect().height || bulkBar.offsetHeight);
    }
  }
  document.documentElement.style.setProperty('--admin-bulk-bar-height', `${bulkBarH}px`);
  document.documentElement.style.setProperty('--admin-table-header-top', `${stickyHeaderOffset + bulkBarH}px`);
}
window.updateAdminTopbarHeight = updateAdminStickyOffsets;
window.updateAdminStickyOffsets = updateAdminStickyOffsets;
window.addEventListener('resize', updateAdminStickyOffsets);
window.addEventListener('load', updateAdminStickyOffsets);
document.addEventListener('DOMContentLoaded', updateAdminStickyOffsets);

const AUTH_USERS = [
  { 
    email: 'matheus.h.h@hotmail.com', 
    password: 'Mhmm*2738', 
    name: 'Matheus',
    aliases: ['matheus', 'matheus.h.h', 'matheus.h.h@hotmail.com', 'matheus morato', 'noivo', 'admin', 'adm', 'administrador'],
    passwords: ['Mhmm*2738', 'mhmm*2738', 'Mhmm2738', 'mhmm2738', '[Mhmm*2738]', '[mhmm*2738]', '2738']
  },
  { 
    email: 'rhebecamendonca@gmail.com', 
    password: 'Rom@2402', 
    name: 'Rhebeca',
    aliases: ['rhebeca', 'rhebecamendonca', 'rhebecamendonca@gmail.com', 'rhebeca mendonca', 'rebeca', 'noiva', 'admin', 'adm', 'administrador'],
    passwords: ['Rom@2402', 'rom@2402', 'Rom2402', 'rom2402', '[Rom@2402]', '[rom@2402]', '2402']
  }
];

const AUTH_STORAGE_KEY = 'wedding_admin_auth_session';

const AuthController = {
  getCurrentUser() {
    try {
      const data = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (_) {
      return null;
    }
  },

  isAuthenticated() {
    const user = this.getCurrentUser();
    if (!user || !user.email) return false;
    const cleanEmail = (user.email || '').trim().toLowerCase();
    return AUTH_USERS.some(u => 
      u.email.toLowerCase() === cleanEmail || 
      (u.aliases && u.aliases.some(a => a.toLowerCase() === cleanEmail))
    );
  },

  login(identifier, password) {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanPass) {
      throw new Error('Por favor, informe a sua senha de acesso.');
    }

    const matchesPassword = (user, pass) => {
      if (!pass) return false;
      if (user.password === pass) return true;
      if (user.passwords && user.passwords.includes(pass)) return true;
      if (user.password.toLowerCase() === pass.toLowerCase()) return true;
      if (user.passwords && user.passwords.some(p => p.toLowerCase() === pass.toLowerCase())) return true;
      const unbracketed = pass.replace(/^\[|\]$/g, '');
      if (user.password === unbracketed || (user.passwords && user.passwords.includes(unbracketed))) return true;
      if (user.password.toLowerCase() === unbracketed.toLowerCase()) return true;
      return false;
    };

    const matchesUser = (user, id) => {
      if (!id) return true; // Se o usuário não preencheu o campo de login mas acertou a senha, permite acesso
      if (user.email.toLowerCase() === id) return true;
      if (user.aliases && user.aliases.some(a => a.toLowerCase() === id)) return true;
      if (id === 'admin' || id === 'adm' || id === 'administrador') return true;
      return false;
    };

    // 1. Tentar encontrar usuário que combine identificador e senha
    let found = AUTH_USERS.find(u => matchesUser(u, cleanId) && matchesPassword(u, cleanPass));

    // 2. Se o identificador não bater mas a senha for a de Matheus ou Rhebeca, autorizar diretamente
    if (!found) {
      found = AUTH_USERS.find(u => matchesPassword(u, cleanPass));
    }

    if (!found) {
      throw new Error('E-mail, usuário ou senha incorretos. Acesso restrito aos noivos Rhebeca & Matheus.');
    }

    const sessionData = {
      email: found.email,
      name: found.name,
      loggedAt: new Date().toISOString()
    };

    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (_) {}

    return sessionData;
  },

  logout() {
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (_) {}
    window.location.href = 'admin.html?logout=' + Date.now();
  }
};

window.AuthController = AuthController;

function activateDashboard(user) {
  const loginView = document.getElementById('adminLoginView');
  const dashboardView = document.getElementById('adminDashboardView');
  const userGreetingBadge = document.getElementById('adminUserGreetingBadge');

  if (loginView) loginView.style.display = 'none';
  if (dashboardView) dashboardView.style.display = 'block';

  if (userGreetingBadge && user) {
    userGreetingBadge.innerHTML = `
      <svg class="icon-line xs" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      <span>${escapeHTML(user.name)} (${escapeHTML(user.email)})</span>
    `;
  }

  // Ativa a primeira aba imediatamente na tela
  const tabGifts = document.getElementById('adminTabGifts');
  if (tabGifts) tabGifts.style.display = 'block';

  if (window.AdminDashboard && typeof window.AdminDashboard.init === 'function') {
    window.AdminDashboard.init();
  }
}
window.activateDashboard = activateDashboard;

function handleAdminLoginSubmit(event) {
  if (event) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
  }

  const emailInput = document.getElementById('adminEmailInput');
  const passwordInput = document.getElementById('adminPasswordInput');
  const errBox = document.getElementById('loginErrorMsg');

  if (!emailInput || !passwordInput) return false;
  const identifier = emailInput.value;
  const password = passwordInput.value;

  if (errBox) {
    errBox.style.display = 'none';
    errBox.innerText = '';
  }

  try {
    const user = AuthController.login(identifier, password);
    showToast(`Bem-vindo(a), ${user.name}! Acesso liberado.`, 'success');
    activateDashboard(user);
  } catch (err) {
    if (errBox) {
      errBox.innerText = err.message || 'Credenciais inválidas.';
      errBox.style.display = 'block';
    } else {
      alert(err.message || 'Credenciais inválidas.');
    }
  }
  return false;
}
window.handleAdminLoginSubmit = handleAdminLoginSubmit;

function toggleAdminPasswordVisibility() {
  const passwordInput = document.getElementById('adminPasswordInput');
  const toggleBtn = document.getElementById('toggleLoginPassword');
  if (!passwordInput) return;
  const isPass = passwordInput.type === 'password';
  passwordInput.type = isPass ? 'text' : 'password';
  if (toggleBtn) {
    toggleBtn.setAttribute('title', isPass ? 'Ocultar senha' : 'Ver senha');
    toggleBtn.innerHTML = isPass ? `
      <svg class="icon-line sm" viewBox="0 0 24 24">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    ` : `
      <svg class="icon-line sm" viewBox="0 0 24 24">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
  }
}
window.toggleAdminPasswordVisibility = toggleAdminPasswordVisibility;

function handleAdminLogout(event) {
  if (event) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
  }
  const modal = document.getElementById('logoutModal');
  if (modal) {
    modal.classList.add('active');
  } else {
    AuthController.logout();
  }
}
window.handleAdminLogout = handleAdminLogout;

const AdminDashboard = {
  currentTab: 'gifts',
  isInitialized: false,
  selectedGiftIds: new Set(),
  selectedReservationIds: new Set(),
  selectedTrashIds: new Set(),
  sortField: null,
  sortOrder: 'asc',

  async updateGiftsBadge() {
    const badge = document.getElementById('giftsCountBadge');
    if (!badge) return;
    try {
      const gifts = await window.weddingDB.getAllGifts();
      badge.innerText = gifts.length;
    } catch (_) {}
  },

  async updateReservationsBadge() {
    const badge = document.getElementById('reservationsCountBadge');
    if (!badge) return;
    try {
      const gifts = await window.weddingDB.getAllGifts();
      const reservedCount = gifts.filter(g => 
        g.status === 'pending_approval' || 
        g.status === 'reserved' || 
        g.status === 'completed' || 
        (g.reservedBy && g.reservedBy.trim() !== '')
      ).length;
      badge.innerText = reservedCount;
    } catch (_) {}
  },

  switchTab(tabName) {
    if (!tabName) return;
    this.currentTab = tabName;
    document.querySelectorAll('.admin-tab-btn').forEach(b => {
      if (b.getAttribute('data-tab') === tabName) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    this.render();
    setTimeout(updateAdminStickyOffsets, 30);
  },

  updateBulkActionsBar(totalGiftsCount) {
    const bar = document.getElementById('bulkActionsBar');
    const badge = document.getElementById('bulkSelectedCountBadge');
    const label = document.getElementById('btnBulkDeleteLabel');
    const labelGifted = document.getElementById('btnBulkMarkGiftedLabel');
    const labelAvailable = document.getElementById('btnBulkMarkAvailableLabel');
    const selectAllCb = document.getElementById('selectAllGiftsCheckbox');
    const count = this.selectedGiftIds.size;

    if (bar && badge && label) {
      if (count > 0) {
        bar.style.display = 'flex';
        bar.classList.add('active');
        badge.innerText = `${count} ${count === 1 ? 'selecionado' : 'selecionados'}`;
        label.innerText = `Excluir (${count})`;
        if (labelGifted) labelGifted.innerText = `Marcar como Já Presenteado (${count})`;
        if (labelAvailable) labelAvailable.innerText = `Tornar Disponível (${count})`;
      } else {
        bar.style.display = 'none';
        bar.classList.remove('active');
      }
    }

    if (selectAllCb) {
      selectAllCb.checked = totalGiftsCount > 0 && count === totalGiftsCount;
      selectAllCb.indeterminate = count > 0 && count < totalGiftsCount;
    }
    updateAdminStickyOffsets();
    requestAnimationFrame(updateAdminStickyOffsets);
  },

  updateBulkReservationsActionsBar(totalReservationsCount) {
    const bar = document.getElementById('bulkReservationsActionsBar');
    const badge = document.getElementById('bulkReservationsSelectedCountBadge');
    const label = document.getElementById('btnBulkUnreserveLabel');
    const selectAllCb = document.getElementById('selectAllReservationsCheckbox');
    const count = this.selectedReservationIds.size;

    if (bar && badge && label) {
      if (count > 0) {
        bar.style.display = 'flex';
        bar.classList.add('active');
        badge.innerText = `${count} ${count === 1 ? 'selecionado' : 'selecionados'}`;
        label.innerText = `Retornar Selecionados (${count})`;
      } else {
        bar.style.display = 'none';
        bar.classList.remove('active');
      }
    }

    if (selectAllCb) {
      selectAllCb.checked = totalReservationsCount > 0 && count === totalReservationsCount;
      selectAllCb.indeterminate = count > 0 && count < totalReservationsCount;
    }
    updateAdminStickyOffsets();
    requestAnimationFrame(updateAdminStickyOffsets);
  },

  updateBulkTrashActionsBar(totalTrashCount) {
    const bar = document.getElementById('bulkTrashActionsBar');
    const badge = document.getElementById('bulkTrashSelectedCountBadge');
    const restoreLabel = document.getElementById('btnBulkRestoreLabel');
    const permDeleteLabel = document.getElementById('btnBulkPermDeleteLabel');
    const selectAllCb = document.getElementById('selectAllTrashCheckbox');
    const count = this.selectedTrashIds.size;

    if (bar && badge) {
      if (count > 0) {
        bar.style.display = 'flex';
        bar.classList.add('active');
        badge.innerText = `${count} ${count === 1 ? 'selecionado' : 'selecionados'}`;
        if (restoreLabel) restoreLabel.innerText = `Restaurar Selecionados (${count})`;
        if (permDeleteLabel) permDeleteLabel.innerText = `Excluir Definitivo (${count})`;
      } else {
        bar.style.display = 'none';
        bar.classList.remove('active');
      }
    }

    if (selectAllCb) {
      selectAllCb.checked = totalTrashCount > 0 && count === totalTrashCount;
      selectAllCb.indeterminate = count > 0 && count < totalTrashCount;
    }
    updateAdminStickyOffsets();
    requestAnimationFrame(updateAdminStickyOffsets);
  },

  async init() {
    updateAdminTopbarHeight();
    this.updateGiftsBadge().catch(() => {});
    this.updateReservationsBadge().catch(() => {});
    // 0. Renderizar imediatamente para que o usuário veja as abas e layout sem qualquer atraso
    await this.render();
    updateAdminTopbarHeight();

    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Inicializar Banco de Dados Híbrido com callback de tempo real protegido contra falha de rede
    try {
      await window.weddingDB.init((changeType) => {
        console.log('[Admin v.1.4.6] Mudança em tempo real recebida:', changeType);
        if (this.currentTab === 'gifts') {
          this.renderGiftsTable();
        } else if (this.currentTab === 'reservations') {
          this.renderReservationsTable();
        } else if (this.currentTab === 'trash') {
          this.renderTrashTable();
        }
        this.updateTrashBadge().catch(() => {});
        this.updateGiftsBadge().catch(() => {});
        this.updateReservationsBadge().catch(() => {});
      });
    } catch (dbErr) {
      console.error('[Admin v.1.4.6] Erro ao conectar/inicializar banco:', dbErr);
    }

    // Configuração dos botões de classificação da tabela
    const btnSortTitle = document.getElementById('btnSortTitle');
    if (btnSortTitle) {
      btnSortTitle.onclick = () => {
        if (this.sortField === 'title') {
          this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortField = 'title';
          this.sortOrder = 'asc';
        }
        this.renderGiftsTable();
      };
    }

    const btnSortPrice = document.getElementById('btnSortPrice');
    if (btnSortPrice) {
      btnSortPrice.onclick = () => {
        if (this.sortField === 'price') {
          this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortField = 'price';
          this.sortOrder = 'asc';
        }
        this.renderGiftsTable();
      };
    }

    // 2. Abas do Painel
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetBtn = e.currentTarget;
        const tabName = targetBtn.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });

    // 3. Extrator Inteligente por Link
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
          <svg class="icon-line sm icon-spin" viewBox="0 0 24 24">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
          </svg>
          Extraindo dados...
        `;

        try {
          showToast('Analisando produto da loja...', 'info');
          const data = await window.LinkExtractor.extractFromUrl(url);

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

    // 4. Preview de imagem por URL
    const imgInput = document.getElementById('adminGiftImage');
    if (imgInput) {
      imgInput.addEventListener('input', (e) => {
        this.updateImagePreview(e.target.value.trim());
      });
    }

    // 5. Upload/anexo de imagem local com compressão
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

    // 6. Formulário de Presente
    const giftForm = document.getElementById('adminGiftForm');
    if (giftForm) {
      giftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveGift();
      });
    }

    // 7. Formulário de Configurações
    const settingsForm = document.getElementById('adminSettingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveSettings();
      });
    }

    // 8. Botões de Sincronização com Supabase
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
          showToast(`Sincronização concluída com sucesso! (${count} presentes alinhados)`, 'success');
          const timeString = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const syncLastTimeVal = document.getElementById('syncLastTimeVal');
          if (syncLastTimeVal) {
            syncLastTimeVal.innerText = `Sincronizado às ${timeString}`;
          }
          await this.render();
        } else {
          showToast(res?.message || 'Aviso durante sincronização.', 'warning');
        }
      } catch (err) {
        console.error('[Admin] Erro na sincronização:', err);
        const isTableError = err.message && (err.message.includes('supabase_schema.sql') || err.message.includes('tabelas'));
        if (isTableError) {
          showToast('As tabelas do Supabase ainda não foram criadas. Clique no botão "Copiar Script SQL" na aba Configurações & Nuvem para ativar o banco!', 'warning');
        } else if (err.message && (err.message.includes('Data lost due to missing file') || err.message.includes('irrecoverable'))) {
          showToast('Detectado cache local corrompido do navegador. Reparando e restaurando da nuvem...', 'info');
          try {
            await window.weddingDB._resetAndRebuildDatabase();
            await window.weddingDB.syncWithSupabase();
            await this.render();
            showToast('Banco local reparado e dados sincronizados com sucesso!', 'success');
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

    // 8.2 Ouvinte do Evento de Sincronização (Automática a cada 15s ou Manual)
    window.addEventListener('wedding:sync-completed', (e) => {
      const detail = e.detail || {};
      const syncLastTimeVal = document.getElementById('syncLastTimeVal');
      if (syncLastTimeVal && detail.timeString) {
        syncLastTimeVal.innerText = `Sincronizado às ${detail.timeString} (Auto 15s)`;
      }
      if (detail.hasChanges) {
        if (this.currentTab === 'gifts') {
          this.renderGiftsTable();
        } else if (this.currentTab === 'reservations') {
          this.renderReservationsTable();
        }
      }
    });

    // 8.1 Botão de Copiar Script SQL do Supabase
    const btnCopySql = document.getElementById('btnCopySqlScript');
    if (btnCopySql) {
      btnCopySql.addEventListener('click', async () => {
        let sql = '';
        try {
          const res = await fetch('supabase_schema.sql');
          if (res.ok) sql = await res.text();
        } catch (_) {}

        if (!sql) {
          sql = `-- SCRIPT SUPABASE RHEBECA & MATHEUS (Execute no SQL Editor)
CREATE TABLE IF NOT EXISTS public.gifts (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT DEFAULT 'cozinha',
    price NUMERIC DEFAULT 0, is_cota BOOLEAN DEFAULT false, quota_value NUMERIC,
    quota_total INTEGER, quota_current INTEGER DEFAULT 0, amount_raised NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'available', description TEXT DEFAULT '', image_url TEXT DEFAULT '',
    product_url TEXT DEFAULT '', is_featured BOOLEAN DEFAULT false, reserved_by TEXT,
    guest_phone TEXT, guest_message TEXT, reserved_at TIMESTAMPTZ, contributions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.messages (id TEXT PRIMARY KEY, author TEXT NOT NULL, text TEXT NOT NULL, gift_title TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.rsvps (id TEXT PRIMARY KEY, guest_name TEXT NOT NULL, email TEXT, phone TEXT, companions INTEGER DEFAULT 0, status TEXT DEFAULT 'confirmed', dietary TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access on gifts" ON public.gifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on rsvps" ON public.rsvps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.gifts, public.messages, public.rsvps, public.settings TO anon, authenticated, service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gifts, public.messages, public.rsvps;`;
        }

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(sql);
          } else {
            const ta = document.createElement('textarea');
            ta.value = sql;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          showToast('Script SQL copiado com sucesso! Agora clique em "Abrir SQL Editor", cole o código e clique em Run.', 'success');
        } catch (err) {
          showToast('Script disponível no arquivo supabase_schema.sql da pasta do projeto.', 'info');
        }
      });
    }

    // 9. Botão de Logout com Modal Customizado na Tela
    const btnLogout = document.getElementById('btnAdminLogout');
    const logoutModal = document.getElementById('logoutModal');
    const btnConfirmLogout = document.getElementById('btnConfirmLogout');
    const btnCancelLogout = document.getElementById('btnCancelLogout');

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (logoutModal) {
          logoutModal.classList.add('active');
        } else {
          AuthController.logout();
        }
      });
    }

    if (logoutModal) {
      const closeLogoutModal = () => logoutModal.classList.remove('active');
      if (btnCancelLogout) btnCancelLogout.addEventListener('click', closeLogoutModal);
      logoutModal.addEventListener('click', (e) => {
        if (e.target === logoutModal) closeLogoutModal();
      });
      if (btnConfirmLogout) {
        btnConfirmLogout.addEventListener('click', () => {
          closeLogoutModal();
          AuthController.logout();
        });
      }
    }

    // 10. Modal de Gestão Manual de Quem Presenteou
    const btnOpenManualDonor = document.getElementById('btnOpenManualDonorModal');
    if (btnOpenManualDonor) {
      btnOpenManualDonor.addEventListener('click', () => {
        this.openManualDonorModal();
      });
    }

    const donorModal = document.getElementById('manualDonorModal');
    const closeDonorModal = () => {
      if (donorModal) donorModal.classList.remove('active');
    };

    const btnCloseDonor = document.getElementById('btnCloseManualDonorModal');
    if (btnCloseDonor) btnCloseDonor.addEventListener('click', closeDonorModal);

    const btnCancelDonor = document.getElementById('btnCancelManualDonor');
    if (btnCancelDonor) btnCancelDonor.addEventListener('click', closeDonorModal);

    if (donorModal) {
      donorModal.addEventListener('click', (e) => {
        if (e.target === donorModal) closeDonorModal();
      });
    }

    const donorForm = document.getElementById('manualDonorForm');
    if (donorForm) {
      donorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveManualDonor();
      });
    }

    // 11. Modal de Marcar como Já Presenteado em Lote (Checkbox Selection)
    const bulkGiftedModal = document.getElementById('bulkGiftedModal');
    const closeBulkGiftedModal = () => {
      if (bulkGiftedModal) bulkGiftedModal.classList.remove('active');
    };

    const btnCloseBulkGifted = document.getElementById('btnCloseBulkGiftedModal');
    if (btnCloseBulkGifted) btnCloseBulkGifted.addEventListener('click', closeBulkGiftedModal);

    const btnCancelBulkGifted = document.getElementById('btnCancelBulkGifted');
    if (btnCancelBulkGifted) btnCancelBulkGifted.addEventListener('click', closeBulkGiftedModal);

    if (bulkGiftedModal) {
      bulkGiftedModal.addEventListener('click', (e) => {
        if (e.target === bulkGiftedModal) closeBulkGiftedModal();
      });
    }

    const bulkGiftedForm = document.getElementById('bulkGiftedForm');
    if (bulkGiftedForm) {
      bulkGiftedForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveBulkGifted();
      });
    }

    await this.render();
  },

  updateImagePreview(url) {
    const previewBox = document.getElementById('adminImagePreviewBox');
    if (!previewBox) return;

    if (url && url.trim()) {
      previewBox.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
          <img src="${escapeHTML(url.trim())}" alt="Prévia do Presente" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';">
          <div style="display: none; flex-direction: column; align-items: center; gap: 0.35rem; color: var(--color-error); font-size: 0.8rem;">
            <svg class="icon-line sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>Falha ao carregar imagem</span>
          </div>
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

  renderItemThumbnail(imageUrl, title, size = 48) {
    const lineIconSvg = '<svg class="icon-line sm" viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>';
    const safeTitle = escapeHTML(title || '');

    if (!imageUrl || !imageUrl.trim()) {
      return `<div style="width: ${size}px; height: ${size}px; background: var(--color-cream); border-radius: var(--radius-sm); border: 1px solid var(--color-olive-border); display: flex; align-items: center; justify-content: center; color: var(--color-olive-muted); flex-shrink: 0;">${lineIconSvg}</div>`;
    }

    const safeUrl = escapeHTML(imageUrl.trim());
    return `
      <div style="width: ${size}px; height: ${size}px; position: relative; flex-shrink: 0; display: inline-block;">
        <img src="${safeUrl}" alt="${safeTitle}" style="width: ${size}px; height: ${size}px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--color-olive-border); display: block;" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';">
        <div style="display: none; width: ${size}px; height: ${size}px; background: var(--color-cream); border-radius: var(--radius-sm); border: 1px solid var(--color-olive-border); align-items: center; justify-content: center; color: var(--color-olive-muted);">${lineIconSvg}</div>
      </div>
    `;
  },

  async render() {
    // 1. Alterna aba ativa na interface imediatamente
    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
    const tabMap = {
      gifts: 'adminTabGifts',
      reservations: 'adminTabReservations',
      settings: 'adminTabSettings',
      trash: 'adminTabTrash'
    };
    const targetId = tabMap[this.currentTab] || 'adminTabGifts';
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.style.display = 'block';

    // 2. Atualiza badges em segundo plano (sem bloquear exibição)
    this.updateTrashBadge().catch(() => {});
    this.updateGiftsBadge().catch(() => {});
    this.updateReservationsBadge().catch(() => {});

    // 3. Renderiza conteúdo da aba selecionada
    try {
      if (this.currentTab === 'gifts') {
        await this.renderGiftsTable();
      } else if (this.currentTab === 'reservations') {
        await this.renderReservationsTable();
      } else if (this.currentTab === 'settings') {
        await this.renderSettingsForm();
      } else if (this.currentTab === 'trash') {
        await this.renderTrashTable();
      }
    } catch (err) {
      console.warn('[Admin] Erro na renderização da aba:', err);
    }
  },

  async renderGiftsTable() {
    const tbody = document.getElementById('adminGiftsTableBody');
    if (!tbody) return;

    let gifts = await window.weddingDB.getAllGifts();

    // Atualiza contadores nas abas
    this.updateGiftsBadge();
    this.updateReservationsBadge();

    // Ordenação dinâmica por Título ou Valor
    if (this.sortField === 'title') {
      gifts.sort((a, b) => {
        const tA = (a.title || '').toLowerCase();
        const tB = (b.title || '').toLowerCase();
        return this.sortOrder === 'asc' ? tA.localeCompare(tB, 'pt-BR') : tB.localeCompare(tA, 'pt-BR');
      });
    } else if (this.sortField === 'price') {
      gifts.sort((a, b) => {
        const vA = a.price || 0;
        const vB = b.price || 0;
        return this.sortOrder === 'asc' ? vA - vB : vB - vA;
      });
    }

    // Atualiza estado visual dos botões de classificação no cabeçalho
    const sortTitleBtn = document.getElementById('btnSortTitle');
    const sortPriceBtn = document.getElementById('btnSortPrice');
    if (sortTitleBtn) {
      sortTitleBtn.classList.toggle('active', this.sortField === 'title');
      const icon = sortTitleBtn.querySelector('.sort-icon');
      if (icon) {
        icon.innerHTML = this.sortField === 'title'
          ? (this.sortOrder === 'asc' ? '<polyline points="18 15 12 9 6 15"></polyline>' : '<polyline points="6 9 12 15 18 9"></polyline>')
          : '<path d="M7 15l5 5 5-5M7 9l5-5 5 5"></path>';
      }
    }
    if (sortPriceBtn) {
      sortPriceBtn.classList.toggle('active', this.sortField === 'price');
      const icon = sortPriceBtn.querySelector('.sort-icon');
      if (icon) {
        icon.innerHTML = this.sortField === 'price'
          ? (this.sortOrder === 'asc' ? '<polyline points="18 15 12 9 6 15"></polyline>' : '<polyline points="6 9 12 15 18 9"></polyline>')
          : '<path d="M7 15l5 5 5-5M7 9l5-5 5 5"></path>';
      }
    }

    if (gifts.length === 0) {
      this.selectedGiftIds.clear();
      this.updateBulkActionsBar(0);
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--color-olive-muted);">Nenhum item cadastrado ainda. Use o extrator por link acima para começar!</td></tr>`;
      return;
    }

    // Filtrar IDs selecionados para manter apenas os que ainda existem
    const existingIds = new Set(gifts.map(g => g.id));
    for (const sId of this.selectedGiftIds) {
      if (!existingIds.has(sId)) {
        this.selectedGiftIds.delete(sId);
      }
    }

    tbody.innerHTML = gifts.map(g => {
      const isChecked = this.selectedGiftIds.has(g.id);
      return `
      <tr class="${isChecked ? 'selected-row' : ''}" data-gift-id="${g.id}">
        <td class="col-checkbox" style="text-align: center; padding-left: 0.75rem; padding-right: 0.5rem; vertical-align: middle;">
          <input type="checkbox" class="gift-select-checkbox" data-id="${g.id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--color-olive-primary); cursor: pointer; vertical-align: middle;">
        </td>
        <td style="vertical-align: middle; width: 70px;">
          ${this.renderItemThumbnail(g.imageUrl, g.title)}
        </td>
        <td class="col-title" style="vertical-align: middle;">
          <div class="admin-item-title-wrapper">
            <button class="btn-icon btn-admin-star" data-id="${g.id}" title="${g.isFeatured ? 'Remover dos Mais Desejados' : 'Marcar como Mais Desejado'}" style="width: 28px; height: 28px; border: none; background: none; color: ${g.isFeatured ? 'var(--color-gold-accent)' : 'var(--color-olive-muted)'}; cursor: pointer; flex-shrink: 0;">
              <svg class="icon-line sm" viewBox="0 0 24 24" style="${g.isFeatured ? 'fill: var(--color-gold-accent);' : ''}">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </button>
            <span class="admin-item-title-text" title="${escapeHTML(g.title)}">${escapeHTML(g.title)}</span>
          </div>
        </td>
        <td>
          <div class="category-tags-list">
            ${(() => {
              let cats = [];
              if (Array.isArray(g.categories) && g.categories.length > 0) {
                cats = g.categories;
              } else if (g.category) {
                cats = String(g.category).split(',').map(s => s.trim());
              }
              if (cats.length === 0) return '<span style="color:var(--color-olive-muted); font-size:0.82rem;">-</span>';
              const mapL = {
                'cozinha': 'Cozinha',
                'eletro': 'Eletro',
                'mesa': 'Mesa Posta',
                'casa': 'Cama & Banho',
                'sala': 'Sala',
                'decoracao': 'Decoração',
                'churrasco': 'Gourmet',
                'lavanderia': 'Lavanderia',
                'bar_cafe': 'Bar & Café',
                'viagem': 'Lua de Mel'
              };
              return cats.map(c => `<span class="category-tag-badge">${escapeHTML(mapL[c.toLowerCase()] || c)}</span>`).join('');
            })()}
          </div>
        </td>
        <td>${formatCurrency(g.price)}</td>
        <td>
          ${g.status === 'pending_approval' ? `
            <span class="badge" style="background:#fff3cd; color:#856404; border:1px solid #ffeeba; padding:0.25rem 0.6rem; border-radius:var(--radius-full); font-size:0.75rem; font-weight:600; display:inline-flex; align-items:center; gap:0.3rem;">
              <span class="pulse-dot" style="background:#ffc107; width:6px; height:6px;"></span>
              Pendente
            </span>
          ` : `
            <span class="table-status-badge ${g.status === 'reserved' || g.status === 'completed' ? 'badge-reserved' : 'badge-available'}" ${g.reservedBy && g.reservedBy.trim() ? `title="Presenteado por: ${escapeHTML(g.reservedBy.trim())}"` : ''}>
              ${g.status === 'reserved' || g.status === 'completed' 
                ? 'Presenteado' 
                : 'Disponível'}
            </span>
          `}
        </td>
        <td>
          ${g.productUrl ? `<a href="${escapeHTML(g.productUrl)}" target="_blank" title="Abrir loja original" class="btn-table-link"><svg class="icon-line sm" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg> Loja</a>` : '<span style="color: var(--color-olive-muted); font-size: 0.85rem;">-</span>'}
        </td>
        <td>
          <div class="table-actions-wrapper">
            ${g.status === 'pending_approval' ? `
              <button class="btn-table-action btn-table-approve btn-admin-approve" data-id="${g.id}" title="Aprovar escolha deste presente">
                <svg class="icon-line sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Aprovar</span>
              </button>
            ` : ''}
            <button class="btn-table-action btn-table-edit btn-admin-edit" data-id="${g.id}" title="Editar presente">
              <svg class="icon-line sm" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Editar</span>
            </button>
            <button class="btn-table-action btn-table-del btn-admin-del" data-id="${g.id}" title="Excluir item permanentemente">
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
      `;
    }).join('');

    // Atualiza status da barra de ações em massa e do checkbox mestre
    this.updateBulkActionsBar(gifts.length);

    // Eventos dos checkboxes individuais
    tbody.querySelectorAll('.gift-select-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-id');
        const tr = cb.closest('tr');
        if (cb.checked) {
          this.selectedGiftIds.add(id);
          if (tr) tr.classList.add('selected-row');
        } else {
          this.selectedGiftIds.delete(id);
          if (tr) tr.classList.remove('selected-row');
        }
        this.updateBulkActionsBar(gifts.length);
      });
    });

    // Evento do checkbox mestre (Selecionar Todos)
    const selectAllCb = document.getElementById('selectAllGiftsCheckbox');
    if (selectAllCb) {
      selectAllCb.onchange = () => {
        const checkAll = selectAllCb.checked;
        tbody.querySelectorAll('.gift-select-checkbox').forEach(cb => {
          cb.checked = checkAll;
          const id = cb.getAttribute('data-id');
          const tr = cb.closest('tr');
          if (checkAll) {
            this.selectedGiftIds.add(id);
            if (tr) tr.classList.add('selected-row');
          } else {
            this.selectedGiftIds.delete(id);
            if (tr) tr.classList.remove('selected-row');
          }
        });
        this.updateBulkActionsBar(gifts.length);
      };
    }

    // Evento do botão "Desmarcar Todos"
    const btnDeselectAll = document.getElementById('btnDeselectAllGifts');
    if (btnDeselectAll) {
      btnDeselectAll.onclick = () => {
        this.selectedGiftIds.clear();
        tbody.querySelectorAll('.gift-select-checkbox').forEach(cb => {
          cb.checked = false;
          const tr = cb.closest('tr');
          if (tr) tr.classList.remove('selected-row');
        });
        this.updateBulkActionsBar(gifts.length);
      };
    }

    // Evento do botão "Marcar como Já Presenteado" (em lote na seleção de checkbox)
    const btnBulkMarkGifted = document.getElementById('btnBulkMarkGifted');
    if (btnBulkMarkGifted) {
      btnBulkMarkGifted.onclick = () => {
        if (this.selectedGiftIds.size === 0) {
          showToast('Nenhum item selecionado.', 'warning');
          return;
        }
        this.openBulkGiftedModal(Array.from(this.selectedGiftIds));
      };
    }

    // Evento do botão "Tornar Disponível" (em lote na seleção de checkbox)
    const btnBulkMarkAvailable = document.getElementById('btnBulkMarkAvailable');
    if (btnBulkMarkAvailable) {
      btnBulkMarkAvailable.onclick = async () => {
        if (this.selectedGiftIds.size === 0) {
          showToast('Nenhum item selecionado.', 'warning');
          return;
        }
        await this.confirmBulkMarkAvailable(Array.from(this.selectedGiftIds));
      };
    }

    // Evento do botão "Excluir Selecionados"
    const btnBulkDelete = document.getElementById('btnBulkDeleteGifts');
    if (btnBulkDelete) {
      btnBulkDelete.onclick = async () => {
        if (this.selectedGiftIds.size === 0) {
          showToast('Nenhum item selecionado.', 'warning');
          return;
        }
        await this.confirmBulkDeleteGifts(Array.from(this.selectedGiftIds));
      };
    }

    tbody.querySelectorAll('.btn-admin-star').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.toggleFeatured(id);
      });
    });

    tbody.querySelectorAll('.btn-admin-approve').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.approveGiftReservation(id);
      });
    });

    tbody.querySelectorAll('.btn-admin-manage-donor').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.openManualDonorModal(id);
      });
    });

    tbody.querySelectorAll('.btn-admin-edit').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.editGift(id);
      });
    });

    tbody.querySelectorAll('.btn-admin-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.confirmDeleteGift(id);
      });
    });

    tbody.querySelectorAll('.btn-admin-unreserve').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.confirmUnreserveGift(id);
      });
    });
  },

  async confirmDeleteGift(id) {
    const gift = await window.weddingDB.getGiftById(id);
    const itemTitle = gift ? gift.title : 'este item';

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

    deleteItemTitleText.innerHTML = `Deseja mover o item <strong style="color: var(--color-olive-deep);">"${escapeHTML(itemTitle)}"</strong> para a Lixeira?<br><span style="font-size: 0.83rem; color: var(--color-olive-muted);">O item sairá da vitrine pública de presentes e poderá ser restaurado na aba Lixeira a qualquer momento.</span>`;

    btnConfirmDelete.innerText = 'Mover para Lixeira';
    btnConfirmDelete.style.background = 'var(--color-error)';
    btnConfirmDelete.style.borderColor = 'var(--color-error)';

    deleteProgressBox.style.display = 'none';
    deleteProgressBar.style.width = '0%';
    deleteProgressPercent.innerText = '0%';
    deleteProgressStatusText.innerText = 'Iniciando remoção...';
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
      deleteModalActions.style.display = 'none';
      deleteProgressBox.style.display = 'block';

      deleteProgressBar.style.width = '35%';
      deleteProgressPercent.innerText = '35%';
      deleteProgressStatusText.innerText = 'Movendo para a Lixeira localmente...';

      await new Promise(r => setTimeout(r, 150));
      await window.weddingDB.trashGift(id);

      deleteProgressBar.style.width = '80%';
      deleteProgressPercent.innerText = '80%';
      deleteProgressStatusText.innerText = 'Sincronizando com o Supabase...';

      await new Promise(r => setTimeout(r, 200));

      deleteProgressBar.style.width = '100%';
      deleteProgressPercent.innerText = '100%';
      deleteProgressStatusText.innerText = 'Item movido para a Lixeira com sucesso!';

      await new Promise(r => setTimeout(r, 150));

      closeModal();
      this.selectedGiftIds.delete(id);
      showToast(`Item "${itemTitle}" movido para a Lixeira!`, 'success');
      await this.render();
    };
  },

  async confirmBulkDeleteGifts(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;

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

    const total = ids.length;
    deleteItemTitleText.innerHTML = `Deseja mover os <strong style="color: var(--color-olive-deep);">${total} presentes selecionados</strong> para a Lixeira?<br><span style="font-size: 0.83rem; color: var(--color-olive-muted);">Os itens sairão da vitrine de presentes e poderão ser restaurados na aba Lixeira a qualquer momento.</span>`;

    btnConfirmDelete.innerText = 'Mover para Lixeira';
    btnConfirmDelete.style.background = 'var(--color-error)';
    btnConfirmDelete.style.borderColor = 'var(--color-error)';

    deleteProgressBox.style.display = 'none';
    deleteProgressBar.style.width = '0%';
    deleteProgressPercent.innerText = '0%';
    deleteProgressStatusText.innerText = 'Iniciando remoção...';
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
      deleteModalActions.style.display = 'none';
      deleteProgressBox.style.display = 'block';

      deleteProgressBar.style.width = '35%';
      deleteProgressPercent.innerText = '35%';
      deleteProgressStatusText.innerText = `Movendo ${total} itens para a Lixeira...`;

      await new Promise(r => setTimeout(r, 150));
      await window.weddingDB.trashMultipleGifts(ids);

      deleteProgressBar.style.width = '80%';
      deleteProgressPercent.innerText = '80%';
      deleteProgressStatusText.innerText = 'Sincronizando com o Supabase...';

      await new Promise(r => setTimeout(r, 200));

      deleteProgressBar.style.width = '100%';
      deleteProgressPercent.innerText = '100%';
      deleteProgressStatusText.innerText = `${total} itens movidos para a Lixeira!`;

      await new Promise(r => setTimeout(r, 150));

      closeModal();
      this.selectedGiftIds.clear();
      showToast(`${total} ${total === 1 ? 'item movido' : 'itens movidos'} para a Lixeira!`, 'success');
      await this.render();
    };
  },

  openBulkGiftedModal(giftIds) {
    this.targetBulkGiftIds = giftIds;
    const modal = document.getElementById('bulkGiftedModal');
    const subtitle = document.getElementById('bulkGiftedSubtitle');
    const nameInput = document.getElementById('bulkGiftedDonorName');
    const phoneInput = document.getElementById('bulkGiftedDonorPhone');
    const msgInput = document.getElementById('bulkGiftedDonorMessage');

    if (subtitle) {
      subtitle.innerText = `Atualizar ${giftIds.length} ${giftIds.length === 1 ? 'presente selecionado' : 'presentes selecionados'} para "Já Presenteado"`;
    }
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (msgInput) msgInput.value = '';

    if (modal) modal.classList.add('active');
  },

  closeBulkGiftedModal() {
    const modal = document.getElementById('bulkGiftedModal');
    if (modal) modal.classList.remove('active');
    this.targetBulkGiftIds = [];
  },

  async handleSaveBulkGifted() {
    if (!this.targetBulkGiftIds || this.targetBulkGiftIds.length === 0) return;

    const nameInput = document.getElementById('bulkGiftedDonorName');
    const phoneInput = document.getElementById('bulkGiftedDonorPhone');
    const msgInput = document.getElementById('bulkGiftedDonorMessage');

    const donorName = nameInput ? nameInput.value.trim() : '';
    const donorPhone = phoneInput ? phoneInput.value.trim() : '';
    const donorMsg = msgInput ? msgInput.value.trim() : '';
    const nowIso = new Date().toISOString();

    const idsToUpdate = [...this.targetBulkGiftIds];
    let updatedCount = 0;

    for (const id of idsToUpdate) {
      const gift = await window.weddingDB.getGiftById(id);
      if (gift) {
        gift.status = 'reserved';
        gift.reservedBy = donorName || null;
        gift.guestPhone = donorPhone || null;
        gift.guestMessage = donorMsg || null;
        gift.reservedAt = nowIso;
        await window.weddingDB.saveGift(gift);
        updatedCount++;
      }
    }

    this.closeBulkGiftedModal();
    this.selectedGiftIds.clear();
    showToast(`${updatedCount} ${updatedCount === 1 ? 'presente marcado' : 'presentes marcados'} como Já Presenteado com sucesso!`, 'success');
    await this.render();
    window.weddingDB.syncWithSupabase({ silent: true }).catch(() => {});
  },

  async confirmBulkMarkAvailable(giftIds) {
    if (!confirm(`Deseja alterar e marcar como Disponível(is) o(s) ${giftIds.length} presente(s) selecionado(s) na vitrine pública?`)) {
      return;
    }

    let updatedCount = 0;
    for (const id of giftIds) {
      const gift = await window.weddingDB.getGiftById(id);
      if (gift) {
        gift.status = 'available';
        gift.reservedBy = null;
        gift.guestPhone = null;
        gift.guestMessage = null;
        gift.reservedAt = null;
        await window.weddingDB.saveGift(gift);
        updatedCount++;
      }
    }

    this.selectedGiftIds.clear();
    showToast(`${updatedCount} ${updatedCount === 1 ? 'presente alterado' : 'presentes alterados'} para Disponível!`, 'success');
    await this.render();
    window.weddingDB.syncWithSupabase({ silent: true }).catch(() => {});
  },

  async updateTrashBadge() {
    try {
      const trashItems = await window.weddingDB.getTrashGifts();
      const count = trashItems.length;
      const badge = document.getElementById('trashCountBadge');
      const totalBadge = document.getElementById('trashTotalCountBadge');
      if (badge) {
        badge.innerText = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
      }
      if (totalBadge) {
        totalBadge.innerText = `${count} ${count === 1 ? 'item' : 'itens'}`;
      }
    } catch (_) {}
  },

  async renderTrashTable() {
    const tbody = document.getElementById('adminTrashTableBody');
    if (!tbody) return;

    const trashItems = await window.weddingDB.getTrashGifts();
    const btnEmptyTrash = document.getElementById('btnEmptyTrash');
    const btnSyncTrash = document.getElementById('btnSyncTrashNow');

    if (btnSyncTrash) {
      btnSyncTrash.onclick = async () => {
        btnSyncTrash.disabled = true;
        const icon = document.getElementById('iconSyncTrash');
        const label = document.getElementById('labelSyncTrash');
        if (icon) icon.classList.add('icon-spin');
        if (label) label.innerText = 'Sincronizando...';
        showToast('Sincronizando lixeira com o Supabase...', 'info');
        try {
          await window.weddingDB.syncWithSupabase();
          await this.renderTrashTable();
          await this.updateTrashBadge();
          showToast('Lixeira sincronizada com o Supabase!', 'success');
        } catch (err) {
          showToast('Erro ao sincronizar lixeira: ' + (err.message || 'Falha de rede'), 'error');
        } finally {
          btnSyncTrash.disabled = false;
          if (icon) icon.classList.remove('icon-spin');
          if (label) label.innerText = 'Sincronizar Lixeira';
        }
      };
    }

    if (btnEmptyTrash) {
      btnEmptyTrash.disabled = trashItems.length === 0;
      btnEmptyTrash.style.opacity = trashItems.length === 0 ? '0.5' : '1';
      btnEmptyTrash.style.cursor = trashItems.length === 0 ? 'not-allowed' : 'pointer';
      btnEmptyTrash.onclick = () => {
        if (trashItems.length === 0) return;
        this.confirmEmptyTrash(trashItems.length);
      };
    }

    if (trashItems.length === 0) {
      this.selectedTrashIds.clear();
      this.updateBulkTrashActionsBar(0);
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3.5rem 1rem; color: var(--color-olive-muted);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
              <svg class="icon-line lg" style="color: var(--color-olive-frame); opacity: 0.5;" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <h4 style="font-size: 1.1rem; color: var(--color-olive-deep); margin: 0;">A lixeira está vazia</h4>
              <p style="font-size: 0.85rem; margin: 0; max-width: 400px; line-height: 1.4;">
                Nenhum presente foi excluído recentemente. Quando você excluir itens do catálogo, eles aparecerão aqui com os dados integrados do Supabase para serem restaurados ou apagados definitivamente.
              </p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Filtrar IDs selecionados para manter apenas os que ainda estão na lixeira
    const existingIds = new Set(trashItems.map(g => g.id));
    for (const sId of this.selectedTrashIds) {
      if (!existingIds.has(sId)) {
        this.selectedTrashIds.delete(sId);
      }
    }

    tbody.innerHTML = trashItems.map(g => {
      const isChecked = this.selectedTrashIds.has(g.id);
      const priceText = formatCurrency(g.price);
      const deletedDateText = g.deletedAt 
        ? new Date(g.deletedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : (g.updatedAt ? new Date(g.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');

      const donorBadge = g.reservedBy 
        ? `<span style="display:block; font-size:0.75rem; color:var(--color-gold-accent); margin-top:0.2rem; font-weight:500;">Presenteado por: <strong>${escapeHTML(g.reservedBy)}</strong></span>`
        : '';

      return `
        <tr class="${isChecked ? 'selected-row' : ''}" data-trash-id="${g.id}">
          <td class="col-checkbox" style="text-align: center; padding-left: 0.75rem; padding-right: 0.5rem; vertical-align: middle;">
            <input type="checkbox" class="trash-select-checkbox" data-id="${g.id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--color-olive-primary); cursor: pointer; vertical-align: middle;">
          </td>
          <td style="vertical-align: middle; width: 70px;">
            ${this.renderItemThumbnail(g.imageUrl, g.title)}
          </td>
          <td class="col-title" style="vertical-align: middle;">
            <div class="admin-item-title-wrapper">
              <div style="min-width: 0; flex: 1;">
                <span class="admin-item-title-text" title="${escapeHTML(g.title)}">${escapeHTML(g.title)}</span>
                ${donorBadge}
              </div>
            </div>
          </td>
          <td style="vertical-align: middle; text-transform: capitalize;">${escapeHTML(g.category)}</td>
          <td style="vertical-align: middle; font-weight: 600; color: var(--color-olive-primary);">${priceText}</td>
          <td style="vertical-align: middle;">
            <span class="badge" style="background: rgba(96, 108, 56, 0.12); color: var(--color-olive-deep); border: 1px solid rgba(96, 108, 56, 0.28); font-size: 0.74rem; padding: 0.2rem 0.55rem; border-radius: 999px; display: inline-flex; align-items: center; gap: 0.3rem;">
              <svg class="icon-line xs" viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
              <span>Supabase Integrado</span>
            </span>
            <span style="display: block; font-size: 0.7rem; color: var(--color-olive-muted); margin-top: 0.2rem; font-family: monospace;">ID: ${escapeHTML(g.id)}</span>
          </td>
          <td style="vertical-align: middle; font-size: 0.85rem; color: var(--color-olive-muted);">${deletedDateText}</td>
          <td style="vertical-align: middle; text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-sm btn-outline btn-restore-gift" data-id="${g.id}" title="Restaurar de volta à lista ativa" style="display: inline-flex; align-items: center; gap: 0.35rem; color: var(--color-olive-primary); border-color: var(--color-olive-primary); font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: var(--radius-sm);">
                <svg class="icon-line xs" viewBox="0 0 24 24">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                <span>Restaurar</span>
              </button>
              <button class="btn btn-sm btn-perm-delete-gift" data-id="${g.id}" title="Excluir permanentemente" style="display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(188, 71, 73, 0.1); color: var(--color-error); border: 1px solid rgba(188, 71, 73, 0.3); font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: var(--radius-sm);">
                <svg class="icon-line xs" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                <span>Excluir Definitivo</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Atualiza barra de ações em massa da lixeira
    this.updateBulkTrashActionsBar(trashItems.length);

    // Eventos dos checkboxes individuais da lixeira
    tbody.querySelectorAll('.trash-select-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-id');
        const tr = cb.closest('tr');
        if (cb.checked) {
          this.selectedTrashIds.add(id);
          if (tr) tr.classList.add('selected-row');
        } else {
          this.selectedTrashIds.delete(id);
          if (tr) tr.classList.remove('selected-row');
        }
        this.updateBulkTrashActionsBar(trashItems.length);
      });
    });

    // Evento do checkbox mestre (Selecionar Todos da lixeira)
    const selectAllTrashCb = document.getElementById('selectAllTrashCheckbox');
    if (selectAllTrashCb) {
      selectAllTrashCb.onchange = () => {
        const checkAll = selectAllTrashCb.checked;
        tbody.querySelectorAll('.trash-select-checkbox').forEach(cb => {
          cb.checked = checkAll;
          const id = cb.getAttribute('data-id');
          const tr = cb.closest('tr');
          if (checkAll) {
            this.selectedTrashIds.add(id);
            if (tr) tr.classList.add('selected-row');
          } else {
            this.selectedTrashIds.delete(id);
            if (tr) tr.classList.remove('selected-row');
          }
        });
        this.updateBulkTrashActionsBar(trashItems.length);
      };
    }

    // Botão Desmarcar Todos da lixeira
    const btnDeselectAllTrash = document.getElementById('btnDeselectAllTrash');
    if (btnDeselectAllTrash) {
      btnDeselectAllTrash.onclick = () => {
        this.selectedTrashIds.clear();
        tbody.querySelectorAll('.trash-select-checkbox').forEach(cb => {
          cb.checked = false;
          const tr = cb.closest('tr');
          if (tr) tr.classList.remove('selected-row');
        });
        this.updateBulkTrashActionsBar(trashItems.length);
      };
    }

    // Botão Restaurar Selecionados da lixeira
    const btnBulkRestoreTrash = document.getElementById('btnBulkRestoreTrash');
    if (btnBulkRestoreTrash) {
      btnBulkRestoreTrash.onclick = async () => {
        if (this.selectedTrashIds.size === 0) {
          showToast('Nenhum item selecionado para restaurar.', 'warning');
          return;
        }
        await this.confirmBulkRestoreTrash(Array.from(this.selectedTrashIds));
      };
    }

    // Botão Excluir Definitivo Selecionados da lixeira
    const btnBulkPermDeleteTrash = document.getElementById('btnBulkPermDeleteTrash');
    if (btnBulkPermDeleteTrash) {
      btnBulkPermDeleteTrash.onclick = async () => {
        if (this.selectedTrashIds.size === 0) {
          showToast('Nenhum item selecionado para excluir definitivamente.', 'warning');
          return;
        }
        await this.confirmBulkPermDeleteTrash(Array.from(this.selectedTrashIds));
      };
    }

    // Binds de ação
    tbody.querySelectorAll('.btn-restore-gift').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.handleRestoreGift(id);
      });
    });

    tbody.querySelectorAll('.btn-perm-delete-gift').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.confirmPermanentDeleteGift(id);
      });
    });
  },

  async handleRestoreGift(id) {
    try {
      const res = await window.weddingDB.restoreGift(id);
      const gift = res && res.gift ? res.gift : res;
      const title = gift ? gift.title : 'Presente';
      const cloudMsg = res && res.supabaseSynced ? ' (sincronizado na nuvem)' : '';
      showToast(`Item "${title}" restaurado com sucesso para a vitrine pública!${cloudMsg}`, 'success');
      await this.render();
    } catch (err) {
      showToast(err.message || 'Erro ao restaurar presente.', 'error');
    }
  },

  async confirmPermanentDeleteGift(id) {
    const gift = await window.weddingDB.getGiftById(id);
    const itemTitle = gift ? gift.title : 'este item';

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

    deleteItemTitleText.innerHTML = `Tem certeza que deseja excluir permanentemente o item <strong style="color: var(--color-error);">"${escapeHTML(itemTitle)}"</strong>?<br><span style="font-size: 0.83rem; color: var(--color-error); font-weight: 500;">Esta ação é definitiva e não poderá ser desfeita. O item será expurgado do IndexedDB e da nuvem Supabase.</span>`;

    btnConfirmDelete.innerText = 'Sim, Excluir Definitivamente';
    btnConfirmDelete.style.background = 'var(--color-error)';
    btnConfirmDelete.style.borderColor = 'var(--color-error)';

    deleteProgressBox.style.display = 'none';
    deleteProgressBar.style.width = '0%';
    deleteProgressPercent.innerText = '0%';
    deleteProgressStatusText.innerText = 'Iniciando exclusão definitiva...';
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
      deleteModalActions.style.display = 'none';
      deleteProgressBox.style.display = 'block';

      deleteProgressBar.style.width = '40%';
      deleteProgressPercent.innerText = '40%';
      deleteProgressStatusText.innerText = 'Excluindo definitivamente do banco local...';

      await new Promise(r => setTimeout(r, 150));
      await window.weddingDB.permanentDeleteGift(id);

      deleteProgressBar.style.width = '80%';
      deleteProgressPercent.innerText = '80%';
      deleteProgressStatusText.innerText = 'Expurgando permanentemente do Supabase...';

      await new Promise(r => setTimeout(r, 200));

      deleteProgressBar.style.width = '100%';
      deleteProgressPercent.innerText = '100%';
      deleteProgressStatusText.innerText = 'Item excluído permanentemente com sucesso!';

      await new Promise(r => setTimeout(r, 150));

      closeModal();
      showToast(`Item "${itemTitle}" excluído permanentemente!`, 'info');
      await this.render();
    };
  },

  async confirmBulkRestoreTrash(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const total = ids.length;
    try {
      await window.weddingDB.restoreMultipleGifts(ids);
      this.selectedTrashIds.clear();
      showToast(`${total} ${total === 1 ? 'item restaurado' : 'itens restaurados'} com sucesso para a vitrine pública!`, 'success');
      await this.render();
    } catch (err) {
      showToast('Erro ao restaurar itens selecionados: ' + (err.message || err), 'error');
    }
  },

  async confirmBulkPermDeleteTrash(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;

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

    const total = ids.length;
    deleteItemTitleText.innerHTML = `Tem certeza que deseja excluir permanentemente os <strong style="color: var(--color-error);">${total} presentes selecionados</strong> da Lixeira?<br><span style="font-size: 0.83rem; color: var(--color-error); font-weight: 500;">Esta ação é definitiva e não poderá ser desfeita. Os itens serão expurgados do IndexedDB e do Supabase.</span>`;

    btnConfirmDelete.innerText = 'Sim, Excluir Definitivamente';
    btnConfirmDelete.style.background = 'var(--color-error)';
    btnConfirmDelete.style.borderColor = 'var(--color-error)';

    deleteProgressBox.style.display = 'none';
    deleteProgressBar.style.width = '0%';
    deleteProgressPercent.innerText = '0%';
    deleteProgressStatusText.innerText = 'Iniciando exclusão definitiva...';
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
      deleteModalActions.style.display = 'none';
      deleteProgressBox.style.display = 'block';

      deleteProgressBar.style.width = '40%';
      deleteProgressPercent.innerText = '40%';
      deleteProgressStatusText.innerText = `Excluindo ${total} itens permanentemente...`;

      await new Promise(r => setTimeout(r, 150));
      await window.weddingDB.deleteMultipleGifts(ids);

      deleteProgressBar.style.width = '100%';
      deleteProgressPercent.innerText = '100%';
      deleteProgressStatusText.innerText = `${total} itens excluídos definitivamente!`;

      await new Promise(r => setTimeout(r, 150));

      closeModal();
      this.selectedTrashIds.clear();
      showToast(`${total} itens excluídos permanentemente da lixeira!`, 'success');
      await this.render();
    };
  },

  async confirmEmptyTrash(count) {
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

    deleteItemTitleText.innerHTML = `Tem certeza que deseja esvaziar a lixeira e excluir definitivamente todos os <strong style="color: var(--color-error);">${count} presentes</strong>?<br><span style="font-size: 0.83rem; color: var(--color-error); font-weight: 500;">Esta ação é irreversível. Todos os itens na lixeira serão apagados permanentemente tanto do banco local quanto do Supabase.</span>`;

    btnConfirmDelete.innerText = 'Sim, Esvaziar Tudo';
    btnConfirmDelete.style.background = 'var(--color-error)';
    btnConfirmDelete.style.borderColor = 'var(--color-error)';

    deleteProgressBox.style.display = 'none';
    deleteProgressBar.style.width = '0%';
    deleteProgressPercent.innerText = '0%';
    deleteProgressStatusText.innerText = 'Iniciando esvaziamento da lixeira...';
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
      deleteModalActions.style.display = 'none';
      deleteProgressBox.style.display = 'block';

      deleteProgressBar.style.width = '40%';
      deleteProgressPercent.innerText = '40%';
      deleteProgressStatusText.innerText = `Excluindo ${count} itens permanentemente...`;

      await new Promise(r => setTimeout(r, 150));
      await window.weddingDB.emptyTrash();

      deleteProgressBar.style.width = '80%';
      deleteProgressPercent.innerText = '80%';
      deleteProgressStatusText.innerText = 'Expurgando permanentemente do Supabase...';

      await new Promise(r => setTimeout(r, 200));

      deleteProgressBar.style.width = '100%';
      deleteProgressPercent.innerText = '100%';
      deleteProgressStatusText.innerText = 'Lixeira esvaziada com sucesso!';

      await new Promise(r => setTimeout(r, 150));

      closeModal();
      showToast(`Lixeira esvaziada com sucesso! (${count} itens removidos)`, 'info');
      await this.render();
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
    const itemTitle = gift ? gift.title : 'este item';

    unreserveItemTitleText.innerHTML = `Tem certeza que deseja retornar <strong>"${escapeHTML(itemTitle)}"</strong>?<br><span style="font-size:0.83rem; color:var(--color-olive-muted);">O item ficará disponível novamente para todos os convidados na lista pública.</span>`;

    unreserveProgressBox.style.display = 'none';
    unreserveProgressBar.style.width = '0%';
    unreserveProgressPercent.innerText = '0%';
    unreserveProgressStatusText.innerText = 'Retornando item...';
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

      unreserveProgressBar.style.width = '35%';
      unreserveProgressPercent.innerText = '35%';
      unreserveProgressStatusText.innerText = 'Restaurando status disponível localmente...';

      await new Promise(r => setTimeout(r, 200));
      await window.weddingDB.unreserveGift(id);

      unreserveProgressBar.style.width = '80%';
      unreserveProgressPercent.innerText = '80%';
      unreserveProgressStatusText.innerText = 'Atualizando status no Supabase...';

      await new Promise(r => setTimeout(r, 250));

      unreserveProgressBar.style.width = '100%';
      unreserveProgressPercent.innerText = '100%';
      unreserveProgressStatusText.innerText = 'Item retornado com sucesso!';

      await new Promise(r => setTimeout(r, 200));

      closeModal();
      showToast(`"${itemTitle}" foi retornado e está disponível novamente!`, 'success');
      await this.render();
    };
  },

  async toggleFeatured(id) {
    const gift = await window.weddingDB.getGiftById(id);
    if (!gift) return;

    gift.isFeatured = !gift.isFeatured;
    await window.weddingDB.saveGift(gift);
    showToast(gift.isFeatured ? 'Item adicionado aos Mais Desejados!' : 'Item removido dos Mais Desejados.', 'info');
    await this.renderGiftsTable();
  },

  async editGift(id) {
    const gift = await window.weddingDB.getGiftById(id);
    if (!gift) return;

    document.getElementById('adminGiftId').value = gift.id;
    document.getElementById('adminGiftTitle').value = gift.title;

    // Configuração dos checkboxes de múltiplas categorias
    const categoryCheckboxes = document.querySelectorAll('input[name="adminGiftCategory"]');
    categoryCheckboxes.forEach(cb => cb.checked = false);

    let catsToSelect = [];
    if (Array.isArray(gift.categories) && gift.categories.length > 0) {
      catsToSelect = gift.categories.map(c => String(c).trim().toLowerCase());
    } else if (gift.category) {
      catsToSelect = String(gift.category).split(',').map(s => s.trim().toLowerCase());
    }
    if (catsToSelect.length === 0) catsToSelect = ['cozinha'];

    categoryCheckboxes.forEach(cb => {
      const val = cb.value.toLowerCase();
      if (catsToSelect.includes(val) || 
          (val === 'casa' && (catsToSelect.includes('cama') || catsToSelect.includes('banho'))) ||
          (val === 'cozinha' && catsToSelect.includes('eletrodomésticos'))) {
        cb.checked = true;
      }
    });

    const hiddenCatInput = document.getElementById('adminGiftCategory');
    if (hiddenCatInput) hiddenCatInput.value = catsToSelect[0] || 'cozinha';

    document.getElementById('adminGiftPrice').value = gift.price;
    document.getElementById('adminGiftDesc').value = gift.description || '';
    document.getElementById('adminGiftImage').value = gift.imageUrl || '';
    document.getElementById('adminGiftProductUrl').value = gift.productUrl || '';

    this.updateImagePreview(gift.imageUrl || '');

    const isFeaturedCheck = document.getElementById('adminGiftIsFeatured');
    if (isFeaturedCheck) isFeaturedCheck.checked = !!gift.isFeatured;

    document.getElementById('adminGiftSubmitBtn').innerText = 'Salvar Alterações';
    document.getElementById('adminGiftCancelBtn').style.display = 'inline-flex';
    document.getElementById('adminGiftFormTitle').innerText = 'Editar Item da Lista';
    document.getElementById('adminGiftForm').scrollIntoView({ behavior: 'smooth' });
  },

  resetGiftForm() {
    const form = document.getElementById('adminGiftForm');
    if (form) form.reset();
    document.getElementById('adminGiftId').value = '';

    // Reseta checkboxes marcando Cozinha como padrão
    document.querySelectorAll('input[name="adminGiftCategory"]').forEach(cb => {
      cb.checked = (cb.value === 'cozinha');
    });
    const hiddenCatInput = document.getElementById('adminGiftCategory');
    if (hiddenCatInput) hiddenCatInput.value = 'cozinha';

    document.getElementById('adminGiftSubmitBtn').innerText = 'Adicionar à Lista';
    document.getElementById('adminGiftCancelBtn').style.display = 'none';
    document.getElementById('adminGiftFormTitle').innerText = 'Novo Presente';
    this.updateImagePreview('');
  },

  async handleSaveGift() {
    const id = document.getElementById('adminGiftId').value || ('gift_' + Date.now());
    const title = document.getElementById('adminGiftTitle').value.trim();

    // Ler todas as categorias selecionadas nos checkboxes
    const selectedCats = Array.from(document.querySelectorAll('input[name="adminGiftCategory"]:checked')).map(cb => cb.value);
    if (selectedCats.length === 0) {
      selectedCats.push('cozinha');
    }
    const category = selectedCats.join(', ');

    const price = parseFloat(document.getElementById('adminGiftPrice').value) || 0;
    const description = document.getElementById('adminGiftDesc').value.trim();
    const imageUrl = document.getElementById('adminGiftImage').value.trim();
    const productUrl = document.getElementById('adminGiftProductUrl').value.trim();
    const isFeatured = document.getElementById('adminGiftIsFeatured').checked;

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
    giftData.categories = selectedCats;
    giftData.price = price;
    giftData.description = description;
    giftData.imageUrl = imageUrl;
    giftData.productUrl = productUrl;
    giftData.isCota = false;
    giftData.isFeatured = isFeatured;

    await window.weddingDB.saveGift(giftData);
    showToast('Item salvo com sucesso e sincronizado!', 'success');
    this.resetGiftForm();
    await this.renderGiftsTable();
  },

  async openManualDonorModal(preselectedGiftId = null) {
    const modal = document.getElementById('manualDonorModal');
    const select = document.getElementById('manualDonorGiftSelect');
    const titleEl = document.getElementById('manualDonorModalTitle');
    const origIdInput = document.getElementById('manualDonorOriginalGiftId');
    const nameInput = document.getElementById('manualDonorName');
    const phoneInput = document.getElementById('manualDonorPhone');
    const statusSelect = document.getElementById('manualDonorStatus');
    const dateInput = document.getElementById('manualDonorDate');
    const msgInput = document.getElementById('manualDonorMessage');

    if (!modal || !select) return;

    const gifts = await window.weddingDB.getAllGifts();
    
    // Preencher dropdown de presentes com indicador claro
    select.innerHTML = '<option value="">-- Escolha um presente da lista --</option>' + 
      gifts.map(g => {
        const priceLabel = formatCurrency(g.price);
        const statusLabel = g.status === 'pending_approval' ? ' [Pendente]' : (g.status === 'reserved' || g.status === 'completed' ? ' [Confirmado]' : '');
        return `<option value="${g.id}">${escapeHTML(g.title)} (${priceLabel})${statusLabel}</option>`;
      }).join('');

    const targetId = preselectedGiftId || '';
    origIdInput.value = targetId;

    if (targetId) {
      select.value = targetId;
      const targetGift = gifts.find(g => g.id === targetId);
      if (targetGift) {
        titleEl.innerText = `Gerenciar Quem Deu: ${targetGift.title}`;
        nameInput.value = targetGift.reservedBy || '';
        phoneInput.value = targetGift.guestPhone || '';
        statusSelect.value = targetGift.status === 'available' ? 'reserved' : targetGift.status;
        if (targetGift.reservedAt) {
          try {
            dateInput.value = new Date(targetGift.reservedAt).toISOString().substring(0, 16);
          } catch (_) {
            dateInput.value = new Date().toISOString().substring(0, 16);
          }
        } else {
          dateInput.value = new Date().toISOString().substring(0, 16);
        }
        msgInput.value = targetGift.guestMessage || '';
      }
    } else {
      titleEl.innerText = 'Lançar Quem Presenteou Manualmente';
      nameInput.value = '';
      phoneInput.value = '';
      statusSelect.value = 'reserved';
      dateInput.value = new Date().toISOString().substring(0, 16);
      msgInput.value = '';
    }

    // Se o usuário selecionar outro presente no select, carregar os dados correspondentes
    select.onchange = () => {
      const gId = select.value;
      const g = gifts.find(item => item.id === gId);
      if (g && (g.reservedBy || g.status !== 'available')) {
        nameInput.value = g.reservedBy || '';
        phoneInput.value = g.guestPhone || '';
        statusSelect.value = g.status === 'available' ? 'reserved' : g.status;
        if (g.reservedAt) {
          try {
            dateInput.value = new Date(g.reservedAt).toISOString().substring(0, 16);
          } catch (_) {
            dateInput.value = new Date().toISOString().substring(0, 16);
          }
        }
        msgInput.value = g.guestMessage || '';
      }
    };

    modal.classList.add('active');
  },

  async handleSaveManualDonor() {
    const modal = document.getElementById('manualDonorModal');
    const select = document.getElementById('manualDonorGiftSelect');
    const nameInput = document.getElementById('manualDonorName');
    const phoneInput = document.getElementById('manualDonorPhone');
    const statusSelect = document.getElementById('manualDonorStatus');
    const dateInput = document.getElementById('manualDonorDate');
    const msgInput = document.getElementById('manualDonorMessage');

    const giftId = select ? select.value : '';
    if (!giftId) {
      showToast('Por favor, selecione um presente da lista.', 'error');
      return;
    }

    const donorName = nameInput.value.trim();
    if (!donorName && statusSelect.value !== 'available') {
      showToast('Informe o nome de quem presenteou.', 'error');
      return;
    }

    const donorData = {
      reservedBy: donorName,
      guestPhone: phoneInput.value.trim(),
      guestMessage: msgInput.value.trim(),
      reservedAt: dateInput.value ? new Date(dateInput.value).toISOString() : new Date().toISOString(),
      status: statusSelect.value || 'reserved'
    };

    try {
      await window.weddingDB.setGiftDonor(giftId, donorData);
      if (modal) modal.classList.remove('active');
      showToast('Dados de quem presenteou salvos e sincronizados com sucesso!', 'success');
      await this.render();
    } catch (err) {
      showToast('Erro ao salvar dados: ' + (err.message || err), 'error');
    }
  },

  async approveGiftReservation(id) {
    try {
      await window.weddingDB.approveGift(id);
      showToast('Presente aprovado com sucesso! Abrindo edição de quem presenteou...', 'success');
      this.switchTab('reservations');
      await this.openManualDonorModal(id);
    } catch (err) {
      showToast('Erro ao aprovar presente: ' + (err.message || err), 'error');
    }
  },

  async renderReservationsTable() {
    const tbody = document.getElementById('adminReservationsTableBody');
    if (!tbody) return;

    const gifts = await window.weddingDB.getAllGifts();
    const reservedItems = gifts.filter(g => g.status === 'pending_approval' || g.status === 'reserved' || g.status === 'completed' || (g.reservedBy && g.reservedBy.trim() !== ''));

    // Atualizar contadores de resumo dos cards rápidos e abas
    this.updateReservationsBadge().catch(() => {});
    this.updateGiftsBadge().catch(() => {});

    const statTotalChosen = document.getElementById('statTotalChosen');
    const statPendingApprovals = document.getElementById('statPendingApprovals');
    const statApprovedGifts = document.getElementById('statApprovedGifts');
    if (statTotalChosen) statTotalChosen.innerText = reservedItems.length;
    if (statPendingApprovals) statPendingApprovals.innerText = reservedItems.filter(g => g.status === 'pending_approval').length;
    if (statApprovedGifts) statApprovedGifts.innerText = reservedItems.filter(g => g.status === 'reserved' || g.status === 'completed').length;

    if (reservedItems.length === 0) {
      this.selectedReservationIds.clear();
      this.updateBulkReservationsActionsBar(0);
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--color-olive-muted);">Nenhum presente reservado ou aguardando aprovação no momento. Clique em "+ Lançar Quem Deu Manualmente" acima para adicionar!</td></tr>`;
      return;
    }

    // Filtrar IDs selecionados para manter apenas os existentes na lista
    const existingIds = new Set(reservedItems.map(g => g.id));
    for (const sId of this.selectedReservationIds) {
      if (!existingIds.has(sId)) {
        this.selectedReservationIds.delete(sId);
      }
    }

    tbody.innerHTML = reservedItems.map(g => {
      const isChecked = this.selectedReservationIds.has(g.id);
      const guestListStr = `<strong>${escapeHTML(g.reservedBy || 'Convidado')}</strong>`;
      let contactHtml = '';
      if (g.guestPhone && g.guestPhone.trim()) {
        const clean = g.guestPhone.replace(/\D/g, '');
        const wa = clean.length <= 11 ? '55' + clean : clean;
        contactHtml = `
          <div style="display: inline-flex; align-items: center; gap: 0.45rem;">
            <span style="font-weight: 500; font-size: 0.88rem;">${escapeHTML(g.guestPhone.trim())}</span>
            <a href="https://wa.me/${wa}" target="_blank" class="btn-table-link" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: var(--radius-sm); border: 1px solid var(--color-olive-border); color: var(--color-olive-primary); padding: 0;" title="Conversar no WhatsApp" aria-label="WhatsApp">
              <svg class="icon-line xs" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </a>
          </div>
        `;
      }
      const messageHtml = (g.guestMessage && g.guestMessage.trim()) 
        ? `<div style="color: var(--color-olive-muted); font-style: italic; ${contactHtml ? 'margin-top: 0.35rem;' : ''}">"${escapeHTML(g.guestMessage.trim())}"</div>` 
        : '';

      let approvalStatusHtml = '';
      if (g.status === 'pending_approval') {
        approvalStatusHtml = `
          <div style="display:inline-flex; align-items:center;">
            <span class="badge" style="background:#fff3cd; color:#856404; border:1.5px solid #ffeeba; padding:0.35rem 0.75rem; border-radius:var(--radius-full); font-size:0.8rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;" title="Aguardando liberação dos noivos">
              <svg class="icon-line xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Pendente
            </span>
          </div>
        `;
      } else {
        approvalStatusHtml = `
          <div style="display:inline-flex; flex-direction:column; gap:0.25rem;">
            <span class="badge" style="background:#d4edda; color:#155724; border:1.5px solid #c3e6cb; padding:0.35rem 0.75rem; border-radius:var(--radius-full); font-size:0.8rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;">
              <svg class="icon-line xs" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Confirmado
            </span>
            ${g.reservedAt ? `<span style="font-size:0.75rem; color:var(--color-olive-muted);">Confirmado em ${new Date(g.reservedAt).toLocaleDateString('pt-BR')}</span>` : ''}
          </div>
        `;
      }

      return `
        <tr class="${isChecked ? 'selected-row' : ''}" data-reservation-id="${g.id}">
          <td class="col-checkbox" style="text-align: center; padding-left: 0.75rem; padding-right: 0.5rem; vertical-align: middle;">
            <input type="checkbox" class="reservation-select-checkbox" data-id="${g.id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--color-olive-primary); cursor: pointer; vertical-align: middle;">
          </td>
          <td style="vertical-align: middle; width: 70px;">
            ${this.renderItemThumbnail(g.imageUrl, g.title)}
          </td>
          <td class="col-title" style="vertical-align: middle;">
            <div class="admin-item-title-wrapper">
              <div style="min-width: 0; flex: 1;">
                <span class="admin-item-title-text" title="${escapeHTML(g.title)}">${escapeHTML(g.title)}</span>
                ${g.isFeatured ? '<div style="margin-top:0.2rem;"><span class="badge-featured" style="display:inline-flex; align-items:center; gap:0.3rem; font-size:0.72rem; padding:0.15rem 0.5rem;"><svg class="icon-line xs" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>Mais Desejado</span></div>' : ''}
              </div>
            </div>
          </td>
          <td style="font-weight: 600; color: var(--color-olive-primary); vertical-align: middle;">${formatCurrency(g.price)}</td>
          <td style="vertical-align: middle;">${guestListStr}</td>
          <td style="max-width: 240px; font-size: 0.85rem; vertical-align: middle;">
            ${contactHtml ? `<div>${contactHtml}</div>` : ''}
            ${messageHtml}
          </td>
          <td style="vertical-align: middle;">${approvalStatusHtml}</td>
          <td style="vertical-align: middle; text-align: right;">
            <div class="table-actions-wrapper">
              ${g.status === 'pending_approval' ? `
                <button class="btn-table-action btn-table-approve btn-admin-approve" data-id="${g.id}" title="Aprovar solicitação do convidado">
                  <svg class="icon-line sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>Aprovar</span>
                </button>
              ` : ''}
              <button class="btn-table-action btn-table-donor btn-admin-manage-donor" data-id="${g.id}" title="Editar dados de quem presenteou">
                <svg class="icon-line sm" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Quem Deu</span>
              </button>
              <button class="btn-table-action btn-table-unreserve btn-admin-unreserve" data-id="${g.id}" title="Retornar este item para ficar disponível novamente na vitrine pública">
                <svg class="icon-line sm" viewBox="0 0 24 24">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                <span>Retornar</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Atualiza barra de ações em lote para já presenteados
    this.updateBulkReservationsActionsBar(reservedItems.length);

    // Eventos dos checkboxes individuais
    tbody.querySelectorAll('.reservation-select-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-id');
        const tr = cb.closest('tr');
        if (cb.checked) {
          this.selectedReservationIds.add(id);
          if (tr) tr.classList.add('selected-row');
        } else {
          this.selectedReservationIds.delete(id);
          if (tr) tr.classList.remove('selected-row');
        }
        this.updateBulkReservationsActionsBar(reservedItems.length);
      });
    });

    // Evento do checkbox mestre (Selecionar Todos de Já Presenteados)
    const selectAllResCb = document.getElementById('selectAllReservationsCheckbox');
    if (selectAllResCb) {
      selectAllResCb.onchange = () => {
        const checkAll = selectAllResCb.checked;
        tbody.querySelectorAll('.reservation-select-checkbox').forEach(cb => {
          cb.checked = checkAll;
          const id = cb.getAttribute('data-id');
          const tr = cb.closest('tr');
          if (checkAll) {
            this.selectedReservationIds.add(id);
            if (tr) tr.classList.add('selected-row');
          } else {
            this.selectedReservationIds.delete(id);
            if (tr) tr.classList.remove('selected-row');
          }
        });
        this.updateBulkReservationsActionsBar(reservedItems.length);
      };
    }

    // Botão Desmarcar Todos de Já Presenteados
    const btnDeselectAllRes = document.getElementById('btnDeselectAllReservations');
    if (btnDeselectAllRes) {
      btnDeselectAllRes.onclick = () => {
        this.selectedReservationIds.clear();
        tbody.querySelectorAll('.reservation-select-checkbox').forEach(cb => {
          cb.checked = false;
          const tr = cb.closest('tr');
          if (tr) tr.classList.remove('selected-row');
        });
        this.updateBulkReservationsActionsBar(reservedItems.length);
      };
    }

    // Botão Retornar Selecionados em lote
    const btnBulkUnreserve = document.getElementById('btnBulkUnreserveReservations');
    if (btnBulkUnreserve) {
      btnBulkUnreserve.onclick = async () => {
        if (this.selectedReservationIds.size === 0) {
          showToast('Nenhum item selecionado para retornar.', 'warning');
          return;
        }
        await this.confirmBulkUnreserveReservations(Array.from(this.selectedReservationIds));
      };
    }

    tbody.querySelectorAll('.btn-admin-approve').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.approveGiftReservation(id);
      });
    });

    tbody.querySelectorAll('.btn-admin-manage-donor').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.openManualDonorModal(id);
      });
    });

    tbody.querySelectorAll('.btn-admin-unreserve').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.confirmUnreserveGift(id);
      });
    });
  },

  async confirmBulkUnreserveReservations(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;

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

    const total = ids.length;
    deleteItemTitleText.innerHTML = `Deseja retornar os <strong style="color: var(--color-olive-deep);">${total} presentes selecionados</strong>?<br><span style="font-size: 0.83rem; color: var(--color-olive-muted);">Os dados de quem presenteou serão limpos e os itens voltarão a ficar disponíveis na vitrine pública para outros convidados.</span>`;

    btnConfirmDelete.innerText = 'Retornar Selecionados';
    btnConfirmDelete.style.background = 'var(--color-olive-primary)';
    btnConfirmDelete.style.borderColor = 'var(--color-olive-primary)';

    deleteProgressBox.style.display = 'none';
    deleteProgressBar.style.width = '0%';
    deleteProgressPercent.innerText = '0%';
    deleteProgressStatusText.innerText = 'Iniciando retorno...';
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
      deleteModalActions.style.display = 'none';
      deleteProgressBox.style.display = 'block';

      deleteProgressBar.style.width = '35%';
      deleteProgressPercent.innerText = '35%';
      deleteProgressStatusText.innerText = `Retornando ${total} presentes...`;

      await new Promise(r => setTimeout(r, 150));
      await window.weddingDB.unreserveMultipleGifts(ids);

      deleteProgressBar.style.width = '100%';
      deleteProgressPercent.innerText = '100%';
      deleteProgressStatusText.innerText = `${total} itens retornados com sucesso!`;

      await new Promise(r => setTimeout(r, 150));

      closeModal();
      this.selectedReservationIds.clear();
      showToast(`${total} presentes retornados com sucesso!`, 'success');
      await this.render();
    };
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

    showToast('Configurações salvas com sucesso!', 'success');
  }
};

window.AdminDashboard = AdminDashboard;

/* Inicialização da Página de Administração */
document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('adminLoginView');
  const dashboardView = document.getElementById('adminDashboardView');
  const loginForm = document.getElementById('adminLoginForm');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const userGreetingBadge = document.getElementById('adminUserGreetingBadge');
  const togglePasswordBtn = document.getElementById('toggleLoginPassword');
  const passwordInput = document.getElementById('adminPasswordInput');

  // 1. Configuração Imediata de Logout e Modal
  const btnLogout = document.getElementById('btnAdminLogout');
  const logoutModal = document.getElementById('logoutModal');
  const btnConfirmLogout = document.getElementById('btnConfirmLogout');
  const btnCancelLogout = document.getElementById('btnCancelLogout');

  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      window.handleAdminLogout(e);
    });
  }

  if (logoutModal) {
    const closeLogoutModal = () => logoutModal.classList.remove('active');
    if (btnCancelLogout) btnCancelLogout.addEventListener('click', closeLogoutModal);
    logoutModal.addEventListener('click', (e) => {
      if (e.target === logoutModal) closeLogoutModal();
    });
    if (btnConfirmLogout) {
      btnConfirmLogout.addEventListener('click', (e) => {
        e.preventDefault();
        closeLogoutModal();
        AuthController.logout();
      });
    }
  }

  // 2. Configuração Imediata das Abas (ativa navegação sem depender de async)
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.currentTarget;
      const tabName = targetBtn.getAttribute('data-tab');
      if (window.AdminDashboard && typeof window.AdminDashboard.switchTab === 'function') {
        window.AdminDashboard.switchTab(tabName);
      }
    });
  });

  // 3. Alternar visualização da senha de login
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPass = passwordInput.type === 'password';
      passwordInput.type = isPass ? 'text' : 'password';
      togglePasswordBtn.setAttribute('title', isPass ? 'Ocultar senha' : 'Ver senha');
    });
  }

  if (AuthController.isAuthenticated()) {
    const user = AuthController.getCurrentUser();
    activateDashboard(user);
  } else {
    loginView.style.display = 'flex';
    dashboardView.style.display = 'none';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', handleAdminLoginSubmit);
  }
});

/* Funções Utilitárias */
function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
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
