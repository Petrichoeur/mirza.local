/* ═══════════════════════════════════════════════════════════════
   Mirza AI — Chat Application Logic
   Handles conversation management, API calls, streaming, and UI
   ═══════════════════════════════════════════════════════════════ */

// =================================================================
// State
// =================================================================
const state = {
    conversations: [],       // { id, title, messages[], createdAt }
    activeConversationId: null,
    isStreaming: false,
    abortController: null,
    settings: {
        endpoint: 'http://localhost:8080',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: 'Tu es Mirza, un assistant IA intelligent et serviable. Tu réponds de manière claire, précise et concise en français.'
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
    modelSelect: document.getElementById('model-select'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    tokenCounter: document.getElementById('token-counter'),
    settingsModal: document.getElementById('settings-modal'),
    btnSettings: document.getElementById('btn-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingEndpoint: document.getElementById('setting-endpoint'),
    settingTemperature: document.getElementById('setting-temperature'),
    temperatureValue: document.getElementById('temperature-value'),
    settingMaxTokens: document.getElementById('setting-max-tokens'),
    settingSystemPrompt: document.getElementById('setting-system-prompt'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    linkGrafana: document.getElementById('link-grafana'),
};

// =================================================================
// Initialization
// =================================================================
function init() {
    loadState();
    setupEventListeners();
    checkServerStatus();
    renderConversationsList();
    updateView();

    // Periodic status check
    setInterval(checkServerStatus, 15000);
}

function loadState() {
    // Load conversations from localStorage
    const saved = localStorage.getItem('mirza_conversations');
    if (saved) {
        try { state.conversations = JSON.parse(saved); } catch(e) { state.conversations = []; }
    }

    // Load settings
    const settings = localStorage.getItem('mirza_settings');
    if (settings) {
        try { Object.assign(state.settings, JSON.parse(settings)); } catch(e) {}
    }

    // Load active conversation
    state.activeConversationId = localStorage.getItem('mirza_active_conversation');

    // Apply settings to UI
    dom.settingEndpoint.value = state.settings.endpoint;
    dom.settingTemperature.value = state.settings.temperature;
    dom.temperatureValue.textContent = state.settings.temperature;
    dom.settingMaxTokens.value = state.settings.maxTokens;
    dom.settingSystemPrompt.value = state.settings.systemPrompt;

    // Grafana link
    const host = new URL(state.settings.endpoint).hostname;
    dom.linkGrafana.href = `http://${host}:3000`;
}

function saveState() {
    localStorage.setItem('mirza_conversations', JSON.stringify(state.conversations));
    localStorage.setItem('mirza_settings', JSON.stringify(state.settings));
    if (state.activeConversationId) {
        localStorage.setItem('mirza_active_conversation', state.activeConversationId);
    }
}

// =================================================================
// Event Listeners
// =================================================================
function setupEventListeners() {
    // Send message
    dom.btnSend.addEventListener('click', sendMessage);
    dom.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    dom.messageInput.addEventListener('input', autoResize);

    // New chat
    dom.btnNewChat.addEventListener('click', newConversation);

    // Sidebar toggle (mobile)
    dom.sidebarToggle.addEventListener('click', () => {
        dom.sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            dom.sidebar.classList.contains('open') &&
            !dom.sidebar.contains(e.target) &&
            e.target !== dom.sidebarToggle) {
            dom.sidebar.classList.remove('open');
        }
    });

    // Settings modal
    dom.btnSettings.addEventListener('click', () => {
        dom.settingsModal.classList.add('visible');
    });
    dom.btnCloseSettings.addEventListener('click', () => {
        dom.settingsModal.classList.remove('visible');
        saveSettings();
    });
    dom.settingsModal.addEventListener('click', (e) => {
        if (e.target === dom.settingsModal) {
            dom.settingsModal.classList.remove('visible');
            saveSettings();
        }
    });

    // Temperature slider
    dom.settingTemperature.addEventListener('input', (e) => {
        dom.temperatureValue.textContent = e.target.value;
    });

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
    state.settings.endpoint = dom.settingEndpoint.value.replace(/\/+$/, '');
    state.settings.temperature = parseFloat(dom.settingTemperature.value);
    state.settings.maxTokens = parseInt(dom.settingMaxTokens.value);
    state.settings.systemPrompt = dom.settingSystemPrompt.value;
    saveState();
    checkServerStatus();

    // Update Grafana link
    try {
        const host = new URL(state.settings.endpoint).hostname;
        dom.linkGrafana.href = `http://${host}:3000`;
    } catch(e) {}
}

// =================================================================
// Server Status
// =================================================================
async function checkServerStatus() {
    dom.statusDot.className = 'status-dot loading';
    dom.statusText.textContent = 'Vérification...';

    try {
        const response = await fetch(`${state.settings.endpoint}/v1/models`, {
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            const data = await response.json();
            dom.statusDot.className = 'status-dot online';
            dom.statusText.textContent = 'En ligne';

            // Populate model selector
            dom.modelSelect.innerHTML = '';
            if (data.data && data.data.length > 0) {
                data.data.forEach(model => {
                    const opt = document.createElement('option');
                    opt.value = model.id;
                    // Shorten display name
                    const shortName = model.id.split('/').pop();
                    opt.textContent = shortName;
                    opt.title = model.id;
                    dom.modelSelect.appendChild(opt);
                });
            }
        } else {
            throw new Error('Server error');
        }
    } catch (e) {
        dom.statusDot.className = 'status-dot offline';
        dom.statusText.textContent = 'Hors ligne';
        dom.modelSelect.innerHTML = '<option value="">Serveur indisponible</option>';
    }
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
    const conv = {
        id: 'conv_' + Date.now(),
        title: firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : ''),
        messages: [],
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
        dom.conversationsList.innerHTML = `
            <div style="padding: 12px; color: var(--color-text-tertiary); font-size: var(--text-sm); text-align: center;">
                Aucune conversation
            </div>
        `;
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
    conv.messages.forEach((msg, idx) => {
        appendMessageToDOM(msg, idx);
    });
    scrollToBottom();
}

function appendMessageToDOM(msg, index) {
    const el = document.createElement('div');
    el.className = `message ${msg.role}`;
    el.id = `msg-${index}`;

    const isUser = msg.role === 'user';
    const avatar = isUser ? '👤' : '◈';
    const sender = isUser ? 'Vous' : 'Mirza';

    let contentHtml = '';
    if (msg.role === 'assistant') {
        contentHtml = renderMarkdown(msg.content);
    } else {
        contentHtml = `<p>${escapeHtml(msg.content)}</p>`;
    }

    el.innerHTML = `
        <div class="message-header">
            <div class="message-avatar">${avatar}</div>
            <span class="message-sender">${sender}</span>
        </div>
        <div class="message-content">${contentHtml}</div>
        ${msg.role === 'assistant' ? `
        <div class="message-actions">
            <button class="message-action-btn" onclick="copyMessageContent(${index})" title="Copier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copier
            </button>
        </div>
        ${msg.meta ? `<div class="message-meta">${msg.meta}</div>` : ''}
        ` : ''}
    `;

    dom.messagesScroll.appendChild(el);
    enhanceCodeBlocks(el);
}

function createStreamingMessage() {
    const conv = getActiveConversation();
    const index = conv.messages.length;

    const el = document.createElement('div');
    el.className = 'message assistant';
    el.id = `msg-${index}`;

    el.innerHTML = `
        <div class="message-header">
            <div class="message-avatar">◈</div>
            <span class="message-sender">Mirza</span>
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
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
    const index = conv.messages.length;

    const contentEl = el.querySelector('.message-content');
    contentEl.innerHTML = renderMarkdown(content);
    enhanceCodeBlocks(el);

    // Add actions
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

    // Configure marked
    marked.setOptions({
        breaks: true,
        gfm: true,
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
        // Avoid double-processing
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

    // Create or get conversation
    let conv = getActiveConversation();
    if (!conv) {
        conv = createConversation(input);
    }

    // Add user message
    conv.messages.push({ role: 'user', content: input });
    saveState();
    updateView();
    renderMessages();

    // Clear input
    dom.messageInput.value = '';
    dom.messageInput.style.height = 'auto';

    // Start streaming
    state.isStreaming = true;
    dom.btnSend.disabled = true;
    const streamEl = createStreamingMessage();

    try {
        const startTime = performance.now();
        let fullContent = '';
        let tokenCount = 0;

        // Build messages array with system prompt
        const apiMessages = [];
        if (state.settings.systemPrompt) {
            apiMessages.push({ role: 'system', content: state.settings.systemPrompt });
        }
        conv.messages.forEach(m => {
            apiMessages.push({ role: m.role, content: m.content });
        });

        state.abortController = new AbortController();

        const response = await fetch(`${state.settings.endpoint}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: dom.modelSelect.value || 'default',
                messages: apiMessages,
                max_tokens: state.settings.maxTokens,
                temperature: state.settings.temperature,
                stream: true
            }),
            signal: state.abortController.signal
        });

        if (!response.ok) {
            throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

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
                } catch(e) {
                    // Ignore parse errors for incomplete chunks
                }
            }
        }

        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        const tokPerSec = tokenCount > 0 ? (tokenCount / (elapsed)).toFixed(1) : '?';
        const meta = `${tokenCount} tokens · ${elapsed}s · ~${tokPerSec} tok/s`;

        // Save assistant message
        conv.messages.push({ role: 'assistant', content: fullContent, meta });
        saveState();

        // Update conversation title if it's the first exchange
        if (conv.messages.length === 2) {
            conv.title = input.substring(0, 50) + (input.length > 50 ? '...' : '');
            saveState();
            renderConversationsList();
        }

        finalizeStreamingMessage(streamEl, fullContent, meta);

    } catch (e) {
        if (e.name === 'AbortError') {
            // User cancelled
            streamEl.querySelector('.message-content').innerHTML = '<p><em>Génération annulée.</em></p>';
        } else {
            console.error('API Error:', e);
            streamEl.querySelector('.message-content').innerHTML = `
                <p style="color: var(--color-error);">
                    ⚠️ Erreur de connexion au serveur MLX.<br>
                    <span style="font-size: var(--text-sm); color: var(--color-text-tertiary);">
                        ${escapeHtml(e.message)}<br>
                        Vérifiez que le serveur tourne : <code>mirza status</code>
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
    requestAnimationFrame(() => {
        dom.messagesScroll.scrollTop = dom.messagesScroll.scrollHeight;
    });
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
        btn.querySelector('svg').style.display = 'none';
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
            Copié !
        `;
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copier
            `;
        }, 2000);
    });
}

// Expose for inline onclick handlers
window.copyCode = copyCode;
window.deleteConversation = deleteConversation;

function copyMessageContent(index) {
    const conv = getActiveConversation();
    if (conv && conv.messages[index]) {
        navigator.clipboard.writeText(conv.messages[index].content);
    }
}
window.copyMessageContent = copyMessageContent;

// =================================================================
// Boot
// =================================================================
document.addEventListener('DOMContentLoaded', init);
