import * as webllm from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/lib/module.min.js";

// ==========================================
// 1. EMBEDDED CONFIGURATION (No Downloads)
// ==========================================
const OPENSKY_CONFIG = {
    "agent_name": "opensky",
    "author": "Hafij Shaikh",
    "primary_model": "Llama-3.1-8B-Instruct-q4f16_1-MLC",
    "storage_policy": "persistent_indexeddb",
    "version": "3.2.0-Llama-Specialist"
};

// ==========================================
// 2. AGENT LOGIC (Translated from Go)
// ==========================================

// Translated from opensky_planner.go
class Planner {
    constructor(goal) {
        this.goal = goal;
        this.steps = [];
    }

    decompose() {
        // Simulate the logic from your Go file
        console.log(`[opensky Brain] Planning roadmap for: ${this.goal}`);
        
        // Basic heuristic planning
        if (this.goal.toLowerCase().includes("code")) {
            this.steps = ["Analyze Code Request", "Generate Syntax", "Verify Logic"];
        } else {
            this.steps = ["Understand Intent", "Formulate Answer", "Stream Response"];
        }
        
        return {
            log: `[opensky Brain] Planning roadmap for: ${this.goal}`,
            plan: this.steps
        };
    }
}

// Translated from opensky_advanced.go
class Agent {
    constructor(config) {
        this.Name = config.agent_name;
        this.Author = config.author;
    }

    process(query) {
        // Simulate the logic from your Go file
        const msg = `[${this.Name} Smart Engine]: Multi-threaded reasoning applied to "${query}"`;
        console.log(msg);
        return {
            status: "processed",
            log: msg
        };
    }
}

// ==========================================
// 3. MAIN APPLICATION
// ==========================================
let engine = null;
let agent = new Agent(OPENSKY_CONFIG);
let isGenerating = false;

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const chatContainer = document.getElementById('chatContainer');
const messagesArea = document.getElementById('messagesArea');
const inputText = document.getElementById('inputText');
const sendBtn = document.getElementById('sendBtn');
const sliderFill = document.getElementById('sliderFill');
const loadingPercent = document.getElementById('loadingPercent');
const loadingLabel = document.getElementById('loadingLabel');
const loadingVersion = document.getElementById('loadingVersion');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const thinkingPanel = document.getElementById('thinkingPanel');
const thinkingContent = document.getElementById('thinkingContent');

// Check for WebGPU support
async function checkWebGPU() {
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported. Please use Chrome 113+ or Edge 113+.");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("No appropriate GPUAdapter found.");
    }
}

// Initialize Engine
async function initEngine() {
    loadingVersion.textContent = `Version: ${OPENSKY_CONFIG.version}`;
    
    try {
        await checkWebGPU();
        
        engine = new webllm.MLCEngine();
        
        engine.setInitProgressCallback((report) => {
            const percent = Math.round(report.progress * 100);
            sliderFill.style.width = `${percent}%`;
            loadingPercent.textContent = `${percent}%`;
            loadingLabel.textContent = report.text;
        });

        // Only downloads the MODEL, not the config files
        await engine.reload(OPENSKY_CONFIG.primary_model);
        
        finishLoading();
    } catch (e) {
        loadingLabel.textContent = `Error: ${e.message}`;
        loadingLabel.style.color = "red";
        console.error(e);
    }
}

// Agent Loop
async function runAgentLoop(userQuery) {
    showThinking(true);
    
    // 1. Run Planner (from opensky_planner.go)
    const planner = new Planner(userQuery);
    const planData = planner.decompose();
    updateThinking(planData.log);

    // 2. Run Agent Processing (from opensky_advanced.go)
    const agentData = agent.process(userQuery);
    updateThinking(`${planData.log}\n${agentData.log}`);

    // 3. Run LLM Inference
    try {
        const completion = await engine.chat.completions.create({
            messages: [
                { role: "system", content: `You are ${agent.Name}, created by ${agent.Author}.` },
                { role: "user", content: userQuery }
            ],
            temperature: 0.7,
            stream: true,
        });

        showThinking(false);
        
        const skyMsg = createMessage("", false);
        messagesArea.appendChild(skyMsg);
        const contentWrapper = skyMsg.querySelector('.sky-content');

        let fullResponse = "";
        for await (const chunk of completion) {
            const delta = chunk.choices[0].delta.content;
            if (delta) {
                fullResponse += delta;
                contentWrapper.innerHTML = parseMarkdown(fullResponse);
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
        }

    } catch (err) {
        showThinking(false);
        appendMessage("sky", `Error: ${err.message}`);
    } finally {
        isGenerating = false;
        setStatus('online');
    }
}

// --- UI Helpers ---

function showThinking(show) {
    thinkingPanel.style.display = show ? 'block' : 'none';
}

function updateThinking(text) {
    thinkingContent.textContent = text;
}

function finishLoading() {
    loadingScreen.classList.add('hidden');
    chatContainer.style.display = 'flex';
    inputText.focus();
    setStatus('online');
}

function setStatus(status) {
    if (status === 'online') {
        statusDot.className = 'status-dot';
        statusText.className = 'status-text online';
        statusText.textContent = 'Agent Ready';
        sendBtn.disabled = false;
    } else if (status === 'generating') {
        statusDot.className = 'status-dot loading';
        statusText.className = 'status-text loading';
        statusText.textContent = 'Processing...';
        sendBtn.disabled = true;
    }
}

function createMessage(content, isUser) {
    const div = document.createElement('div');
    div.className = `message ${isUser ? 'user' : 'sky'}`;
    
    if (isUser) {
        const bubble = document.createElement('div');
        bubble.className = 'user-bubble';
        bubble.textContent = content;
        div.appendChild(bubble);
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'sky-content';
        wrapper.innerHTML = parseMarkdown(content);
        div.appendChild(wrapper);
    }
    return div;
}

function appendMessage(role, text) {
    const msg = createMessage(text, role === 'user');
    messagesArea.appendChild(msg);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function parseMarkdown(text) {
    if (!text) return "";
    let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'code';
        const cleanCode = code.trim();
        return `
            <div class="code-block">
                <div class="block-header">
                    <span class="block-label">${language}</span>
                    <button class="copy-btn" onclick="copyCode(this, encodeURIComponent(\`${cleanCode.replace(/`/g, '\\`')}\`))">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        <span>Copy</span>
                    </button>
                </div>
                <div class="block-body"><pre>${cleanCode}</pre></div>
            </div>`;
    });
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
}

window.copyCode = (btn, encodedText) => {
    const text = decodeURIComponent(encodedText);
    navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        const span = btn.querySelector('span');
        const orig = span.textContent;
        span.textContent = 'Done';
        setTimeout(() => {
            btn.classList.remove('copied');
            span.textContent = orig;
        }, 1200);
    });
};

function clearWelcome() {
    const welcome = messagesArea.querySelector('.welcome');
    if (welcome) welcome.remove();
}

// --- Send Logic ---

async function sendMessage() {
    const text = inputText.value.trim();
    if (!text || isGenerating) return;

    clearWelcome();
    appendMessage("user", text);
    inputText.value = '';
    inputText.style.height = 'auto';
    
    setStatus('generating');
    isGenerating = true;
    
    await runAgentLoop(text);
}

window.useSuggestion = (text) => {
    inputText.value = text;
    sendMessage();
};

// --- Events ---
inputText.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    sendBtn.disabled = !this.value.trim() || isGenerating;
});

inputText.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

// --- Start ---
initEngine();
