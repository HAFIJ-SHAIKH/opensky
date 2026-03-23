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
    "version": "6.1.0" // Optimized for Hardware Limits
};

// System Prompt with Recursive Planning
const ATLAS_PROMPT = `You are ${OPENSKY_CONFIG.agent_name}, an advanced autonomous agent created by ${OPENSKY_CONFIG.creator}.
1. Recursive Planning: State your plan, critique it, and adjust.
2. Reasoning Loop: Use Thought-Action-Observation format.
3. State Management: Track progress and obstacles.`;

// Artist Prompt specialized for SVG Generation
const ARTIST_PROMPT = `You are the Creative Module of ${OPENSKY_CONFIG.agent_name}.
You are an expert SVG artist.
When asked to 'draw', 'generate an image', or 'create a picture', you MUST output valid SVG code inside a code block. 
Create detailed, artistic SVGs.
If the user uploads an image for reference, apologize that you cannot see it (hardware limit), but generate an SVG based on their text description.`;

// Models selected for Hardware Compatibility (Workgroup 256)
const MODELS = {
  atlas: {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Atlas Core",
    role: "Logic & Agent",
    systemPrompt: ATLAS_PROMPT
  },
  artist: {
    // Using Phi-3.5-mini as the Artist. It is smart enough to generate SVG code (images)
    // without crashing the GPU like the Vision model did.
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC", 
    name: "Artist Module",
    role: "Creative (SVG)",
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
const modelStatusContainer = document.getElementById('modelStatusContainer');
const debugLog = document.getElementById('debugLog');
const uploadBtn = document.getElementById('uploadBtn');
const imageInput = document.getElementById('imageInput');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');

let engines = {}; 
let isGenerating = false;
let currentImageBase64 = null;

// ==========================================
// DEBUG HELPER
// ==========================================
function showError(title, err) {
    console.error(err);
    debugLog.style.display = 'block';
    debugLog.innerHTML = `<strong>${title}:</strong><br>${err.message || err}<br><br><em>Check if you are using Chrome v113+.</em>`;
    loadingPercent.textContent = "Error";
    loadingLabel.textContent = title;
}

// ==========================================
// 4. INITIALIZATION
// ==========================================
async function init() {
    try {
        loadingLabel.textContent = "Checking WebGPU...";
        
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported. Please use Chrome v113+.");
        }

        modelStatusContainer.innerHTML = `
          <div class="model-card" id="card-atlas">
            <div class="model-card-name">${MODELS.atlas.name}</div>
            <div class="model-card-desc">Pending...</div>
          </div>
          <div class="model-card" id="card-artist">
            <div class="model-card-name">${MODELS.artist.name}</div>
            <div class="model-card-desc">Pending...</div>
          </div>
        `;

        // Load Atlas
        loadingLabel.textContent = "Loading Atlas Core (1/2)...";
        engines.atlas = await webllm.CreateMLCEngine(MODELS.atlas.id, {
            initProgressCallback: (report) => updateModelUI('card-atlas', report, 0)
        });

        // Load Artist
        loadingLabel.textContent = "Loading Artist Module (2/2)...";
        engines.artist = await webllm.CreateMLCEngine(MODELS.artist.id, {
            initProgressCallback: (report) => updateModelUI('card-artist', report, 50)
        });

        loadingLabel.textContent = "Agents Ready.";
        
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
// 5. AGENT LOGIC
// ==========================================
function routeRequest(query, hasImage) {
  const q = query.toLowerCase();
  
  // If user wants to create/draw -> Use Artist (SVG Generation)
  if (["image", "draw", "picture", "art", "paint", "svg", "generate"].some(k => q.includes(k))) {
    return { engine: engines.artist, config: MODELS.artist };
  }
  
  // If user uploaded an image -> Use Artist (Creative transformation)
  // Note: The model cannot 'see' the image, but we route it here so it can 
  // generate a 'replacement' SVG based on the user's text description.
  if (hasImage) {
    return { engine: engines.artist, config: MODELS.artist };
  }

  // Default to Atlas for Logic
  return { engine: engines.atlas, config: MODELS.atlas };
}

async function runAgentLoop(query) {
  const accordion = document.createElement('div');
  accordion.className = 'reasoning-accordion open';
  
  const accordionBtn = document.createElement('button');
  accordionBtn.className = 'reasoning-btn';
  accordionBtn.innerHTML = `<span>🧠 Agent Reasoning...</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
  accordionBtn.onclick = () => accordion.classList.toggle('open');

  const accordionBody = document.createElement('div');
  accordionBody.className = 'reasoning-body';
  accordionBody.textContent = "Initializing Thought Process...";
  
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

  const { engine, config } = routeRequest(query, !!currentImageBase64);
  
  try {
    // Prepare messages
    const messages = [
      { role: "system", content: config.systemPrompt }
    ];

    // Handle Image Upload Context
    if (currentImageBase64) {
      // Since the model is Text-Only (to fix your crash), we inject a system hint
      // to inform the model about the user's intent.
      messages.push({ 
        role: "user", 
        content: `The user uploaded an image (which I cannot see due to hardware constraints) and said: "${query}". 
        Please generate an SVG image that matches their description or request.` 
      });
    } else {
      messages.push({ role: "user", content: query });
    }

    const completion = await engine.chat.completions.create({
      messages: messages,
      temperature: 0.7,
      stream: true,
    });

    let fullResponse = "";
    
    for await (const chunk of completion) {
      if (!isGenerating) break;
      const delta = chunk.choices[0].delta.content;
      if (delta) {
        fullResponse += delta;
        if (accordion.classList.contains('open') && fullResponse.length > 100) {
             accordion.classList.remove('open');
             accordionBtn.querySelector('span').textContent = "✨ View Reasoning Log";
        }
        msgDiv.style.display = 'flex';
        contentWrapper.innerHTML = parseContent(fullResponse, accordionBody);
        scrollToBottom();
      }
    }
    
    accordionBody.textContent = "Reasoning complete.";
    
  } catch (e) {
    contentWrapper.innerHTML = `<span style="color:red">Error: ${e.message}</span>`;
    msgDiv.style.display = 'flex';
  } finally {
    isGenerating = false;
    sendBtn.classList.remove('stop-btn');
    sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
  }
}

// ==========================================
// 6. CONTENT PARSING
// ==========================================
function parseContent(text, accordionElement) {
  if (!text) return "";
  
  let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Handle Code Blocks (and SVG)
  escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const decodedCode = code.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      
      // SVG Detection -> Render as Image
      if (lang === 'svg' || decodedCode.trim().startsWith('<svg')) {
          return `
            <div class="generated-image-container">
              ${decodedCode}
              <button class="download-btn" onclick="downloadSVG(this)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </button>
            </div>
          `;
      }
      
      return `
        <div class="code-block">
          <div class="code-header">
            <span>${lang || 'code'}</span>
            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          </div>
          <div class="code-body"><pre>${code}</pre></div>
        </div>
      `;
  });

  return escaped.replace(/\n/g, '<br>');
}

window.copyCode = function(btn) {
    const code = btn.closest('.code-block').querySelector('pre').textContent;
    navigator.clipboard.writeText(code);
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = 'Copy', 1000);
};

window.downloadSVG = function(btn) {
    const svgEl = btn.previousElementSibling;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = "opensky-image.svg";
    link.click();
    URL.revokeObjectURL(url);
};

// ==========================================
// 7. EVENTS
// ==========================================
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
    if(engines.atlas) await engines.atlas.interruptGenerate();
    if(engines.artist) await engines.artist.interruptGenerate();
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
  
  inputText.value = '';
  inputText.style.height = 'auto';
  
  isGenerating = true;
  sendBtn.classList.add('stop-btn');
  sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;
  
  scrollToBottom();
  await runAgentLoop(text || "Create an artistic representation of this.");
  
  currentImageBase64 = null;
  imagePreviewContainer.classList.remove('active');
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
