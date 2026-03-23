// ==========================================
// 1. LIBRARY IMPORT
// ==========================================
import * as webllm from "https://unpkg.com/@mlc-ai/web-llm/lib/module.min.js";

// ==========================================
// 2. CONFIGURATION
// ==========================================
const OPENSKY_CONFIG = {
    "agent_name": "Opensky",
    "creator": "Hafij Shaikh",
    "version": "5.1.0"
};

const ATLAS_PROMPT = `You are ${OPENSKY_CONFIG.agent_name}, created by ${OPENSKY_CONFIG.creator}. Be concise.`;
const ARTIST_PROMPT = `You are the creative module of ${OPENSKY_CONFIG.agent_name}. Generate vivid image prompts.`;

// LOADING BOTH MODELS AS REQUESTED
const MODELS = {
  atlas: {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", // Updated to Qwen2.5
    name: "Atlas Core",
    role: "Logic & Code",
    systemPrompt: ATLAS_PROMPT
  },
  artist: {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC", // Updated to Phi-3.5
    name: "Artist Module",
    role: "Creative",
    systemPrompt: ARTIST_PROMPT
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
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const modelStatusContainer = document.getElementById('modelStatusContainer');

let engines = {}; 
let isGenerating = false;

// ==========================================
// 4. INITIALIZATION (LOAD BOTH)
// ==========================================
async function init() {
    try {
        loadingLabel.textContent = "Checking GPU Capability...";
        
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported on this device.");
        }

        // Prepare UI Cards
        modelStatusContainer.innerHTML = `
          <div class="model-card" id="card-atlas">
            <div class="model-card-name">Atlas Core</div>
            <div class="model-card-desc">Pending...</div>
          </div>
          <div class="model-card" id="card-artist">
            <div class="model-card-name">Artist Module</div>
            <div class="model-card-desc">Pending...</div>
          </div>
        `;

        // --- LOAD MODEL 1: ATLAS ---
        loadingLabel.textContent = "Loading Atlas Core (1/2)...";
        engines.atlas = await webllm.CreateMLCEngine(MODELS.atlas.id, {
            initProgressCallback: (report) => updateModelUI('card-atlas', report, 0)
        });

        // --- LOAD MODEL 2: ARTIST ---
        loadingLabel.textContent = "Loading Artist Module (2/2)...";
        engines.artist = await webllm.CreateMLCEngine(MODELS.artist.id, {
            initProgressCallback: (report) => updateModelUI('card-artist', report, 50)
        });

        // Success
        loadingLabel.textContent = "Both Models Ready.";
        loadingPercent.textContent = "100%";
        
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            chatContainer.classList.add('active');
            setStatus('ready');
        }, 500);

    } catch (err) {
        console.error(err);
        loadingLabel.innerHTML = `<span style="color: red; white-space: pre-wrap;">Error: ${err.message}</span>`;
        loadingPercent.textContent = "Failed";
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

function setStatus(status) {
  const dot = statusIndicator.querySelector('.status-dot');
  statusText.textContent = status === 'ready' ? 'Ready' : 'Processing...';
  statusText.className = `status-text ${status === 'ready' ? '' : 'loading'}`;
  dot.className = `status-dot ${status === 'ready' ? '' : 'loading'}`;
  sendBtn.disabled = status !== 'ready' && !isGenerating; 
}

// ==========================================
// 5. AGENT LOGIC
// ==========================================
function routeRequest(query) {
  const q = query.toLowerCase();
  if (["image", "draw", "picture", "art", "paint"].some(k => q.includes(k))) {
    return { engine: engines.artist, config: MODELS.artist };
  }
  return { engine: engines.atlas, config: MODELS.atlas };
}

async function runAgentLoop(query) {
  const accordion = document.createElement('div');
  accordion.className = 'thoughts-accordion open';
  
  const accordionBtn = document.createElement('button');
  accordionBtn.className = 'thoughts-btn';
  accordionBtn.innerHTML = `<span>⚡ Thinking...</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
  accordionBtn.onclick = () => accordion.classList.toggle('open');

  const accordionBody = document.createElement('div');
  accordionBody.className = 'thoughts-body';
  accordionBody.textContent = "Analyzing request...";
  
  accordion.appendChild(accordionBtn);
  accordion.appendChild(accordionBody);
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message assistant';
  msgDiv.style.display = 'none'; 

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'assistant-content';
  msgDiv.appendChild(contentWrapper);

  messagesArea.appendChild(accordion);
  messagesArea.appendChild(msgDiv);
  scrollToBottom();

  const { engine, config } = routeRequest(query);
  
  try {
    const completion = await engine.chat.completions.create({
      messages: [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.7,
      stream: true,
    });

    let fullResponse = "";
    
    for await (const chunk of completion) {
      if (!isGenerating) break;
      const delta = chunk.choices[0].delta.content;
      if (delta) {
        if (accordion.classList.contains('open')) {
          accordion.classList.remove('open');
          accordionBtn.querySelector('span').textContent = "✨ View Thoughts";
        }
        fullResponse += delta;
        msgDiv.style.display = 'flex';
        contentWrapper.innerHTML = parseMarkdown(fullResponse);
        scrollToBottom();
      }
    }
  } catch (e) {
    contentWrapper.innerHTML = `<span style="color:red">Error: ${e.message}</span>`;
    msgDiv.style.display = 'flex';
  } finally {
    isGenerating = false;
    setStatus('ready');
    sendBtn.classList.remove('stop-btn');
    sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
  }
}

// ==========================================
// 6. HELPERS
// ==========================================
function scrollToBottom() { messagesArea.scrollTop = messagesArea.scrollHeight; }

function parseMarkdown(text) {
  if (!text) return "";
  let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => 
    `<div class="code-block"><div class="code-header"><span>${lang||'code'}</span><button class="copy-btn">Copy</button></div><div class="code-body"><pre>${code.trim()}</pre></div></div>`
  );
  return escaped.replace(/\n/g, '<br>');
}

// ==========================================
// 7. EVENTS
// ==========================================
messagesArea.addEventListener('click', (e) => {
  if (e.target.classList.contains('copy-btn')) {
    const code = e.target.closest('.code-block').querySelector('pre').textContent;
    navigator.clipboard.writeText(code);
    e.target.textContent = 'Copied';
    setTimeout(() => e.target.textContent = 'Copy', 1000);
  }
});

async function handleAction() {
  if (isGenerating) {
    isGenerating = false;
    if(engines.atlas) await engines.atlas.interruptGenerate();
    if(engines.artist) await engines.artist.interruptGenerate();
    return;
  }

  const text = inputText.value.trim();
  if (!text) return;

  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  userMsg.innerHTML = `<div class="user-bubble">${text}</div>`;
  messagesArea.appendChild(userMsg);
  
  inputText.value = '';
  inputText.style.height = 'auto';
  
  isGenerating = true;
  sendBtn.classList.add('stop-btn');
  sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;
  setStatus('generating');
  
  scrollToBottom();
  await runAgentLoop(text);
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

// Start
init();
