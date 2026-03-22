import * as webllm from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/lib/module.min.js";

// ==========================================
// 1. SANITY CHECKS
// ==========================================
// CHECK 1: Are you opening the file correctly?
if (window.location.protocol === 'file:') {
    alert("⚠️ ERROR: You are opening this file directly.\n\nYou must use a Local Server (like VS Code Live Server) for the download to work.");
    document.body.innerHTML = "<div style='padding: 20px; color: red; font-family: sans-serif;'><h1>Stop!</h1><p>You cannot open the HTML file directly.</p><p>Please use VS Code 'Live Server' or run a local python server.</p></div>";
    throw new Error("File protocol blocked.");
}

console.log("--- SCRIPT STARTED ---");

// ==========================================
// 2. CONFIGURATION
// ==========================================
const OPENSKY_CONFIG = {
    "agent_name": "Opensky",
    "author": "Hafij Shaikh",
    // Using a smaller, faster model to ensure download starts quickly
    "primary_model": "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", 
    "storage_policy": "persistent_indexeddb",
    "version": "3.2.1"
};

// ==========================================
// 3. UI ELEMENTS
// ==========================================
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

// ==========================================
// 4. CORE LOGIC
// ==========================================
let engine = null;
let isGenerating = false;

function updateLoadingUI(text, percent = 0) {
    loadingLabel.textContent = text;
    loadingPercent.textContent = `${percent}%`;
    sliderFill.style.width = `${percent}%`;
    console.log(`[Progress] ${text} - ${percent}%`);
}

async function initEngine() {
    try {
        updateLoadingUI("Checking WebGPU...", 0);

        // CHECK 2: Does the browser support WebGPU?
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported. Use Chrome v113+ or Edge v113+.");
        }

        updateLoadingUI("Requesting GPU Adapter...", 5);
        
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("GPU Adapter is null. Hardware might be unsupported.");
        }

        updateLoadingUI("Adapter found. Initializing WebLLM...", 10);

        // CHECK 3: Initialize Engine with Logging
        engine = await webllm.CreateMLCEngine(
            OPENSKY_CONFIG.primary_model, 
            {
                initProgressCallback: (report) => {
                    // This function triggers the download
                    let percent = Math.round(report.progress * 100);
                    updateLoadingUI(report.text, percent);
                }
            }
        );

        // SUCCESS
        updateLoadingUI("Ready!", 100);
        loadingScreen.classList.add('hidden');
        chatContainer.style.display = 'flex';
        inputText.focus();
        setStatus('online');

    } catch (e) {
        console.error(e);
        loadingLabel.textContent = `Error: ${e.message}`;
        loadingLabel.style.color = "red";
        sliderFill.style.backgroundColor = "red";
    }
}

// ==========================================
// 5. AGENT LOGIC
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

const agent = new Agent(OPENSKY_CONFIG);

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
        setStatus('online');
    }
}

// ==========================================
// 6. HELPERS
// ==========================================
function setStatus(status) {
    sendBtn.disabled = status !== 'online';
    statusText.textContent = status === 'online' ? 'Agent Ready' : 'Processing...';
    statusText.className = `status-text ${status}`;
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
    
    setStatus('generating');
    isGenerating = true;
    await runAgentLoop(text);
}

inputText.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 100) + 'px'; });
inputText.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
sendBtn.addEventListener('click', sendMessage);

// --- START ---
initEngine();
