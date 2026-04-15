/* ═══════════════════════════════════════════════════════════════
   Mirza AI — Station Control Panel
   Dashboard, Chat, Models Catalog, Config — mirrors mirza CLI
   ═══════════════════════════════════════════════════════════════ */

// =================================================================
// Default Providers (for chat)
// =================================================================
const DEFAULT_PROVIDERS = [
    { id: 'mirza-local', name: 'Mirza (Llama.cpp)', type: 'local', endpoint: 'http://localhost:8080', apiKey: '', model: '' },
    { id: 'openai', name: 'OpenAI', type: 'cloud', endpoint: 'https://api.openai.com', apiKey: '', model: 'gpt-4o-mini' },
    { id: 'anthropic-openai', name: 'Anthropic', type: 'cloud', endpoint: 'https://api.anthropic.com/v1', apiKey: '', model: 'claude-sonnet-4-20250514' },
    { id: 'groq', name: 'Groq', type: 'cloud', endpoint: 'https://api.groq.com/openai', apiKey: '', model: 'llama-3.3-70b-versatile' },
    { id: 'mistral', name: 'Mistral AI', type: 'cloud', endpoint: 'https://api.mistral.ai', apiKey: '', model: 'mistral-small-latest' },
    { id: 'google', name: 'Google (Gemini)', type: 'cloud', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: '', model: 'gemini-2.0-flash' },
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
    installedModels: [],
    modelsTab: 'all',
    activeOrgs: new Set(['ggml-org']),   // Which orgs to fetch — toggled by org chips
    dashboardData: null,
    isDownloading: false,
    downloadInterval: null,
    selectedInferenceModel: null, // Model path currently targeted for serving
    inferenceConfig: {
        ctx: 8192,
        kv_q: 'q8_0',
        flash_attn: true,
        mlock: true, 
        warmup: false,
        chat_format: '',
        tune: false,
        trials: 25,
        metric: 'tg'
    },
    settings: {
        // Sampling parameters (OpenAI compatible)
        temperature: 0.7,
        top_p: 1.0,
        top_n: 40,
        max_tokens: 4096,
        // Repetition control
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        repetition_penalty: 1.1,
        // Stop sequences
        stop: null,
        // Response format
        response_format: null,
        // Seed for deterministic sampling
        seed: null,
        // Tool/function calling
        tools: null,
        tool_choice: "auto",
        // Logit bias (sent as object)
        logit_bias: null,
        // System prompt
        systemPrompt: 'Tu es Mirza, un assistant IA intelligent et serviable. Tu réponds de manière claire, précision et concise en français.',
        // MCP
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
        'setting-temperature', 'temperature-value',
        'setting-top-p', 'top-p-value',
        'setting-repetition-penalty', 'repetition-penalty-value',
        'setting-top-n', 'setting-stop',
        'setting-presence-penalty', 'presence-penalty-value',
        'setting-frequency-penalty', 'frequency-penalty-value',
        'setting-max-tokens', 'setting-system-prompt',
        'setting-mcp-endpoint',
        'mcp-tools-list', 'btn-refresh-mcp',
        'btn-clear-history', 'btn-export-conversations', 'btn-add-provider',
        'providers-list', 'link-grafana', 'toast-container',
        'btn-refresh-status', 'btn-refresh-logs', 'btn-refresh-config',
        'dash-server-status', 'dash-host', 'dash-ip', 'dash-api', 'dash-grafana',
        'mcp-search', 'mcp-family', 'mcp-category', 'mcp-ram', 'mcp-sort',
        'modal-inference-options', 'overlay-inference', 'btn-close-inference', 'btn-start-serve',
        'option-kv-q', 'option-flash-attn', 'option-mlock', 'option-warmup', 'option-chat-format',
        'global-download-progress', 'download-percent', 'download-progress-bar', 'download-status-text',
        'dash-chip', 'dash-cpu', 'dash-gpu', 'dash-ram',
        'dash-model-name', 'dash-model-sub', 'dash-logs',
        'dashboard-grid', 'models-grid', 'config-container',
        'filter-category', 'filter-ram',
        'action-wake', 'action-stop-llm', 'action-sleep', 'action-reboot',
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
    dom.btnStop = document.getElementById('btn-stop');
    dom.btnNewChat = document.getElementById('btn-new-chat');
    dom.providerSelect = document.getElementById('provider-select');
    dom.modelSelect = document.getElementById('model-select');
    dom.providerStatusDot = document.getElementById('provider-status-dot');
    dom.tokenCounter = document.getElementById('token-counter');
    dom.contextProgress = document.getElementById('context-progress');
    dom.contextProgressFill = document.getElementById('context-progress-fill');
    dom.contextProgressText = document.getElementById('context-progress-text');
    dom.settingsModal = document.getElementById('settings-modal');
    dom.btnSettings = document.getElementById('btn-settings');
    dom.btnCloseSettings = document.getElementById('btn-close-settings');
    dom.settingTemperature = document.getElementById('setting-temperature');
    dom.temperatureValue = document.getElementById('temperature-value');
    dom.settingMaxTokens = document.getElementById('setting-max-tokens');
    dom.settingTopN = document.getElementById('setting-top-n');
    dom.settingStop = document.getElementById('setting-stop');
    dom.settingPresencePenalty = document.getElementById('setting-presence-penalty');
    dom.presencePenaltyValue = document.getElementById('presence-penalty-value');
    dom.settingFrequencyPenalty = document.getElementById('setting-frequency-penalty');
    dom.frequencyPenaltyValue = document.getElementById('frequency-penalty-value');
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
    dom.vramMonitor = document.getElementById('vram-monitor');
    dom.vramTotalValue = document.getElementById('vram-total-value');
    dom.vramBarWeights = document.getElementById('vram-bar-weights');
    dom.vramBarKv = document.getElementById('vram-bar-kv');
    dom.vramBarCompute = document.getElementById('vram-bar-compute');
    dom.vramLblWeights = document.getElementById('vram-lbl-weights');
    dom.vramLblKv = document.getElementById('vram-lbl-kv');
    dom.vramLblCompute = document.getElementById('vram-lbl-compute');
    dom.vramOsRam = document.getElementById('vram-os-ram');
    dom.vramOsRamValue = document.getElementById('vram-total-ram-value');
    dom.vramOsRamSys = document.getElementById('vram-os-ram-sys');
    dom.vramOsRamSysValue = document.getElementById('vram-os-ram-sys-value');
    dom.grafanaIframe = document.getElementById('grafana-iframe');
    dom.dashMetalBadge = document.getElementById('dash-metal-badge');
    dom.btnRefreshLogs = document.getElementById('btn-refresh-logs');
    dom.checkAutoLogs = document.getElementById('check-auto-logs');
    dom.modelsGrid = document.getElementById('models-grid');
    dom.configContainer = document.getElementById('config-container');
    dom.filterCategory = document.getElementById('filter-category');
    dom.filterFamily = document.getElementById('filter-family');
    dom.filterRam = document.getElementById('filter-ram');
    dom.filterSort = document.getElementById('filter-sort');
    dom.filterSearch = document.getElementById('filter-search');
    dom.tabModelsAll = document.getElementById('tab-models-all');
    dom.tabModelsInstalled = document.getElementById('tab-models-installed');
    dom.tabModelsTop10 = document.getElementById('tab-models-top10');
    dom.actionWake = document.getElementById('action-wake');
    dom.actionStopLlm = document.getElementById('action-stop-llm');
    dom.actionSleep = document.getElementById('action-sleep');
    dom.actionReboot = document.getElementById('action-reboot');
    dom.perfKvCache = document.getElementById('perf-kv-cache');
    dom.perfPrefillStep = document.getElementById('perf-prefill-step');

    // New Download Activity Widget
    dom.dashSectionDownload = document.getElementById('dash-section-download');
    dom.dashDownloadLabel = document.getElementById('dash-download-label');
    dom.dashDownloadPercent = document.getElementById('dash-download-percent');
    dom.dashDownloadProgressBar = document.getElementById('dash-download-progress-bar');
    dom.dashDownloadLogs = document.getElementById('dash-download-logs');
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
    startGlobalScheduler();
}

function loadState() {
    try { const s = localStorage.getItem('mirza_conversations'); if (s) state.conversations = JSON.parse(s); } catch (e) { }
    try { const s = localStorage.getItem('mirza_settings'); if (s) Object.assign(state.settings, JSON.parse(s)); } catch (e) { }
    try { const s = localStorage.getItem('mirza_providers'); state.providers = s ? JSON.parse(s) : JSON.parse(JSON.stringify(DEFAULT_PROVIDERS)); } catch (e) { state.providers = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS)); }
    
    // Migration: clean up old MLX references in provider names
    state.providers = state.providers.map(p => {
        if (p.name && p.name.includes('MLX')) {
            return { ...p, name: p.name.replace(/MLX/g, 'Llama.cpp').replace(/Local/g, 'Local Llama.cpp') };
        }
        if (p.id === 'mirza-local' && (!p.name || p.name.includes('MLX'))) {
            return { ...p, name: 'Mirza (Llama.cpp)' };
        }
        return p;
    });
    
    state.activeProviderId = localStorage.getItem('mirza_active_provider') || 'mirza-local';
    state.activeConversationId = localStorage.getItem('mirza_active_conversation');

    // Load from state.settings (new naming)
    dom.settingTemperature.value = state.settings.temperature || 0.7;
    dom.temperatureValue.textContent = state.settings.temperature || 0.7;
    if (dom.settingTopP) {
        dom.settingTopP.value = state.settings.top_p || 0.95;
        dom.topPValue.textContent = state.settings.top_p || 0.95;
    }
    if (dom.settingTopN) {
        dom.settingTopN.value = state.settings.top_n || 40;
    }
    if (dom.settingPresencePenalty) {
        dom.settingPresencePenalty.value = state.settings.presence_penalty || 0;
        dom.presencePenaltyValue.textContent = state.settings.presence_penalty || 0;
    }
    if (dom.settingFrequencyPenalty) {
        dom.settingFrequencyPenalty.value = state.settings.frequency_penalty || 0;
        dom.frequencyPenaltyValue.textContent = state.settings.frequency_penalty || 0;
    }
    if (dom.settingStop) {
        dom.settingStop.value = (state.settings.stop || []).join(', ');
    }
    if (dom.settingMaxTokens) {
        dom.settingMaxTokens.value = state.settings.max_tokens || 4096;
    }
    if (dom.settingSystemPrompt) {
        dom.settingSystemPrompt.value = state.settings.systemPrompt || '';
    }
    if (dom.settingMcpEndpoint) {
        dom.settingMcpEndpoint.value = state.settings.mcpEndpoint || '';
    }
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

    if (viewName === 'config' && dom.configContainer.children.length <= 1) loadConfig();
    if (viewName === 'models' && !state.modelsCatalog) loadModelsCatalog();

    // Auto-load dashboard data + logs when switching to dashboard
    if (viewName === 'dashboard') {
        loadDashboard(); // Debounced call
    }
    
    if (viewName === 'monitoring') {
        initMonitoring();
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

    // IP visibility toggle
    const toggleIpBtn = document.getElementById('toggle-ip-btn');
    if (toggleIpBtn) {
        let ipVisible = false;
        toggleIpBtn.addEventListener('click', () => {
            ipVisible = !ipVisible;
            if (ipVisible) {
                dom.dashIp.textContent = dom.dashIp.dataset.value;
                dom.dashIp.classList.remove('obscured-ip');
                document.getElementById('eye-icon-closed').style.display = 'none';
                document.getElementById('eye-icon-open').style.display = 'block';
            } else {
                dom.dashIp.textContent = '••••••••••••';
                dom.dashIp.classList.add('obscured-ip');
                document.getElementById('eye-icon-closed').style.display = 'block';
                document.getElementById('eye-icon-open').style.display = 'none';
            }
        });
    }

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
    dom.btnStop.addEventListener('click', () => {
        if (state.abortController) {
            state.abortController.abort();
            dom.btnStop.style.display = 'none';
            dom.btnSend.style.display = 'flex';
        }
    });
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
    if (dom.settingTopP) {
        dom.settingTopP.addEventListener('input', (e) => dom.topPValue.textContent = e.target.value);
    }
    if (dom.settingRepetitionPenalty) {
        dom.settingRepetitionPenalty.addEventListener('input', (e) => dom.repetitionPenaltyValue.textContent = e.target.value);
    }
    // New penalty settings
    if (dom.settingPresencePenalty) {
        dom.settingPresencePenalty.addEventListener('input', (e) => dom.presencePenaltyValue.textContent = e.target.value);
    }
    if (dom.settingFrequencyPenalty) {
        dom.settingFrequencyPenalty.addEventListener('input', (e) => dom.frequencyPenaltyValue.textContent = e.target.value);
    }
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
    dom.btnRefreshLogs.addEventListener('click', () => loadLogs(false));
    // Removed: click-to-refresh on logs area to avoid interfering with reading
    // Clear logs button (clears display only, not the file on server)
    const btnClearLogs = document.getElementById('btn-clear-logs');
    if (btnClearLogs) {
        btnClearLogs.addEventListener('click', () => {
            dom.dashLogs.innerHTML = '<span style="color:#555">Affichage effacé. Cliquer pour recharger.</span>';
        });
    }
    dom.actionWake.addEventListener('click', () => apiAction('/api/server/wake', 'Envoi du Wake-on-LAN...'));
    dom.actionStopLlm.addEventListener('click', () => {
        if (confirm('Stop the inference server?')) apiAction('/api/llm/stop', 'Stopping server...');
    });
    dom.actionSleep.addEventListener('click', () => {
        const pwd = prompt('Mot de passe administrateur du Mac requis pour la mise en veille :');
        if (pwd !== null) {
            apiAction('/api/server/sleep', 'Entering sleep mode...', { sudoAsk: pwd });
        }
    });
    dom.actionReboot.addEventListener('click', () => {
        const pwd = prompt('Mot de passe administrateur du Mac requis pour le redémarrage :');
        if (pwd !== null) {
            apiAction('/api/server/reboot', 'Rebooting station...', { sudoAsk: pwd });
        }
    });

    // Config
    dom.btnRefreshConfig.addEventListener('click', regenerateConfig);

    // Models filters
    dom.filterCategory.addEventListener('change', renderFilteredModels);
    if (dom.filterFamily) dom.filterFamily.addEventListener('change', renderFilteredModels);
    dom.filterRam.addEventListener('change', renderFilteredModels);
    if (dom.filterSort) dom.filterSort.addEventListener('change', renderFilteredModels);
    if (dom.filterSearch) dom.filterSearch.addEventListener('input', renderFilteredModels);
    // Context filter — re-renders all cards with recalculated KV cache / RAM
    const ctxFilterEl = document.getElementById('filter-context');
    if (ctxFilterEl) ctxFilterEl.addEventListener('change', renderFilteredModels);

    // Org source chips — toggle which org(s) to load
    document.querySelectorAll('.org-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const org = chip.dataset.org;
            if (state.activeOrgs.has(org)) {
                // Don't allow deselecting all
                if (state.activeOrgs.size > 1) {
                    state.activeOrgs.delete(org);
                    chip.classList.remove('active');
                }
            } else {
                state.activeOrgs.add(org);
                chip.classList.add('active');
            }
            // Reload catalog with new org selection
            state.modelsCatalog = null;
            loadModelsCatalog();
        });
    });

    if (dom.tabModelsAll) {
        dom.tabModelsAll.addEventListener('click', () => {
            state.modelsTab = 'all';
            dom.tabModelsAll.classList.add('active');
            dom.tabModelsInstalled.classList.remove('active');
            if (dom.tabModelsTop10) dom.tabModelsTop10.classList.remove('active');
            renderFilteredModels();
        });
    }
    if (dom.tabModelsInstalled) {
        dom.tabModelsInstalled.addEventListener('click', () => {
            state.modelsTab = 'installed';
            dom.tabModelsInstalled.classList.add('active');
            dom.tabModelsAll.classList.remove('active');
            if (dom.tabModelsTop10) dom.tabModelsTop10.classList.remove('active');
            renderFilteredModels();
        });
    }
    if (dom.tabModelsTop10) {
        dom.tabModelsTop10.addEventListener('click', () => {
            state.modelsTab = 'top10';
            dom.tabModelsTop10.classList.add('active');
            dom.tabModelsAll.classList.remove('active');
            dom.tabModelsInstalled.classList.remove('active');
            renderFilteredModels();
        });
    }
}

// =================================================================
// Dashboard
// =================================================================
async function loadDashboard() {
    const now = Date.now();
    // Reduced frequency: 10s debounce for background status checks
    if (state._isDashFetching || (state._lastDashPoll && now - state._lastDashPoll < 10000)) {
        return;
    }
    state._isDashFetching = true;
    state._lastDashPoll = now;

    // Timer management removed here, centralized in scheduler

    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        state.dashboardData = data;

        if (data.server_online) {
            setDashStatus('online', 'Online');
        } else {
            setDashStatus('offline', 'Hors ligne');
        }

        const hostAddr = data.host || 'mirza.local';
        dom.dashHost.textContent = hostAddr;
        const actualIp = data.hardware?.ip && data.hardware.ip !== hostAddr ? data.hardware.ip : (data.hardware?.ip || hostAddr);
        dom.dashIp.dataset.value = actualIp;
        if (!dom.dashIp.classList.contains('obscured-ip')) {
            dom.dashIp.textContent = actualIp;
        }

        dom.dashApi.textContent = data.llm_api ? `✓ Port ${data.api_port}` : '✗ Stopped';
        dom.dashApi.style.color = data.llm_api ? 'var(--color-success)' : 'var(--color-text-tertiary)';
        dom.dashGrafana.textContent = data.grafana ? '✓ Port 3000' : '✗ Stopped';
        dom.dashGrafana.style.color = data.grafana ? 'var(--color-success)' : 'var(--color-text-tertiary)';

        if (data.server_online && !data.config_available && !window._hasTriedGenerateConfig) {
            window._hasTriedGenerateConfig = true;
            window._isGeneratingConfig = true;
            toast('Configuration manquante, génération automatique en cours...', 'info');
            regenerateConfig().then(() => {
                window._isGeneratingConfig = false;
                triggerDashboardRefresh();
            });
        }

        if (window._isGeneratingConfig) {
            dom.dashChip.textContent = 'Génération...';
        } else {
            dom.dashChip.textContent = data.hardware?.chip || '—';
            dom.dashCpu.textContent = data.hardware?.cpu_cores ? `${data.hardware.cpu_cores} cores` : '—';
            dom.dashGpu.textContent = data.hardware?.gpu_cores ? `${data.hardware.gpu_cores} cores` : '—';
            dom.dashRam.textContent = data.hardware?.ram_gb ? `${data.hardware.ram_gb} GB` : '—';
        }

        if (data.active_model) {
            dom.dashModelName.textContent = data.active_model.split('/').pop();
            dom.dashModelSub.textContent = data.active_model;
            
            // Handle VRAM Monitoring & Metal Status
            if (data.vram_metrics && dom.vramMonitor) {
                dom.vramMonitor.style.display = 'block';
                if (dom.dashMetalBadge) {
                    dom.dashMetalBadge.style.display = data.vram_metrics.metal_active ? 'block' : 'none';
                }
                const m = data.vram_metrics;
                const totalInUseGb = m.weights + m.kv + m.compute;
                const totalSysRamGb = parseFloat(data.hardware?.ram_gb) || 24.0;
                const remainingRamGb = totalSysRamGb - totalInUseGb;
                
                dom.vramTotalValue.textContent = `${totalInUseGb.toFixed(1)} GB / ${remainingRamGb.toFixed(1)} GB`;
                
                const weightP = (m.weights / totalSysRamGb * 100).toFixed(1) + '%';
                const kvP = (m.kv / totalSysRamGb * 100).toFixed(1) + '%';
                const computeP = (m.compute / totalSysRamGb * 100).toFixed(1) + '%';
                
                dom.vramBarWeights.style.width = weightP;
                dom.vramBarKv.style.width = kvP;
                dom.vramBarCompute.style.width = computeP;
                
                dom.vramBarWeights.title = `Weights: ${m.weights.toFixed(2)} GB`;
                dom.vramBarKv.title = `KV Cache: ${m.kv.toFixed(2)} GB`;
                dom.vramBarCompute.title = `Compute: ${m.compute.toFixed(2)} GB`;

                if (dom.vramLblWeights) dom.vramLblWeights.textContent = `Weights: ${m.weights.toFixed(2)} GB`;
                if (dom.vramLblKv) dom.vramLblKv.textContent = `KV Cache: ${m.kv.toFixed(2)} GB`;
                if (dom.vramLblCompute) dom.vramLblCompute.textContent = `Compute: ${m.compute.toFixed(2)} GB`;

                if (dom.vramOsRamValue && m.total_ram_used) {
                    dom.vramOsRamValue.textContent = `${m.total_ram_used.toFixed(1)} GB`;
                }
                if (dom.vramOsRamSysValue && m.os_ram_used) {
                    const llmRam = m.weights + m.kv + m.compute;
                    const osRamSys = m.total_ram_used - llmRam;
                    dom.vramOsRamSysValue.textContent = `${osRamSys.toFixed(1)} GB`;
                }
            } else if (dom.vramMonitor) {
                dom.vramMonitor.style.display = 'none';
            }
        } else {
            dom.dashModelName.textContent = 'None';
            dom.dashModelSub.textContent = data.llm_api ? 'No model loaded' : 'Server Stopped';
            if (dom.vramMonitor) dom.vramMonitor.style.display = 'none';
            if (dom.dashMetalBadge) dom.dashMetalBadge.style.display = 'none';
        }

        if (state.isDownloading && dom.dashSectionDownload) {
            dom.dashSectionDownload.style.display = 'block';
        } else if (dom.dashSectionDownload) {
            dom.dashSectionDownload.style.display = 'none';
        }

        const grafanaUrl = `http://${data.host || 'mirza.local'}:3000/d/f09f8d8e-mirza-monitor-lite/mirza-monitor-lite?orgId=1&kiosk`;
        const iframe = document.getElementById('grafana-iframe');
        if (iframe) {
            // Only set src if not already loaded or if host changed
            const currentSrc = iframe.src || '';
            const expectedUrl = grafanaUrl;
            if (!currentSrc.includes('grafana') || currentSrc !== expectedUrl && currentSrc !== expectedUrl + '/') {
                iframe.src = expectedUrl;
            }
            // Add error handling
            iframe.onerror = () => {
                console.warn('[Grafana] Failed to load dashboard');
                iframe.style.display = 'none';
            };
            iframe.onload = () => {
                iframe.style.display = 'block';
            };
        }

    } catch (e) {
        setDashStatus('offline', 'Connection Error');
        console.warn('Dashboard error:', e);
    } finally {
        state._isDashFetching = false;
    }
}

/**
 * Centralized Scheduler (60s interval)
 * Ensures only one loop runs and handles both status and logs.
 */
function startGlobalScheduler() {
    if (state._schedulerId) clearInterval(state._schedulerId);
    state._schedulerId = setInterval(() => {
        if (state.currentView === 'dashboard') {
            loadDashboard();
            if (dom.checkAutoLogs && dom.checkAutoLogs.checked) {
                loadLogs(true);
            }
        }
    }, 60000);
}

function triggerDashboardRefresh(delay = 0) {
    if (delay === 0) loadDashboard();
    else setTimeout(loadDashboard, delay);
}

function setDashStatus(status, text) {
    dom.dashServerStatus.innerHTML = `<div class="status-dot ${status}"></div><span>${text}</span>`;
}

async function loadLogs(silent = false) {
    if (!silent) dom.dashLogs.innerHTML = '<span style="color:#666">Loading logs...</span>';
    try {
        const res = await fetch('/api/llm/logs');
        const data = await res.json();
        if (data.logs && data.logs.trim()) {
            // Performance: Slice to last 1000 lines to prevent browser freeze on large log files
            const lines = data.logs.split('\n');
            const truncated = lines.length > 1000 ? lines.slice(-1000).join('\n') : data.logs;

            dom.dashLogs.innerHTML = colorizeLog(truncated);

            // Auto-scroll if already near bottom
            const atBottom = dom.dashLogs.scrollHeight - dom.dashLogs.clientHeight <= dom.dashLogs.scrollTop + 80;
            if (atBottom || !silent) {
                dom.dashLogs.scrollTop = dom.dashLogs.scrollHeight;
            }
        } else if (!silent) {
            dom.dashLogs.innerHTML = '<span style="color:#555">No logs available \u2014 the llama.cpp server has not been started yet.</span>';
        }
    } catch (e) {
        if (!silent) dom.dashLogs.innerHTML = `<span style="color:var(--color-error)">Error: ${e.message}</span>`;
    }
}

/**
 * Colorize llama.cpp / Mirza log output for the terminal-style panel.
 * Maps log levels and patterns to colors.
 */
function colorizeLog(raw) {
    return raw
        .split('\n')
        .map(line => {
            const escaped = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // Error lines
            if (/error|erreur|fail|failed|exception|critical|fatal/i.test(line)) {
                return `<span style="color:#f87171">${escaped}</span>`;
            }
            // Warnings
            if (/warn|warning|attention|deprecat/i.test(line)) {
                return `<span style="color:#fbbf24">${escaped}</span>`;
            }
            // Server ready / success
            if (/ready|running|started|success|listening|loaded|✓|opérationnel/i.test(line)) {
                return `<span style="color:#34d399">${escaped}</span>`;
            }
            // Mirza header lines
            if (/^\[Mirza\]|^\s*Mod[eè]le|^\s*Contexte|^\s*KV Cache|^\s*Flash|^\s*GPU|^\s*Commande/i.test(line)) {
                return `<span style="color:#818cf8">${escaped}</span>`;
            }
            // Model loading progress (llama.cpp output)
            if (/llm_load|ggml_|metal_|cuda_|clblast_/i.test(line)) {
                return `<span style="color:#60a5fa">${escaped}</span>`;
            }
            // HTTP request logs
            if (/POST|GET|DELETE|PUT|\d{3}\s/i.test(line) && /\/v1\//i.test(line)) {
                return `<span style="color:#a8b4c8">${escaped}</span>`;
            }
            // Separator / header lines
            if (/^[=\-]{5,}|^═+|^╔|^╚/.test(line)) {
                return `<span style="color:#4b5563">${escaped}</span>`;
            }
            return `<span style="color:#c9d1d9">${escaped}</span>`;
        })
        .join('\n');
}

async function apiAction(endpoint, message, extraBody = null) {
    toast(message, 'info');
    try {
        let opts = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
        if (extraBody) opts.body = JSON.stringify(extraBody);
        const res = await fetch(endpoint, opts);
        const data = await res.json();
        if (data.ok !== false) {
            toast(data.message || 'Commande exécutée', 'success');
        } else {
            toast(data.error || 'Erreur', 'error');
        }
        triggerDashboardRefresh(60000);
    } catch (e) {
        toast(`Erreur: ${e.message}`, 'error');
    }
}

// =================================================================
// Models Catalog
// =================================================================

/**
 * Fetch per-file sizes from HuggingFace tree API.
 * Returns a map: filename -> size_gb (float)
 */
async function fetchGgufFileSizes(repoId) {
    try {
        const res = await fetch(`https://huggingface.co/api/models/${repoId}/tree/main`);
        if (!res.ok) return {};
        const tree = await res.json();
        const map = {};
        for (const f of tree) {
            if (!f.path?.toLowerCase().endsWith('.gguf')) continue;
            // LFS stores actual size, 'size' field is the pointer file size
            const rawSize = f.lfs?.size || f.size || 0;
            const filename = f.path.split('/').pop();
            map[filename] = Math.round(rawSize / 1e9 * 10) / 10;
        }
        return map;
    } catch { return {}; }
}

/**
 * Fetch gguf metadata (total, context_length, architecture) from model API.
 */
async function fetchModelMeta(repoId) {
    try {
        const res = await fetch(`https://huggingface.co/api/models/${repoId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return {
            gguf: data.gguf || {},   // {total, context_length, architecture, ...}
            gated: data.gated || false,
        };
    } catch { return null; }
}

/**
 * Select the best GGUF file from the size map.
 * Priority: Q4_K_M > Q5_K_M > Q4_K_S > Q4_0 > Q8_0 > anything
 */
function pickBestGguf(sizeMap) {
    const files = Object.keys(sizeMap).filter(f => !f.startsWith('mmproj'));
    if (!files.length) return null;
    const priority = ['Q4_K_M', 'Q4_K_S', 'Q5_K_M', 'Q5_0', 'Q4_0', 'Q8_0', 'Q2_K', 'IQ4_XS'];
    for (const p of priority) {
        const match = files.find(f => f.toUpperCase().includes(p));
        if (match) return { name: match, size_gb: sizeMap[match] };
    }
    // Fallback: smallest GGUF (avoid bf16/f16 which are huge)
    const sorted = files.filter(f => !/bf16|f16/i.test(f)).sort((a, b) => sizeMap[a] - sizeMap[b]);
    if (sorted.length) return { name: sorted[0], size_gb: sizeMap[sorted[0]] };
    return { name: files[0], size_gb: sizeMap[files[0]] };
}

/**
 * Fetch ALL models from a HuggingFace organisation using pagination.
 * The HF API caps results at 100 per call; we follow Link headers (cursor-based)
 * until there are no more pages. Falls back to offset pagination if needed.
 *
 * @param {string} org - HuggingFace organisation name (e.g. 'ggml-org')
 * @param {boolean} excludeLora - Skip LoRA adapter repos (default: true)
 * @param {number} maxModels - Max models to fetch (default: 500)
 * @returns {Promise<Array>} Full list of model objects from HF
 */
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 2000, onRetry) {
    try {
        const res = await fetch(url, options);
        if (res.status === 429 || res.status === 503) {
            if (retries > 0) {
                if (onRetry) onRetry(backoff / 1000, 3 - retries + 1);
                await new Promise(r => setTimeout(r, backoff));
                return fetchWithRetry(url, options, retries - 1, backoff * 2.5, onRetry);
            }
        }
        return res;
    } catch (e) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2.5, onRetry);
        }
        throw e;
    }
}

async function fetchAllHfModels(org, excludeLora = true, maxModels = 500) {
    const PAGE_SIZE = 100;
    const BASE = 'https://huggingface.co';
    const allModels = [];
    let nextUrl = `${BASE}/api/models?author=${org}&limit=${PAGE_SIZE}&sort=downloads&direction=-1`;

    while (nextUrl && allModels.length < maxModels) {
        let res;
        try {
            res = await fetchWithRetry(nextUrl, {}, 3, 2000, (wait, attempt) => {
                const p = dom.modelsGrid.querySelector('.mcp-empty p');
                if (p) {
                    p.innerHTML = `HuggingFace is busy (Rate Limit).<br/>` +
                        `<span style="font-size:0.8rem; color:var(--color-warning)">Waiting ${Math.round(wait)}s for cooldown (Attempt ${attempt}/3)...</span>`;
                }
            });
        } catch (e) {
            console.warn('[Mirza] HF API fetch error, stopping pagination:', e);
            break;
        }

        if (!res.ok) {
            console.warn(`[Mirza] HF API error ${res.status} for ${nextUrl}`);
            break;
        }

        const batch = await res.json();
        if (!Array.isArray(batch) || batch.length === 0) break;

        allModels.push(...batch);
        console.log(`[Mirza] ggml-org: fetched ${allModels.length} models so far...`);

        // Follow HF's cursor-based Link header: <URL>; rel="next"
        const linkHeader = res.headers.get('Link') || '';
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
            nextUrl = nextMatch[1].startsWith('http') ? nextMatch[1] : BASE + nextMatch[1];
        } else if (batch.length === PAGE_SIZE) {
            // Fallback: try offset if no Link header but full page returned
            const currentOffset = allModels.length - batch.length;
            const newOffset = currentOffset + PAGE_SIZE;
            nextUrl = `${BASE}/api/models?author=${org}&limit=${PAGE_SIZE}&sort=downloads&direction=-1&skip=${newOffset}`;
        } else {
            nextUrl = null; // Last page
        }

        // Safety delay to prevent triggering HF rate limits
        await new Promise(r => setTimeout(r, 100));
    }

    // Optionally filter out LoRA adapter repos (they're not standalone models)
    if (excludeLora) {
        return allModels.filter(m => !m.id.toLowerCase().includes('lora-'));
    }
    return allModels;
}

/**
 * Concurrency-limited version of Promise.all / map
 * Prevents browser ERR_INSUFFICIENT_RESOURCES when firing thousands of requests.
 */
async function mapLimit(array, limit, mapper, onProgress) {
    const results = [];
    const executing = new Set();
    let completed = 0;

    for (let i = 0; i < array.length; i++) {
        const item = array[i];
        const p = Promise.resolve().then(() => mapper(item, i, array));
        results.push(p);
        executing.add(p);

        const clean = () => {
            executing.delete(p);
            completed++;
            if (onProgress) onProgress(completed, array.length);
        };
        p.then(clean).catch(clean);

        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    return Promise.allSettled(results);
}

async function syncInstalledModels(silent = false) {
    try {
        const res = await fetch('/api/llm/installed');
        const data = await res.json();
        if (data.installed) {
            state.installedModels = data.installed;
        }
        // Always re-render if we are in the installed view
        if (state.modelsTab === 'installed') renderFilteredModels();
    } catch (e) {
        if (!silent) console.warn("[Mirza] Could not fetch installed models", e);
    }
}

async function loadModelsCatalog() {
    // 1. Sync installed models from station immediately (don't wait for catalog)
    syncInstalledModels(true);

    try {
        const orgList = [...state.activeOrgs];
        const orgLabel = orgList.join(' + ');

        // Check cache first
        const cacheKey = `mirza_catalog_v2_${orgList.sort().join('_')}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const entry = JSON.parse(cached);
                if (Date.now() - entry.timestamp < 3600000) { // 1 hour TTL
                    console.log(`[Mirza] Loading catalog from local cache (${orgLabel})`);
                    state.modelsCatalog = entry.data;
                    populateFilters(entry.data);
                    renderFilteredModels();
                    return;
                }
            } catch (e) { }
        }

        dom.modelsGrid.innerHTML = `
            <div class="mcp-empty">
                <p>Fetching live catalog from <strong>${orgLabel}</strong>...</p>
                <div class="spinner"></div>
            </div>`;

        const configRes = await fetch('/api/models');
        const localConfig = await configRes.json();

        // ── Fetch all selected orgs in parallel (each fully paginated) ────
        const orgResults = await Promise.allSettled(
            orgList.map(org => {
                // Keep 'ggml-org' full (163 models) but limit 'unsloth' to top 200 popular repos
                const max = (org === 'unsloth') ? 200 : 500;
                return fetchAllHfModels(org, true, max).then(models =>
                    models.map(m => ({ ...m, _source: org }))
                );
            })
        );

        // Merge + deduplicate by base name (strip -GGUF, quant suffix, lowercase).
        // When both orgs have the same model, prefer ggml-org (canonical provenance).
        const seen = new Map();
        for (const result of orgResults) {
            if (result.status !== 'fulfilled') continue;
            for (const m of result.value) {
                const baseName = (m.id.split('/')[1] || m.id)
                    .replace(/-GGUF$/i, '').replace(/-Q\d[\w_]*-GGUF$/i, '').toLowerCase();
                if (!seen.has(baseName)) {
                    seen.set(baseName, m);
                } else {
                    // Prefer ggml-org over unsloth when both exist
                    if (seen.get(baseName)._source !== 'ggml-org' && m._source === 'ggml-org') {
                        seen.set(baseName, m);
                    }
                }
            }
        }
        const mergedModels = Array.from(seen.values());
        // ── Filter noise ───────────────────────────────────────────────────
        const blacklist = ['test', 'moved', 'stories', 'dummy', 'tmp', 'training', 'junk', 'vocabs', 'wavtokenizer', 'ltx-'];
        const filteredModels = mergedModels.filter(m => {
            const n = (m.id.split('/')[1] || '').toLowerCase();
            return !blacklist.some(b => n.includes(b));
        });

        // Update source count badge
        const countEl = document.getElementById('catalog-model-count');
        if (countEl) countEl.textContent = `${filteredModels.length} models`;

        dom.modelsGrid.innerHTML = `
            <div class="mcp-empty">
                <p>Loading metadata for <strong>${filteredModels.length} models</strong>...</p>
                <div class="spinner"></div>
            </div>`;

        // Parallel fetch with concurrency limit (20 max) to prevent ERR_INSUFFICIENT_RESOURCES
        const metaResults = await mapLimit(filteredModels, 20, async (m) => {
            return Promise.all([
                fetchGgufFileSizes(m.id),
                fetchModelMeta(m.id),
            ]);
        }, (done, total) => {
            const p = dom.modelsGrid.querySelector('.mcp-empty p');
            if (p) {
                p.innerHTML = `Loading metadata for <strong>${total} models</strong>...<br/>` +
                    `<span style="font-size:0.8rem; color:var(--text-muted)">Processed ${done}/${total}</span>`;
            }
        });

        // ── Rich capability flags from HF model card metadata ─────────────
        const CAPS_DB = {
            // True MoE models (multiple expert banks — GGUF stores ALL weights)
            moe: [
                'Mixtral', 'Mistral-8x',        // Mistral MoEs (8x7B, 8x22B)
                'Qwen3-235',                     // Qwen3 235B-A22B
                'Qwen3-Coder-30B-A3B',           // Qwen3 Coder MoE
                'DeepSeek-V2', 'DeepSeek-V3',   // DeepSeek MoEs
                'OLMoE', 'DBRX',                 // Other known MoEs
                // Note: gpt-oss-120b is a DENSE model — NOT MoE
                // Note: gemma-4-E4B uses sparse activation but is stored as full weights
            ],
            // Vision+Language (Multimodal)
            vision: [
                'SmolVLM', 'SmolVLM2', 'GLM-OCR', 'GLM-4.6V', 'moondream2', 'Qwen2.5-VL',
                'Qwen-VL', 'tinygemma3', 'ultravox', 'DeepSeek-OCR', 'MiniCPM-V', 'Gemma3n'
            ],
            // Tool calling / Function calling support
            tools: [
                'Qwen2.5-Coder', 'Llama-3', 'Qwen3', 'Mistral', 'Hermes', 'Functionary'
            ],
            // Embedding / retrieval models (not chat)
            embedding: [
                'bge-m3', 'Nomic-Embed', 'embeddinggemma', 'Reranker'
            ],
            // Audio/Speech models
            audio: ['ultravox'],
        };

        function detectCaps(repoId, nameLower, tags) {
            const caps = {};
            // MoE detection via name pattern
            caps.moe = CAPS_DB.moe.some(k => nameLower.includes(k.toLowerCase())) ||
                /moe|mixture.of.expert|\d+x\d+B/i.test(repoId) ||
                (tags || []).includes('mixture-of-experts');

            // Vision/Multimodal
            caps.vision = CAPS_DB.vision.some(k => nameLower.includes(k.toLowerCase())) ||
                /(vlm|smolvlm|vl-|vision|-vl-|multimodal|ocr|visual)/i.test(repoId) ||
                (tags || []).some(t => ['vision', 'multimodal', 'image-text-to-text'].includes(t));

            // Tool calling
            caps.tools = CAPS_DB.tools.some(k => nameLower.includes(k.toLowerCase())) ||
                (tags || []).some(t => ['function-calling', 'tool-use'].includes(t)) ||
                /(-it-|instruct)/i.test(nameLower);

            // Embedding
            caps.embedding = CAPS_DB.embedding.some(k => nameLower.includes(k.toLowerCase())) ||
                /(embed|rerank|retrieve)/i.test(nameLower) ||
                (tags || []).includes('feature-extraction');

            // Audio
            caps.audio = CAPS_DB.audio.some(k => nameLower.includes(k.toLowerCase())) ||
                (tags || []).some(t => ['audio', 'speech-to-text', 'automatic-speech-recognition'].includes(t));

            // Context Length hint
            caps.longCtx = /128k|64k|32k/i.test(repoId);

            return caps;
        }

        const catalog = [];

        for (let mi = 0; mi < filteredModels.length; mi++) {
            const model = filteredModels[mi];
            const hf_repo = model.id;
            const name_parts = hf_repo.split('/')[1] || hf_repo;
            const nLower = name_parts.toLowerCase();
            const modelTags = model.tags || [];

            // ── Real metadata from HF API ─────────────────────────────────────
            let realSizeMap = {};
            let ggufMeta = {};
            if (metaResults[mi]?.status === 'fulfilled') {
                const [sizeMap, meta] = metaResults[mi].value;
                realSizeMap = sizeMap || {};
                ggufMeta = meta?.gguf || {};
            }
            const bestGguf = pickBestGguf(realSizeMap);

            // ── Parameter extraction ──────────────────────────────────────────
            // Handles: 26B, 0.5B, 1.5B, E4B (Gemma sparse), A3B (MoE active),
            //          8x7B (Mixtral), 30B-A3B (total-active MoE notation)
            let parameters = "N/A";
            let totalParamsNum = null; // Total stored params (for size calc)

            // Check for MoE A-notation: 30B-A3B or 235B-A22B (total-activeB)
            const moeSplit = name_parts.match(/(\d+(?:\.\d+)?[BT])-A(\d+(?:\.\d+)?[BT])/i);
            if (moeSplit) {
                // Store total for size, display as "235B" (total)
                totalParamsNum = parseFloat(moeSplit[1]);
                parameters = moeSplit[1].toUpperCase(); // Show total params (= GGUF size)
            } else {
                const paramMatch = name_parts.match(/(\d+(?:\.\d+)?[BT]|[EA]\d+(?:\.\d+)?[BT]|\d+x\d+(?:\.\d+)?[BT])/i);
                if (paramMatch) {
                    let p = paramMatch[1].toUpperCase();
                    // E4B / A4B = effective/active params (sparse models) — keep as-is for display
                    // The GGUF file for these maps to roughly the effective param count
                    if (/^[EA]/i.test(p)) p = p.substring(1);
                    // NxM notation (Mixtral 8x7B = 56B total) — compute real total
                    const mixMatch = p.match(/^(\d+)x(\d+(?:\.\d+)?)([BT])$/i);
                    if (mixMatch) {
                        totalParamsNum = parseInt(mixMatch[1]) * parseFloat(mixMatch[2]);
                        parameters = `${totalParamsNum}${mixMatch[3].toUpperCase()}`;
                    } else {
                        parameters = p;
                    }
                } else {
                    const tagMatch = modelTags.find(t => /^\d+b$/i.test(t));
                    if (tagMatch) parameters = tagMatch.toUpperCase();
                }
            }

            // ── Quantization detection ────────────────────────────────────────
            let quantization = "Q4_K_M";
            const quantMatch = name_parts.match(/(Q\d(?:_K)?(?:_[SM])?|FP\d+|IQ\d_[A-Z]+)/i);
            if (quantMatch) quantization = quantMatch[1].toUpperCase();

            // ── Family ────────────────────────────────────────────────────────
            let family = name_parts.split(/[-_]/)[0];
            if (/^llama/i.test(name_parts)) family = "Llama";
            else if (/^gemma/i.test(name_parts)) family = "Gemma";
            else if (/^Qwen/i.test(name_parts)) family = "Qwen";
            else if (/^smol/i.test(name_parts)) family = "SmolLM";
            else if (/^mistral/i.test(name_parts)) family = "Mistral";
            else if (/^phi/i.test(name_parts)) family = "Phi";
            else if (/^deepseek/i.test(name_parts)) family = "DeepSeek";
            else if (/^glm/i.test(name_parts)) family = "GLM";
            else if (/^moondream/i.test(name_parts)) family = "Moondream";
            else if (/^ultravox/i.test(name_parts)) family = "Ultravox";
            else if (/^bge/i.test(name_parts) || /embed/i.test(name_parts)) family = "Embedding";

            // ── Memory estimation — Real data from HF API, formula as fallback ──
            let paramsNum = parseFloat(parameters.replace(/[BT]/i, ''));
            if (parameters.endsWith('T')) paramsNum *= 1000;
            if (isNaN(paramsNum)) paramsNum = 7;

            const caps = detectCaps(hf_repo, nLower, modelTags, ggufMeta);

            // 1. Try real file size from tree API (most accurate)
            let size_gb;
            if (bestGguf && bestGguf.size_gb > 0) {
                size_gb = bestGguf.size_gb;
                // Detect quantization from actual selected filename
                const qMatch = bestGguf.name.match(/(Q\d(?:_K)?(?:_[SM])?|FP\d+|BF16|F16|IQ\d_[A-Z]+)/i);
                if (qMatch) quantization = qMatch[1].toUpperCase();
            } else if (ggufMeta.total && ggufMeta.total > 0) {
                // 2. Fallback: gguf.total from model API (sum of all GGUF files)
                //    Divide by number of quant variants to get approximate single file size
                const ggufCount = Object.keys(realSizeMap).length || 1;
                size_gb = Math.round(ggufMeta.total / ggufCount / 1e9 * 10) / 10;
            } else {
                // 3. Last resort: heuristic formula
                const sizeParams = totalParamsNum !== null ? totalParamsNum : paramsNum;
                let bits = 4;
                if (/^Q8|^FP8|^BF16|^F16/i.test(quantization)) bits = 8;
                else if (/^Q6/i.test(quantization)) bits = 6;
                else if (/^Q5/i.test(quantization)) bits = 5;
                else if (/^Q3/i.test(quantization)) bits = 3;
                else if (/^Q2|^IQ2/i.test(quantization)) bits = 2;
                size_gb = Math.round((sizeParams * (bits / 8) + 0.5) * 10) / 10;
            }

            // Context window: real value from GGUF metadata takes priority
            const realCtx = ggufMeta.context_length || 0;

            // KV cache estimate — use active params for MoE (smaller attention footprint)
            const activeParams = caps.moe ? Math.max(paramsNum * 0.15, 3) : paramsNum;
            let kv_cache_gb = activeParams > 30 ? 6
                : activeParams > 14 ? 4
                    : activeParams > 6 ? 2
                        : 1;
            let min_ram_gb = Math.ceil(size_gb + kv_cache_gb + 4);

            // ── Categories ────────────────────────────────────────────────────
            let catSet = new Set();
            if (caps.vision) catSet.add('vision');
            if (caps.audio) catSet.add('audio');
            if (caps.embedding) catSet.add('embedding');
            if (caps.moe) catSet.add('moe');
            if (caps.tools) catSet.add('tools');
            if (/(coder|code)/i.test(nLower)) catSet.add('code');
            if (/(-it-|instruct|chat)/i.test(nLower)) catSet.add('chat');
            if (/(distill|reason|r1|r3)/i.test(nLower)) catSet.add('reasoning');
            if (paramsNum <= 3) catSet.add('light');
            if (catSet.size === 0) catSet.add('general');
            const cats = [...catSet];

            // ── Top recommendation logic ──────────────────────────────────────
            const macRamEst = state.dashboardData?.hardware?.ram_gb || 24;
            const isLatest = /gemma-4|llama-3|qwen-2\.5|qwen-3|smolvlm2/i.test(nLower);
            const isPopular = model.downloads > 50000;
            const fitsInRam = min_ram_gb <= macRamEst;
            const recommended = (isLatest || isPopular) && fitsInRam;

            catalog.push({
                hf_repo, name: name_parts, family,
                parameters, quantization,
                size_gb, kv_cache_gb, min_ram_gb,
                categories: cats, caps,
                description: `${(model.downloads || 0).toLocaleString()} downloads`,
                downloads: model.downloads || 0,
                recommended,
                tags: modelTags,
                // Real metadata from HF API
                context_length: realCtx,
                architecture: ggufMeta.architecture || null,
                best_file: bestGguf?.name || null,
                source: model._source || 'ggml-org',  // origin org
            });
        }

        localConfig.catalog = catalog;
        state.modelsCatalog = localConfig;

        // Save back to cache
        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: localConfig
        }));

        populateFilters(localConfig);
        renderFilteredModels();
    } catch (e) {
        dom.modelsGrid.innerHTML = `<div class="mcp-empty">Error: ${escapeHtml(e.message)}</div>`;
    }
}

// Built-in categories covering all capabilities we detect
const ALL_CATEGORIES = {
    vision: { icon: '👁️', label: 'Vision / Multimodal' },
    audio: { icon: '🎙️', label: 'Audio / Speech' },
    embedding: { icon: '🔗', label: 'Embedding / RAG' },
    moe: { icon: '🧩', label: 'MoE (Mixture of Experts)' },
    tools: { icon: '🛠️', label: 'Function Calling' },
    code: { icon: '💻', label: 'Code' },
    chat: { icon: '💬', label: 'Chat / Instruct' },
    reasoning: { icon: '🧠', label: 'Reasoning' },
    light: { icon: '⚡', label: 'Lightweight (<3B)' },
    general: { icon: '◈', label: 'General' },
};

function populateFilters(data) {
    if (!data.categories) data.categories = {};
    Object.assign(data.categories, ALL_CATEGORIES);

    if (dom.filterCategory) {
        dom.filterCategory.innerHTML = '<option value="">All categories</option>';
        Object.entries(ALL_CATEGORIES).forEach(([key, cat]) => {
            dom.filterCategory.innerHTML += `<option value="${key}">${cat.icon} ${cat.label}</option>`;
        });
    }
    if (dom.filterFamily && data.catalog) {
        const uniqueFams = [...new Set(data.catalog.map(m => m.family || 'Other'))].sort();
        dom.filterFamily.innerHTML = '<option value="">All families</option>';
        uniqueFams.forEach(fam => {
            dom.filterFamily.innerHTML += `<option value="${fam}">${fam}</option>`;
        });
    }
}

/**
 * Checks if a repository ID (e.g. org/model-gguf) matches any of the
 * filenames found in state.installedModels (e.g. model-q4_k_m.gguf).
 */
function isModelInstalled(repoId, bestFile) {
    return getInstalledFilename(repoId, bestFile) !== null;
}

/**
 * Returns the actual filename if the model is installed, otherwise null.
 */
function getInstalledFilename(repoId, bestFile) {
    const installed = state.installedModels || [];
    const idLower = (repoId || '').toLowerCase();
    const repoName = idLower.split('/').pop().replace(/-gguf$/i, '');

    const match = installed.find(filename => {
        const f = filename.toLowerCase();
        // Exact match via known best_file
        if (bestFile && f === bestFile.toLowerCase()) return true;
        // Fuzzy match via repo name (e.g. repo name is prefix of filename)
        if (f.includes(repoName)) return true;
        return false;
    });
    return match || null;
}

function renderFilteredModels() {
    if (!state.modelsCatalog?.catalog) return;
    const catFilter = dom.filterCategory.value;
    const ramFilter = dom.filterRam.value;
    const categories = state.modelsCatalog.categories || {};
    const ramTiers = state.modelsCatalog.ram_tiers || {};

    let models = [...state.modelsCatalog.catalog];

    if (state.modelsTab === 'installed') {
        // Find catalog models that match disk files
        const catalogMatches = models.filter(m => isModelInstalled(m.hf_repo, m.best_file));

        // Find disk files that DON'T have catalog metadata (generic view)
        const matchedFilenames = new Set();
        catalogMatches.forEach(m => {
            const f = state.installedModels.find(fname =>
                fname.toLowerCase() === (m.best_file || '').toLowerCase() ||
                fname.toLowerCase().includes(m.hf_repo.split('/').pop().toLowerCase().replace(/-gguf$/i, ''))
            );
            if (f) matchedFilenames.add(f);
        });

        const orphans = state.installedModels
            .filter(f => !matchedFilenames.has(f))
            .map(f => ({
                name: f,
                hf_repo: `local/${f}`,
                family: 'Installed File',
                parameters: 'N/A',
                quantization: f.match(/q\d[\w_]*/i)?.[0]?.toUpperCase() || 'Unknown',
                size_gb: '?',
                min_ram_gb: 0,
                categories: ['general'],
                isOrphan: true,
                best_file: f
            }));

        models = [...catalogMatches, ...orphans];
    }

    if (dom.filterSearch && dom.filterSearch.value.trim() !== '') {
        const query = dom.filterSearch.value.toLowerCase();
        models = models.filter(m =>
            m.name.toLowerCase().includes(query) ||
            (m.hf_repo && m.hf_repo.toLowerCase().includes(query))
        );
    }

    const macRam = state.dashboardData?.hardware?.ram_gb || 8;
    const chip = state.dashboardData?.hardware?.chip || "";
    let bandwidth = 100; // Base M1/M2/M3
    if (/Max/i.test(chip)) bandwidth = 400;
    else if (/Pro/i.test(chip)) bandwidth = 200;
    else if (/Ultra/i.test(chip)) bandwidth = 800;
    else if (/M4/i.test(chip)) bandwidth = 120; // M4 base is faster

    if (state.modelsTab === 'top10') {
        // Only keep compatible and legitimate high-quality models
        models = models.filter(m => m.min_ram_gb <= macRam);

        models = models.sort((a, b) => {
            // Priority Score
            let scoreA = (a.downloads || 0) / 1000;
            let scoreB = (b.downloads || 0) / 1000;

            // Boost for latest/optimized families (Mirza Selection)
            const boost = 50000;
            if (/gemma-4|llama-3|qwen-3|qwen-2\.5|smollm3/i.test(a.hf_repo)) scoreA += boost;
            if (/gemma-4|llama-3|qwen-3|qwen-2\.5|smollm3/i.test(b.hf_repo)) scoreB += boost;

            return scoreB - scoreA;
        }).slice(0, 10);
    }

    if (catFilter) {
        models = models.filter(m => m.categories?.includes(catFilter));
    }
    if (dom.filterFamily && dom.filterFamily.value) {
        models = models.filter(m => m.family === dom.filterFamily.value);
    }
    if (ramFilter && ramTiers[ramFilter]) {
        const maxGb = ramTiers[ramFilter].max_model_gb;
        models = models.filter(m => m.size_gb <= maxGb);
    }

    if (dom.filterSort && dom.filterSort.value && state.modelsTab !== 'top10') {
        const sortVal = dom.filterSort.value;
        models = models.sort((a, b) => {
            if (sortVal === 'toks') {
                const toksA = Math.round(bandwidth / (a.size_gb || 1));
                const toksB = Math.round(bandwidth / (b.size_gb || 1));
                return toksB - toksA; // Descending
            }
            if (sortVal === 'size_desc') return (b.size_gb || 0) - (a.size_gb || 0);
            if (sortVal === 'size_asc') return (a.size_gb || 0) - (b.size_gb || 0);
            if (sortVal === 'downloads') return (b.downloads || 0) - (a.downloads || 0);
            return 0;
        });
    }

    // ── Context-aware KV cache recalculation ──────────────────────────
    // Formula: kv_cache ≈ size_gb * KV_RATIO * (ctx / BASE_CTX)
    // KV_RATIO ≈ 0.05 means "5% of model size per 4k context tokens"
    // For MoE models, KV is proportional to active params (smaller)
    const KV_RATIO = 0.05;
    const BASE_CTX = 4096;
    const ctxFilter = document.getElementById('filter-context');
    const selectedCtx = parseInt(ctxFilter?.value || '8192', 10);

    // Recompute min_ram for each model with the selected context
    models = models.map(m => {
        const moeFactor = m.caps?.moe ? Math.min(1, (m.paramsNum || 7) * 0.15 / Math.max(m.paramsNum || 7, 1)) : 1;
        const kvAtCtx = Math.ceil((m.size_gb || 0) * KV_RATIO * moeFactor * (selectedCtx / BASE_CTX) * 10) / 10;
        const newMinRam = Math.ceil((m.size_gb || 0) + Math.max(kvAtCtx, 0.5) + 4);
        return { ...m, _kv_ctx: kvAtCtx, min_ram_gb: newMinRam };
    });

    if (models.length === 0) {
        const msg = state.modelsTab === 'installed'
            ? 'No models installed on remote station. (Checked ~/mirza-models/)'
            : 'No matching models found in Cloud Catalog.';
        dom.modelsGrid.innerHTML = `<div class="mcp-empty">${msg}</div>`;
        return;
    }

    dom.modelsGrid.innerHTML = '';

    models.forEach(m => {
        let installedFile = getInstalledFilename(m.hf_repo, m.best_file);
        let isInstalled = m.isOrphan || !!installedFile;
        let serveArg = installedFile || m.hf_repo;

        let isRecommended = m.recommended || false;
        let isUnsupported = false;
        let warningText = '';

        let estimatedToks = Math.round(bandwidth / (m.size_gb || 1));

        if (macRam) {
            if (macRam < m.min_ram_gb) {
                isUnsupported = true;
                isRecommended = false;
                warningText = `<span class="model-tag" style="background:var(--color-error);color:white">⚠ Not enough RAM (${m.min_ram_gb} GB needed at ${selectedCtx.toLocaleString()} ctx)</span>`;
            } else {
                if (macRam - m.min_ram_gb <= 12 && macRam - m.min_ram_gb >= 0) {
                    isRecommended = true;
                }
            }
        }

        const card = document.createElement('div');
        card.className = `model-card${isRecommended ? ' recommended' : ''}${isUnsupported ? ' unsupported' : ''}`;
        if (isUnsupported) card.style.opacity = "0.4";

        const caps = m.caps || {};
        const cats = m.categories || [];

        // Capability badges
        const capBadges = [];
        if (caps.moe) capBadges.push('<span class="cap-badge moe">🧩 MoE</span>');
        if (caps.vision) capBadges.push('<span class="cap-badge vision">👁️ Vision</span>');
        if (caps.audio) capBadges.push('<span class="cap-badge audio">🎙️ Audio</span>');
        if (caps.embedding) capBadges.push('<span class="cap-badge embed">🔗 Embedding</span>');
        if (caps.tools) capBadges.push('<span class="cap-badge tools">🛠️ Tools</span>');
        if (caps.longCtx) capBadges.push('<span class="cap-badge ctx">📐 Long Context</span>');
        if (cats.includes('code')) capBadges.push('<span class="cap-badge code">💻 Code</span>');
        if (cats.includes('reasoning')) capBadges.push('<span class="cap-badge reason">🧠 Reasoning</span>');
        if (cats.includes('light')) capBadges.push('<span class="cap-badge light">⚡ Lightweight</span>');

        const capBadgesHtml = capBadges.length > 0
            ? `<div class="cap-badges-row">${capBadges.join('')}</div>`
            : '';

        card.innerHTML = `
            <div class="model-card-header">
                <div class="model-card-name">${escapeHtml(m.name)}</div>
                <div style="display:flex; gap:5px; align-items:center; flex-shrink:0;">
                    ${m.source === 'unsloth'
                ? '<span style="font-size:0.68rem;padding:2px 7px;border-radius:10px;background:rgba(251,146,60,0.12);color:#fb923c;border:1px solid rgba(251,146,60,0.3);font-weight:600;">🦥 unsloth</span>'
                : (state.activeOrgs.size > 1 ? '<span style="font-size:0.68rem;padding:2px 7px;border-radius:10px;background:rgba(56,189,248,0.1);color:#38bdf8;border:1px solid rgba(56,189,248,0.25);font-weight:600;">🧊 ggml</span>' : '')
            }
                    ${isRecommended ? '<span class="model-tag star">⭐ Top Mirza</span>' : ''}
                </div>
            </div>
            <div class="model-card-family">${escapeHtml(m.family)} · ${m.parameters} · ${m.quantization}</div>
            
            ${capBadgesHtml}

            <div class="model-card-meta" style="flex-wrap: wrap; margin-top: 8px; gap: 6px;">
                <span class="model-tag size" title="${m.best_file ? 'Real file: ' + m.best_file : 'Heuristic estimate'}">
                    💾 ${m.size_gb} GB${m.best_file ? '' : '*'}
                </span>
                <span class="model-tag" style="color:var(--color-success)" title="RAM at ${selectedCtx.toLocaleString()} ctx tokens">🧠 RAM: ${m.min_ram_gb} GB</span>
                <span class="model-tag" style="color:#a78bfa" title="KV cache for ${selectedCtx.toLocaleString()} tokens">🗂 KV: ${(m._kv_ctx || 0).toFixed(1)} GB</span>
                <span class="model-tag size">⚡ ~${estimatedToks} t/s</span>
                ${m.context_length ? `<span class="model-tag" style="color:var(--color-accent-secondary)">📐 ${m.context_length >= 100000 ? Math.round(m.context_length / 1000) + 'k' : (m.context_length / 1000).toFixed(0) + 'k'} ctx</span>` : ''}
                <span class="model-tag">↓ ${(m.downloads || 0).toLocaleString()}</span>
            </div>

            ${warningText ? `<div style="margin-top:6px;">${warningText}</div>` : ''}

            <div class="model-card-footer" style="padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); margin-top: auto;">
                <a href="https://huggingface.co/${escapeHtml(m.hf_repo)}" target="_blank" class="model-card-stats"
                   style="text-decoration:none; display:flex; align-items:center; gap:4px;" title="View on HuggingFace">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 22 3 22 10"/><line x1="14" y1="10" x2="22" y2="2"/></svg> HF
                </a>
                <div style="display:flex; gap:6px;">
                    ${caps.embedding
                ? `<span class="model-tag" style="color:var(--color-warning); font-size:0.75rem;">RAG only</span>`
                : (!isInstalled
                    ? `<button class="model-btn model-btn-deploy" ${isUnsupported ? 'disabled' : ''} onclick="deployModel('${escapeHtml(m.hf_repo)}', '${escapeHtml(m.best_file || '')}')">↓ Download</button>`
                    : `<button class="model-btn model-btn-deploy" disabled style="opacity:0.5;">✓ Installed</button>`)
            }
                    ${!caps.embedding
                ? `<button class="model-btn model-btn-serve" ${isUnsupported ? 'disabled' : ''} onclick="serveModel('${escapeHtml(serveArg)}')">▶ Serve</button>`
                : ''
            }
                </div>
            </div>
        `;
        dom.modelsGrid.appendChild(card);
    });
}

async function deployModel(hfRepo, filename = '') {
    if (state.isDownloading) {
        toast('A download is already in progress.', 'warning');
        return;
    }

    toast(`Starting download for ${hfRepo.split('/').pop()}...`, 'info');

    // Global progress (fallback)
    state.isDownloading = true;
    if (dom['global_download_progress']) dom['global_download_progress'].style.display = 'block';
    if (dom['download_status_text']) dom['download_status_text'].innerText = `Deploying ${hfRepo}...`;
    if (dom['download_percent']) dom['download_percent'].innerText = '0%';

    // Dashboard Widget (primary)
    if (dom.dashSectionDownload) dom.dashSectionDownload.style.display = 'block';
    if (dom.dashDownloadLabel) dom.dashDownloadLabel.innerText = hfRepo;
    if (dom.dashDownloadLogs) dom.dashDownloadLogs.innerText = 'Connecting to station...';

    // Start polling *before* the request if possible, or right after
    startProgressPolling();

    try {
        const res = await fetch('/api/llm/deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hf_repo: hfRepo,
                filename: filename
            })
        });
        const data = await res.json();

        if (!data.ok) {
            stopProgressPolling();
            state.isDownloading = false;
            toast(data.error || 'Deployment failed to start', 'error');
            if (dom.dashSectionDownload) dom.dashSectionDownload.style.display = 'none';
            if (dom['global_download_progress']) dom['global_download_progress'].style.display = 'none';
        } else {
            // Deploy started in background, polling continues until 100%
            toast('Deployment started on Mirza.', 'success');
        }
    } catch (e) {
        stopProgressPolling();
        state.isDownloading = false;
        toast(`Network Error: ${e.message}`, 'error');
        if (dom.dashSectionDownload) dom.dashSectionDownload.style.display = 'none';
    }
}

function startProgressPolling() {
    if (state.downloadInterval) clearInterval(state.downloadInterval);
    state.downloadInterval = setInterval(async () => {
        try {
            // 1. Fetch Progress Percent
            const resP = await fetch('/api/llm/download-status');
            const dataP = await resP.json();
            const p = parseInt(dataP.progress);

            if (p >= 0) {
                // Update Global Fallback
                if (dom['download_percent']) dom['download_percent'].innerText = `${p}%`;
                if (dom['download_progress_bar']) dom['download_progress_bar'].style.width = `${p}%`;

                // Update Dashboard Widget
                if (dom.dashDownloadPercent) dom.dashDownloadPercent.innerText = `${p}%`;
                if (dom.dashDownloadProgressBar) dom.dashDownloadProgressBar.style.width = `${p}%`;

                if (p === 100) {
                    toast('Download completed successfully!', 'success');
                    stopProgressPolling();
                    state.isDownloading = false;
                    loadModelsCatalog();
                    setTimeout(() => {
                        if (dom.dashSectionDownload) dom.dashSectionDownload.style.display = 'none';
                        if (dom['global_download_progress']) dom['global_download_progress'].style.display = 'none';
                    }, 5000);
                }
            }

            // 2. Fetch Deploy Logs
            const resL = await fetch('/api/llm/deploy-logs');
            const dataL = await resL.json();
            if (dataL.logs && dom.dashDownloadLogs) {
                const logs = dataL.logs.trim();
                if (logs !== dom.dashDownloadLogs.innerText) {
                    dom.dashDownloadLogs.innerText = logs;
                    dom.dashDownloadLogs.scrollTop = dom.dashDownloadLogs.scrollHeight;
                }
            }
        } catch (e) {
            console.warn("Polling error", e);
        }
    }, 2000);
}

function stopProgressPolling() {
    if (state.downloadInterval) {
        clearInterval(state.downloadInterval);
        state.downloadInterval = null;
    }
}

async function serveModel(hfRepo) {
    // Show Options Modal instead of starting immediately
    state.selectedInferenceModel = hfRepo;
    dom['overlay_inference'].classList.add('visible');
    
    // Call hardware suggest endpoint
    try {
        const modelName = hfRepo.split('/').pop();
        const res = await fetch(`/api/llm/suggest?model=${encodeURIComponent(modelName)}`);
        if (res.ok) {
            const advice = await res.json();
            console.log("Hardware Suggestion:", advice);
            
            // Apply suggestions to UI state
            state.inferenceConfig.ctx = advice.n_ctx;
            state.inferenceConfig.kv_q = advice.kv_q;
            
            // Update UI elements (chips)
            const chips = document.querySelectorAll('.ctx-chip');
            chips.forEach(chip => {
                if (parseInt(chip.dataset.val) === advice.n_ctx) {
                    chip.classList.add('active');
                } else {
                    chip.classList.remove('active');
                }
            });
            
            if (dom['option_kv_q']) dom['option_kv_q'].value = advice.kv_q;
            
            toast(advice.message || "Calcul des paramètres optimaux fini", "info");
        }
    } catch (e) {
        console.warn("Could not get hardware suggestions:", e);
    }
}

async function startServeWithConfig() {
    const hfRepo = state.selectedInferenceModel;
    dom['overlay_inference'].classList.remove('visible');

    toast(`Starting ${hfRepo.split('/').pop()} with your settings...`, 'info');
    try {
        const res = await fetch('/api/llm/serve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: hfRepo,
                perf: state.inferenceConfig
            })
        });
        const data = await res.json();
        toast(data.ok ? 'Server starting...' : (data.error || 'Error'), data.ok ? 'success' : 'error');

        if (data.ok) {
            // Update UI to show starting status
            triggerDashboardRefresh(5000); // Success response, slightly faster refresh once
        }
    } catch (e) {
        toast(`Error: ${e.message}`, 'error');
    }
}

window.deployModel = deployModel;
window.serveModel = serveModel;

// Auto-refresh logs interval
// Redundant interval removed, unified in startGlobalScheduler

// =================================================================
// Error Handling
// =================================================================
async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.config) {
            renderConfig(data.config);
        } else {
            dom.configContainer.innerHTML = `<div class="mcp-empty">${data.error || 'Configuration not found'}</div>`;
        }
    } catch (e) {
        dom.configContainer.innerHTML = `<div class="mcp-empty">Error: ${escapeHtml(e.message)}</div>`;
    }
}

function renderConfig(config) {
    const sectionMeta = {
        server: { icon: '&#9670;', label: 'Server' },
        system: { icon: '&#9881;', label: 'System' },
        hardware: { icon: '&#9879;', label: 'Hardware' },
        ai: { icon: '&#9733;', label: 'Artificial Intelligence' },
        monitoring: { icon: '&#9636;', label: 'Monitoring' },
    };

    // Override stale monitoring statuses with live data from dashboard
    const live = state.dashboardData;
    if (live && config.monitoring) {
        config.monitoring.grafana_status = live.grafana ? 'running' : 'stopped';
        if (live.server_online !== undefined) {
            config.monitoring.prometheus_status = live.server_online ? 'running' : 'stopped';
            config.monitoring.macmon_status = live.server_online ? 'running' : 'stopped';
        }
    }
    if (live && config.ai) {
        config.ai.api_status = live.llm_api ? 'running' : 'stopped';
        if (live.active_model) config.ai.active_model = live.active_model;
    }

    dom.configContainer.innerHTML = '';
    Object.entries(config).forEach(([section, entries]) => {
        const meta = sectionMeta[section] || { icon: '&#9632;', label: section };
        const el = document.createElement('div');
        el.className = 'config-section';

        let rows = '';
        Object.entries(entries).forEach(([key, val]) => {
            let valClass = 'config-val';
            let displayVal = escapeHtml(val);
            let isSensitive = (key === 'ip' || key === 'mac_address');

            if (val === 'true' || val === 'running') {
                valClass += ' config-val-ok';
            } else if (val === 'false' || val === 'stopped' || val === 'N/A' || val === 'none') {
                valClass += ' config-val-off';
            }

            if (isSensitive) {
                rows += `<div class="config-row">
                    <span class="config-key">${escapeHtml(key)}</span>
                    <span class="${valClass}" style="display: flex; align-items: center; gap: 8px;">
                        <span class="cfg-sensitive-val" data-real="${escapeHtml(val)}">••••••••••••</span>
                        <button class="btn-icon btn-icon-sm cfg-toggle-btn" title="Show/Hide" style="margin: 0; padding: 2px;">
                            <svg class="eye-closed" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.93A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>
                            <svg class="eye-open" style="display:none;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                    </span>
                </div>`;
            } else {
                rows += `<div class="config-row">
                    <span class="config-key">${escapeHtml(key)}</span>
                    <span class="${valClass}">${displayVal}</span>
                </div>`;
            }
        });
        el.innerHTML = `<div class="config-section-header"><span>${meta.icon}</span> ${meta.label}</div><div class="config-rows">${rows}</div>`;
        dom.configContainer.appendChild(el);
    });

    // Attach listeners to new toggle buttons
    dom.configContainer.querySelectorAll('.cfg-toggle-btn').forEach(btn => {
        btn.onclick = () => {
            const container = btn.parentElement;
            const textEl = container.querySelector('.cfg-sensitive-val');
            const isVisible = textEl.textContent !== '••••••••••••';
            
            if (isVisible) {
                textEl.textContent = '••••••••••••';
                btn.querySelector('.eye-closed').style.display = 'block';
                btn.querySelector('.eye-open').style.display = 'none';
            } else {
                textEl.textContent = textEl.dataset.real;
                btn.querySelector('.eye-closed').style.display = 'none';
                btn.querySelector('.eye-open').style.display = 'block';
            }
        };
    });
}

async function initMonitoring() {
    if (!dom.grafanaIframe) return;
    
    // Check if we already have a specialized URL
    if (state._monUrlLoaded) return;
    
    try {
        const res = await fetch('/api/llm/monitoring');
        const data = await res.json();
        if (data.ok && data.url) {
            console.log("Monitoring Auto-Discovery:", data.url);
            dom.grafanaIframe.src = data.url;
            state._monUrlLoaded = true;
        }
    } catch (e) {
        console.warn("Failed to discover monitoring URL:", e);
    }
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
    // Sampling
    state.settings.temperature = parseFloat(dom.settingTemperature?.value || 0.7);
    state.settings.top_p = parseFloat(dom.settingTopP?.value || 1.0);
    state.settings.top_n = parseInt(dom.settingTopN?.value || 40) || undefined;
    // Repetition
    state.settings.presence_penalty = parseFloat(dom.settingPresencePenalty?.value || 0);
    state.settings.frequency_penalty = parseFloat(dom.settingFrequencyPenalty?.value || 0);
    // Output
    state.settings.max_tokens = parseInt(dom.settingMaxTokens?.value || 4096);
    state.settings.stop = dom.settingStop?.value ? dom.settingStop.value.split(',').map(s => s.trim()).filter(s => s) : null;
    // System
    state.settings.systemPrompt = dom.settingSystemPrompt?.value || '';
    state.settings.mcpEndpoint = dom.settingMcpEndpoint?.value.replace(/\/+$/, '') || '';
    saveProvidersFromCards();
    saveState();
    checkProviderStatus();
}

// =================================================================
// Provider Status (Chat sidebar)
// =================================================================
async function checkProviderStatus() {
    const now = Date.now();
    // Reduced frequency: 15s debounce for sidebar status
    if (state._isStatusChecking || (state._lastStatusCheck && now - state._lastStatusCheck < 15000)) return;
    state._isStatusChecking = true;
    state._lastStatusCheck = now;

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
    } finally {
        state._isStatusChecking = false;
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
            item.innerHTML = `<div class="tool-icon"></div><div class="tool-info"><div class="tool-name">${escapeHtml(t.name)}</div><div class="tool-desc">${escapeHtml(t.description || '')}</div></div><input type="checkbox" class="mcp-tool-toggle" ${state.settings.mcpEnabled[t.name] !== false ? 'checked' : ''} data-tool="${escapeHtml(t.name)}" />`;
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
    saveState(); renderConversationsList(); updateChatView(); renderMessages(); updateContextProgress();
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
        <div class="message-header"><div class="message-avatar">${isU ? '' : '◈'}</div><span class="message-sender">${isU ? 'Vous' : escapeHtml(getActiveProvider().name)}</span></div>
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

function getStopTokens(format, modelName = "") {
    let f = format;
    const name = (modelName || "").toLowerCase();

    // Auto-detection based on model filename if not explicitly set
    if (!f || f === 'auto') {
        if (name.includes('qwen') || name.includes('yi') || name.includes('deepseek')) f = 'chatml';
        else if (name.includes('llama-3')) f = 'llama-3';
        else if (name.includes('mistral') || name.includes('mixtral')) f = 'mistral-instruct';
        else if (name.includes('gemma')) f = 'gemma';
        else if (name.includes('llama-2')) f = 'llama-2';
    }

    if (f === 'chatml') return ["<|im_end|>", "<|im_start|>", "<|endoftext|>", "Assistant:", "User:"];
    if (f === 'llama-3') return ["<|eot_id|>", "<|start_header_id|>"];
    if (f === 'mistral-instruct') return ["</s>", "[INST]", "[/INST]"];
    if (f === 'llama-2') return ["[/INST]", "</s>"];
    if (f === 'gemma') return ["<end_of_turn>", "<start_of_turn>"];
    
    // Safety net: common end tokens
    return ["<|im_end|>", "</s>", "<|eot_id|>"];
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
    saveState(); updateChatView(); renderMessages(); updateContextProgress();
    dom.messageInput.value = ''; dom.messageInput.style.height = 'auto';

    state.isStreaming = true;
    state.abortController = new AbortController();
    dom.btnSend.disabled = true;
    dom.btnSend.style.display = 'none';
    dom.btnStop.style.display = 'flex';
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

        const modelName = dom.modelSelect.value || provider.model || 'default';
        const stopTokens = getStopTokens(state.inferenceConfig.chat_format, modelName);
        
        const body = { 
            model: modelName, 
            messages: msgs, 
            max_tokens: state.settings.max_tokens || 4096, 
            temperature: state.settings.temperature || 0.7,
            top_p: state.settings.top_p ?? 1.0,
            top_n: state.settings.top_n || undefined,
            frequency_penalty: state.settings.frequency_penalty || 0.0,
            presence_penalty: state.settings.presence_penalty || 0.0,
            stop: stopTokens,
            stream: true 
        };
        
        // Only include additional params if they're set
        if (state.settings.seed !== null && state.settings.seed !== undefined) body.seed = parseInt(state.settings.seed);
        if (state.settings.response_format) body.response_format = state.settings.response_format;
        if (state.settings.logit_bias) body.logit_bias = state.settings.logit_bias;

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
                try { const p = JSON.parse(d); const delta = p.choices?.[0]?.delta?.content; if (delta) { full += delta; tokens++; updateStreamingMessage(streamEl, full); } } catch { }
            }
        }

        const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
        const tps = tokens > 0 ? (tokens / elapsed).toFixed(1) : '?';
        const meta = `${tokens} tokens · ${elapsed}s · ~${tps} tok/s · ${provider.name}`;
        conv.messages.push({ role: 'assistant', content: full, meta });
        saveState();
        if (conv.messages.length === 2) { conv.title = input.substring(0, 50) + (input.length > 50 ? '...' : ''); saveState(); renderConversationsList(); }
        finalizeStreamingMessage(streamEl, full, meta, conv.messages.length - 1);
        updateContextProgress();

    } catch (e) {
        if (e.name === 'AbortError') {
            streamEl.querySelector('.message-content').innerHTML = '<p><em>Annulé.</em></p>';
        } else {
            streamEl.querySelector('.message-content').innerHTML = `<p style="color:var(--color-error)"> ${escapeHtml(e.message)}</p>`;
        }
    } finally {
        state.isStreaming = false; state.abortController = null;
        dom.btnSend.disabled = false;
        dom.btnSend.style.display = 'flex';
        dom.btnStop.style.display = 'none';
        dom.messageInput.focus();
    }
}

// =================================================================
// Markdown & Code
// =================================================================
function renderMarkdown(text) {
    if (!text) return '';
    marked.setOptions({
        breaks: true, gfm: true, highlight: (code, lang) => {
            if (lang && hljs.getLanguage(lang)) try { return hljs.highlight(code, { language: lang }).value; } catch { }
            return hljs.highlightAuto(code).value;
        }
    });
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

function updateContextProgress() {
    const conv = getActiveConversation();
    if (!conv || !conv.messages?.length) {
        if (dom.contextProgress) dom.contextProgress.style.display = 'none';
        return;
    }
    
    const maxCtx = state.inferenceConfig.ctx || 8192;
    const tokens = estimateTokens(conv.messages.map(m => m.content).join(' '));
    const percent = Math.min(100, (tokens / maxCtx) * 100);
    
    if (dom.contextProgress) {
        dom.contextProgress.style.display = 'flex';
        if (dom.contextProgressFill) {
            dom.contextProgressFill.style.width = percent.toFixed(1) + '%';
            dom.contextProgressFill.className = 'context-progress-fill';
            if (percent > 80) dom.contextProgressFill.classList.add('warning');
            if (percent > 95) dom.contextProgressFill.classList.add('danger');
        }
        if (dom.contextProgressText) {
            const ctxLabel = maxCtx >= 1000 ? (maxCtx / 1000) + 'k' : maxCtx;
            dom.contextProgressText.textContent = `${tokens.toLocaleString()} / ${ctxLabel} tokens`;
        }
    }
}

function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

window.copyCode = copyCode;
window.deleteConversation = deleteConversation;
window.copyMessageContent = copyMessageContent;

// =================================================================
// Boot — observer removed to prevent infinite loops
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    init();
    bindModalEvents();
    bindInferenceEvents();
});

function bindModalEvents() {
    if (dom['btn_close_inference']) {
        dom['btn_close_inference'].onclick = () => {
            dom['overlay_inference'].classList.remove('visible');
        };
    }
    // Close on overlay click
    if (dom['overlay_inference']) {
        dom['overlay_inference'].onclick = (e) => {
            if (e.target === dom['overlay_inference']) {
                dom['overlay_inference'].classList.remove('visible');
            }
        };
    }
}

function bindInferenceEvents() {
    // Context chips
    const chips = document.querySelectorAll('.ctx-chip');
    chips.forEach(chip => {
        chip.onclick = () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.inferenceConfig.ctx = parseInt(chip.dataset.val);
            updateContextProgress();
        };
    });

    // Toggles
    if (dom['option_kv_q']) {
        dom['option_kv_q'].onchange = (e) => {
            const val = e.target.value;
            state.inferenceConfig.kv_q = val;
            
            // Safety dependency: Quantized KV requires Flash Attention
            if (val !== 'f16' && dom['option_flash_attn']) {
                dom['option_flash_attn'].checked = true;
                dom['option_flash_attn'].disabled = true;
                dom['option_flash_attn'].title = "Requis pour le cache KV quantisé";
                state.inferenceConfig.flash_attn = true;
            } else if (dom['option_flash_attn']) {
                dom['option_flash_attn'].disabled = false;
                dom['option_flash_attn'].title = "";
            }
        };
    }
    if (dom['option_flash_attn']) {
        dom['option_flash_attn'].onchange = (e) => state.inferenceConfig.flash_attn = e.target.checked;
    }
    if (dom['option_mlock']) {
        dom['option_mlock'].onchange = (e) => state.inferenceConfig.mlock = e.target.checked;
    }
    if (dom['option_warmup']) {
        dom['option_warmup'].onchange = (e) => state.inferenceConfig.warmup = e.target.checked;
    }
    if (dom['option_chat_format']) {
        dom['option_chat_format'].onchange = (e) => state.inferenceConfig.chat_format = e.target.value;
    }
    
    // Tuning options
    if (dom['option_tune']) {
        dom['option_tune'].onchange = (e) => {
            state.inferenceConfig.tune = e.target.checked;
            const tuneOptions = document.getElementById('tune-options');
            if (tuneOptions) tuneOptions.style.display = e.target.checked ? 'block' : 'none';
        };
    }
    if (dom['option_trials']) {
        dom['option_trials'].onchange = (e) => state.inferenceConfig.trials = parseInt(e.target.value);
    }
    if (dom['option_metric']) {
        dom['option_metric'].onchange = (e) => state.inferenceConfig.metric = e.target.value;
    }

    if (dom['btn_start_serve']) {
        dom['btn_start_serve'].onclick = startServeWithConfig;
    }
}
