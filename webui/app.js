/* ═══════════════════════════════════════════════════════════════
   Mirza AI — Chat Application Logic
   Multi-provider support, MCP tools, streaming, conversations
   ═══════════════════════════════════════════════════════════════ */

// =================================================================
// Default Providers
// =================================================================
const DEFAULT_PROVIDERS = [
    {
        id: 'mirza-local',
        name: 'Mirza (Local MLX)',
        type: 'local',
        endpoint: 'http://localhost:8080',
        apiKey: '',
        model: '',
        description: 'Serveur MLX local sur Apple Silicon'
    },
    {
        id: 'openai',
        name: 'OpenAI',
        type: 'cloud',
        endpoint: 'https://api.openai.com',
        apiKey: '',
        model: 'gpt-4o-mini',
        description: 'API Cloud OpenAI (nécessite une clé API)'
    },
    {
        id: 'anthropic-openai',
        name: 'Anthropic (compatible)',
        type: 'cloud',
        endpoint: 'https://api.anthropic.com/v1',
        apiKey: '',
        model: 'claude-sonnet-4-20250514',
        description: 'API Anthropic via proxy compatible OpenAI'
    },
    {
        id: 'groq',
        name: 'Groq',
        type: 'cloud',
        endpoint: 'https://api.groq.com/openai',
        apiKey: '',
        model: 'llama-3.3-70b-versatile',
        description: 'Inférence ultra-rapide sur Groq Cloud'
    },
    {
        id: 'mistral',
        name: 'Mistral AI',
        type: 'cloud',
        endpoint: 'https://api.mistral.ai',
        apiKey: '',
        model: 'mistral-small-latest',
        description: 'API Mistral AI (français natif)'
    },
    {
        id: 'ollama',
        name: 'Ollama (Local)',
        type: 'local',
        endpoint: 'http://localhost:11434',
        apiKey: '',
        model: '',
        description: 'Serveur Ollama local'
    }
];

// =================================================================
// State
// =================================================================
const state = {
    conversations: [],
    activeConversationId: null,
    isStreaming: false,
    abortController: null,
    providers: [],
    activeProviderId: 'mirza-local',
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
const dom = {
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    conversationsList: document.getElementById('conversations-list'),
    welcomeScreen: document.getElementById('welcome-screen'),
    messagesContainer: document.getElementById('messages-container'),
    messagesScroll: document.getElementById('messages-scroll'),
    messageInput: document.getElementById('message-input'),
    btnSend: document.getElementById('btn-send'),
    btnNewChat: document.getElementById('btn-new-chat'),
    providerSelect: document.getElementById('provider-select'),
    modelSelect: document.getElementById('model-select'),
    statusDot: document.getElementById('status-dot'),
    tokenCounter: document.getElementById('token-counter'),
    settingsModal: document.getElementById('settings-modal'),
    btnSettings: document.getElementById('btn-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingTemperature: document.getElementById('setting-temperature'),
    temperatureValue: document.getElementById('temperature-value'),
    settingMaxTokens: document.getElementById('setting-max-tokens'),
    settingSystemPrompt: document.getElementById('setting-system-prompt'),
    settingMcpEndpoint: document.getElementById('setting-mcp-endpoint'),
    mcpToolsList: document.getElementById('mcp-tools-list'),
    btnRefreshMcp: document.getElementById('btn-refresh-mcp'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    btnExportConversations: document.getElementById('btn-export-conversations'),
    btnAddProvider: document.getElementById('btn-add-provider'),
    providersList: document.getElementById('providers-list'),
    linkGrafana: document.getElementById('link-grafana'),
};

// =================================================================
// Initialization
// =================================================================
function init() {
    loadState();
    setupEventListeners();
    renderProviderSelect();
    renderConversationsList();
    updateView();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
}

function loadState() {
    try {
        const saved = localStorage.getItem('mirza_conversations');
        if (saved) state.conversations = JSON.parse(saved);
    } catch(e) { state.conversations = []; }

    try {
        const settings = localStorage.getItem('mirza_settings');
        if (settings) Object.assign(state.settings, JSON.parse(settings));
    } catch(e) {}

    try {
        const providers = localStorage.getItem('mirza_providers');
        if (providers) {
            state.providers = JSON.parse(providers);
        } else {
            state.providers = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));
        }
    } catch(e) {
        state.providers = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));
    }

    state.activeProviderId = localStorage.getItem('mirza_active_provider') || 'mirza-local';
    state.activeConversationId = localStorage.getItem('mirza_active_conversation');

    // Apply settings to UI
    dom.settingTemperature.value = state.settings.temperature;
    dom.temperatureValue.textContent = state.settings.temperature;
    dom.settingMaxTokens.value = state.settings.maxTokens;
    dom.settingSystemPrompt.value = state.settings.systemPrompt;
    dom.settingMcpEndpoint.value = state.settings.mcpEndpoint || '';

    updateGrafanaLink();
}

function saveState() {
    localStorage.setItem('mirza_conversations', JSON.stringify(state.conversations));
    localStorage.setItem('mirza_settings', JSON.stringify(state.settings));
    localStorage.setItem('mirza_providers', JSON.stringify(state.providers));
    localStorage.setItem('mirza_active_provider', state.activeProviderId);
    if (state.activeConversationId) {
        localStorage.setItem('mirza_active_conversation', state.activeConversationId);
    }
}

function getActiveProvider() {
    return state.providers.find(p => p.id === state.activeProviderId) || state.providers[0];
}

function updateGrafanaLink() {
    const provider = getActiveProvider();
    try {
        const host = new URL(provider.endpoint).hostname;
        if (host === 'localhost' || host.endsWith('.local')) {
            dom.linkGrafana.href = `http://${host}:3000`;
        }
    } catch(e) {}
}

// =================================================================
// Event Listeners
// =================================================================
function setupEventListeners() {
    dom.btnSend.addEventListener('click', sendMessage);
    dom.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    dom.messageInput.addEventListener('input', autoResize);
    dom.btnNewChat.addEventListener('click', newConversation);

    // Sidebar toggle
    dom.sidebarToggle.addEventListener('click', () => dom.sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && dom.sidebar.classList.contains('open') &&
            !dom.sidebar.contains(e.target) && e.target !== dom.sidebarToggle) {
            dom.sidebar.classList.remove('open');
        }
    });

    // Provider selector in sidebar
    dom.providerSelect.addEventListener('change', (e) => {
        state.activeProviderId = e.target.value;
        saveState();
        updateGrafanaLink();
        checkServerStatus();
        renderProviderCards();
    });

    // Settings modal
    dom.btnSettings.addEventListener('click', () => {
        renderProviderCards();
        dom.settingsModal.classList.add('visible');
    });
    dom.btnCloseSettings.addEventListener('click', () => {
        dom.settingsModal.classList.remove('visible');
        saveSettings();
    });
    dom.settingsModal.addEventListener('click', (e) => {
        if (e.target === dom.settingsModal) { dom.settingsModal.classList.remove('visible'); saveSettings(); }
    });

    // Tabs
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    dom.settingTemperature.addEventListener('input', (e) => {
        dom.temperatureValue.textContent = e.target.value;
    });

    // Provider management
    dom.btnAddProvider.addEventListener('click', addCustomProvider);

    // MCP
    dom.btnRefreshMcp.addEventListener('click', refreshMcpTools);

    // Export
    dom.btnExportConversations.addEventListener('click', exportConversations);

    // Clear history
    dom.btnClearHistory.addEventListener('click', () => {
        if (confirm('Supprimer toutes les conversations ?')) {
            state.conversations = [];
            state.activeConversationId = null;
            saveState();
            renderConversationsList();
            updateView();
            dom.settingsModal.classList.remove('visible');
        }
    });

    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            dom.messageInput.value = chip.dataset.prompt;
            autoResize();
            sendMessage();
        });
    });
}

function autoResize() {
    const el = dom.messageInput;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

function saveSettings() {
    state.settings.temperature = parseFloat(dom.settingTemperature.value);
    state.settings.maxTokens = parseInt(dom.settingMaxTokens.value);
    state.settings.systemPrompt = dom.settingSystemPrompt.value;
    state.settings.mcpEndpoint = dom.settingMcpEndpoint.value.replace(/\/+$/, '');
    saveProvidersFromCards();
    saveState();
    checkServerStatus();
}

// =================================================================
// Provider Management
// =================================================================
function renderProviderSelect() {
    dom.providerSelect.innerHTML = '';
    state.providers.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
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
                    ${isActive ? '<span class="provider-type-badge local" style="font-size:10px;">ACTIF</span>' : ''}
                </div>
                <div class="provider-card-actions">
                    ${!isActive ? `<button class="btn-icon" onclick="setActiveProvider('${p.id}')" title="Utiliser ce provider">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
                    </button>` : ''}
                    ${!isBuiltin ? `<button class="btn-icon" onclick="deleteProvider('${p.id}')" title="Supprimer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>` : ''}
                </div>
            </div>
            <div class="provider-card-fields">
                <div class="provider-field">
                    <label>Endpoint</label>
                    <input type="text" value="${escapeHtml(p.endpoint)}" data-field="endpoint" placeholder="https://api.example.com" />
                </div>
                <div class="provider-field">
                    <label>Clé API ${p.type === 'local' ? '(optionnelle)' : ''}</label>
                    <input type="password" value="${escapeHtml(p.apiKey || '')}" data-field="apiKey" placeholder="${p.type === 'local' ? 'Laisser vide pour local' : 'sk-...'}" />
                </div>
                <div class="provider-field">
                    <label>Modèle (override — vide = auto-détection)</label>
                    <input type="text" value="${escapeHtml(p.model || '')}" data-field="model" placeholder="ex: gpt-4o, llama-3.2-3b..." />
                </div>
            </div>
        `;

        dom.providersList.appendChild(card);
    });
}

function saveProvidersFromCards() {
    document.querySelectorAll('.provider-card').forEach(card => {
        const id = card.dataset.providerId;
        const provider = state.providers.find(p => p.id === id);
        if (!provider) return;
        card.querySelectorAll('[data-field]').forEach(input => {
            provider[input.dataset.field] = input.value;
        });
    });
    renderProviderSelect();
}

function addCustomProvider() {
    const newProvider = {
        id: 'custom_' + Date.now(),
        name: 'Nouveau Provider',
        type: 'custom',
        endpoint: 'http://localhost:8080',
        apiKey: '',
        model: '',
        description: ''
    };
    state.providers.push(newProvider);
    saveState();
    renderProviderSelect();
    renderProviderCards();
}

function deleteProvider(id) {
    state.providers = state.providers.filter(p => p.id !== id);
    if (state.activeProviderId === id) {
        state.activeProviderId = state.providers[0]?.id || 'mirza-local';
    }
    saveState();
    renderProviderSelect();
    renderProviderCards();
}

function setActiveProvider(id) {
    state.activeProviderId = id;
    dom.providerSelect.value = id;
    saveState();
    updateGrafanaLink();
    checkServerStatus();
    renderProviderCards();
}

// Expose for inline onclick
window.setActiveProvider = setActiveProvider;
window.deleteProvider = deleteProvider;

// =================================================================
// Server Status
// =================================================================
async function checkServerStatus() {
    dom.statusDot.className = 'status-dot loading';

    const provider = getActiveProvider();
    const headers = { 'Content-Type': 'application/json' };
    if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

    try {
        const response = await fetch(`${provider.endpoint}/v1/models`, {
            headers,
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            const data = await response.json();
            dom.statusDot.className = 'status-dot online';

            dom.modelSelect.innerHTML = '';

            // If provider has a forced model, just show that
            if (provider.model) {
                const opt = document.createElement('option');
                opt.value = provider.model;
                opt.textContent = provider.model;
                dom.modelSelect.appendChild(opt);
            }

            // Add models from API response
            if (data.data && data.data.length > 0) {
                data.data.forEach(model => {
                    // Skip if already added as forced model
                    if (model.id === provider.model) return;
                    const opt = document.createElement('option');
                    opt.value = model.id;
                    const shortName = model.id.split('/').pop();
                    opt.textContent = shortName;
                    opt.title = model.id;
                    dom.modelSelect.appendChild(opt);
                });
            }

            // Select the forced model if present
            if (provider.model) dom.modelSelect.value = provider.model;
        } else {
            throw new Error('Server error');
        }
    } catch (e) {
        dom.statusDot.className = 'status-dot offline';

        dom.modelSelect.innerHTML = '';
        if (provider.model) {
            const opt = document.createElement('option');
            opt.value = provider.model;
            opt.textContent = `${provider.model} (hors ligne)`;
            dom.modelSelect.appendChild(opt);
        } else {
            dom.modelSelect.innerHTML = '<option value="">Hors ligne</option>';
        }
    }
}

// =================================================================
// MCP Tools
// =================================================================
async function refreshMcpTools() {
    const mcpEndpoint = dom.settingMcpEndpoint.value.replace(/\/+$/, '');
    if (!mcpEndpoint) {
        dom.mcpToolsList.innerHTML = '<div class="mcp-empty">Aucun endpoint MCP configuré</div>';
        return;
    }

    dom.mcpToolsList.innerHTML = '<div class="mcp-empty">Connexion au serveur MCP...</div>';

    try {
        const response = await fetch(`${mcpEndpoint}/tools`, {
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            const data = await response.json();
            const tools = data.tools || data || [];
            state.settings.mcpTools = tools;

            if (tools.length === 0) {
                dom.mcpToolsList.innerHTML = '<div class="mcp-empty">Serveur connecté — aucun outil disponible</div>';
                return;
            }

            dom.mcpToolsList.innerHTML = '';
            tools.forEach(tool => {
                const enabled = state.settings.mcpEnabled[tool.name] !== false;
                const item = document.createElement('div');
                item.className = 'mcp-tool-item';
                item.innerHTML = `
                    <div class="tool-icon">🔧</div>
                    <div class="tool-info">
                        <div class="tool-name">${escapeHtml(tool.name)}</div>
                        <div class="tool-desc">${escapeHtml(tool.description || '')}</div>
                    </div>
                    <input type="checkbox" class="mcp-tool-toggle" ${enabled ? 'checked' : ''} data-tool="${escapeHtml(tool.name)}" />
                `;
                item.querySelector('.mcp-tool-toggle').addEventListener('change', (e) => {
                    state.settings.mcpEnabled[e.target.dataset.tool] = e.target.checked;
                    saveState();
                });
                dom.mcpToolsList.appendChild(item);
            });
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (e) {
        dom.mcpToolsList.innerHTML = `<div class="mcp-empty">Erreur: ${escapeHtml(e.message)}</div>`;
    }
}

function getEnabledMcpTools() {
    if (!state.settings.mcpEndpoint || !state.settings.mcpTools.length) return [];
    return state.settings.mcpTools.filter(t => state.settings.mcpEnabled[t.name] !== false);
}

// =================================================================
// Conversations Management
// =================================================================
function newConversation() {
    state.activeConversationId = null;
    updateView();
    dom.messageInput.focus();
    dom.sidebar.classList.remove('open');
}

function createConversation(firstMessage) {
    const provider = getActiveProvider();
    const conv = {
        id: 'conv_' + Date.now(),
        title: firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : ''),
        messages: [],
        providerId: provider.id,
        providerName: provider.name,
        createdAt: new Date().toISOString()
    };
    state.conversations.unshift(conv);
    state.activeConversationId = conv.id;
    saveState();
    renderConversationsList();
    return conv;
}

function getActiveConversation() {
    return state.conversations.find(c => c.id === state.activeConversationId);
}

function deleteConversation(id) {
    state.conversations = state.conversations.filter(c => c.id !== id);
    if (state.activeConversationId === id) {
        state.activeConversationId = null;
        updateView();
    }
    saveState();
    renderConversationsList();
}

function switchConversation(id) {
    state.activeConversationId = id;
    saveState();
    renderConversationsList();
    updateView();
    renderMessages();
    dom.sidebar.classList.remove('open');
}

function renderConversationsList() {
    dom.conversationsList.innerHTML = '';
    if (state.conversations.length === 0) {
        dom.conversationsList.innerHTML = `<div style="padding:12px;color:var(--color-text-tertiary);font-size:var(--text-sm);text-align:center;">Aucune conversation</div>`;
        return;
    }
    state.conversations.forEach(conv => {
        const item = document.createElement('button');
        item.className = 'conversation-item' + (conv.id === state.activeConversationId ? ' active' : '');
        item.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:0.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span class="conv-title">${escapeHtml(conv.title)}</span>
            <button class="conv-delete" title="Supprimer" onclick="event.stopPropagation(); deleteConversation('${conv.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        `;
        item.addEventListener('click', () => switchConversation(conv.id));
        dom.conversationsList.appendChild(item);
    });
}

function exportConversations() {
    const blob = new Blob([JSON.stringify(state.conversations, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mirza-conversations-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// =================================================================
// View Management
// =================================================================
function updateView() {
    const conv = getActiveConversation();
    if (!conv || conv.messages.length === 0) {
        dom.welcomeScreen.style.display = 'flex';
        dom.messagesContainer.classList.remove('visible');
    } else {
        dom.welcomeScreen.style.display = 'none';
        dom.messagesContainer.classList.add('visible');
    }
}

// =================================================================
// Message Rendering
// =================================================================
function renderMessages() {
    const conv = getActiveConversation();
    if (!conv) return;
    dom.messagesScroll.innerHTML = '';
    conv.messages.forEach((msg, idx) => appendMessageToDOM(msg, idx));
    scrollToBottom();
}

function appendMessageToDOM(msg, index) {
    const el = document.createElement('div');
    el.className = `message ${msg.role}`;
    el.id = `msg-${index}`;

    const isUser = msg.role === 'user';
    const avatar = isUser ? '👤' : '◈';
    const sender = isUser ? 'Vous' : (getActiveConversation()?.providerName || 'Mirza');

    let contentHtml = msg.role === 'assistant' ? renderMarkdown(msg.content) : `<p>${escapeHtml(msg.content)}</p>`;

    el.innerHTML = `
        <div class="message-header">
            <div class="message-avatar">${avatar}</div>
            <span class="message-sender">${escapeHtml(sender)}</span>
        </div>
        <div class="message-content">${contentHtml}</div>
        ${msg.role === 'assistant' ? `
        <div class="message-actions">
            <button class="message-action-btn" onclick="copyMessageContent(${index})" title="Copier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copier
            </button>
        </div>
        ${msg.meta ? `<div class="message-meta">${msg.meta}</div>` : ''}` : ''}
    `;
    dom.messagesScroll.appendChild(el);
    enhanceCodeBlocks(el);
}

function createStreamingMessage() {
    const el = document.createElement('div');
    el.className = 'message assistant';
    el.innerHTML = `
        <div class="message-header">
            <div class="message-avatar">◈</div>
            <span class="message-sender">${escapeHtml(getActiveProvider().name)}</span>
        </div>
        <div class="message-content">
            <div class="typing-indicator"><span></span><span></span><span></span></div>
        </div>
    `;
    dom.messagesScroll.appendChild(el);
    scrollToBottom();
    return el;
}

function updateStreamingMessage(el, content) {
    const contentEl = el.querySelector('.message-content');
    contentEl.innerHTML = renderMarkdown(content) + '<span class="streaming-cursor"></span>';
    enhanceCodeBlocks(el);
    scrollToBottom();
}

function finalizeStreamingMessage(el, content, meta) {
    const conv = getActiveConversation();
    const index = conv ? conv.messages.length : 0;
    const contentEl = el.querySelector('.message-content');
    contentEl.innerHTML = renderMarkdown(content);
    enhanceCodeBlocks(el);
    const actionsHtml = `
        <div class="message-actions">
            <button class="message-action-btn" onclick="copyMessageContent(${index})" title="Copier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copier
            </button>
        </div>
        ${meta ? `<div class="message-meta">${meta}</div>` : ''}
    `;
    contentEl.insertAdjacentHTML('afterend', actionsHtml);
    scrollToBottom();
}

// =================================================================
// Markdown Rendering
// =================================================================
function renderMarkdown(text) {
    if (!text) return '';
    marked.setOptions({
        breaks: true, gfm: true,
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try { return hljs.highlight(code, { language: lang }).value; } catch(e) {}
            }
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
        const code = block.textContent;
        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = `
            <span>${lang || 'code'}</span>
            <button class="btn-copy" onclick="copyCode(this, \`${btoa(encodeURIComponent(code))}\`)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copier
            </button>
        `;
        pre.insertBefore(header, block);
    });
}

// =================================================================
// Send Message & API
// =================================================================
async function sendMessage() {
    const input = dom.messageInput.value.trim();
    if (!input || state.isStreaming) return;

    let conv = getActiveConversation();
    if (!conv) conv = createConversation(input);

    conv.messages.push({ role: 'user', content: input });
    saveState();
    updateView();
    renderMessages();

    dom.messageInput.value = '';
    dom.messageInput.style.height = 'auto';

    state.isStreaming = true;
    dom.btnSend.disabled = true;
    const streamEl = createStreamingMessage();

    try {
        const startTime = performance.now();
        let fullContent = '';
        let tokenCount = 0;

        const provider = getActiveProvider();
        const apiMessages = [];
        if (state.settings.systemPrompt) {
            apiMessages.push({ role: 'system', content: state.settings.systemPrompt });
        }
        conv.messages.forEach(m => apiMessages.push({ role: m.role, content: m.content }));

        // Build headers
        const headers = { 'Content-Type': 'application/json' };
        if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

        // Build request body
        const body = {
            model: dom.modelSelect.value || provider.model || 'default',
            messages: apiMessages,
            max_tokens: state.settings.maxTokens,
            temperature: state.settings.temperature,
            stream: true
        };

        // Add tools if MCP is configured and tools are enabled
        const enabledTools = getEnabledMcpTools();
        if (enabledTools.length > 0) {
            body.tools = enabledTools.map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description || '',
                    parameters: t.inputSchema || t.parameters || {}
                }
            }));
        }

        state.abortController = new AbortController();

        const response = await fetch(`${provider.endpoint}/v1/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: state.abortController.signal
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`${response.status} ${response.statusText}: ${errorBody.substring(0, 200)}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                const data = trimmed.slice(6);
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                        tokenCount++;
                        updateStreamingMessage(streamEl, fullContent);
                    }
                } catch(e) {}
            }
        }

        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        const tokPerSec = tokenCount > 0 ? (tokenCount / elapsed).toFixed(1) : '?';
        const meta = `${tokenCount} tokens · ${elapsed}s · ~${tokPerSec} tok/s · ${provider.name}`;

        conv.messages.push({ role: 'assistant', content: fullContent, meta });
        saveState();

        if (conv.messages.length === 2) {
            conv.title = input.substring(0, 50) + (input.length > 50 ? '...' : '');
            saveState();
            renderConversationsList();
        }

        finalizeStreamingMessage(streamEl, fullContent, meta);

    } catch (e) {
        if (e.name === 'AbortError') {
            streamEl.querySelector('.message-content').innerHTML = '<p><em>Génération annulée.</em></p>';
        } else {
            console.error('API Error:', e);
            streamEl.querySelector('.message-content').innerHTML = `
                <p style="color: var(--color-error);">
                    ⚠️ Erreur de connexion.<br>
                    <span style="font-size: var(--text-sm); color: var(--color-text-tertiary);">
                        ${escapeHtml(e.message)}<br>
                        Provider: <code>${escapeHtml(getActiveProvider().name)}</code>
                    </span>
                </p>
            `;
        }
    } finally {
        state.isStreaming = false;
        state.abortController = null;
        dom.btnSend.disabled = false;
        dom.messageInput.focus();
    }
}

// =================================================================
// Utility Functions
// =================================================================
function scrollToBottom() {
    requestAnimationFrame(() => dom.messagesScroll.scrollTop = dom.messagesScroll.scrollHeight);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function copyCode(btn, encodedCode) {
    const code = decodeURIComponent(atob(encodedCode));
    navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Copié !`;
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copier`;
        }, 2000);
    });
}

function copyMessageContent(index) {
    const conv = getActiveConversation();
    if (conv && conv.messages[index]) navigator.clipboard.writeText(conv.messages[index].content);
}

window.copyCode = copyCode;
window.deleteConversation = deleteConversation;
window.copyMessageContent = copyMessageContent;

// =================================================================
// Boot
// =================================================================
document.addEventListener('DOMContentLoaded', init);
