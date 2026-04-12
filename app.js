var BK = '__OPENKEY__';
var AU = 'https://openrouter.ai/api/v1/chat/completions';
var MD = 'openrouter/free';
var LG = '<svg class="msg-ai-icon" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg>';

var convos = JSON.parse(localStorage.getItem('os_c') || '[]');
var aId = null, strm = false, abrt = null, ascroll = true;
var pfiles = [], tTimer = null, keyValidated = null;

var $l = document.getElementById('chatList');
var $m = document.getElementById('chatMessages');
var $a = document.getElementById('chatArea');
var $i = document.getElementById('messageInput');
var $s = document.getElementById('sendBtn');
var $tt = document.getElementById('topbarTitle');
var $tm = document.getElementById('topbarMode');
var $ml = document.getElementById('modelLabel');
var $dt = document.getElementById('statusDot');
var $sb = document.getElementById('sidebar');
var $ov = document.getElementById('sidebarOverlay');
var $ts = document.getElementById('toastContainer');
var $fp = document.getElementById('filePreview');
var $fi = document.getElementById('fileInput');
var $mc = document.getElementById('micBtn');
var $am = document.getElementById('attachMenu');
var $cr = document.getElementById('codeRunner');
var $cf = document.getElementById('runnerFrame');

/* ── Key ── */
function gk() {
  var s = localStorage.getItem('os_k');
  if (s && s.length > 5) return s;
  if (BK !== '__OPENKEY__' && BK.length > 5) return BK;
  return null;
}
function hk() { return gk() !== null; }
function rku() { if (hk()) { $dt.classList.add('on'); } else { $dt.classList.remove('on'); } }

/* ── Validate key with a minimal API call ── */
async function validateKey() {
  if (keyValidated !== null) return keyValidated;
  var k = gk();
  if (!k) { keyValidated = false; return false; }
  try {
    var r = await fetch(AU, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MD, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
    });
    if (r.status === 401) { keyValidated = false; return false; }
    if (r.status === 402) { keyValidated = false; return false; }
    keyValidated = r.ok;
    return r.ok;
  } catch (e) { keyValidated = false; return false; }
}

/* ── Scroll ── */
 $a.addEventListener('scroll', function() { ascroll = ($a.scrollHeight - $a.scrollTop - $a.clientHeight) < 70; });
function ss() { if (ascroll) requestAnimationFrame(function() { $a.scrollTop = $a.scrollHeight; }); }
function fs() { ascroll = true; requestAnimationFrame(function() { $a.scrollTop = $a.scrollHeight; }); }

/* ── Background ── */
(function() {
  var c = document.getElementById('bgCanvas'), x = c.getContext('2d'), p = [], N = 35;
  function rz() { c.width = innerWidth; c.height = innerHeight; }
  function sd() { p = []; for (var i = 0; i < N; i++) p.push({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * .6 + .1, a: Math.random() * .08 + .01, vx: (Math.random() - .5) * .05, vy: (Math.random() - .5) * .03, ph: Math.random() * 6.28 }); }
  function dr(t) { x.clearRect(0, 0, c.width, c.height); for (var i = 0; i < p.length; i++) { var q = p[i]; q.x += q.vx; q.y += q.vy; if (q.x < 0) q.x = c.width; if (q.x > c.width) q.x = 0; if (q.y < 0) q.y = c.height; if (q.y > c.height) q.y = 0; var f = .5 + .5 * Math.sin(t * .0003 + q.ph); x.beginPath(); x.arc(q.x, q.y, Math.max(.1, q.r), 0, 6.28); x.fillStyle = 'rgba(255,255,255,' + (q.a * f).toFixed(4) + ')'; x.fill(); } requestAnimationFrame(dr); }
  addEventListener('resize', function() { rz(); sd(); }); rz(); sd(); requestAnimationFrame(dr);
})();

/* ── Markdown ── */
function md(r) {
  var h = r.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/```(html)\n?([\s\S]*?)```/g, function(_, l, c) { var id = 'c' + Math.random().toString(36).slice(2, 8); return '<pre><code id="' + id + '">' + c.trim() + '</code><button class="copy-code-btn run-btn" data-run="' + id + '">Run</button><button class="copy-code-btn" data-cid="' + id + '">Copy</button></pre>'; });
  h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, l, c) { var id = 'c' + Math.random().toString(36).slice(2, 8); return '<pre><code id="' + id + '">' + c.trim() + '</code><button class="copy-code-btn" data-cid="' + id + '">Copy</button><button class="copy-code-btn" data-cid-dl="' + id + '" data-ext="' + (l || 'txt') + '">Save</button></pre>'; });
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
  h = h.split(/\n\n+/).map(function(b) { b = b.trim(); if (!b) return ''; if (b.charAt(0) === '<') return b; return '<p>' + b.replace(/\n/g, '<br>') + '</p>'; }).join('\n');
  return h;
}

/* ── Toast ── */
function toast(msg, t) {
  var e = document.createElement('div'); e.className = 'toast ' + (t || 'err');
  e.innerHTML = '<i class="fas ' + (t === 'ok' ? 'fa-check' : 'fa-xmark') + '"></i><span>' + msg + '</span>';
  $ts.appendChild(e); setTimeout(function() { e.remove(); }, 3000);
}

/* ── Clipboard / Download ── */
function clip(t) { navigator.clipboard.writeText(t).then(function() { toast('Copied', 'ok'); }); }
function dl(c, n, m) { var b = new Blob([c], { type: m || 'text/plain' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = n; a.click(); URL.revokeObjectURL(u); }
function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ── Click delegation ── */
document.addEventListener('click', function(e) {
  var cb = e.target.closest('[data-cid]'); if (cb) { var el = document.getElementById(cb.getAttribute('data-cid')); if (el) clip(el.textContent); return; }
  var cd = e.target.closest('[data-cid-dl]'); if (cd) { var el2 = document.getElementById(cd.getAttribute('data-cid-dl')); if (el2) dl(el2.textContent, 'code.' + (cd.getAttribute('data-ext') || 'txt'), 'text/plain'); return; }
  var rb = e.target.closest('[data-run]'); if (rb) { var el3 = document.getElementById(rb.getAttribute('data-run')); if (el3) openRunner(el3.textContent); return; }
  var mb = e.target.closest('.msg-bubble-copy'); if (mb) clip(mb.getAttribute('data-t'));
  var ac = e.target.closest('[data-ai-copy]'); if (ac) clip(ac.getAttribute('data-ai-copy'));
  var ad = e.target.closest('[data-ai-dl]'); if (ad) dl(ad.getAttribute('data-ai-dl'), 'response.md', 'text/markdown');
  var rg = e.target.closest('[data-regen]'); if (rg) regen();
  var fu = e.target.closest('[data-fu]'); if (fu) { $i.value = fu.getAttribute('data-fu'); ri($i); send(); }
  var s = e.target.closest('[data-s]'); if (s) { $i.value = s.getAttribute('data-s'); ri($i); send(); }
  if (e.target.closest('#privacyClose')) { localStorage.setItem('os_pv', '1'); var pb = document.getElementById('privacyBanner'); if (pb) { pb.style.opacity = '0'; pb.style.transform = 'translateY(-6px)'; setTimeout(function() { pb.remove(); }, 250); } return; }
});

/* ── Files ── */
document.getElementById('attachBtn').addEventListener('click', function(e) { e.stopPropagation(); $am.classList.toggle('open'); });
document.addEventListener('click', function(e) { if (!e.target.closest('.attach-wrap')) $am.classList.remove('open'); });
document.querySelectorAll('.attach-opt').forEach(function(b) { b.addEventListener('click', function() { $am.classList.remove('open'); var t = this.getAttribute('data-type'); $fi.accept = t === 'image' ? 'image/*' : t === 'video' ? 'video/*' : '.txt,.md,.json,.csv,.py,.js,.ts,.html,.css,.xml,.yaml,.yml,.sh,.c,.cpp,.h,.java,.rb,.go,.rs,.php,.sql,.log,.ini,.cfg'; $fi.click(); }); });
 $fi.addEventListener('change', function() { Array.from($fi.files).forEach(addFile); $fi.value = ''; });

function addFile(f) {
  var entry = { name: f.name, size: f.size, type: '', mime: f.type, data: null, thumb: null };
  var isImg = f.type.startsWith('image/'), isVid = f.type.startsWith('video/'), isTxt = !isImg && !isVid && f.size < 500000;
  if (isImg) {
    entry.type = 'image'; var r = new FileReader();
    r.onload = function(x) { entry.data = x.target.result.split(',')[1]; entry.thumb = x.target.result; pfiles.push(entry); rFP(); };
    r.readAsDataURL(f);
  } else if (isVid) {
    entry.type = 'video'; exFr(f).then(function(d) { entry.data = d ? d.split(',')[1] : null; entry.thumb = d; entry.isVideo = true; pfiles.push(entry); rFP(); });
  } else if (isTxt) {
    entry.type = 'document'; var r2 = new FileReader();
    r2.onload = function(x) { entry.data = x.target.result; pfiles.push(entry); rFP(); };
    r2.readAsText(f);
  } else { toast('Unsupported file', 'err'); }
}

function exFr(f) { return new Promise(function(r) { try { var v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.onloadeddata = function() { v.currentTime = Math.min(1, v.duration * .1); }; v.onseeked = function() { var cv = document.createElement('canvas'); cv.width = v.videoWidth || 320; cv.height = v.videoHeight || 240; cv.getContext('2d').drawImage(v, 0, 0); r(cv.toDataURL('image/jpeg', .6)); }; v.onerror = function() { r(null); }; v.src = URL.createObjectURL(f); setTimeout(function() { r(null); }, 5000); } catch (e) { r(null); } }); }

function rFP() {
  $fp.innerHTML = pfiles.map(function(f, i) {
    var img = f.thumb ? '<img src="' + f.thumb + '" alt="">' : '';
    return '<div class="fp-item">' + img + '<span>' + esc(f.name) + '</span><button class="fp-remove" data-fi="' + i + '">&times;</button></div>';
  }).join('');
}
 $fp.addEventListener('click', function(e) { var b = e.target.closest('.fp-remove'); if (b) { pfiles.splice(parseInt(b.getAttribute('data-fi')), 1); rFP(); } });

/* ── Mic ── */
var rec = null, mOn = false;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  rec = new SR(); rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US';
  rec.onresult = function(e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; $i.value = t; ri($i); };
  rec.onend = function() { mOff(); }; rec.onerror = function() { mOff(); };
}
 $mc.addEventListener('click', function() { if (!rec) { toast('Speech not supported', 'err'); return; } if (mOn) { rec.stop(); mOff(); } else { rec.start(); mOn = true; $mc.classList.add('recording'); } });
function mOff() { mOn = false; $mc.classList.remove('recording'); }

/* ── Modes ── */
document.getElementById('modeSelector').addEventListener('click', function(e) {
  var b = e.target.closest('.mode-btn'); if (!b) return;
  Agent.setMode(b.getAttribute('data-mode'));
  document.querySelectorAll('.mode-btn').forEach(function(x) { x.classList.remove('active'); });
  b.classList.add('active');
  $tm.textContent = Agent.label();
  $tm.style.background = 'var(--bd2)';
  setTimeout(function() { $tm.style.background = ''; }, 300);
});

/* ── Convo CRUD ── */
function sv() { localStorage.setItem('os_c', JSON.stringify(convos)); }
function ga() { for (var i = 0; i < convos.length; i++) if (convos[i].id === aId) return convos[i]; return null; }

function nc() {
  var c = { id: 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), title: 'New chat', msgs: [], mode: Agent.getMode(), ts: Date.now() };
  convos.unshift(c); sv(); aId = c.id; rL(); rM(); cS();
}
function pk(id) { aId = id; rL(); rM(); cS(); }
function delConvo(id, e) { e.stopPropagation(); convos = convos.filter(function(c) { return c.id !== id; }); sv(); if (aId === id) aId = convos.length ? convos[0].id : null; rL(); rM(); }
function cc() { var c = ga(); if (!c) return; c.msgs = []; c.title = 'New chat'; sv(); rL(); rM(); toast('Cleared', 'ok'); }
function rt(c) { if (c.msgs.length) { var s = c.msgs[0].t; c.title = s.length > 36 ? s.slice(0, 36) + '...' : s; } }

function rL() {
  if (!convos.length) { $l.innerHTML = '<div style="text-align:center;padding:24px 8px;color:var(--g3);font-size:9.5px">No chats yet</div>'; return; }
  $l.innerHTML = convos.map(function(c) {
    return '<div class="chat-item' + (c.id === aId ? ' active' : '') + '" data-cid="' + c.id + '"><span class="chat-item-label">' + esc(c.title) + '</span><button class="chat-item-del" data-did="' + c.id + '"><i class="fas fa-xmark"></i></button></div>';
  }).join('');
}
 $l.addEventListener('click', function(e) {
  var d = e.target.closest('[data-did]'); if (d) { delConvo(d.getAttribute('data-did'), e); return; }
  var c = e.target.closest('[data-cid]'); if (c) pk(c.getAttribute('data-cid'));
});

/* ── Render ── */
function rM() {
  var c = ga();
  if (!c || !c.msgs.length) {
    $tt.textContent = 'opensky';
    $m.innerHTML = wH();
    if (!localStorage.getItem('os_pv')) $m.innerHTML += pvH();
    if (!hk()) $m.innerHTML += kH();
    return;
  }
  $tt.textContent = c.title;
  $m.innerHTML = c.msgs.map(function(m) { return m.role === 'user' ? rU(m) : rA(m); }).join('');
  fs();
}

function rU(m) {
  var fh = '';
  if (m.files && m.files.length) {
    fh = '<div class="msg-files">';
    m.files.forEach(function(f) {
      if (f.type === 'image' && f.thumb) fh += '<img class="msg-file-thumb" src="' + f.thumb + '" alt="' + esc(f.name) + '">';
      else fh += '<span class="msg-file-chip"><i class="fas fa-file" style="font-size:8px"></i> ' + esc(f.name) + '</span>';
    });
    fh += '</div>';
  }
  var et = esc(m.t).replace(/"/g, '&quot;');
  return '<div class="msg-row user"><div class="msg-bubble">' + fh + '<div>' + esc(m.t).replace(/\n/g, '<br>') + '</div><button class="msg-bubble-copy" data-t="' + et + '">Copy</button></div></div>';
}

function rA(m) {
  var et = esc(m.t).replace(/"/g, '&quot;'), fu = '';
  if (m.fu && m.fu.length) {
    fu = '<div class="follow-ups">';
    m.fu.forEach(function(f) { fu += '<button class="fu-chip" data-fu="' + esc(f).replace(/"/g, '&quot;') + '">' + esc(f) + '</button>'; });
    fu += '</div>';
  }
  return '<div class="msg-row assistant"><div class="msg-ai-header">' + LG + '<span class="msg-ai-label">opensky</span></div>' + (m.toolPills || '') + (m.planHTML || '') + '<div class="msg-ai-body">' + md(m.t) + '</div>' + fu + '<div class="msg-ai-footer"><button class="msg-ai-action" data-ai-copy="' + et + '"><i class="fas fa-copy"></i> Copy</button><button class="msg-ai-action" data-ai-dl="' + et + '"><i class="fas fa-download"></i> .md</button><button class="msg-ai-action" data-regen="1"><i class="fas fa-rotate"></i> Redo</button></div></div>';
}

function pvH() { return '<div class="privacy-banner" id="privacyBanner"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v4c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1z" stroke="currentColor" stroke-width="1"/></svg><span>Please do not upload any personal, confidential, or otherwise sensitive information.</span><button class="privacy-close" id="privacyClose">&times;</button></div>'; }
function kH() { return '<div class="key-banner"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5a3.5 3.5 0 00-3 5.2L3 12.2V15h2.8l5.5-5.5A3.5 3.5 0 0011.5 1.5z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg><span>API key not set. Run <code>OPENKEY=sk-or-... node script.js</code> then serve the files.</span></div>'; }
function wH() {
  return '<div class="welcome"><div class="welcome-logo"><svg style="width:40px;height:40px" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg></div><h2>What can I help with?</h2><p>20 tools, memory, planning, file uploads, voice, live code preview. Powered by OpenRouter free models.</p><div class="suggestions"><button class="sugg" data-s="What is the weather in Paris?">Weather in Paris?</button><button class="sugg" data-s="Build a todo app with HTML CSS JS">Build a todo app</button><button class="sugg" data-s="Compare React vs Vue vs Angular">React vs Vue vs Angular</button><button class="sugg" data-s="Who created you?">Who are you?</button></div></div>';
}

/* ── Download chat ── */
document.getElementById('downloadChatBtn').addEventListener('click', function() {
  var c = ga(); if (!c || !c.msgs.length) { toast('Nothing to download', 'err'); return; }
  var o = '# ' + c.title + '\n\n';
  c.msgs.forEach(function(m) { o += '### ' + (m.role === 'user' ? 'You' : 'opensky') + '\n\n' + m.t + '\n\n---\n\n'; });
  dl(o, c.title.replace(/[^a-z0-9]/gi, '_') + '.md', 'text/markdown');
  toast('Downloaded', 'ok');
});

/* ── Regenerate ── */
async function regen() {
  var c = ga(); if (!c || strm) return;
  if (c.msgs.length && c.msgs[c.msgs.length - 1].role === 'assistant') { c.msgs.pop(); sv(); rM(); }
  $i.value = ' '; await send();
}

/* ── Code runner ── */
function openRunner(code) { $cr.classList.add('open'); $cf.srcdoc = code; }
function closeRunner() { $cr.classList.remove('open'); setTimeout(function() { $cf.srcdoc = ''; }, 350); }
document.getElementById('runnerClose').addEventListener('click', closeRunner);
document.getElementById('runnerNewTab').addEventListener('click', function() { var w = window.open(); w.document.write($cf.srcdoc); w.document.close(); });

/* ── Input ── */
function ri(e) { e.style.height = 'auto'; e.style.height = Math.min(e.scrollHeight, 120) + 'px'; }
 $i.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
 $i.addEventListener('input', function() { ri($i); });

/* ── Follow-ups via API ── */
async function genFU(conv) {
  try {
    var last = conv.slice(-4);
    var prompt = 'Suggest 3 short follow-up questions (under 8 words). Return ONLY a JSON array of strings.\n\n' + last.map(function(m) { return (m.role === 'user' ? 'User: ' : 'AI: ') + m.t; }).join('\n');
    var r = await fetch(AU, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + gk(), 'Content-Type': 'application/json', 'HTTP-Referer': location.href, 'X-Title': 'opensky' },
      body: JSON.stringify({ model: MD, messages: [{ role: 'user', content: prompt }], stream: false })
    });
    var d = await r.json();
    var txt = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    txt = txt.replace(/```json?/g, '').replace(/```/g, '').trim();
    var arr = JSON.parse(txt);
    if (Array.isArray(arr)) return arr.filter(function(f) { return f.length > 3 && f.length < 60; }).slice(0, 3);
  } catch (e) {}
  return [];
}

/* ── Thinking animation ── */
function startThink(el) {
  var steps = Agent.steps(); tIdx = 0;
  el.innerHTML = '<div class="think-phase" id="tP"><div class="think-dots"><span></span><span></span><span></span></div><span class="think-text" id="tT">' + steps[0] + '</span></div>';
  tTimer = setInterval(function() {
    tIdx = (tIdx + 1) % steps.length;
    var t = document.getElementById('tT');
    if (t) { t.style.opacity = '0'; setTimeout(function() { if (t) { t.textContent = steps[tIdx]; t.style.opacity = '1'; } }, 150); }
  }, 1100);
}
function stopThink() {
  if (tTimer) { clearInterval(tTimer); tTimer = null; }
  var el = document.getElementById('tP');
  if (el) { el.style.opacity = '0'; setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 200); }
}

/* ── Context truncation for long conversations ── */
function truncateForContext(apiMsgs) {
  var totalChars = 0;
  for (var i = 0; i < apiMsgs.length; i++) {
    var c = apiMsgs[i].content;
    if (typeof c === 'string') totalChars += c.length;
    else if (Array.isArray(c)) c.forEach(function(p) { if (typeof p === 'string') totalChars += p.length; else if (p.text) totalChars += p.text.length; else if (p.image_url) totalChars += 500; });
  }
  // Rough: free models ~4k-8k tokens, ~3.5 chars/token → keep under 20k chars
  if (totalChars < 20000) return apiMsgs;
  // Remove oldest non-system messages, keep at least system + last user message
  var trimmed = [apiMsgs[0]];
  for (var j = apiMsgs.length - 1; j >= 1; j--) {
    trimmed.unshift(apiMsgs[j]);
    var newTotal = 0;
    trimmed.forEach(function(m) { var c2 = m.content; if (typeof c2 === 'string') newTotal += c2.length; });
    if (newTotal < 18000) break;
    trimmed.splice(1, 1); // Remove the second item (oldest non-system)
  }
  return trimmed;
}

/* ── Parse OpenRouter errors ── */
function parseApiError(res, errData) {
  var msg = (errData && errData.error && errData.error.message) || '';
  if (res.status === 401) return 'Invalid API key — check your OPENKEY secret in GitHub settings.';
  if (res.status === 402) return 'No credits remaining on this API key.';
  if (res.status === 403) return 'API key does not have access to this model.';
  if (res.status === 429) return 'Rate limited — wait a moment and try again.';
  if (res.status === 404) return 'Model not available. OpenRouter may have removed this free model.';
  if (msg.toLowerCase().indexOf('context length') !== -1 || msg.toLowerCase().indexOf('too long') !== -1) return 'Message too long for this model. Start a new chat.';
  if (msg.toLowerCase().indexOf('content_filter') !== -1) return 'Response filtered by content policy. Rephrase your request.';
  return msg || ('API error: ' + res.status);
}

/* ═══════════════════════════════════════════════════════
 * SEND — Full agentic pipeline
 * ═══════════════════════════════════════════════════════ */
async function send() {
  var text = $i.value.trim(), files = pfiles.slice();
  if ((!text && !files.length) || strm) return;

  if (!hk()) { toast('Set API key first — run the build script', 'err'); return; }

  // Validate key on first send
  if (keyValidated === null) {
    var valid = await validateKey();
    if (!valid) { toast('Invalid or expired API key — check your OPENKEY secret', 'err'); keyValidated = false; return; }
    keyValidated = true;
  }

  if (!aId) nc();
  var c = ga();

  var msg = { role: 'user', t: text || '(uploaded files)', files: files.length ? files.map(function(f) { return { type: f.type, name: f.name, mime: f.mime, data: f.data, thumb: f.thumb, isVideo: f.isVideo }; }) : null };
  c.msgs.push(msg);
  if (!files.length) rt(c); else c.title = files.map(function(f) { return f.name; }).join(', ');
  sv(); $i.value = ''; $i.style.height = 'auto'; pfiles = []; rFP(); rL(); rM();

  strm = true; setSB();

  // Create AI row
  var row = document.createElement('div'); row.className = 'msg-row assistant'; row.id = 'aiRow';
  row.innerHTML = '<div class="msg-ai-header">' + LG + '<span class="msg-ai-label">opensky</span></div><div id="toolArea"></div><div class="msg-ai-body" id="aiBody"></div>';
  $m.appendChild(row); fs();

  /* Phase 1: Route + Memory + Tools */
  var routeResult = Agent.route(text);
  var memoryCtx = Agent.handleMemory(routeResult, text);
  var toolCtx = '';

  if (routeResult.tools.length) {
    var tArea = document.getElementById('toolArea');
    routeResult.tools.forEach(function(m, i) { tArea.innerHTML += '<div class="tool-pill" id="tp' + i + '">' + m.tool.icon + ' ' + m.tool.name + '<span class="tool-spin"><span></span><span></span><span></span></span></div>'; ss(); });
    try {
      var results = await Agent.execTools(routeResult.tools);
      results.forEach(function(r, i) {
        var pill = document.getElementById('tp' + i);
        if (pill) { pill.className = 'tool-pill ' + (r.error ? 'err' : 'done'); pill.textContent = r.icon + ' ' + r.name + (r.error ? ' \u2717' : ' \u2713'); }
      });
      toolCtx = Agent.toolCtx(results);
    } catch (e) { toolCtx = ''; }
  }

  /* Phase 2: Planning (for complex tasks) */
  var planSteps = null;
  var planCtx = '';
  var planHTML = '';

  if (Planner.shouldPlan(text) && !routeResult.tools.length) {
    startThink(document.getElementById('aiBody'));
    try {
      planSteps = await Planner.generatePlan(text, gk());
      planHTML = Planner.formatHTML(planSteps);
      planCtx = Planner.formatCtx(planSteps);
      var body = document.getElementById('aiBody');
      if (body) body.innerHTML = planHTML;
      fs();
    } catch (e) { planSteps = null; }
    stopThink();
  } else {
    startThink(document.getElementById('aiBody'));
    // Short delay for thinking animation visibility
    await new Promise(function(r) { setTimeout(r, 400); });
    stopThink();
  }

  /* Phase 3: Build API messages */
  var apiMsgs = [{ role: 'system', content: Agent.sys() + memoryCtx + toolCtx + planCtx }];

  c.msgs.forEach(function(m) {
    if (m.role === 'user') {
      if (m.files && m.files.length) {
        var ct = [{ type: 'text', text: m.t }];
        m.files.forEach(function(f) {
          if (f.type === 'image' && f.data) ct.push({ type: 'image_url', image_url: { url: 'data:' + f.mime + ';base64,' + f.data } });
          else if (f.type === 'video' && f.data) { ct.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + f.data } }); ct.push({ type: 'text', text: '[Video: ' + f.name + ']' }); }
          else if (f.type === 'document' && f.data) ct.push({ type: 'text', text: '[' + f.name + ']\n' + f.data });
          else ct.push({ type: 'text', text: '[Attached: ' + f.name + ']' });
        });
        apiMsgs.push({ role: 'user', content: ct });
      } else {
        apiMsgs.push({ role: 'user', content: m.t });
      }
    } else {
      apiMsgs.push({ role: 'assistant', content: m.t });
    }
  });

  // Truncate if too long
  apiMsgs = truncateForContext(apiMsgs);

  /* Phase 4: Stream LLM response */
  abrt = new AbortController();

  try {
    var res = await fetch(AU, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + gk(), 'Content-Type': 'application/json', 'HTTP-Referer': location.href, 'X-Title': 'opensky' },
      body: JSON.stringify({ model: MD, messages: apiMsgs, stream: true }),
      signal: abrt.signal
    });

    if (!res.ok) {
      var errData = await res.json().catch(function() { return {}; });
      throw new Error(parseApiError(res, errData));
    }

    var body = document.getElementById('aiBody');
    body.innerHTML = '';

    var um = res.headers.get('x-model-used') || res.headers.get('openrouter-model');
    if (um) $ml.textContent = um;

    var reader = res.body.getReader(), dec = new TextDecoder(), full = '', buf = '';

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
          if (delta) { full += delta; body.innerHTML = md(full) + '<span class="stream-wave"></span>'; ss(); }
        } catch (_) {}
      }
    }

    // Finalize
    body.innerHTML = md(full);

    var pillsHtml = document.getElementById('toolArea').innerHTML;

    // Phase 5: Follow-ups
    var fu = await genFU(c.msgs.concat([{ role: 'assistant', t: full }]));
    c.msgs.push({ role: 'assistant', t: full, fu: fu, toolPills: pillsHtml, planHTML: planHTML });
    sv(); rM();

    // Phase 6: Auto-memory
    try {
      var mm = full.match(/(?:remember|note|save|store|keep in mind)\s*(?:that|this|the fact)\s*:?\s*(.+)/i);
      if (mm) Agent.memory.remember(mm[1].trim().slice(0, 200), 'fact');
    } catch (e) {}

  } catch (err) {
    stopThink();
    if (err.name === 'AbortError') {
      var row2 = document.getElementById('aiRow');
      if (row2) { var p = row2.querySelector('.msg-ai-body'); if (p && p.textContent.trim()) { c.msgs.push({ role: 'assistant', t: p.textContent }); sv(); } }
      rM(); toast('Stopped', 'ok');
    } else {
      var row3 = document.getElementById('aiRow');
      if (row3) row3.remove();
      toast(err.message || 'Request failed', 'err');
      // Reset validation if key-related error
      if (err.message && (err.message.indexOf('API key') !== -1 || err.message.indexOf('credits') !== -1)) {
        keyValidated = false;
      }
    }
  } finally {
    strm = false; abrt = null; setSB();
  }
}

function stopGen() { if (abrt) abrt.abort(); }

function setSB() {
  if (strm) {
    $s.className = 'send-btn stop';
    $s.innerHTML = '<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>';
    $s.onclick = stopGen;
  } else {
    $s.className = 'send-btn';
    $s.innerHTML = '<svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    $s.onclick = send;
  }
}

/* ── Sidebar ── */
function cS() { $sb.classList.remove('open'); $ov.classList.remove('show'); }
document.getElementById('menuToggle').addEventListener('click', function() { $sb.classList.toggle('open'); $ov.classList.toggle('show'); });
 $ov.addEventListener('click', cS);
document.getElementById('newChatBtn').addEventListener('click', nc);
document.getElementById('clearChatBtn').addEventListener('click', cc);

/* ── Init ── */
(function() {
  if (convos.length) aId = convos[0].id;
  rku(); $tm.textContent = Agent.label(); rL(); rM(); setSB(); $i.focus();
})();
