/* ═══════════════════════════════════════════════════════════════
   Mirza AI — Station Control Panel
   Dashboard, Chat, Models Catalog, Config — mirrors mirza CLI
   ═══════════════════════════════════════════════════════════════ */

// =================================================================
// Default Providers (for chat)
// =================================================================
const DEFAULT_PROVIDERS = [
    { id: 'mirza-local', name: 'Mirza (Local MLX)', type: 'local', endpoint: 'http://localhost:8080', apiKey: '', model: '' },
    { id: 'openai', name: 'OpenAI', type: 'cloud', endpoint: 'https://api.openai.com', apiKey: '', model: 'gpt-4o-mini' },
    { id: 'anthropic-openai', name: 'Anthropic', type: 'cloud', endpoint: 'https://api.anthropic.com/v1', apiKey: '', model: 'claude-sonnet-4-20250514' },
    { id: 'groq', name: 'Groq', type: 'cloud', endpoint: 'https://api.groq.com/openai', apiKey: '', model: 'llama-3.3-70b-versatile' },
    { id: 'mistral', name: 'Mistral AI', type: 'cloud', endpoint: 'https://api.mistral.ai', apiKey: '', model: 'mistral-small-latest' },
    { id: 'ollama', name: 'Ollama', type: 'local', endpoint: 'http://localhost:11434', apiKey: '', model: '' },
];

// =================================================================
// State
// =================================================================
const state = {
    currentView: 'dashboard',
    conversations: [],
    activeConversationId: null,
    isStreaming: false,
    abortController: null,
    providers: [],
    activeProviderId: 'mirza-local',
    modelsCatalog: null,
    dashboardData: null,
    settings: {
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: 'Tu es Mirza, un assistant IA intelligent et serviable. Tu réponds de manière claire, précise et concise en français.',
        mcpEndpoint: '',
        mcpTools: [],
        mcpEnabled: {}
    }
};

// =================================================================
// DOM References
// =================================================================
const dom = {};
function initDom() {
    const ids = [
        'sidebar', 'sidebar-toggle', 'conversations-list', 'sidebar-conversations',
        'sidebar-footer-chat', 'sidebar-footer-global',
        'welcome-screen', 'messages-container', 'messages-scroll',
        'message-input', 'btn-send', 'btn-new-chat',
        'provider-select', 'model-select', 'provider-status-dot',
        'token-counter', 'settings-modal', 'btn-settings', 'btn-close-settings',
        'setting-temperature', 'temperature-value', 'setting-max-tokens',
        'setting-system-prompt', 'setting-mcp-endpoint',
        'mcp-tools-list', 'btn-refresh-mcp',
        'btn-clear-history', 'btn-export-conversations', 'btn-add-provider',
        'providers-list', 'link-grafana', 'toast-container',
        'btn-refresh-status', 'btn-refresh-logs', 'btn-refresh-config',
        'dash-server-status', 'dash-host', 'dash-ip', 'dash-api', 'dash-grafana',
        'dash-chip', 'dash-cpu', 'dash-gpu', 'dash-ram',
        'dash-model-name', 'dash-model-sub', 'dash-logs',
        'dashboard-grid', 'models-grid', 'config-container',
        'filter-category', 'filter-ram',
        'action-wake', 'action-stop-mlx', 'action-sleep', 'action-reboot',
        'nav-monitoring'
    ];
    ids.forEach(id => { dom[id.replace(/-/g, '_')] = document.getElementById(id.replace(/-/g, '_')) || document.getElementById(id); });
    // Fix: re-map with actual IDs
    dom.sidebar = document.getElementById('sidebar');
    dom.sidebarToggle = document.getElementById('sidebar-toggle');
    dom.conversationsList = document.getElementById('conversations-list');
    dom.sidebarConversations = document.getElementById('sidebar-conversations');
    dom.sidebarFooterChat = document.getElementById('sidebar-footer-chat');
    dom.welcomeScreen = document.getElementById('welcome-screen');
    dom.messagesContainer = document.getElementById('messages-container');
    dom.messagesScroll = document.getElementById('messages-scroll');
    dom.messageInput = document.getElementById('message-input');
    dom.btnSend = document.getElementById('btn-send');
    dom.btnNewChat = document.getElementById('btn-new-chat');
    dom.providerSelect = document.getElementById('provider-select');
    dom.modelSelect = document.getElementById('model-select');
    dom.providerStatusDot = document.getElementById('provider-status-dot');
    dom.tokenCounter = document.getElementById('token-counter');
    dom.settingsModal = document.getElementById('settings-modal');
    dom.btnSettings = document.getElementById('btn-settings');
    dom.btnCloseSettings = document.getElementById('btn-close-settings');
    dom.settingTemperature = document.getElementById('setting-temperature');
    dom.temperatureValue = document.getElementById('temperature-value');
    dom.settingMaxTokens = document.getElementById('setting-max-tokens');
    dom.settingSystemPrompt = document.getElementById('setting-system-prompt');
    dom.settingMcpEndpoint = document.getElementById('setting-mcp-endpoint');
    dom.mcpToolsList = document.getElementById('mcp-tools-list');
    dom.btnRefreshMcp = document.getElementById('btn-refresh-mcp');
    dom.btnClearHistory = document.getElementById('btn-clear-history');
    dom.btnExportConversations = document.getElementById('btn-export-conversations');
    dom.btnAddProvider = document.getElementById('btn-add-provider');
    dom.providersList = document.getElementById('providers-list');
    dom.linkGrafana = document.getElementById('link-grafana');
    dom.toastContainer = document.getElementById('toast-container');
    dom.btnRefreshStatus = document.getElementById('btn-refresh-status');
    dom.btnRefreshLogs = document.getElementById('btn-refresh-logs');
    dom.btnRefreshConfig = document.getElementById('btn-refresh-config');
    dom.dashServerStatus = document.getElementById('dash-server-status');
    dom.dashHost = document.getElementById('dash-host');
    dom.dashIp = document.getElementById('dash-ip');
    dom.dashApi = document.getElementById('dash-api');
    dom.dashGrafana = document.getElementById('dash-grafana');
    dom.dashChip = document.getElementById('dash-chip');
    dom.dashCpu = document.getElementById('dash-cpu');
    dom.dashGpu = document.getElementById('dash-gpu');
    dom.dashRam = document.getElementById('dash-ram');
    dom.dashModelName = document.getElementById('dash-model-name');
    dom.dashModelSub = document.getElementById('dash-model-sub');
    dom.dashLogs = document.getElementById('dash-logs');
    dom.modelsGrid = document.getElementById('models-grid');
    dom.configContainer = document.getElementById('config-container');
    dom.filterCategory = document.getElementById('filter-category');
    dom.filterRam = document.getElementById('filter-ram');
    dom.actionWake = document.getElementById('action-wake');
    dom.actionStopMlx = document.getElementById('action-stop-mlx');
    dom.actionSleep = document.getElementById('action-sleep');
    dom.actionReboot = document.getElementById('action-reboot');
}

// =================================================================
// Init
// =================================================================
function init() {
    initDom();
    loadState();
    setupEventListeners();
    renderProviderSelect();
    renderConversationsList();
    switchView('dashboard');
    loadDashboard();
}

function loadState() {
    try { const s = localStorage.getItem('mirza_conversations'); if (s) state.conversations = JSON.parse(s); } catch(e) {}
    try { const s = localStorage.getItem('mirza_settings'); if (s) Object.assign(state.settings, JSON.parse(s)); } catch(e) {}
    try { const s = localStorage.getItem('mirza_providers'); state.providers = s ? JSON.parse(s) : JSON.parse(JSON.stringify(DEFAULT_PROVIDERS)); } catch(e) { state.providers = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS)); }
    state.activeProviderId = localStorage.getItem('mirza_active_provider') || 'mirza-local';
    state.activeConversationId = localStorage.getItem('mirza_active_conversation');

    dom.settingTemperature.value = state.settings.temperature;
    dom.temperatureValue.textContent = state.settings.temperature;
    dom.settingMaxTokens.value = state.settings.maxTokens;
    dom.settingSystemPrompt.value = state.settings.systemPrompt;
    dom.settingMcpEndpoint.value = state.settings.mcpEndpoint || '';
}

function saveState() {
    localStorage.setItem('mirza_conversations', JSON.stringify(state.conversations));
    localStorage.setItem('mirza_settings', JSON.stringify(state.settings));
    localStorage.setItem('mirza_providers', JSON.stringify(state.providers));
    localStorage.setItem('mirza_active_provider', state.activeProviderId);
    if (state.activeConversationId) localStorage.setItem('mirza_active_conversation', state.activeConversationId);
}

function getActiveProvider() {
    return state.providers.find(p => p.id === state.activeProviderId) || state.providers[0];
}

// =================================================================
// Toast Notifications
// =================================================================
function toast(message, type = 'info') {
    const icons = { success: '✓', error: '✗', info: '◈' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || '◈'}</span><span>${escapeHtml(message)}</span>`;
    dom.toastContainer.appendChild(el);
    setTimeout(() => {
        el.style.animation = 'toastOut 0.3s ease-out forwards';
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

// =================================================================
// Navigation / Views
// =================================================================
function switchView(viewName) {
    state.currentView = viewName;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Update views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const activeView = document.getElementById(`view-${viewName}`);
    if (activeView) activeView.classList.add('active');

    // Toggle sidebar chat elements
    const isChat = viewName === 'chat';
    dom.sidebarConversations.style.display = isChat ? 'flex' : 'none';
    dom.sidebarFooterChat.style.display = isChat ? 'flex' : 'none';

    if (isChat) {
        updateChatView();
        checkProviderStatus();
    }

    dom.sidebar.classList.remove('open');
}

// =================================================================
// Event Listeners
// =================================================================
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(n => {
        n.addEventListener('click', () => switchView(n.dataset.view));
    });

    // Mobile sidebar
    dom.sidebarToggle.addEventListener('click', () => dom.sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && dom.sidebar.classList.contains('open') &&
            !dom.sidebar.contains(e.target) && e.target !== dom.sidebarToggle) {
            dom.sidebar.classList.remove('open');
        }
    });

    // Chat
    dom.btnSend.addEventListener('click', sendMessage);
    dom.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    dom.messageInput.addEventListener('input', autoResize);
    dom.btnNewChat.addEventListener('click', newConversation);

    // Provider selector
    dom.providerSelect.addEventListener('change', (e) => {
        state.activeProviderId = e.target.value;
        saveState();
        checkProviderStatus();
        renderProviderCards();
    });

    // Settings modal
    dom.btnSettings.addEventListener('click', () => { renderProviderCards(); dom.settingsModal.classList.add('visible'); });
    dom.btnCloseSettings.addEventListener('click', () => { dom.settingsModal.classList.remove('visible'); saveSettings(); });
    dom.settingsModal.addEventListener('click', (e) => { if (e.target === dom.settingsModal) { dom.settingsModal.classList.remove('visible'); saveSettings(); } });

    // Tabs
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    dom.settingTemperature.addEventListener('input', (e) => dom.temperatureValue.textContent = e.target.value);
    dom.btnAddProvider.addEventListener('click', addCustomProvider);
    dom.btnRefreshMcp.addEventListener('click', refreshMcpTools);
    dom.btnExportConversations.addEventListener('click', exportConversations);
    dom.btnClearHistory.addEventListener('click', () => {
        if (confirm('Supprimer toutes les conversations ?')) {
            state.conversations = []; state.activeConversationId = null;
            saveState(); renderConversationsList(); updateChatView();
            dom.settingsModal.classList.remove('visible');
        }
    });

    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => { dom.messageInput.value = chip.dataset.prompt; autoResize(); sendMessage(); });
    });

    // Dashboard actions
    dom.btnRefreshStatus.addEventListener('click', loadDashboard);
    dom.btnRefreshLogs.addEventListener('click', loadLogs);
    dom.dashLogs.addEventListener('click', loadLogs);
    dom.actionWake.addEventListener('click', () => apiAction('/api/server/wake', 'Envoi du Wake-on-LAN...'));
    dom.actionStopMlx.addEventListener('click', () => {
        if (confirm('Arrêter le serveur MLX ?')) apiAction('/api/mlx/stop', 'Arrêt du serveur MLX...');
    });
    dom.actionSleep.addEventListener('click', () => {
        if (confirm('Mettre le Mac en veille ?')) apiAction('/api/server/sleep', 'Mise en veille...');
    });
    dom.actionReboot.addEventListener('click', () => {
        if (confirm('⚠️ Redémarrer le Mac ?')) apiAction('/api/server/reboot', 'Redémarrage...');
    });

    // Config
    dom.btnRefreshConfig.addEventListener('click', regenerateConfig);

    // Models filters
    dom.filterCategory.addEventListener('change', renderFilteredModels);
    dom.filterRam.addEventListener('change', renderFilteredModels);
}

// =================================================================
// Dashboard
// =================================================================
async function loadDashboard() {
    setDashStatus('loading', 'Vérification...');

    try {
        const res = await fetch('/api/status', { signal: AbortSignal.timeout(10000) });
        const data = await res.json();
        state.dashboardData = data;

        if (data.server_online) {
            setDashStatus('online', 'En ligne');
        } else {
            setDashStatus('offline', 'Hors ligne');
        }

        const hostAddr = data.host || 'mirza.local';
        dom.dashHost.textContent = hostAddr;
        // Don't fallback to host for IP if we just want IP
        dom.dashIp.textContent = data.hardware?.ip && data.hardware.ip !== hostAddr ? data.hardware.ip : (data.hardware?.ip || hostAddr);
        dom.dashApi.textContent = data.mlx_api ? `✓ Port ${data.api_port}` : '✗ Arrêté';
        dom.dashApi.style.color = data.mlx_api ? 'var(--color-success)' : 'var(--color-text-tertiary)';
        dom.dashGrafana.textContent = data.grafana ? '✓ Port 3000' : '✗ Arrêté';
        dom.dashGrafana.style.color = data.grafana ? 'var(--color-success)' : 'var(--color-text-tertiary)';

        if (data.server_online && !data.config_available && !window._hasTriedGenerateConfig) {
            window._hasTriedGenerateConfig = true;
            window._isGeneratingConfig = true;
            toast('Configuration manquante, génération automatique en cours...', 'info');
            regenerateConfig().then(() => {
                window._isGeneratingConfig = false;
                loadDashboard();
            });
        }

        if (window._isGeneratingConfig) {
            dom.dashChip.textContent = 'Génération...';
            dom.dashCpu.textContent = '...';
            dom.dashGpu.textContent = '...';
            dom.dashRam.textContent = '...';
        } else {
            dom.dashChip.textContent = data.hardware?.chip || '—';
            dom.dashCpu.textContent = data.hardware?.cpu_cores ? `${data.hardware.cpu_cores} cœurs` : '—';
            dom.dashGpu.textContent = data.hardware?.gpu_cores ? `${data.hardware.gpu_cores} cœurs` : '—';
            dom.dashRam.textContent = data.hardware?.ram_gb ? `${data.hardware.ram_gb} Go` : '—';
        }

        if (data.active_model) {
            const short = data.active_model.split('/').pop();
            dom.dashModelName.textContent = short;
            dom.dashModelSub.textContent = data.active_model;
        } else {
            dom.dashModelName.textContent = 'Aucun';
            dom.dashModelSub.textContent = data.mlx_api ? 'Aucun modèle chargé' : 'Serveur MLX arrêté';
        }

        // Update Grafana iframe (always use mirza.local for reliable access)
        const grafanaUrl = `http://${data.host || 'mirza.local'}:3000/d/ad5vxgh/mirza-monitor-lite?kiosk`;
        const iframe = document.getElementById('grafana-iframe');
        if (iframe && iframe.src !== grafanaUrl && iframe.src !== grafanaUrl + '/') {
            iframe.src = grafanaUrl;
        }

    } catch (e) {
        setDashStatus('offline', 'Erreur de connexion');
        console.error('Dashboard error:', e);
    }

    // Also load models catalog
    loadModelsCatalog();
}

function setDashStatus(status, text) {
    dom.dashServerStatus.innerHTML = `<div class="status-dot ${status}"></div><span>${text}</span>`;
}

async function loadLogs() {
    dom.dashLogs.textContent = 'Chargement...';
    try {
        const res = await fetch('/api/mlx/logs');
        const data = await res.json();
        dom.dashLogs.textContent = data.logs || 'Aucun log disponible';
    } catch (e) {
        dom.dashLogs.textContent = `Erreur: ${e.message}`;
    }
}

async function apiAction(endpoint, message) {
    toast(message, 'info');
    try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        if (data.ok !== false) {
            toast(data.message || 'Commande exécutée', 'success');
        } else {
            toast(data.error || 'Erreur', 'error');
        }
        setTimeout(loadDashboard, 3000);
    } catch (e) {
        toast(`Erreur: ${e.message}`, 'error');
    }
}

// =================================================================
// Models Catalog
// =================================================================
async function loadModelsCatalog() {
    try {
        dom.modelsGrid.innerHTML = `<div class="mcp-empty">Chargement des paramètres...</div>`;
        const res = await fetch('/api/models');
        const localData = await res.json();
        
        dom.modelsGrid.innerHTML = `<div class="mcp-empty">Interrogation de HuggingFace API (mlx-community)...</div>`;
        const hfRes = await fetch('https://huggingface.co/api/models?author=mlx-community&limit=100&sort=downloads&direction=-1');
        const hfModels = await hfRes.json();
        
        const catalog = [];
        for (const model of hfModels) {
            const hf_repo = model.id;
            const name_parts = hf_repo.split('/')[1] || hf_repo;
            
            // Extract Params 
            let parameters = "N/A";
            const paramMatch = name_parts.match(/(\d+(?:\.\d+)?[BT]|\d+x\d+(?:\.\d+)?[BT])/i);
            if (paramMatch) parameters = paramMatch[1].toUpperCase();

            // Extract Quantization
            let quantization = "Unknown";
            const quantMatch = name_parts.match(/(\d+bit)/i);
            if (quantMatch) quantization = quantMatch[1];
            
            let family = name_parts.split('-')[0];
            
            let paramsNum = parseFloat(parameters.replace('B','').replace('T','000'));
            if (parameters.includes('X')) {
                const parts = parameters.toLowerCase().split('x');
                paramsNum = parseFloat(parts[0]) * parseFloat(parts[1].replace('b',''));
            }
            if (isNaN(paramsNum)) paramsNum = 7;
            
            let bits = 8;
            if (quantization !== "Unknown") bits = parseInt(quantization.replace('bit',''));
            
            let size_gb = Math.round((paramsNum * (bits / 8) + 0.5) * 10) / 10;
            // OS Overhead 6GB + KV Cache Approx (1.5GB to 3GB)
            let kv_cache_gb = paramsNum > 15 ? 3 : 1.5;
            let min_ram_gb = Math.ceil(size_gb + kv_cache_gb + 6); 
            
            let cats = [];
            let tag = (model.pipeline_tag || "").toLowerCase();
            let nLower = name_parts.toLowerCase();
            if (tag.includes('vision') || tag.includes('image') || nLower.includes('vision') || nLower.includes('vl')) cats.push('multimodal');
            if (nLower.includes('coder') || nLower.includes('code') || nLower.includes('instruct-code')) cats.push('code');
            cats.push('general');
            if (nLower.includes('french') || nLower.includes('mistral') || nLower.includes('mixtral')) cats.push('french');
            
            catalog.push({
                hf_repo: hf_repo,
                name: name_parts,
                family: family,
                parameters: parameters,
                quantization: quantization,
                size_gb: size_gb,
                kv_cache_gb: kv_cache_gb,
                min_ram_gb: min_ram_gb,
                categories: cats,
                description: `Téléchargements: ${model.downloads.toLocaleString()} | Pipeline: ${model.pipeline_tag || "Non spécifié"}`,
                downloads: model.downloads
            });
        }
        
        localData.catalog = catalog;
        state.modelsCatalog = localData;
        populateFilters(localData);
        renderFilteredModels();
    } catch (e) {
        dom.modelsGrid.innerHTML = `<div class="mcp-empty">Erreur: ${escapeHtml(e.message)}</div>`;
    }
}

function populateFilters(data) {
    if (!data.categories) return;
    dom.filterCategory.innerHTML = '<option value="">Toutes catégories</option>';
    Object.entries(data.categories).forEach(([key, cat]) => {
        dom.filterCategory.innerHTML += `<option value="${key}">${cat.icon} ${cat.label}</option>`;
    });
    if (data.ram_tiers) {
        dom.filterRam.innerHTML = '<option value="">Toute RAM</option>';
        Object.entries(data.ram_tiers).forEach(([key, tier]) => {
            dom.filterRam.innerHTML += `<option value="${key}">${tier.label} (≤${tier.max_model_gb} Go modèle)</option>`;
        });
    }
}

function renderFilteredModels() {
    if (!state.modelsCatalog?.catalog) return;
    const catFilter = dom.filterCategory.value;
    const ramFilter = dom.filterRam.value;
    const categories = state.modelsCatalog.categories || {};
    const ramTiers = state.modelsCatalog.ram_tiers || {};

    let models = state.modelsCatalog.catalog;

    if (catFilter) {
        models = models.filter(m => m.categories?.includes(catFilter));
    }
    if (ramFilter && ramTiers[ramFilter]) {
        const maxGb = ramTiers[ramFilter].max_model_gb;
        models = models.filter(m => m.size_gb <= maxGb);
    }

    if (models.length === 0) {
        dom.modelsGrid.innerHTML = '<div class="mcp-empty">Aucun modèle correspondant aux filtres</div>';
        return;
    }

    dom.modelsGrid.innerHTML = '';
    models.forEach(m => {
        let isRecommended = m.recommended || false;
        let isUnsupported = false;
        let warningText = '';
        
        const macRam = state.dashboardData?.hardware?.ram_gb;
        const chip = state.dashboardData?.hardware?.chip || "";
        
        // Calculate Tok/s
        let bandwidth = 100; // Base M1/M2/M3
        if (/Max/i.test(chip)) bandwidth = 400;
        else if (/Pro/i.test(chip)) bandwidth = 200;
        else if (/Ultra/i.test(chip)) bandwidth = 800;
        else if (/M4/i.test(chip)) bandwidth = 120;
        if (/M4 Pro/i.test(chip)) bandwidth = 273;
        if (/M4 Max/i.test(chip)) bandwidth = 546;
        
        let estimatedToks = Math.round(bandwidth / (m.size_gb || 1));
        
        if (macRam) {
            // Note: OS requires 6GB overhead min_ram_gb includes it now
            if (macRam < m.min_ram_gb) {
                isUnsupported = true;
                isRecommended = false;
                warningText = `<span class="model-tag" style="background:var(--color-danger);color:white">RAM Incompatible (${m.min_ram_gb}Go req. OS Inclus)</span>`;
            } else {
                if (macRam - m.min_ram_gb <= 12 && macRam - m.min_ram_gb >= 0) {
                    isRecommended = true;
                }
            }
        }

        const card = document.createElement('div');
        card.className = `model-card${isRecommended ? ' recommended' : ''}${isUnsupported ? ' unsupported' : ''}`;
        if(isUnsupported) card.style.opacity = "0.4";

        const catTags = (m.categories || []).map(c => {
            const cat = categories[c];
            return `<span class="model-tag">${cat ? cat.icon : ''} ${cat ? cat.label : c}</span>`;
        }).join('');

        card.innerHTML = `
            <div class="model-card-header">
                <div class="model-card-name" style="word-break: break-all; font-size: 0.9em;">${escapeHtml(m.name)}</div>
                ${isRecommended ? '<span class="model-tag star">⭐ Optimisé Mac</span>' : ''}
            </div>
            <div class="model-card-family">${escapeHtml(m.family)} · ${m.parameters} · ${m.quantization}</div>
            <div class="model-card-desc">${escapeHtml(m.description)}</div>
            <div class="model-card-meta" style="flex-wrap: wrap;">
                <span class="model-tag size">Poids: ${m.size_gb} Go</span>
                <span class="model-tag size" style="color:var(--color-success)">KV Cache: ${m.kv_cache_gb} Go</span>
                <span class="model-tag">RAM OS: 6.0 Go</span>
            </div>
            <div class="model-card-meta" style="flex-wrap: wrap; margin-top: 4px;">    
                <span class="model-tag star">⚡ ~${estimatedToks} tok/s</span>
                <span class="model-tag">⚙️ Flash Attention</span>
                <span class="model-tag">⚙️ Paged Attention</span>
            </div>
            <div class="model-card-meta" style="margin-top:4px;">
                ${catTags}
                ${warningText}
            </div>
            <div class="model-card-footer">
                <span class="model-card-stats">↓ ${(m.downloads || 0).toLocaleString()}</span>
                <div style="display:flex;gap:6px;">
                    <button class="model-btn model-btn-deploy" ${isUnsupported ? 'disabled style="cursor:not-allowed;"' : ''} onclick="deployModel('${escapeHtml(m.hf_repo)}')">Télécharger</button>
                    <button class="model-btn model-btn-serve" ${isUnsupported ? 'disabled style="cursor:not-allowed;"' : ''} onclick="serveModel('${escapeHtml(m.hf_repo)}')">Servir</button>
                </div>
            </div>
        `;
        dom.modelsGrid.appendChild(card);
    });
}

async function deployModel(hfRepo) {
    toast(`Déploiement de ${hfRepo.split('/').pop()}...`, 'info');
    try {
        const res = await fetch('/api/mlx/deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hf_repo: hfRepo })
        });
        const data = await res.json();
        toast(data.ok ? 'Modèle téléchargé !' : (data.error || 'Erreur'), data.ok ? 'success' : 'error');
    } catch (e) {
        toast(`Erreur: ${e.message}`, 'error');
    }
}

async function serveModel(hfRepo) {
    toast(`Démarrage de ${hfRepo.split('/').pop()}...`, 'info');
    try {
        const res = await fetch('/api/mlx/serve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: hfRepo })
        });
        const data = await res.json();
        toast(data.message || 'Serveur démarré', data.ok ? 'success' : 'error');
        setTimeout(loadDashboard, 5000);
    } catch (e) {
        toast(`Erreur: ${e.message}`, 'error');
    }
}

window.deployModel = deployModel;
window.serveModel = serveModel;

// =================================================================
// Config
// =================================================================
async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.config) {
            renderConfig(data.config);
        } else {
            dom.configContainer.innerHTML = `<div class="mcp-empty">${data.error || 'Configuration introuvable'}</div>`;
        }
    } catch (e) {
        dom.configContainer.innerHTML = `<div class="mcp-empty">Erreur: ${escapeHtml(e.message)}</div>`;
    }
}

function renderConfig(config) {
    dom.configContainer.innerHTML = '';
    Object.entries(config).forEach(([section, entries]) => {
        const el = document.createElement('div');
        el.className = 'config-section';
        let rows = '';
        Object.entries(entries).forEach(([key, val]) => {
            rows += `<div class="config-row"><span class="config-key">${escapeHtml(key)}</span><span class="config-val">${escapeHtml(val)}</span></div>`;
        });
        el.innerHTML = `<div class="config-section-header">${escapeHtml(section)}</div><div class="config-rows">${rows}</div>`;
        dom.configContainer.appendChild(el);
    });
}

async function regenerateConfig() {
    toast('Régénération de la config via SSH...', 'info');
    dom.btnRefreshConfig.disabled = true;
    try {
        const res = await fetch('/api/config/refresh', { method: 'POST' });
        const data = await res.json();
        if (data.ok && data.config) {
            renderConfig(data.config);
            toast('Configuration mise à jour !', 'success');
        } else {
            toast(data.error || 'Erreur', 'error');
        }
    } catch (e) {
        toast(`Erreur: ${e.message}`, 'error');
    }
    dom.btnRefreshConfig.disabled = false;
}

// =================================================================
// Provider Management
// =================================================================
function renderProviderSelect() {
    dom.providerSelect.innerHTML = '';
    state.providers.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name;
        opt.selected = p.id === state.activeProviderId;
        dom.providerSelect.appendChild(opt);
    });
}

function renderProviderCards() {
    dom.providersList.innerHTML = '';
    state.providers.forEach(p => {
        const isActive = p.id === state.activeProviderId;
        const typeClass = p.type || 'custom';
        const typeLabel = { local: 'Local', cloud: 'Cloud', custom: 'Custom' }[typeClass] || 'Custom';
        const isBuiltin = DEFAULT_PROVIDERS.some(dp => dp.id === p.id);

        const card = document.createElement('div');
        card.className = `provider-card${isActive ? ' active-provider' : ''}`;
        card.dataset.providerId = p.id;
        card.innerHTML = `
            <div class="provider-card-header">
                <div class="provider-card-name">
                    <span>${escapeHtml(p.name)}</span>
                    <span class="provider-type-badge ${typeClass}">${typeLabel}</span>
                    ${isActive ? '<span class="provider-type-badge local" style="font-size:10px">ACTIF</span>' : ''}
                </div>
                <div class="provider-card-actions">
                    ${!isActive ? `<button class="btn-icon btn-icon-sm" onclick="setActiveProvider('${p.id}')" title="Activer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></button>` : ''}
                    ${!isBuiltin ? `<button class="btn-icon btn-icon-sm" onclick="deleteProvider('${p.id}')" title="Supprimer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>` : ''}
                </div>
            </div>
            <div class="provider-card-fields">
                <div class="provider-field"><label>Endpoint</label><input type="text" value="${escapeHtml(p.endpoint)}" data-field="endpoint" /></div>
                <div class="provider-field"><label>Clé API</label><input type="password" value="${escapeHtml(p.apiKey || '')}" data-field="apiKey" placeholder="${p.type === 'local' ? 'Optionnelle' : 'sk-...'}" /></div>
                <div class="provider-field"><label>Modèle</label><input type="text" value="${escapeHtml(p.model || '')}" data-field="model" placeholder="Auto-détection" /></div>
            </div>
        `;
        dom.providersList.appendChild(card);
    });
}

function saveProvidersFromCards() {
    document.querySelectorAll('.provider-card').forEach(card => {
        const p = state.providers.find(pr => pr.id === card.dataset.providerId);
        if (!p) return;
        card.querySelectorAll('[data-field]').forEach(input => p[input.dataset.field] = input.value);
    });
    renderProviderSelect();
}

function addCustomProvider() {
    state.providers.push({ id: 'custom_' + Date.now(), name: 'Custom', type: 'custom', endpoint: 'http://localhost:8080', apiKey: '', model: '' });
    saveState(); renderProviderSelect(); renderProviderCards();
}

function deleteProvider(id) {
    state.providers = state.providers.filter(p => p.id !== id);
    if (state.activeProviderId === id) state.activeProviderId = state.providers[0]?.id || 'mirza-local';
    saveState(); renderProviderSelect(); renderProviderCards();
}

function setActiveProvider(id) {
    state.activeProviderId = id;
    dom.providerSelect.value = id;
    saveState(); checkProviderStatus(); renderProviderCards();
}

window.setActiveProvider = setActiveProvider;
window.deleteProvider = deleteProvider;

function saveSettings() {
    state.settings.temperature = parseFloat(dom.settingTemperature.value);
    state.settings.maxTokens = parseInt(dom.settingMaxTokens.value);
    state.settings.systemPrompt = dom.settingSystemPrompt.value;
    state.settings.mcpEndpoint = dom.settingMcpEndpoint.value.replace(/\/+$/, '');
    saveProvidersFromCards();
    saveState();
    checkProviderStatus();
}

// =================================================================
// Provider Status (Chat sidebar)
// =================================================================
async function checkProviderStatus() {
    dom.providerStatusDot.className = 'status-dot loading';
    const provider = getActiveProvider();
    const headers = {};
    if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

    try {
        const res = await fetch(`${provider.endpoint}/v1/models`, { headers, signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const data = await res.json();
            dom.providerStatusDot.className = 'status-dot online';
            dom.modelSelect.innerHTML = '';
            if (provider.model) {
                dom.modelSelect.innerHTML += `<option value="${escapeHtml(provider.model)}">${escapeHtml(provider.model)}</option>`;
            }
            if (data.data) {
                data.data.forEach(m => {
                    if (m.id === provider.model) return;
                    dom.modelSelect.innerHTML += `<option value="${escapeHtml(m.id)}" title="${escapeHtml(m.id)}">${escapeHtml(m.id.split('/').pop())}</option>`;
                });
            }
            if (provider.model) dom.modelSelect.value = provider.model;
        } else throw new Error();
    } catch {
        dom.providerStatusDot.className = 'status-dot offline';
        dom.modelSelect.innerHTML = provider.model ? `<option value="${escapeHtml(provider.model)}">${escapeHtml(provider.model)} (hors ligne)</option>` : '<option>Hors ligne</option>';
    }
}

// =================================================================
// MCP Tools
// =================================================================
async function refreshMcpTools() {
    const ep = dom.settingMcpEndpoint.value.replace(/\/+$/, '');
    if (!ep) { dom.mcpToolsList.innerHTML = '<div class="mcp-empty">Aucun endpoint configuré</div>'; return; }
    dom.mcpToolsList.innerHTML = '<div class="mcp-empty">Connexion...</div>';
    try {
        const res = await fetch(`${ep}/tools`, { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        const tools = data.tools || data || [];
        state.settings.mcpTools = tools;
        if (!tools.length) { dom.mcpToolsList.innerHTML = '<div class="mcp-empty">Aucun outil</div>'; return; }
        dom.mcpToolsList.innerHTML = '';
        tools.forEach(t => {
            const item = document.createElement('div');
            item.className = 'mcp-tool-item';
            item.innerHTML = `<div class="tool-icon">🔧</div><div class="tool-info"><div class="tool-name">${escapeHtml(t.name)}</div><div class="tool-desc">${escapeHtml(t.description || '')}</div></div><input type="checkbox" class="mcp-tool-toggle" ${state.settings.mcpEnabled[t.name] !== false ? 'checked' : ''} data-tool="${escapeHtml(t.name)}" />`;
            item.querySelector('.mcp-tool-toggle').addEventListener('change', (e) => { state.settings.mcpEnabled[e.target.dataset.tool] = e.target.checked; saveState(); });
            dom.mcpToolsList.appendChild(item);
        });
    } catch (e) {
        dom.mcpToolsList.innerHTML = `<div class="mcp-empty">Erreur: ${escapeHtml(e.message)}</div>`;
    }
}

// =================================================================
// Chat — Conversations
// =================================================================
function newConversation() {
    state.activeConversationId = null;
    updateChatView();
    dom.messageInput.focus();
}

function createConversation(firstMsg) {
    const conv = { id: 'conv_' + Date.now(), title: firstMsg.substring(0, 50) + (firstMsg.length > 50 ? '...' : ''), messages: [], providerId: getActiveProvider().id, providerName: getActiveProvider().name, createdAt: new Date().toISOString() };
    state.conversations.unshift(conv);
    state.activeConversationId = conv.id;
    saveState(); renderConversationsList();
    return conv;
}

function getActiveConversation() { return state.conversations.find(c => c.id === state.activeConversationId); }

function deleteConversation(id) {
    state.conversations = state.conversations.filter(c => c.id !== id);
    if (state.activeConversationId === id) { state.activeConversationId = null; updateChatView(); }
    saveState(); renderConversationsList();
}

function switchConversation(id) {
    state.activeConversationId = id;
    saveState(); renderConversationsList(); updateChatView(); renderMessages();
}

function renderConversationsList() {
    dom.conversationsList.innerHTML = '';
    if (!state.conversations.length) {
        dom.conversationsList.innerHTML = '<div style="padding:12px;color:var(--color-text-tertiary);font-size:var(--text-sm);text-align:center">Aucune conversation</div>';
        return;
    }
    state.conversations.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'conversation-item' + (c.id === state.activeConversationId ? ' active' : '');
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="conv-title">${escapeHtml(c.title)}</span><button class="conv-delete" title="Supprimer" onclick="event.stopPropagation();deleteConversation('${c.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
        btn.addEventListener('click', () => switchConversation(c.id));
        dom.conversationsList.appendChild(btn);
    });
}

function exportConversations() {
    const blob = new Blob([JSON.stringify(state.conversations, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `mirza-conversations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
}

function autoResize() {
    const el = dom.messageInput; el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

// =================================================================
// Chat — View
// =================================================================
function updateChatView() {
    const conv = getActiveConversation();
    if (!conv || !conv.messages.length) {
        dom.welcomeScreen.style.display = 'flex';
        dom.messagesContainer.classList.remove('visible');
    } else {
        dom.welcomeScreen.style.display = 'none';
        dom.messagesContainer.classList.add('visible');
    }
}

// =================================================================
// Chat — Messages
// =================================================================
function renderMessages() {
    const conv = getActiveConversation(); if (!conv) return;
    dom.messagesScroll.innerHTML = '';
    conv.messages.forEach((m, i) => appendMessageToDOM(m, i));
    scrollToBottom();
}

function appendMessageToDOM(msg, index) {
    const el = document.createElement('div');
    el.className = `message ${msg.role}`; el.id = `msg-${index}`;
    const isU = msg.role === 'user';
    const content = isU ? `<p>${escapeHtml(msg.content)}</p>` : renderMarkdown(msg.content);
    el.innerHTML = `
        <div class="message-header"><div class="message-avatar">${isU ? '👤' : '◈'}</div><span class="message-sender">${isU ? 'Vous' : escapeHtml(getActiveProvider().name)}</span></div>
        <div class="message-content">${content}</div>
        ${!isU ? `<div class="message-actions"><button class="message-action-btn" onclick="copyMessageContent(${index})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copier</button></div>${msg.meta ? `<div class="message-meta">${msg.meta}</div>` : ''}` : ''}
    `;
    dom.messagesScroll.appendChild(el);
    enhanceCodeBlocks(el);
}

function createStreamingMessage() {
    const el = document.createElement('div');
    el.className = 'message assistant';
    el.innerHTML = `<div class="message-header"><div class="message-avatar">◈</div><span class="message-sender">${escapeHtml(getActiveProvider().name)}</span></div><div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    dom.messagesScroll.appendChild(el); scrollToBottom();
    return el;
}

function updateStreamingMessage(el, content) {
    el.querySelector('.message-content').innerHTML = renderMarkdown(content) + '<span class="streaming-cursor"></span>';
    enhanceCodeBlocks(el); scrollToBottom();
}

function finalizeStreamingMessage(el, content, meta, index) {
    const ce = el.querySelector('.message-content');
    ce.innerHTML = renderMarkdown(content); enhanceCodeBlocks(el);
    ce.insertAdjacentHTML('afterend', `<div class="message-actions"><button class="message-action-btn" onclick="copyMessageContent(${index})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copier</button></div>${meta ? `<div class="message-meta">${meta}</div>` : ''}`);
    scrollToBottom();
}

// =================================================================
// Chat — Send
// =================================================================
async function sendMessage() {
    const input = dom.messageInput.value.trim();
    if (!input || state.isStreaming) return;
    if (state.currentView !== 'chat') switchView('chat');

    let conv = getActiveConversation();
    if (!conv) conv = createConversation(input);
    conv.messages.push({ role: 'user', content: input });
    saveState(); updateChatView(); renderMessages();
    dom.messageInput.value = ''; dom.messageInput.style.height = 'auto';

    state.isStreaming = true; dom.btnSend.disabled = true;
    const streamEl = createStreamingMessage();

    try {
        const t0 = performance.now();
        let full = '', tokens = 0;
        const provider = getActiveProvider();
        const msgs = [];
        if (state.settings.systemPrompt) msgs.push({ role: 'system', content: state.settings.systemPrompt });
        conv.messages.forEach(m => msgs.push({ role: m.role, content: m.content }));

        const hdrs = { 'Content-Type': 'application/json' };
        if (provider.apiKey) hdrs['Authorization'] = `Bearer ${provider.apiKey}`;

        const body = { model: dom.modelSelect.value || provider.model || 'default', messages: msgs, max_tokens: state.settings.maxTokens, temperature: state.settings.temperature, stream: true };

        const enabledTools = state.settings.mcpTools.filter(t => state.settings.mcpEnabled[t.name] !== false);
        if (state.settings.mcpEndpoint && enabledTools.length) {
            body.tools = enabledTools.map(t => ({ type: 'function', function: { name: t.name, description: t.description || '', parameters: t.inputSchema || t.parameters || {} } }));
        }

        state.abortController = new AbortController();
        const res = await fetch(`${provider.endpoint}/v1/chat/completions`, { method: 'POST', headers: hdrs, body: JSON.stringify(body), signal: state.abortController.signal });
        if (!res.ok) { const err = await res.text(); throw new Error(`${res.status}: ${err.substring(0, 200)}`); }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n'); buf = lines.pop();
            for (const line of lines) {
                const t = line.trim();
                if (!t || !t.startsWith('data: ')) continue;
                const d = t.slice(6); if (d === '[DONE]') continue;
                try { const p = JSON.parse(d); const delta = p.choices?.[0]?.delta?.content; if (delta) { full += delta; tokens++; updateStreamingMessage(streamEl, full); } } catch {}
            }
        }

        const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
        const tps = tokens > 0 ? (tokens / elapsed).toFixed(1) : '?';
        const meta = `${tokens} tokens · ${elapsed}s · ~${tps} tok/s · ${provider.name}`;
        conv.messages.push({ role: 'assistant', content: full, meta });
        saveState();
        if (conv.messages.length === 2) { conv.title = input.substring(0, 50) + (input.length > 50 ? '...' : ''); saveState(); renderConversationsList(); }
        finalizeStreamingMessage(streamEl, full, meta, conv.messages.length - 1);

    } catch (e) {
        if (e.name === 'AbortError') {
            streamEl.querySelector('.message-content').innerHTML = '<p><em>Annulé.</em></p>';
        } else {
            streamEl.querySelector('.message-content').innerHTML = `<p style="color:var(--color-error)">⚠️ ${escapeHtml(e.message)}</p>`;
        }
    } finally {
        state.isStreaming = false; state.abortController = null;
        dom.btnSend.disabled = false; dom.messageInput.focus();
    }
}

// =================================================================
// Markdown & Code
// =================================================================
function renderMarkdown(text) {
    if (!text) return '';
    marked.setOptions({ breaks: true, gfm: true, highlight: (code, lang) => {
        if (lang && hljs.getLanguage(lang)) try { return hljs.highlight(code, { language: lang }).value; } catch {}
        return hljs.highlightAuto(code).value;
    }});
    return marked.parse(text);
}

function enhanceCodeBlocks(container) {
    container.querySelectorAll('pre code').forEach(block => {
        if (block.parentElement.parentElement.querySelector('.code-block-header')) return;
        const pre = block.parentElement;
        const lang = (block.className.match(/language-(\w+)/) || [])[1] || '';
        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = `<span>${lang || 'code'}</span><button class="btn-copy" onclick="copyCode(this, \`${btoa(encodeURIComponent(block.textContent))}\`)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copier</button>`;
        pre.insertBefore(header, block);
    });
}

// =================================================================
// Utilities
// =================================================================
function scrollToBottom() { requestAnimationFrame(() => dom.messagesScroll.scrollTop = dom.messagesScroll.scrollHeight); }
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function copyCode(btn, enc) { navigator.clipboard.writeText(decodeURIComponent(atob(enc))).then(() => { btn.innerHTML = '✓ Copié'; setTimeout(() => { btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copier'; }, 2000); }); }
function copyMessageContent(i) { const c = getActiveConversation(); if (c?.messages[i]) navigator.clipboard.writeText(c.messages[i].content); }

window.copyCode = copyCode;
window.deleteConversation = deleteConversation;
window.copyMessageContent = copyMessageContent;

// =================================================================
// Boot — observe view changes for lazy loading
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    init();
    // Lazy-load views on first navigation
    const observer = new MutationObserver(() => {
        if (state.currentView === 'config' && dom.configContainer.children.length <= 1) loadConfig();
        if (state.currentView === 'models' && !state.modelsCatalog) loadModelsCatalog();
    });
    observer.observe(document.getElementById('main-content'), { childList: true, subtree: true, attributes: true });
});
