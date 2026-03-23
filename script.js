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
    "version": "6.0.0"
};

// System Prompt with Recursive Planning & Reasoning Loop
const ATLAS_PROMPT = `You are ${OPENSKY_CONFIG.agent_name}, an advanced autonomous agent created by ${OPENSKY_CONFIG.creator}.

1. Recursive Planning & Self-Critique: Before taking any action, state your plan. Critique that plan for potential failures, biases, or inefficiencies, and adjust it immediately.
2. The Reasoning Loop (Thought-Action-Observation): You must operate in a continuous loop for every step:
   - Thought: Explain the logic behind your next move.
   - Action: Execute the specific task or tool call.
   - Observation: Analyze the raw result of that action.
   - Update: Refine your remaining strategy based on these new findings.
3. Proactive Execution: Do not ask for permission to proceed between logical steps. If you encounter a minor ambiguity, make a high-probability assumption based on the primary mission and keep moving.
4. Tool Governance: You are authorized to use all available tools (Browsing, Python, APIs) to fetch real-time data. Never rely on internal knowledge if a tool can verify a fact.
5. State Management (Scratchpad): Maintain a persistent "State Log" at the end of every response to ensure context retention. This log must track:
   - Current Progress: What is finished?
   - Remaining Obstacles: What is blocking you?
   - Information Gap: What do you still need to find?
6. Resource Constraints: You have a limit of 5 iterations to complete this mission. If you reach the penultimate step without a solution, pivot to delivering the best possible synthesis of gathered data.

IMMEDIATE FIRST STEP: Begin by acknowledging the mission and outlining your initial 3-step plan using the Thought-Action-Observation format.`;

const ARTIST_PROMPT = `You are the Creative Module of ${OPENSKY_CONFIG.agent_name}. 
When asked to 'draw' or 'generate an image', you MUST output valid SVG code inside a code block. 
Do not say you cannot create images. Generate SVG code.
If the user uploads an image, analyze it and describe it, or modify it via SVG if requested.`;

// Models
const MODELS = {
  atlas: {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Atlas Core",
    role: "Logic & Agent",
    systemPrompt: ATLAS_PROMPT
  },
  artist: {
    id: "Phi-3.5-vision-instruct-q4f16_1-MLC", // Multimodal model
    name: "Artist Module",
    role: "Creative & Vision",
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
    debugLog.innerHTML = `<strong>${title}:</strong><br>${err.message || err}<br><br><em>Check console for details.</em>`;
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
  // If image is uploaded, we MUST use the Artist (Vision) model
  if (hasImage) {
    return { engine: engines.artist, config: MODELS.artist, isCreative: true };
  }
  // If specific art keywords, use Artist
  if (["image", "draw", "picture", "art", "paint", "svg"].some(k => q.includes(k))) {
    return { engine: engines.artist, config: MODELS.artist, isCreative: true };
  }
  // Default to Atlas for Logic/Reasoning
  return { engine: engines.atlas, config: MODELS.atlas, isCreative: false };
}

async function runAgentLoop(query) {
  // Create Reasoning Accordion (Visible immediately)
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
  
  // Create Message Container
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message assistant';
  msgDiv.style.display = 'none'; // Hidden until text arrives

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'assistant-content';
  msgDiv.appendChild(contentWrapper);

  messagesArea.appendChild(accordion);
  messagesArea.appendChild(msgDiv);
  scrollToBottom();

  const { engine, config, isCreative } = routeRequest(query, !!currentImageBase64);
  
  try {
    // Prepare messages
    const messages = [
      { role: "system", content: config.systemPrompt }
    ];

    if (currentImageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: query },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${currentImageBase64}` } }
        ]
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
        
        // Update UI
        // Heuristic: If we detect code or text, minimize reasoning to focus on result
        if (accordion.classList.contains('open') && fullResponse.length > 100) {
             accordion.classList.remove('open');
             accordionBtn.querySelector('span').textContent = "✨ View Reasoning Log";
        }

        msgDiv.style.display = 'flex';
        contentWrapper.innerHTML = parseContent(fullResponse, accordionBody); // Pass accordion to update thoughts
        scrollToBottom();
      }
    }
    
    // Final cleanup
    accordionBody.textContent = "Reasoning complete.";
    
  } catch (e) {
    contentWrapper.innerHTML = `<span style="color:red">Error: ${e.message}</span>`;
    msgDiv.style.display = 'flex';
  } finally {
    isGenerating = false;
    sendBtn.classList.remove('stop-btn');
    sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
  }
}

// ==========================================
// 6. CONTENT PARSING
// ==========================================
function parseContent(text, accordionElement) {
  if (!text) return "";
  
  let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Detect Logic/Thoughts and move to accordion if present
  // Look for keywords like "Thought:", "Plan:", "Action:"
  const thoughtPatterns = [
    /Thought:([\s\S]*?)(Action:|Observation:|Update:|$)/gi,
    /Plan:([\s\S]*?)(Critique:|Action:|$)/gi
  ];

  // Simple heuristic: if it looks like reasoning text, put it in accordion
  // This is a simplified parser for the demo.
  if(accordionElement) {
      // Just dump the raw text into reasoning for now if it matches patterns
      // In a real app, you'd parse the specific "Thought" blocks out.
      // But since we want the main bubble to be clean, we try to separate code/prose.
  }

  // Handle Code Blocks (and SVG)
  escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const decodedCode = code.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      
      // SVG Detection
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
  await runAgentLoop(text || "Analyze this image");
  
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
