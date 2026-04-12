/* ═══════════════════════════════════════════════════════
 * opensky — Free AI chat · OpenRouter auto-free model
 * ═══════════════════════════════════════════════════════ */

var BUILD_KEY = '__OPENKEY__';
var API_URL   = 'https://openrouter.ai/api/v1/chat/completions';
var MODEL     = 'openrouter/free';

/* ── State ── */
var convos        = JSON.parse(localStorage.getItem('os_convos') || '[]');
var activeId      = null;
var streaming     = false;
var abortCtrl     = null;

/* ── DOM ── */
var $list     = document.getElementById('chatList');
var $msgs     = document.getElementById('chatMessages');
var $area     = document.getElementById('chatArea');
var $input    = document.getElementById('messageInput');
var $send     = document.getElementById('sendBtn');
var $title    = document.getElementById('topbarTitle');
var $mLabel   = document.getElementById('modelLabel');
var $dot      = document.getElementById('statusDot');
var $side     = document.getElementById('sidebar');
var $over     = document.getElementById('sidebarOverlay');
var $toasts   = document.getElementById('toastContainer');
var $keyModal = document.getElementById('keyModal');
var $keyIn    = document.getElementById('keyInput');
var $keyStat  = document.getElementById('keyStatus');
var $keyBtn   = document.getElementById('keyBtn');

/* ═══════════════════════════════════════════════════════
 * API key — build-injected or user-supplied via modal
 * ═══════════════════════════════════════════════════════ */
function getKey() {
  var saved = localStorage.getItem('os_userkey');
  if (saved) return saved;
  if (BUILD_KEY !== '__OPENKEY__') return BUILD_KEY;
  return null;
}

function hasKey() { return getKey() !== null; }

function refreshKeyUI() {
  if (hasKey()) {
    $keyStat.textContent = 'Key set';
    $keyBtn.classList.add('active');
    $dot.classList.add('on');
  } else {
    $keyStat.textContent = 'Key not set';
    $keyBtn.classList.remove('active');
    $dot.classList.remove('on');
  }
}

 $keyBtn.addEventListener('click', function() {
  $keyIn.value = localStorage.getItem('os_userkey') || '';
  $keyModal.classList.add('open');
});

document.getElementById('keyCancel').addEventListener('click', function() {
  $keyModal.classList.remove('open');
});

document.getElementById('keySave').addEventListener('click', function() {
  var v = $keyIn.value.trim();
  if (v) {
    localStorage.setItem('os_userkey', v);
    refreshKeyUI();
    toast('API key saved', 'ok');
  } else {
    localStorage.removeItem('os_userkey');
    refreshKeyUI();
  }
  $keyModal.classList.remove('open');
});

 $keyModal.addEventListener('click', function(e) {
  if (e.target === $keyModal) $keyModal.classList.remove('open');
});

/* ═══════════════════════════════════════════════════════
 * Background — subtle floating particles
 * ═══════════════════════════════════════════════════════ */
(function() {
  var c = document.getElementById('bgCanvas');
  var ctx = c.getContext('2d');
  var pts = [];
  var N = 80;

  function resize() { c.width = innerWidth; c.height = innerHeight; }

  function seed() {
    pts = [];
    for (var i = 0; i < N; i++) {
      pts.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        r: Math.random() * 1.2 + 0.3,
        a: Math.random() * 0.25 + 0.03,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.1,
        ph: Math.random() * 6.28,
      });
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, c.width, c.height);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = c.width;
      if (p.x > c.width) p.x = 0;
      if (p.y < 0) p.y = c.height;
      if (p.y > c.height) p.y = 0;
      var fl = 0.5 + 0.5 * Math.sin(t * 0.0008 + p.ph);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, 6.2832);
      ctx.fillStyle = 'rgba(255,255,255,' + (p.a * fl).toFixed(3) + ')';
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  addEventListener('resize', function() { resize(); seed(); });
  resize(); seed(); requestAnimationFrame(draw);
})();

/* ═══════════════════════════════════════════════════════
 * Markdown
 * ═══════════════════════════════════════════════════════ */
function md(raw) {
  var h = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, lang, code) {
    var id = 'c' + Math.random().toString(36).slice(2,8);
    return '<pre><code id="'+id+'">'+code.trim()+'</code><button class="copy-code-btn" data-cid="'+id+'">Copy</button></pre>';
  });

  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  h = h.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  h = h.split(/\n\n+/).map(function(b) {
    b = b.trim();
    if (!b) return '';
    if (b.charAt(0) === '<') return b;
    return '<p>' + b.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  return h;
}

/* ═══════════════════════════════════════════════════════
 * Toast
 * ═══════════════════════════════════════════════════════ */
function toast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast ' + (type || 'err');
  var ic = type === 'ok' ? 'fa-check' : 'fa-xmark';
  el.innerHTML = '<i class="fas '+ic+'"></i><span>'+msg+'</span>';
  $toasts.appendChild(el);
  setTimeout(function() { el.remove(); }, 3200);
}

/* ═══════════════════════════════════════════════════════
 * Clipboard
 * ═══════════════════════════════════════════════════════ */
function clip(text) {
  navigator.clipboard.writeText(text).then(function() { toast('Copied', 'ok'); });
}

document.addEventListener('click', function(e) {
  var cb = e.target.closest('.copy-code-btn');
  if (cb) { var el = document.getElementById(cb.getAttribute('data-cid')); if (el) clip(el.textContent); return; }
  var mb = e.target.closest('.msg-bubble-copy');
  if (mb) clip(mb.getAttribute('data-t'));
  var mc = e.target.closest('.msg-ai-copy');
  if (mc) clip(mc.getAttribute('data-t'));
});

/* ═══════════════════════════════════════════════════════
 * Convo CRUD
 * ═══════════════════════════════════════════════════════ */
function save() { localStorage.setItem('os_convos', JSON.stringify(convos)); }

function active() {
  for (var i = 0; i < convos.length; i++) if (convos[i].id === activeId) return convos[i];
  return null;
}

function newChat() {
  var c = { id: 'c'+Date.now()+'_'+Math.random().toString(36).slice(2,6), title: 'New chat', msgs: [], ts: Date.now() };
  convos.unshift(c);
  save();
  activeId = c.id;
  renderList();
  renderMsgs();
  closeSide();
}

function pick(id) { activeId = id; renderList(); renderMsgs(); closeSide(); }

function del(id, e) {
  e.stopPropagation();
  convos = convos.filter(function(c){ return c.id !== id; });
  save();
  if (activeId === id) activeId = convos.length ? convos[0].id : null;
  renderList(); renderMsgs();
}

function clearChat() {
  var c = active();
  if (!c) return;
  c.msgs = []; c.title = 'New chat'; save(); renderList(); renderMsgs();
  toast('Chat cleared', 'ok');
}

function retitle(c) {
  if (c.msgs.length) { var s = c.msgs[0].t; c.title = s.length > 45 ? s.slice(0,45)+'...' : s; }
}

/* ── Render list ── */
function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function renderList() {
  if (!convos.length) { $list.innerHTML = '<div style="text-align:center;padding:36px 10px;color:var(--gray-2);font-size:12px;">No chats yet</div>'; return; }
  $list.innerHTML = convos.map(function(c) {
    return '<div class="chat-item'+(c.id===activeId?' active':'')+'" data-cid="'+c.id+'">'+
      '<span class="chat-item-label">'+esc(c.title)+'</span>'+
      '<button class="chat-item-del" data-did="'+c.id+'" aria-label="Delete"><i class="fas fa-xmark"></i></button></div>';
  }).join('');
}

 $list.addEventListener('click', function(e) {
  var d = e.target.closest('[data-did]');
  if (d) { del(d.getAttribute('data-did'), e); return; }
  var c = e.target.closest('[data-cid]');
  if (c) pick(c.getAttribute('data-cid'));
});

/* ═══════════════════════════════════════════════════════
 * Render messages
 * ═══════════════════════════════════════════════════════ */
var LOGO_SVG = '<svg class="msg-ai-icon" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg>';

function renderMsgs() {
  var c = active();
  if (!c || !c.msgs.length) {
    $title.textContent = 'opensky';
    $msgs.innerHTML = welcomeHTML();
    return;
  }
  $title.textContent = c.title;
  $msgs.innerHTML = c.msgs.map(function(m) {
    if (m.role === 'user') {
      var et = esc(m.t).replace(/"/g,'&quot;');
      return '<div class="msg-row user"><div class="msg-bubble">'+esc(m.t).replace(/\n/g,'<br>')+
        '<button class="msg-bubble-copy" data-t="'+et+'">Copy</button></div></div>';
    }
    var et2 = esc(m.t).replace(/"/g,'&quot;');
    return '<div class="msg-row assistant">'+
      '<div class="msg-ai-header">'+LOGO_SVG+'<span class="msg-ai-label">opensky</span></div>'+
      '<div class="msg-ai-body">'+md(m.t)+'</div>'+
      '<div class="msg-ai-footer"><button class="msg-ai-copy" data-t="'+et2+'">Copy</button></div></div>';
  }).join('');
  scrollEnd();
}

function welcomeHTML() {
  return '<div class="welcome">'+
    '<div class="welcome-logo"><svg style="width:48px;height:48px;opacity:.7" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg></div>'+
    '<h2>What can I help with?</h2>'+
    '<p>Free AI chat powered by OpenRouter. Start typing or try a prompt below.</p>'+
    '<div class="suggestions">'+
      '<button class="sugg" data-s="Explain quantum computing simply">Explain quantum computing simply</button>'+
      '<button class="sugg" data-s="Write a Python prime number function">Write a Python prime number function</button>'+
      '<button class="sugg" data-s="Best practices for REST API design">Best practices for REST API design</button>'+
      '<button class="sugg" data-s="Brainstorm a mobile app idea">Brainstorm a mobile app idea</button>'+
    '</div></div>';
}

 $msgs.addEventListener('click', function(e) {
  var s = e.target.closest('[data-s]');
  if (s) { $input.value = s.getAttribute('data-s'); resizeInput($input); send(); }
});

function scrollEnd() { requestAnimationFrame(function() { $area.scrollTop = $area.scrollHeight; }); }

/* ═══════════════════════════════════════════════════════
 * Input
 * ═══════════════════════════════════════════════════════ */
function resizeInput(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 150) + 'px'; }

 $input.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
 $input.addEventListener('input', function() { resizeInput($input); });

/* ═══════════════════════════════════════════════════════
 * Send & stream
 * ═══════════════════════════════════════════════════════ */
async function send() {
  var text = $input.value.trim();
  if (!text || streaming) return;

  if (!hasKey()) {
    $keyModal.classList.add('open');
    toast('Set your API key first', 'err');
    return;
  }

  if (!activeId) newChat();
  var c = active();

  c.msgs.push({ role: 'user', t: text });
  retitle(c);
  save();

  $input.value = '';
  $input.style.height = 'auto';
  renderList();
  renderMsgs();

  streaming = true;
  setSendBtn();

  var tip = document.createElement('div');
  tip.className = 'msg-row assistant';
  tip.id = 'typingRow';
  tip.innerHTML = '<div class="msg-ai-header">'+LOGO_SVG+'<span class="msg-ai-label">opensky</span></div>'+
    '<div class="msg-ai-body"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  $msgs.appendChild(tip);
  scrollEnd();

  var apiMsgs = c.msgs.map(function(m) { return { role: m.role, content: m.t }; });
  abortCtrl = new AbortController();

  try {
    var res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + getKey(),
        'Content-Type': 'application/json',
        'HTTP-Referer': location.href,
        'X-Title': 'opensky',
      },
      body: JSON.stringify({ model: MODEL, messages: apiMsgs, stream: true }),
      signal: abortCtrl.signal,
    });

    if (!res.ok) {
      var ej = await res.json().catch(function(){ return {}; });
      throw new Error((ej.error && ej.error.message) || ('HTTP ' + res.status));
    }

    var row = document.getElementById('typingRow');
    row.id = 'streamRow';
    var body = row.querySelector('.msg-ai-body');
    body.innerHTML = '';

    var um = res.headers.get('x-model-used') || res.headers.get('openrouter-model');
    if (um) $mLabel.textContent = um;

    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var full = '';
    var buf = '';

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      var lines = buf.split('\n');
      buf = lines.pop() || '';
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].trim();
        if (!ln || ln.indexOf('data:') !== 0) continue;
        var d = ln.slice(5).trim();
        if (d === '[DONE]') continue;
        try {
          var j = JSON.parse(d);
          var delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (delta) { full += delta; body.innerHTML = md(full); scrollEnd(); }
        } catch(_) {}
      }
    }

    c.msgs.push({ role: 'assistant', t: full });
    save();
    renderMsgs();

  } catch(err) {
    if (err.name === 'AbortError') {
      var el = document.getElementById('typingRow') || document.getElementById('streamRow');
      if (el) {
        var p = el.querySelector('.msg-ai-body');
        if (p && p.textContent.trim()) { c.msgs.push({ role: 'assistant', t: p.textContent }); save(); }
      }
      renderMsgs();
      toast('Stopped', 'ok');
    } else {
      var t = document.getElementById('typingRow');
      if (t) t.remove();
      toast(err.message || 'Request failed', 'err');
    }
  } finally {
    streaming = false;
    abortCtrl = null;
    setSendBtn();
  }
}

function stopGen() { if (abortCtrl) abortCtrl.abort(); }

function setSendBtn() {
  if (streaming) {
    $send.className = 'send-btn stop';
    $send.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>';
    $send.onclick = stopGen;
  } else {
    $send.className = 'send-btn';
    $send.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    $send.onclick = send;
  }
}

/* ═══════════════════════════════════════════════════════
 * Sidebar
 * ═══════════════════════════════════════════════════════ */
function closeSide() { $side.classList.remove('open'); $over.classList.remove('show'); }

document.getElementById('menuToggle').addEventListener('click', function() {
  $side.classList.toggle('open');
  $over.classList.toggle('show');
});
 $over.addEventListener('click', closeSide);
document.getElementById('newChatBtn').addEventListener('click', newChat);
document.getElementById('clearChatBtn').addEventListener('click', clearChat);

/* ═══════════════════════════════════════════════════════
 * Init
 * ═══════════════════════════════════════════════════════ */
(function() {
  if (convos.length) activeId = convos[0].id;
  refreshKeyUI();
  renderList();
  renderMsgs();
  setSendBtn();
  $input.focus();
})();
