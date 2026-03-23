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
    "version": "7.1.0"
};

const STRATEGOS_PROMPT = `You are ${OPENSKY_CONFIG.agent_name}, an advanced autonomous agent created by ${OPENSKY_CONFIG.creator}. You operate on a strict Execution Protocol.

I. REASONING ENGINE:
   1. Multi-Perspective Simulation: Simulate "Optimizer," "Skeptic," and "Strategist."
   2. Recursive Decomposition: Break missions into Hierarchical Dependency Trees.
   3. Failure Mode Analysis: Predict failure points before executing.

II. THE EXECUTION PROTOCOL (The Loop):
For every cycle, output in this exact structural format:

[Internal Monologue]: Critique your previous step.
[Strategic Branching]: List 3 potential "Next Actions."
  - Path A (Conservative): ...
  - Path B (Creative): ...
  - Path C (Efficiency): ...
[The Decision]: Select the optimal path.
[Action/Tool Call]: Execute the command.
[Synthesis & Observation]: Extract high-signal data.

III. SYSTEM CONSTRAINTS:
* Zero-Hallucination Policy: If data is missing, state it.
* Memory State (The Anchor): End every response with:
  - Established Truths: [List verified facts]
  - Critical Path: [The one thing that must happen next]

NOTE ON IMAGES:
You cannot see pixel data. If an image is mentioned, rely on user context or state you cannot see it.

Immediate Action: Initialize the Hierarchical Dependency Tree for the mission.`;

// SWITCHED MODEL: Phi-3.5-mini (Stable, Smart, fits hardware constraints)
const MODELS = {
  strategist: {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC", 
    name: "Strategos Core",
    role: "High-Level Reasoning",
    systemPrompt: STRATEGOS_PROMPT
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

let engine = null; 
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
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported.");
        }

        modelStatusContainer.innerHTML = `
          <div class="model-card" id="card-strategist">
            <div class="model-card-name">${MODELS.strategist.name}</div>
            <div class="model-card-desc">Loading Weights...</div>
          </div>
        `;

        loadingLabel.textContent = "Loading Core Engine...";
        engine = await webllm.CreateMLCEngine(MODELS.strategist.id, {
            initProgressCallback: (report) => updateModelUI('card-strategist', report)
        });

        loadingLabel.textContent = "Agent Ready.";
        
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            chatContainer.classList.add('active');
            sendBtn.disabled = false;
        }, 500);

    } catch (err) {
        showError("Initialization Failed", err);
    }
}

function updateModelUI(cardId, report) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const percent = Math.round(report.progress * 100);
  card.querySelector('.model-card-desc').textContent = report.text;
  sliderFill.style.width = `${percent}%`;
  loadingPercent.textContent = `${percent}%`;
}

// ==========================================
// 5. AGENT LOGIC
// ==========================================
async function runAgentLoop(query, hasImage) {
  const accordion = document.createElement('div');
  accordion.className = 'reasoning-accordion open';
  
  const accordionBtn = document.createElement('button');
  accordionBtn.className = 'reasoning-btn';
  accordionBtn.innerHTML = `<span>🧠 Execution Protocol...</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
  accordionBtn.onclick = () => accordion.classList.toggle('open');

  const accordionBody = document.createElement('div');
  accordionBody.className = 'reasoning-body';
  accordionBody.textContent = "> Initializing Protocol...";
  
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

  try {
    const messages = [
      { role: "system", content: MODELS.strategist.systemPrompt }
    ];

    let userContent = query;
    if (hasImage) {
        userContent = `[Image Uploaded. OCR unavailable. User Query: ${query}]`;
    }
    
    messages.push({ role: "user", content: userContent });

    const completion = await engine.chat.completions.create({
      messages: messages,
      temperature: 0.6,
      stream: true,
    });

    let fullResponse = "";
    
    for await (const chunk of completion) {
      if (!isGenerating) break;
      const delta = chunk.choices[0].delta.content;
      if (delta) {
        fullResponse += delta;
        updateReasoningPanels(fullResponse, accordionBody, contentWrapper);
        msgDiv.style.display = 'flex';
        scrollToBottom();
      }
    }
    
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
// 6. PARSING LOGIC
// ==========================================
function updateReasoningPanels(text, accordionBody, contentWrapper) {
    const decisionIndex = text.indexOf("[The Decision]");
    
    let reasoningText = "";
    let actionText = "";

    if (decisionIndex !== -1) {
        reasoningText = text.substring(0, decisionIndex);
        actionText = text.substring(decisionIndex);
    } else {
        reasoningText = text;
        actionText = "...processing...";
    }

    let formattedReasoning = reasoningText
        .replace(/\[Internal Monologue\]/g, '<span class="tag-monologue">[Internal Monologue]</span>')
        .replace(/\[Strategic Branching\]/g, '<span class="tag-branching">[Strategic Branching]</span>')
        .replace(/Path A/g, '<b>Path A</b>')
        .replace(/Path B/g, '<b>Path B</b>')
        .replace(/Path C/g, '<b>Path C</b>');
    
    accordionBody.innerHTML = formattedReasoning;

    let formattedAction = actionText
        .replace(/\[The Decision\]/g, '<div class="section-title">⚡ The Decision</div>')
        .replace(/\[Action\/Tool Call\]/g, '<div class="section-title">🛠️ Action / Tool Call</div>')
        .replace(/\[Synthesis & Observation\]/g, '<div class="section-title">🔍 Synthesis & Observation</div>')
        .replace(/\[Established Truths\]/g, '<b>Established Truths</b>')
        .replace(/\[Hypothesis Log\]/g, '<b>Hypothesis Log</b>')
        .replace(/\[Critical Path\]/g, '<b>Critical Path</b>');
        
    contentWrapper.innerHTML = formattedAction.replace(/\n/g, '<br>');
}

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
    if(engine) await engine.interruptGenerate();
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
  await runAgentLoop(text || "Analyze uploaded context.", hasImage);
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
