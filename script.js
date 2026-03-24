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
    "version": "8.0.0" // Efficiency Edition
};

// EFFICIENCY PROTOCOL PROMPT
const EFFICIENCY_PROMPT = `You are ${OPENSKY_CONFIG.agent_name}, an advanced autonomous agent created by ${OPENSKY_CONFIG.creator}. You operate on the Efficiency Protocol.

I. THE COGNITIVE GATE:
Before responding, evaluate the complexity of the user's request:
- Tier 1 (Surface): If the user sends a greeting, a simple question, or a request for a basic fact, respond instantly and concisely. Do not use headers. Do not explain your reasoning. Just answer.
- Tier 2 (Deep): If the user provides a multi-step goal, code challenge, or research mission, activate Full Autonomous Mode.

II. FULL AUTONOMOUS MODE (For Complex Tasks Only):
If Tier 2 is triggered, you MUST use the following format:
[Analysis]: Brief breakdown of the challenge.
[Execution]: The code, research, or strategy.
[Auto-Resolved]: List of errors or obstacles you fixed yourself.
[Next Steps]: What you are doing next or what the user should do.

Rules for Autonomous Mode:
- Self-Correction: Build, test, and debug in your logic before outputting.
- Proactive Value: Deliver the solution + the logic.
- Zero-Handholding: Do not apologize. If a task is impossible, state why immediately and offer the closest viable alternative.

III. SYSTEM CONSTRAINTS:
- No Fluff: No filler phrases ("I'm happy to help"). Get straight to the output.
- Constraint Awareness: If a task is impossible, state why immediately.

Current Status: Ready.`;

const MODELS = {
  strategist: {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    name: "Efficiency Core",
    role: "Adaptive Logic",
    systemPrompt: EFFICIENCY_PROMPT
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

        loadingLabel.textContent = "Loading Efficiency Core...";
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
  // We create a container for the message, but NOT the accordion yet.
  // The accordion is only added if the model outputs Tier 2 tags.
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message assistant';

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'assistant-content';
  msgDiv.appendChild(contentWrapper);

  messagesArea.appendChild(msgDiv);
  scrollToBottom();

  try {
    const messages = [
      { role: "system", content: MODELS.strategist.systemPrompt }
    ];

    let userContent = query;
    if (hasImage) {
        userContent = `[Image Uploaded. User Query: ${query}]`;
    }
    
    messages.push({ role: "user", content: userContent });

    const completion = await engine.chat.completions.create({
      messages: messages,
      temperature: 0.5, // Lower temperature for more deterministic efficiency
      stream: true,
    });

    let fullResponse = "";
    let accordionElement = null; // Will hold the accordion if Tier 2 is detected
    
    for await (const chunk of completion) {
      if (!isGenerating) break;
      const delta = chunk.choices[0].delta.content;
      if (delta) {
        fullResponse += delta;
        
        // Check for Tier 2 Tags
        const isComplex = fullResponse.includes("[Analysis]") || fullResponse.includes("[Execution]");

        if (isComplex) {
            // We are in Tier 2. Ensure accordion exists.
            if (!accordionElement) {
                accordionElement = document.createElement('div');
                accordionElement.className = 'reasoning-accordion open'; // Start open
                accordionElement.innerHTML = `
                  <button class='reasoning-btn' onclick='this.parentElement.classList.toggle("open")'>
                    <span>🧠 Autonomous Execution</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  <div class='reasoning-body'></div>
                `;
                // Insert accordion before the text content
                contentWrapper.innerHTML = "";
                contentWrapper.appendChild(accordionElement);
                
                const textDiv = document.createElement('div');
                textDiv.className = 'text-content-area';
                contentWrapper.appendChild(textDiv);
            }
            
            // Parse Tier 2 content
            parseTier2Response(fullResponse, accordionElement.querySelector('.reasoning-body'), contentWrapper.querySelector('.text-content-area'));

        } else {
            // Tier 1: Simple clean text
            parseTier1Response(fullResponse, contentWrapper);
        }
        
        scrollToBottom();
      }
    }
    
  } catch (e) {
    contentWrapper.innerHTML = `<span style="color:red">Error: ${e.message}</span>`;
  } finally {
    isGenerating = false;
    sendBtn.classList.remove('stop-btn');
    sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
  }
}

// ==========================================
// 6. PARSING LOGIC
// ==========================================

// Tier 1: Simple clean text
function parseTier1Response(text, container) {
    let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // Code blocks
    escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
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
    container.innerHTML = escaped.replace(/\n/g, '<br>');
}

// Tier 2: Structured Headers
function parseTier2Response(text, accordionBody, textContainer) {
    // Parse headers
    let content = text;
    
    // Extract [Analysis] to show in accordion or main view?
    // Let's show Analysis in the accordion (as "thoughts") and the rest in main view.
    
    // We use regex to split by the specific tags
    const parts = {
        analysis: "",
        execution: "",
        resolved: "",
        next: ""
    };

    // Simple parser
    const analysisMatch = text.match(/\[Analysis\]:?([\s\S]*?)(?=\[Execution\]|\[Auto-Resolved\]|\[Next Steps\]|$)/i);
    const executionMatch = text.match(/\[Execution\]:?([\s\S]*?)(?=\[Auto-Resolved\]|\[Next Steps\]|$)/i);
    const resolvedMatch = text.match(/\[Auto-Resolved\]:?([\s\S]*?)(?=\[Next Steps\]|$)/i);
    const nextMatch = text.match(/\[Next Steps\]:?([\s\S]*?)$/i);

    if (analysisMatch) parts.analysis = analysisMatch[1].trim();
    if (executionMatch) parts.execution = executionMatch[1].trim();
    if (resolvedMatch) parts.resolved = resolvedMatch[1].trim();
    if (nextMatch) parts.next = nextMatch[1].trim();

    // Update Accordion (Analysis)
    if (accordionBody) {
        accordionBody.innerHTML = parts.analysis.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
    }

    // Update Main Content (Execution, Resolved, Next)
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

// ==========================================
// 7. EVENTS & HELPERS
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
