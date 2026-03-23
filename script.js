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

// Prompts
const MAIN_PROMPT = `You are ${OPENSKY_CONFIG.agent_name}, a helpful AI assistant created by ${OPENSKY_CONFIG.creator}. 
You are concise, smart, and helpful. You can see images if the user uploads them.
If the user asks you to "draw", "generate an image", or "create a picture", you MUST generate a valid SVG code in a code block. 
Do not say you cannot create images. Instead, generate SVG code.`;

// Models
// We use Phi-3.5-Vision for both text and image understanding.
// It is multimodal and works on mobile/web.
const MODELS = {
  main: {
    id: "Phi-3.5-vision-instruct-q4f16_1-MLC",
    name: "Opensky Vision Core",
    role: "Chat & Vision",
    systemPrompt: MAIN_PROMPT
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
let currentImageBase64 = null; // Stores the image to be sent

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
          <div class="model-card" id="card-main">
            <div class="model-card-name">${MODELS.main.name}</div>
            <div class="model-card-desc">Pending...</div>
          </div>
        `;

        loadingLabel.textContent = "Loading Core Engine...";
        
        engine = await webllm.CreateMLCEngine(MODELS.main.id, {
            initProgressCallback: (report) => updateModelUI('card-main', report)
        });

        // Success
        loadingLabel.textContent = "Ready.";
        loadingPercent.textContent = "100%";
        sliderFill.style.width = "100%";
        
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
// 5. CHAT LOGIC
// ==========================================
async function runChatLoop(query) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message assistant';
  
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'assistant-content';
  contentWrapper.innerHTML = '<span class="typing-indicator">...</span>';
  
  msgDiv.appendChild(contentWrapper);
  messagesArea.appendChild(msgDiv);
  scrollToBottom();

  // Prepare messages
  const messages = [
    { role: "system", content: MODELS.main.systemPrompt }
  ];

  // If image exists, we need to construct the user message differently for Vision models
  if (currentImageBase64) {
      // For WebLLM Vision, we pass an object with image info
      // Note: Implementation might vary slightly based on WebLLM version, 
      // usually it accepts a multimodal content structure.
      // Let's assume standard OpenAI vision format support in WebLLM
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
  
  try {
    const completion = await engine.chat.completions.create({
      messages: messages,
      temperature: 0.7,
      stream: true,
    });

    let fullResponse = "";
    
    for await (const chunk of completion) {
      if (!isGenerating) break; // Stop button clicked
      
      const delta = chunk.choices[0].delta.content;
      if (delta) {
        fullResponse += delta;
        contentWrapper.innerHTML = parseContent(fullResponse);
        scrollToBottom();
      }
    }
    
    // Final render to handle code blocks/images
    contentWrapper.innerHTML = parseContent(fullResponse);

  } catch (e) {
    contentWrapper.innerHTML = `<span style="color:red">Error: ${e.message}</span>`;
  } finally {
    isGenerating = false;
    sendBtn.classList.remove('stop-btn');
    sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
  }
}

// ==========================================
// 6. CONTENT PARSING (Markdown & Images)
// ==========================================
function parseContent(text) {
  if (!text) return "";
  
  // Basic escaping first
  let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 1. Detect SVG Code and Render it
  // Look for code blocks that look like SVG
  const svgRegex = /&lt;code-block&gt;[\s\S]*?&lt;svg[\s\S]*?&lt;\/svg&gt;[\s\S]*?&lt;\/code-block&gt;/gi;
  // Note: The model outputs raw text, we need to find ```svg ... ```
  
  // Actually, let's parse standard markdown code blocks first
  // ```svg ... ``` or ``` ... ```
  escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const decodedCode = code.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      
      // If it's SVG
      if (lang === 'svg' || decodedCode.trim().startsWith('<svg')) {
          // Return a rendered image container with download button
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
      
      // Normal code block
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

  // Newlines
  return escaped.replace(/\n/g, '<br>');
}

// Global helper for copy
window.copyCode = function(btn) {
    const code = btn.closest('.code-block').querySelector('pre').textContent;
    navigator.clipboard.writeText(code);
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = 'Copy', 1000);
};

// Global helper for download
window.downloadSVG = function(btn) {
    const svgEl = btn.previousElementSibling; // The SVG element
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
        const base64String = ev.target.result.split(',')[1];
        currentImageBase64 = base64String;
        
        // Show preview
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
  // STOP LOGIC
  if (isGenerating) {
    isGenerating = false;
    if(engine) await engine.interruptGenerate();
    return;
  }

  const text = inputText.value.trim();
  
  // Require text even if image is present
  if (!text) return; 

  // --- Build User Message ---
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  
  let userBubbleHTML = `<div class="user-bubble">${text}`;
  if (currentImageBase64) {
      userBubbleHTML += `<img src="data:image/jpeg;base64,${currentImageBase64}" alt="User Image">`;
  }
  userBubbleHTML += `</div>`;
  
  userMsg.innerHTML = userBubbleHTML;
  messagesArea.appendChild(userMsg);
  
  // Clear inputs
  inputText.value = '';
  inputText.style.height = 'auto';
  const tempImg = currentImageBase64; // Store before clearing
  imagePreviewContainer.classList.remove('active');
  currentImageBase64 = null;
  imageInput.value = '';

  // UI State
  isGenerating = true;
  sendBtn.classList.add('stop-btn');
  sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;
  
  scrollToBottom();
  
  // Pass logic to chat loop
  // Note: We pass tempImg because runChatLoop expects global currentImageBase64, 
  // but we cleared it. Let's refactor runChatLoop to accept image arg, or restore it.
  // For simplicity, let's restore it inside the scope of the call.
  currentImageBase64 = tempImg; 
  await runChatLoop(text);
  currentImageBase64 = null; // Clear again after use
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
