// ==========================================
// 1. GLOBALS & UI HELPERS
// ==========================================
let engine = null;
let isGenerating = false;

// UI Elements
const loadingScreen = document.getElementById('loadingScreen');
const chatContainer = document.getElementById('chatContainer');
const messagesArea = document.getElementById('messagesArea');
const inputText = document.getElementById('inputText');
const sendBtn = document.getElementById('sendBtn');
const sliderFill = document.getElementById('sliderFill');
const loadingPercent = document.getElementById('loadingPercent');
const loadingLabel = document.getElementById('loadingLabel');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const thinkingPanel = document.getElementById('thinkingPanel');
const thinkingContent = document.getElementById('thinkingContent');

// Helper to safely update Loading UI
function setStatusText(text, percent = null) {
    if (loadingLabel) loadingLabel.textContent = text;
    if (percent !== null) {
        if (loadingPercent) loadingPercent.textContent = `${percent}%`;
        if (sliderFill) sliderFill.style.width = `${percent}%`;
    }
    console.log(`[Status] ${text}`);
}

// ==========================================
// 2. DYNAMIC IMPORT (CATCHES CDN FAILURES)
// ==========================================
async function loadDependencies() {
    try {
        setStatusText("Connecting to AI Network...", 5);
        
        // Dynamic import allows us to catch network errors
        const webllm = await import("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/lib/module.min.js");
        
        setStatusText("AI Module Loaded.", 10);
        return webllm;
    } catch (err) {
        setStatusText("❌ Network Error: Could not load AI engine.", 0);
        console.error(err);
        throw err;
    }
}

// ==========================================
// 3. MAIN INITIALIZATION
// ==========================================
async function initEngine() {
    let webllm;
    try {
        // 1. Load the library
        webllm = await loadDependencies();

        // 2. Check WebGPU
        setStatusText("Checking WebGPU Support...", 15);
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported. Please use Chrome v113+ (Android/Desktop).");
        }

        // 3. Initialize Engine & DOWNLOAD MODEL
        setStatusText("Starting Download...", 20);
        
        // Use a smaller model for better mobile support
        const selectedModel = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

        engine = await webllm.CreateMLCEngine(selectedModel, {
            initProgressCallback: (report) => {
                // THIS IS THE DOWNLOAD PROGRESS
                let percent = Math.round(report.progress * 100);
                setStatusText(report.text, percent);
            }
        });

        // 4. Success
        setStatusText("Model Ready!", 100);
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            chatContainer.style.display = 'flex';
            inputText.focus();
            setOnlineStatus(true);
        }, 500);

    } catch (e) {
        console.error(e);
        setStatusText(`❌ Error: ${e.message}`, 0);
        loadingLabel.style.color = "red";
    }
}

// ==========================================
// 4. AGENT LOGIC
// ==========================================
class Planner {
    constructor(goal) { this.goal = goal; }
    decompose() {
        if (this.goal.toLowerCase().includes("code")) return ["Analyze", "Code", "Verify"];
        return ["Understand", "Answer"];
    }
}

class Agent {
    constructor(config) { this.Name = config.agent_name; this.Author = config.author; }
    getSystemPrompt(plan) { return `You are ${this.Name}. Follow plan: ${plan.join(" -> ")}.`; }
}

const agent = new Agent({ agent_name: "Opensky", author: "Hafij Shaikh" });

async function runAgentLoop(userQuery) {
    thinkingPanel.style.display = 'block';
    thinkingContent.textContent = "Thinking...";

    const planner = new Planner(userQuery);
    const plan = planner.decompose();
    thinkingContent.textContent = `Plan: ${plan.join(" -> ")}`;

    try {
        const completion = await engine.chat.completions.create({
            messages: [
                { role: "system", content: agent.getSystemPrompt(plan) },
                { role: "user", content: userQuery }
            ],
            temperature: 0.7,
            stream: true,
        });

        thinkingPanel.style.display = 'none';
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message sky';
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'sky-content';
        msgDiv.appendChild(contentWrapper);
        messagesArea.appendChild(msgDiv);

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
        thinkingPanel.style.display = 'none';
        appendMessage("sky", `Error: ${err.message}`);
    } finally {
        isGenerating = false;
        setOnlineStatus(true);
    }
}

// ==========================================
// 5. UI HELPERS
// ==========================================
function setOnlineStatus(isOnline) {
    sendBtn.disabled = !isOnline;
    statusDot.className = isOnline ? 'status-dot' : 'status-dot loading';
    statusText.textContent = isOnline ? 'Agent Ready' : 'Processing...';
    statusText.className = isOnline ? 'status-text online' : 'status-text loading';
}

function parseMarkdown(text) {
    if (!text) return "";
    let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => 
        `<div class="code-block"><div class="block-header"><span class="block-label">${lang || 'code'}</span><button class="copy-btn">Copy</button></div><div class="block-body"><pre>${code.trim()}</pre></div></div>`
    );
    return escaped.replace(/\n/g, '<br>');
}

messagesArea.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-btn')) {
        const code = e.target.closest('.code-block').querySelector('pre').textContent;
        navigator.clipboard.writeText(code);
        e.target.textContent = 'Done';
        setTimeout(() => e.target.textContent = 'Copy', 1000);
    }
});

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role === 'user' ? 'user' : 'sky'}`;
    const bubble = document.createElement('div');
    bubble.className = role === 'user' ? 'user-bubble' : 'sky-content';
    bubble.innerHTML = role === 'user' ? text : parseMarkdown(text);
    div.appendChild(bubble);
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

async function sendMessage() {
    const text = inputText.value.trim();
    if (!text || isGenerating) return;
    
    appendMessage("user", text);
    inputText.value = '';
    inputText.style.height = 'auto';
    
    setOnlineStatus(false);
    isGenerating = true;
    await runAgentLoop(text);
}

inputText.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 100) + 'px'; });
inputText.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
sendBtn.addEventListener('click', sendMessage);

// --- START ---
initEngine();
