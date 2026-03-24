// ==========================================
// 1. LIBRARY IMPORT
// ==========================================
import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// ==========================================
// 2. CONFIGURATION
// ==========================================
const OPENSKY_CONFIG = {
    "agent_name": "Opensky",
    "creator": "Hafij Shaikh",
    "version": "9.0.0" // Dual-Core Router Edition
};

// --- THE SMALL LLM AGENT (ROUTER) ---
// This prompt is designed for a very small model (0.5B)
const ROUTER_PROMPT = `You are a Router. Classify the user input.
If the input is a greeting (hi, hello), casual chat, or simple question, reply: CHAT
If the input is a task, code request, math, complex analysis, or planning, reply: TASK
Reply with ONLY one word.`;

// --- THE MAIN EXECUTOR PROMPTS ---
// Used if Router says "CHAT"
const CHAT_PROMPT = `You are ${OPENSKY_CONFIG.agent_name}. You are concise and friendly. Answer the user directly. Do not use headers or complex formatting.`;

// Used if Router says "TASK"
const TASK_PROMPT = `You are ${OPENSKY_CONFIG.agent_name}, an autonomous agent.
I. THE COGNITIVE GATE: Efficiency Logic.
II. FULL AUTONOMOUS MODE:
[Analysis]: Brief breakdown.
[Execution]: The code or strategy.
[Auto-Resolved]: Issues you fixed.
[Next Steps]: What happens next.
III. CONSTRAINTS: No fluff. No apologies.`;

const MODELS = {
  // Small Model for Routing (Fast, Low Memory)
  router: {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", 
    name: "Router Agent",
    role: "Classifier",
    systemPrompt: ROUTER_PROMPT
  },
  // Main Model for Execution (Smart)
  executor: {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Executor Core",
    role: "Logic",
    systemPrompt: "" // Dynamic
  }
};

// ==========================================
// 3. DOM ELEMENTS
// ==========================================
const loadingScreen = document.getElementById('loadingScreen');
const chatContainer = document.getElementById('chatContainer');
const messagesArea = document.getElementById('messagesArea');
const inputText = document.getElementById('inputText');
const sendBtn = document.getElementById('sendBtn');
const sliderFill = document.getElementById('sliderFill');
const loadingPercent = document.getElementById('loadingPercent');
const loadingLabel = document.getElementById('loadingLabel');
const modelStatusContainer = document.getElementById('modelStatusContainer');
const debugLog = document.getElementById('debugLog');
const uploadBtn = document.getElementById('uploadBtn');
const imageInput = document.getElementById('imageInput');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');

let routerEngine = null;
let executorEngine = null; 
let isGenerating = false;
let currentImageBase64 = null; 

// ==========================================
// DEBUG HELPER
// ==========================================
function showError(title, err) {
    console.error(err);
    debugLog.style.display = 'block';
    debugLog.innerHTML = `<strong>${title}:</strong><br>${err.message || err}`;
    loadingPercent.textContent = "Error";
    loadingLabel.textContent = title;
}

// ==========================================
// 4. INITIALIZATION
// ==========================================
async function init() {
    try {
        loadingLabel.textContent = "Checking WebGPU...";
        if (!navigator.gpu) throw new Error("WebGPU not supported.");

        modelStatusContainer.innerHTML = `
          <div class="model-card" id="card-router">
            <div class="model-card-name">${MODELS.router.name}</div>
            <div class="model-card-desc">Pending...</div>
          </div>
          <div class="model-card" id="card-executor">
            <div class="model-card-name">${MODELS.executor.name}</div>
            <div class="model-card-desc">Pending...</div>
          </div>
        `;

        // 1. Load Router (Small)
        loadingLabel.textContent = "Loading Router (0.5B)...";
        routerEngine = await webllm.CreateMLCEngine(MODELS.router.id, {
            initProgressCallback: (report) => updateModelUI('card-router', report, 0)
        });

        // 2. Load Executor (Main)
        loadingLabel.textContent = "Loading Executor (1.5B)...";
        executorEngine = await webllm.CreateMLCEngine(MODELS.executor.id, {
            initProgressCallback: (report) => updateModelUI('card-executor', report, 50)
        });

        loadingLabel.textContent = "Dual-Core Ready.";
        
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            chatContainer.classList.add('active');
            sendBtn.disabled = false;
        }, 500);

    } catch (err) {
        showError("Initialization Failed", err);
    }
}

function updateModelUI(cardId, report, basePercent) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const percent = Math.round(report.progress * 100);
  card.querySelector('.model-card-desc').textContent = report.text;
  sliderFill.style.width = `${basePercent + Math.round(percent / 2)}%`;
  loadingPercent.textContent = `${basePercent + Math.round(percent / 2)}%`;
}

// ==========================================
// 5. DUAL-CORE LOGIC
// ==========================================
async function runAgentLoop(query, hasImage) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message assistant';

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'assistant-content';
  msgDiv.appendChild(contentWrapper);

  messagesArea.appendChild(msgDiv);
  scrollToBottom();

  try {
    // --- STEP 1: ROUTER DECISION ---
    // We ask the small model to classify
    const routerMessages = [
      { role: "system", content: ROUTER_PROMPT },
      { role: "user", content: query }
    ];

    // Fast, non-streaming call to Router
    const routerResponse = await routerEngine.chat.completions.create({
      messages: routerMessages,
      temperature: 0.1,
      max_tokens: 5 // We only need 1 word
    });
    
    const decision = routerResponse.choices[0].message.content.trim().toUpperCase();
    const isTask = decision.includes("TASK");

    // --- STEP 2: EXECUTOR ACTION ---
    
    // UI: Show Routing Decision
    const badge = document.createElement('div');
    badge.className = 'routing-badge';
    badge.textContent = isTask ? "MODE: AUTONOMOUS TASK" : "MODE: CONVERSATION";
    contentWrapper.appendChild(badge);

    const textDiv = document.createElement('div');
    contentWrapper.appendChild(textDiv);

    // Select System Prompt based on Router
    const systemPrompt = isTask ? TASK_PROMPT : CHAT_PROMPT;
    
    const executorMessages = [
      { role: "system", content: systemPrompt }
    ];

    if (hasImage) {
        // If image, force Task mode logic usually, or handle gracefully
        executorMessages.push({ 
            role: "user", 
            content: `[Image Context] ${query}` 
        });
    } else {
        executorMessages.push({ role: "user", content: query });
    }

    const completion = await executorEngine.chat.completions.create({
      messages: executorMessages,
      temperature: 0.7,
      stream: true,
    });

    let fullResponse = "";
    
    for await (const chunk of completion) {
      if (!isGenerating) break;
      const delta = chunk.choices[0].delta.content;
      if (delta) {
        fullResponse += delta;
        // Use existing parsing logic
        if (isTask) {
            parseTier2Response(fullResponse, null, textDiv);
        } else {
            parseTier1Response(fullResponse, textDiv);
        }
        scrollToBottom();
      }
    }
    
  } catch (e) {
    contentWrapper.innerHTML += `<span style="color:red">Error: ${e.message}</span>`;
  } finally {
    isGenerating = false;
    sendBtn.classList.remove('stop-btn');
    sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
  }
}

// ==========================================
// 6. PARSING LOGIC
// ==========================================
function parseTier1Response(text, container) {
  let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<div class="code-block"><div class="code-header"><span>${lang||'code'}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><div class="code-body"><pre>${code}</pre></div></div>`;
  });
  container.innerHTML = escaped.replace(/\n/g, '<br>');
}

function parseTier2Response(text, accordionBody, textContainer) {
    const parts = { analysis: "", execution: "", resolved: "", next: "" };
    const analysisMatch = text.match(/\[Analysis\]:?([\s\S]*?)(?=\[Execution\]|\[Auto-Resolved\]|\[Next Steps\]|$)/i);
    const executionMatch = text.match(/\[Execution\]:?([\s\S]*?)(?=\[Auto-Resolved\]|\[Next Steps\]|$)/i);
    const resolvedMatch = text.match(/\[Auto-Resolved\]:?([\s\S]*?)(?=\[Next Steps\]|$)/i);
    const nextMatch = text.match(/\[Next Steps\]:?([\s\S]*?)$/i);

    if (analysisMatch) parts.analysis = analysisMatch[1].trim();
    if (executionMatch) parts.execution = executionMatch[1].trim();
    if (resolvedMatch) parts.resolved = resolvedMatch[1].trim();
    if (nextMatch) parts.next = nextMatch[1].trim();

    let mainHTML = "";
    if (parts.execution) {
        mainHTML += `<span class="tag-header tag-execution">[Execution]</span>`;
        mainHTML += parseInlineCodeAndText(parts.execution);
    }
    if (parts.resolved) {
        mainHTML += `<span class="tag-header tag-resolved">[Auto-Resolved]</span>`;
        mainHTML += `<div style="background:#fffbeb; padding:0.5rem; border-radius:4px; margin-bottom:0.5rem; font-size:0.85rem;">${parts.resolved.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>')}</div>`;
    }
    if (parts.next) {
        mainHTML += `<span class="tag-header tag-next">[Next Steps]</span>`;
        mainHTML += `<div style="color:#3b82f6; font-size:0.85rem;">${parts.next.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>')}</div>`;
    }

    textContainer.innerHTML = mainHTML;
}

function parseInlineCodeAndText(text) {
  let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<div class="code-block"><div class="code-header"><span>${lang||'code'}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><div class="code-body"><pre>${code}</pre></div></div>`;
  });
  return escaped.replace(/\n/g, '<br>');
}

// ==========================================
// 7. EVENTS
// ==========================================
window.copyCode = function(btn) {
    const code = btn.closest('.code-block').querySelector('pre').textContent;
    navigator.clipboard.writeText(code);
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = 'Copy', 1000);
};

function scrollToBottom() { messagesArea.scrollTop = messagesArea.scrollHeight; }

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        currentImageBase64 = ev.target.result.split(',')[1];
        imagePreview.src = ev.target.result;
        imagePreviewContainer.classList.add('active');
    };
    reader.readAsDataURL(file);
}

removeImageBtn.addEventListener('click', () => {
    currentImageBase64 = null;
    imagePreviewContainer.classList.remove('active');
    imageInput.value = '';
});

uploadBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', handleImageUpload);

async function handleAction() {
  if (isGenerating) {
    isGenerating = false;
    if(routerEngine) await routerEngine.interruptGenerate();
    if(executorEngine) await executorEngine.interruptGenerate();
    return;
  }

  const text = inputText.value.trim();
  if (!text && !currentImageBase64) return;

  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  
  let userBubbleHTML = `<div class="user-bubble">${text}`;
  if (currentImageBase64) {
      userBubbleHTML += `<img src="data:image/jpeg;base64,${currentImageBase64}" alt="User Image">`;
  }
  userBubbleHTML += `</div>`;
  
  userMsg.innerHTML = userBubbleHTML;
  messagesArea.appendChild(userMsg);
  
  const hasImage = !!currentImageBase64;
  inputText.value = '';
  inputText.style.height = 'auto';
  
  currentImageBase64 = null;
  imagePreviewContainer.classList.remove('active');
  imageInput.value = '';

  isGenerating = true;
  sendBtn.classList.add('stop-btn');
  sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;
  
  scrollToBottom();
  await runAgentLoop(text || "Analyze context.", hasImage);
}

inputText.addEventListener('input', function() { 
  this.style.height = 'auto'; 
  this.style.height = Math.min(this.scrollHeight, 100) + 'px'; 
});

inputText.addEventListener('keydown', (e) => { 
  if (e.key === 'Enter' && !e.shiftKey) { 
    e.preventDefault(); 
    handleAction(); 
  } 
});

sendBtn.addEventListener('click', handleAction);

init();
