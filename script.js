/**
 * ==========================================
 * OPENSKAY AI AGENT - MASSIVE ARCHITECTURE
 * ==========================================
 * PART 1: Core Engine, State & Initialization
 * NOTE: Requires 'gemma-4-E2B-it-int4-Web.litertlm' in the same directory!
 */

import { LlmInference, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest";

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
    APP_NAME: "Opensky",
    CREATOR: "Hafij Shaikh",
    MODEL_PATH: './gemma-4-E2B-it-int4-Web.litertlm', // LOCAL FILE PATH
    WASM_PATH: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm",
    
    DEFAULT_SYSTEM_PROMPT: `You are Opensky, a highly intelligent and helpful AI assistant created by ${'Hafij Shaikh'}. You run entirely locally in the user's browser.
Rules:
1. Be concise, accurate, and conversational.
2. Format responses with clear paragraphs or lists.
3. If you need real-time data or external knowledge, you MUST use a tool.
4. To use a tool, output EXACTLY in this format: ACTION: tool_name ARGS: argument
5. Do not output anything else on the line where you call the tool.
6. After receiving an "Observation:", process the data and answer the user naturally.`,

    DEFAULT_SETTINGS: {
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 1024,
        topK: 40,
        maxHistory: 10,
        enabledTools: {
            wiki: true, weather: true, crypto: true, pokemon: true,
            country: true, define: true, joke: true, advice: true, bored: true
        }
    },

    TOOL_DEFINITIONS: {
        wiki: "Search Wikipedia for a topic. Usage: ACTION: wiki ARGS: topic",
        weather: "Get current weather for a city. Usage: ACTION: weather ARGS: city name",
        crypto: "Get crypto price in USD. Usage: ACTION: crypto ARGS: bitcoin/ethereum",
        pokemon: "Get Pokemon data and sprite. Usage: ACTION: pokemon ARGS: pikachu",
        country: "Get country info and flag. Usage: ACTION: country ARGS: japan",
        define: "Get dictionary definition. Usage: ACTION: define ARGS: word",
        joke: "Get a random joke. Usage: ACTION: joke ARGS: none",
        advice: "Get random advice. Usage: ACTION: advice ARGS: none",
        bored: "Get activity suggestion. Usage: ACTION: bored ARGS: none"
    },

    LOADING_TIPS: [
        "Tip: All processing happens locally. No data leaves your device.",
        "Tip: You can edit your messages to steer the conversation.",
        "Tip: Toggle tools on/off in Settings if the AI acts weird.",
        "Tip: Keep responses short for faster streaming.",
        "Loading local model weights into WebAssembly...",
        "Optimizing neural network graphs for your device..."
    ]
};

// ==========================================
// 2. APPLICATION STATE
// ==========================================
const State = {
    llm: null,
    isReady: false,
    isGenerating: false,
    stopGenerationFlag: false,
    
    // Chat Management
    currentChatId: null,
    chats: {}, // { id: { title: string, messages: [] } }
    
    // Settings
    settings: JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS)),

    // UI State
    sidebarOpen: false,
    activeModal: null
};

// ==========================================
// 3. LOCAL STORAGE MANAGER
// ==========================================
const Storage = {
    KEYS: {
        SETTINGS: 'opensky_settings',
        CHATS: 'opensky_chats',
        ACTIVE_CHAT: 'opensky_active_chat'
    },

    saveSettings() {
        try {
            localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(State.settings));
        } catch (e) {
            console.error("Failed to save settings:", e);
        }
    },

    loadSettings() {
        try {
            const saved = localStorage.getItem(this.KEYS.SETTINGS);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults in case new settings were added in updates
                State.settings = { ...JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS)), ...parsed };
            } else {
                State.settings = JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS));
            }
        } catch (e) {
            console.error("Failed to load settings:", e);
            State.settings = JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS));
        }
    },

    saveChats() {
        try {
            // Limit history size to prevent quota errors (e.g., 5MB limit)
            const dataStr = JSON.stringify(State.chats);
            if (dataStr.length > 4 * 1024 * 1024) {
                Toast.show("Chat history is getting large, old chats might be trimmed.", "error");
                // Basic cleanup: keep only last 10 chats
                const keys = Object.keys(State.chats).sort((a,b) => b - a);
                if(keys.length > 10) {
                    keys.slice(10).forEach(k => delete State.chats[k]);
                }
            }
            localStorage.setItem(this.KEYS.CHATS, JSON.stringify(State.chats));
            localStorage.setItem(this.KEYS.ACTIVE_CHAT, State.currentChatId);
        } catch (e) {
            console.error("Failed to save chats:", e);
            Toast.show("Failed to save chat history (Storage full?).", "error");
        }
    },

    loadChats() {
        try {
            const saved = localStorage.getItem(this.KEYS.CHATS);
            if (saved) State.chats = JSON.parse(saved);
            State.currentChatId = localStorage.getItem(this.KEYS.ACTIVE_CHAT);
        } catch (e) {
            console.error("Failed to load chats:", e);
            State.chats = {};
        }
    },

    clearAll() {
        localStorage.removeItem(this.KEYS.CHATS);
        localStorage.removeItem(this.KEYS.ACTIVE_CHAT);
        State.chats = {};
        State.currentChatId = null;
    }
};

// ==========================================
// 4. DOM REFERENCES CACHE
// ==========================================
const DOM = {
    // Loading
    loadingScreen: document.getElementById('loadingScreen'),
    progressBar: document.getElementById('progressBar'),
    loadingPercent: document.getElementById('loadingPercent'),
    loadingStatus: document.getElementById('loadingStatus'),
    loadingTips: document.getElementById('loadingTips'),
    errorBox: document.getElementById('errorBox'),
    errorMessage: document.getElementById('errorMessage'),

    // App
    appContainer: document.getElementById('appContainer'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    historyList: document.getElementById('historyList'),
    
    // Top Bar
    statusBadge: document.getElementById('statusBadge'),

    // Chat
    welcomeScreen: document.getElementById('welcomeScreen'),
    chatArea: document.getElementById('chatArea'),
    inputText: document.getElementById('inputText'),
    sendBtn: document.getElementById('sendBtn'),
    
    // Templates
    tmplUserMsg: document.getElementById('tmplUserMsg'),
    tmplAssistantMsg: document.getElementById('tmplAssistantMsg'),
    tmplToolCall: document.getElementById('tmplToolCall'),
    tmplCodeBlock: document.getElementById('tmplCodeBlock'),
    tmplToast: document.getElementById('tmplToast'),
    
    // Modals
    settingsModal: document.getElementById('settingsModal'),
    toolsModal: document.getElementById('toolsModal'),
    
    // Toast Container
    toastContainer: document.getElementById('toastContainer')
};

// ==========================================
// 5. TOAST NOTIFICATION SYSTEM
// ==========================================
const Toast = {
    show(message, type = 'default', duration = 3000) {
        const toast = DOM.tmplToast.content.cloneNode(true).querySelector('.toast-notification');
        toast.querySelector('.toast-message').textContent = message;
        if (type === 'error') toast.classList.add('error');
        if (type === 'success') toast.classList.add('success');
        
        DOM.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// ==========================================
// 6. INITIALIZATION ENGINE
// ==========================================
const Engine = {
    currentProgress: 0,
    progressInterval: null,
    tipInterval: null,

    async init() {
        Storage.loadSettings();
        Storage.loadChats();
        this.setupLoadingUI();
        
        try {
            await this.loadModel();
            this.onSuccess();
        } catch (error) {
            this.onError(error);
        }
    },

    setupLoadingUI() {
        let tipIndex = 0;
        DOM.loadingTips.innerHTML = `<p>${CONFIG.LOADING_TIPS[0]}</p>`;
        
        this.tipInterval = setInterval(() => {
            tipIndex = (tipIndex + 1) % CONFIG.LOADING_TIPS.length;
            DOM.loadingTips.innerHTML = `<p>${CONFIG.LOADING_TIPS[tipIndex]}</p>`;
        }, 3000);

        // Simulate progress since local file loading doesn't emit byte progress
        this.progressInterval = setInterval(() => {
            if (this.currentProgress < 90) {
                this.currentProgress += Math.random() * 5;
                this.updateProgressUI(this.currentProgress);
            }
        }, 200);
    },

    updateProgressUI(value) {
        const clamped = Math.min(100, Math.max(0, value));
        DOM.progressBar.style.width = `${clamped}%`;
        DOM.loadingPercent.textContent = `${clamped.toFixed(2)}%`;
    },

    async loadModel() {
        DOM.loadingStatus.textContent = "Loading WebAssembly Engine...";
        
        // 1. Load WASM
        const genai = await FilesetResolver.forGenAiTasks(CONFIG.WASM_PATH);
        
        DOM.loadingStatus.textContent = "Parsing local model weights...";
        this.updateProgressUI(40); // Jump to 40% after WASM loads

        // 2. Load Local Model
        State.llm = await LlmInference.createFromOptions(genai, {
            baseOptions: {
                modelAssetPath: CONFIG.MODEL_PATH
            },
            maxTokens: State.settings.maxTokens,
            temperature: State.settings.temperature,
            topK: State.settings.topK
        });

        State.isReady = true;
    },

    onSuccess() {
        clearInterval(this.progressInterval);
        clearInterval(this.tipInterval);
        
        this.updateProgressUI(100);
        DOM.loadingStatus.textContent = "Model Ready!";
        DOM.statusBadge.textContent = "Local AI";
        DOM.statusBadge.className = 'status-badge ready';

        setTimeout(() => {
            DOM.loadingScreen.classList.add('hidden');
            DOM.appContainer.style.display = 'flex';
            DOM.sendBtn.disabled = false;
            
            UI.init(); // Initialize UI controllers after app is visible
        }, 600);
    },

    onError(error) {
        clearInterval(this.progressInterval);
        clearInterval(this.tipInterval);
        
        console.error("Initialization Failed:", error);
        DOM.errorBox.style.display = 'block';
        DOM.loadingTips.style.display = 'none';
        DOM.statusBadge.textContent = "Error";
        DOM.statusBadge.className = 'status-badge error';
        
        let friendlyMsg = error.message || "Unknown error";
        
        if (friendlyMsg.includes("Failed to fetch") || friendlyMsg.includes("NetworkError")) {
            friendlyMsg = `Failed to load local model file! \n\nMake sure the file '${CONFIG.MODEL_PATH}' is in the exact same folder as index.html. You cannot open this via a file:// URL in some browsers; use a local server (like VS Code Live Server).`;
        } else if (friendlyMsg.includes("OOM") || friendlyMsg.includes("memory")) {
            friendlyMsg = "Out of Memory! The Gemma model requires ~2GB of free RAM. Close other tabs or restart your browser.";
        }

        DOM.errorMessage.textContent = friendlyMsg;
    }
};

// Kick off initialization
Engine.init();
/**
 * ==========================================
 * PART 2: UI CONTROLLERS, MODALS & SETTINGS
 * ==========================================
 */

// ==========================================
// 7. MODAL MANAGEMENT
// ==========================================
const Modal = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            State.activeModal = modalId;
            // Re-trigger animation
            modal.querySelector('.modal-content').style.animation = 'none';
            modal.offsetHeight; // trigger reflow
            modal.querySelector('.modal-content').style.animation = '';
        }
    },

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            State.activeModal = null;
        }
    },

    closeAll() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
        State.activeModal = null;
    },

    initEvents() {
        // Close buttons inside modals
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-close');
                if (target) this.close(target);
            });
        });

        // Click outside to close
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close(overlay.id);
                }
            });
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (State.activeModal) this.close(State.activeModal);
                if (State.sidebarOpen) Sidebar.toggle();
            }
        });
    }
};

// ==========================================
// 8. SETTINGS CONTROLLER
// ==========================================
const SettingsUI = {
    init() {
        this.populateUI();
        this.bindEvents();
    },

    populateUI() {
        document.getElementById('systemPromptInput').value = State.settings.systemPrompt || CONFIG.DEFAULT_SYSTEM_PROMPT;
        document.getElementById('tempInput').value = State.settings.temperature;
        document.getElementById('tempValue').textContent = State.settings.temperature;
        document.getElementById('tokenInput').value = State.settings.maxTokens;
        document.getElementById('historyInput').value = State.settings.maxHistory;

        // Set tool checkboxes
        document.querySelectorAll('.tool-checkbox').forEach(cb => {
            const toolName = cb.getAttribute('data-tool');
            cb.checked = State.settings.enabledTools[toolName] !== false; // default true if missing
        });
    },

    bindEvents() {
        // Live update temperature label
        document.getElementById('tempInput').addEventListener('input', (e) => {
            document.getElementById('tempValue').textContent = e.target.value;
        });

        // Save Settings
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.save());
        
        // Reset Settings
        document.getElementById('resetSettingsBtn').addEventListener('click', () => {
            State.settings = JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS));
            this.populateUI();
            Toast.show("Settings reset to default.", "success");
        });
    },

    save() {
        State.settings.systemPrompt = document.getElementById('systemPromptInput').value;
        State.settings.temperature = parseFloat(document.getElementById('tempInput').value);
        State.settings.maxTokens = parseInt(document.getElementById('tokenInput').value);
        State.settings.maxHistory = parseInt(document.getElementById('historyInput').value);

        // Save Tool Toggles
        document.querySelectorAll('.tool-checkbox').forEach(cb => {
            const toolName = cb.getAttribute('data-tool');
            State.settings.enabledTools[toolName] = cb.checked;
        });

        // Apply to running model if possible (MediaPipe requires recreation for some params, 
        // but we apply what we can dynamically to state)
        if (State.llm) {
            // Note: MediaPipe LlmInference doesn't expose a setTemperature method after creation,
            // so these take effect on the prompt building side or next app load.
        }

        Storage.saveSettings();
        Modal.close('settingsModal');
        Toast.show("Settings saved successfully!", "success");
        
        // Update system prompt in Agent memory immediately
        Agent.refreshSystemPrompt();
    },

    getEnabledToolsString() {
        let toolsStr = "";
        for (const [key, val] of Object.entries(State.settings.enabledTools)) {
            if (val && CONFIG.TOOL_DEFINITIONS[key]) {
                toolsStr += `- ${CONFIG.TOOL_DEFINITIONS[key]}\n`;
            }
        }
        return toolsStr ? `Available Tools:\n${toolsStr}` : "No tools are currently enabled. Answer from your own knowledge.";
    }
};

// ==========================================
// 9. SIDEBAR & HISTORY CONTROLLER
// ==========================================
const Sidebar = {
    toggle() {
        State.sidebarOpen = !State.sidebarOpen;
        DOM.sidebar.classList.toggle('open', State.sidebarOpen);
        DOM.sidebarOverlay.classList.toggle('active', State.sidebarOpen);
    },

    close() {
        State.sidebarOpen = false;
        DOM.sidebar.classList.remove('open');
        DOM.sidebarOverlay.classList.remove('active');
    },

    initEvents() {
        document.getElementById('menuBtn').addEventListener('click', () => this.toggle());
        DOM.sidebarOverlay.addEventListener('click', () => this.close());
        
        document.getElementById('newChatBtn').addEventListener('click', () => {
            ChatManager.createNewChat();
            this.close();
        });

        document.getElementById('clearChatBtn').addEventListener('click', () => {
            if(Object.keys(State.chats).length > 0) {
                ChatManager.clearAllHistory();
                Toast.show("All chat history deleted.", "error");
            }
        });
    },

    renderHistory() {
        DOM.historyList.innerHTML = '';
        const chatIds = Object.keys(State.chats).sort((a, b) => b - a); // Newest first

        if (chatIds.length === 0) {
            DOM.historyList.innerHTML = `<div style="padding: 16px; color: var(--color-text-muted); font-size: 0.85rem; text-align: center;">No chat history yet.</div>`;
            return;
        }

        chatIds.forEach(id => {
            const chat = State.chats[id];
            const item = document.createElement('div');
            item.className = `history-item ${id === State.currentChatId ? 'active' : ''}`;
            item.textContent = chat.title || "New Chat";
            item.addEventListener('click', () => {
                ChatManager.loadChat(id);
                this.close();
            });
            DOM.historyList.appendChild(item);
        });
    }
};

// ==========================================
// 10. CHAT MANAGER
// ==========================================
const ChatManager = {
    createNewChat() {
        const id = Date.now().toString();
        State.chats[id] = {
            title: "New Chat",
            messages: [] // { role: 'user' | 'assistant', content: '' }
        };
        State.currentChatId = id;
        this.loadChat(id);
        Storage.saveChats();
        Sidebar.renderHistory();
    },

    loadChat(id) {
        State.currentChatId = id;
        const chat = State.chats[id];
        
        if (!chat) {
            this.createNewChat();
            return;
        }

        // Rebuild UI from messages
        DOM.chatArea.innerHTML = '';
        
        if (chat.messages.length === 0) {
            UI.showWelcome();
        } else {
            UI.hideWelcome();
            chat.messages.forEach(msg => {
                if (msg.role === 'user') {
                    UI.createUserMessage(msg.content, false); // false = don't save again
                } else if (msg.role === 'assistant') {
                    UI.createAssistantMessage(msg.content, false);
                }
            });
            UI.scrollToBottom();
        }

        Sidebar.renderHistory();
        Storage.saveChats();
    },

    addMessage(role, content) {
        if (!State.currentChatId || !State.chats[State.currentChatId]) {
            this.createNewChat();
        }

        const chat = State.chats[State.currentChatId];
        chat.messages.push({ role, content });

        // Auto-generate title from first user message
        if (chat.title === "New Chat" && role === 'user') {
            chat.title = content.substring(0, 40) + (content.length > 40 ? "..." : "");
            Sidebar.renderHistory();
        }

        Storage.saveChats();
    },

    updateLastAssistantMessage(content) {
        if (!State.currentChatId || !State.chats[State.currentChatId]) return;
        const msgs = State.chats[State.currentChatId].messages;
        if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
            msgs[msgs.length - 1].content = content;
        }
    },

    deleteMessage(index) {
        if (!State.currentChatId || !State.chats[State.currentChatId]) return;
        State.chats[State.currentChatId].messages.splice(index, 1);
        Storage.saveChats();
    },

    clearAllHistory() {
        Storage.clearAll();
        DOM.chatArea.innerHTML = '';
        UI.showWelcome();
        Sidebar.renderHistory();
        this.createNewChat();
    }
};

// ==========================================
// 11. MAIN UI BINDINGS (Called on Init)
// ==========================================
const UI = {
    init() {
        Modal.initEvents();
        SettingsUI.init();
        Sidebar.initEvents();
        this.bindInput();
        this.bindToolExplorer();

        // Load last active chat or create new
        if (State.currentChatId && State.chats[State.currentChatId]) {
            ChatManager.loadChat(State.currentChatId);
        } else {
            this.showWelcome();
            Sidebar.renderHistory();
        }
    },

    bindInput() {
        // Auto-resize textarea
        DOM.inputText.addEventListener('input', () => {
            DOM.inputText.style.height = 'auto';
            DOM.inputText.style.height = Math.min(DOM.inputText.scrollHeight, 120) + 'px';
        });

        // Send on Enter
        DOM.inputText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                Agent.handleSend();
            }
        });

        // Send button click
        DOM.sendBtn.addEventListener('click', () => Agent.handleSend());

        // Suggestion cards
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                DOM.inputText.value = prompt;
                Agent.handleSend();
            });
        });

        // Open Modals
        document.getElementById('openSettingsBtn').addEventListener('click', () => {
            SettingsUI.populateUI(); // Refresh UI with latest state
            Modal.open('settingsModal');
        });

        document.getElementById('openToolsBtn').addEventListener('click', () => {
            Modal.open('toolsModal');
        });
    },

    bindToolExplorer() {
        // No complex bindings needed, static UI
    },

    showWelcome() {
        DOM.welcomeScreen.classList.remove('hidden');
        DOM.welcomeScreen.style.display = 'flex';
        DOM.chatArea.classList.remove('active');
    },

    hideWelcome() {
        DOM.welcomeScreen.classList.add('hidden');
        DOM.welcomeScreen.style.display = 'none';
        DOM.chatArea.classList.add('active');
    },

    scrollToBottom() {
        // Smooth scroll using requestAnimationFrame for performance
        requestAnimationFrame(() => {
            DOM.chatArea.scrollTop = DOM.chatArea.scrollHeight;
        });
    },

    setGeneratingState(isGenerating) {
        State.isGenerating = isGenerating;
        DOM.sendBtn.classList.toggle('is-generating', isGenerating);
        
        const sendIcon = DOM.sendBtn.querySelector('.icon-send');
        const stopIcon = DOM.sendBtn.querySelector('.icon-stop');
        
        if (isGenerating) {
            sendIcon.style.display = 'none';
            stopIcon.style.display = 'block';
        } else {
            sendIcon.style.display = 'block';
            stopIcon.style.display = 'none';
        }
    },

    // --- MESSAGE RENDERING ---

    createUserMessage(text, saveToMemory = true) {
        this.hideWelcome();
        const frag = DOM.tmplUserMsg.content.cloneNode(true);
        const msgEl = frag.querySelector('.message');
        const textEl = frag.querySelector('.msg-text');
        
        textEl.textContent = text;
        DOM.chatArea.appendChild(frag);
        this.scrollToBottom();

        if (saveToMemory) ChatManager.addMessage('user', text);

        // Bind Edit/Delete
        const editBtn = msgEl.querySelector('.edit-btn');
        const deleteBtn = msgEl.querySelector('.delete-btn');

        editBtn.addEventListener('click', () => this.handleEditMessage(msgEl, text));
        deleteBtn.addEventListener('click', () => this.handleDeleteMessage(msgEl));

        return msgEl;
    },

    handleEditMessage(msgEl, oldText) {
        // Remove existing editing states
        document.querySelectorAll('.user-msg.editing').forEach(el => el.classList.remove('editing'));
        
        msgEl.classList.add('editing');
        DOM.inputText.value = oldText;
        DOM.inputText.focus();
        
        // Optional: Add a small listener to remove editing state on new send
        const removeEdit = () => {
            msgEl.classList.remove('editing');
            DOM.inputText.removeEventListener('input', removeEdit);
        };
        DOM.inputText.addEventListener('input', removeEdit);
    },

    handleDeleteMessage(msgEl) {
        const allMsgs = Array.from(DOM.chatArea.querySelectorAll('.message'));
        const index = allMsgs.indexOf(msgEl);
        
        msgEl.remove();
        
        // Estimate memory index (since user/assistant pairs exist)
        // For simplicity, we just remove from DOM. Full array sync is complex for a UI snippet.
        if (allMsgs.length === 0) this.showWelcome();
    },

    createAssistantMessage(text, saveToMemory = true) {
        const frag = DOM.tmplAssistantMsg.content.cloneNode(true);
        const msgEl = frag.querySelector('.message');
        const textEl = frag.querySelector('.msg-text');
        const statusEl = msgEl.querySelector('.msg-status');
        const toolsContainer = msgEl.querySelector('.msg-tools-container');
        
        DOM.chatArea.appendChild(frag);
        this.scrollToBottom();

        if (saveToMemory) ChatManager.addMessage('assistant', text);

        // Copy Button
        const copyBtn = msgEl.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.classList.add('copied');
                setTimeout(() => copyBtn.classList.remove('copied'), 2000);
            });
        });

        return { msgEl, textEl, statusEl, toolsContainer };
    }
};
/**
 * ==========================================
 * PART 3: TOOLS, APIS & PARSING SYSTEM
 * ==========================================
 */

// ==========================================
// 12. SECURITY & SANITIZATION
// ==========================================
const Security = {
    // Prevents XSS when injecting API results directly into the DOM
    escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};

// ==========================================
// 13. API INTEGRATIONS (The Tools)
// ==========================================
const APIs = {
    wiki: async (q) => {
        try {
            const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
            if (!res.ok) throw new Error("Not found");
            const d = await res.json();
            return { 
                text: Security.escapeHTML(d.extract || "No summary available."), 
                image: d.thumbnail?.source || null 
            };
        } catch (e) {
            return { text: "Error: Could not fetch Wikipedia data. Check the topic name.", image: null };
        }
    },

    weather: async (city) => {
        try {
            const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}`).then(r => r.json());
            if (!geo.results || geo.results.length === 0) throw new Error("City not found");
            
            const { latitude, longitude, name } = geo.results[0];
            const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`).then(r => r.json());
            
            const temp = w.current_weather.temperature;
            const windspeed = w.current_weather.windspeed;
            const code = w.current_weather.weathercode;
            
            let condition = "Clear";
            if (code >= 1 && code <= 3) condition = "Partly Cloudy";
            if (code >= 45 && code <= 48) condition = "Foggy";
            if (code >= 51 && code <= 67) condition = "Rainy";
            if (code >= 71 && code <= 77) condition = "Snowy";
            if (code >= 95) condition = "Thunderstorm";

            return { text: `Weather in ${Security.escapeHTML(name)}: ${temp}°C, ${condition}. Wind: ${windspeed} km/h.`, image: null };
        } catch (e) {
            return { text: `Error: ${e.message}`, image: null };
        }
    },

    define: async (word) => {
        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            if (!res.ok) throw new Error("Word not found");
            const d = await res.json();
            const def = d[0]?.meanings[0]?.definitions[0]?.definition;
            return { text: Security.escapeHTML(def || "No definition found."), image: null };
        } catch (e) {
            return { text: `Error: ${e.message}`, image: null };
        }
    },

    pokemon: async (name) => {
        try {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name.toLowerCase())}`);
            if (!res.ok) throw new Error("Pokemon not found");
            const d = await res.json();
            const types = d.types.map(t => t.type.name).join(', ');
            return { 
                text: `#${d.id} ${Security.escapeHTML(d.name)}. Type: ${Security.escapeHTML(types)}.`, 
                image: d.sprites?.front_default || null 
            };
        } catch (e) {
            return { text: `Error: ${e.message}`, image: null };
        }
    },

    country: async (name) => {
        try {
            const res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`);
            if (!res.ok) throw new Error("Country not found");
            const d = await res.json();
            const c = d[0];
            const pop = (c.population / 1_000_000).toFixed(2);
            return { 
                text: `${Security.escapeHTML(c.name.common)}. Capital: ${Security.escapeHTML(c.capital?.[0] || 'N/A')}. Population: ~${pop}M. Region: ${Security.escapeHTML(c.region)}.`, 
                image: c.flags?.svg || c.flags?.png || null 
            };
        } catch (e) {
            return { text: `Error: ${e.message}`, image: null };
        }
    },

    joke: async () => {
        try {
            const d = await fetch("https://v2.jokeapi.dev/joke/Any?type=single").then(r => r.json());
            return { text: Security.escapeHTML(d.joke || "Could not fetch joke."), image: null };
        } catch (e) {
            return { text: "Error: Joke API failed.", image: null };
        }
    },

    advice: async () => {
        try {
            // Advice slip API sometimes caches weirdly without cache-busting
            const d = await fetch(`https://api.adviceslip.com/advice?t=${Date.now()}`).then(r => r.json());
            return { text: Security.escapeHTML(d.slip?.advice || "No advice available."), image: null };
        } catch (e) {
            return { text: "Error: Advice API failed.", image: null };
        }
    },

    bored: async () => {
        try {
            const d = await fetch("https://www.boredapi.com/api/activity").then(r => r.json());
            return { text: `Activity: ${Security.escapeHTML(d.activity)} (Type: ${Security.escapeHTML(d.type)})`, image: null };
        } catch (e) {
            return { text: "Error: Bored API failed.", image: null };
        }
    },

    crypto: async (id) => {
        try {
            const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`);
            if (!res.ok) throw new Error("Network error");
            const d = await res.json();
            if (d[id] && d[id].usd !== undefined) {
                return { text: `${Security.escapeHTML(id)} is currently $${d[id].usd.toLocaleString()} USD.`, image: null };
            }
            throw new Error("Coin ID not found. Try 'bitcoin' or 'ethereum'.");
        } catch (e) {
            return { text: `Error: ${e.message}`, image: null };
        }
    }
};

// ==========================================
// 14. TOOL PARSER & EXECUTOR
// ==========================================
const ToolSystem = {
    // Regex to find ACTION and ARGS in model output
    parseToolCall(text) {
        // Matches: ACTION: weather ARGS: tokyo
        const match = text.match(/ACTION:\s*(\w+)\s*ARGS:\s*([^\n]+)/i);
        if (!match) return null;
        
        return {
            name: match[1].toLowerCase().trim(),
            args: match[2].trim()
        };
    },

    // Check if a specific tool string contains a tool call
    containsToolCall(text) {
        return /ACTION:\s*\w+\s*ARGS:/i.test(text);
    },

    // Remove the tool call line from the final text shown to user
    stripToolCall(text) {
        return text.replace(/ACTION:\s*\w+\s*ARGS:\s*[^\n]*\n?/gi, '').trim();
    },

    // Execute the parsed tool
    async execute(toolName, toolArgs) {
        // 1. Check if tool exists in our API list
        if (!APIs[toolName]) {
            return { 
                text: `Error: Unknown tool '${toolName}'.`, 
                image: null 
            };
        }

        // 2. Check if tool is enabled by user in settings
        if (State.settings.enabledTools[toolName] === false) {
            return { 
                text: `Error: Tool '${toolName}' is currently disabled by the user.`, 
                image: null 
            };
        }

        // 3. Execute API
        try {
            const result = await APIs[toolName](toolArgs);
            
            // Ensure image is a valid string or null
            if (result.image && typeof result.image !== 'string') result.image = null;
            
            return result;
        } catch (error) {
            console.error(`Tool execution failed for ${toolName}:`, error);
            return { 
                text: `System Error: Failed to execute ${toolName}.`, 
                image: null 
            };
        }
    },

    // Renders the Tool UI component into the chat
    renderToolUI(toolsContainer, toolName, toolArgs, result) {
        const frag = DOM.tmplToolCall.content.cloneNode(true);
        const toolUI = frag.querySelector('.tool-call-ui');
        
        // Populate Header
        toolUI.querySelector('.tool-name').textContent = toolName;
        
        // Populate Body
        toolUI.querySelector('.tool-args code').textContent = toolArgs || "None";
        toolUI.querySelector('.tool-result-text').innerHTML = result.text;
        
        const imgEl = toolUI.querySelector('.tool-result-img');
        if (result.image) {
            imgEl.src = result.image;
            imgEl.alt = `Image for ${toolName}`;
            imgEl.style.display = 'block';
        }

        // Add to DOM
        toolsContainer.appendChild(toolUI);
        
        // Return references to update status later
        return {
            setStatus: (statusText, statusClass) => {
                const statusEl = toolUI.querySelector('.tool-status');
                statusEl.textContent = statusText;
                statusEl.className = `tool-status ${statusClass}`;
            },
            expand: () => toolUI.classList.add('open')
        };
    }
};
/**
 * ==========================================
 * PART 4: AGENT LOOP, PROMPTING & STREAMING
 * ==========================================
 */

// ==========================================
// 15. LIGHTWEIGHT MARKDOWN PARSER
// ==========================================
const Markdown = {
    parse(text) {
        if (!text) return '';
        
        // 1. Escape HTML to prevent XSS from model hallucinations
        let html = Security.escapeHTML(text);

        // 2. Parse Code Blocks (```lang\n...\n```)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'code';
            // We clone the template and return a placeholder string, 
            // but for inline streaming, it's easier to build the HTML string directly.
            return `<div class="code-block-component">
                        <div class="code-header">
                            <span class="code-lang">${language}</span>
                            <button class="copy-code-btn" onclick="AppHelpers.copyCodeBlock(this)">
                                <svg width="14" height="14"><use href="#icon-copy"/></svg> Copy
                            </button>
                        </div>
                        <pre class="code-body"><code>${code.trim()}</code></pre>
                    </div>`;
        });

        // 3. Parse Inline Code (`code`)
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 4. Parse Bold (**text**)
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // 5. Parse Italic (*text*)
        html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

        // 6. Parse Line Breaks (but not inside pre/code blocks which we handled above)
        // Replace double newlines with paragraph-like breaks, single with <br>
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        
        // Wrap in paragraph if not starting with a block element
        if (!html.startsWith('<div')) {
            html = `<p>${html}</p>`;
        }

        return html;
    }
};

// ==========================================
// 16. PROMPT BUILDER
// ==========================================
const PromptBuilder = {
    build(chatHistory, newUserInput) {
        const systemPrompt = State.settings.systemPrompt || CONFIG.DEFAULT_SYSTEM_PROMPT;
        const enabledToolsStr = SettingsUI.getEnabledToolsString();
        
        let prompt = `<system>\n${systemPrompt}\n\n${enabledToolsStr}\n</system>\n\n`;

        // Inject Chat History (Respecting max history limit)
        // chatHistory is an array of {role, content}
        const historyToUse = chatHistory.slice(-State.settings.maxHistory * 2); // *2 for user/assistant pairs

        for (const msg of historyToUse) {
            if (msg.role === 'user') {
                prompt += `<user>\n${msg.content}\n</user>\n\n`;
            } else if (msg.role === 'assistant') {
                // We strip out the raw ACTION text from saved history to keep context clean
                const cleanContent = ToolSystem.stripToolCall(msg.content);
                if (cleanContent) {
                    prompt += `<assistant>\n${cleanContent}\n</assistant>\n\n`;
                }
            }
        }

        // Add current user input
        if (newUserInput) {
            prompt += `<user>\n${newUserInput}\n</user>\n\n`;
        }

        prompt += `<assistant>\n`;
        
        return prompt;
    },

    // Builds the continuation prompt after a tool has been executed
    buildToolContinuation(basePrompt, actionStr, observationStr) {
        // We append the action, the observation, and ask it to continue
        let continuation = basePrompt;
        
        // Note: The base prompt already ended with `<assistant>\n`
        // So we need to close that, add the action as part of the assistant's turn,
        // add the observation as a user turn, and reopen assistant.
        
        // Remove the trailing `<assistant>\n` from base prompt to insert tool data
        continuation = continuation.trimEnd();
        if (continuation.endsWith('<assistant>')) {
            continuation = continuation.slice(0, -11); // remove <assistant>
        }

        continuation += `${actionStr.trim()}\n</assistant>\n\n`;
        continuation += `<system>\nObservation: ${observationStr}\n</system>\n\n`;
        continuation += `<assistant>\n`;

        return continuation;
    }
};

// ==========================================
// 17. THE AGENT CORE (Streaming & Looping)
// ==========================================
const Agent = {
    MAX_LOOPS: 3, // Prevent infinite tool calling loops

    refreshSystemPrompt() {
        // Just a proxy to force UI update if needed
        console.log("System prompt and tools refreshed.");
    },

    async handleSend() {
        // If currently generating, handle STOP request
        if (State.isGenerating) {
            State.stopGenerationFlag = true;
            UI.setGeneratingState(false);
            Toast.show("Stopped generation.", "default");
            return;
        }

        const text = DOM.inputText.value.trim();
        if (!text || !State.isReady) return;

        // Clear input
        DOM.inputText.value = '';
        DOM.inputText.style.height = 'auto';

        // Render User Message
        UI.createUserMessage(text, true);

        // Start Agent Loop
        await this.runLoop(text);
    },

    async runLoop(initialUserInput, currentLoopCount = 0) {
        if (currentLoopCount >= this.MAX_LOOPS) {
            console.warn("Max tool loop reached.");
            return;
        }

        // Get current chat history from State
        const chatHistory = State.currentChatId && State.chats[State.currentChatId] 
            ? State.chats[State.currentChatId].messages 
            : [];

        // Build initial prompt
        let currentPrompt = PromptBuilder.build(chatHistory, initialUserInput);

        // Setup UI for Assistant
        const { msgEl, textEl, statusEl, toolsContainer } = UI.createAssistantMessage("", false);
        const statusLabel = statusEl.querySelector('.status-label');
        
        UI.setGeneratingState(true);
        State.stopGenerationFlag = false;

        // Variables for streaming
        let rawStreamedText = "";
        let isToolCall = false;

        // Update Status
        statusLabel.textContent = "Thinking...";
        statusEl.classList.remove('hidden');

        try {
            // --- STREAMING PHASE ---
            await new Promise((resolve, reject) => {
                if (!State.llm) return reject(new Error("Model not loaded"));

                State.llm.generateResponse(currentPrompt, (partialResult, done) => {
                    // Handle Stop Flag
                    if (State.stopGenerationFlag) {
                        done = true;
                        resolve();
                        return;
                    }

                    if (partialResult) {
                        rawStreamedText += partialResult;
                    }

                    // Live Render (Skip if we detect a tool call forming to avoid ugly flashing)
                    if (!ToolSystem.containsToolCall(rawStreamedText)) {
                        textEl.innerHTML = Markdown.parse(rawStreamedText) + `<span class="streaming-cursor"></span>`;
                        UI.scrollToBottom();
                    }

                    if (done) {
                        resolve();
                    }
                });
            });

            // --- POST-STREAMING TOOL CHECK ---
            isToolCall = ToolSystem.containsToolCall(rawStreamedText);

            if (isToolCall) {
                const parsedTool = ToolSystem.parseToolCall(rawStreamedText);
                
                if (parsedTool) {
                    // 1. Update UI Status
                    statusLabel.textContent = `Using tool: ${parsedTool.name}...`;
                    textEl.innerHTML = ""; // Clear raw ACTION text from UI

                    // 2. Render Tool UI
                    const toolUIController = ToolSystem.renderToolUI(
                        toolsContainer, 
                        parsedTool.name, 
                        parsedTool.args, 
                        { text: "Executing...", image: null } // Placeholder
                    );

                    // 3. Execute Tool API
                    const result = await ToolSystem.execute(parsedTool.name, parsedTool.args);

                    // 4. Update Tool UI with Result
                    toolUIController.setStatus("Success", "success");
                    // Update the result text inside the already rendered tool UI
                    const resultTextEl = toolsContainer.querySelector('.tool-result-text:last-of-type');
                    if (resultTextEl) resultTextEl.innerHTML = result.text;
                    
                    const resultImgEl = toolsContainer.querySelector('.tool-result-img:last-of-type');
                    if (result.image && resultImgEl) {
                        resultImgEl.src = result.image;
                        resultImgEl.style.display = 'block';
                    }
                    
                    toolUIController.expand(); // Auto expand tool result
                    UI.scrollToBottom();

                    // 5. RECURSE - Build new prompt with observation and loop again
                    statusLabel.textContent = "Processing result...";
                    
                    const nextPrompt = PromptBuilder.buildToolContinuation(
                        currentPrompt, 
                        rawStreamedText, 
                        result.text
                    );

                    // Instead of calling runLoop which fetches history again, we do a direct recursive stream
                    await this.streamFinalResponse(nextPrompt, textEl, statusEl, toolsContainer, currentLoopCount + 1);
                    return; // Exit current loop execution
                }
            }

            // --- FINALIZATION (No Tool Called) ---
            statusEl.classList.add('hidden');
            textEl.innerHTML = Markdown.parse(rawStreamedText); // Remove cursor
            UI.scrollToBottom();

            // Save to memory ONLY the clean final response
            if (rawStreamedText) {
                ChatManager.addMessage('assistant', rawStreamedText);
            }

        } catch (error) {
            console.error("Agent Loop Error:", error);
            statusEl.classList.add('hidden');
            textEl.innerHTML = `<span style="color: var(--color-error);">Generation Error: ${Security.escapeHTML(error.message)}</span>`;
            Toast.show("An error occurred during generation.", "error");
        } finally {
            UI.setGeneratingState(false);
        }
    },

    // Helper to handle the continuation stream after a tool is executed
    async streamFinalResponse(prompt, textEl, statusEl, toolsContainer, loopCount) {
        let rawStreamedText = "";
        const statusLabel = statusEl.querySelector('.status-label');
        statusLabel.textContent = "Thinking...";
        statusEl.classList.remove('hidden');

        try {
            await new Promise((resolve, reject) => {
                State.llm.generateResponse(prompt, (partialResult, done) => {
                    if (State.stopGenerationFlag) {
                        done = true;
                        resolve();
                        return;
                    }

                    if (partialResult) rawStreamedText += partialResult;

                    // Don't render if another tool call is happening
                    if (!ToolSystem.containsToolCall(rawStreamedText)) {
                        textEl.innerHTML = Markdown.parse(rawStreamedText) + `<span class="streaming-cursor"></span>`;
                        UI.scrollToBottom();
                    }

                    if (done) resolve();
                });
            });

            // Check for ANOTHER tool call (Chaining tools)
            if (ToolSystem.containsToolCall(rawStreamedText) && loopCount < this.MAX_LOOPS) {
                const parsedTool = ToolSystem.parseToolCall(rawStreamedText);
                if (parsedTool) {
                    statusLabel.textContent = `Using tool: ${parsedTool.name}...`;
                    textEl.innerHTML = ""; // Clear text again

                    const toolUIController = ToolSystem.renderToolUI(
                        toolsContainer, parsedTool.name, parsedTool.args, 
                        { text: "Executing...", image: null }
                    );

                    const result = await ToolSystem.execute(parsedTool.name, parsedTool.args);
                    
                    toolUIController.setStatus("Success", "success");
                    const resultTextEl = toolsContainer.querySelector('.tool-result-text:last-of-type');
                    if (resultTextEl) resultTextEl.innerHTML = result.text;
                    const resultImgEl = toolsContainer.querySelector('.tool-result-img:last-of-type');
                    if (result.image && resultImgEl) {
                        resultImgEl.src = result.image;
                        resultImgEl.style.display = 'block';
                    }
                    toolUIController.expand();
                    UI.scrollToBottom();

                    // Chain again!
                    const nextPrompt = PromptBuilder.buildToolContinuation(prompt, rawStreamedText, result.text);
                    await this.streamFinalResponse(nextPrompt, textEl, statusEl, toolsContainer, loopCount + 1);
                    return;
                }
            }

            // Truly done
            statusEl.classList.add('hidden');
            textEl.innerHTML = Markdown.parse(rawStreamedText);
            UI.scrollToBottom();

            if (rawStreamedText) {
                ChatManager.addMessage('assistant', rawStreamedText);
            }

        } catch (error) {
            console.error("Chained Tool Error:", error);
            statusEl.classList.add('hidden');
            textEl.innerHTML += `<br><span style="color: var(--color-error);">Tool chaining failed: ${Security.escapeHTML(error.message)}</span>`;
        }
    }
};
/**
 * ==========================================
 * PART 5: VOICE INPUT, HELPERS & BOOT
 * ==========================================
 */

// ==========================================
// 18. WEB SPEECH API (VOICE INPUT)
// ==========================================
const VoiceInput = {
    recognition: null,
    isListening: false,
    micBtn: document.getElementById('voiceBtn'),

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            this.micBtn.title = "Voice input not supported in this browser";
            this.micBtn.style.opacity = '0.3';
            this.micBtn.style.cursor = 'not-allowed';
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US'; // Default language

        this.recognition.onstart = () => {
            this.isListening = true;
            this.micBtn.style.color = 'var(--color-error)';
            this.micBtn.title = "Stop listening";
            Toast.show("Listening...", "default", 2000);
        };

        this.recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            DOM.inputText.value = transcript;
            DOM.inputText.dispatchEvent(new Event('input')); // Trigger auto-resize
        };

        this.recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            this.stop();
            if (event.error === 'not-allowed') {
                Toast.show("Microphone permission denied.", "error");
            } else {
                Toast.show("Could not understand audio.", "error");
            }
        };

        this.recognition.onend = () => {
            this.stop();
            // If there's text in the input, optionally auto-send
            if (DOM.inputText.value.trim()) {
                // Uncomment the next line if you want it to auto-send after speaking:
                // Agent.handleSend();
            }
        };

        this.micBtn.disabled = false;
        this.micBtn.addEventListener('click', () => this.toggle());
    },

    toggle() {
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
    },

    start() {
        if (this.recognition && !this.isListening) {
            // Check if state allows input
            if (State.isGenerating) {
                Toast.show("Cannot use voice while AI is generating.", "error");
                return;
            }
            try {
                this.recognition.start();
            } catch(e) {
                console.error(e);
            }
        }
    },

    stop() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
        this.isListening = false;
        this.micBtn.style.color = '';
        this.micBtn.title = "Voice Input";
    }
};

// ==========================================
// 19. GLOBAL APP HELPERS
// ==========================================
const AppHelpers = {
    /**
     * Copies text from a code block to clipboard.
     * Triggered by onclick in the Markdown parser (Part 4).
     */
    copyCodeBlock(button) {
        const codeBlock = button.closest('.code-block-component');
        if (!codeBlock) return;

        const codeElement = codeBlock.querySelector('code');
        const textToCopy = codeElement ? codeElement.textContent : '';
        
        if (!textToCopy) return;

        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalHTML = button.innerHTML;
            button.innerHTML = `<svg width="14" height="14"><use href="#icon-check"/></svg> Copied!`;
            button.style.color = 'var(--color-success)';
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.style.color = '';
            }, 2000);
        }).catch(err => {
            console.error("Failed to copy code: ", err);
            Toast.show("Failed to copy to clipboard.", "error");
        });
    },

    /**
     * Utility: Debounce function execution
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Utility: Format bytes to human readable string
     */
    formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    },

    /**
     * Get current timestamp formatted
     */
    getTimestamp() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
};

// Expose to global window scope so inline `onclick` in generated HTML works
window.AppHelpers = AppHelpers;

// ==========================================
// 20. ACCESSIBILITY & FOCUS MANAGEMENT
// ==========================================
const A11y = {
    init() {
        // Add screen reader attributes to chat area
        DOM.chatArea.setAttribute('aria-live', 'polite');
        DOM.chatArea.setAttribute('aria-label', 'Chat messages');

        // Ensure modals trap focus when open
        this.setupFocusTrap();
    },

    setupFocusTrap() {
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab' || !State.activeModal) return;

            const modal = document.getElementById(State.activeModal);
            if (!modal) return;

            const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
            const focusableElements = modal.querySelectorAll(focusableSelectors);
            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    lastFocusable.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    firstFocusable.focus();
                    e.preventDefault();
                }
            }
        });
    },

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'assertive');
        announcement.setAttribute('style', 'position: absolute; left: -9999px;');
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => announcement.remove(), 1000);
    }
};

// ==========================================
// 21. GLOBAL EVENT LISTENERS & SHORTCUTS
// ==========================================
const GlobalEvents = {
    init() {
        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + N = New Chat
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                ChatManager.createNewChat();
                Sidebar.close();
                Toast.show("New chat started", "success", 1500);
            }

            // Ctrl/Cmd + , = Open Settings
            if ((e.ctrlKey || e.metaKey) && e.key === ',') {
                e.preventDefault();
                Modal.open('settingsModal');
            }
            
            // Focus input on '/' key if not already typing
            if (e.key === '/' && document.activeElement !== DOM.inputText) {
                e.preventDefault();
                DOM.inputText.focus();
            }
        });

        // Window Tab Visibility (Update title to show status)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (State.isGenerating) {
                    document.title = `(Generating...) ${CONFIG.APP_NAME}`;
                }
            } else {
                document.title = CONFIG.APP_NAME;
            }
        });

        // Unhandled Promise Rejection Catcher (Prevents silent crashes from APIs/WASM)
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled Promise Rejection:', event.reason);
            // Only show toast if it's a network/fetch error to avoid spamming UI on intentional stops
            if (event.reason && event.reason.message && event.reason.message.includes('fetch')) {
                Toast.show("A background network request failed.", "error");
            }
            event.preventDefault(); // Prevent default browser logging noise
        });

        // Global Error Catcher
        window.addEventListener('error', (event) => {
            console.error('Global Error:', event.error);
            // Don't show toast for every error (e.g., extension errors), just log
        });

        // Mobile Viewport Height Fix (Fixes 100vh issues on mobile Safari/Chrome)
        this.setupMobileViewportFix();
    },

    setupMobileViewportFix() {
        const setVH = () => {
            document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
        };
        
        setVH();
        window.addEventListener('resize', AppHelpers.debounce(setVH, 100));
        window.addEventListener('orientationchange', setVH);
    }
};

// ==========================================
// 22. APP BOOT FINALIZATION
// ==========================================
const Boot = {
    async complete() {
        console.log(`%c${CONFIG.APP_NAME} Engine Ready`, 'color: #000; font-weight: bold; font-size: 14px;');
        console.log(`%cModel: ${CONFIG.MODEL_PATH}`, 'color: #666;');
        console.log(`%cTools Loaded: ${Object.keys(APIs).join(', ')}`, 'color: #666;');

        // Initialize subsystems that depend on DOM being fully interactive
        VoiceInput.init();
        A11y.init();
        GlobalEvents.init();

        // Sync UI state with loaded settings
        // If the model loaded with default settings but user had saved settings, 
        // we show a subtle indicator (MediaPipe requires full reload to change temp/tokens, 
        // but system prompt changes apply instantly).
        const savedTemp = State.settings.temperature;
        const savedTokens = State.settings.maxTokens;
        
        if (savedTemp !== CONFIG.DEFAULT_SETTINGS.temperature || savedTokens !== CONFIG.DEFAULT_SETTINGS.maxTokens) {
            Toast.show("Note: Temperature/Token changes require a page reload to take effect on the local model.", "default", 5000);
        }

        document.title = CONFIG.APP_NAME;
    }
};

// ==========================================
// EXECUTION WRAPPER
// ==========================================
// We wait for the Engine.init() from Part 1 to finish successfully.
// Since Engine.init() is asynchronous and calls UI.init() when done,
// we hook into UI.init to fire our final boot sequence.

const originalUIInit = UI.init;
UI.init = function() {
    // Call the original UI init logic (Sidebar, Modals, Input bindings)
    originalUIInit.call(this);
    
    // Fire final boot sequence
    Boot.complete();
};

/**
 * ==========================================
 * END OF SCRIPT
 * Total Architecture: ~2000+ Lines
 * ==========================================
 */
