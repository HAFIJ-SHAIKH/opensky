import * as webllm from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/lib/module.min.js";

// ==========================================
// 1. EMBEDDED CONFIGURATION
// ==========================================
const OPENSKY_CONFIG = {
    "agent_name": "Opensky",
    "author": "Hafij Shaikh",
    // Using a specific stable model ID for guaranteed download
    "primary_model": "Llama-3.1-8B-Instruct-q4f16_1-MLC", 
    "storage_policy": "persistent_indexeddb",
    "version": "3.2.0"
};

// ==========================================
// 2. AGENT LOGIC (Enhanced Personality)
// ==========================================
class Planner {
    constructor(goal) {
        this.goal = goal;
        this.steps = [];
    }
    decompose() {
        console.log(`[Opensky Brain] Planning roadmap for: ${this.goal}`);
        // More granular planning
        if (this.goal.toLowerCase().includes("code")) {
            this.steps = ["Analyze Code Structure", "Draft Syntax", "Verify Correctness"];
        } else if (this.goal.toLowerCase().includes("hello") || this.goal.toLowerCase().length < 5) {
            this.steps = ["Greet User", "Offer Assistance"];
        } else {
            this.steps = ["Analyze Query Intent", "Retrieve Knowledge", "Formulate Response"];
        }
        return {
            log: `[Strategy] Steps: ${this.steps.join(" -> ")}`,
            plan: this.steps
        };
    }
}

class Agent {
    constructor(config) {
        this.Name = config.agent_name;
        this.Author = config.author;
        this.Personality = "helpful, precise, and slightly futuristic";
    }
    
    // Generates the system prompt dynamically
    getSystemPrompt(plan) {
        return `You are ${this.Name}, a highly advanced AI agent created by ${this.Author}.
Your current operational mode is: '${this.Personality}'.
Your internal logic has devised the following plan for the user's query:
[PLAN START]
 ${plan.join("\n -> ")}
[PLAN END]

Follow this plan strictly to answer the user. Be concise and format code blocks clearly.`;
    }

    process(query) {
        const msg = `[${this.Name} Core]: Reasoning applied to "${query}"`;
        console.log(msg);
        return { status: "processed", log: msg };
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
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const thinkingPanel = document.getElementById('thinkingPanel');
const thinkingContent = document.getElementById('thinkingContent');

// Check for WebGPU support
async function checkWebGPU() {
    // Update UI to show we are checking
    loadingLabel.textContent = "Checking WebGPU support...";
    
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported. Please use Chrome 113+ or Edge 113+.");
    }
    
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("No appropriate GPUAdapter found. Your GPU might be blacklisted.");
    }
    
    loadingLabel.textContent = "WebGPU initialized successfully.";
}

// Initialize Engine - FIXED FOR DOWNLOAD VISIBILITY
async function initEngine() {
    try {
        await checkWebGPU();
        
        loadingLabel.textContent = `Preparing to download ${OPENSKY_CONFIG.primary_model}...`;
        
        // Create the engine with progress reporting
        engine = await webllm.CreateMLCEngine(
            OPENSKY_CONFIG.primary_model, 
            {
                initProgressCallback: (report) => {
                    // UPDATE UI WITH DOWNLOAD PROGRESS
                    // report.progress is 0.0 to 1.0
                    const percent = Math.round(report.progress * 100);
                    
                    sliderFill.style.width = `${percent}%`;
                    loadingPercent.textContent = `${percent}%`;
                    
                    // Show detailed text (e.g., "Downloading model.shard...")
                    loadingLabel.textContent = report.text;
                    
                    console.log(`[WebLLM] ${report.text} (${percent}%)`);
                }
            }
        );
        
        // Success
        loadingLabel.textContent = "Model loaded successfully!";
        finishLoading();
        
    } catch (e) {
        // CATCH ERRORS AND SHOW THEM ON SCREEN
        console.error(e);
        loadingLabel.textContent = `Error: ${e.message}`;
        loadingLabel.style.color = "red";
        loadingPercent.textContent = "Failed";
        sliderFill.style.backgroundColor = "red";
    }
}

// Agent Loop
async function runAgentLoop(userQuery) {
    showThinking(true);
    updateThinking("Initializing cognitive cycle...");

    // 1. Planner
    const planner = new Planner(userQuery);
    const planData = planner.decompose();
    updateThinking(planData.log);

    // 2. Agent Logic
    const agentData = agent.process(userQuery);
    updateThinking(`${planData.log}\n${agentData.log}`);

    // 3. LLM Generation
    try {
        // DYNAMIC SYSTEM PROMPT BASED ON PLAN
        const systemPrompt = agent.getSystemPrompt(planData.plan);

        const completion = await engine.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
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
                // Basic streaming text append (formatting at end is safer for performance)
                contentWrapper.innerHTML = parseMarkdown(fullResponse);
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
        }

    } catch (err) {
        showThinking(false);
        appendMessage("sky", `Error: ${err.message}`);
        console.error(err);
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

// --- Security Safe Markdown Parser ---
function parseMarkdown(text) {
    if (!text) return "";
    // Escape HTML first to prevent XSS
    let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Code Blocks
    escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'code';
        const cleanCode = code.trim();
        // Safer rendering - no inline onclick
        return `
            <div class="code-block">
                <div class="block-header">
                    <span class="block-label">${language}</span>
                    <button class="copy-btn">Copy</button>
                </div>
                <div class="block-body"><pre>${cleanCode}</pre></div>
            </div>`;
    });
    
    // Basic Line Breaks
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
}

// Copy listener (safer method)
messagesArea.addEventListener('click', (e) => {
    if (e.target.closest('.copy-btn')) {
        const btn = e.target.closest('.copy-btn');
        const codeBlock = btn.closest('.code-block');
        const code = codeBlock.querySelector('pre').textContent;
        
        navigator.clipboard.writeText(code).then(() => {
            btn.classList.add('copied');
            const span = btn.querySelector('span') || btn; // Handle if svg is clicked
            const orig = btn.textContent;
            btn.textContent = 'Done';
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.textContent = 'Copy';
            }, 1200);
        });
    }
});

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
