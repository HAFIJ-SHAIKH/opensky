/**
 * ==========================================
 * OPENSKY — FULL ARCHITECTURE
 * ==========================================
 * PART 1: Core Engine, Configuration, State & Storage
 * Model: hafijshaikh/gemma-4-E2B-it-q4f16_1-MLC
 * Runtime: WebLLM (auto-downloads from HuggingFace)
 * ==========================================
 */

import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
    APP_NAME: "Opensky",
    CREATOR: "Hafij Shaikh",
    MODEL_ID: "hafijshaikh/gemma-4-E2B-it-q4f16_1-MLC",

    DEFAULT_SYSTEM_PROMPT: `You are Opensky, a highly intelligent and helpful AI assistant created by Hafij Shaikh. You run entirely locally in the user's browser using WebLLM.
Rules:
1. Be concise, accurate, and conversational.
2. Format responses with clear paragraphs or lists when appropriate.
3. Use Markdown for formatting: **bold**, *italic*, \`inline code\`, and code blocks with language tags.
4. For mathematical expressions, use LaTeX notation between $...$ for inline math or $$...$$ for display math. For example: $E=mc^2$ or $$\\int_0^\\infty e^{-x}dx = 1$$ 5. If you need real-time data or external knowledge, you MUST use a tool.
6. To use a tool, output EXACTLY in this format: ACTION: tool_name ARGS: argument
7. Do not output anything else on the line where you call the tool.
8. After receiving an "Observation:", process the data and answer the user naturally.
9. Never claim to be anything other than Opensky.`,

    DEFAULT_SETTINGS: {
        systemPrompt: "",
        temperature: 0.7,
        maxTokens: 1024,
        topK: 40,
        topP: 0.95,
        maxHistory: 10,
        enabledTools: {
            wiki: true,
            weather: true,
            crypto: true,
            pokemon: true,
            country: true,
            define: true,
            joke: true,
            advice: true,
            bored: true
        }
    },

    TOOL_DEFINITIONS: {
        wiki: "Search Wikipedia for a topic. Usage: ACTION: wiki ARGS: topic",
        weather: "Get current weather for a city. Usage: ACTION: weather ARGS: city name",
        crypto: "Get crypto price in USD. Usage: ACTION: crypto ARGS: bitcoin or ethereum",
        pokemon: "Get Pokemon data and sprite. Usage: ACTION: pokemon ARGS: pikachu",
        country: "Get country info and flag. Usage: ACTION: country ARGS: japan",
        define: "Get dictionary definition. Usage: ACTION: define ARGS: word",
        joke: "Get a random joke. Usage: ACTION: joke ARGS: none",
        advice: "Get random life advice. Usage: ACTION: advice ARGS: none",
        bored: "Get activity suggestion when bored. Usage: ACTION: bored ARGS: none"
    },

    LOADING_TIPS: [
        "Tip: All processing happens locally. No data leaves your device.",
        "Tip: You can edit your messages to steer the conversation.",
        "Tip: Toggle tools on/off in Settings if the AI acts weird.",
        "Tip: Use $...$ for inline math and $$...$$ for display math.",
        "Tip: Click the copy button on any response to copy it.",
        "Tip: Delete individual chats from the sidebar history.",
        "Tip: Export your chats as Markdown files from the sidebar.",
        "Tip: Use Ctrl+Shift+N to start a new chat quickly.",
        "Downloading model weights from HuggingFace...",
        "Optimizing neural network graphs for your device...",
        "First load may take a few minutes. Subsequent loads use cache.",
        "WebLLM compiles the model using WebGPU for fast inference."
    ],

    KEYBOARD_SHORTCUTS: {
        SEND: "Enter",
        NEW_LINE: "Shift+Enter",
        NEW_CHAT: "Ctrl+Shift+N",
        SETTINGS: "Ctrl+Shift+,",
        STOP: "Escape"
    },

    MAX_TOOL_LOOPS: 3,
    TOAST_DURATION: 3000,
    MAX_STORAGE_MB: 4,
    MAX_CHAT_TITLES_SHOWN: 50
};

// ==========================================
// 2. APPLICATION STATE
// ==========================================
const State = {
    // WebLLM Engine
    engine: null,
    isReady: false,
    isGenerating: false,
    stopGenerationFlag: false,
    modelLoaded: false,

    // Chat Management
    currentChatId: null,
    chats: {},

    // Settings (deep cloned from defaults)
    settings: JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS)),

    // UI State
    sidebarOpen: false,
    activeModal: null,

    // Generation tracking
    currentStreamAbort: null,
    lastRawResponse: "",
    lastPromptUsed: "",

    // Performance metrics
    generationStartTime: 0,
    tokensGenerated: 0,

    // Math rendering queue
    mathRenderQueue: [],
    mathRenderTimeout: null
};

// ==========================================
// 3. LOCAL STORAGE MANAGER
// ==========================================
const Storage = {
    KEYS: {
        SETTINGS: "opensky_settings",
        CHATS: "opensky_chats",
        ACTIVE_CHAT: "opensky_active_chat"
    },

    _getUsedSize() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length * 2; // UTF-16 chars
            }
        }
        return total;
    },

    _getUsedMB() {
        return this._getUsedSize() / (1024 * 1024);
    },

    saveSettings() {
        try {
            localStorage.setItem(
                this.KEYS.SETTINGS,
                JSON.stringify(State.settings)
            );
        } catch (e) {
            console.error("Failed to save settings:", e);
            Toast.show("Could not save settings — storage may be full.", "error");
        }
    },

    loadSettings() {
        try {
            const saved = localStorage.getItem(this.KEYS.SETTINGS);
            if (saved) {
                const parsed = JSON.parse(saved);
                State.settings = {
                    ...JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS)),
                    ...parsed,
                    enabledTools: {
                        ...JSON.parse(JSON.stringify(CONFIG.DEFAULT_SETTINGS.enabledTools)),
                        ...(parsed.enabledTools || {})
                    }
                };
            } else {
                State.settings = JSON.parse(
                    JSON.stringify(CONFIG.DEFAULT_SETTINGS)
                );
            }
        } catch (e) {
            console.error("Failed to load settings:", e);
            State.settings = JSON.parse(
                JSON.stringify(CONFIG.DEFAULT_SETTINGS)
            );
        }
    },

    saveChats() {
        try {
            const dataStr = JSON.stringify(State.chats);
            const dataMB = dataStr.length / (1024 * 1024);

            if (dataMB > CONFIG.MAX_STORAGE_MB) {
                console.warn(
                    `Chat data is ${dataMB.toFixed(2)}MB, trimming old chats.`
                );
                this._trimOldChats();
            }

            localStorage.setItem(this.KEYS.CHATS, JSON.stringify(State.chats));
            localStorage.setItem(this.KEYS.ACTIVE_CHAT, State.currentChatId);
        } catch (e) {
            console.error("Failed to save chats:", e);
            if (e.name === "QuotaExceededError") {
                this._trimOldChats();
                try {
                    localStorage.setItem(
                        this.KEYS.CHATS,
                        JSON.stringify(State.chats)
                    );
                    localStorage.setItem(
                        this.KEYS.ACTIVE_CHAT,
                        State.currentChatId
                    );
                    Toast.show(
                        "Storage was full — old chats were trimmed.",
                        "error"
                    );
                } catch (e2) {
                    Toast.show(
                        "Storage critically full. Please delete chats manually.",
                        "error"
                    );
                }
            }
        }
    },

    _trimOldChats() {
        const keys = Object.keys(State.chats).sort((a, b) => b - a);
        // Keep only the 15 most recent chats
        if (keys.length > 15) {
            const toRemove = keys.slice(15);
            toRemove.forEach((k) => delete State.chats[k]);
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
            State.currentChatId = null;
        }
    },

    deleteChat(chatId) {
        if (State.chats[chatId]) {
            delete State.chats[chatId];
            if (State.currentChatId === chatId) {
                State.currentChatId = null;
            }
            this.saveChats();
        }
    },

    clearAll() {
        localStorage.removeItem(this.KEYS.CHATS);
        localStorage.removeItem(this.KEYS.ACTIVE_CHAT);
        State.chats = {};
        State.currentChatId = null;
    },

    getStorageInfo() {
        const usedMB = this._getUsedMB();
        return {
            usedMB: usedMB.toFixed(2),
            chatCount: Object.keys(State.chats).length,
            totalMessages: Object.values(State.chats).reduce(
                (sum, c) => sum + (c.messages ? c.messages.length : 0),
                0
            )
        };
    }
};

// ==========================================
// 4. DOM REFERENCES CACHE
// ==========================================
const DOM = {
    // Loading Screen
    loadingScreen: document.getElementById("loadingScreen"),
    progressBar: document.getElementById("progressBar"),
    loadingPercent: document.getElementById("loadingPercent"),
    loadingStatus: document.getElementById("loadingStatus"),
    loadingTips: document.getElementById("loadingTips"),
    errorBox: document.getElementById("errorBox"),
    errorMessage: document.getElementById("errorMessage"),

    // App Container
    appContainer: document.getElementById("appContainer"),

    // Sidebar
    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebarOverlay"),
    historyList: document.getElementById("historyList"),

    // Top Bar
    statusBadge: document.getElementById("statusBadge"),

    // Chat Area
    welcomeScreen: document.getElementById("welcomeScreen"),
    chatArea: document.getElementById("chatArea"),
    inputText: document.getElementById("inputText"),
    sendBtn: document.getElementById("sendBtn"),

    // Templates
    tmplUserMsg: document.getElementById("tmplUserMsg"),
    tmplAssistantMsg: document.getElementById("tmplAssistantMsg"),
    tmplToolCall: document.getElementById("tmplToolCall"),
    tmplCodeBlock: document.getElementById("tmplCodeBlock"),
    tmplToast: document.getElementById("tmplToast"),

    // Modals
    settingsModal: document.getElementById("settingsModal"),
    toolsModal: document.getElementById("toolsModal"),

    // Toast Container
    toastContainer: document.getElementById("toastContainer")
};

// Validate all critical DOM elements exist
function validateDOMRefs() {
    const critical = [
        "loadingScreen",
        "progressBar",
        "loadingPercent",
        "loadingStatus",
        "appContainer",
        "chatArea",
        "inputText",
        "sendBtn",
        "tmplUserMsg",
        "tmplAssistantMsg",
        "tmplToast"
    ];
    const missing = critical.filter((key) => !DOM[key]);
    if (missing.length > 0) {
        console.error("Missing DOM elements:", missing);
        return false;
    }
    return true;
}

// ==========================================
// 5. TOAST NOTIFICATION SYSTEM
// ==========================================
const Toast = {
    _queue: [],
    _maxVisible: 3,

    show(message, type = "default", duration = CONFIG.TOAST_DURATION) {
        // Limit concurrent toasts
        const visible = DOM.toastContainer.querySelectorAll(
            ".toast-notification:not(.removing)"
        );
        if (visible.length >= this._maxVisible) {
            const oldest = visible[0];
            oldest.classList.add("removing");
            setTimeout(() => oldest.remove(), 300);
        }

        const template = DOM.tmplToast;
        if (!template) {
            console.warn("Toast template not found");
            return;
        }

        const toast = template.content
            .cloneNode(true)
            .querySelector(".toast-notification");
        const msgEl = toast.querySelector(".toast-message");
        if (msgEl) msgEl.textContent = message;

        if (type === "error") toast.classList.add("error");
        else if (type === "success") toast.classList.add("success");

        DOM.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("removing");
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, duration);
    },

    success(message, duration) {
        this.show(message, "success", duration);
    },

    error(message, duration) {
        this.show(message, "error", duration);
    }
};

// ==========================================
// 6. WEBGPU DETECTION
// ==========================================
const GPU = {
    async isSupported() {
        if (!navigator.gpu) return false;
        try {
            const adapter = await navigator.gpu.requestAdapter();
            return adapter !== null;
        } catch (e) {
            return false;
        }
    },

    async getAdapterInfo() {
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) return "No GPU adapter found";
            const info = await adapter.requestAdapterInfo();
            return `${info.vendor || "Unknown"} — ${info.architecture || "Unknown GPU"}`;
        } catch (e) {
            return "GPU info unavailable";
        }
    }
};

// ==========================================
// 7. INITIALIZATION ENGINE
// ==========================================
const Engine = {
    tipInterval: null,

    async init() {
        // Validate DOM first
        if (!validateDOMRefs()) {
            this.showFatalError(
                "Critical UI elements are missing. The HTML template may be corrupted."
            );
            return;
        }

        // Load persisted data
        Storage.loadSettings();
        Storage.loadChats();

        // Check WebGPU support
        const gpuOk = await GPU.isSupported();
        if (!gpuOk) {
            this.showFatalError(
                "WebGPU is not supported in your browser. Please use Chrome 113+ or Edge 113+ with WebGPU enabled. On Chrome, go to chrome://flags and enable #enable-unsafe-webgpu."
            );
            return;
        }

        // Setup loading UI
        this.setupLoadingUI();

        // Start model loading
        try {
            await this.loadModel();
            this.onSuccess();
        } catch (error) {
            this.onError(error);
        }
    },

    setupLoadingUI() {
        let tipIndex = 0;
        if (DOM.loadingTips) {
            DOM.loadingTips.innerHTML = `<p>${CONFIG.LOADING_TIPS[0]}</p>`;
        }

        this.tipInterval = setInterval(() => {
            tipIndex = (tipIndex + 1) % CONFIG.LOADING_TIPS.length;
            if (DOM.loadingTips) {
                DOM.loadingTips.innerHTML = `<p>${CONFIG.LOADING_TIPS[tipIndex]}</p>`;
            }
        }, 3500);
    },

    updateProgress(percent, statusText) {
        const clamped = Math.min(100, Math.max(0, percent));
        if (DOM.progressBar) {
            DOM.progressBar.style.width = `${clamped}%`;
        }
        if (DOM.loadingPercent) {
            DOM.loadingPercent.textContent = `${clamped.toFixed(1)}%`;
        }
        if (DOM.loadingStatus && statusText) {
            DOM.loadingStatus.textContent = statusText;
        }
    },

    async loadModel() {
        this.updateProgress(0, "Initializing WebLLM engine...");

        // Create the WebLLM engine with progress callback
        State.engine = new webllm.MLCEngine({
            initProgressCallback: (report) => {
                const progress = report.progress || 0;
                const text = report.text || "Loading...";
                this.updateProgress(progress, text);
            }
        });

        this.updateProgress(2, "Loading model from HuggingFace...");
        if (DOM.loadingStatus) {
            DOM.loadingStatus.textContent = `Loading ${CONFIG.MODEL_ID}...`;
        }

        // Reload the model — this triggers download + compilation
        await State.engine.reload(CONFIG.MODEL_ID, {
            temperature: State.settings.temperature,
            top_k: State.settings.topK
        });

        State.isReady = true;
        State.modelLoaded = true;
    },

    onSuccess() {
        clearInterval(this.tipInterval);

        this.updateProgress(100, "Model ready!");
        if (DOM.statusBadge) {
            DOM.statusBadge.textContent = "Local AI";
            DOM.statusBadge.className = "status-badge ready";
        }

        // Small delay for the 100% to visually register
        setTimeout(() => {
            if (DOM.loadingScreen) {
                DOM.loadingScreen.classList.add("hidden");
            }
            if (DOM.appContainer) {
                DOM.appContainer.style.display = "flex";
            }
            if (DOM.sendBtn) {
                DOM.sendBtn.disabled = false;
            }

            // Initialize all UI systems
            UIController.init();
        }, 700);
    },

    onError(error) {
        clearInterval(this.tipInterval);

        console.error("Model loading failed:", error);

        if (DOM.errorBox) {
            DOM.errorBox.style.display = "block";
        }
        if (DOM.loadingTips) {
            DOM.loadingTips.style.display = "none";
        }
        if (DOM.statusBadge) {
            DOM.statusBadge.textContent = "Error";
            DOM.statusBadge.className = "status-badge error";
        }

        let friendlyMsg = error.message || "Unknown error occurred.";

        if (
            friendlyMsg.includes("Failed to fetch") ||
            friendlyMsg.includes("NetworkError") ||
            friendlyMsg.includes("net::")
        ) {
            friendlyMsg =
                "Network error while downloading the model. Check your internet connection and try again. If the model was removed from HuggingFace, the download will fail.";
        } else if (
            friendlyMsg.includes("OOM") ||
            friendlyMsg.toLowerCase().includes("memory") ||
            friendlyMsg.toLowerCase().includes("out of memory")
        ) {
            friendlyMsg =
                "Out of GPU memory! This model needs significant VRAM. Close other GPU-intensive tabs, or try a smaller model.";
        } else if (
            friendlyMsg.toLowerCase().includes("webgpu") ||
            friendlyMsg.toLowerCase().includes("gpu")
        ) {
            friendlyMsg =
                "WebGPU error: " +
                friendlyMsg +
                " Make sure your browser supports WebGPU (Chrome 113+, Edge 113+).";
        }

        if (DOM.errorMessage) {
            DOM.errorMessage.textContent = friendlyMsg;
        }

        // Add retry button
        if (DOM.errorBox) {
            const retryBtn = document.createElement("button");
            retryBtn.className = "retry-btn";
            retryBtn.textContent = "Retry Loading";
            retryBtn.addEventListener("click", () => location.reload());
            DOM.errorBox.appendChild(retryBtn);
        }
    },

    showFatalError(message) {
        if (DOM.errorBox) {
            DOM.errorBox.style.display = "block";
        }
        if (DOM.loadingTips) {
            DOM.loadingTips.style.display = "none";
        }
        if (DOM.progressBar) {
            DOM.progressBar.style.width = "0%";
        }
        if (DOM.errorMessage) {
            DOM.errorMessage.textContent = message;
        }
        if (DOM.statusBadge) {
            DOM.statusBadge.textContent = "Error";
            DOM.statusBadge.className = "status-badge error";
        }
    }
};

// ==========================================
// 8. KICK OFF
// ==========================================
Engine.init();
/**
 * ==========================================
 * PART 2: UI Controllers, Modals & Settings
 * ==========================================
 */

// ==========================================
// 9. MODAL MANAGEMENT
// ==========================================
const Modal = {
    _history: [],

    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        // Close any currently open modal first
        if (State.activeModal && State.activeModal !== modalId) {
            this.close(State.activeModal);
        }

        modal.style.display = "flex";
        State.activeModal = modalId;
        this._history.push(modalId);

        // Re-trigger entrance animation
        const content = modal.querySelector(".modal-content");
        if (content) {
            content.style.animation = "none";
            void modal.offsetHeight; // force reflow
            content.style.animation = "";
        }

        // Prevent body scroll when modal is open
        document.body.style.overflow = "hidden";
    },

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.style.display = "none";
        State.activeModal = null;
        this._history = this._history.filter((id) => id !== modalId);

        // Restore body scroll if no modals open
        if (this._history.length === 0) {
            document.body.style.overflow = "";
        }
    },

    closeAll() {
        document.querySelectorAll(".modal-overlay").forEach((m) => {
            m.style.display = "none";
        });
        State.activeModal = null;
        this._history = [];
        document.body.style.overflow = "";
    },

    goBack() {
        if (this._history.length > 1) {
            const current = this._history.pop();
            this.close(current);
            const prev = this._history[this._history.length - 1];
            if (prev) {
                const modal = document.getElementById(prev);
                if (modal) modal.style.display = "flex";
                State.activeModal = prev;
            }
        } else {
            this.closeAll();
        }
    },

    initEvents() {
        // Close buttons
        document.querySelectorAll(".close-modal-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget.getAttribute("data-close");
                if (target) this.close(target);
            });
        });

        // Click outside to close
        document.querySelectorAll(".modal-overlay").forEach((overlay) => {
            overlay.addEventListener("mousedown", (e) => {
                if (e.target === overlay) {
                    this.close(overlay.id);
                }
            });
        });

        // Escape key
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                if (State.activeModal) {
                    this.close(State.activeModal);
                    e.stopPropagation();
                    return;
                }
                if (State.sidebarOpen) {
                    Sidebar.close();
                    e.stopPropagation();
                    return;
                }
                // Stop generation as last resort
                if (State.isGenerating) {
                    State.stopGenerationFlag = true;
                    UIController.setGeneratingState(false);
                    Toast.show("Stopped generation.");
                }
            }
        });
    }
};

// ==========================================
// 10. SETTINGS CONTROLLER
// ==========================================
const SettingsUI = {
    _initialized: false,

    init() {
        this.populateUI();
        this.bindEvents();
        this._initialized = true;
    },

    populateUI() {
        const sysInput = document.getElementById("systemPromptInput");
        if (sysInput) {
            sysInput.value =
                State.settings.systemPrompt || CONFIG.DEFAULT_SYSTEM_PROMPT;
        }

        const tempInput = document.getElementById("tempInput");
        const tempValue = document.getElementById("tempValue");
        if (tempInput && tempValue) {
            tempInput.value = State.settings.temperature;
            tempValue.textContent = State.settings.temperature.toFixed(2);
        }

        const tokenInput = document.getElementById("tokenInput");
        if (tokenInput) {
            tokenInput.value = State.settings.maxTokens;
        }

        const topKInput = document.getElementById("topKInput");
        const topKValue = document.getElementById("topKValue");
        if (topKInput && topKValue) {
            topKInput.value = State.settings.topK;
            topKValue.textContent = State.settings.topK;
        }

        const topPInput = document.getElementById("topPInput");
        const topPValue = document.getElementById("topPValue");
        if (topPInput && topPValue) {
            topPInput.value = State.settings.topP;
            topPValue.textContent = State.settings.topP.toFixed(2);
        }

        const historyInput = document.getElementById("historyInput");
        if (historyInput) {
            historyInput.value = State.settings.maxHistory;
        }

        // Tool checkboxes
        document.querySelectorAll(".tool-checkbox").forEach((cb) => {
            const toolName = cb.getAttribute("data-tool");
            if (toolName) {
                cb.checked =
                    State.settings.enabledTools[toolName] !== false;
            }
        });

        // Storage info
        this._updateStorageInfo();
    },

    _updateStorageInfo() {
        const infoEl = document.getElementById("storageInfoText");
        if (infoEl) {
            const info = Storage.getStorageInfo();
            infoEl.textContent = `${info.chatCount} chats, ${info.totalMessages} messages, ${info.usedMB}MB used`;
        }
    },

    bindEvents() {
        // Live update labels
        const tempInput = document.getElementById("tempInput");
        const tempValue = document.getElementById("tempValue");
        if (tempInput && tempValue) {
            tempInput.addEventListener("input", () => {
                tempValue.textContent = parseFloat(tempInput.value).toFixed(2);
            });
        }

        const topKInput = document.getElementById("topKInput");
        const topKValue = document.getElementById("topKValue");
        if (topKInput && topKValue) {
            topKInput.addEventListener("input", () => {
                topKValue.textContent = topKInput.value;
            });
        }

        const topPInput = document.getElementById("topPInput");
        const topPValue = document.getElementById("topPValue");
        if (topPInput && topPValue) {
            topPInput.addEventListener("input", () => {
                topPValue.textContent = parseFloat(topPInput.value).toFixed(2);
            });
        }

        // Save button
        const saveBtn = document.getElementById("saveSettingsBtn");
        if (saveBtn) {
            saveBtn.addEventListener("click", () => this.save());
        }

        // Reset button
        const resetBtn = document.getElementById("resetSettingsBtn");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                State.settings = JSON.parse(
                    JSON.stringify(CONFIG.DEFAULT_SETTINGS)
                );
                this.populateUI();
                Toast.success("Settings reset to defaults.");
            });
        }
    },

    save() {
        const sysInput = document.getElementById("systemPromptInput");
        const tempInput = document.getElementById("tempInput");
        const tokenInput = document.getElementById("tokenInput");
        const topKInput = document.getElementById("topKInput");
        const topPInput = document.getElementById("topPInput");
        const historyInput = document.getElementById("historyInput");

        State.settings.systemPrompt = sysInput ? sysInput.value : "";
        State.settings.temperature = tempInput
            ? parseFloat(tempInput.value)
            : 0.7;
        State.settings.maxTokens = tokenInput
            ? parseInt(tokenInput.value, 10)
            : 1024;
        State.settings.topK = topKInput ? parseInt(topKInput.value, 10) : 40;
        State.settings.topP = topPInput
            ? parseFloat(topPInput.value)
            : 0.95;
        State.settings.maxHistory = historyInput
            ? parseInt(historyInput.value, 10)
            : 10;

        // Clamp values to safe ranges
        State.settings.temperature = Math.max(0, Math.min(2, State.settings.temperature));
        State.settings.maxTokens = Math.max(64, Math.min(4096, State.settings.maxTokens));
        State.settings.topK = Math.max(1, Math.min(100, State.settings.topK));
        State.settings.topP = Math.max(0, Math.min(1, State.settings.topP));
        State.settings.maxHistory = Math.max(1, Math.min(50, State.settings.maxHistory));

        // Save tool toggles
        document.querySelectorAll(".tool-checkbox").forEach((cb) => {
            const toolName = cb.getAttribute("data-tool");
            if (toolName) {
                State.settings.enabledTools[toolName] = cb.checked;
            }
        });

        Storage.saveSettings();
        Modal.close("settingsModal");
        Toast.success("Settings saved!");
        this._updateStorageInfo();
    },

    getEnabledToolsString() {
        let toolsStr = "";
        for (const [key, val] of Object.entries(State.settings.enabledTools)) {
            if (val && CONFIG.TOOL_DEFINITIONS[key]) {
                toolsStr += `- ${CONFIG.TOOL_DEFINITIONS[key]}\n`;
            }
        }
        return toolsStr
            ? `Available Tools:\n${toolsStr}`
            : "No tools are currently enabled. Answer from your own knowledge only.";
    }
};

// ==========================================
// 11. SIDEBAR CONTROLLER
// ==========================================
const Sidebar = {
    toggle() {
        State.sidebarOpen = !State.sidebarOpen;
        DOM.sidebar.classList.toggle("open", State.sidebarOpen);
        DOM.sidebarOverlay.classList.toggle("active", State.sidebarOpen);

        if (State.sidebarOpen) {
            this.renderHistory();
        }
    },

    close() {
        State.sidebarOpen = false;
        DOM.sidebar.classList.remove("open");
        DOM.sidebarOverlay.classList.remove("active");
    },

    initEvents() {
        const menuBtn = document.getElementById("menuBtn");
        if (menuBtn) {
            menuBtn.addEventListener("click", () => this.toggle());
        }

        if (DOM.sidebarOverlay) {
            DOM.sidebarOverlay.addEventListener("click", () => this.close());
        }

        const newChatBtn = document.getElementById("newChatBtn");
        if (newChatBtn) {
            newChatBtn.addEventListener("click", () => {
                ChatManager.createNewChat();
                this.close();
            });
        }

        const clearChatBtn = document.getElementById("clearChatBtn");
        if (clearChatBtn) {
            clearChatBtn.addEventListener("click", () => {
                if (Object.keys(State.chats).length > 0) {
                    // Use inline confirmation
                    if (clearChatBtn.dataset.confirming === "true") {
                        ChatManager.clearAllHistory();
                        Toast.error("All chat history deleted.");
                        clearChatBtn.dataset.confirming = "false";
                        clearChatBtn.querySelector(
                            ".sidebar-btn-label"
                        ).textContent = "Delete All Chats";
                    } else {
                        clearChatBtn.dataset.confirming = "true";
                        clearChatBtn.querySelector(
                            ".sidebar-btn-label"
                        ).textContent = "Click Again to Confirm";
                        setTimeout(() => {
                            clearChatBtn.dataset.confirming = "false";
                            const label = clearChatBtn.querySelector(
                                ".sidebar-btn-label"
                            );
                            if (label) label.textContent = "Delete All Chats";
                        }, 3000);
                    }
                }
            });
        }

        const exportBtn = document.getElementById("exportChatsBtn");
        if (exportBtn) {
            exportBtn.addEventListener("click", () => {
                ExportManager.exportAllChats();
                this.close();
            });
        }
    },

    renderHistory() {
        if (!DOM.historyList) return;
        DOM.historyList.innerHTML = "";

        const chatIds = Object.keys(State.chats).sort((a, b) => b - a);

        if (chatIds.length === 0) {
            DOM.historyList.innerHTML = `
                <div style="padding:20px;color:var(--color-text-muted);font-size:0.85rem;text-align:center;">
                    No chat history yet.
                </div>`;
            return;
        }

        const maxShow = Math.min(chatIds.length, CONFIG.MAX_CHAT_TITLES_SHOWN);
        for (let i = 0; i < maxShow; i++) {
            const id = chatIds[i];
            const chat = State.chats[id];
            if (!chat) continue;

            const item = document.createElement("div");
            item.className = `history-item${
                id === State.currentChatId ? " active" : ""
            }`;
            item.setAttribute("data-chat-id", id);

            const textSpan = document.createElement("span");
            textSpan.className = "history-item-text";
            textSpan.textContent = chat.title || "New Chat";
            item.appendChild(textSpan);

            // Delete button for individual chat
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "history-item-delete icon-btn";
            deleteBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            deleteBtn.title = "Delete this chat";
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this._deleteChatWithConfirm(id, item);
            });
            item.appendChild(deleteBtn);

            // Click to load chat
            textSpan.addEventListener("click", () => {
                ChatManager.loadChat(id);
                this.close();
            });

            DOM.historyList.appendChild(item);
        }

        if (chatIds.length > maxShow) {
            const more = document.createElement("div");
            more.style.cssText =
                "padding:8px 12px;text-align:center;font-size:0.75rem;color:var(--color-text-muted);";
            more.textContent = `+${chatIds.length - maxShow} older chats`;
            DOM.historyList.appendChild(more);
        }
    },

    _deleteChatWithConfirm(chatId, itemEl) {
        // First click: shake + show confirm
        if (itemEl.dataset.confirmDelete !== "true") {
            itemEl.dataset.confirmDelete = "true";
            itemEl.style.animation = "none";
            void itemEl.offsetHeight;
            itemEl.style.background = "var(--color-error-bg)";
            const textEl = itemEl.querySelector(".history-item-text");
            const origText = textEl ? textEl.textContent : "";
            if (textEl) textEl.textContent = "Delete? Click again";
            const delBtn = itemEl.querySelector(".history-item-delete");
            if (delBtn) delBtn.style.opacity = "1";

            setTimeout(() => {
                itemEl.dataset.confirmDelete = "false";
                itemEl.style.background = "";
                if (textEl) textEl.textContent = origText;
            }, 3000);
            return;
        }

        // Second click: actually delete
        Storage.deleteChat(chatId);
        itemEl.style.transition = "all 0.3s ease";
        itemEl.style.opacity = "0";
        itemEl.style.transform = "translateX(-20px)";
        itemEl.style.maxHeight = itemEl.offsetHeight + "px";

        setTimeout(() => {
            itemEl.style.maxHeight = "0";
            itemEl.style.padding = "0";
            itemEl.style.margin = "0";
        }, 150);

        setTimeout(() => {
            itemEl.remove();
            // If we deleted the active chat, show welcome or load latest
            if (State.currentChatId === chatId) {
                State.currentChatId = null;
                const remaining = Object.keys(State.chats).sort(
                    (a, b) => b - a
                );
                if (remaining.length > 0) {
                    ChatManager.loadChat(remaining[0]);
                } else {
                    DOM.chatArea.innerHTML = "";
                    UIController.showWelcome();
                }
            }
            this.renderHistory();
            Toast.success("Chat deleted.");
        }, 400);
    }
};

// ==========================================
// 12. CHAT MANAGER
// ==========================================
const ChatManager = {
    createNewChat() {
        const id = Date.now().toString();
        State.chats[id] = {
            title: "New Chat",
            messages: [],
            createdAt: Date.now()
        };
        State.currentChatId = id;
        this.loadChat(id);
        Storage.saveChats();
        Sidebar.renderHistory();
    },

    loadChat(chatId) {
        State.currentChatId = chatId;
        const chat = State.chats[chatId];

        if (!chat) {
            this.createNewChat();
            return;
        }

        // Rebuild chat UI from stored messages
        DOM.chatArea.innerHTML = "";

        if (!chat.messages || chat.messages.length === 0) {
            UIController.showWelcome();
        } else {
            UIController.hideWelcome();
            chat.messages.forEach((msg) => {
                if (msg.role === "user") {
                    UIController.createUserMessage(msg.content, false);
                } else if (msg.role === "assistant") {
                    UIController.createAssistantMessage(msg.content, false);
                }
            });
            UIController.scrollToBottom();
        }

        Sidebar.renderHistory();
        Storage.saveChats();
        DOM.inputText.focus();
    },

    addMessage(role, content) {
        if (!State.currentChatId || !State.chats[State.currentChatId]) {
            this.createNewChat();
        }

        const chat = State.chats[State.currentChatId];
        if (!chat.messages) chat.messages = [];

        chat.messages.push({ role, content, timestamp: Date.now() });

        // Auto-generate title from first user message
        if (chat.title === "New Chat" && role === "user") {
            chat.title =
                content.substring(0, 45) +
                (content.length > 45 ? "..." : "");
            Sidebar.renderHistory();
        }

        Storage.saveChats();
    },

    updateLastAssistantMessage(content) {
        if (!State.currentChatId || !State.chats[State.currentChatId]) return;
        const msgs = State.chats[State.currentChatId].messages;
        if (
            msgs.length > 0 &&
            msgs[msgs.length - 1].role === "assistant"
        ) {
            msgs[msgs.length - 1].content = content;
        }
    },

    removeLastMessagePair() {
        if (!State.currentChatId || !State.chats[State.currentChatId]) return;
        const msgs = State.chats[State.currentChatId].messages;
        // Remove last assistant message if present
        if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
            msgs.pop();
        }
        Storage.saveChats();
    },

    getLastUserMessage() {
        if (!State.currentChatId || !State.chats[State.currentChatId]) return null;
        const msgs = State.chats[State.currentChatId].messages;
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "user") return msgs[i].content;
        }
        return null;
    },

    clearAllHistory() {
        Storage.clearAll();
        DOM.chatArea.innerHTML = "";
        UIController.showWelcome();
        Sidebar.renderHistory();
        this.createNewChat();
    },

    getChatHistory() {
        if (!State.currentChatId || !State.chats[State.currentChatId]) return [];
        return State.chats[State.currentChatId].messages || [];
    }
};
/**
 * ==========================================
 * PART 3: Message Rendering, Copy, Edit,
 *         Delete, Regenerate
 * ==========================================
 */

// ==========================================
// 13. UI CONTROLLER (Main Orchestrator)
// ==========================================
const UIController = {
    init() {
        Modal.initEvents();
        SettingsUI.init();
        Sidebar.initEvents();
        this.bindInput();
        this.bindTopBar();

        // Restore last session or show welcome
        if (
            State.currentChatId &&
            State.chats[State.currentChatId]
        ) {
            ChatManager.loadChat(State.currentChatId);
        } else {
            this.showWelcome();
            Sidebar.renderHistory();
        }

        // Focus input
        DOM.inputText.focus();
    },

    // ==========================================
    // 13a. Top Bar Bindings
    // ==========================================
    bindTopBar() {
        const settingsBtn = document.getElementById("openSettingsBtn");
        if (settingsBtn) {
            settingsBtn.addEventListener("click", () => {
                SettingsUI.populateUI();
                Modal.open("settingsModal");
            });
        }

        const toolsBtn = document.getElementById("openToolsBtn");
        if (toolsBtn) {
            toolsBtn.addEventListener("click", () => {
                Modal.open("toolsModal");
            });
        }
    },

    // ==========================================
    // 13b. Input Area Bindings
    // ==========================================
    bindInput() {
        // Auto-resize textarea
        DOM.inputText.addEventListener("input", () => {
            DOM.inputText.style.height = "auto";
            DOM.inputText.style.height =
                Math.min(DOM.inputText.scrollHeight, 120) + "px";
        });

        // Send on Enter (without Shift)
        DOM.inputText.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                Agent.handleSend();
            }
        });

        // Send button
        DOM.sendBtn.addEventListener("click", () => Agent.handleSend());

        // Suggestion cards on welcome screen
        document.querySelectorAll(".suggestion-card").forEach((card) => {
            card.addEventListener("click", () => {
                const prompt = card.getAttribute("data-prompt");
                if (prompt) {
                    DOM.inputText.value = prompt;
                    Agent.handleSend();
                }
            });
        });
    },

    // ==========================================
    // 13c. Welcome Screen Toggle
    // ==========================================
    showWelcome() {
        if (DOM.welcomeScreen) {
            DOM.welcomeScreen.classList.remove("hidden");
            DOM.welcomeScreen.style.display = "flex";
        }
        if (DOM.chatArea) {
            DOM.chatArea.classList.remove("active");
        }
    },

    hideWelcome() {
        if (DOM.welcomeScreen) {
            DOM.welcomeScreen.classList.add("hidden");
            DOM.welcomeScreen.style.display = "none";
        }
        if (DOM.chatArea) {
            DOM.chatArea.classList.add("active");
        }
    },

    // ==========================================
    // 13d. Scroll Management
    // ==========================================
    scrollToBottom(force = false) {
        requestAnimationFrame(() => {
            const el = DOM.chatArea;
            if (!el) return;
            const isNearBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight < 150;
            if (force || isNearBottom || State.isGenerating) {
                el.scrollTop = el.scrollHeight;
            }
        });
    },

    // ==========================================
    // 13e. Generating State Toggle
    // ==========================================
    setGeneratingState(isGenerating) {
        State.isGenerating = isGenerating;
        DOM.sendBtn.classList.toggle("is-generating", isGenerating);

        const sendIcon = DOM.sendBtn.querySelector(".icon-send");
        const stopIcon = DOM.sendBtn.querySelector(".icon-stop");

        if (sendIcon && stopIcon) {
            if (isGenerating) {
                sendIcon.style.display = "none";
                stopIcon.style.display = "block";
            } else {
                sendIcon.style.display = "block";
                stopIcon.style.display = "none";
            }
        }

        // Disable input during generation
        DOM.inputText.disabled = isGenerating;
        if (!isGenerating) {
            DOM.inputText.focus();
        }
    },

    // ==========================================
    // 13f. USER MESSAGE RENDERING
    // ==========================================
    createUserMessage(text, saveToMemory = true) {
        this.hideWelcome();

        if (!DOM.tmplUserMsg) return null;

        const frag = DOM.tmplUserMsg.content.cloneNode(true);
        const msgEl = frag.querySelector(".message");
        const textEl = frag.querySelector(".msg-text");

        if (textEl) textEl.textContent = text;
        DOM.chatArea.appendChild(frag);
        this.scrollToBottom(true);

        if (saveToMemory) {
            ChatManager.addMessage("user", text);
        }

        // Bind action buttons
        this._bindUserMsgActions(msgEl, text);

        return msgEl;
    },

    _bindUserMsgActions(msgEl, originalText) {
        // Edit button
        const editBtn = msgEl.querySelector(".edit-btn");
        if (editBtn) {
            editBtn.addEventListener("click", () => {
                this._handleEditMessage(msgEl, originalText);
            });
        }

        // Copy button
        const copyBtn = msgEl.querySelector(".copy-btn");
        if (copyBtn) {
            copyBtn.addEventListener("click", () => {
                this._copyToClipboard(originalText, copyBtn);
            });
        }

        // Delete button
        const deleteBtn = msgEl.querySelector(".delete-btn");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", () => {
                this._handleDeleteUserMessage(msgEl, originalText);
            });
        }
    },

    _handleEditMessage(msgEl, oldText) {
        // Remove any existing editing state
        document.querySelectorAll(".user-msg.editing").forEach((el) => {
            el.classList.remove("editing");
        });

        msgEl.classList.add("editing");
        DOM.inputText.value = oldText;
        DOM.inputText.focus();
        DOM.inputText.style.height = "auto";
        DOM.inputText.style.height =
            Math.min(DOM.inputText.scrollHeight, 120) + "px";

        // Remove editing state on next input change
        const removeEdit = () => {
            msgEl.classList.remove("editing");
            DOM.inputText.removeEventListener("input", removeEdit);
            DOM.inputText.removeEventListener("keydown", removeEditOnSend);
        };

        const removeEditOnSend = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                removeEdit();
            }
        };

        DOM.inputText.addEventListener("input", removeEdit);
        DOM.inputText.addEventListener("keydown", removeEditOnSend);
    },

    _handleDeleteUserMessage(msgEl, text) {
        // Find the index of this message in the chat
        const allMsgs = Array.from(
            DOM.chatArea.querySelectorAll(".message")
        );
        const domIndex = allMsgs.indexOf(msgEl);

        // Animate out
        msgEl.style.transition = "all 0.25s ease";
        msgEl.style.opacity = "0";
        msgEl.style.transform = "translateX(20px)";

        setTimeout(() => {
            msgEl.remove();

            // Also remove the next assistant message if it follows
            const nextMsg = allMsgs[domIndex + 1];
            if (nextMsg && nextMsg.classList.contains("assistant-msg")) {
                nextMsg.style.transition = "all 0.2s ease";
                nextMsg.style.opacity = "0";
                setTimeout(() => nextMsg.remove(), 200);
            }

            // Check if chat is now empty
            const remaining = DOM.chatArea.querySelectorAll(".message");
            if (remaining.length === 0) {
                this.showWelcome();
            }
        }, 250);
    },

    // ==========================================
    // 13g. ASSISTANT MESSAGE RENDERING
    // ==========================================
    createAssistantMessage(text, saveToMemory = true) {
        if (!DOM.tmplAssistantMsg) return null;

        const frag = DOM.tmplAssistantMsg.content.cloneNode(true);
        const msgEl = frag.querySelector(".message");
        const textEl = frag.querySelector(".msg-text");
        const statusEl = msgEl.querySelector(".msg-status");
        const toolsContainer = msgEl.querySelector(".msg-tools-container");

        DOM.chatArea.appendChild(frag);
        this.scrollToBottom(true);

        if (saveToMemory && text) {
            ChatManager.addMessage("assistant", text);
        }

        // Bind action buttons
        this._bindAssistantMsgActions(msgEl, text);

        return { msgEl, textEl, statusEl, toolsContainer };
    },

    _bindAssistantMsgActions(msgEl, text) {
        // Copy full response
        const copyBtn = msgEl.querySelector(".copy-btn");
        if (copyBtn) {
            copyBtn.addEventListener("click", () => {
                this._copyToClipboard(text, copyBtn);
            });
        }

        // Regenerate
        const regenBtn = msgEl.querySelector(".regen-btn");
        if (regenBtn) {
            regenBtn.addEventListener("click", () => {
                this._handleRegenerate(msgEl);
            });
        }

        // Delete assistant message
        const deleteBtn = msgEl.querySelector(".delete-btn");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", () => {
                msgEl.style.transition = "all 0.25s ease";
                msgEl.style.opacity = "0";
                msgEl.style.transform = "translateX(-20px)";
                setTimeout(() => {
                    msgEl.remove();
                    const remaining = DOM.chatArea.querySelectorAll(".message");
                    if (remaining.length === 0) this.showWelcome();
                }, 250);
            });
        }
    },

    _handleRegenerate(msgEl) {
        if (State.isGenerating) return;

        // Get the last user message to regenerate from
        const lastUserMsg = ChatManager.getLastUserMessage();
        if (!lastUserMsg) {
            Toast.error("No user message to regenerate from.");
            return;
        }

        // Remove this assistant message from DOM
        msgEl.style.transition = "all 0.2s ease";
        msgEl.style.opacity = "0";
        setTimeout(() => {
            msgEl.remove();
            // Also remove from memory
            ChatManager.removeLastMessagePair();
            // Re-generate
            Agent.handleSend(lastUserMsg, true);
        }, 200);
    },

    // ==========================================
    // 13h. CLIPBOARD UTILITY
    // ==========================================
    _copyToClipboard(text, buttonEl) {
        if (!text || !text.trim()) {
            Toast.error("Nothing to copy.");
            return;
        }

        // Strip tool calls from copied text
        const cleanText = ToolSystem.stripToolCall(text);

        navigator.clipboard
            .writeText(cleanText)
            .then(() => {
                if (buttonEl) {
                    buttonEl.classList.add("copied");
                    // Update the icon temporarily
                    const origHTML = buttonEl.innerHTML;
                    buttonEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                    setTimeout(() => {
                        buttonEl.classList.remove("copied");
                        buttonEl.innerHTML = origHTML;
                    }, 2000);
                }
                Toast.success("Copied to clipboard!");
            })
            .catch((err) => {
                // Fallback for older browsers
                try {
                    const ta = document.createElement("textarea");
                    ta.value = cleanText;
                    ta.style.position = "fixed";
                    ta.style.opacity = "0";
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                    Toast.success("Copied to clipboard!");
                } catch (e) {
                    Toast.error("Failed to copy.");
                }
            });
    },

    // ==========================================
    // 13i. UPDATE EXISTING ASSISTANT MESSAGE
    //         (used during streaming)
    // ==========================================
    updateAssistantText(textEl, rawText, showCursor = true) {
        if (!textEl) return;

        let html = Markdown.parse(rawText);

        if (showCursor && State.isGenerating) {
            html += '<span class="streaming-cursor"></span>';
        }

        textEl.innerHTML = html;
        this.scrollToBottom();

        // Queue math rendering
        MathRenderer.queueRender(textEl);
    },

    finalizeAssistantMessage(textEl, rawText) {
        if (!textEl) return;
        textEl.innerHTML = Markdown.parse(rawText);
        MathRenderer.queueRender(textEl);
    },

    // ==========================================
    // 13j. EMPTY STATE CHECK
    // ==========================================
    checkEmptyState() {
        const msgs = DOM.chatArea.querySelectorAll(".message");
        if (msgs.length === 0) {
            this.showWelcome();
            return true;
        }
        return false;
    }
};

// ==========================================
// 14. EXPORT MANAGER
// ==========================================
const ExportManager = {
    exportAllChats() {
        const chatIds = Object.keys(State.chats).sort((a, b) => b - a);
        if (chatIds.length === 0) {
            Toast.error("No chats to export.");
            return;
        }

        let markdown = `# Opensky — All Chats Export\n`;
        markdown += `Exported: ${new Date().toLocaleString()}\n\n---\n\n`;

        chatIds.forEach((id) => {
            const chat = State.chats[id];
            markdown += `## ${chat.title || "Untitled Chat"}\n`;
            markdown += `*Created: ${new Date(chat.createdAt || parseInt(id)).toLocaleString()}*\n\n`;

            if (chat.messages) {
                chat.messages.forEach((msg) => {
                    const role =
                        msg.role === "user" ? "**You**" : "**Opensky**";
                    const cleanContent = ToolSystem.stripToolCall(
                        msg.content || ""
                    );
                    markdown += `${role}:\n\n${cleanContent}\n\n---\n\n`;
                });
            }
        });

        this._downloadFile(
            markdown,
            `opensky-chats-${Date.now()}.md`,
            "text/markdown"
        );
        Toast.success(`Exported ${chatIds.length} chats.`);
    },

    exportCurrentChat() {
        if (!State.currentChatId || !State.chats[State.currentChatId]) {
            Toast.error("No active chat to export.");
            return;
        }

        const chat = State.chats[State.currentChatId];
        let markdown = `# ${chat.title || "Untitled Chat"}\n\n`;

        if (chat.messages) {
            chat.messages.forEach((msg) => {
                const role =
                    msg.role === "user" ? "**You**" : "**Opensky**";
                const cleanContent = ToolSystem.stripToolCall(
                    msg.content || ""
                );
                markdown += `${role}:\n\n${cleanContent}\n\n---\n\n`;
            });
        }

        this._downloadFile(
            markdown,
            `opensky-chat-${Date.now()}.md`,
            "text/markdown"
        );
        Toast.success("Chat exported as Markdown.");
    },

    exportAsText() {
        if (!State.currentChatId || !State.chats[State.currentChatId]) {
            Toast.error("No active chat to export.");
            return;
        }

        const chat = State.chats[State.currentChatId];
        let text = `${chat.title || "Untitled Chat"}\n${"=".repeat(40)}\n\n`;

        if (chat.messages) {
            chat.messages.forEach((msg) => {
                const role = msg.role === "user" ? "You" : "Opensky";
                const cleanContent = ToolSystem.stripToolCall(
                    msg.content || ""
                );
                text += `[${role}]\n${cleanContent}\n\n${"-".repeat(30)}\n\n`;
            });
        }

        this._downloadFile(
            text,
            `opensky-chat-${Date.now()}.txt`,
            "text/plain"
        );
        Toast.success("Chat exported as text.");
    },

    _downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);
    }
};
/**
 * ==========================================
 * PART 4: Tools, APIs, Security & Parsing
 * ==========================================
 */

// ==========================================
// 15. SECURITY & SANITIZATION
// ==========================================
const Security = {
    escapeHTML(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    // Sanitize text that will be passed to KaTeX
    escapeLatex(str) {
        return String(str)
            .replace(/\\/g, "\\textbackslash{}")
            .replace(/%/g, "\\%")
            .replace(/\$/g, "\\$")
            .replace(/#/g, "\\#")
            .replace(/_/g, "\\_")
            .replace(/{/g, "\\{")
            .replace(/}/g, "\\}")
            .replace(/~/g, "\\textasciitilde{}")
            .replace(/\^/g, "\\textasciicircum{}");
    },

    // Basic URL validation
    isValidURL(string) {
        try {
            const url = new URL(string);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch (_) {
            return false;
        }
    },

    // Strip HTML tags (for plain text contexts)
    stripTags(str) {
        if (!str) return "";
        return String(str).replace(/<[^>]*>/g, "");
    }
};

// ==========================================
// 16. API INTEGRATIONS (The Tools)
// ==========================================
const APIs = {
    wiki: async (query) => {
        try {
            const encoded = encodeURIComponent(query);
            const res = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
            );
            if (!res.ok) throw new Error("Article not found");
            const data = await res.json();
            const extract = data.extract || "No summary available.";
            const image = data.thumbnail?.source || null;
            return {
                text: Security.escapeHTML(extract),
                image: image
            };
        } catch (e) {
            return {
                text: `Error: Could not fetch Wikipedia data for "${Security.escapeHTML(query)}". Try a different topic.`,
                image: null
            };
        }
    },

    weather: async (city) => {
        try {
            // Step 1: Geocode the city
            const geoRes = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
            );
            if (!geoRes.ok) throw new Error("Geocoding failed");
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                throw new Error(`City "${city}" not found`);
            }

            const { latitude, longitude, name } = geoData.results[0];

            // Step 2: Get weather
            const weatherRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
            );
            if (!weatherRes.ok) throw new Error("Weather API failed");
            const weatherData = await weatherRes.json();

            const cw = weatherData.current_weather;
            const temp = cw.temperature;
            const wind = cw.windspeed;
            const code = cw.weathercode;

            // Map WMO weather codes to descriptions
            const conditions = {
                0: "Clear sky",
                1: "Mainly clear",
                2: "Partly cloudy",
                3: "Overcast",
                45: "Foggy",
                48: "Depositing rime fog",
                51: "Light drizzle",
                53: "Moderate drizzle",
                55: "Dense drizzle",
                61: "Slight rain",
                63: "Moderate rain",
                65: "Heavy rain",
                71: "Slight snowfall",
                73: "Moderate snowfall",
                75: "Heavy snowfall",
                77: "Snow grains",
                80: "Slight rain showers",
                81: "Moderate rain showers",
                82: "Violent rain showers",
                85: "Slight snow showers",
                86: "Heavy snow showers",
                95: "Thunderstorm",
                96: "Thunderstorm with slight hail",
                99: "Thunderstorm with heavy hail"
            };

            const condition = conditions[code] || "Unknown";

            // Wind direction
            const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
            const windDir = cw.winddirection !== undefined
                ? dirs[Math.round(cw.winddirection / 22.5) % 16]
                : "";

            return {
                text: `Weather in ${Security.escapeHTML(name)}: ${temp}°C — ${condition}. Wind: ${wind} km/h ${windDir}.`,
                image: null
            };
        } catch (e) {
            return {
                text: `Error: ${Security.escapeHTML(e.message)}`,
                image: null
            };
        }
    },

    define: async (word) => {
        try {
            const res = await fetch(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
            );
            if (!res.ok) throw new Error("Word not found");
            const data = await res.json();
            const entry = data[0];

            let result = `**${Security.escapeHTML(entry.word)}**\n`;

            if (entry.phonetic) {
                result += `*${Security.escapeHTML(entry.phonetic)}*\n\n`;
            }

            entry.meanings.forEach((m) => {
                result += `**${Security.escapeHTML(m.partOfSpeech)}**\n`;
                m.definitions.slice(0, 3).forEach((d, i) => {
                    result += `${i + 1}. ${Security.escapeHTML(d.definition)}\n`;
                    if (d.example) {
                        result += `   _"${Security.escapeHTML(d.example)}"_\n`;
                    }
                });
                result += "\n";
            });

            return { text: result.trim(), image: null };
        } catch (e) {
            return {
                text: `Error: ${Security.escapeHTML(e.message)}`,
                image: null
            };
        }
    },

    pokemon: async (name) => {
        try {
            const res = await fetch(
                `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name.toLowerCase())}`
            );
            if (!res.ok) throw new Error("Pokemon not found");
            const data = await res.json();

            const types = data.types
                .map((t) => t.type.name)
                .join(", ");
            const stats = data.stats
                .map((s) => `${s.stat.name}: ${s.base_stat}`)
                .join(", ");
            const height = (data.height / 10).toFixed(1);
            const weight = (data.weight / 10).toFixed(1);

            return {
                text: `#${data.id} **${Security.escapeHTML(data.name)}**\nType: ${Security.escapeHTML(types)}\nHeight: ${height}m, Weight: ${weight}kg\nStats: ${Security.escapeHTML(stats)}`,
                image: data.sprites?.front_default || null
            };
        } catch (e) {
            return {
                text: `Error: ${Security.escapeHTML(e.message)}`,
                image: null
            };
        }
    },

    country: async (name) => {
        try {
            const res = await fetch(
                `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`
            );
            if (!res.ok) throw new Error("Country not found");
            const data = await res.json();
            const c = data[0];
            const pop = (c.population / 1_000_000).toFixed(2);
            const currencies = c.currencies
                ? Object.values(c.currencies)
                      .map((cur) => `${cur.name} (${cur.symbol})`)
                      .join(", ")
                : "N/A";
            const languages = c.languages
                ? Object.values(c.languages).join(", ")
                : "N/A";

            return {
                text: `**${Security.escapeHTML(c.name.common)}**\nCapital: ${Security.escapeHTML(c.capital?.[0] || "N/A")}\nPopulation: ~${pop}M\nRegion: ${Security.escapeHTML(c.region)}\nLanguages: ${Security.escapeHTML(languages)}\nCurrency: ${Security.escapeHTML(currencies)}`,
                image: c.flags?.svg || c.flags?.png || null
            };
        } catch (e) {
            return {
                text: `Error: ${Security.escapeHTML(e.message)}`,
                image: null
            };
        }
    },

    joke: async () => {
        try {
            const data = await fetch(
                "https://v2.jokeapi.dev/joke/Any?type=single&safe-mode"
            ).then((r) => r.json());
            if (data.error) throw new Error(data.message);
            return {
                text: Security.escapeHTML(data.joke || "No joke available."),
                image: null
            };
        } catch (e) {
            return {
                text: `Error: ${Security.escapeHTML(e.message)}`,
                image: null
            };
        }
    },

    advice: async () => {
        try {
            const data = await fetch(
                `https://api.adviceslip.com/advice?t=${Date.now()}`
            ).then((r) => r.json());
            return {
                text: Security.escapeHTML(
                    data.slip?.advice || "No advice available."
                ),
                image: null
            };
        } catch (e) {
            return {
                text: "Error: Advice API failed.",
                image: null
            };
        }
    },

    bored: async () => {
        try {
            const data = await fetch(
                "https://www.boredapi.com/api/activity"
            ).then((r) => r.json());
            const activity = data.activity || "No activity found.";
            const type = data.type || "unknown";
            const participants = data.participants || 1;
            return {
                text: `**Activity:** ${Security.escapeHTML(activity)}\nType: ${Security.escapeHTML(type)} | Participants: ${participants}`,
                image: null
            };
        } catch (e) {
            return {
                text: "Error: Bored API failed.",
                image: null
            };
        }
    },

    crypto: async (id) => {
        try {
            const coinId = id.toLowerCase().trim();
            const res = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
            );
            if (!res.ok) throw new Error("Network error");
            const data = await res.json();

            if (data[coinId] && data[coinId].usd !== undefined) {
                const price = data[coinId].usd.toLocaleString();
                const change = data[coinId].usd_24h_change;
                const changeStr =
                    change !== undefined
                        ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`
                        : "N/A";
                const mcap =
                    data[coinId].usd_market_cap !== undefined
                        ? `$${(data[coinId].usd_market_cap / 1e9).toFixed(2)}B`
                        : "N/A";

                return {
                    text: `**${Security.escapeHTML(coinId)}**: $${price} USD\n24h Change: ${changeStr}\nMarket Cap: ${mcap}`,
                    image: null
                };
            }
            throw new Error(
                "Coin not found. Try 'bitcoin', 'ethereum', or 'solana'."
            );
        } catch (e) {
            return {
                text: `Error: ${Security.escapeHTML(e.message)}`,
                image: null
            };
        }
    }
};

// ==========================================
// 17. TOOL PARSER & EXECUTOR
// ==========================================
const ToolSystem = {
    // Regex: ACTION: toolname ARGS: arguments
    _toolCallRegex: /ACTION:\s*(\w+)\s+ARGS:\s*([^\n]+)/i,

    parseToolCall(text) {
        const match = text.match(this._toolCallRegex);
        if (!match) return null;
        return {
            name: match[1].toLowerCase().trim(),
            args: match[2].trim()
        };
    },

    containsToolCall(text) {
        return this._toolCallRegex.test(text);
    },

    stripToolCall(text) {
        return text
            .replace(/ACTION:\s*\w+\s+ARGS:\s*[^\n]*\n?/gi, "")
            .replace(/<system>\s*Observation:.*?<\/system>\n?/gis, "")
            .trim();
    },

    async execute(toolName, toolArgs) {
        // Validate tool exists
        if (!APIs[toolName]) {
            return {
                text: `Error: Unknown tool '${Security.escapeHTML(toolName)}'. Available tools: ${Object.keys(APIs).join(", ")}`,
                image: null
            };
        }

        // Check if enabled
        if (State.settings.enabledTools[toolName] === false) {
            return {
                text: `Error: Tool '${Security.escapeHTML(toolName)}' is disabled by the user.`,
                image: null
            };
        }

        // Validate args
        if (!toolArgs || toolArgs.toLowerCase() === "none") {
            if (
                toolName !== "joke" &&
                toolName !== "advice" &&
                toolName !== "bored"
            ) {
                return {
                    text: `Error: Tool '${toolName}' requires an argument.`,
                    image: null
                };
            }
        }

        // Execute with timeout
        try {
            const result = await Promise.race([
                APIs[toolName](toolArgs),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error("Tool request timed out (10s)")),
                        10000
                    )
                )
            ]);

            if (result.image && typeof result.image !== "string") {
                result.image = null;
            }

            return result;
        } catch (error) {
            console.error(`Tool [${toolName}] failed:`, error);
            return {
                text: `System Error: ${Security.escapeHTML(error.message)}`,
                image: null
            };
        }
    },

    renderToolUI(toolsContainer, toolName, toolArgs, result) {
        if (!toolsContainer || !DOM.tmplToolCall) return null;

        const frag = DOM.tmplToolCall.content.cloneNode(true);
        const toolUI = frag.querySelector(".tool-call-ui");

        // Header
        const nameEl = toolUI.querySelector(".tool-name");
        if (nameEl) nameEl.textContent = toolName;

        // Body
        const argsEl = toolUI.querySelector(".tool-args code");
        if (argsEl) argsEl.textContent = toolArgs || "None";

        const resultTextEl = toolUI.querySelector(".tool-result-text");
        if (resultTextEl) resultTextEl.innerHTML = result.text;

        const imgEl = toolUI.querySelector(".tool-result-img");
        if (imgEl && result.image) {
            imgEl.src = result.image;
            imgEl.alt = `Result for ${toolName}`;
            imgEl.style.display = "block";
        }

        toolsContainer.appendChild(toolUI);

        // Bind toggle
        const headerBtn = toolUI.querySelector(".tool-call-header");
        if (headerBtn) {
            headerBtn.addEventListener("click", () => {
                toolUI.classList.toggle("open");
            });
        }

        return {
            setStatus(statusText, statusClass) {
                const el = toolUI.querySelector(".tool-status");
                if (el) {
                    el.textContent = statusText;
                    el.className = `tool-status ${statusClass}`;
                }
            },
            setResultText(text) {
                const el = toolUI.querySelector(".tool-result-text");
                if (el) el.innerHTML = text;
            },
            setResultImage(src) {
                const el = toolUI.querySelector(".tool-result-img");
                if (el && src) {
                    el.src = src;
                    el.style.display = "block";
                }
            },
            expand() {
                toolUI.classList.add("open");
            },
            getElement() {
                return toolUI;
            }
        };
    }
};
/**
 * ==========================================
 * PART 5: Markdown Parser, KaTeX Math
 *         Rendering & Code Blocks
 * ==========================================
 */

// ==========================================
// 18. MATH RENDERER (KaTeX)
// ==========================================
const MathRenderer = {
    _pendingElements: new Set(),
    _renderTimer: null,
    _katexAvailable: false,
    _checkAttempts: 0,

    checkAvailable() {
        if (typeof katex !== "undefined") {
            this._katexAvailable = true;
            return true;
        }
        return false;
    },

    queueRender(containerEl) {
        if (!containerEl) return;
        this._pendingElements.add(containerEl);

        // Debounce rendering to avoid excessive reflows during streaming
        if (this._renderTimer) clearTimeout(this._renderTimer);
        this._renderTimer = setTimeout(() => {
            this.flushRenderQueue();
        }, 150);
    },

    flushRenderQueue() {
        if (this._pendingElements.size === 0) return;

        if (!this._katexAvailable) {
            this._katexAvailable = this.checkAvailable();
            if (!this._katexAvailable) {
                this._checkAttempts++;
                if (this._checkAttempts < 20) {
                    // KaTeX script might still be loading (deferred)
                    setTimeout(() => this.flushRenderQueue(), 500);
                }
                return;
            }
        }

        const elements = [...this._pendingElements];
        this._pendingElements.clear();

        elements.forEach((el) => {
            this._renderMathInElement(el);
        });
    },

    _renderMathInElement(element) {
        if (!this._katexAvailable || !element) return;

        try {
            katex.renderMathInElement(element, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false },
                    { left: "\\(", right: "\\)", display: false },
                    { left: "\\[", right: "\\]", display: true }
                ],
                throwOnError: false,
                trust: false,
                strict: false,
                macros: {
                    "\\R": "\\mathbb{R}",
                    "\\N": "\\mathbb{N}",
                    "\\Z": "\\mathbb{Z}",
                    "\\Q": "\\mathbb{Q}",
                    "\\C": "\\mathbb{C}"
                }
            });
        } catch (e) {
            console.warn("KaTeX rendering error:", e);
        }
    },

    // Force render all math in the chat area
    renderAllInChat() {
        if (!DOM.chatArea) return;
        const allContentBodies = DOM.chatArea.querySelectorAll(".content-body");
        allContentBodies.forEach((el) => {
            this._renderMathInElement(el);
        });
    }
};

// ==========================================
// 19. MARKDOWN PARSER
// ==========================================
const Markdown = {
    // Track which code block IDs we've assigned for copy buttons
    _codeBlockCounter: 0,

    parse(text) {
        if (!text) return "";

        // Step 1: Escape HTML to prevent XSS from model output
        let html = Security.escapeHTML(text);

        // Step 2: Extract and protect code blocks (```lang\n...\n```)
        const codeBlocks = [];
        html = html.replace(
            /```(\w*)\n([\s\S]*?)```/g,
            (match, lang, code) => {
                const id = `codeblock-${Markdown._codeBlockCounter++}`;
                const language = lang || "code";
                const placeholder = `%%CODEBLOCK_${id}%%`;
                codeBlocks.push({ id, language, code: code.trimEnd() });
                return placeholder;
            }
        );

        // Step 3: Parse display math $$...$$ (protect from other transforms)
        const displayMath = [];
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
            const id = `dmath-${Markdown._codeBlockCounter++}`;
            displayMath.push({ id, math: math.trim() });
            return `%%DMATH_${id}%%`;
        });

        // Step 4: Parse inline math $...$ (not preceded/followed by $)
        const inlineMath = [];
        html = html.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (match, math) => {
            const id = `imath-${Markdown._codeBlockCounter++}`;
            inlineMath.push({ id, math: math.trim() });
            return `%%IMATH_${id}%%`;
        });

        // Step 5: Parse inline code `code` (protect from bold/italic)
        const inlineCodes = [];
        html = html.replace(/`([^`\n]+)`/g, (match, code) => {
            const id = `icode-${Markdown._codeBlockCounter++}`;
            inlineCodes.push({ id, code });
            return `%%ICODE_${id}%%`;
        });

        // Step 6: Parse bold **text**
        html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

        // Step 7: Parse italic *text* (but not inside **)
        html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");

        // Step 8: Parse strikethrough ~~text~~
        html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

        // Step 9: Parse headers ### → h3, ## → h2, # → h1
        html = html.replace(/^### (.+)$/gm, "<h4>$1</h4>");
        html = html.replace(/^## (.+)$/gm, "<h3>$1</h3>");
        html = html.replace(/^# (.+)$/gm, "<h2>$1</h2>");

        // Step 10: Parse unordered lists
        html = html.replace(
            /^[\-\*] (.+)$/gm,
            "<li>$1</li>"
        );
        html = html.replace(
            /((?:<li>.*<\/li>\n?)+)/g,
            "<ul>$1</ul>"
        );

        // Step 11: Parse ordered lists
        html = html.replace(
            /^\d+\. (.+)$/gm,
            "<li>$1</li>"
        );
        // Avoid double-wrapping if already in <ul>
        html = html.replace(
            /((?:<li>.*<\/li>\n?)+)(?!<\/ul>)/g,
            "<ol>$1</ol>"
        );

        // Step 12: Parse blockquotes > text
        html = html.replace(
            /^&gt; (.+)$/gm,
            "<blockquote>$1</blockquote>"
        );
        // Merge adjacent blockquotes
        html = html.replace(
            /<\/blockquote>\n<blockquote>/g,
            "<br>"
        );

        // Step 13: Parse horizontal rules
        html = html.replace(
            /^(?:---|\*\*\*|___)\s*$/gm,
            "<hr>"
        );

        // Step 14: Handle line breaks
        // Replace double newlines with paragraph breaks
        html = html.replace(/\n\n+/g, "</p><p>");
        // Single newlines to <br> (but not inside block elements)
        html = html.replace(
            /\n/g,
            "<br>"
        );

        // Step 15: Restore protected elements (in reverse order)

        // Restore inline code
        inlineCodes.forEach(({ id, code }) => {
            const escapedCode = Security.escapeHTML(code);
            html = html.replace(
                `%%ICODE_${id}%%`,
                `<code>${escapedCode}</code>`
            );
        });

        // Restore inline math
        inlineMath.forEach(({ id, math }) => {
            html = html.replace(
                `%%IMATH_${id}%%`,
                `<span class="katex-inline" data-math="${Security.escapeHTML(math)}">$${Security.escapeHTML(math)}$</span>`
            );
        });

        // Restore display math
        displayMath.forEach(({ id, math }) => {
            html = html.replace(
                `%%DMATH_${id}%%`,
                `<div class="katex-display" data-math="${Security.escapeHTML(math)}">$$${Security.escapeHTML(math)}$$</div>`
            );
        });

        // Restore code blocks
        codeBlocks.forEach(({ id, language, code }) => {
            const codeBlockHTML = this._buildCodeBlockHTML(id, language, code);
            html = html.replace(`%%CODEBLOCK_${id}%%`, codeBlockHTML);
        });

        // Step 16: Wrap in paragraph if not starting with a block element
        const blockStarters = [
            "<div", "<ul", "<ol", "<h2", "<h3", "<h4",
            "<blockquote", "<hr", "<table"
        ];
        const startsWithBlock = blockStarters.some((tag) =>
            html.trimStart().startsWith(tag)
        );

        if (!startsWithBlock && html.trim()) {
            html = `<p>${html}</p>`;
        }

        // Step 17: Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, "");
        html = html.replace(/<p>\s*<\/p>/g, "");
        html = html.replace(/<p>(<div[^>]*>)/g, "$1");
        html = html.replace(/(<\/div>)<\/p>/g, "$1");
        html = html.replace(/<p>(<ul[^>]*>)/g, "$1");
        html = html.replace(/(<\/ul>)<\/p>/g, "$1");
        html = html.replace(/<p>(<ol[^>]*>)/g, "$1");
        html = html.replace(/(<\/ol>)<\/p>/g, "$1");
        html = html.replace(/<p>(<h[2-4])/g, "$1");
        html = html.replace(/(<\/h[2-4]>)<\/p>/g, "$1");
        html = html.replace(/<p>(<hr[^>]*>)<\/p>/g, "$1");

        return html;
    },

    _buildCodeBlockHTML(id, language, code) {
        const escapedCode = Security.escapeHTML(code);
        return `<div class="code-block-component" data-code-id="${id}">
            <div class="code-header">
                <span class="code-lang">${Security.escapeHTML(language)}</span>
                <button class="copy-code-btn" onclick="AppHelpers.copyCodeBlock(this)" data-code-id="${id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy
                </button>
            </div>
            <pre class="code-body"><code>${escapedCode}</code></pre>
        </div>`;
    }
};

// ==========================================
// 20. GLOBAL HELPER FUNCTIONS
// (accessed via onclick in dynamically generated HTML)
// ==========================================
const AppHelpers = {
    copyCodeBlock(buttonEl) {
        if (!buttonEl) return;

        const codeBlock = buttonEl.closest(".code-block-component");
        if (!codeBlock) return;

        const codeEl = codeBlock.querySelector(".code-body code");
        if (!codeEl) return;

        const code = codeEl.textContent;

        navigator.clipboard
            .writeText(code)
            .then(() => {
                const origText = buttonEl.textContent.trim();
                buttonEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
                buttonEl.style.color = "var(--color-success)";
                setTimeout(() => {
                    buttonEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
                    buttonEl.style.color = "";
                }, 2000);
            })
            .catch(() => {
                Toast.error("Failed to copy code.");
            });
    },

    // Evaluate simple math expressions (for convenience, not a security risk
    // since it uses a sandboxed approach)
    evaluateMath(expression) {
        try {
            // Only allow numbers, operators, parentheses, dots, and spaces
            const sanitized = expression.replace(/[^0-9+\-*/().%\s^]/g, "");
            if (!sanitized.trim()) return "Invalid expression";

            // Replace ^ with ** for exponentiation
            const jsExpr = sanitized.replace(/\^/g, "**");

            // Use Function constructor (safer than eval, but still sandboxed)
            const result = new Function(`"use strict"; return (${jsExpr})`)();

            if (typeof result !== "number" || !isFinite(result)) {
                return "Result is not a finite number";
            }

            // Format the result nicely
            if (Number.isInteger(result)) {
                return result.toLocaleString();
            }
            return parseFloat(result.toPrecision(12)).toString();
        } catch (e) {
            return `Error: ${e.message}`;
        }
    },

    // Get word count of text
    getWordCount(text) {
        if (!text) return 0;
        return text
            .trim()
            .split(/\s+/)
            .filter((w) => w.length > 0).length;
    },

    // Get character count
    getCharCount(text) {
        return text ? text.length : 0;
    },

    // Estimate token count (rough: ~4 chars per token for English)
    estimateTokens(text) {
        return Math.ceil((text ? text.length : 0) / 4);
    },

    // Format elapsed time
    formatTime(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        const mins = Math.floor(ms / 60000);
        const secs = ((ms % 60000) / 1000).toFixed(0);
        return `${mins}m ${secs}s`;
    },

    // Format tokens per second
    formatTPS(tokens, ms) {
        if (ms <= 0) return "0";
        const tps = (tokens / (ms / 1000)).toFixed(1);
        return tps;
    }
};

// Make AppHelpers globally accessible for onclick handlers
window.AppHelpers = AppHelpers;
/**
 * ==========================================
 * PART 6: Agent Loop, Prompt Builder
 *         & Streaming Engine
 * ==========================================
 */

// ==========================================
// 21. PROMPT BUILDER
// ==========================================
const PromptBuilder = {
    /**
     * Build the full prompt for the model using chat history
     * and the new user message. Uses WebLLM's chat format.
     */
    buildMessages(chatHistory, newUserInput) {
        const systemPrompt =
            State.settings.systemPrompt || CONFIG.DEFAULT_SYSTEM_PROMPT;
        const enabledToolsStr = SettingsUI.getEnabledToolsString();

        // Build system message with tools info
        const fullSystemPrompt = `${systemPrompt}\n\n${enabledToolsStr}`;

        const messages = [
            {
                role: "system",
                content: fullSystemPrompt
            }
        ];

        // Add chat history (respecting max history setting)
        const maxPairs = State.settings.maxHistory;
        const historySlice = chatHistory.slice(-maxPairs * 2);

        for (const msg of historySlice) {
            if (msg.role === "user") {
                messages.push({
                    role: "user",
                    content: msg.content
                });
            } else if (msg.role === "assistant") {
                // Strip raw tool calls from history for clean context
                const cleanContent = ToolSystem.stripToolCall(msg.content);
                if (cleanContent) {
                    messages.push({
                        role: "assistant",
                        content: cleanContent
                    });
                }
            }
        }

        // Add the new user input
        if (newUserInput) {
            messages.push({
                role: "user",
                content: newUserInput
            });
        }

        return messages;
    },

    /**
     * Build continuation messages after a tool has been executed.
     * Appends the assistant's tool call, a system observation,
     * and re-opens for assistant response.
     */
    buildToolContinuationMessages(
        previousMessages,
        rawToolCallText,
        observationText
    ) {
        // Clone to avoid mutating original
        const messages = [...previousMessages];

        // Add the assistant's raw tool call as its message
        messages.push({
            role: "assistant",
            content: rawToolCallText.trim()
        });

        // Add the observation as a system message
        messages.push({
            role: "system",
            content: `Observation: ${observationText}`
        });

        // The model will generate the next assistant response
        return messages;
    }
};

// ==========================================
// 22. STREAMING TOKEN COUNTER
// ==========================================
const TokenCounter = {
    _charCount: 0,
    _startTime: 0,

    reset() {
        this._charCount = 0;
        this._startTime = performance.now();
    },

    add(text) {
        this._charCount += text.length;
    },

    getStats() {
        const elapsed = performance.now() - this._startTime;
        const estimatedTokens = Math.ceil(this._charCount / 4);
        const tps = elapsed > 0
            ? (estimatedTokens / (elapsed / 1000)).toFixed(1)
            : "0";
        return {
            chars: this._charCount,
            estimatedTokens,
            elapsedMs: elapsed,
            tps,
            elapsedFormatted: AppHelpers.formatTime(elapsed)
        };
    }
};

// ==========================================
// 23. THE AGENT CORE
// ==========================================
const Agent = {
    /**
     * Handle send button click or Enter key
     * @param {string} [overrideText] - Optional text to send (for regenerate)
     * @param {boolean} [isRegenerate] - Whether this is a regeneration
     */
    async handleSend(overrideText, isRegenerate = false) {
        // If generating, treat as stop
        if (State.isGenerating) {
            State.stopGenerationFlag = true;
            UIController.setGeneratingState(false);
            Toast.show("Stopped generation.");
            return;
        }

        const text = (overrideText || DOM.inputText.value).trim();
        if (!text || !State.isReady) return;

        // If regenerating, don't clear input or create user msg
        if (!isRegenerate) {
            DOM.inputText.value = "";
            DOM.inputText.style.height = "auto";
            UIController.createUserMessage(text, true);
        }

        // Start the agent loop
        await this.runLoop(text, 0, isRegenerate);
    },

    /**
     * Main agent loop — handles streaming, tool detection, and tool chaining
     */
    async runLoop(initialUserInput, loopCount, isRegenerate = false) {
        if (loopCount >= CONFIG.MAX_TOOL_LOOPS) {
            console.warn("Max tool loop reached.");
            return;
        }

        // Get current chat history
        let chatHistory = ChatManager.getChatHistory();

        // If regenerating, remove the last assistant message from history
        // (it was already removed from memory by ChatManager.removeLastMessagePair)
        // but we need to use the history WITHOUT it for the prompt
        if (isRegenerate) {
            // History already has the last assistant removed
        }

        // Build initial messages
        let currentMessages = PromptBuilder.buildMessages(
            chatHistory,
            isRegenerate ? initialUserInput : null
        );

        // If not regenerating, the user message is already in history from createUserMessage
        // But we added it again in buildMessages — fix by using history as-is
        if (!isRegenerate) {
            // The user message was added to chatHistory by createUserMessage → addMessage
            // So buildMessages with null newUserInput will include it from history
            currentMessages = PromptBuilder.buildMessages(chatHistory, null);
        }

        // Save the prompt for potential regeneration
        State.lastPromptUsed = JSON.stringify(currentMessages);

        // Setup assistant message UI
        const { msgEl, textEl, statusEl, toolsContainer } =
            UIController.createAssistantMessage("", false);

        if (!textEl) return;

        const statusLabel = statusEl
            ? statusEl.querySelector(".status-label")
            : null;

        UIController.setGeneratingState(true);
        State.stopGenerationFlag = false;

        // Reset token counter
        TokenCounter.reset();

        let rawStreamedText = "";

        // Show thinking status
        if (statusLabel) statusLabel.textContent = "Thinking...";
        if (statusEl) statusEl.classList.remove("hidden");

        try {
            // === STREAMING PHASE ===
            const streamResult = await this._streamResponse(
                currentMessages,
                (partialText) => {
                    rawStreamedText += partialText;
                    TokenCounter.add(partialText);

                    // Don't render raw ACTION text to user
                    if (!ToolSystem.containsToolCall(rawStreamedText)) {
                        UIController.updateAssistantText(
                            textEl,
                            rawStreamedText,
                            true
                        );
                    }
                }
            );

            rawStreamedText = streamResult || rawStreamedText;

            // === POST-STREAMING TOOL CHECK ===
            if (ToolSystem.containsToolCall(rawStreamedText)) {
                const parsedTool = ToolSystem.parseToolCall(rawStreamedText);

                if (parsedTool) {
                    // Update status
                    if (statusLabel)
                        statusLabel.textContent = `Using: ${parsedTool.name}...`;

                    // Clear the raw ACTION text from UI
                    textEl.innerHTML = "";

                    // Render tool UI with placeholder
                    const toolUI = ToolSystem.renderToolUI(
                        toolsContainer,
                        parsedTool.name,
                        parsedTool.args,
                        { text: "Executing...", image: null }
                    );

                    if (toolUI) {
                        toolUI.setStatus("Running...", "running");
                    }

                    UIController.scrollToBottom(true);

                    // Execute the tool
                    const result = await ToolSystem.execute(
                        parsedTool.name,
                        parsedTool.args
                    );

                    // Update tool UI with results
                    if (toolUI) {
                        toolUI.setStatus("Done", "success");
                        toolUI.setResultText(result.text);
                        if (result.image) {
                            toolUI.setResultImage(result.image);
                        }
                        toolUI.expand();
                    }

                    UIController.scrollToBottom(true);

                    // Build continuation messages and recurse
                    if (statusLabel) statusLabel.textContent = "Processing...";

                    const continuationMessages =
                        PromptBuilder.buildToolContinuationMessages(
                            currentMessages,
                            rawStreamedText,
                            result.text
                        );

                    // Recurse with incremented loop counter
                    await this._streamFinalResponse(
                        continuationMessages,
                        textEl,
                        statusEl,
                        toolsContainer,
                        loopCount + 1
                    );
                    return;
                }
            }

            // === FINALIZATION (no tool called) ===
            if (statusEl) statusEl.classList.add("hidden");

            // Final render without cursor
            UIController.finalizeAssistantMessage(textEl, rawStreamedText);
            UIController.scrollToBottom(true);

            // Show generation stats briefly
            this._showGenerationStats();

            // Save to memory
            if (rawStreamedText.trim()) {
                ChatManager.addMessage("assistant", rawStreamedText);
            }

            State.lastRawResponse = rawStreamedText;
        } catch (error) {
            console.error("Agent loop error:", error);
            if (statusEl) statusEl.classList.add("hidden");

            const errorMsg = error.message || "Unknown generation error";
            textEl.innerHTML = `<p style="color:var(--color-error);">Generation Error: ${Security.escapeHTML(errorMsg)}</p>`;
            Toast.error("An error occurred during generation.");
        } finally {
            UIController.setGeneratingState(false);
        }
    },

    /**
     * Stream a response from the model
     * @param {Array} messages - Chat messages array
     * @param {Function} onChunk - Callback for each text chunk
     * @returns {Promise<string>} - Full accumulated text
     */
    async _streamResponse(messages, onChunk) {
        if (!State.engine) {
            throw new Error("Model engine not initialized.");
        }

        let fullText = "";

        try {
            const reply = await State.engine.chat.completions.create({
                messages: messages,
                temperature: State.settings.temperature,
                max_tokens: State.settings.maxTokens,
                top_k: State.settings.topK,
                top_p: State.settings.topP,
                stream: true,
                stream_options: { include_usage: true }
            });

            for await (const chunk of reply) {
                // Check stop flag
                if (State.stopGenerationFlag) {
                    State.stopGenerationFlag = false;
                    break;
                }

                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) {
                    fullText += delta;
                    onChunk(delta);
                }

                // Check finish reason
                const finishReason = chunk.choices?.[0]?.finish_reason;
                if (finishReason && finishReason !== "null") {
                    break;
                }
            }
        } catch (error) {
            // Handle abort errors gracefully
            if (error.name === "AbortError") {
                return fullText;
            }
            throw error;
        }

        return fullText;
    },

    /**
     * Stream the final response after a tool execution (continuation)
     */
    async _streamFinalResponse(
        messages,
        textEl,
        statusEl,
        toolsContainer,
        loopCount
    ) {
        const statusLabel = statusEl
            ? statusEl.querySelector(".status-label")
            : null;

        if (statusLabel) statusLabel.textContent = "Thinking...";
        if (statusEl) statusEl.classList.remove("hidden");

        let rawStreamedText = "";

        try {
            const result = await this._streamResponse(messages, (chunk) => {
                rawStreamedText += chunk;
                TokenCounter.add(chunk);

                if (!ToolSystem.containsToolCall(rawStreamedText)) {
                    UIController.updateAssistantText(
                        textEl,
                        rawStreamedText,
                        true
                    );
                }
            });

            rawStreamedText = result || rawStreamedText;

            // Check for ANOTHER tool call (tool chaining)
            if (
                ToolSystem.containsToolCall(rawStreamedText) &&
                loopCount < CONFIG.MAX_TOOL_LOOPS
            ) {
                const parsedTool = ToolSystem.parseToolCall(rawStreamedText);
                if (parsedTool) {
                    if (statusLabel)
                        statusLabel.textContent = `Using: ${parsedTool.name}...`;
                    textEl.innerHTML = "";

                    const toolUI = ToolSystem.renderToolUI(
                        toolsContainer,
                        parsedTool.name,
                        parsedTool.args,
                        { text: "Executing...", image: null }
                    );

                    if (toolUI) {
                        toolUI.setStatus("Running...", "running");
                    }
                    UIController.scrollToBottom(true);

                    const toolResult = await ToolSystem.execute(
                        parsedTool.name,
                        parsedTool.args
                    );

                    if (toolUI) {
                        toolUI.setStatus("Done", "success");
                        toolUI.setResultText(toolResult.text);
                        if (toolResult.image) toolUI.setResultImage(toolResult.image);
                        toolUI.expand();
                    }
                    UIController.scrollToBottom(true);

                    // Recurse again
                    const nextMessages =
                        PromptBuilder.buildToolContinuationMessages(
                            messages,
                            rawStreamedText,
                            toolResult.text
                        );

                    await this._streamFinalResponse(
                        nextMessages,
                        textEl,
                        statusEl,
                        toolsContainer,
                        loopCount + 1
                    );
                    return;
                }
            }

            // Final render
            if (statusEl) statusEl.classList.add("hidden");
            UIController.finalizeAssistantMessage(textEl, rawStreamedText);
            UIController.scrollToBottom(true);

            this._showGenerationStats();

            if (rawStreamedText.trim()) {
                ChatManager.addMessage("assistant", rawStreamedText);
            }

            State.lastRawResponse = rawStreamedText;
        } catch (error) {
            console.error("Continuation stream error:", error);
            if (statusEl) statusEl.classList.add("hidden");
            textEl.innerHTML = `<p style="color:var(--color-error);">Error: ${Security.escapeHTML(error.message)}</p>`;
        }
    },

    /**
     * Show brief generation stats as a toast
     */
    _showGenerationStats() {
        const stats = TokenCounter.getStats();
        if (stats.estimatedTokens > 10) {
            Toast.show(
                `${stats.estimatedTokens} tokens in ${stats.elapsedFormatted} (~${stats.tps} t/s)`,
                "default",
                2500
            );
        }
    }
};
/**
 * ==========================================
 * PART 7: Keyboard Shortcuts, Advanced
 *         Event Bindings & Final Init
 * ==========================================
 */

// ==========================================
// 24. KEYBOARD SHORTCUTS MANAGER
// ==========================================
const KeyboardShortcuts = {
    _bound: false,

    init() {
        if (this._bound) return;
        this._bound = true;

        document.addEventListener("keydown", (e) => this._handleKeyDown(e));
    },

    _handleKeyDown(e) {
        // Don't trigger shortcuts when typing in form fields (except the main input)
        const active = document.activeElement;
        const isInInput =
            active &&
            (active.tagName === "INPUT" || active.tagName === "TEXTAREA");

        const isMainInput = active === DOM.inputText;

        // Ctrl+Shift+N: New chat (works anywhere)
        if (e.ctrlKey && e.shiftKey && e.key === "N") {
            e.preventDefault();
            ChatManager.createNewChat();
            Toast.show("New chat started.");
            return;
        }

        // Ctrl+Shift+,: Open settings (works anywhere)
        if (e.ctrlKey && e.shiftKey && e.key === ",") {
            e.preventDefault();
            SettingsUI.populateUI();
            Modal.open("settingsModal");
            return;
        }

        // Ctrl+Shift+E: Export current chat
        if (e.ctrlKey && e.shiftKey && e.key === "E") {
            e.preventDefault();
            ExportManager.exportCurrentChat();
            return;
        }

        // Ctrl+Shift+S: Toggle sidebar
        if (e.ctrlKey && e.shiftKey && e.key === "S") {
            e.preventDefault();
            Sidebar.toggle();
            return;
        }

        // If focus is in a modal textarea (system prompt), skip most shortcuts
        if (isInInput && !isMainInput) return;

        // Ctrl+Up: Scroll to top of chat
        if (e.ctrlKey && e.key === "ArrowUp" && !isInInput) {
            e.preventDefault();
            DOM.chatArea.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        // Ctrl+Down: Scroll to bottom of chat
        if (e.ctrlKey && e.key === "ArrowDown" && !isInInput) {
            e.preventDefault();
            DOM.chatArea.scrollTo({
                top: DOM.chatArea.scrollHeight,
                behavior: "smooth"
            });
            return;
        }

        // / key: Focus input (when not already in input)
        if (e.key === "/" && !isInInput) {
            e.preventDefault();
            DOM.inputText.focus();
            return;
        }
    }
};

// ==========================================
// 25. ADVANCED INPUT HANDLING
// ==========================================
const AdvancedInput = {
    _history: [],      // Sent message history for up/down navigation
    _historyIndex: -1,

    init() {
        DOM.inputText.addEventListener("keydown", (e) => {
            // Up arrow: recall previous message
            if (e.key === "ArrowUp" && DOM.inputText.value === "") {
                e.preventDefault();
                this._recallPrevious();
                return;
            }

            // Down arrow: recall next message
            if (e.key === "ArrowDown" && !e.shiftKey) {
                if (this._historyIndex < this._history.length - 1) {
                    e.preventDefault();
                    this._recallNext();
                } else if (this._historyIndex === this._history.length - 1) {
                    // Clear input if at the end
                    DOM.inputText.value = "";
                    this._historyIndex = -1;
                }
                return;
            }
        });

        // Reset history index when user types manually
        DOM.inputText.addEventListener("input", () => {
            if (this._historyIndex !== -1) {
                // User is editing — don't reset if they haven't changed anything
                const current = DOM.inputText.value;
                if (current !== this._history[this._historyIndex]) {
                    this._historyIndex = -1;
                }
            }
        });
    },

    addToHistory(text) {
        if (!text.trim()) return;
        // Don't add duplicates of the last entry
        if (this._history[this._history.length - 1] === text) return;
        this._history.push(text);
        // Keep max 100 entries
        if (this._history.length > 100) {
            this._history.shift();
        }
        this._historyIndex = -1;
    },

    _recallPrevious() {
        if (this._history.length === 0) return;
        if (this._historyIndex === -1) {
            this._historyIndex = this._history.length - 1;
        } else if (this._historyIndex > 0) {
            this._historyIndex--;
        }
        DOM.inputText.value = this._history[this._historyIndex];
        // Move cursor to end
        DOM.inputText.setSelectionRange(
            DOM.inputText.value.length,
            DOM.inputText.value.length
        );
    },

    _recallNext() {
        if (this._historyIndex < this._history.length - 1) {
            this._historyIndex++;
            DOM.inputText.value = this._history[this._historyIndex];
        }
    }
};

// ==========================================
// 26. PERFORMANCE MONITOR
// ==========================================
const PerfMonitor = {
    _frameCount: 0,
    _lastFPSTime: performance.now(),
    _currentFPS: 0,
    _monitoring: false,

    start() {
        if (this._monitoring) return;
        this._monitoring = true;
        this._measureFPS();
    },

    stop() {
        this._monitoring = false;
    },

    _measureFPS() {
        if (!this._monitoring) return;

        this._frameCount++;
        const now = performance.now();
        const elapsed = now - this._lastFPSTime;

        if (elapsed >= 1000) {
            this._currentFPS = Math.round(
                (this._frameCount * 1000) / elapsed
            );
            this._frameCount = 0;
            this._lastFPSTime = now;
        }

        requestAnimationFrame(() => this._measureFPS());
    },

    getFPS() {
        return this._currentFPS;
    }
};

// ==========================================
// 27. CONNECTION STATUS WATCHER
// ==========================================
const ConnectionWatcher = {
    _wasOnline: true,

    init() {
        this._wasOnline = navigator.onLine;

        window.addEventListener("online", () => {
            if (!this._wasOnline) {
                this._wasOnline = true;
                Toast.success("Connection restored.");
            }
        });

        window.addEventListener("offline", () => {
            if (this._wasOnline) {
                this._wasOnline = false;
                Toast.error(
                    "You are offline. Tools requiring internet will not work. The model still runs locally."
                );
            }
        });
    }
};

// ==========================================
// 28. VISIBILITY CHANGE HANDLER
// ==========================================
const VisibilityHandler = {
    init() {
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                // Page is hidden — could pause non-essential tasks
                MathRenderer.flushRenderQueue();
            } else {
                // Page is visible again — render any pending math
                MathRenderer.renderAllInChat();
            }
        });
    }
};

// ==========================================
// 29. BEFORE UNLOAD HANDLER
// ==========================================
const BeforeUnload = {
    init() {
        window.addEventListener("beforeunload", (e) => {
            // Save any pending state
            Storage.saveChats();

            // Only warn if currently generating
            if (State.isGenerating) {
                e.preventDefault();
                e.returnValue = "A response is still being generated. Are you sure you want to leave?";
                return e.returnValue;
            }
        });
    }
};

// ==========================================
// 30. CONTEXT MENU ENHANCEMENT
// ==========================================
const ContextMenu = {
    init() {
        DOM.chatArea.addEventListener("contextmenu", (e) => {
            // Allow default for code blocks (user might want to inspect)
            if (e.target.closest(".code-body")) return;

            // Allow default for links/images
            if (e.target.closest("a") || e.target.closest("img")) return;
        });
    }
};

// ==========================================
// 31. PASTE HANDLER (for images in future)
// ==========================================
const PasteHandler = {
    init() {
        DOM.inputText.addEventListener("paste", (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                // If pasting an image, prevent default and show message
                if (items[i].type.startsWith("image/")) {
                    e.preventDefault();
                    Toast.show(
                        "Image input is not supported yet. The model is text-only.",
                        "default",
                        3000
                    );
                    return;
                }
            }

            // For text paste: limit paste size to prevent huge inputs
            const pastedText = e.clipboardData.getData("text/plain");
            if (pastedText.length > 10000) {
                e.preventDefault();
                const truncated = pastedText.substring(0, 10000);
                document.execCommand("insertText", false, truncated);
                Toast.show(
                    "Pasted text was truncated to 10,000 characters.",
                    "default",
                    2500
                );
            }
        });
    }
};

// ==========================================
// 32. DRAG AND DROP HANDLER
// ==========================================
const DragDrop = {
    init() {
        DOM.inputText.addEventListener("dragover", (e) => {
            e.preventDefault();
            DOM.inputText.parentElement.style.borderColor =
                "var(--color-primary)";
        });

        DOM.inputText.addEventListener("dragleave", () => {
            DOM.inputText.parentElement.style.borderColor = "";
        });

        DOM.inputText.addEventListener("drop", (e) => {
            e.preventDefault();
            DOM.inputText.parentElement.style.borderColor = "";

            const text = e.dataTransfer.getData("text/plain");
            if (text) {
                DOM.inputText.value += text;
                DOM.inputText.dispatchEvent(new Event("input"));
            }
        });
    }
};

// ==========================================
// 33. AUTOSAVE MANAGER
// ==========================================
const AutoSave = {
    _interval: null,
    _INTERVAL_MS: 15000, // Save every 15 seconds

    start() {
        this._interval = setInterval(() => {
            Storage.saveChats();
        }, this._INTERVAL_MS);
    },

    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }
};

// ==========================================
// 34. ENHANCED UI INIT (extends UIController)
// ==========================================
const EnhancedUI = {
    /**
     * Called after base UIController.init() to add advanced features
     */
    init() {
        KeyboardShortcuts.init();
        AdvancedInput.init();
        ConnectionWatcher.init();
        VisibilityHandler.init();
        BeforeUnload.init();
        ContextMenu.init();
        PasteHandler.init();
        DragDrop.init();
        AutoSave.start();
        PerfMonitor.start();

        // Patch Agent.handleSend to track input history
        this._patchAgentSend();

        // Patch createUserMessage to track input history
        this._patchCreateUserMessage();

        console.log(
            `%c✦ Opensky %cv${"1.0.0"} %c| Local AI by ${CONFIG.CREATOR}`,
            "color:#000;font-weight:bold;font-size:14px;",
            "color:#888;font-size:12px;",
            "color:#888;font-size:12px;"
        );
    },

    _patchAgentSend() {
        const originalHandleSend = Agent.handleSend.bind(Agent);
        Agent.handleSend = async function (overrideText, isRegenerate) {
            if (!isRegenerate && !overrideText) {
                AdvancedInput.addToHistory(DOM.inputText.value.trim());
            } else if (overrideText) {
                AdvancedInput.addToHistory(overrideText.trim());
            }
            return originalHandleSend(overrideText, isRegenerate);
        };
    },

    _patchCreateUserMessage() {
        const originalCreate = UIController.createUserMessage.bind(UIController);
        UIController.createUserMessage = function (text, saveToMemory) {
            const result = originalCreate(text, saveToMemory);
            // Ensure math is rendered in any pre-existing content
            if (result) {
                const contentBody = result.querySelector(".content-body");
                if (contentBody) {
                    MathRenderer.queueRender(contentBody);
                }
            }
            return result;
        };
    }
};

// ==========================================
// 35. FINAL INIT HOOK
// ==========================================
// Monkey-patch UIController.init to include EnhancedUI
const _originalUIInit = UIController.init.bind(UIController);
UIController.init = function () {
    _originalUIInit();
    EnhancedUI.init();
};

// ==========================================
// 36. UTILITY: Debounce & Throttle
// ==========================================
const Utils = {
    debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    throttle(fn, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    },

    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    truncate(str, maxLength, suffix = "...") {
        if (!str || str.length <= maxLength) return str || "";
        return str.substring(0, maxLength) + suffix;
    },

    formatNumber(num) {
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
        if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
        return num.toString();
    },

    timeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return "just now";
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800)
            return `${Math.floor(seconds / 86400)}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }
};

// ==========================================
// 37. GLOBAL ERROR HANDLER
// ==========================================
window.addEventListener("error", (event) => {
    // Don't spam console for known non-critical errors
    if (event.message?.includes("ResizeObserver")) return;
    if (event.message?.includes("Non-Error promise rejection")) return;

    console.error("Global error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled rejection:", event.reason);

    // If it's a model generation error, show a toast
    if (
        event.reason?.message?.includes("generate") ||
        event.reason?.message?.includes("engine") ||
        event.reason?.message?.includes("WebGPU")
    ) {
        Toast.error("Model error: " + event.reason.message, 5000);
    }
});

// ==========================================
// 38. SERVICE WORKER REGISTRATION (Optional)
// ==========================================
// Uncomment below to enable service worker for offline model caching
/*
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // WebLLM handles its own caching via Cache API
            // A custom service worker could be added here for the HTML/CSS/JS
        } catch (e) {
            console.warn('Service worker registration failed:', e);
        }
    });
}
*/

// ==========================================
// END OF JAVASCRIPT
// ==========================================
