/* ═══════════════════════════════════════════════════════
 * opensky — Full-featured agentic AI chat
 * ═══════════════════════════════════════════════════════ */

var BUILD_KEY = '__OPENKEY__';
var API_URL = 'https://openrouter.ai/api/v1/chat/completions';
var MODEL = 'openrouter/free';

var LOGO = '<svg class="msg-ai-icon" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg>';

/* ── State ── */
var convos = JSON.parse(localStorage.getItem('os_convos') || '[]');
var activeId = null;
var streaming = false;
var abortCtrl = null;
var autoScroll = true;
var pendingFiles = [];
var thinkingTimer = null;
var thinkStepIdx = 0;

/* ── DOM ── */
var $list = document.getElementById('chatList');
var $msgs = document.getElementById('chatMessages');
var $area = document.getElementById('chatArea');
var $input = document.getElementById('messageInput');
var $send = document.getElementById('sendBtn');
var $title = document.getElementById('topbarTitle');
var $modeT = document.getElementById('topbarMode');
var $mLabel = document.getElementById('modelLabel');
var $dot = document.getElementById('statusDot');
var $side = document.getElementById('sidebar');
var $over = document.getElementById('sidebarOverlay');
var $toasts = document.getElementById('toastContainer');
var $fPreview = document.getElementById('filePreview');
var $fInput = document.getElementById('fileInput');
var $micBtn = document.getElementById('micBtn');

/* ═══════════════════════════════════════════════════════
 * API key
 * ═══════════════════════════════════════════════════════ */
function getKey() {
  var s = localStorage.getItem('os_userkey');
  if (s && s.length > 5) return s;
  if (BUILD_KEY !== '__OPENKEY__' && BUILD_KEY.length > 5) return BUILD_KEY;
  return null;
}
function hasKey() { return getKey() !== null; }
function refreshKeyUI() { if (hasKey()) $dot.classList.add('on'); else $dot.classList.remove('on'); }

/* ═══════════════════════════════════════════════════════
 * Smart scroll — don't pull down if user scrolled up
 * ═══════════════════════════════════════════════════════ */
 $area.addEventListener('scroll', function() {
  autoScroll = ($area.scrollHeight - $area.scrollTop - $area.clientHeight) < 80;
});

function smartScroll() {
  if (autoScroll) requestAnimationFrame(function() { $area.scrollTop = $area.scrollHeight; });
}

function forceScroll() {
  autoScroll = true;
  requestAnimationFrame(function() { $area.scrollTop = $area.scrollHeight; });
}

/* ═══════════════════════════════════════════════════════
 * Background
 * ═══════════════════════════════════════════════════════ */
(function() {
  var c = document.getElementById('bgCanvas'), ctx = c.getContext('2d'), pts = [], N = 50;
  function resize() { c.width = innerWidth; c.height = innerHeight; }
  function seed() {
    pts = [];
    for (var i = 0; i < N; i++) pts.push({
      x: Math.random() * c.width, y: Math.random() * c.height,
      r: Math.random() * .8 + .15, a: Math.random() * .12 + .015,
      vx: (Math.random() - .5) * .08, vy: (Math.random() - .5) * .06, ph: Math.random() * 6.28
    });
  }
  function draw(t) {
    ctx.clearRect(0, 0, c.width, c.height);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i]; p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
      if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
      var f = .5 + .5 * Math.sin(t * .0005 + p.ph);
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.1, p.r), 0, 6.2832);
      ctx.fillStyle = 'rgba(255,255,255,' + (p.a * f).toFixed(4) + ')'; ctx.fill();
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
  var h = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, lang, code) {
    var id = 'c' + Math.random().toString(36).slice(2, 8);
    var ext = lang || 'txt';
    return '<pre><code id="' + id + '">' + code.trim() + '</code>' +
      '<button class="copy-code-btn" data-cid="' + id + '">Copy</button>' +
      '<button class="copy-code-btn" data-cid-dl="' + id + '" data-ext="' + ext + '">Save</button></pre>';
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
    b = b.trim(); if (!b) return '';
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
  el.innerHTML = '<i class="fas ' + (type === 'ok' ? 'fa-check' : 'fa-xmark') + '"></i><span>' + msg + '</span>';
  $toasts.appendChild(el);
  setTimeout(function() { el.remove(); }, 3000);
}

/* ═══════════════════════════════════════════════════════
 * Clipboard & Download
 * ═══════════════════════════════════════════════════════ */
function clip(t) { navigator.clipboard.writeText(t).then(function() { toast('Copied', 'ok'); }); }

function dl(content, name, mime) {
  var b = new Blob([content], { type: mime || 'text/plain' });
  var u = URL.createObjectURL(b);
  var a = document.createElement('a'); a.href = u; a.download = name; a.click();
  URL.revokeObjectURL(u);
}

document.addEventListener('click', function(e) {
  var cb = e.target.closest('.copy-code-btn[data-cid]');
  if (cb) { var el = document.getElementById(cb.getAttribute('data-cid')); if (el) clip(el.textContent); return; }
  var cdl = e.target.closest('.copy-code-btn[data-cid-dl]');
  if (cdl) {
    var el2 = document.getElementById(cdl.getAttribute('data-cid-dl'));
    if (el2) dl(el2.textContent, 'code.' + (cdl.getAttribute('data-ext') || 'txt'), 'text/plain');
    return;
  }
  var mb = e.target.closest('.msg-bubble-copy');
  if (mb) clip(mb.getAttribute('data-t'));
  var mc = e.target.closest('[data-ai-copy]');
  if (mc) clip(mc.getAttribute('data-ai-copy'));
  var md2 = e.target.closest('[data-ai-dl]');
  if (md2) dl(md2.getAttribute('data-ai-dl'), 'opensky-response.md', 'text/markdown');
});

/* ═══════════════════════════════════════════════════════
 * File handling
 * ═══════════════════════════════════════════════════════ */
document.getElementById('uploadBtn').addEventListener('click', function() { $fInput.click(); });
 $fInput.addEventListener('change', function() {
  Array.from($fInput.files).forEach(addFile); $fInput.value = '';
});

function addFile(file) {
  var entry = { name: file.name, size: file.size, type: '', mime: file.type, data: null, thumb: null };
  var isImg = file.type.startsWith('image/');
  var isVid = file.type.startsWith('video/');
  var isTxt = !isImg && !isVid && file.size < 500000;

  if (isImg) {
    entry.type = 'image';
    var r = new FileReader();
    r.onload = function(e) {
      entry.data = e.target.result.split(',')[1];
      entry.thumb = e.target.result;
      pendingFiles.push(entry); renderFP();
    };
    r.readAsDataURL(file);
  } else if (isVid) {
    entry.type = 'video';
    extractFrame(file).then(function(d) {
      entry.data = d ? d.split(',')[1] : null;
      entry.thumb = d; entry.isVideo = true;
      pendingFiles.push(entry); renderFP();
    });
  } else if (isTxt) {
    entry.type = 'document';
    var r2 = new FileReader();
    r2.onload = function(e) {
      entry.data = e.target.result;
      pendingFiles.push(entry); renderFP();
    };
    r2.readAsText(file);
  } else {
    toast('Unsupported or too large', 'err');
  }
}

function extractFrame(file) {
  return new Promise(function(res) {
    try {
      var v = document.createElement('video');
      v.muted = true; v.preload = 'auto';
      v.onloadeddata = function() { v.currentTime = Math.min(1, v.duration * .1); };
      v.onseeked = function() {
        var cv = document.createElement('canvas');
        cv.width = v.videoWidth || 320; cv.height = v.videoHeight || 240;
        cv.getContext('2d').drawImage(v, 0, 0);
        res(cv.toDataURL('image/jpeg', .6));
      };
      v.onerror = function() { res(null); };
      v.src = URL.createObjectURL(file);
      setTimeout(function() { res(null); }, 5000);
    } catch (e) { res(null); }
  });
}

function renderFP() {
  $fPreview.innerHTML = pendingFiles.map(function(f, i) {
    var img = f.thumb ? '<img src="' + f.thumb + '" alt="">' : '';
    return '<div class="fp-item">' + img + '<span>' + esc(f.name) + '</span>' +
      '<button class="fp-remove" data-fi="' + i + '">&times;</button></div>';
  }).join('');
}

 $fPreview.addEventListener('click', function(e) {
  var b = e.target.closest('.fp-remove');
  if (b) { pendingFiles.splice(parseInt(b.getAttribute('data-fi')), 1); renderFP(); }
});

/* ═══════════════════════════════════════════════════════
 * Mic
 * ═══════════════════════════════════════════════════════ */
var recognition = null, micOn = false;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR(); recognition.continuous = false; recognition.interimResults = true; recognition.lang = 'en-US';
  recognition.onresult = function(e) {
    var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    $input.value = t; resizeInput($input);
  };
  recognition.onend = function() { micOff(); };
  recognition.onerror = function() { micOff(); };
}
 $micBtn.addEventListener('click', function() {
  if (!recognition) { toast('Speech not supported', 'err'); return; }
  if (micOn) { recognition.stop(); micOff(); } else { recognition.start(); micOn = true; $micBtn.classList.add('recording'); }
});
function micOff() { micOn = false; $micBtn.classList.remove('recording'); }

/* ═══════════════════════════════════════════════════════
 * Mode switching
 * ═══════════════════════════════════════════════════════ */
document.getElementById('modeSelector').addEventListener('click', function(e) {
  var b = e.target.closest('.mode-btn'); if (!b) return;
  Agent.setMode(b.getAttribute('data-mode'));
  document.querySelectorAll('.mode-btn').forEach(function(x) { x.classList.remove('active'); });
  b.classList.add('active');
  $modeT.textContent = Agent.getModeLabel();
  /* Subtle topbar flash */
  $modeT.style.background = 'var(--border-2)';
  setTimeout(function() { $modeT.style.background = ''; }, 300);
});

/* ═══════════════════════════════════════════════════════
 * Convo CRUD
 * ═══════════════════════════════════════════════════════ */
function save() { localStorage.setItem('os_convos', JSON.stringify(convos)); }
function getActive() { for (var i = 0; i < convos.length; i++) if (convos[i].id === activeId) return convos[i]; return null; }

function newChat() {
  var c = { id: 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), title: 'New chat', msgs: [], mode: Agent.getMode(), ts: Date.now() };
  convos.unshift(c); save(); activeId = c.id; renderList(); renderMsgs(); closeSide();
}
function pick(id) { activeId = id; renderList(); renderMsgs(); closeSide(); }
function del(id, e) {
  e.stopPropagation();
  convos = convos.filter(function(c) { return c.id !== id; }); save();
  if (activeId === id) activeId = convos.length ? convos[0].id : null;
  renderList(); renderMsgs();
}
function clearChat() {
  var c = getActive(); if (!c) return;
  c.msgs = []; c.title = 'New chat'; save(); renderList(); renderMsgs(); toast('Cleared', 'ok');
}
function retitle(c) {
  if (c.msgs.length) { var s = c.msgs[0].t; c.title = s.length > 38 ? s.slice(0, 38) + '...' : s; }
}
function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function renderList() {
  if (!convos.length) { $list.innerHTML = '<div style="text-align:center;padding:28px 8px;color:var(--g3);font-size:10px">No chats yet</div>'; return; }
  $list.innerHTML = convos.map(function(c) {
    return '<div class="chat-item' + (c.id === activeId ? ' active' : '') + '" data-cid="' + c.id + '">' +
      '<span class="chat-item-label">' + esc(c.title) + '</span>' +
      '<button class="chat-item-del" data-did="' + c.id + '"><i class="fas fa-xmark"></i></button></div>';
  }).join('');
}
 $list.addEventListener('click', function(e) {
  var d = e.target.closest('[data-did]'); if (d) { del(d.getAttribute('data-did'), e); return; }
  var c = e.target.closest('[data-cid]'); if (c) pick(c.getAttribute('data-cid'));
});

/* ═══════════════════════════════════════════════════════
 * Render messages
 * ═══════════════════════════════════════════════════════ */
function renderMsgs() {
  var c = getActive();
  if (!c || !c.msgs.length) {
    $title.textContent = 'opensky';
    $msgs.innerHTML = welcomeHTML();
    if (!localStorage.getItem('os_privacy_ok')) $msgs.innerHTML += privacyHTML();
    if (!hasKey()) $msgs.innerHTML += keyHTML();
    return;
  }
  $title.textContent = c.title;
  $msgs.innerHTML = c.msgs.map(function(m) {
    return m.role === 'user' ? renderUser(m) : renderAI(m);
  }).join('');
  forceScroll();
}

function renderUser(m) {
  var fh = '';
  if (m.files && m.files.length) {
    fh = '<div class="msg-files">';
    m.files.forEach(function(f) {
      if (f.type === 'image' && f.thumb) fh += '<img class="msg-file-thumb" src="' + f.thumb + '" alt="' + esc(f.name) + '">';
      else fh += '<span class="msg-file-chip"><i class="fas fa-file" style="font-size:9px"></i> ' + esc(f.name) + '</span>';
    });
    fh += '</div>';
  }
  var et = esc(m.t).replace(/"/g, '&quot;');
  return '<div class="msg-row user"><div class="msg-bubble">' + fh +
    '<div>' + esc(m.t).replace(/\n/g, '<br>') + '</div>' +
    '<button class="msg-bubble-copy" data-t="' + et + '">Copy</button></div></div>';
}

function renderAI(m) {
  var et = esc(m.t).replace(/"/g, '&quot;');
  var follows = '';
  if (m.followUps && m.followUps.length) {
    follows = '<div class="follow-ups">';
    m.followUps.forEach(function(f) { follows += '<button class="follow-up-chip" data-fu="' + esc(f).replace(/"/g, '&quot;') + '">' + esc(f) + '</button>'; });
    follows += '</div>';
  }
  return '<div class="msg-row assistant">' +
    '<div class="msg-ai-header">' + LOGO + '<span class="msg-ai-label">opensky</span></div>' +
    '<div class="msg-ai-body">' + md(m.t) + '</div>' + follows +
    '<div class="msg-ai-footer">' +
    '<button class="msg-ai-action" data-ai-copy="' + et + '"><i class="fas fa-copy"></i> Copy</button>' +
    '<button class="msg-ai-action" data-ai-dl="' + et + '"><i class="fas fa-download"></i> .md</button>' +
    '<button class="msg-ai-action" data-regen="' + et + '"><i class="fas fa-rotate"></i> Redo</button>' +
    '</div></div>';
}

function privacyHTML() {
  return '<div class="privacy-banner" id="privacyBanner">' +
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v4c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1z" stroke="currentColor" stroke-width="1.1"/></svg>' +
    '<span>Please do not upload any personal, confidential, or otherwise sensitive information.</span>' +
    '<button class="privacy-banner-close" id="privacyClose">&times;</button></div>';
}

function keyHTML() {
  return '<div class="key-banner">' +
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5a3.5 3.5 0 00-3 5.2L3 12.2V15h2.8l5.5-5.5A3.5 3.5 0 0011.5 1.5z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '<span>API key not set. Run <code>OPENKEY=sk-or-... node script.js</code> then serve the files.</span></div>';
}

function welcomeHTML() {
  return '<div class="welcome">' +
    '<div class="welcome-logo"><svg style="width:42px;height:42px" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg></div>' +
    '<h2>What can I help with?</h2>' +
    '<p>Free AI by opensky. Upload files, use voice, switch modes for research or vibe coding.</p>' +
    '<div class="suggestions">' +
    '<button class="sugg" data-s="Explain how transformers work in deep learning">How do transformers work?</button>' +
    '<button class="sugg" data-s="Build a full-stack todo app with Node.js and SQLite">Build a todo app</button>' +
    '<button class="sugg" data-s="Research the tradeoffs between serverless and containerized deployments">Serverless vs containers</button>' +
    '<button class="sugg" data-s="Who created you and what are your capabilities?">Who are you?</button>' +
    '</div></div>';
}

/* Privacy dismiss */
 $msgs.addEventListener('click', function(e) {
  if (e.target.closest('#privacyClose')) {
    localStorage.setItem('os_privacy_ok', '1');
    var b = document.getElementById('privacyBanner');
    if (b) { b.style.opacity = '0'; b.style.transform = 'translateY(-8px)'; setTimeout(function() { b.remove(); }, 250); }
    return;
  }
  var s = e.target.closest('[data-s]');
  if (s) { $input.value = s.getAttribute('data-s'); resizeInput($input); send(); return; }
  var fu = e.target.closest('[data-fu]');
  if (fu) { $input.value = fu.getAttribute('data-fu'); resizeInput($input); send(); return; }
  var rg = e.target.closest('[data-regen]');
  if (rg) { regenerate(); }
});

/* ═══════════════════════════════════════════════════════
 * Download chat
 * ═══════════════════════════════════════════════════════ */
document.getElementById('downloadChatBtn').addEventListener('click', function() {
  var c = getActive(); if (!c || !c.msgs.length) { toast('Nothing to download', 'err'); return; }
  var out = '# ' + c.title + '\n\n';
  c.msgs.forEach(function(m) {
    out += '### ' + (m.role === 'user' ? 'You' : 'opensky') + '\n\n' + m.t + '\n\n---\n\n';
  });
  dl(out, c.title.replace(/[^a-z0-9]/gi, '_') + '.md', 'text/markdown');
  toast('Downloaded', 'ok');
});

/* ═══════════════════════════════════════════════════════
 * Regenerate last response
 * ═══════════════════════════════════════════════════════ */
async function regenerate() {
  var c = getActive(); if (!c || streaming) return;
  /* Remove last assistant message */
  if (c.msgs.length && c.msgs[c.msgs.length - 1].role === 'assistant') {
    c.msgs.pop(); save(); renderMsgs();
  }
  /* Resend with empty input */
  $input.value = ' ';
  await send();
}

/* ═══════════════════════════════════════════════════════
 * Input
 * ═══════════════════════════════════════════════════════ */
function resizeInput(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 130) + 'px'; }
 $input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
 $input.addEventListener('input', function() { resizeInput($input); });

/* ═══════════════════════════════════════════════════════
 * Generate follow-up suggestions from response
 * ═══════════════════════════════════════════════════════ */
function generateFollowUps(text) {
  var follows = [];
  var lines = text.split('\n').filter(function(l) { return l.trim().length > 10; });

  /* Extract questions from the response */
  var questions = text.match(/(?:^|\n)[^\n]*\?/g);
  if (questions && questions.length) {
    var q = questions[questions.length - 1].trim().replace(/^[-*\d.)\s]+/, '');
    if (q.length > 8 && q.length < 80) follows.push(q);
  }

  /* Topic-based suggestions */
  var lower = text.toLowerCase();
  if (lower.includes('python') || lower.includes('function') || lower.includes('code'))
    follows.push('Show me a test case for this');
  if (lower.includes('api') || lower.includes('endpoint'))
    follows.push('Add error handling to this');
  if (lower.includes('research') || lower.includes('analysis') || lower.includes('study'))
    follows.push('What are the limitations of this?');
  if (lower.includes('however') || lower.includes('but') || lower.includes('drawback'))
    follows.push('What\'s the alternative approach?');

  /* Generic fallbacks */
  if (follows.length < 2) follows.push('Explain this in simpler terms');
  if (follows.length < 2) follows.push('Give me a practical example');

  /* Deduplicate and limit */
  var seen = {};
  follows = follows.filter(function(f) {
    f = f.trim();
    if (f.length < 8 || f.length > 70 || seen[f]) return false;
    seen[f] = true; return true;
  });

  return follows.slice(0, 3);
}

/* ═══════════════════════════════════════════════════════
 * Thinking phase animation
 * ═══════════════════════════════════════════════════════ */
function startThinking(container) {
  var steps = Agent.getThinkingSteps();
  thinkStepIdx = 0;
  var html = '<div class="thinking-phase" id="thinkPhase"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div><span class="thinking-text" id="thinkText">' + steps[0] + '</span></div>';
  container.innerHTML = html;

  thinkingTimer = setInterval(function() {
    thinkStepIdx = (thinkStepIdx + 1) % steps.length;
    var el = document.getElementById('thinkText');
    if (el) { el.style.opacity = '0'; setTimeout(function() { if (el) { el.textContent = steps[thinkStepIdx]; el.style.opacity = '1'; } }, 150); }
  }, 1200);
}

function stopThinking() {
  if (thinkingTimer) { clearInterval(thinkingTimer); thinkingTimer = null; }
  var el = document.getElementById('thinkPhase');
  if (el) { el.style.opacity = '0'; setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 200); }
}

/* ═══════════════════════════════════════════════════════
 * Send & stream
 * ═══════════════════════════════════════════════════════ */
async function send() {
  var text = $input.value.trim();
  var files = pendingFiles.slice();
  if ((!text && !files.length) || streaming) return;
  if (!hasKey()) { toast('Set API key first', 'err'); return; }

  if (!activeId) newChat();
  var c = getActive();

  var msg = { role: 'user', t: text || '(uploaded files)', files: files.length ? files.map(function(f) {
    return { type: f.type, name: f.name, mime: f.mime, data: f.data, thumb: f.thumb, isVideo: f.isVideo };
  }) : null };

  c.msgs.push(msg);
  if (!files.length) retitle(c);
  else c.title = files.map(function(f) { return f.name; }).join(', ');
  save();

  $input.value = ''; $input.style.height = 'auto';
  pendingFiles = []; renderFP();
  renderList(); renderMsgs();

  streaming = true; setSendBtn();

  /* Thinking phase */
  var tip = document.createElement('div');
  tip.className = 'msg-row assistant'; tip.id = 'aiRow';
  tip.innerHTML = '<div class="msg-ai-header">' + LOGO + '<span class="msg-ai-label">opensky</span></div><div class="msg-ai-body" id="aiBody"></div>';
  $msgs.appendChild(tip);
  forceScroll();
  startThinking(document.getElementById('aiBody'));

  /* Build API messages */
  var apiMsgs = [{ role: 'system', content: Agent.getSystemPrompt() }];
  c.msgs.forEach(function(m) {
    if (m.role === 'user') {
      if (m.files && m.files.length) {
        var content = [{ type: 'text', text: m.t }];
        m.files.forEach(function(f) {
          if (f.type === 'image' && f.data) content.push({ type: 'image_url', image_url: { url: 'data:' + f.mime + ';base64,' + f.data } });
          else if (f.type === 'video' && f.data) { content.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + f.data } }); content.push({ type: 'text', text: '[Video frame: ' + f.name + ']' }); }
          else if (f.type === 'document' && f.data) content.push({ type: 'text', text: '[File: ' + f.name + ']\n' + f.data });
          else content.push({ type: 'text', text: '[Attached: ' + f.name + ']' });
        });
        apiMsgs.push({ role: 'user', content: content });
      } else {
        apiMsgs.push({ role: 'user', content: m.t });
      }
    } else {
      apiMsgs.push({ role: 'assistant', content: m.t });
    }
  });

  abortCtrl = new AbortController();
  var gotFirstToken = false;

  try {
    var res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getKey(), 'Content-Type': 'application/json', 'HTTP-Referer': location.href, 'X-Title': 'opensky' },
      body: JSON.stringify({ model: MODEL, messages: apiMsgs, stream: true }),
      signal: abortCtrl.signal,
    });

    if (!res.ok) {
      var ej = await res.json().catch(function() { return {}; });
      throw new Error((ej.error && ej.error.message) || ('HTTP ' + res.status));
    }

    /* Transition from thinking to streaming */
    stopThinking();
    var body = document.getElementById('aiBody');
    body.innerHTML = '';
    gotFirstToken = true;

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
          if (delta) {
            full += delta;
            body.innerHTML = md(full) + '<span class="stream-cursor"></span>';
            smartScroll();
          }
        } catch (_) {}
      }
    }

    /* Remove cursor, finalize */
    body.innerHTML = md(full);
    var followUps = generateFollowUps(full);

    c.msgs.push({ role: 'assistant', t: full, followUps: followUps });
    save();
    renderMsgs();

  } catch (err) {
    stopThinking();
    if (err.name === 'AbortError') {
      var row = document.getElementById('aiRow');
      if (row) {
        var p = row.querySelector('.msg-ai-body');
        if (p && p.textContent.trim()) { c.msgs.push({ role: 'assistant', t: p.textContent }); save(); }
      }
      renderMsgs();
      toast('Stopped', 'ok');
    } else {
      var row2 = document.getElementById('aiRow');
      if (row2) row2.remove();
      toast(err.message || 'Request failed', 'err');
    }
  } finally {
    streaming = false; abortCtrl = null; setSendBtn();
  }
}

function stopGen() { if (abortCtrl) abortCtrl.abort(); }

function setSendBtn() {
  if (streaming) {
    $send.className = 'send-btn stop';
    $send.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>';
    $send.onclick = stopGen;
  } else {
    $send.className = 'send-btn';
    $send.innerHTML = '<svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    $send.onclick = send;
  }
}

/* ═══════════════════════════════════════════════════════
 * Sidebar
 * ═══════════════════════════════════════════════════════ */
function closeSide() { $side.classList.remove('open'); $over.classList.remove('show'); }
document.getElementById('menuToggle').addEventListener('click', function() { $side.classList.toggle('open'); $over.classList.toggle('show'); });
 $over.addEventListener('click', closeSide);
document.getElementById('newChatBtn').addEventListener('click', newChat);
document.getElementById('clearChatBtn').addEventListener('click', clearChat);

/* ═══════════════════════════════════════════════════════
 * Init
 * ═══════════════════════════════════════════════════════ */
(function() {
  if (convos.length) activeId = convos[0].id;
  refreshKeyUI();
  $modeT.textContent = Agent.getModeLabel();
  renderList();
  renderMsgs();
  setSendBtn();
  $input.focus();
})();
