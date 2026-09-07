/* ==========================================================================
   LISTA DE PRESENTES - RHEBECA & MATHEUS
   Versão: v.1.3.0
   Módulo: Painel Administrativo Autenticado (Página Exclusiva dos Noivos)
   ========================================================================== */

const AUTH_USERS = [
  { email: 'matheus.h.h@hotmail.com', password: 'Mhmm*2738', name: 'Matheus' },
  { email: 'rhebecamendonca@gmail.com', password: 'Rom@2402', name: 'Rhebeca' }
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
    return AUTH_USERS.some(u => u.email.toLowerCase() === user.email.toLowerCase());
  },

  login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const found = AUTH_USERS.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);
    if (!found) {
      throw new Error('E-mail ou senha incorretos. Acesso restrito aos noivos Rhebeca & Matheus.');
    }

    const sessionData = {
      email: found.email,
      name: found.name,
      loggedAt: new Date().toISOString()
    };

    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
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
  },

  updateBulkActionsBar(totalGiftsCount) {
    const bar = document.getElementById('bulkActionsBar');
    const badge = document.getElementById('bulkSelectedCountBadge');
    const label = document.getElementById('btnBulkDeleteLabel');
    const selectAllCb = document.getElementById('selectAllGiftsCheckbox');
    const count = this.selectedGiftIds.size;

    if (bar && badge && label) {
      if (count > 0) {
        bar.style.display = 'flex';
        badge.innerText = `${count} ${count === 1 ? 'selecionado' : 'selecionados'}`;
        label.innerText = `Excluir Selecionados (${count})`;
      } else {
        bar.style.display = 'none';
      }
    }

    if (selectAllCb) {
      selectAllCb.checked = totalGiftsCount > 0 && count === totalGiftsCount;
      selectAllCb.indeterminate = count > 0 && count < totalGiftsCount;
    }
  },

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Inicializar Banco de Dados Híbrido com callback de tempo real protegido contra falha de rede
    try {
      await window.weddingDB.init((changeType) => {
        console.log('[Admin v.1.3.0] Mudança em tempo real recebida:', changeType);
        if (this.currentTab === 'gifts') {
          this.renderGiftsTable();
        } else if (this.currentTab === 'reservations') {
          this.renderReservationsTable();
        } else if (this.currentTab === 'trash') {
          this.renderTrashTable();
        }
        this.updateTrashBadge();
      });
    } catch (dbErr) {
      console.error('[Admin v.1.3.0] Erro ao conectar/inicializar banco:', dbErr);
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

    // 6. Formulário de Presente/Cota
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

    await this.render();
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
    await this.updateTrashBadge();

    if (this.currentTab === 'gifts') {
      const tabGifts = document.getElementById('adminTabGifts');
      if (tabGifts) tabGifts.style.display = 'block';
      await this.renderGiftsTable();
    } else if (this.currentTab === 'reservations') {
      const tabRes = document.getElementById('adminTabReservations');
      if (tabRes) tabRes.style.display = 'block';
      await this.renderReservationsTable();
    } else if (this.currentTab === 'settings') {
      const tabSettings = document.getElementById('adminTabSettings');
      if (tabSettings) tabSettings.style.display = 'block';
      await this.renderSettingsForm();
    } else if (this.currentTab === 'trash') {
      const tabTrash = document.getElementById('adminTabTrash');
      if (tabTrash) tabTrash.style.display = 'block';
      await this.renderTrashTable();
    }
  },

  async renderGiftsTable() {
    const tbody = document.getElementById('adminGiftsTableBody');
    if (!tbody) return;

    const gifts = await window.weddingDB.getAllGifts();

    if (gifts.length === 0) {
      this.selectedGiftIds.clear();
      this.updateBulkActionsBar(0);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--color-olive-muted);">Nenhum item cadastrado ainda. Use o extrator por link acima para começar!</td></tr>`;
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
        <td class="col-checkbox" style="text-align: center; padding-left: 0.75rem; padding-right: 0.5rem;">
          <input type="checkbox" class="gift-select-checkbox" data-id="${g.id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--color-olive-primary); cursor: pointer; vertical-align: middle;">
        </td>
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
        <td><span style="text-transform: capitalize;">${escapeHTML(g.category)}</span></td>
        <td>${g.isCota ? `${formatCurrency(g.quotaValue)}/cota (${g.quotaCurrent || 0}/${g.quotaTotal})` : formatCurrency(g.price)}</td>
        <td>
          ${g.status === 'pending_approval' ? `
            <span class="badge" style="background:#fff3cd; color:#856404; border:1px solid #ffeeba; padding:0.25rem 0.6rem; border-radius:var(--radius-full); font-size:0.75rem; font-weight:600; display:inline-flex; align-items:center; gap:0.3rem;">
              <span class="pulse-dot" style="background:#ffc107; width:6px; height:6px;"></span>
              Pendente (${escapeHTML(g.reservedBy || 'Aguardando')})
            </span>
          ` : `
            <span class="table-status-badge ${g.status === 'reserved' ? 'badge-reserved' : (g.status === 'completed' ? 'badge-cota' : 'badge-available')}">
              ${g.status === 'reserved' ? `Reservado (${escapeHTML(g.reservedBy || '')})` : (g.status === 'completed' ? 'Concluído' : 'Disponível')}
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
            <button class="btn-table-action btn-table-donor btn-admin-manage-donor" data-id="${g.id}" title="Gerenciar quem deu este presente">
              <svg class="icon-line sm" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
              <span>Quem Deu</span>
            </button>
            <button class="btn-table-action btn-table-edit btn-admin-edit" data-id="${g.id}" title="Editar presente ou cota">
              <svg class="icon-line sm" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Editar</span>
            </button>
            ${(g.status === 'pending_approval' || g.status === 'reserved' || g.status === 'completed' || (g.quotaCurrent && g.quotaCurrent > 0)) ? `
              <button class="btn-table-action btn-table-unreserve btn-admin-unreserve" data-id="${g.id}" title="Liberar item para ficar disponível novamente">
                <svg class="icon-line sm" viewBox="0 0 24 24">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                <span>Liberar</span>
              </button>
            ` : ''}
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
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3.5rem 1rem; color: var(--color-olive-muted);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
              <svg class="icon-line lg" style="color: var(--color-olive-frame); opacity: 0.5;" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <h4 style="font-size: 1.1rem; color: var(--color-olive-deep); margin: 0;">A lixeira está vazia</h4>
              <p style="font-size: 0.85rem; margin: 0; max-width: 400px; line-height: 1.4;">
                Nenhum presente foi excluído recentemente. Quando você excluir itens do catálogo, eles aparecerão aqui para serem restaurados ou apagados definitivamente.
              </p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = trashItems.map(g => {
      const imgHtml = g.imageUrl
        ? `<img src="${escapeHTML(g.imageUrl)}" alt="${escapeHTML(g.title)}" style="width: 48px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--color-olive-border);" onerror="this.src=''; this.parentElement.innerHTML='<div style=\\'width:48px;height:48px;background:var(--color-cream);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--color-olive-muted);\\'>🎁</div>';">`
        : `<div style="width: 48px; height: 48px; background: var(--color-cream); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--color-olive-muted); font-size: 1.2rem;">🎁</div>`;

      const priceText = g.isCota ? `${formatCurrency(g.quotaValue || g.price)}/cota` : formatCurrency(g.price);
      const deletedDateText = g.deletedAt 
        ? new Date(g.deletedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : (g.updatedAt ? new Date(g.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');

      return `
        <tr data-trash-id="${g.id}">
          <td style="vertical-align: middle;">
            ${imgHtml}
          </td>
          <td style="vertical-align: middle;">
            <strong style="color: var(--color-olive-deep); font-size: 0.95rem;">${escapeHTML(g.title)}</strong>
            ${g.isCota ? '<span style="display:block; font-size:0.75rem; color:var(--color-olive-frame);">Cota de Lua de Mel</span>' : ''}
          </td>
          <td style="vertical-align: middle; text-transform: capitalize;">${escapeHTML(g.category)}</td>
          <td style="vertical-align: middle; font-weight: 600; color: var(--color-olive-primary);">${priceText}</td>
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
      const restored = await window.weddingDB.restoreGift(id);
      const title = restored ? restored.title : 'Presente';
      showToast(`Item "${title}" restaurado com sucesso para a vitrine pública!`, 'success');
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

    unreserveItemTitleText.innerHTML = `Tem certeza que deseja liberar <strong>"${escapeHTML(itemTitle)}"</strong>?<br><span style="font-size:0.83rem; color:var(--color-olive-muted);">O item ficará disponível novamente para todos os convidados na lista pública.</span>`;

    unreserveProgressBox.style.display = 'none';
    unreserveProgressBar.style.width = '0%';
    unreserveProgressPercent.innerText = '0%';
    unreserveProgressStatusText.innerText = 'Liberando item...';
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
      unreserveProgressStatusText.innerText = 'Item liberado com sucesso!';

      await new Promise(r => setTimeout(r, 200));

      closeModal();
      showToast(`"${itemTitle}" foi liberado e está disponível novamente!`, 'success');
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
    document.getElementById('adminGiftCategory').value = gift.category;
    document.getElementById('adminGiftPrice').value = gift.price;
    document.getElementById('adminGiftDesc').value = gift.description || '';
    document.getElementById('adminGiftImage').value = gift.imageUrl || '';
    document.getElementById('adminGiftProductUrl').value = gift.productUrl || '';

    this.updateImagePreview(gift.imageUrl || '');

    const isCotaCheck = document.getElementById('adminGiftIsCota');
    isCotaCheck.checked = !!gift.isCota;
    document.getElementById('adminCotaFields').style.display = gift.isCota ? 'block' : 'none';
    if (gift.isCota) {
      document.getElementById('adminGiftQuotaVal').value = gift.quotaValue || '';
      document.getElementById('adminGiftQuotaTotal').value = gift.quotaTotal || '';
    }

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
    document.getElementById('adminCotaFields').style.display = 'none';
    document.getElementById('adminGiftSubmitBtn').innerText = 'Adicionar à Lista';
    document.getElementById('adminGiftCancelBtn').style.display = 'none';
    document.getElementById('adminGiftFormTitle').innerText = 'Novo Presente ou Cota';
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
    const isCota = document.getElementById('adminGiftIsCota').checked;
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
    giftData.price = price;
    giftData.description = description;
    giftData.imageUrl = imageUrl;
    giftData.productUrl = productUrl;
    giftData.isCota = isCota;
    giftData.isFeatured = isFeatured;

    if (isCota) {
      giftData.quotaValue = parseFloat(document.getElementById('adminGiftQuotaVal').value) || (price / 5);
      giftData.quotaTotal = parseInt(document.getElementById('adminGiftQuotaTotal').value) || Math.round(price / giftData.quotaValue);
    }

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
        const typeLabel = g.isCota ? 'Cota' : 'Físico';
        const priceLabel = g.isCota ? `${formatCurrency(g.quotaValue || 0)}/cota` : formatCurrency(g.price);
        const statusLabel = g.status === 'pending_approval' ? ' [⏳ Pendente]' : (g.status === 'reserved' ? ' [✅ Reservado]' : '');
        return `<option value="${g.id}">${escapeHTML(g.title)} (${typeLabel} - ${priceLabel})${statusLabel}</option>`;
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
      showToast('Presente aprovado e confirmado pelos noivos!', 'success');
      await this.render();
    } catch (err) {
      showToast('Erro ao aprovar presente: ' + (err.message || err), 'error');
    }
  },

  async renderReservationsTable() {
    const tbody = document.getElementById('adminReservationsTableBody');
    if (!tbody) return;

    const gifts = await window.weddingDB.getAllGifts();
    const reservedItems = gifts.filter(g => g.status === 'pending_approval' || g.status === 'reserved' || g.status === 'completed' || (g.isCota && g.quotaCurrent > 0) || (g.reservedBy && g.reservedBy.trim() !== ''));

    // Atualizar contadores de resumo dos cards rápidos
    const statTotalChosen = document.getElementById('statTotalChosen');
    const statPendingApprovals = document.getElementById('statPendingApprovals');
    const statApprovedGifts = document.getElementById('statApprovedGifts');
    if (statTotalChosen) statTotalChosen.innerText = reservedItems.length;
    if (statPendingApprovals) statPendingApprovals.innerText = reservedItems.filter(g => g.status === 'pending_approval').length;
    if (statApprovedGifts) statApprovedGifts.innerText = reservedItems.filter(g => g.status === 'reserved' || g.status === 'completed').length;

    if (reservedItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--color-olive-muted);">Nenhum presente reservado ou aguardando aprovação no momento. Clique em "+ Lançar Quem Deu Manualmente" acima para adicionar!</td></tr>`;
      return;
    }

    tbody.innerHTML = reservedItems.map(g => {
      let guestListStr = '';
      let contactStr = '';
      let messageStr = '';

      if (g.isCota) {
        const contributions = g.contributions || [];
        if (contributions.length > 0) {
          guestListStr = contributions.map(c => `• <strong>${escapeHTML(c.guestName)}</strong> (${formatCurrency(c.amount)})`).join('<br>');
          contactStr = contributions.map(c => {
            if (!c.guestPhone) return '-';
            const clean = c.guestPhone.replace(/\D/g, '');
            const wa = clean.length <= 11 ? '55' + clean : clean;
            return `<a href="https://wa.me/${wa}" target="_blank" class="btn-table-link" style="display:inline-flex; align-items:center; gap:0.25rem;">📱 ${escapeHTML(c.guestPhone)}</a>`;
          }).filter(x => x !== '-').join('<br>') || '-';
          messageStr = contributions.map(c => c.guestMessage ? `"${escapeHTML(c.guestMessage)}"` : '').filter(Boolean).join('<br>') || '-';
        } else {
          guestListStr = g.reservedBy ? `<strong>${escapeHTML(g.reservedBy)}</strong>` : 'Cotas avulsas';
          if (g.guestPhone) {
            const clean = g.guestPhone.replace(/\D/g, '');
            const wa = clean.length <= 11 ? '55' + clean : clean;
            contactStr = `<a href="https://wa.me/${wa}" target="_blank" class="btn-table-link" style="display:inline-flex; align-items:center; gap:0.25rem;">📱 ${escapeHTML(g.guestPhone)}</a>`;
          } else {
            contactStr = '-';
          }
          messageStr = g.guestMessage ? `"${escapeHTML(g.guestMessage)}"` : '-';
        }
      } else {
        guestListStr = `<strong>${escapeHTML(g.reservedBy || 'Convidado')}</strong>`;
        if (g.guestPhone) {
          const clean = g.guestPhone.replace(/\D/g, '');
          const wa = clean.length <= 11 ? '55' + clean : clean;
          contactStr = `<div>${escapeHTML(g.guestPhone)}</div><a href="https://wa.me/${wa}" target="_blank" class="btn-table-link" style="margin-top:0.25rem; display:inline-flex; align-items:center; gap:0.25rem;"><svg class="icon-line xs" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> Conversar WhatsApp</a>`;
        } else {
          contactStr = '<span style="color:var(--color-olive-muted);">-</span>';
        }
        messageStr = g.guestMessage ? `"${escapeHTML(g.guestMessage)}"` : '<span style="color:var(--color-olive-muted);">-</span>';
      }

      let approvalStatusHtml = '';
      if (g.status === 'pending_approval') {
        approvalStatusHtml = `
          <div style="display:inline-flex; flex-direction:column; gap:0.25rem;">
            <span class="badge" style="background:#fff3cd; color:#856404; border:1.5px solid #ffeeba; padding:0.35rem 0.75rem; border-radius:var(--radius-full); font-size:0.8rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;">
              <span class="pulse-dot" style="background:#ffc107; width:6px; height:6px;"></span>
              ⏳ Pendente de Aprovação
            </span>
            <span style="font-size:0.75rem; color:var(--color-olive-muted);">Aguardando liberação dos noivos</span>
          </div>
        `;
      } else {
        approvalStatusHtml = `
          <div style="display:inline-flex; flex-direction:column; gap:0.25rem;">
            <span class="badge" style="background:#d4edda; color:#155724; border:1.5px solid #c3e6cb; padding:0.35rem 0.75rem; border-radius:var(--radius-full); font-size:0.8rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;">
              <svg class="icon-line xs" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ✅ Aprovado / Confirmado
            </span>
            ${g.reservedAt ? `<span style="font-size:0.75rem; color:var(--color-olive-muted);">Confirmado em ${new Date(g.reservedAt).toLocaleDateString('pt-BR')}</span>` : ''}
          </div>
        `;
      }

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div>
                <strong>${escapeHTML(g.title)}</strong>
                <div style="font-size:0.78rem; color:var(--color-olive-muted); margin-top:0.15rem;">
                  ${g.isCota ? `${formatCurrency(g.quotaValue)}/cota (${g.quotaCurrent || 0}/${g.quotaTotal} cotas)` : formatCurrency(g.price)}
                  ${g.isFeatured ? ' • <span style="color:var(--color-gold-accent);">★ Destaque</span>' : ''}
                </div>
              </div>
            </div>
          </td>
          <td>
            <span class="table-status-badge ${g.isCota ? 'badge-cota' : 'badge-reserved'}">
              ${g.isCota ? 'Cota Lua de Mel' : 'Presente Físico'}
            </span>
          </td>
          <td>${guestListStr}</td>
          <td style="max-width: 240px; font-size: 0.85rem;">
            <div>${contactStr}</div>
            <div style="color: var(--color-olive-muted); font-style: italic; margin-top: 0.35rem;">${messageStr}</div>
          </td>
          <td>${approvalStatusHtml}</td>
          <td>
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
              <button class="btn-table-action btn-table-unreserve btn-admin-unreserve" data-id="${g.id}" title="Liberar este item para ficar disponível novamente na vitrine pública">
                <svg class="icon-line sm" viewBox="0 0 24 24">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                <span>Liberar</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

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

    const urlInput = document.getElementById('settingSupabaseUrl');
    if (urlInput) urlInput.value = settings.supabaseUrl || '';
    const keyInput = document.getElementById('settingSupabaseKey');
    if (keyInput) keyInput.value = settings.supabaseKey || '';
  },

  async handleSaveSettings() {
    const currentSettings = await window.weddingDB.getSettings();
    const whatsappInput = document.getElementById('settingWhatsappPhone');
    const urlInput = document.getElementById('settingSupabaseUrl');
    const keyInput = document.getElementById('settingSupabaseKey');

    const newSettings = {
      ...currentSettings,
      pixKey: document.getElementById('settingPixKey').value.trim(),
      pixName: document.getElementById('settingPixName').value.trim(),
      pixCity: document.getElementById('settingPixCity').value.trim(),
      weddingDate: document.getElementById('settingWeddingDate').value,
      welcomeMessage: document.getElementById('settingWelcomeMsg').value.trim(),
      ceremonyPlace: document.getElementById('settingCeremonyPlace').value.trim(),
      ceremonyCity: document.getElementById('settingCeremonyCity').value.trim(),
      whatsappPhone: whatsappInput ? whatsappInput.value.trim().replace(/\D/g, '') : (currentSettings.whatsappPhone || '5564993409360'),
      supabaseUrl: urlInput ? urlInput.value.trim() : (currentSettings.supabaseUrl || ''),
      supabaseKey: keyInput ? keyInput.value.trim() : (currentSettings.supabaseKey || '')
    };

    await window.weddingDB.saveSettings(newSettings);

    if (window.supabase && newSettings.supabaseUrl && newSettings.supabaseKey) {
      try {
        window.weddingDB.supabaseClient = window.supabase.createClient(newSettings.supabaseUrl, newSettings.supabaseKey);
        window.weddingDB._setupRealtimeListeners();
      } catch (e) {
        console.warn('Falha ao reconectar Supabase com novos parâmetros:', e);
      }
    }

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

  const activateDashboard = (user) => {
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';
    if (userGreetingBadge) {
      userGreetingBadge.innerHTML = `
        <svg class="icon-line xs" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <span>${escapeHTML(user.name)} (${escapeHTML(user.email)})</span>
      `;
    }
    AdminDashboard.init();
  };

  if (AuthController.isAuthenticated()) {
    const user = AuthController.getCurrentUser();
    activateDashboard(user);
  } else {
    loginView.style.display = 'flex';
    dashboardView.style.display = 'none';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('adminEmailInput').value;
      const password = document.getElementById('adminPasswordInput').value;
      loginErrorMsg.style.display = 'none';

      try {
        const user = AuthController.login(email, password);
        showToast(`Bem-vindo(a), ${user.name}! Acesso liberado.`, 'success');
        activateDashboard(user);
      } catch (err) {
        loginErrorMsg.innerText = err.message;
        loginErrorMsg.style.display = 'block';
      }
    });
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
