/* ═══════════════════════════════════════════════════════════════
 * opensky — Free AI chat powered by OpenRouter
 * API key injected at build time from GitHub secret: OPENKEY
 * ═══════════════════════════════════════════════════════════════ */

// ─── Configuration ────────────────────────────────────────────
const API_KEY = '__OPENKEY_PLACEHOLDER__';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL   = 'openrouter/free';

// ─── State ────────────────────────────────────────────────────
let conversations  = JSON.parse(localStorage.getItem('opensky_convos') || '[]');
let activeConvoId  = null;
let isStreaming    = false;
let abortController = null;

// ─── DOM references ───────────────────────────────────────────
const $chatList     = document.getElementById('chatList');
const $chatMessages = document.getElementById('chatMessages');
const $chatArea     = document.getElementById('chatArea');
const $input        = document.getElementById('messageInput');
const $sendBtn      = document.getElementById('sendBtn');
const $topbarTitle  = document.getElementById('topbarTitle');
const $modelLabel   = document.getElementById('modelLabel');
const $sidebar      = document.getElementById('sidebar');
const $overlay      = document.getElementById('sidebarOverlay');
const $toasts       = document.getElementById('toastContainer');

// ═══════════════════════════════════════════════════════════════
// Starfield background
// ═══════════════════════════════════════════════════════════════
(function initStarfield() {
  const canvas = document.getElementById('starfield');
  const ctx    = canvas.getContext('2d');
  let stars    = [];
  const COUNT  = 160;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.2,
        alpha: Math.random() * 0.6 + 0.08,
        speed: Math.random() * 0.3 + 0.05,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      const flicker = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed * 10 + s.phase);
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.1, s.r), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + (s.alpha * flicker).toFixed(3) + ')';
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); createStars(); });
  resize();
  createStars();
  requestAnimationFrame(draw);
})();

// ═══════════════════════════════════════════════════════════════
// Markdown parser
// ═══════════════════════════════════════════════════════════════
function parseMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Fenced code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, lang, code) {
    const id = 'code_' + Math.random().toString(36).slice(2, 8);
    return '<pre><code id="' + id + '">' + code.trim() + '</code>' +
           '<button class="copy-code-btn" data-code-id="' + id + '">Copy</button></pre>';
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs
  html = html.split(/\n\n+/).map(function(block) {
    block = block.trim();
    if (!block) return '';
    var tag = block.charAt(0) === '<' ? '' : '<p>';
    var end = block.charAt(0) === '<' ? '' : '</p>';
    return tag + block.replace(/\n/g, '<br>') + end;
  }).join('\n');

  return html;
}

// ═══════════════════════════════════════════════════════════════
// Toast notifications
// ═══════════════════════════════════════════════════════════════
function showToast(message, type) {
  type = type || 'error';
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  var icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
  toast.innerHTML = '<i class="fas ' + icon + ' toast-icon"></i><span>' + message + '</span>';
  $toasts.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3500);
}

// ═══════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(function() {
    showToast('Copied to clipboard', 'success');
  });
}

// Delegate click for copy-code buttons (avoids inline onclick with escaping issues)
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.copy-code-btn');
  if (btn) {
    var id = btn.getAttribute('data-code-id');
    var el = document.getElementById(id);
    if (el) copyToClipboard(el.textContent);
    return;
  }

  // Copy message buttons
  var msgBtn = e.target.closest('.msg-copy-btn');
  if (msgBtn) {
    copyToClipboard(msgBtn.getAttribute('data-msg'));
  }
});

// ═══════════════════════════════════════════════════════════════
// Conversations management
// ═══════════════════════════════════════════════════════════════
function saveConversations() {
  localStorage.setItem('opensky_convos', JSON.stringify(conversations));
}

function getActiveConvo() {
  for (var i = 0; i < conversations.length; i++) {
    if (conversations[i].id === activeConvoId) return conversations[i];
  }
  return null;
}

function createNewChat() {
  var convo = {
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    title: 'New Conversation',
    messages: [],
    createdAt: Date.now(),
  };
  conversations.unshift(convo);
  saveConversations();
  activeConvoId = convo.id;
  renderChatList();
  renderMessages();
  closeSidebar();
}

function switchChat(id) {
  activeConvoId = id;
  renderChatList();
  renderMessages();
  closeSidebar();
}

function deleteChat(id, e) {
  e.stopPropagation();
  conversations = conversations.filter(function(c) { return c.id !== id; });
  saveConversations();
  if (activeConvoId === id) {
    activeConvoId = conversations.length > 0 ? conversations[0].id : null;
  }
  renderChatList();
  renderMessages();
}

function clearCurrentChat() {
  var convo = getActiveConvo();
  if (!convo) return;
  convo.messages = [];
  convo.title = 'New Conversation';
  saveConversations();
  renderChatList();
  renderMessages();
  showToast('Chat cleared', 'success');
}

function updateConvoTitle(convo) {
  if (convo.messages.length >= 1) {
    var first = convo.messages[0].content;
    convo.title = first.length > 50 ? first.slice(0, 50) + '...' : first;
  }
}

// ═══════════════════════════════════════════════════════════════
// Render sidebar chat list
// ═══════════════════════════════════════════════════════════════
function renderChatList() {
  if (conversations.length === 0) {
    $chatList.innerHTML = '<div style="text-align:center;padding:40px 10px;color:var(--text-muted);font-size:13px;">No conversations yet</div>';
    return;
  }

  $chatList.innerHTML = conversations.map(function(c) {
    var isActive = c.id === activeConvoId;
    return '<div class="chat-item ' + (isActive ? 'active' : '') + '" data-convo-id="' + c.id + '">' +
      '<div class="chat-item-icon"><i class="fas fa-message"></i></div>' +
      '<span class="chat-item-text">' + escapeHtml(c.title) + '</span>' +
      '<button class="chat-item-delete" data-delete-id="' + c.id + '" title="Delete"><i class="fas fa-trash"></i></button>' +
      '</div>';
  }).join('');
}

// Delegate clicks on chat list
 $chatList.addEventListener('click', function(e) {
  var deleteBtn = e.target.closest('[data-delete-id]');
  if (deleteBtn) {
    deleteChat(deleteBtn.getAttribute('data-delete-id'), e);
    return;
  }
  var item = e.target.closest('[data-convo-id]');
  if (item) switchChat(item.getAttribute('data-convo-id'));
});

// ═══════════════════════════════════════════════════════════════
// Render messages
// ═══════════════════════════════════════════════════════════════
function renderMessages() {
  var convo = getActiveConvo();

  if (!convo || convo.messages.length === 0) {
    $topbarTitle.textContent = 'New Conversation';
    $chatMessages.innerHTML = buildWelcome();
    if (API_KEY === '__OPENKEY_PLACEHOLDER__') {
      $chatMessages.innerHTML += '<div class="key-warning">' +
        '<i class="fas fa-exclamation-triangle"></i>' +
        '<span>API key not configured. Set the <strong>OPENKEY</strong> secret in your GitHub repo and redeploy.</span>' +
        '</div>';
    }
    return;
  }

  $topbarTitle.textContent = convo.title;

  $chatMessages.innerHTML = convo.messages.map(function(msg) {
    var avatarIcon = msg.role === 'user' ? 'fa-user' : 'fa-paper-plane';
    var roleLabel  = msg.role === 'user' ? 'You' : 'opensky';
    var body       = msg.role === 'user'
      ? escapeHtml(msg.content).replace(/\n/g, '<br>')
      : parseMarkdown(msg.content);
    var escaped    = escapeHtml(msg.content).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    return '<div class="message ' + msg.role + '">' +
      '<div class="message-avatar"><i class="fas ' + avatarIcon + '"></i></div>' +
      '<div class="message-content">' +
        '<div class="message-role">' + roleLabel + '</div>' +
        '<div class="message-text">' + body + '</div>' +
        '<div class="message-actions">' +
          '<button class="msg-action-btn msg-copy-btn" data-msg="' + escaped + '" title="Copy"><i class="fas fa-copy"></i></button>' +
        '</div>' +
      '</div>' +
      '</div>';
  }).join('');

  scrollToBottom();
}

function buildWelcome() {
  return '<div class="welcome">' +
    '<div class="welcome-icon"><i class="fas fa-paper-plane"></i></div>' +
    '<h2>Welcome to opensky</h2>' +
    '<p>Chat with AI models for free, powered by OpenRouter. Start a conversation below or pick a suggestion.</p>' +
    '<div class="welcome-suggestions">' +
      '<button class="suggestion-card" data-sugg="Explain quantum computing in simple terms">' +
        '<span class="sugg-icon"><i class="fas fa-atom"></i></span>' +
        'Explain quantum computing in simple terms</button>' +
      '<button class="suggestion-card" data-sugg="Write a Python function to find prime numbers">' +
        '<span class="sugg-icon"><i class="fas fa-code"></i></span>' +
        'Write a Python function to find prime numbers</button>' +
      '<button class="suggestion-card" data-sugg="What are the best practices for REST API design?">' +
        '<span class="sugg-icon"><i class="fas fa-server"></i></span>' +
        'What are the best practices for REST API design?</button>' +
      '<button class="suggestion-card" data-sugg="Help me brainstorm ideas for a mobile app">' +
        '<span class="sugg-icon"><i class="fas fa-lightbulb"></i></span>' +
        'Help me brainstorm ideas for a mobile app</button>' +
    '</div>' +
  '</div>';
}

// Delegate suggestion clicks
 $chatMessages.addEventListener('click', function(e) {
  var card = e.target.closest('[data-sugg]');
  if (card) {
    $input.value = card.getAttribute('data-sugg');
    autoResize($input);
    handleSend();
  }
});

function scrollToBottom() {
  requestAnimationFrame(function() {
    $chatArea.scrollTop = $chatArea.scrollHeight;
  });
}

// ═══════════════════════════════════════════════════════════════
// Input handling
// ═══════════════════════════════════════════════════════════════
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

 $input.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

 $input.addEventListener('input', function() {
  autoResize($input);
});

// ═══════════════════════════════════════════════════════════════
// Send message & stream response
// ═══════════════════════════════════════════════════════════════
async function handleSend() {
  var text = $input.value.trim();
  if (!text || isStreaming) return;

  // Validate API key
  if (API_KEY === '__OPENKEY_PLACEHOLDER__') {
    showToast('API key not configured. Set OPENKEY secret in GitHub repo settings.', 'error');
    return;
  }

  // Ensure active conversation
  if (!activeConvoId) createNewChat();
  var convo = getActiveConvo();

  // Add user message
  convo.messages.push({ role: 'user', content: text });
  updateConvoTitle(convo);
  saveConversations();

  $input.value = '';
  $input.style.height = 'auto';
  renderChatList();
  renderMessages();

  // Start streaming
  isStreaming = true;
  updateSendButton();

  // Typing indicator
  var typingEl = document.createElement('div');
  typingEl.className = 'message assistant';
  typingEl.id = 'typingMsg';
  typingEl.innerHTML =
    '<div class="message-avatar"><i class="fas fa-paper-plane"></i></div>' +
    '<div class="message-content">' +
      '<div class="message-role">opensky</div>' +
      '<div class="typing-indicator"><span></span><span></span><span></span></div>' +
    '</div>';
  $chatMessages.appendChild(typingEl);
  scrollToBottom();

  // Build API messages array
  var apiMessages = convo.messages.map(function(m) {
    return { role: m.role, content: m.content };
  });

  abortController = new AbortController();

  try {
    var response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.href,
        'X-Title': 'opensky',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: apiMessages,
        stream: true,
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      throw new Error((errData.error && errData.error.message) || ('API error: ' + response.status));
    }

    // Replace typing indicator with streaming element
    var streamEl = document.getElementById('typingMsg');
    streamEl.id = 'streamMsg';
    var textDiv = streamEl.querySelector('.typing-indicator');
    textDiv.className = 'message-text';
    textDiv.innerHTML = '';

    // Update model label from headers
    var usedModel = response.headers.get('x-model-used') || response.headers.get('openrouter-model');
    if (usedModel) $modelLabel.textContent = usedModel;

    // Read stream
    var reader  = response.body.getReader();
    var decoder = new TextDecoder();
    var fullContent = '';
    var buffer = '';

    while (true) {
      var result = await reader.read();
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (var i = 0; i < lines.length; i++) {
        var trimmed = lines[i].trim();
        if (!trimmed || trimmed.indexOf('data:') !== 0) continue;
        var data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          var json  = JSON.parse(data);
          var delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
          if (delta) {
            fullContent += delta;
            textDiv.innerHTML = parseMarkdown(fullContent);
            scrollToBottom();
          }
        } catch (parseErr) {
          // Skip malformed chunks
        }
      }
    }

    // Finalize
    convo.messages.push({ role: 'assistant', content: fullContent });
    saveConversations();
    renderMessages();

  } catch (err) {
    if (err.name === 'AbortError') {
      // User stopped — save partial content if any
      var el = document.getElementById('typingMsg') || document.getElementById('streamMsg');
      if (el) {
        var partial = el.querySelector('.message-text');
        if (partial && partial.textContent.trim()) {
          convo.messages.push({ role: 'assistant', content: partial.textContent });
          saveConversations();
        }
      }
      renderMessages();
      showToast('Generation stopped', 'success');
    } else {
      var typing = document.getElementById('typingMsg');
      if (typing) typing.remove();
      showToast(err.message || 'Failed to get response', 'error');
      console.error('OpenRouter error:', err);
    }
  } finally {
    isStreaming = false;
    abortController = null;
    updateSendButton();
  }
}

function stopGeneration() {
  if (abortController) abortController.abort();
}

function updateSendButton() {
  if (isStreaming) {
    $sendBtn.className = 'send-btn stop';
    $sendBtn.innerHTML = '<i class="fas fa-stop"></i>';
    $sendBtn.onclick = stopGeneration;
  } else {
    $sendBtn.className = 'send-btn';
    $sendBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    $sendBtn.onclick = handleSend;
  }
}

// ═══════════════════════════════════════════════════════════════
// Sidebar toggle
// ═══════════════════════════════════════════════════════════════
function toggleSidebar() {
  $sidebar.classList.toggle('open');
  $overlay.classList.toggle('show');
}

function closeSidebar() {
  $sidebar.classList.remove('open');
  $overlay.classList.remove('show');
}

document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
 $overlay.addEventListener('click', closeSidebar);
document.getElementById('newChatBtn').addEventListener('click', createNewChat);
document.getElementById('clearChatBtn').addEventListener('click', clearCurrentChat);

// ═══════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════
(function init() {
  if (conversations.length > 0) {
    activeConvoId = conversations[0].id;
  }
  renderChatList();
  renderMessages();
  updateSendButton();
  $input.focus();
})();
