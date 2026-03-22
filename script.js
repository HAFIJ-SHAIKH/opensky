import * as webllm from "https://esm.run/@mlc-ai/webllm";

// --- State Management ---
let engine = null;
let isGenerating = false;
let chatHistory = [];

// --- DOM Elements ---
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

// --- Initialization ---

async function initEngine() {
  // Model ID from Hugging Face
  const selectedModel = "hafijshaikh/sky";

  try {
    // Create the engine, which triggers the file download
    engine = await webllm.CreateMLCEngine(selectedModel, {
      initProgressCallback: (report) => {
        updateLoadingProgress(report);
      }
    });
    
    finishLoading();
  } catch (err) {
    console.error("Failed to load model:", err);
    loadingLabel.textContent = `Error: ${err.message}. Check console for details.`;
    loadingLabel.style.color = "red";
  }
}

function updateLoadingProgress(report) {
  // Calculate percentage (WebLLM report.progress is 0.0 to 1.0)
  const percent = Math.round(report.progress * 100);
  sliderFill.style.width = `${percent}%`;
  loadingPercent.textContent = `${percent}%`;
  
  // Update text to show which file is downloading
  loadingLabel.textContent = report.text;
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
    statusText.textContent = 'Online';
    sendBtn.disabled = false;
  } else if (status === 'generating') {
    statusDot.className = 'status-dot loading';
    statusText.className = 'status-text loading';
    statusText.textContent = 'Generating...';
    sendBtn.disabled = true;
  }
}

// --- Chat Logic ---

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

function createTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'message sky';
  div.id = 'typingIndicator';
  const container = document.createElement('div');
  container.className = 'typing-container';
  container.innerHTML = '<div class="typing-wave"><span></span><span></span><span></span></div>';
  div.appendChild(container);
  return div;
}

// --- Markdown Parser (Custom for Code/Math/Gen) ---

function parseMarkdown(text) {
  // 1. Escape HTML
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Parse Code Blocks (```lang ... ```)
  escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'code';
    const cleanCode = code.trim();
    
    // Determine block style based on language or content
    let styleClass = '';
    let labelClass = '';
    
    if (language === 'math') {
        styleClass = 'math-block';
        labelClass = 'math-label';
    } else if (language === 'gen' || language === 'creative') {
        styleClass = 'gen-block';
        labelClass = 'gen-label';
    } else {
        styleClass = 'code-block';
        labelClass = 'code-label';
    }

    return `
      <div class="${styleClass}">
        <div class="block-header">
          <span class="block-label ${labelClass}">${language}</span>
          <button class="copy-btn" onclick="copyCode(this, encodeURIComponent(\`${cleanCode.replace(/`/g, '\\`')}\`))">
             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
             <span>Copy</span>
          </button>
        </div>
        <div class="block-body"><pre>${cleanCode}</pre></div>
      </div>`;
  });

  // 3. Line breaks
  escaped = escaped.replace(/\n/g, '<br>');
  
  return escaped;
}

// --- Helper Functions ---

// Expose copy function to window for onclick
window.copyCode = (btn, encodedText) => {
  const text = decodeURIComponent(encodedText);
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    const span = btn.querySelector('span');
    const orig = span.textContent;
    span.textContent = 'Done';
    setTimeout(() => {
      btn.classList.remove('copied');
      span.textContent = orig;
    }, 1200);
  });
};

function clearWelcome() {
  const welcome = messagesArea.querySelector('.welcome');
  if (welcome) welcome.remove();
}

window.useSuggestion = (text) => {
  inputText.value = text;
  sendMessage();
};

// --- Main Send Logic ---

async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || isGenerating || !engine) return;

  clearWelcome();
  
  // 1. Add User Message
  messagesArea.appendChild(createMessage(text, true));
  chatHistory.push({ role: "user", content: text });
  
  inputText.value = '';
  inputText.style.height = 'auto';
  
  // 2. Show Loading State
  setStatus('generating');
  isGenerating = true;
  const typingIndicator = createTypingIndicator();
  messagesArea.appendChild(typingIndicator);
  messagesArea.scrollTop = messagesArea.scrollHeight;

  try {
    // 3. Stream Response
    let fullResponse = "";
    
    const completion = await engine.chat.completions.create({
      messages: chatHistory,
      temperature: 0.7,
      stream: true, // Enable streaming
    });

    // Remove typing indicator once we start receiving data
    typingIndicator.remove();
    
    // Create empty message container for streaming text
    const skyMsg = createMessage("", false);
    messagesArea.appendChild(skyMsg);
    const contentWrapper = skyMsg.querySelector('.sky-content');

    // Process stream chunks
    for await (const chunk of completion) {
      const delta = chunk.choices[0].delta.content;
      if (delta) {
        fullResponse += delta;
        // Update HTML content in real-time
        contentWrapper.innerHTML = parseMarkdown(fullResponse);
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }
    }

    // Save complete response to history
    chatHistory.push({ role: "assistant", content: fullResponse });

  } catch (err) {
    console.error(err);
    typingIndicator.remove();
    const errorMsg = createMessage("Sorry, an error occurred during generation.", false);
    messagesArea.appendChild(errorMsg);
  } finally {
    isGenerating = false;
    setStatus('online');
  }
}

// --- Event Listeners ---

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

// --- Start Application ---
initEngine();
