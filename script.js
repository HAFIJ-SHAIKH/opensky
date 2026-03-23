import * as webllm from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/lib/module.min.js";

// ==========================================
// 1. CONFIGURATION (Dual Model Setup)
// ==========================================
// We use two smaller models so they can run at the same time without crashing the browser.
// Model A: Chat/Code (Fast, Logical)
// Model B: Image/Art (Creative)

const MODELS = {
  atlas: {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Atlas Core",
    role: "Conversation, Code & Research",
    systemPrompt: `You are Atlas, a highly intelligent coding and research agent created by Hafij Shaikh. 
    You are precise, logical, and excellent at programming tasks. You provide clean code and accurate facts.`
  },
  artist: {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Artist Module",
    role: "Image Prompts & Creativity",
    systemPrompt: `You are an expert AI Artist created by Hafij Shaikh. 
    Your goal is to generate detailed, evocative image prompts for AI art generators (like Midjourney or Stable Diffusion).
    When asked to 'draw' or 'create an image', describe the scene in vivid detail, including lighting, style, and composition.`
  }
};

// ==========================================
// 2. UI ELEMENTS
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

const ICON_SEND = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
const ICON_STOP = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;

// ==========================================
// 3. ENGINE STATE
// ==========================================
let engines = {}; // Store both engines here
let isGenerating = false;
let activeModel = null; // Which model is currently talking

// ==========================================
// 4. INITIALIZATION (Download Both)
// ==========================================
async function initEngines() {
  loadingLabel.textContent = "Initializing Systems...";
  
  try {
    // Check WebGPU
    if (!navigator.gpu) throw new Error("WebGPU not supported.");

    // Create UI Cards for Progress
    const statusContainer = document.createElement('div');
    statusContainer.className = 'model-load-status';
    statusContainer.innerHTML = `
      <div class="model-card" id="status-atlas">
        <div class="model-card-name">Atlas Core (Logic)</div>
        <div class="model-card-desc">Waiting...</div>
        <div class="slider-track"><div class="slider-fill" style="width: 0%"></div></div>
      </div>
      <div class="model-card" id="status-artist">
        <div class="model-card-name">Artist Module (Creative)</div>
        <div class="model-card-desc">Waiting...</div>
        <div class="slider-track"><div class="slider-fill" style="width: 0%"></div></div>
      </div>
    `;
    // Insert cards before the main percent text
    loadingLabel.parentNode.insertBefore(statusContainer, loadingPercent);

    // Function to update individual model progress
    const updateProgress = (modelKey, report) => {
      const card = document.getElementById(`status-${modelKey}`);
      if (!card) return;
      
      const percent = Math.round(report.progress * 100);
      card.querySelector('.slider-fill').style.width = `${percent}%`;
      card.querySelector('.model-card-desc').textContent = report.text;

      // Update global progress (average of both)
      // Since we load sequentially for stability, we calculate based on steps
      if(modelKey === 'atlas') {
         loadingPercent.textContent = `${Math.round(percent / 2)}%`;
      } else {
         loadingPercent.textContent = `${Math.round(50 + percent / 2)}%`;
      }
    };

    // Load Model 1: Atlas (Logic)
    loadingLabel.textContent = "Downloading Core Intelligence...";
    engines.atlas = await webllm.CreateMLCEngine(MODELS.atlas.id, {
      initProgressCallback: (report) => updateProgress('atlas', report)
    });

    // Load Model 2: Artist (Creative)
    loadingLabel.textContent = "Downloading Creative Module...";
    engines.artist = await webllm.CreateMLCEngine(MODELS.artist.id, {
      initProgressCallback: (report) => updateProgress('artist', report)
    });

    // Success
    loadingLabel.textContent = "All Systems Ready.";
    loadingPercent.textContent = "100%";
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      chatContainer.style.display = 'flex';
      setStatus('online');
    }, 500);

  } catch (e) {
    loadingLabel.textContent = `Error: ${e.message}`;
    loadingLabel.style.color = "red";
    console.error(e);
  }
}

// ==========================================
// 5. ROUTER & AGENT LOGIC
// ==========================================

// Determine which model to use
function routeRequest(query) {
  const q = query.toLowerCase();
  // Keywords for the Artist model
  const artKeywords = ["image", "draw", "picture", "art", "paint", "generate an image", "photo", "sketch", "visual"];
  
  if (artKeywords.some(keyword => q.includes(keyword))) {
    return { engine: engines.artist, config: MODELS.artist };
  }
  return { engine: engines.atlas, config: MODELS.atlas };
}

async function runAgentLoop(userQuery) {
  // 1. ROUTER: Decide which model to use
  const { engine, config } = routeRequest(userQuery);
  activeModel = config.name;

  // 2. PLANNING: Show internal logic
  thinkingPanel.style.display = 'block';
  thinkingContent.textContent = `[Router] Selected Model: ${config.name}\n[Role] ${config.role}\n[Thought] Analyzing request...`;

  // 3. EXECUTION
  try {
    const completion = await engine.chat.completions.create({
      messages: [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: userQuery }
      ],
      temperature: 0.7,
      stream: true,
    });

    // Create message container
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message sky';
    // Add a small badge to show which model answered
    const modelBadge = document.createElement('div');
    modelBadge.style.fontSize = '0.65rem';
    modelBadge.style.color = 'var(--fg-muted)';
    modelBadge.style.marginBottom = '0.25rem';
    modelBadge.textContent = `Powered by ${config.name}`;
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'sky-content';
    
    msgDiv.appendChild(modelBadge);
    msgDiv.appendChild(contentWrapper);
    messagesArea.appendChild(msgDiv);

    let fullResponse = "";
    
    // Streaming Loop
    for await (const chunk of completion) {
      if (!isGenerating) {
        thinkingContent.textContent += "\n[SYSTEM]: Stopped by user.";
        break;
      }

      const delta = chunk.choices[0].delta.content;
      if (delta) {
        fullResponse += delta;
        contentWrapper.innerHTML = parseMarkdown(fullResponse);
        smartScrollToBottom();
      }
    }

    // Update thinking panel with completion status
    thinkingContent.textContent += `\n[Done] Response generated.`;

  } catch (err) {
    appendMessage("sky", `Error in ${config.name}: ${err.message}`);
  } finally {
    thinkingPanel.style.display = 'none';
    activeModel = null;
    isGenerating = false;
    setStatus('online');
  }
}

// ==========================================
// 6. UI HELPERS & CONTROLS
// ==========================================

function isScrollAtBottom() {
  const threshold = 150;
  return messagesArea.scrollHeight - messagesArea.scrollTop <= messagesArea.clientHeight + threshold;
}

function smartScrollToBottom() {
  if (isScrollAtBottom()) {
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }
}

function setStatus(status) {
  sendBtn.innerHTML = status === 'online' ? ICON_SEND : ICON_STOP;
  sendBtn.disabled = false; 
  sendBtn.style.background = status === 'online' 
    ? "linear-gradient(135deg, #6366f1, #818cf8)" 
    : "#ef4444";

  statusText.textContent = status === 'online' ? 'Agent Ready' : 'Processing...';
  statusText.className = `status-text ${status}`;
  statusDot.className = `status-dot ${status === 'generating' ? 'loading' : ''}`;
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

async function handleButtonClick() {
  if (isGenerating) {
    isGenerating = false;
    // Interrupt the currently active model
    if (engines.atlas) await engines.atlas.interruptGenerate();
    if (engines.artist) await engines.artist.interruptGenerate();
    return;
  }

  const text = inputText.value.trim();
  if (!text) return;

  appendMessage("user", text);
  inputText.value = '';
  inputText.style.height = 'auto';
  
  isGenerating = true;
  setStatus('generating');
  
  await runAgentLoop(text);
}

inputText.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 100) + 'px'; });
inputText.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleButtonClick(); } });
sendBtn.addEventListener('click', handleButtonClick);

// --- START ---
initEngines();
