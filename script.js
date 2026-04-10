/**
 * ============================================================
 *  OPENSKY — AI Chat Application (OpenRouter Free Models)
 *  Built by Hafij Shaikh
 * ============================================================
 *
 *  ► PASTE YOUR OPENROUTER API KEY ON THE LINE BELOW ◄
 *
 *  ARCHITECTURE (8 Parts):
 *    PART 1: API Key, Config, Constants & Free Model Registry
 *    PART 2: Application State & Persistent Storage
 *    PART 3: Model Manager, DOM Cache & Toast System
 *    PART 4: Loading Engine, Initialization & Style Injector
 *    PART 5: Modal System, Settings UI & Confirm Dialog
 *    PART 6: Model Picker, Sidebar & Session Manager
 *    PART 7: Message Rendering, Markdown Parser & Export
 *    PART 8: OpenRouter Client, Agent Loop & Event Bindings
 *
 * ============================================================
 */


/* ════════════════════════════════════════════════════════════
   PASTE YOUR OPENROUTER API KEY HERE
   Get one free at: https://openrouter.ai/keys
   ════════════════════════════════════════════════════════════ */
const API_KEY = 'PASTE_YOUR_OPENROUTER_API_KEY_HERE';


/* ── 1.1 Master Configuration ── */
const CONFIG = {

    APP_NAME: 'Opensky',
    CREATOR: 'Hafij Shaikh',
    VERSION: '2.0.0',

    /* OpenRouter Endpoints */
    OPENROUTER_CHAT_URL: 'https://openrouter.ai/api/v1/chat/completions',
    OPENROUTER_MODELS_URL: 'https://openrouter.ai/api/v1/models',
    SITE_URL: window.location.href,
    SITE_NAME: 'Opensky AI',

    /* Default System Prompt */
    DEFAULT_SYSTEM_PROMPT: `You are Opensky, a highly capable AI assistant created by Hafij Shaikh. You are helpful, concise, and accurate. Format your responses clearly using markdown when appropriate — use code blocks for code, bold for emphasis, and lists for structured information. Be conversational yet professional. If unsure, say so honestly rather than guessing.`,

    /* Generation Defaults */
    DEFAULT_SETTINGS: {
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9,
        maxHistory: 20,
        streamSpeed: 12
    },

    /* ── Free Models Registry ──
     *  Users manage their own subset via add/remove.
     *  Each entry: { id, name, provider, description, contextLength }
     */
    FREE_MODELS_REGISTRY: [
        {
            id: 'deepseek/deepseek-chat-v3-0324:free',
            name: 'DeepSeek V3',
            provider: 'DeepSeek',
            description: 'Powerful general-purpose model, excellent at reasoning and coding',
            contextLength: 65536
        },
        {
            id: 'deepseek/deepseek-r1:free',
            name: 'DeepSeek R1',
            provider: 'DeepSeek',
            description: 'Reasoning-focused model with chain-of-thought capabilities',
            contextLength: 65536
        },
        {
            id: 'google/gemma-3-27b-it:free',
            name: 'Gemma 3 27B',
            provider: 'Google',
            description: 'Google\'s efficient 27B parameter instruction-tuned model',
            contextLength: 131072
        },
        {
            id: 'google/gemma-3-12b-it:free',
            name: 'Gemma 3 12B',
            provider: 'Google',
            description: 'Lightweight yet capable 12B model from Google',
            contextLength: 131072
        },
        {
            id: 'google/gemma-3-4b-it:free',
            name: 'Gemma 3 4B',
            provider: 'Google',
            description: 'Fast and compact 4B model for quick responses',
            contextLength: 32768
        },
        {
            id: 'meta-llama/llama-4-maverick:free',
            name: 'Llama 4 Maverick',
            provider: 'Meta',
            description: 'Meta\'s latest Maverick variant with strong multilingual support',
            contextLength: 131072
        },
        {
            id: 'meta-llama/llama-4-scout:free',
            name: 'Llama 4 Scout',
            provider: 'Meta',
            description: 'Efficient Scout variant optimized for fast inference',
            contextLength: 131072
        },
        {
            id: 'mistralai/mistral-small-3.1-24b-instruct:free',
            name: 'Mistral Small 3.1',
            provider: 'Mistral',
            description: 'Mistral\'s small but mighty 24B instruction model',
            contextLength: 131072
        },
        {
            id: 'qwen/qwen3-235b-a22b:free',
            name: 'Qwen3 235B',
            provider: 'Qwen (Alibaba)',
            description: 'Massive MoE model with 235B total / 22B active parameters',
            contextLength: 32768
        },
        {
            id: 'qwen/qwen3-30b-a3b:free',
            name: 'Qwen3 30B',
            provider: 'Qwen (Alibaba)',
            description: 'Efficient MoE, 30B total / 3B active — very fast',
            contextLength: 32768
        },
        {
            id: 'qwen/qwen3-8b:free',
            name: 'Qwen3 8B',
            provider: 'Qwen (Alibaba)',
            description: 'Compact 8B parameter model, good for quick tasks',
            contextLength: 32768
        },
        {
            id: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
            name: 'Nemotron 70B',
            provider: 'NVIDIA',
            description: 'NVIDIA\'s fine-tuned Llama 3.1 70B model',
            contextLength: 131072
        },
        {
            id: 'microsoft/phi-4-reasoning-plus:free',
            name: 'Phi-4 Reasoning+',
            provider: 'Microsoft',
            description: 'Small reasoning model with strong logic capabilities',
            contextLength: 16384
        },
        {
            id: 'rekaai/reka-flash-3:free',
            name: 'Reka Flash 3',
            provider: 'Reka AI',
            description: 'Fast multimodal model with vision capabilities',
            contextLength: 131072
        },
        {
            id: 'moonshotai/kimi-vl-a3b-thinking:free',
            name: 'Kimi VL Thinking',
            provider: 'Moonshot AI',
            description: 'Vision-language model with thinking capabilities',
            contextLength: 32768
        }
    ],

    /* Loading Tips */
    LOADING_TIPS: [
        'Tip: Each session can use a different model — pick the best one for your task.',
        'Tip: DeepSeek R1 is great for complex reasoning and math problems.',
        'Tip: Qwen3 235B is one of the largest free models available.',
        'Tip: You can add any free OpenRouter model to your list in the Model Picker.',
        'Tip: Your API key is hardcoded in the script — never shared with anyone else.',
        'Tip: Use Shift+Enter for multi-line messages in the input box.',
        'Tip: Export your conversations as Markdown for easy sharing.',
        'Tip: All chat history is stored in your browser locally.'
    ],

    /* Error Messages */
    ERRORS: {
        NO_API_KEY: 'No API key found. Open the JavaScript file and paste your OpenRouter key on the API_KEY line.',
        INVALID_KEY: 'Your API key appears to be invalid. Please check the key in your JavaScript file.',
        RATE_LIMITED: 'Rate limited by OpenRouter. Please wait a moment and try again.',
        MODEL_UNAVAILABLE: 'The selected model is currently unavailable. Try switching to another model.',
        NETWORK_ERROR: 'Network error — please check your internet connection.',
        STREAM_FAILED: 'Streaming failed. The response may be incomplete.',
        CONTEXT_TOO_LONG: 'Conversation is too long for this model. Start a new session.',
        EMPTY_RESPONSE: 'The model returned an empty response. Try rephrasing your message.',
        UNKNOWN: 'An unexpected error occurred. Please try again.',
        QUOTA_EXCEEDED: 'Free model quota may be exhausted. Try a different model.',
        AUTH_FAILED: 'Authentication failed. Check your OpenRouter API key.'
    },

    /* Welcome Screen Suggestions */
    SUGGESTIONS: [
        { title: 'Explain a concept', text: 'Explain quantum computing in simple terms', icon: '💡' },
        { title: 'Write code', text: 'Write a Python function to sort a list using merge sort', icon: '💻' },
        { title: 'Help me brainstorm', text: 'Give me 10 creative name ideas for a coffee shop', icon: '🎯' },
        { title: 'Analyze text', text: 'What are the key themes in Shakespeare\'s Hamlet?', icon: '📖' }
    ],

    /* Retry Configuration */
    RETRY: {
        MAX_ATTEMPTS: 2,
        BASE_DELAY: 1200,
        MAX_DELAY: 8000,
        BACKOFF_FACTOR: 2
    },

    /* Auto-title */
    AUTO_TITLE_MAX_LENGTH: 50,

    /* Storage warning threshold in MB */
    STORAGE_WARNING_MB: 4,

    /* Export filename prefix */
    EXPORT_PREFIX: 'opensky-chat',

    /* Maximum message length to send (characters) */
    MAX_INPUT_LENGTH: 32000
};
/**
 * ============================================================
 *  PART 2: APPLICATION STATE & PERSISTENT STORAGE
 * ============================================================
 */


/* ── 2.1 Central Application State ── */
const State = {

    /* API */
    apiKeyValid: false,

    /* Model */
    availableModels: [],
    selectedModelId: null,

    /* Generation */
    isGenerating: false,
    stopGenerationFlag: false,
    currentAbortController: null,

    /* Sessions */
    currentChatId: null,
    chats: {},

    /* Settings */
    settings: {},

    /* UI */
    sidebarOpen: false,
    activeModal: null,
    isInitialized: false,

    /* Export menu state */
    exportMenuOpen: false,

    /* Rename state */
    renamingChatId: null
};


/* ── 2.2 LocalStorage Manager ── */
const Storage = {

    KEYS: {
        SETTINGS: 'opensky_settings',
        CHATS: 'opensky_chats',
        ACTIVE_CHAT: 'opensky_active_chat',
        MODELS: 'opensky_models',
        SELECTED_MODEL: 'opensky_selected_model'
    },

    /* ── Low-level helpers ── */
    _get(key) {
        try { return localStorage.getItem(key); }
        catch (e) { console.warn('Storage read failed:', key, e); return null; }
    },

    _set(key, value) {
        try { localStorage.setItem(key, value); return true; }
        catch (e) {
            console.error('Storage write failed:', key, e);
            if (e.name === 'QuotaExceededError') {
                Toast.show('Storage full. Clear old chats to free space.', 'error', 5000);
            }
            return false;
        }
    },

    _remove(key) {
        try { localStorage.removeItem(key); }
        catch (e) { console.warn('Storage remove failed:', key, e); }
    },

    /* ── Settings ── */
    saveSettings() {
        return this._set(this.KEYS.SETTINGS, JSON.stringify(State.settings));
    },

    loadSettings() {
        try {
            const raw = this._get(this.KEYS.SETTINGS);
            if (raw) {
                const parsed = JSON.parse(raw);
                State.settings = {
                    ...JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS)),
                    ...parsed
                };
            } else {
                State.settings = JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS));
            }
        } catch (e) {
            console.error('Settings parse error:', e);
            State.settings = JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS));
        }
    },

    /* ── Chats / Sessions ── */
    saveChats() {
        try {
            const str = JSON.stringify(State.chats);
            const sizeMB = new Blob([str]).size / (1024 * 1024);

            if (sizeMB > CONFIG.STORAGE_WARNING_MB) {
                Toast.show(`History is ${sizeMB.toFixed(1)}MB. Trimming old chats.`, 'warning', 4000);
                this._trimOldChats();
            }

            return this._set(this.KEYS.CHATS, JSON.stringify(State.chats)) &&
                   this._set(this.KEYS.ACTIVE_CHAT, State.currentChatId || '');
        } catch (e) {
            return false;
        }
    },

    loadChats() {
        try {
            const raw = this._get(this.KEYS.CHATS);
            if (raw) State.chats = JSON.parse(raw);
            State.currentChatId = this._get(this.KEYS.ACTIVE_CHAT) || null;
        } catch (e) {
            console.error('Chats load error:', e);
            State.chats = {};
            State.currentChatId = null;
        }
    },

    _trimOldChats() {
        const ids = Object.keys(State.chats).sort((a, b) => {
            const tA = State.chats[a].updatedAt || State.chats[a].createdAt || 0;
            const tB = State.chats[b].updatedAt || State.chats[b].createdAt || 0;
            return tB - tA;
        });
        if (ids.length > 15) {
            ids.slice(15).forEach(id => delete State.chats[id]);
        }
    },

    clearAllChats() {
        State.chats = {};
        State.currentChatId = null;
        this._remove(this.KEYS.CHATS);
        this._remove(this.KEYS.ACTIVE_CHAT);
    },

    /* ── Model List ── */
    saveModels() {
        return this._set(this.KEYS.MODELS, JSON.stringify(State.availableModels));
    },

    loadModels() {
        try {
            const raw = this._get(this.KEYS.MODELS);
            if (raw) {
                State.availableModels = JSON.parse(raw);
            } else {
                State.availableModels = JSON.parse(JSON.stringify(CONFIG.FREE_MODELS_REGISTRY));
                this.saveModels();
            }
        } catch (e) {
            console.error('Models load error:', e);
            State.availableModels = JSON.parse(JSON.stringify(CONFIG.FREE_MODELS_REGISTRY));
        }
    },

    saveSelectedModel(modelId) {
        State.selectedModelId = modelId;
        return this._set(this.KEYS.SELECTED_MODEL, modelId || '');
    },

    loadSelectedModel() {
        const id = this._get(this.KEYS.SELECTED_MODEL);
        if (id && State.availableModels.find(m => m.id === id)) {
            State.selectedModelId = id;
        } else if (State.availableModels.length > 0) {
            State.selectedModelId = State.availableModels[0].id;
        } else {
            State.selectedModelId = null;
        }
        return State.selectedModelId;
    },

    /* ── Nuclear Reset ── */
    clearEverything() {
        Object.values(this.KEYS).forEach(k => this._remove(k));
        State.chats = {};
        State.currentChatId = null;
        State.settings = JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS));
        State.availableModels = JSON.parse(JSON.stringify(CONFIG.FREE_MODELS_REGISTRY));
        State.selectedModelId = State.availableModels[0]?.id || null;
    }
};


/* ── 2.3 Security Utilities ── */
const Security = {
    escapeHTML(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(str).replace(/[&<>"']/g, c => map[c]);
    },

    stripHTML(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },

    isValidKey(key) {
        return typeof key === 'string' && key.trim().length >= 20 && !key.includes('PASTE_YOUR');
    },

    truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '...' : str;
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
};


/* ── 2.4 Utility Helpers ── */
const Utils = {
    /* Debounce a function */
    debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    },

    /* Count words in text */
    wordCount(text) {
        if (!text || !text.trim()) return 0;
        return text.trim().split(/\s+/).length;
    },

    /* Count characters */
    charCount(text) {
        return text ? text.length : 0;
    },

    /* Format timestamp */
    formatTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHr < 24) return `${diffHr}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;

        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    },

    /* Format file size */
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    },

    /* Sleep */
    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    },

    /* Copy text to clipboard with fallback */
    async copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) { /* fallback below */ }
        }
        /* Fallback for older browsers / file:// protocol */
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '-9999px';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (e) {
            return false;
        }
    },

    /* Download a file */
    downloadFile(filename, content, mimeType = 'text/markdown') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    },

    /* Calculate approximate token count (rough: 1 token ≈ 4 chars for English) */
    estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }
};
/**
 * ============================================================
 *  PART 3: MODEL MANAGER, DOM CACHE & TOAST SYSTEM
 * ============================================================
 */


/* ── 3.1 Model Manager ── */
const ModelManager = {

    getById(modelId) {
        return State.availableModels.find(m => m.id === modelId) || null;
    },

    getName(modelId) {
        const m = this.getById(modelId);
        return m ? m.name : (modelId ? Security.truncate(modelId, 30) : 'No Model');
    },

    getProvider(modelId) {
        const m = this.getById(modelId);
        return m ? m.provider : 'Unknown';
    },

    getContextLength(modelId) {
        const m = this.getById(modelId);
        return m ? (m.contextLength || 4096) : 4096;
    },

    /**
     * Add a custom free model to user's list
     */
    addModel(modelId, customName) {
        if (!modelId || typeof modelId !== 'string') {
            return { success: false, message: 'Enter a valid model ID.' };
        }

        const trimmed = modelId.trim();

        if (this.getById(trimmed)) {
            return { success: false, message: 'Already in your list.' };
        }

        if (!trimmed.includes('/')) {
            return { success: false, message: 'Model ID must be in format: vendor/model-name' };
        }

        const parts = trimmed.split('/');
        const vendor = parts[0] || 'custom';
        const modelPart = parts.slice(1).join('/');
        const baseName = modelPart.replace(/:free$/, '').replace(/:latest$/, '');

        const newModel = {
            id: trimmed,
            name: customName || baseName,
            provider: vendor.charAt(0).toUpperCase() + vendor.slice(1),
            description: customName
                ? `Custom: ${Security.truncate(trimmed, 50)}`
                : `Added by user — ${Security.truncate(trimmed, 50)}`,
            contextLength: 4096,
            isCustom: true
        };

        State.availableModels.push(newModel);
        Storage.saveModels();
        return { success: true, message: `"${newModel.name}" added.` };
    },

    /**
     * Remove a model from the list
     */
    removeModel(modelId) {
        const idx = State.availableModels.findIndex(m => m.id === modelId);
        if (idx === -1) {
            return { success: false, message: 'Model not found.' };
        }

        const removed = State.availableModels.splice(idx, 1)[0];

        if (State.selectedModelId === modelId) {
            State.selectedModelId = State.availableModels[0]?.id || null;
            Storage.saveSelectedModel(State.selectedModelId);
            UI.updateModelBadge();
        }

        Storage.saveModels();
        return { success: true, message: `"${removed.name}" removed.` };
    },

    /**
     * Restore all default free models
     */
    restoreDefaults() {
        State.availableModels = JSON.parse(JSON.stringify(CONFIG.FREE_MODELS_REGISTRY));
        Storage.saveModels();

        if (!this.getById(State.selectedModelId)) {
            State.selectedModelId = State.availableModels[0]?.id || null;
            Storage.saveSelectedModel(State.selectedModelId);
        }
    },

    /**
     * Search models by name, provider, or ID
     */
    search(query) {
        if (!query || !query.trim()) return State.availableModels;
        const q = query.toLowerCase().trim();
        return State.availableModels.filter(m =>
            m.name.toLowerCase().includes(q) ||
            m.provider.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q) ||
            (m.description && m.description.toLowerCase().includes(q))
        );
    },

    /**
     * Group models by provider (for display)
     */
    getGroupedByProvider(models) {
        const list = models || State.availableModels;
        const groups = {};
        list.forEach(m => {
            if (!groups[m.provider]) groups[m.provider] = [];
            groups[m.provider].push(m);
        });
        /* Sort each group alphabetically by name */
        Object.values(groups).forEach(arr =>
            arr.sort((a, b) => a.name.localeCompare(b.name))
        );
        return groups;
    },

    /**
     * Get unique provider names sorted
     */
    getProviders() {
        return [...new Set(State.availableModels.map(m => m.provider))].sort();
    },

    /**
     * Get the model bound to a specific chat session
     */
    getModelForChat(chatId) {
        const chat = State.chats[chatId];
        if (!chat) return State.selectedModelId;
        return chat.modelId || State.selectedModelId;
    },

    /**
     * Count total models in list
     */
    count() {
        return State.availableModels.length;
    }
};


/* ── 3.2 DOM References Cache ── */
const DOM = {

    /* Loading */
    loadingScreen: null,
    progressBar: null,
    loadingPercent: null,
    loadingStatus: null,
    loadingTips: null,
    errorBox: null,
    errorMessage: null,

    /* App Shell */
    appContainer: null,
    sidebarOverlay: null,
    sidebar: null,
    historyList: null,

    /* Top Bar */
    modelBadge: null,
    statusBadge: null,

    /* Chat */
    welcomeScreen: null,
    chatArea: null,
    inputText: null,
    sendBtn: null,

    /* Modals */
    settingsModal: null,
    modelPickerModal: null,
    confirmDialog: null,

    /* Modal inner containers (for dynamic rendering) */
    settingsBody: null,
    modelPickerBody: null,
    confirmBody: null,

    /* Toast */
    toastContainer: null,

    /* Templates */
    tmplUserMsg: null,
    tmplAssistantMsg: null,
    tmplToast: null,

    /**
     * Cache all DOM element references
     */
    cache() {
        const get = id => document.getElementById(id);

        this.loadingScreen  = get('loadingScreen');
        this.progressBar    = get('progressBar');
        this.loadingPercent = get('loadingPercent');
        this.loadingStatus  = get('loadingStatus');
        this.loadingTips    = get('loadingTips');
        this.errorBox       = get('errorBox');
        this.errorMessage   = get('errorMessage');

        this.appContainer   = get('appContainer');
        this.sidebarOverlay = get('sidebarOverlay');
        this.sidebar        = get('sidebar');
        this.historyList    = get('historyList');

        this.modelBadge     = get('modelBadge');
        this.statusBadge    = get('statusBadge');

        this.welcomeScreen  = get('welcomeScreen');
        this.chatArea       = get('chatArea');
        this.inputText      = get('inputText');
        this.sendBtn        = get('sendBtn');

        this.settingsModal    = get('settingsModal');
        this.modelPickerModal = get('modelPickerModal');
        this.confirmDialog    = get('confirmDialog');

        this.settingsBody    = get('settingsBody');
        this.modelPickerBody = get('modelPickerBody');
        this.confirmBody     = get('confirmBody');

        this.toastContainer = get('toastContainer');

        this.tmplUserMsg     = get('tmplUserMsg');
        this.tmplAssistantMsg = get('tmplAssistantMsg');
        this.tmplToast       = get('tmplToast');
    }
};


/* ── 3.3 Toast Notification System ── */
const Toast = {

    _counter: 0,

    show(message, type = 'default', duration = 3500) {
        if (!DOM.toastContainer) return;

        const id = `toast-${++this._counter}`;

        /* Build toast element from template or create fresh */
        let toast;
        if (DOM.tmplToast) {
            const frag = DOM.tmplToast.content.cloneNode(true);
            toast = frag.querySelector('.toast-notification');
        } else {
            toast = document.createElement('div');
            toast.className = 'toast-notification';
            toast.innerHTML = `
                <span class="toast-icon">✦</span>
                <span class="toast-message"></span>
            `;
        }

        toast.id = id;
        if (type !== 'default') toast.classList.add(type);

        const msgEl = toast.querySelector('.toast-message');
        if (msgEl) msgEl.textContent = message;

        const iconEl = toast.querySelector('.toast-icon');
        if (iconEl) {
            const icons = { default: '✦', success: '✓', error: '✕', warning: '⚠' };
            iconEl.textContent = icons[type] || icons.default;
        }

        DOM.toastContainer.appendChild(toast);

        const timer = setTimeout(() => this._remove(id), duration);
        toast.addEventListener('click', () => {
            clearTimeout(timer);
            this._remove(id);
        });
    },

    success(msg, dur)    { return this.show(msg, 'success', dur); },
    error(msg, dur)      { return this.show(msg, 'error', dur || 5000); },
    warning(msg, dur)    { return this.show(msg, 'warning', dur || 4000); },

    _remove(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('removing');
        setTimeout(() => el.remove(), 300);
    }
};
/**
 * ============================================================
 *  PART 4: LOADING ENGINE, INITIALIZATION
 * ============================================================
 */


/* ── 4.1 Loading Engine ── */
const LoadingEngine = {

    _progress: 0,
    _progInterval: null,
    _tipInterval: null,

    start() {
        if (!DOM.loadingScreen) return;

        let tipIdx = 0;
        if (DOM.loadingTips) {
            DOM.loadingTips.innerHTML = `<p>${CONFIG.LOADING_TIPS[0]}</p>`;
        }

        this._tipInterval = setInterval(() => {
            tipIdx = (tipIdx + 1) % CONFIG.LOADING_TIPS.length;
            if (DOM.loadingTips) {
                DOM.loadingTips.innerHTML = `<p>${CONFIG.LOADING_TIPS[tipIdx]}</p>`;
            }
        }, 3500);

        this._progInterval = setInterval(() => {
            if (this._progress < 80) {
                this._progress += Math.random() * 6;
                this._updateUI(this._progress);
            }
        }, 150);
    },

    _updateUI(val) {
        const c = Math.min(100, Math.max(0, val));
        if (DOM.progressBar) DOM.progressBar.style.width = `${c}%`;
        if (DOM.loadingPercent) DOM.loadingPercent.textContent = `${c.toFixed(1)}%`;
    },

    _setStatus(t) {
        if (DOM.loadingStatus) DOM.loadingStatus.textContent = t;
    },

    succeed() {
        this._cleanup();
        this._updateUI(100);
        this._setStatus('Ready');
        if (DOM.statusBadge) {
            DOM.statusBadge.textContent = 'Online';
            DOM.statusBadge.className = 'status-badge ready';
        }
        setTimeout(() => {
            if (DOM.loadingScreen) DOM.loadingScreen.classList.add('hidden');
            if (DOM.appContainer) DOM.appContainer.style.display = 'flex';
            if (DOM.sendBtn) DOM.sendBtn.disabled = false;
        }, 500);
    },

    fail(message) {
        this._cleanup();
        this._setStatus('Failed');
        if (DOM.statusBadge) {
            DOM.statusBadge.textContent = 'Error';
            DOM.statusBadge.className = 'status-badge error';
        }
        if (DOM.errorBox) DOM.errorBox.style.display = 'block';
        if (DOM.loadingTips) DOM.loadingTips.style.display = 'none';
        if (DOM.errorMessage) DOM.errorMessage.textContent = message;
    },

    skip() {
        this._cleanup();
        if (DOM.loadingScreen) DOM.loadingScreen.classList.add('hidden');
        if (DOM.appContainer) DOM.appContainer.style.display = 'flex';
        if (DOM.statusBadge) {
            DOM.statusBadge.textContent = 'No Key';
            DOM.statusBadge.className = 'status-badge error';
        }
    },

    _cleanup() {
        clearInterval(this._progInterval);
        clearInterval(this._tipInterval);
    }
};


/* ── 4.2 API Key Validator ── */
const APIValidator = {

    async validateKey(key) {
        if (!Security.isValidKey(key)) return false;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(CONFIG.OPENROUTER_MODELS_URL, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'HTTP-Referer': CONFIG.SITE_URL,
                    'X-Title': CONFIG.SITE_NAME
                },
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (res.status === 401 || res.status === 403) return false;
            if (res.status === 429) return true;
            return res.ok;

        } catch (e) {
            if (e.name === 'AbortError') return false;
            console.warn('API validation network error (key may be valid):', e.message);
            return true;
        }
    }
};


/* ── 4.3 Main Initialization ── */
const Init = {

    async run() {
        /* 1. Cache DOM */
        DOM.cache();

        /* 2. Load persisted data */
        Storage.loadSettings();
        Storage.loadModels();
        Storage.loadSelectedModel();
        Storage.loadChats();

        /* 3. Show loading screen */
        LoadingEngine.start();

        /* 4. Check API key */
        if (!Security.isValidKey(API_KEY)) {
            LoadingEngine.fail(CONFIG.ERRORS.NO_API_KEY);
            return;
        }

        /* 5. Validate key with OpenRouter */
        LoadingEngine._setStatus('Validating API key...');

        const valid = await APIValidator.validateKey(API_KEY);

        if (valid) {
            State.apiKeyValid = true;
            LoadingEngine.succeed();

            /* 6. Boot UI after loading screen fades */
            setTimeout(() => {
                UI.boot();
            }, 600);
        } else {
            LoadingEngine.fail(CONFIG.ERRORS.INVALID_KEY);
        }
    }
};
/**
 * ============================================================
 *  PART 5: MODAL SYSTEM, SETTINGS UI & CONFIRM DIALOG
 * ============================================================
 */


/* ── 5.1 Modal Manager ── */
const Modal = {

    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.style.display = 'flex';
        State.activeModal = modalId;

        /* Re-trigger scale-in animation */
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.animation = 'none';
            content.offsetHeight; /* reflow */
            content.style.animation = '';
        }
    },

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.style.display = 'none';
        State.activeModal = null;
    },

    closeAll() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
        State.activeModal = null;
    },

    isOpen(modalId) {
        const modal = document.getElementById(modalId);
        return modal && modal.style.display === 'flex';
    },

    initEvents() {
        /* Close buttons with data-close attribute */
        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.close-modal-btn');
            if (closeBtn) {
                const target = closeBtn.getAttribute('data-close');
                if (target) this.close(target);
            }
        });

        /* Click overlay to close */
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') && e.target.style.display === 'flex') {
                this.close(e.target.id);
            }
        });

        /* Escape key */
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (State.activeModal) {
                    this.close(State.activeModal);
                } else if (State.sidebarOpen) {
                    Sidebar.close();
                }
            }
        });
    }
};


/* ── 5.2 Settings UI Controller ── */
const SettingsUI = {

    init() {
        this.render();
    },

    /**
     * Render the entire settings modal body dynamically
     */
    render() {
        if (!DOM.settingsBody) return;

        const s = State.settings;
        const sysPrompt = s.systemPrompt || CONFIG.DEFAULT_SYSTEM_PROMPT;

        DOM.settingsBody.innerHTML = `
            <!-- Generation Settings -->
            <div class="settings-section-title">Generation</div>

            <div class="settings-field">
                <div class="settings-label">System Prompt</div>
                <div class="settings-hint">Instructions that define how the AI behaves</div>
                <textarea class="settings-textarea" id="setSystemPrompt">${Security.escapeHTML(sysPrompt)}</textarea>
            </div>

            <div class="settings-field">
                <div class="settings-label">
                    Temperature
                    <span class="settings-value" id="setTempVal">${s.temperature}</span>
                </div>
                <div class="settings-hint">Lower = more focused, Higher = more creative</div>
                <div class="settings-range-row">
                    <input type="range" class="settings-range" id="setTemperature"
                        min="0" max="2" step="0.05" value="${s.temperature}">
                </div>
            </div>

            <div class="settings-field">
                <div class="settings-label">
                    Max Tokens
                    <span class="settings-value" id="setTokensVal">${s.maxTokens}</span>
                </div>
                <div class="settings-hint">Maximum length of the AI response</div>
                <div class="settings-range-row">
                    <input type="range" class="settings-range" id="setMaxTokens"
                        min="256" max="8192" step="256" value="${s.maxTokens}">
                </div>
            </div>

            <div class="settings-field">
                <div class="settings-label">
                    Top P
                    <span class="settings-value" id="setTopPVal">${s.topP}</span>
                </div>
                <div class="settings-hint">Nucleus sampling threshold</div>
                <div class="settings-range-row">
                    <input type="range" class="settings-range" id="setTopP"
                        min="0.1" max="1" step="0.05" value="${s.topP}">
                </div>
            </div>

            <div class="settings-field">
                <div class="settings-label">
                    Max History Messages
                    <span class="settings-value" id="setHistoryVal">${s.maxHistory}</span>
                </div>
                <div class="settings-hint">How many past messages to include as context</div>
                <div class="settings-range-row">
                    <input type="range" class="settings-range" id="setMaxHistory"
                        min="2" max="50" step="2" value="${s.maxHistory}">
                </div>
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-xl); padding-top: var(--space-lg); border-top: 1px solid var(--color-border);">
                <button class="btn btn-primary" id="saveSettingsBtn">Save Settings</button>
                <button class="btn btn-secondary" id="resetSettingsBtn">Reset to Default</button>
            </div>
        `;

        this._bindEvents();
    },

    _bindEvents() {
        /* Live value displays */
        const pairs = [
            ['setTemperature', 'setTempVal'],
            ['setMaxTokens', 'setTokensVal'],
            ['setTopP', 'setTopPVal'],
            ['setMaxHistory', 'setHistoryVal']
        ];

        pairs.forEach(([inputId, valId]) => {
            const input = document.getElementById(inputId);
            const val = document.getElementById(valId);
            if (input && val) {
                input.addEventListener('input', () => {
                    val.textContent = input.value;
                });
            }
        });

        /* Save */
        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this._save());
        }

        /* Reset */
        const resetBtn = document.getElementById('resetSettingsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this._reset());
        }
    },

    _save() {
        State.settings.systemPrompt = document.getElementById('setSystemPrompt')?.value || '';
        State.settings.temperature = parseFloat(document.getElementById('setTemperature')?.value || 0.7);
        State.settings.maxTokens = parseInt(document.getElementById('setMaxTokens')?.value || 2048);
        State.settings.topP = parseFloat(document.getElementById('setTopP')?.value || 0.9);
        State.settings.maxHistory = parseInt(document.getElementById('setMaxHistory')?.value || 20);

        Storage.saveSettings();
        Modal.close('settingsModal');
        Toast.success('Settings saved');
    },

    _reset() {
        State.settings = JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS));
        this.render();
        Toast.success('Settings reset to default');
    }
};


/* ── 5.3 Confirm Dialog Controller ── */
const ConfirmDialog = {

    /**
     * Show a confirmation dialog
     * @param {string} title
     * @param {string} message
     * @param {string} confirmText - Button text (default "Delete")
     * @param {boolean} isDanger - Red button style (default true)
     * @returns {Promise<boolean>} - true if confirmed, false if cancelled
     */
    show(title, message, confirmText = 'Delete', isDanger = true) {
        return new Promise((resolve) => {
            if (!DOM.confirmDialog || !DOM.confirmBody) {
                resolve(false);
                return;
            }

            DOM.confirmBody.innerHTML = `
                <div class="confirm-title">${Security.escapeHTML(title)}</div>
                <div class="confirm-message">${Security.escapeHTML(message)}</div>
                <div class="confirm-actions">
                    <button class="btn btn-secondary" id="confirmCancelBtn">Cancel</button>
                    <button class="${isDanger ? 'btn-danger' : 'btn btn-primary'}" id="confirmOkBtn">${Security.escapeHTML(confirmText)}</button>
                </div>
            `;

            Modal.open('confirmDialog');

            const cleanup = (result) => {
                Modal.close('confirmDialog');
                resolve(result);
            };

            setTimeout(() => {
                document.getElementById('confirmCancelBtn')?.addEventListener('click', () => cleanup(false));
                document.getElementById('confirmOkBtn')?.addEventListener('click', () => cleanup(true));
            }, 50);
        });
    }
};


/* ── 5.4 Inline Confirmation Helper ──
 *  For simple yes/no without the full dialog (used in message actions)
 */
const InlineConfirm = {

    _active: null,

    /**
     * Replace a button with "Confirm?" state temporarily
     * @param {HTMLElement} btn - The button to replace
     * @param {string} confirmLabel
     * @param {Function} onConfirm
     */
    activate(btn, confirmLabel = 'Confirm?', onConfirm) {
        this.cancel(); /* Cancel any existing */

        const original = btn.innerHTML;
        const originalClass = btn.className;

        btn.innerHTML = confirmLabel;
        btn.classList.add('btn-danger');
        btn.style.fontSize = '11px';
        btn.style.padding = '2px 6px';

        const timer = setTimeout(() => {
            this.restore(btn, original, originalClass);
        }, 3000);

        this._active = { btn, original, originalClass, timer };

        const handler = (e) => {
            e.stopPropagation();
            clearTimeout(timer);
            this.restore(btn, original, originalClass);
            if (onConfirm) onConfirm();
        };

        btn.addEventListener('click', handler, { once: true });
    },

    cancel() {
        if (!this._active) return;
        clearTimeout(this._active.timer);
        this.restore(this._active.btn, this._active.original, this._active.originalClass);
        this._active = null;
    },

    restore(btn, original, cls) {
        btn.innerHTML = original;
        btn.className = cls;
        btn.style.fontSize = '';
        btn.style.padding = '';
        this._active = null;
    }
};
/**
 * ============================================================
 *  PART 6: MODEL PICKER, SIDEBAR & SESSION MANAGER
 * ============================================================
 */


/* ── 6.1 Model Picker UI ── */
const ModelPicker = {

    _searchQuery: '',

    init() {
        this.render();
    },

    /**
     * Render the full model picker modal body
     */
    render() {
        if (!DOM.modelPickerBody) return;

        const models = this._searchQuery
            ? ModelManager.search(this._searchQuery)
            : State.availableModels;

        const groups = ModelManager.getGroupedByProvider(models);
        const providerNames = Object.keys(groups).sort();

        let listHTML = '';

        if (models.length === 0) {
            listHTML = `<div class="model-empty">
                ${this._searchQuery ? 'No models match your search.' : 'No models in your list.'}
            </div>`;
        } else {
            providerNames.forEach(provider => {
                listHTML += `<div class="provider-label">${Security.escapeHTML(provider)}</div>`;
                groups[provider].forEach(m => {
                    const isSelected = m.id === State.selectedModelId;
                    const ctxK = Math.round((m.contextLength || 4096) / 1024);
                    listHTML += `
                        <div class="model-item ${isSelected ? 'selected' : ''}"
                             data-model-id="${Security.escapeHTML(m.id)}">
                            <div class="model-item-radio"></div>
                            <div class="model-item-info">
                                <div class="model-item-name">${Security.escapeHTML(m.name)}</div>
                                <div class="model-item-meta">${Security.escapeHTML(m.description || '')} · ${ctxK}K ctx</div>
                            </div>
                            <div class="model-item-remove" data-remove-id="${Security.escapeHTML(m.id)}" title="Remove">✕</div>
                        </div>
                    `;
                });
            });
        }

        DOM.modelPickerBody.innerHTML = `
            <div style="margin-bottom: var(--space-sm); display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: var(--text-sm); font-weight: var(--font-semibold);">Select Model for New Sessions</span>
                <span class="model-count-badge">${ModelManager.count()} models</span>
            </div>

            <div class="model-search-wrap">
                <span class="model-search-icon">⌕</span>
                <input type="text" class="model-search-input" id="modelSearchInput"
                    placeholder="Search models..." value="${Security.escapeHTML(this._searchQuery)}">
            </div>

            <div class="model-list" id="modelListContainer">
                ${listHTML}
            </div>

            <div class="model-add-section">
                <div style="font-size: var(--text-sm); font-weight: var(--font-medium); margin-bottom: var(--space-sm);">
                    Add Custom Model
                </div>
                <div class="model-add-row">
                    <input type="text" class="model-add-input" id="modelAddInput"
                        placeholder="vendor/model-name:free">
                    <button class="model-add-btn" id="modelAddBtn">Add</button>
                </div>
                <div class="model-add-error" id="modelAddError"></div>
                <button class="model-restore-btn" id="modelRestoreBtn">
                    Restore all default free models
                </button>
            </div>
        `;

        this._bindEvents();
    },

    _bindEvents() {
        /* Search */
        const searchInput = document.getElementById('modelSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this._searchQuery = e.target.value;
                this._renderList();
            }, 200));
            searchInput.focus();
        }

        /* Model selection (event delegation on list) */
        const listEl = document.getElementById('modelListContainer');
        if (listEl) {
            listEl.addEventListener('click', (e) => {
                /* Handle remove button */
                const removeBtn = e.target.closest('.model-item-remove');
                if (removeBtn) {
                    e.stopPropagation();
                    const removeId = removeBtn.getAttribute('data-remove-id');
                    this._handleRemove(removeId);
                    return;
                }

                /* Handle model selection */
                const item = e.target.closest('.model-item');
                if (item) {
                    const modelId = item.getAttribute('data-model-id');
                    this._handleSelect(modelId);
                }
            });
        }

        /* Add model */
        const addBtn = document.getElementById('modelAddBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this._handleAdd());
        }

        const addInput = document.getElementById('modelAddInput');
        if (addInput) {
            addInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._handleAdd();
                }
            });
        }

        /* Restore defaults */
        const restoreBtn = document.getElementById('modelRestoreBtn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                ModelManager.restoreDefaults();
                Toast.success('Default models restored');
                this.render();
                UI.updateModelBadge();
            });
        }
    },

    _handleSelect(modelId) {
        State.selectedModelId = modelId;
        Storage.saveSelectedModel(modelId);
        UI.updateModelBadge();
        Toast.success(`Selected: ${ModelManager.getName(modelId)}`);
        this._renderList();
    },

    async _handleRemove(modelId) {
        const name = ModelManager.getName(modelId);
        const confirmed = await ConfirmDialog.show(
            'Remove Model',
            `Remove "${name}" from your model list? This won't affect existing sessions using it.`,
            'Remove',
            true
        );
        if (!confirmed) return;

        const result = ModelManager.removeModel(modelId);
        if (result.success) {
            Toast.success(result.message);
            this._renderList();
        } else {
            Toast.error(result.message);
        }
    },

    _handleAdd() {
        const input = document.getElementById('modelAddInput');
        const errorEl = document.getElementById('modelAddError');
        if (!input) return;

        const val = input.value.trim();
        const result = ModelManager.addModel(val);

        if (result.success) {
            input.value = '';
            if (errorEl) errorEl.textContent = '';
            Toast.success(result.message);
            this._renderList();
        } else {
            if (errorEl) errorEl.textContent = result.message;
        }
    },

    /**
     * Re-render just the list portion (for search filtering)
     */
    _renderList() {
        const models = this._searchQuery
            ? ModelManager.search(this._searchQuery)
            : State.availableModels;

        const groups = ModelManager.getGroupedByProvider(models);
        const providerNames = Object.keys(groups).sort();

        const listEl = document.getElementById('modelListContainer');
        if (!listEl) return;

        if (models.length === 0) {
            listEl.innerHTML = `<div class="model-empty">
                ${this._searchQuery ? 'No models match your search.' : 'No models.'}
            </div>`;
            return;
        }

        let html = '';
        providerNames.forEach(provider => {
            html += `<div class="provider-label">${Security.escapeHTML(provider)}</div>`;
            groups[provider].forEach(m => {
                const isSelected = m.id === State.selectedModelId;
                const ctxK = Math.round((m.contextLength || 4096) / 1024);
                html += `
                    <div class="model-item ${isSelected ? 'selected' : ''}"
                         data-model-id="${Security.escapeHTML(m.id)}">
                        <div class="model-item-radio"></div>
                        <div class="model-item-info">
                            <div class="model-item-name">${Security.escapeHTML(m.name)}</div>
                            <div class="model-item-meta">${Security.escapeHTML(m.description || '')} · ${ctxK}K ctx</div>
                        </div>
                        <div class="model-item-remove" data-remove-id="${Security.escapeHTML(m.id)}" title="Remove">✕</div>
                    </div>
                `;
            });
        });

        listEl.innerHTML = html;

        /* Rebind list events */
        listEl.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.model-item-remove');
            if (removeBtn) {
                e.stopPropagation();
                this._handleRemove(removeBtn.getAttribute('data-remove-id'));
                return;
            }
            const item = e.target.closest('.model-item');
            if (item) {
                this._handleSelect(item.getAttribute('data-model-id'));
            }
        });
    }
};


/* ── 6.2 Sidebar Controller ── */
const Sidebar = {

    toggle() {
        State.sidebarOpen = !State.sidebarOpen;
        DOM.sidebar?.classList.toggle('open', State.sidebarOpen);
        DOM.sidebarOverlay?.classList.toggle('active', State.sidebarOpen);

        if (State.sidebarOpen) {
            this.renderHistory();
        }
    },

    close() {
        State.sidebarOpen = false;
        DOM.sidebar?.classList.remove('open');
        DOM.sidebarOverlay?.classList.remove('active');
    },

    initEvents() {
        const menuBtn = document.getElementById('menuBtn');
        if (menuBtn) menuBtn.addEventListener('click', () => this.toggle());

        if (DOM.sidebarOverlay) {
            DOM.sidebarOverlay.addEventListener('click', () => this.close());
        }

        const newChatBtn = document.getElementById('newChatBtn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                SessionManager.create();
                this.close();
            });
        }

        const clearBtn = document.getElementById('clearChatBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (Object.keys(State.chats).length === 0) {
                    Toast.warning('No chats to delete.');
                    return;
                }
                const ok = await ConfirmDialog.show(
                    'Delete All Chats',
                    'This will permanently delete all your chat history. This cannot be undone.',
                    'Delete All',
                    true
                );
                if (ok) {
                    SessionManager.clearAll();
                    Toast.error('All chats deleted.');
                }
            });
        }
    },

    /**
     * Render the chat history list in the sidebar
     */
    renderHistory() {
        if (!DOM.historyList) return;

        const chatIds = Object.keys(State.chats).sort((a, b) => {
            const tA = State.chats[a].updatedAt || State.chats[a].createdAt || 0;
            const tB = State.chats[b].updatedAt || State.chats[b].createdAt || 0;
            return tB - tA;
        });

        if (chatIds.length === 0) {
            DOM.historyList.innerHTML = `
                <div style="padding: 20px 16px; color: var(--color-text-muted); font-size: 0.85rem; text-align: center;">
                    No conversations yet
                </div>
            `;
            return;
        }

        DOM.historyList.innerHTML = chatIds.map(id => {
            const chat = State.chats[id];
            const isActive = id === State.currentChatId;
            const modelName = ModelManager.getName(chat.modelId);
            const timeStr = Utils.formatTime(chat.updatedAt || chat.createdAt);
            const isRenaming = State.renamingChatId === id;

            const titleHTML = isRenaming
                ? `<input class="rename-input" value="${Security.escapeHTML(chat.title)}" data-rename-id="${id}">`
                : `<span class="history-item-text">${Security.escapeHTML(chat.title || 'New Chat')}</span>`;

            return `
                <div class="history-item ${isActive ? 'active' : ''}" data-chat-id="${id}">
                    <div class="history-item-wrap">
                        ${titleHTML}
                        <span class="history-item-model-tag">${Security.escapeHTML(modelName)}</span>
                        <div class="history-item-actions">
                            <button class="history-action-btn" data-action="rename" data-id="${id}" title="Rename">✎</button>
                            <button class="history-action-btn delete" data-action="delete" data-id="${id}" title="Delete">✕</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this._bindHistoryEvents();
    },

    _bindHistoryEvents() {
        if (!DOM.historyList) return;

        DOM.historyList.addEventListener('click', async (e) => {
            /* Delete button */
            const delBtn = e.target.closest('[data-action="delete"]');
            if (delBtn) {
                e.stopPropagation();
                const id = delBtn.getAttribute('data-id');
                await this._deleteChat(id);
                return;
            }

            /* Rename button */
            const renBtn = e.target.closest('[data-action="rename"]');
            if (renBtn) {
                e.stopPropagation();
                const id = renBtn.getAttribute('data-id');
                this._startRename(id);
                return;
            }

            /* Click to load chat */
            const item = e.target.closest('.history-item');
            if (item && !e.target.closest('.rename-input')) {
                const id = item.getAttribute('data-chat-id');
                if (id) {
                    SessionManager.load(id);
                    this.close();
                }
            }
        });

        /* Handle rename input */
        DOM.historyList.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('rename-input')) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const id = e.target.getAttribute('data-rename-id');
                    this._finishRename(id, e.target.value);
                }
                if (e.key === 'Escape') {
                    State.renamingChatId = null;
                    this.renderHistory();
                }
            }
        });

        /* Finish rename on blur */
        DOM.historyList.addEventListener('focusout', (e) => {
            if (e.target.classList.contains('rename-input')) {
                const id = e.target.getAttribute('data-rename-id');
                /* Small delay to allow click events to fire first */
                setTimeout(() => {
                    if (State.renamingChatId === id) {
                        this._finishRename(id, e.target.value);
                    }
                }, 150);
            }
        });
    },

    _startRename(id) {
        State.renamingChatId = id;
        this.renderHistory();
        const input = DOM.historyList.querySelector(`.rename-input[data-rename-id="${id}"]`);
        if (input) {
            input.focus();
            input.select();
        }
    },

    _finishRename(id, newTitle) {
        State.renamingChatId = null;
        if (State.chats[id] && newTitle.trim()) {
            State.chats[id].title = newTitle.trim();
            Storage.saveChats();
        }
        this.renderHistory();
    },

    async _deleteChat(id) {
        const chat = State.chats[id];
        const name = chat ? chat.title : 'this chat';

        const ok = await ConfirmDialog.show(
            'Delete Chat',
            `Delete "${name}"? This cannot be undone.`,
            'Delete',
            true
        );

        if (!ok) return;

        SessionManager.delete(id);
        Toast.success('Chat deleted');
    }
};


/* ── 6.3 Session / Chat Manager ── */
const SessionManager = {

    /**
     * Create a new chat session
     */
    create() {
        const id = Security.generateId();
        State.chats[id] = {
            title: 'New Chat',
            modelId: State.selectedModelId,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        State.currentChatId = id;
        this.load(id);
        Storage.saveChats();
        Sidebar.renderHistory();
    },

    /**
     * Load a chat session into the UI
     */
    load(id) {
        State.currentChatId = id;
        const chat = State.chats[id];

        if (!chat) {
            this.create();
            return;
        }

        /* Clear chat area */
        if (DOM.chatArea) DOM.chatArea.innerHTML = '';

        if (chat.messages.length === 0) {
            UI.showWelcome();
        } else {
            UI.hideWelcome();
            chat.messages.forEach((msg, idx) => {
                if (msg.role === 'user') {
                    UI.renderUserMessage(msg.content, idx, false);
                } else if (msg.role === 'assistant') {
                    UI.renderAssistantMessage(msg.content, idx, chat.modelId, false);
                }
            });
            UI.scrollToBottom();
        }

        UI.updateModelBadge();
        Sidebar.renderHistory();
        Storage.saveChats();
        DOM.inputText?.focus();
    },

    /**
     * Add a message to the current session
     */
    addMessage(role, content) {
        if (!State.currentChatId || !State.chats[State.currentChatId]) {
            this.create();
        }

        const chat = State.chats[State.currentChatId];
        chat.messages.push({ role, content });
        chat.updatedAt = Date.now();

        /* Auto-title from first user message */
        if (chat.title === 'New Chat' && role === 'user') {
            chat.title = content.substring(0, CONFIG.AUTO_TITLE_MAX_LENGTH) +
                (content.length > CONFIG.AUTO_TITLE_MAX_LENGTH ? '...' : '');
            Sidebar.renderHistory();
        }

        Storage.saveChats();
    },

    /**
     * Update the last assistant message content
     */
    updateLastAssistant(content) {
        if (!State.currentChatId || !State.chats[State.currentChatId]) return;
        const msgs = State.chats[State.currentChatId].messages;
        if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
            msgs[msgs.length - 1].content = content;
            State.chats[State.currentChatId].updatedAt = Date.now();
        }
    },

    /**
     * Delete a specific chat session
     */
    delete(id) {
        delete State.chats[id];

        if (State.currentChatId === id) {
            const remaining = Object.keys(State.chats).sort((a, b) => {
                const tA = State.chats[a].updatedAt || 0;
                const tB = State.chats[b].updatedAt || 0;
                return tB - tA;
            });

            if (remaining.length > 0) {
                this.load(remaining[0]);
            } else {
                this.create();
            }
        }

        Storage.saveChats();
        Sidebar.renderHistory();
    },

    /**
     * Delete all chats
     */
    clearAll() {
        Storage.clearAllChats();
        if (DOM.chatArea) DOM.chatArea.innerHTML = '';
        UI.showWelcome();
        this.create();
        Sidebar.renderHistory();
    },

    /**
     * Get messages for the current session (for API call)
     */
    getCurrentMessages() {
        if (!State.currentChatId || !State.chats[State.currentChatId]) return [];
        return State.chats[State.currentChatId].messages;
    },

    /**
     * Get the model ID for the current session
     */
    getCurrentModelId() {
        return ModelManager.getModelForChat(State.currentChatId);
    },

    /**
     * Export current session as Markdown
     */
    exportCurrentAsMarkdown() {
        const chat = State.chats[State.currentChatId];
        if (!chat || chat.messages.length === 0) {
            Toast.warning('Nothing to export.');
            return;
        }

        const modelName = ModelManager.getName(chat.modelId);
        let md = `# ${chat.title}\n\n`;
        md += `**Model:** ${modelName}\n`;
        md += `**Date:** ${new Date(chat.createdAt).toLocaleString()}\n\n---\n\n`;

        chat.messages.forEach(msg => {
            if (msg.role === 'user') {
                md += `## You\n\n${msg.content}\n\n`;
            } else {
                md += `## Opensky\n\n${msg.content}\n\n`;
            }
        });

        const filename = `${CONFIG.EXPORT_PREFIX}-${Security.truncate(chat.title, 20).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.md`;
        Utils.downloadFile(filename, md);
        Toast.success('Chat exported as Markdown');
    },

    /**
     * Export current session as plain text
     */
    exportCurrentAsText() {
        const chat = State.chats[State.currentChatId];
        if (!chat || chat.messages.length === 0) {
            Toast.warning('Nothing to export.');
            return;
        }

        let txt = `${chat.title}\n${'='.repeat(chat.title.length)}\n\n`;
        txt += `Model: ${ModelManager.getName(chat.modelId)}\n`;
        txt += `Date: ${new Date(chat.createdAt).toLocaleString()}\n\n`;

        chat.messages.forEach(msg => {
            const label = msg.role === 'user' ? 'You' : 'Opensky';
            txt += `[${label}]\n${msg.content}\n\n`;
        });

        const filename = `${CONFIG.EXPORT_PREFIX}-${Security.truncate(chat.title, 20).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.txt`;
        Utils.downloadFile(filename, txt, 'text/plain');
        Toast.success('Chat exported as text');
    },

    /**
     * Copy all messages from current session
     */
    copyCurrentChat() {
        const chat = State.chats[State.currentChatId];
        if (!chat || chat.messages.length === 0) {
            Toast.warning('Nothing to copy.');
            return;
        }

        let text = '';
        chat.messages.forEach(msg => {
            const label = msg.role === 'user' ? 'You' : 'Opensky';
            text += `[${label}]\n${msg.content}\n\n`;
        });

        Utils.copyToClipboard(text).then(ok => {
            if (ok) Toast.success('Chat copied to clipboard');
            else Toast.error('Failed to copy');
        });
    }
};
/**
 * ============================================================
 *  PART 7: MESSAGE RENDERING, MARKDOWN PARSER & EXPORT MENU
 * ============================================================
 */


/* ── 7.1 Markdown Parser ── */
const Markdown = {

    /**
     * Parse markdown text into safe HTML
     * Handles: code blocks, inline code, bold, italic, links, lists, headings
     */
    parse(text) {
        if (!text) return '';

        /* 1. Escape HTML first to prevent XSS */
        let html = Security.escapeHTML(text);

        /* 2. Code blocks: ```lang\n...\n``` */
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'code';
            const escapedCode = code.trim();
            return `<div class="code-block-component">
                <div class="code-header">
                    <span class="code-lang">${language}</span>
                    <button class="copy-code-btn" onclick="ExportManager.copyCodeBlock(this)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy
                    </button>
                </div>
                <pre class="code-body"><code>${escapedCode}</code></pre>
            </div>`;
        });

        /* 3. Inline code: `code` */
        html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

        /* 4. Bold: **text** */
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        /* 5. Italic: *text* (not inside bold) */
        html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

        /* 6. Headings: ### text (only h3-h6 to avoid wrapping issues) */
        html = html.replace(/^####\s+(.+)$/gm, '<h4 style="font-size:1rem;font-weight:600;margin:12px 0 6px;">$1</h4>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3 style="font-size:1.125rem;font-weight:700;margin:16px 0 8px;">$1</h3>');

        /* 7. Unordered lists: - item or * item */
        html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
        html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul style="padding-left:20px;margin:8px 0;">$1</ul>');

        /* 8. Ordered lists: 1. item */
        html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

        /* 9. Horizontal rule: --- or *** */
        html = html.replace(/^[-*]{3,}$/gm, '<hr style="border:none;border-top:1px solid var(--color-border);margin:16px 0;">');

        /* 10. Line breaks */
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');

        /* 11. Wrap in paragraph if not starting with a block element */
        if (!html.startsWith('<div') && !html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<hr')) {
            html = `<p>${html}</p>`;
        }

        /* 12. Clean up empty paragraphs */
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p>(<div|<h[1-6]|<ul|<ol|<hr)/g, '$1');
        html = html.replace(/(<\/div>|<\/h[1-6]>|<\/ul>|<\/ol>|<hr[^>]*>)<\/p>/g, '$1');

        return html;
    }
};


/* ── 7.2 Export Manager ── */
const ExportManager = {

    /**
     * Copy code block content (called from inline onclick)
     */
    async copyCodeBlock(btn) {
        const codeBlock = btn.closest('.code-block-component');
        if (!codeBlock) return;

        const codeEl = codeBlock.querySelector('.code-body code');
        if (!codeEl) return;

        const text = codeEl.textContent;
        const ok = await Utils.copyToClipboard(text);

        if (ok) {
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Copied!
            `;
            setTimeout(() => {
                btn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy
                `;
            }, 2000);
        }
    },

    /**
     * Toggle the export dropdown menu on a message
     */
    toggleExportMenu(btn) {
        /* Close any existing export menu */
        document.querySelectorAll('.export-menu').forEach(m => m.remove());
        State.exportMenuOpen = false;

        if (!btn) return;

        const menu = document.createElement('div');
        menu.className = 'export-menu';

        menu.innerHTML = `
            <button class="export-menu-item" data-export="copy-full">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy full response
            </button>
            <button class="export-menu-item" data-export="copy-raw">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Copy raw markdown
            </button>
        `;

        /* Position relative to button */
        const wrapper = btn.closest('.msg-actions') || btn.parentElement;
        if (wrapper) {
            wrapper.style.position = 'relative';
            wrapper.appendChild(menu);
        }

        State.exportMenuOpen = true;

        /* Close on outside click */
        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== btn) {
                menu.remove();
                State.exportMenuOpen = false;
                document.removeEventListener('click', closeHandler);
            }
        };

        setTimeout(() => document.addEventListener('click', closeHandler), 10);

        /* Bind menu item clicks */
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.export-menu-item');
            if (!item) return;

            const type = item.getAttribute('data-export');
            const msgEl = btn.closest('.message') || btn.closest('.assistant-msg');
            const textEl = msgEl?.querySelector('.msg-text');

            if (!textEl) return;

            const rawText = textEl.getAttribute('data-raw') || textEl.textContent || '';

            if (type === 'copy-full') {
                Utils.copyToClipboard(rawText).then(ok => {
                    if (ok) Toast.success('Response copied');
                });
            } else if (type === 'copy-raw') {
                Utils.copyToClipboard(rawText).then(ok => {
                    if (ok) Toast.success('Raw markdown copied');
                });
            }

            menu.remove();
            State.exportMenuOpen = false;
            document.removeEventListener('click', closeHandler);
        });
    }
};


/* ── 7.3 Message Renderer ── */
const MessageRenderer = {

    /**
     * Render a user message in the chat area
     * @param {string} text - Message content
     * @param {number} msgIndex - Index in the messages array
     * @param {boolean} animate - Whether to animate in
     * @returns {HTMLElement|null}
     */
    renderUser(text, msgIndex, animate = true) {
        if (!DOM.tmplUserMsg || !DOM.chatArea) return null;

        const frag = DOM.tmplUserMsg.content.cloneNode(true);
        const msgEl = frag.querySelector('.message');
        const textEl = frag.querySelector('.msg-text');

        if (!msgEl || !textEl) return null;

        textEl.textContent = text;

        if (!animate) {
            msgEl.style.animation = 'none';
        }

        DOM.chatArea.appendChild(frag);
        return msgEl;
    },

    /**
     * Render an assistant message in the chat area
     * @param {string} text - Message content (markdown)
     * @param {number} msgIndex - Index in messages array
     * @param {string|null} modelId - Which model generated this
     * @param {boolean} animate - Whether to animate in
     * @returns {{ msgEl, textEl, statusEl } | null}
     */
    renderAssistant(text, msgIndex, modelId, animate = true) {
        if (!DOM.tmplAssistantMsg || !DOM.chatArea) return null;

        const frag = DOM.tmplAssistantMsg.content.cloneNode(true);
        const msgEl = frag.querySelector('.message');
        const textEl = frag.querySelector('.msg-text');
        const statusEl = msgEl?.querySelector('.msg-status');

        if (!msgEl || !textEl) return null;

        /* Store raw text for copying */
        textEl.setAttribute('data-raw', text || '');

        /* Render markdown */
        if (text) {
            textEl.innerHTML = Markdown.parse(text);
        }

        /* Show model tag if different from current */
        if (modelId && modelId !== State.selectedModelId) {
            const metaRow = document.createElement('div');
            metaRow.className = 'msg-meta-row';
            metaRow.innerHTML = `<span class="msg-model-tag">${Security.escapeHTML(ModelManager.getName(modelId))}</span>`;
            textEl.parentElement.insertBefore(metaRow, textEl.nextSibling);
        }

        /* Word count */
        if (text) {
            const wc = Utils.wordCount(text);
            if (wc > 0) {
                const countEl = document.createElement('span');
                countEl.className = 'msg-word-count';
                countEl.textContent = `${wc} words`;
                const actionsEl = msgEl.querySelector('.msg-actions');
                if (actionsEl) {
                    actionsEl.parentElement.insertBefore(countEl, actionsEl);
                }
            }
        }

        if (!animate) {
            msgEl.style.animation = 'none';
        }

        /* Hide status by default (only shown during streaming) */
        if (statusEl) statusEl.classList.add('hidden');

        DOM.chatArea.appendChild(frag);
        return { msgEl, textEl, statusEl };
    }
};


/* ── 7.4 Main UI Controller ── */
const UI = {

    /**
     * Boot the UI after loading screen is done
     */
    boot() {
        if (State.isInitialized) return;
        State.isInitialized = true;

        Modal.initEvents();
        SettingsUI.init();
        Sidebar.initEvents();
        this.bindGlobalEvents();
        this.updateModelBadge();

        /* Load last active chat or show welcome */
        if (State.currentChatId && State.chats[State.currentChatId]) {
            SessionManager.load(State.currentChatId);
        } else {
            this.showWelcome();
            Sidebar.renderHistory();
        }

        console.log(`%c${CONFIG.APP_NAME} v${CONFIG.VERSION} ready`, 'color: #000; font-weight: bold; font-size: 14px;');
    },

    /**
     * Bind all global event listeners
     */
    bindGlobalEvents() {
        /* ── Input handling ── */
        if (DOM.inputText) {
            /* Auto-resize */
            DOM.inputText.addEventListener('input', () => {
                DOM.inputText.style.height = 'auto';
                DOM.inputText.style.height = Math.min(DOM.inputText.scrollHeight, 120) + 'px';
            });

            /* Send on Enter */
            DOM.inputText.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    Agent.handleSend();
                }
            });
        }

        /* ── Send button ── */
        if (DOM.sendBtn) {
            DOM.sendBtn.addEventListener('click', () => Agent.handleSend());
        }

        /* ── Suggestion cards ── */
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                if (prompt && DOM.inputText) {
                    DOM.inputText.value = prompt;
                    Agent.handleSend();
                }
            });
        });

        /* ── Settings button ── */
        const settingsBtn = document.getElementById('openSettingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                SettingsUI.render();
                Modal.open('settingsModal');
            });
        }

        /* ── Model picker button ── */
        const modelBtn = document.getElementById('openModelPickerBtn');
        if (modelBtn) {
            modelBtn.addEventListener('click', () => {
                ModelPicker._searchQuery = '';
                ModelPicker.render();
                Modal.open('modelPickerModal');
            });
        }

        /* ── Export current chat button (in top bar) ── */
        const exportBtn = document.getElementById('exportChatBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', (e) => {
                ExportManager.toggleExportMenu(exportBtn);
            });
        }

        /* ── Chat area event delegation (for message action buttons) ── */
        if (DOM.chatArea) {
            DOM.chatArea.addEventListener('click', (e) => {
                this._handleChatAreaClick(e);
            });
        }

        /* ── Close export menu on scroll ── */
        if (DOM.chatArea) {
            DOM.chatArea.addEventListener('scroll', () => {
                if (State.exportMenuOpen) {
                    document.querySelectorAll('.export-menu').forEach(m => m.remove());
                    State.exportMenuOpen = false;
                }
            });
        }
    },

    /**
     * Handle clicks inside the chat area (event delegation)
     */
    _handleChatAreaClick(e) {
        /* ── User message: edit button ── */
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            const msgEl = editBtn.closest('.message');
            if (msgEl) this._handleEditUserMsg(msgEl);
            return;
        }

        /* ── User message: copy button ── */
        const userCopyBtn = e.target.closest('.copy-btn');
        if (userCopyBtn) {
            const msgEl = userCopyBtn.closest('.message');
            if (msgEl) {
                const textEl = msgEl.querySelector('.msg-text');
                if (textEl) {
                    Utils.copyToClipboard(textEl.textContent).then(ok => {
                        if (ok) {
                            userCopyBtn.classList.add('copied');
                            setTimeout(() => userCopyBtn.classList.remove('copied'), 2000);
                        }
                    });
                }
            }
            return;
        }

        /* ── User message: delete button ── */
        const userDelBtn = e.target.closest('.delete-btn');
        if (userDelBtn) {
            const msgEl = userDelBtn.closest('.message');
            if (msgEl) {
                InlineConfirm.activate(userDelBtn, 'Delete?', () => {
                    this._handleDeleteUserMsg(msgEl);
                });
            }
            return;
        }

        /* ── Assistant message: copy button ── */
        const asstCopyBtn = e.target.closest('.copy-btn');
        if (asstCopyBtn) {
            const msgEl = asstCopyBtn.closest('.message');
            if (msgEl) {
                const textEl = msgEl.querySelector('.msg-text');
                const rawText = textEl?.getAttribute('data-raw') || textEl?.textContent || '';
                Utils.copyToClipboard(rawText).then(ok => {
                    if (ok) {
                        asstCopyBtn.classList.add('copied');
                        setTimeout(() => asstCopyBtn.classList.remove('copied'), 2000);
                    }
                });
            }
            return;
        }

        /* ── Assistant message: export/menu button ── */
        const exportMsgBtn = e.target.closest('.export-btn');
        if (exportMsgBtn) {
            ExportManager.toggleExportMenu(exportMsgBtn);
            return;
        }

        /* ── Assistant message: regenerate button ── */
        const regenBtn = e.target.closest('.regen-btn');
        if (regenBtn) {
            const msgEl = regenBtn.closest('.message');
            if (msgEl) this._handleRegenerate(msgEl);
            return;
        }

        /* ── Assistant message: delete button ── */
        const asstDelBtn = e.target.closest('.delete-btn');
        if (asstDelBtn) {
            const msgEl = asstDelBtn.closest('.message');
            if (msgEl) {
                InlineConfirm.activate(asstDelBtn, 'Delete?', () => {
                    this._handleDeleteAsstMsg(msgEl);
                });
            }
            return;
        }
    },

    /* ── Message Action Handlers ── */

    _handleEditUserMsg(msgEl) {
        const textEl = msgEl.querySelector('.msg-text');
        if (!textEl || !DOM.inputText) return;

        const oldText = textEl.textContent;

        /* Visual editing state */
        document.querySelectorAll('.user-msg.editing').forEach(el => el.classList.remove('editing'));
        msgEl.classList.add('editing');

        DOM.inputText.value = oldText;
        DOM.inputText.focus();

        /* Remove editing state on input change */
        const removeEdit = () => {
            msgEl.classList.remove('editing');
            DOM.inputText.removeEventListener('input', removeEdit);
        };
        DOM.inputText.addEventListener('input', removeEdit);
    },

    _handleDeleteUserMsg(msgEl) {
        const allMsgs = Array.from(DOM.chatArea.querySelectorAll('.message'));
        const domIdx = allMsgs.indexOf(msgEl);

        /* Remove from state: each message element corresponds to a message in the array */
        /* We need to figure out the state index from the DOM index */
        const stateIdx = this._domIndexToStateIndex(domIdx, allMsgs);

        if (stateIdx !== null && State.currentChatId && State.chats[State.currentChatId]) {
            State.chats[State.currentChatId].messages.splice(stateIdx, 1);
            Storage.saveChats();
        }

        /* Also remove the next assistant message if it exists (keep pairs clean) */
        if (domIdx + 1 < allMsgs.length) {
            const nextEl = allMsgs[domIdx + 1];
            if (nextEl.classList.contains('assistant-msg')) {
                const nextStateIdx = this._domIndexToStateIndex(domIdx + 1, allMsgs);
                if (nextStateIdx !== null) {
                    State.chats[State.currentChatId].messages.splice(nextStateIdx, 1);
                }
                nextEl.remove();
            }
        }

        msgEl.remove();

        if (DOM.chatArea.querySelectorAll('.message').length === 0) {
            this.showWelcome();
        }

        Storage.saveChats();
    },

    _handleDeleteAsstMsg(msgEl) {
        const allMsgs = Array.from(DOM.chatArea.querySelectorAll('.message'));
        const domIdx = allMsgs.indexOf(msgEl);
        const stateIdx = this._domIndexToStateIndex(domIdx, allMsgs);

        if (stateIdx !== null && State.currentChatId && State.chats[State.currentChatId]) {
            State.chats[State.currentChatId].messages.splice(stateIdx, 1);
            Storage.saveChats();
        }

        msgEl.remove();

        if (DOM.chatArea.querySelectorAll('.message').length === 0) {
            this.showWelcome();
        }
    },

    async _handleRegenerate(msgEl) {
        if (State.isGenerating) return;

        const allMsgs = Array.from(DOM.chatArea.querySelectorAll('.message'));
        const domIdx = allMsgs.indexOf(msgEl);
        const stateIdx = this._domIndexToStateIndex(domIdx, allMsgs);

        if (stateIdx === null || !State.currentChatId) return;

        /* Find the preceding user message */
        let userText = null;
        if (stateIdx > 0 && State.chats[State.currentChatId].messages[stateIdx - 1].role === 'user') {
            userText = State.chats[State.currentChatId].messages[stateIdx - 1].content;
        }

        if (!userText) {
            Toast.warning('Cannot regenerate without a preceding user message.');
            return;
        }

        /* Remove the old assistant message from state and DOM */
        State.chats[State.currentChatId].messages.splice(stateIdx, 1);
        msgEl.remove();

        /* Remove all messages after the user message from DOM */
        const remainingMsgs = Array.from(DOM.chatArea.querySelectorAll('.message'));
        for (let i = domIdx; i < remainingMsgs.length; i++) {
            remainingMsgs[i].remove();
            /* Also remove from state */
            const sIdx = this._domIndexToStateIndex(domIdx, remainingMsgs);
            if (sIdx !== null && State.chats[State.currentChatId]) {
                State.chats[State.currentChatId].messages.splice(sIdx, 1);
            }
        }

        Storage.saveChats();

        /* Show regenerating label */
        const label = document.createElement('div');
        label.className = 'regenerating-label';
        label.textContent = 'Regenerating response...';
        DOM.chatArea.appendChild(label);

        await Utils.sleep(300);
        label.remove();

        /* Re-generate */
        await Agent.generateResponse(userText);
    },

    /**
     * Map a DOM index to the state messages array index
     */
    _domIndexToStateIndex(domIdx, allMsgs) {
        /* Since we render messages in order and each DOM message = one state message */
        return domIdx;
    },

    /* ── UI State Helpers ── */

    showWelcome() {
        if (DOM.welcomeScreen) {
            DOM.welcomeScreen.classList.remove('hidden');
            DOM.welcomeScreen.style.display = 'flex';
        }
        if (DOM.chatArea) DOM.chatArea.classList.remove('active');
    },

    hideWelcome() {
        if (DOM.welcomeScreen) {
            DOM.welcomeScreen.classList.add('hidden');
            DOM.welcomeScreen.style.display = 'none';
        }
        if (DOM.chatArea) DOM.chatArea.classList.add('active');
    },

    scrollToBottom() {
        requestAnimationFrame(() => {
            if (DOM.chatArea) {
                DOM.chatArea.scrollTop = DOM.chatArea.scrollHeight;
            }
        });
    },

    setGenerating(isGenerating) {
        State.isGenerating = isGenerating;

        if (DOM.sendBtn) {
            DOM.sendBtn.classList.toggle('is-generating', isGenerating);

            const sendIcon = DOM.sendBtn.querySelector('.icon-send');
            const stopIcon = DOM.sendBtn.querySelector('.icon-stop');

            if (sendIcon) sendIcon.style.display = isGenerating ? 'none' : 'block';
            if (stopIcon) stopIcon.style.display = isGenerating ? 'block' : 'none';
        }
    },

    updateModelBadge() {
        if (!DOM.modelBadge) return;
        const modelId = SessionManager.getCurrentModelId();
        const name = ModelManager.getName(modelId);
        DOM.modelBadge.textContent = name;
    },

    /* ── Convenience render wrappers ── */

    renderUserMessage(text, idx, save = true) {
        this.hideWelcome();
        const el = MessageRenderer.renderUser(text, idx, true);
        this.scrollToBottom();
        if (save) SessionManager.addMessage('user', text);
        return el;
    },

    renderAssistantMessage(text, idx, modelId, save = true) {
        this.hideWelcome();
        const result = MessageRenderer.renderAssistant(text, idx, modelId, true);
        this.scrollToBottom();
        if (save && text) SessionManager.addMessage('assistant', text);
        return result;
    }
};
/**
 * ============================================================
 *  PART 8: OPENROUTER CLIENT, AGENT LOOP & EVENT BINDINGS
 * ============================================================
 */


/* ── 8.1 OpenRouter API Client ── */
const OpenRouterClient = {

    /**
     * Build the messages array for the OpenRouter API
     * Includes system prompt + conversation history (respecting maxHistory)
     */
    buildMessages(chatMessages, modelId) {
        const messages = [];

        /* System prompt */
        const sysPrompt = State.settings.systemPrompt || CONFIG.DEFAULT_SYSTEM_PROMPT;
        messages.push({ role: 'system', content: sysPrompt });

        /* Get history slice (last N message pairs) */
        const maxMsgs = State.settings.maxHistory * 2;
        const history = chatMessages.slice(-maxMsgs);

        history.forEach(msg => {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        });

        return messages;
    },

    /**
     * Make a streaming chat completion request to OpenRouter
     * @param {Array} messages - OpenRouter format messages
     * @param {string} modelId - Model to use
     * @param {Function} onChunk - Called with each text chunk
     * @param {Function} onDone - Called when streaming is complete
     * @param {Function} onError - Called on error
     * @returns {AbortController} - For cancelling
     */
    streamChat(messages, modelId, onChunk, onDone, onError) {
        const controller = new AbortController();

        const body = {
            model: modelId,
            messages: messages,
            stream: true,
            max_tokens: State.settings.maxTokens,
            temperature: State.settings.temperature,
            top_p: State.settings.topP
        };

        fetch(CONFIG.OPENROUTER_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'HTTP-Referer': CONFIG.SITE_URL,
                'X-Title': CONFIG.SITE_NAME
            },
            body: JSON.stringify(body),
            signal: controller.signal
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    const errMsg = errData?.error?.message || `HTTP ${response.status}`;
                    throw new OpenRouterError(response.status, errMsg);
                }).catch(err => {
                    if (err instanceof OpenRouterError) throw err;
                    throw new OpenRouterError(response.status, `Request failed with status ${response.status}`);
                });
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            function read() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        onDone();
                        return;
                    }

                    buffer += decoder.decode(value, { stream: true });

                    /* Process SSE lines */
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; /* Keep incomplete line in buffer */

                    for (const line of lines) {
                        const trimmed = line.trim();

                        if (!trimmed || trimmed === 'data: [DONE]') continue;
                        if (!trimmed.startsWith('data: ')) continue;

                        try {
                            const json = JSON.parse(trimmed.slice(6));
                            const content = json.choices?.[0]?.delta?.content;

                            if (content) {
                                onChunk(content);
                            }
                        } catch (parseErr) {
                            /* Skip malformed JSON chunks */
                        }
                    }

                    read();

                }).catch(err => {
                    if (err.name === 'AbortError') {
                        onDone();
                        return;
                    }
                    onError(err);
                });
            }

            read();

        })
        .catch(err => {
            if (err.name === 'AbortError') {
                onDone();
                return;
            }
            if (err instanceof OpenRouterError) {
                onError(err);
                return;
            }
            onError(new OpenRouterError(0, err.message || CONFIG.ERRORS.NETWORK_ERROR));
        });

        return controller;
    }
};


/* ── 8.2 Custom Error Class ── */
class OpenRouterError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.name = 'OpenRouterError';
        this.statusCode = statusCode;
    }
}


/* ── 8.3 Error Classifier ── */
const ErrorClassifier = {

    classify(error) {
        if (!(error instanceof OpenRouterError)) {
            return CONFIG.ERRORS.NETWORK_ERROR;
        }

        const status = error.statusCode;
        const msg = (error.message || '').toLowerCase();

        if (status === 401 || status === 403) return CONFIG.ERRORS.AUTH_FAILED;
        if (status === 429) return CONFIG.ERRORS.RATE_LIMITED;
        if (status === 404) return CONFIG.ERRORS.MODEL_UNAVAILABLE;
        if (msg.includes('context') || msg.includes('token') || msg.includes('length')) {
            return CONFIG.ERRORS.CONTEXT_TOO_LONG;
        }
        if (msg.includes('quota') || msg.includes('credit') || msg.includes('limit')) {
            return CONFIG.ERRORS.QUOTA_EXCEEDED;
        }

        return error.message || CONFIG.ERRORS.UNKNOWN;
    }
};


/* ── 8.4 Agent Core ── */
const Agent = {

    /**
     * Handle the send button / Enter key press
     */
    async handleSend() {
        /* If generating, stop */
        if (State.isGenerating) {
            State.stopGenerationFlag = true;
            if (State.currentAbortController) {
                State.currentAbortController.abort();
            }
            UI.setGenerating(false);
            Toast.show('Stopped generation');
            return;
        }

        /* Validate input */
        const text = (DOM.inputText?.value || '').trim();
        if (!text) return;

        /* Validate API key */
        if (!Security.isValidKey(API_KEY)) {
            Toast.error(CONFIG.ERRORS.NO_API_KEY);
            return;
        }

        /* Validate model */
        const modelId = SessionManager.getCurrentModelId();
        if (!modelId) {
            Toast.error('No model selected. Open the Model Picker to select one.');
            return;
        }

        /* Truncate if too long */
        let sendText = text;
        if (sendText.length > CONFIG.MAX_INPUT_LENGTH) {
            sendText = sendText.substring(0, CONFIG.MAX_INPUT_LENGTH);
            Toast.warning(`Message truncated to ${CONFIG.MAX_INPUT_LENGTH} characters.`);
        }

        /* Clear input */
        DOM.inputText.value = '';
        DOM.inputText.style.height = 'auto';

        /* Render user message */
        UI.renderUserMessage(sendText, null, true);

        /* Generate response */
        await this.generateResponse(sendText);
    },

    /**
     * Generate a response for the given user input
     * Handles streaming, error recovery, and retry
     */
    async generateResponse(userText) {
        const modelId = SessionManager.getCurrentModelId();
        if (!modelId) return;

        /* Build messages array */
        const chatMessages = SessionManager.getCurrentMessages();
        const apiMessages = OpenRouterClient.buildMessages(chatMessages, modelId);

        /* Setup streaming UI */
        const { msgEl, textEl, statusEl } = UI.renderAssistantMessage('', null, modelId, false) || {};

        if (!textEl) return;

        const statusLabel = statusEl?.querySelector('.status-label');
        if (statusEl) statusEl.classList.remove('hidden');
        if (statusLabel) statusLabel.textContent = 'Thinking...';

        UI.setGenerating(true);
        State.stopGenerationFlag = false;

        let fullText = '';
        let lastChunkTime = Date.now();
        let streamActive = false;

        /* Retry loop */
        for (let attempt = 0; attempt <= CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
            if (State.stopGenerationFlag) break;

            try {
                if (attempt > 0) {
                    const delay = Math.min(
                        CONFIG.RETRY.BASE_DELAY * Math.pow(CONFIG.RETRY.BACKOFF_FACTOR, attempt - 1),
                        CONFIG.RETRY.MAX_DELAY
                    );
                    if (statusLabel) statusLabel.textContent = `Retrying in ${delay / 1000}s...`;
                    await Utils.sleep(delay);
                    if (State.stopGenerationFlag) break;
                    if (statusLabel) statusLabel.textContent = 'Thinking...';
                }

                fullText = '';
                streamActive = false;
                lastChunkTime = Date.now();

                State.currentAbortController = OpenRouterClient.streamChat(
                    apiMessages,
                    modelId,

                    /* onChunk */
                    (chunk) => {
                        if (State.stopGenerationFlag) return;

                        streamActive = true;
                        lastChunkTime = Date.now();
                        fullText += chunk;

                        /* Update UI with parsed markdown + cursor */
                        textEl.setAttribute('data-raw', fullText);
                        textEl.innerHTML = Markdown.parse(fullText) + '<span class="streaming-cursor"></span>';
                        UI.scrollToBottom();

                        /* Update status */
                        if (statusLabel) statusLabel.textContent = 'Responding...';
                    },

                    /* onDone */
                    () => {
                        streamActive = false;
                    },

                    /* onError */
                    (error) => {
                        streamActive = false;
                        throw error;
                    }
                );

                /* Wait for stream to finish (poll since we can't await the callback-based stream) */
                await this._waitForStreamComplete(() => !streamActive || State.stopGenerationFlag);

                /* Success — break out of retry loop */
                break;

            } catch (error) {
                /* If user stopped, don't retry */
                if (State.stopGenerationFlag) break;

                const friendlyMsg = ErrorClassifier.classify(error);

                /* Don't retry auth errors or context errors */
                if (error instanceof OpenRouterError) {
                    if ([401, 403, 404].includes(error.statusCode)) {
                        this._showError(textEl, statusEl, friendlyMsg);
                        break;
                    }
                }

                /* Last attempt failed */
                if (attempt >= CONFIG.RETRY.MAX_ATTEMPTS) {
                    this._showError(textEl, statusEl, friendlyMsg);
                    break;
                }

                /* Otherwise, retry */
                console.warn(`Attempt ${attempt + 1} failed, retrying...`, error.message);
            }
        }

        /* ── Finalize ── */

        /* Remove streaming cursor */
        const cursor = textEl.querySelector('.streaming-cursor');
        if (cursor) cursor.remove();

        /* Hide status */
        if (statusEl) statusEl.classList.add('hidden');

        /* If we have text, save it and render final markdown */
        if (fullText.trim()) {
            textEl.setAttribute('data-raw', fullText);
            textEl.innerHTML = Markdown.parse(fullText);

            /* Add word count */
            const wc = Utils.wordCount(fullText);
            if (wc > 0) {
                /* Remove existing word count if any */
                const existing = msgEl?.querySelector('.msg-word-count');
                if (existing) existing.remove();

                const countEl = document.createElement('span');
                countEl.className = 'msg-word-count';
                countEl.textContent = `${wc} words`;
                const actionsEl = msgEl?.querySelector('.msg-actions');
                if (actionsEl) {
                    actionsEl.parentElement.insertBefore(countEl, actionsEl);
                }
            }

            /* Save to session */
            SessionManager.updateLastAssistant(fullText);

            /* If this was a new assistant message (not saved yet), add it */
            const msgs = SessionManager.getCurrentMessages();
            if (msgs.length === 0 || msgs[msgs.length - 1].role !== 'assistant') {
                SessionManager.addMessage('assistant', fullText);
            }

        } else if (!State.stopGenerationFlag) {
            /* Empty response — show warning */
            textEl.innerHTML = `<span style="color: var(--color-warning); font-style: italic;">${Security.escapeHTML(CONFIG.ERRORS.EMPTY_RESPONSE)}</span>`;
        }

        UI.setGenerating(false);
        State.currentAbortController = null;
        UI.scrollToBottom();
    },

    /**
     * Wait for a condition to become true
     */
    _waitForStreamComplete(conditionFn) {
        return new Promise((resolve) => {
            const check = () => {
                if (conditionFn()) {
                    resolve();
                    return;
                }
                setTimeout(check, 50);
            };
            check();

            /* Safety timeout: 5 minutes max */
            setTimeout(resolve, 300000);
        });
    },

    /**
     * Show an error in the assistant message area
     */
    _showError(textEl, statusEl, message) {
        if (statusEl) statusEl.classList.add('hidden');
        if (textEl) {
            textEl.innerHTML = `<span style="color: var(--color-error);">${Security.escapeHTML(message)}</span>`;
        }
        Toast.error(message);
    }
};


/* ── 8.5 Top Bar Export Menu (for exporting entire chat) ── */
const TopBarExport = {

    init() {
        const exportBtn = document.getElementById('exportChatBtn');
        if (!exportBtn) return;

        /* The button click is handled in UI.bindGlobalEvents already */
        /* But we need to customize the menu for top-bar export */
        const originalToggle = ExportManager.toggleExportMenu.bind(ExportManager);

        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.export-menu').forEach(m => m.remove());
            State.exportMenuOpen = false;

            const menu = document.createElement('div');
            menu.className = 'export-menu';

            menu.innerHTML = `
                <button class="export-menu-item" data-top-export="markdown">
                    <span>📄</span> Export as Markdown
                </button>
                <button class="export-menu-item" data-top-export="text">
                    <span>📝</span> Export as Text
                </button>
                <button class="export-menu-item" data-top-export="copy-all">
                    <span>📋</span> Copy Entire Chat
                </button>
            `;

            const wrapper = exportBtn.parentElement;
            if (wrapper) {
                wrapper.style.position = 'relative';
                wrapper.appendChild(menu);
            }

            State.exportMenuOpen = true;

            const closeHandler = (ev) => {
                if (!menu.contains(ev.target) && ev.target !== exportBtn) {
                    menu.remove();
                    State.exportMenuOpen = false;
                    document.removeEventListener('click', closeHandler);
                }
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 10);

            menu.addEventListener('click', (ev) => {
                const item = ev.target.closest('.export-menu-item');
                if (!item) return;

                const type = item.getAttribute('data-top-export');
                switch (type) {
                    case 'markdown':
                        SessionManager.exportCurrentAsMarkdown();
                        break;
                    case 'text':
                        SessionManager.exportCurrentAsText();
                        break;
                    case 'copy-all':
                        SessionManager.copyCurrentChat();
                        break;
                }

                menu.remove();
                State.exportMenuOpen = false;
                document.removeEventListener('click', closeHandler);
            });
        });
    }
};


/* ── 8.6 Keyboard Shortcuts ── */
const KeyboardShortcuts = {

    init() {
        document.addEventListener('keydown', (e) => {
            /* Ctrl/Cmd + Shift + N: New chat */
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                SessionManager.create();
                Sidebar.close();
            }

            /* Ctrl/Cmd + Shift + S: Open settings */
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                SettingsUI.render();
                Modal.open('settingsModal');
            }

            /* Ctrl/Cmd + Shift + M: Open model picker */
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
                e.preventDefault();
                ModelPicker._searchQuery = '';
                ModelPicker.render();
                Modal.open('modelPickerModal');
            }

            /* Ctrl/Cmd + Shift + E: Export chat */
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
                e.preventDefault();
                SessionManager.exportCurrentAsMarkdown();
            }

            /* Focus input on / key (when not in an input) */
            if (e.key === '/' && !this._isInInput(e)) {
                e.preventDefault();
                if (DOM.inputText) DOM.inputText.focus();
            }
        });
    },

    _isInInput(e) {
        const tag = e.target.tagName.toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    }
};


/* ── 8.7 Boot Sequence ──
 *  This runs immediately when the script loads
 */
(function boot() {
    /* Wait for DOM to be ready */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Init.run());
    } else {
        Init.run();
    }

    /* Initialize extras once UI is ready (observed via MutationObserver on appContainer) */
    const observer = new MutationObserver((mutations, obs) => {
        if (DOM.appContainer && DOM.appContainer.style.display === 'flex') {
            obs.disconnect();
            /* Small delay to ensure all DOM refs are valid */
            setTimeout(() => {
                TopBarExport.init();
                KeyboardShortcuts.init();
            }, 100);
        }
    });

    /* Start observing once DOM is ready */
    const startObserver = () => {
        const target = document.getElementById('appContainer');
        if (target) {
            observer.observe(target, { attributes: true, attributeFilter: ['style'] });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }
})();

/* ── 8.8 Boot Sequence ── */
(function boot() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Init.run());
    } else {
        Init.run();
    }

    const observer = new MutationObserver((mutations, obs) => {
        if (DOM.appContainer && DOM.appContainer.style.display === 'flex') {
            obs.disconnect();
            setTimeout(() => {
                TopBarExport.init();
                KeyboardShortcuts.init();
            }, 100);
        }
    });

    const startObserver = () => {
        const target = document.getElementById('appContainer');
        if (target) {
            observer.observe(target, { attributes: true, attributeFilter: ['style'] });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }
})();
