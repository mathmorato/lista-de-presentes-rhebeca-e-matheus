/* ==========================================================================
   LISTA DE PRESENTES - RHEBECA & MATHEUS
   Versão: v.1.2.2
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
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.reload();
  }
};

window.AuthController = AuthController;

const AdminDashboard = {
  currentTab: 'gifts',
  isInitialized: false,

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Inicializar Banco de Dados Híbrido com callback de tempo real
    await window.weddingDB.init((changeType) => {
      console.log('[Admin v.1.2.1] Mudança em tempo real recebida:', changeType);
      if (this.currentTab === 'gifts') {
        this.renderGiftsTable();
      } else if (this.currentTab === 'reservations') {
        this.renderReservationsTable();
      }
    });

    // 2. Abas do Painel
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetBtn = e.currentTarget;
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        targetBtn.classList.add('active');
        this.currentTab = targetBtn.getAttribute('data-tab');
        this.render();
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

    // 9. Botão de Logout
    const btnLogout = document.getElementById('btnAdminLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (confirm('Deseja realmente sair da área de gestão?')) {
          AuthController.logout();
        }
      });
    }

    await this.render();
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
    }
  },

  async renderGiftsTable() {
    const tbody = document.getElementById('adminGiftsTableBody');
    if (!tbody) return;

    const gifts = await window.weddingDB.getAllGifts();

    if (gifts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--color-olive-muted);">Nenhum item cadastrado ainda. Use o extrator por link acima para começar!</td></tr>`;
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
        <td><span style="text-transform: capitalize;">${escapeHTML(g.category)}</span></td>
        <td>${g.isCota ? `${formatCurrency(g.quotaValue)}/cota (${g.quotaCurrent || 0}/${g.quotaTotal})` : formatCurrency(g.price)}</td>
        <td>
          <span class="table-status-badge ${g.status === 'reserved' ? 'badge-reserved' : (g.status === 'completed' ? 'badge-cota' : 'badge-available')}">
            ${g.status === 'reserved' ? `Reservado (${escapeHTML(g.reservedBy || '')})` : (g.status === 'completed' ? 'Concluído' : 'Disponível')}
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
    `).join('');

    tbody.querySelectorAll('.btn-admin-star').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.toggleFeatured(id);
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

    deleteItemTitleText.innerHTML = `Tem certeza que deseja excluir permanentemente o item <strong style="color: var(--color-olive-deep);">"${escapeHTML(itemTitle)}"</strong>?<br><span style="font-size: 0.83rem; color: var(--color-olive-muted);">Esta ação removerá o item do catálogo local e do Supabase na nuvem.</span>`;

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

      deleteProgressBar.style.width = '30%';
      deleteProgressPercent.innerText = '30%';
      deleteProgressStatusText.innerText = 'Removendo do cache local IndexedDB...';

      await new Promise(r => setTimeout(r, 200));
      await window.weddingDB.deleteGift(id);

      deleteProgressBar.style.width = '75%';
      deleteProgressPercent.innerText = '75%';
      deleteProgressStatusText.innerText = 'Sincronizando exclusão com o Supabase...';

      await new Promise(r => setTimeout(r, 250));

      deleteProgressBar.style.width = '100%';
      deleteProgressPercent.innerText = '100%';
      deleteProgressStatusText.innerText = 'Exclusão concluída com sucesso!';

      await new Promise(r => setTimeout(r, 200));

      closeModal();
      showToast(`Item "${itemTitle}" excluído e sincronizado!`, 'success');
      await this.renderGiftsTable();
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

  async renderReservationsTable() {
    const tbody = document.getElementById('adminReservationsTableBody');
    if (!tbody) return;

    const gifts = await window.weddingDB.getAllGifts();
    const reservedItems = gifts.filter(g => g.status === 'reserved' || g.status === 'completed' || (g.isCota && g.quotaCurrent > 0));

    if (reservedItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--color-olive-muted);">Nenhum presente reservado ou cota recebida até o momento.</td></tr>`;
      return;
    }

    tbody.innerHTML = reservedItems.map(g => {
      let guestListStr = '';
      let contactStr = '';
      let messageStr = '';
      let progressDisplay = '';

      if (g.isCota) {
        const contributions = g.contributions || [];
        progressDisplay = `<strong>${g.quotaCurrent || 0} de ${g.quotaTotal || 1} cotas</strong> (${formatCurrency(g.amountRaised || 0)})`;

        if (contributions.length > 0) {
          guestListStr = contributions.map(c => `• ${escapeHTML(c.guestName)} (${formatCurrency(c.amount)})`).join('<br>');
          contactStr = contributions.map(c => c.guestPhone ? escapeHTML(c.guestPhone) : '-').filter(x => x !== '-').join(', ') || '-';
          messageStr = contributions.map(c => c.guestMessage ? `"${escapeHTML(c.guestMessage)}"` : '').filter(Boolean).join('<br>') || '-';
        } else {
          guestListStr = g.reservedBy ? escapeHTML(g.reservedBy) : 'Cotas avulsas';
          contactStr = g.guestPhone ? escapeHTML(g.guestPhone) : '-';
          messageStr = g.guestMessage ? `"${escapeHTML(g.guestMessage)}"` : '-';
        }
      } else {
        guestListStr = `<strong>${escapeHTML(g.reservedBy || 'Convidado')}</strong>`;
        contactStr = g.guestPhone ? escapeHTML(g.guestPhone) : '-';
        messageStr = g.guestMessage ? `"${escapeHTML(g.guestMessage)}"` : '-';
        progressDisplay = `<span class="table-status-badge badge-reserved">Item 100% Reservado</span>`;
      }

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
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
            <div><strong>Contato:</strong> ${contactStr}</div>
            <div style="color: var(--color-olive-muted); font-style: italic; margin-top: 0.2rem;">${messageStr}</div>
          </td>
          <td>${progressDisplay}</td>
          <td>
            <div class="table-actions-wrapper">
              <button class="btn-table-action btn-table-unreserve btn-admin-unreserve" data-id="${g.id}" title="Liberar este item para ficar disponível novamente na vitrine pública">
                <svg class="icon-line sm" viewBox="0 0 24 24">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                <span>Liberar Item</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

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

/* Inicialização da Página de Administração */
document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('adminLoginView');
  const dashboardView = document.getElementById('adminDashboardView');
  const loginForm = document.getElementById('adminLoginForm');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const userGreetingBadge = document.getElementById('adminUserGreetingBadge');
  const togglePasswordBtn = document.getElementById('toggleLoginPassword');
  const passwordInput = document.getElementById('adminPasswordInput');

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
