/* ═══════════════════════════════════════════════════════════
 * opensky — app.js  |  Created by Hafij Shaikh
 * ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Config ───────────────────────────────────────── */
  var API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  var API_MODEL = 'openrouter/free';
  var KEY_PH = 'NONE';

  /* ── SVG Icons ────────────────────────────────────── */
  var ICON_SEND = '<svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_MIC = '<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="7" y="2" width="6" height="10" rx="3" stroke="currentColor" stroke-width="1.3"/><path d="M4 9a6 6 0 0012 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10 15v3M7 18h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  var ICON_STOP = '<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>';
  var LOGO_SVG = '<svg class="msg-ai-icon" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg>';

  /* ── State ────────────────────────────────────────── */
  var convos = [];
  var activeId = null;
  var streaming = false;
  var abortCtrl = null;
  var autoScroll = true;
  var scrollLock = false;
  var pendingFiles = [];
  var recording = false;
  var recog = null;
  var thinkTimer = null;

  /* ── DOM ──────────────────────────────────────────── */
  var $list = document.getElementById('chatList');
  var $msgs = document.getElementById('chatMessages');
  var $area = document.getElementById('chatArea');
  var $inp = document.getElementById('messageInput');
  var $btn = document.getElementById('sendBtn');
  var $ttl = document.getElementById('topbarTitle');
  var $tmd = document.getElementById('topbarMode');
  var $mdl = document.getElementById('modelLabel');
  var $dot = document.getElementById('statusDot');
  var $side = document.getElementById('sidebar');
  var $over = document.getElementById('sidebarOverlay');
  var $tst = document.getElementById('toastContainer');
  var $fpr = document.getElementById('filePreview');
  var $fin = document.getElementById('fileInput');
  var $amn = document.getElementById('attachMenu');
  var $crn = document.getElementById('codeRunner');
  var $cfr = document.getElementById('runnerFrame');

  if (!$msgs || !$inp || !$btn) { console.error('opensky: missing DOM'); return; }

    /* ── Key (decoded from base64 by sed in deploy.yml) ─ */
  function getKey() { return KEY_PH; }
function hasKey() { return KEY_PH !== 'NONE'; }

  /* ── HTML escape — also defined locally in planner.txt (intentional, separate IIFE scope) ── */
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* ══════════════════════════════════════════════════════
   *  BACKGROUND PARTICLES
   * ══════════════════════════════════════════════════════ */
  (function () {
    var c = document.getElementById('bgCanvas');
    if (!c) return;

    /* Respect prefers-reduced-motion — skip animation entirely */
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      /* Draw static dots once, no animation loop */
      var sx = c.getContext('2d');
      function rzStatic() { c.width = innerWidth; c.height = innerHeight; }
      rzStatic();
      sx.fillStyle = 'rgba(255,255,255,0.03)';
      for (var i = 0; i < 20; i++) {
        sx.beginPath();
        sx.arc(Math.random() * c.width, Math.random() * c.height, Math.max(0.1, Math.random() * 0.5 + 0.08), 0, 6.28);
        sx.fill();
      }
      addEventListener('resize', rzStatic);
      return;
    }

    var x = c.getContext('2d'), ps = [], N = 28;
    var hidden = false;
    function rz() { c.width = innerWidth; c.height = innerHeight; }
    function sd() {
      ps = [];
      for (var i = 0; i < N; i++) ps.push({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 0.5 + 0.08, a: Math.random() * 0.05 + 0.008, vx: (Math.random() - 0.5) * 0.035, vy: (Math.random() - 0.5) * 0.02, ph: Math.random() * 6.28 });
    }
    function dr(t) {
      if (hidden) { requestAnimationFrame(dr); return; }
      x.clearRect(0, 0, c.width, c.height);
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i]; p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
        if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
        var f = 0.5 + 0.5 * Math.sin(t * 0.0003 + p.ph);
        x.beginPath(); x.arc(p.x, p.y, Math.max(0.1, p.r), 0, 6.28);
        x.fillStyle = 'rgba(255,255,255,' + (p.a * f).toFixed(4) + ')'; x.fill();
      }
      requestAnimationFrame(dr);
    }
    addEventListener('resize', function () { rz(); sd(); });
    document.addEventListener('visibilitychange', function () { hidden = document.hidden; });
    rz(); sd(); requestAnimationFrame(dr);
  })();

  /* ══════════════════════════════════════════════════════
   *  SCROLL
   * ══════════════════════════════════════════════════════ */
  if ($area) $area.addEventListener('scroll', function () { if (!scrollLock) autoScroll = ($area.scrollHeight - $area.scrollTop - $area.clientHeight) < 80; });
  function smoothSc() { scrollLock = true; requestAnimationFrame(function () { if (autoScroll && $area) $area.scrollTop = $area.scrollHeight; scrollLock = false; }); }
  function forceSc() { autoScroll = true; requestAnimationFrame(function () { if ($area) $area.scrollTop = $area.scrollHeight; }); }

  /* ══════════════════════════════════════════════════════
   *  MARKDOWN
   * ══════════════════════════════════════════════════════ */
  function md(raw) {
    var h = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    /* Fenced code blocks — html blocks get a Run button */
    h = h.replace(/```(html)\n?([\s\S]*?)```/g, function (_, l, c) {
      var id = 'c' + Math.random().toString(36).slice(2, 8);
      return '<pre><code id="' + id + '">' + c.trim() + '</code><button class="copy-code-btn run-btn" data-run="' + id + '">Run</button><button class="copy-code-btn" data-cid="' + id + '">Copy</button></pre>';
    });
    h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, l, c) {
      var id = 'c' + Math.random().toString(36).slice(2, 8);
      return '<pre><code id="' + id + '">' + c.trim() + '</code><button class="copy-code-btn" data-cid="' + id + '">Copy</button><button class="copy-code-btn" data-cid-dl="' + id + '" data-ext="' + (l || 'txt') + '">Save</button></pre>';
    });

    /* Inline code */
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');

    /* Bold */
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    /* Italic — no lookbehind (Safari < 16.4 compatible). Safe because bold (**)
       is already processed above, so remaining single * are genuine italic markers */
    h = h.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    /* Headings */
    h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    /* Blockquotes */
    h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    /* Lists — use comment markers to distinguish ul vs ol before wrapping */
    h = h.replace(/^[\-\*] (.+)$/gm, '<!--UL--><li>$1</li>');
    h = h.replace(/^\d+\. (.+)$/gm, '<!--OL--><li>$1</li>');
    h = h.replace(/((?:<!--UL--><li>.*<\/li>\n?)+)/g, function (m) { return '<ul>' + m.replace(/<!--UL-->/g, '') + '</ul>'; });
    h = h.replace(/((?:<!--OL--><li>.*<\/li>\n?)+)/g, function (m) { return '<ol>' + m.replace(/<!--OL-->/g, '') + '</ol>'; });

    /* Paragraphs */
    h = h.split(/\n\n+/).map(function (b) {
      b = b.trim(); if (!b) return '';
      return b.charAt(0) === '<' ? b : '<p>' + b.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');

    return h;
  }

  /* ══════════════════════════════════════════════════════
   *  TOAST
   * ══════════════════════════════════════════════════════ */
  function toast(msg, type) {
    if (!$tst) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'err');
    el.innerHTML = '<i class="fas ' + (type === 'ok' ? 'fa-check' : 'fa-xmark') + '"></i><span>' + msg + '</span>';
    $tst.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }

  /* ══════════════════════════════════════════════════════
   *  UTILS
   * ══════════════════════════════════════════════════════ */
  function clip(t) { navigator.clipboard.writeText(t).then(function () { toast('Copied', 'ok'); }).catch(function () { toast('Copy failed', 'err'); }); }
  function dl(c, n, m) { var b = new Blob([c], { type: m || 'text/plain' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = n; a.click(); URL.revokeObjectURL(u); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ══════════════════════════════════════════════════════
   *  THINKING ANIMATION
   * ══════════════════════════════════════════════════════ */
  function startThinking(container) {
    var steps = Agent.steps ? Agent.steps() : ['Thinking...'];
    var idx = 0;
    var el = document.createElement('div');
    el.className = 'thinking-text';
    el.id = 'thinkAnim';
    container.appendChild(el);
    function tick() {
      if (!document.getElementById('thinkAnim')) return;
      el.innerHTML = steps.map(function (s, i) {
        return '<span' + (i === idx ? ' class="active"' : '') + '>' + (i < idx ? '\u2713 ' : '') + esc(s) + '</span>';
      }).join(' &nbsp;\xB7&nbsp; ');
      idx = (idx + 1) % steps.length;
      thinkTimer = setTimeout(tick, 900);
    }
    tick();
  }
  function stopThinking() {
    if (thinkTimer) { clearTimeout(thinkTimer); thinkTimer = null; }
    var el = document.getElementById('thinkAnim');
    if (el) { el.style.opacity = '0'; setTimeout(function () { if (el.parentNode) el.remove(); }, 200); }
  }

  /* ══════════════════════════════════════════════════════
   *  GLOBAL CLICK DELEGATION
   * ══════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {
    var t;
    t = e.target.closest('[data-cid]');
    if (t) { var c = document.getElementById(t.getAttribute('data-cid')); if (c) clip(c.textContent); return; }
    t = e.target.closest('[data-cid-dl]');
    if (t) { var c2 = document.getElementById(t.getAttribute('data-cid-dl')); if (c2) dl(c2.textContent, 'code.' + (t.getAttribute('data-ext') || 'txt')); return; }
    t = e.target.closest('[data-run]');
    if (t) { var c3 = document.getElementById(t.getAttribute('data-run')); if (c3) openRunner(c3.textContent); return; }
    t = e.target.closest('.msg-bubble-copy');
    if (t) { clip(t.getAttribute('data-t')); return; }
    t = e.target.closest('[data-ai-copy]');
    if (t) { clip(t.getAttribute('data-ai-copy')); return; }
    t = e.target.closest('[data-ai-dl]');
    if (t) { dl(t.getAttribute('data-ai-dl'), 'response.md', 'text/markdown'); return; }
    if (e.target.closest('[data-regen]')) { regen(); return; }
    t = e.target.closest('[data-s]');
    if (t) { $inp.value = t.getAttribute('data-s'); ri($inp); updBtn(); send(); return; }
    if (e.target.closest('#privacyClose')) {
      localStorage.setItem('os_pv', '1');
      var pb = document.getElementById('privacyBanner');
      if (pb) { pb.style.opacity = '0'; pb.style.transform = 'translateY(-6px)'; setTimeout(function () { pb.remove(); }, 300); }
    }
  });

  /* ══════════════════════════════════════════════════════
   *  COMBINED SEND / MIC BUTTON
   * ══════════════════════════════════════════════════════ */
  function updBtn() {
    if (streaming) { $btn.className = 'send-btn stop'; $btn.innerHTML = ICON_STOP; $btn.title = 'Stop'; return; }
    var has = $inp.value.trim().length > 0 || pendingFiles.length > 0;
    $btn.className = has ? 'send-btn' : 'send-btn mic-mode';
    $btn.innerHTML = has ? ICON_SEND : ICON_MIC;
    $btn.title = has ? 'Send' : 'Voice input';
  }

  function initRecog() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return false;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recog = new SR(); recog.continuous = false; recog.interimResults = true; recog.lang = 'en-US';
    recog.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; $inp.value = t; ri($inp); updBtn(); };
    recog.onend = function () { recOff(); };
    recog.onerror = function () { recOff(); };
    return true;
  }
  function recOff() { recording = false; $btn.classList.remove('recording'); }
  function toggleRec() {
    if (!recog) { if (!initRecog()) { toast('Speech not supported', 'err'); return; } }
    if (recording) { try { recog.stop(); } catch (e) {} recOff(); }
    else { try { recog.start(); recording = true; $btn.classList.add('recording'); } catch (e) { toast('Mic error', 'err'); } }
  }

  $btn.addEventListener('click', function () {
    if (streaming) { stopGen(); return; }
    if ($inp.value.trim().length > 0 || pendingFiles.length > 0) send();
    else toggleRec();
  });

  /* ══════════════════════════════════════════════════════
   *  ATTACH MENU + FILES
   * ══════════════════════════════════════════════════════ */
  var $attBtn = document.getElementById('attachBtn');
  if ($attBtn) $attBtn.addEventListener('click', function (e) { e.stopPropagation(); if ($amn) $amn.classList.toggle('open'); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.attach-wrap') && $amn) $amn.classList.remove('open'); });
  document.querySelectorAll('.attach-opt').forEach(function (b) {
    b.addEventListener('click', function () {
      if ($amn) $amn.classList.remove('open');
      var t = this.getAttribute('data-type');
      if ($fin) { $fin.accept = t === 'image' ? 'image/*' : t === 'video' ? 'video/*' : '.txt,.md,.json,.csv,.py,.js,.ts,.html,.css,.xml,.yaml,.yml,.sh,.c,.cpp,.h,.java,.rb,.go,.rs,.php,.sql,.log'; $fin.click(); }
    });
  });
  if ($fin) $fin.addEventListener('change', function () { Array.from($fin.files).forEach(addFile); $fin.value = ''; });

  function addFile(f) {
    var e = { name: f.name, size: f.size, type: '', mime: f.type, data: null, thumb: null };
    var img = f.type.startsWith('image/'), vid = f.type.startsWith('video/'), txt = !img && !vid && f.size < 500000;
    if (img) {
      e.type = 'image'; var r = new FileReader();
      r.onload = function (x) { e.data = x.target.result.split(',')[1]; e.thumb = x.target.result; pendingFiles.push(e); renFP(); updBtn(); };
      r.readAsDataURL(f);
    } else if (vid) {
      e.type = 'video'; exVid(f).then(function (d) { e.data = d ? d.split(',')[1] : null; e.thumb = d; e.isVideo = true; pendingFiles.push(e); renFP(); updBtn(); });
    } else if (txt) {
      e.type = 'document'; var r2 = new FileReader();
      r2.onload = function (x) { e.data = x.target.result; pendingFiles.push(e); renFP(); updBtn(); };
      r2.readAsText(f);
    } else { toast('Unsupported file', 'err'); }
  }
  function exVid(f) {
    return new Promise(function (r) {
      try { var v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.onloadeddata = function () { v.currentTime = Math.min(1, v.duration * 0.1); }; v.onseeked = function () { var c = document.createElement('canvas'); c.width = v.videoWidth || 320; c.height = v.videoHeight || 240; c.getContext('2d').drawImage(v, 0, 0); r(c.toDataURL('image/jpeg', 0.6)); }; v.onerror = function () { r(null); }; v.src = URL.createObjectURL(f); setTimeout(function () { r(null); }, 5000); }
      catch (e) { r(null); }
    });
  }
  function renFP() {
    if (!$fpr) return;
    $fpr.innerHTML = pendingFiles.map(function (f, i) {
      return '<div class="fp-item">' + (f.thumb ? '<img src="' + f.thumb + '" alt="">' : '') + '<span>' + esc(f.name) + '</span><button class="fp-remove" data-fi="' + i + '">&times;</button></div>';
    }).join('');
  }
  if ($fpr) $fpr.addEventListener('click', function (e) { var b = e.target.closest('.fp-remove'); if (b) { pendingFiles.splice(parseInt(b.getAttribute('data-fi')), 1); renFP(); updBtn(); } });

  /* ══════════════════════════════════════════════════════
   *  INPUT
   * ══════════════════════════════════════════════════════ */
  function ri(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
  $inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  $inp.addEventListener('input', function () { ri($inp); updBtn(); });

  /* ══════════════════════════════════════════════════════
   *  MODE SELECTOR
   * ══════════════════════════════════════════════════════ */
  var $mSel = document.getElementById('modeSelector');
  if ($mSel) $mSel.addEventListener('click', function (e) {
    var b = e.target.closest('.mode-btn'); if (!b) return;
    Agent.setMode(b.getAttribute('data-mode'));
    document.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.remove('active'); });
    b.classList.add('active');
    if ($tmd) { $tmd.textContent = Agent.label(); $tmd.style.background = 'var(--bd2)'; setTimeout(function () { $tmd.style.background = ''; }, 300); }
  });

  /* ══════════════════════════════════════════════════════
   *  CONVERSATIONS
   * ══════════════════════════════════════════════════════ */
  function loadC() { try { convos = JSON.parse(localStorage.getItem('os_c') || '[]'); } catch (e) { convos = []; } }

  /* Save with localStorage overflow detection — warns user and auto-trims if needed */
  function saveC() {
    try {
      localStorage.setItem('os_c', JSON.stringify(convos));
    } catch (e) {
      var isQuota = (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
      if (isQuota && convos.length > 3) {
        toast('Storage full — trimming older chats', 'err');
        try {
          var trimmed = convos.slice(0, Math.max(3, convos.length - 5));
          localStorage.setItem('os_c', JSON.stringify(trimmed));
          convos = trimmed;
          renList();
        } catch (e2) {
          toast('Storage full — cannot save. Clear chats to free space.', 'err');
        }
      } else if (isQuota) {
        toast('Storage full — clear chats to free space', 'err');
      }
    }
  }

  function getCon() { for (var i = 0; i < convos.length; i++) if (convos[i].id === activeId) return convos[i]; return null; }
  function newCon() {
    var c = { id: 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), title: 'New chat', msgs: [], mode: Agent.getMode(), ts: Date.now() };
    convos.unshift(c); saveC(); activeId = c.id; renList(); renderMsgs(); closeSide();
  }
  function selCon(id) { activeId = id; renList(); renderMsgs(); closeSide(); }
  function delCon(id, ev) { if (ev) ev.stopPropagation(); convos = convos.filter(function (c) { return c.id !== id; }); saveC(); if (activeId === id) activeId = convos.length ? convos[0].id : null; renList(); renderMsgs(); }
  function clrCon() { var c = getCon(); if (!c) return; c.msgs = []; c.title = 'New chat'; saveC(); renList(); renderMsgs(); toast('Cleared', 'ok'); }
  function autoTit(c) { if (c.msgs.length) { var s = c.msgs[0].t; c.title = s.length > 36 ? s.slice(0, 36) + '...' : s; } }
  function renList() {
    if (!$list) return;
    if (!convos.length) { $list.innerHTML = '<div style="text-align:center;padding:24px 8px;color:var(--g3);font-size:9.5px">No chats yet</div>'; return; }
    $list.innerHTML = convos.map(function (c) {
      return '<div class="chat-item' + (c.id === activeId ? ' active' : '') + '" data-cid="' + c.id + '"><span class="chat-item-label">' + esc(c.title) + '</span><button class="chat-item-del" data-did="' + c.id + '"><i class="fas fa-xmark"></i></button></div>';
    }).join('');
  }
  if ($list) $list.addEventListener('click', function (e) {
    var d = e.target.closest('[data-did]'); if (d) { delCon(d.getAttribute('data-did'), e); return; }
    var c = e.target.closest('[data-cid]'); if (c) selCon(c.getAttribute('data-cid'));
  });

  /* ══════════════════════════════════════════════════════
   *  MESSAGE RENDERING
   * ══════════════════════════════════════════════════════ */
  function renderMsgs() {
    var c = getCon();
    if (!c || !c.msgs.length) {
      if ($ttl) $ttl.textContent = 'opensky';
      $msgs.innerHTML = welHTML();
      if (!localStorage.getItem('os_pv')) $msgs.innerHTML += privHTML();
      if (!hasKey()) $msgs.innerHTML += noKeyHTML();
      return;
    }
    if ($ttl) $ttl.textContent = c.title;
    $msgs.innerHTML = c.msgs.map(function (m) { return m.role === 'user' ? usrHTML(m) : aiHTML(m); }).join('');
    forceSc();
  }

  function usrHTML(m) {
    var fh = '';
    if (m.files && m.files.length) {
      fh = '<div class="msg-files">';
      m.files.forEach(function (f) { if (f.type === 'image' && f.thumb) fh += '<img class="msg-file-thumb" src="' + f.thumb + '" alt="' + esc(f.name) + '">'; else fh += '<span class="msg-file-chip"><i class="fas fa-file" style="font-size:8px"></i> ' + esc(f.name) + '</span>'; });
      fh += '</div>';
    }
    var et = esc(m.t).replace(/"/g, '&quot;');
    return '<div class="msg-row user"><div class="msg-bubble">' + fh + '<div>' + esc(m.t).replace(/\n/g, '<br>') + '</div><button class="msg-bubble-copy" data-t="' + et + '">Copy</button></div></div>';
  }

  function aiHTML(m) {
    var et = esc(m.t).replace(/"/g, '&quot;');
    var pills = m.toolHtml ? '<div class="tool-status">' + m.toolHtml + '</div>' : '';
    return '<div class="msg-row assistant"><div class="msg-ai-header">' + LOGO_SVG + '<span class="msg-ai-label">opensky</span></div>' +
      pills + '<div class="msg-ai-body">' + md(m.t) + '</div>' +
      '<div class="msg-ai-footer"><button class="msg-ai-action" data-ai-copy="' + et + '"><i class="fas fa-copy"></i> Copy</button><button class="msg-ai-action" data-ai-dl="' + et + '"><i class="fas fa-download"></i> .md</button><button class="msg-ai-action" data-regen="1"><i class="fas fa-rotate"></i> Redo</button></div></div>';
  }

  function privHTML() {
    return '<div class="privacy-banner" id="privacyBanner"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v4c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1z" stroke="currentColor" stroke-width="1"/></svg><span>Please do not upload any personal, confidential, or otherwise sensitive information.</span><button class="privacy-close" id="privacyClose">&times;</button></div>';
  }

  function noKeyHTML() {
    return '<div class="key-banner" style="cursor:default"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5a3.5 3.5 0 00-3 5.2L3 12.2V15h2.8l5.5-5.5A3.5 3.5 0 0011.5 1.5z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg><span style="flex:1">Set the <code>OPENKEY</code> secret in GitHub repo Settings to activate</span></div>';
  }

  function welHTML() {
    return '<div class="welcome"><div class="welcome-logo"><svg style="width:40px;height:40px" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg></div><h2>What can I help with?</h2><p>27 tools, persistent memory, file uploads, voice input, task planning, and live code preview.</p><div class="suggestions"><button class="sugg" data-s="Weather in Tokyo and info about Japan">Weather + Japan</button><button class="sugg" data-s="Build a to-do app with HTML CSS JS">Build a todo app</button><button class="sugg" data-s="Tell me a joke, a quote, and a cat fact">Joke + quote + cat</button><button class="sugg" data-s="Who created you?">Who are you?</button></div></div>';
  }

  /* ══════════════════════════════════════════════════════
   *  CODE RUNNER
   * ══════════════════════════════════════════════════════ */
  function openRunner(code) { if (!$crn || !$cfr) return; $crn.classList.add('open'); $cfr.srcdoc = code; }
  function closeRunner() { if (!$crn) return; $crn.classList.remove('open'); setTimeout(function () { if ($cfr) $cfr.srcdoc = ''; }, 350); }
  var $rc = document.getElementById('runnerClose'); if ($rc) $rc.addEventListener('click', closeRunner);
  var $rn = document.getElementById('runnerNewTab'); if ($rn) $rn.addEventListener('click', function () { if (!$cfr) return; var w = window.open(); if (w) { w.document.write($cfr.srcdoc); w.document.close(); } });
  var $dc = document.getElementById('downloadChatBtn');
  if ($dc) $dc.addEventListener('click', function () {
    var c = getCon(); if (!c || !c.msgs.length) { toast('Nothing to download', 'err'); return; }
    var o = '# ' + c.title + '\n\n'; c.msgs.forEach(function (m) { o += '### ' + (m.role === 'user' ? 'You' : 'opensky') + '\n\n' + m.t + '\n\n---\n\n'; });
    dl(o, c.title.replace(/[^a-z0-9]/gi, '_') + '.md', 'text/markdown'); toast('Downloaded', 'ok');
  });

  /* ══════════════════════════════════════════════════════
   *  REGENERATE / STOP
   * ══════════════════════════════════════════════════════ */
  async function regen() { var c = getCon(); if (!c || streaming) return; if (c.msgs.length && c.msgs[c.msgs.length - 1].role === 'assistant') { c.msgs.pop(); saveC(); renderMsgs(); } await send(); }
  function stopGen() { if (abortCtrl) abortCtrl.abort(); }

  /* ══════════════════════════════════════════════════════
   *  ★ SEND MESSAGE — Core Agentic Flow ★
   * ══════════════════════════════════════════════════════ */
  async function send() {
    var text = $inp.value.trim();
    var files = pendingFiles.slice();
    if ((!text && !files.length) || streaming) return;

    if (!hasKey()) { toast('No API key — set OPENKEY secret in GitHub repo settings', 'err'); if (!activeId) newCon(); renderMsgs(); return; }

    if (!activeId) newCon();
    var con = getCon();

    var umsg = {
      role: 'user', t: text || '(uploaded files)',
      files: files.length ? files.map(function (f) { return { type: f.type, name: f.name, mime: f.mime, data: f.data, thumb: f.thumb, isVideo: f.isVideo }; }) : null
    };
    con.msgs.push(umsg);
    if (!files.length) autoTit(con); else con.title = files.map(function (f) { return f.name; }).join(', ');
    saveC();

    $inp.value = ''; $inp.style.height = 'auto';
    pendingFiles = []; renFP(); renList(); renderMsgs();
    streaming = true; updBtn();

    var row = document.createElement('div');
    row.className = 'msg-row assistant'; row.id = 'aiRow';
    row.innerHTML = '<div class="msg-ai-header">' + LOGO_SVG + '<span class="msg-ai-label">opensky</span></div><div id="toolArea"></div><div id="planArea"></div><div id="thinkSlot"></div><div class="msg-ai-body" id="aiBody"></div>';
    $msgs.appendChild(row); forceSc();

    var thinkSlot = document.getElementById('thinkSlot');
    startThinking(thinkSlot);

    /* Route */
    var rr = Agent.route(text);
    var memCtx = '';
    if (typeof Agent.handleMem === 'function') memCtx = Agent.handleMem(rr, text);

    /* Plan */
    var plan = [];
    if (typeof Planner !== 'undefined' && Planner.createPlan) {
      plan = Planner.createPlan(text, rr.tools, rr);
      var pa = document.getElementById('planArea');
      if (pa) Planner.renderPlan(pa, plan);
    }

    /* Execute tools */
    var toolCtx = '';
    if (rr.tools.length && typeof Agent.execTools === 'function') {
      for (var si = 0; si < plan.length - 2; si++) {
        if (typeof Planner !== 'undefined') Planner.markStep(si, 'active');
        await wait(180);
        if (typeof Planner !== 'undefined') Planner.markStep(si, 'done');
      }
      try {
        var results = await Agent.execTools(rr.tools);
        var pillH = '';
        results.forEach(function (r) { pillH += '<span class="tool-pill done">' + r.icon + ' ' + r.name + (r.error ? ' \u2717' : ' \u2713') + '</span>'; });
        var ta = document.getElementById('toolArea');
        if (ta) ta.innerHTML = pillH;
        if (typeof Agent.toolCtx === 'function') toolCtx = Agent.toolCtx(results);
      } catch (e) { toolCtx = '\n[Tool error: ' + e.message + ']\n'; }
    } else {
      if (plan.length > 0 && typeof Planner !== 'undefined') { Planner.markStep(0, 'active'); await wait(120); Planner.markStep(0, 'done'); }
    }

    var gi = plan.length > 0 ? plan.length - 2 : -1;
    if (gi >= 0 && typeof Planner !== 'undefined') Planner.markStep(gi, 'active');

    /* Build API payload */
    var apiMsgs = [{ role: 'system', content: Agent.sys() + memCtx + toolCtx }];
    var recent = con.msgs.slice(-20);
    recent.forEach(function (m) {
      if (m.role === 'user') {
        if (m.files && m.files.length) {
          var parts = [{ type: 'text', text: m.t }];
          m.files.forEach(function (f) {
            if (f.type === 'image' && f.data) parts.push({ type: 'image_url', image_url: { url: 'data:' + f.mime + ';base64,' + f.data } });
            else if (f.type === 'video' && f.data) { parts.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + f.data } }); parts.push({ type: 'text', text: '[Video: ' + f.name + ']' }); }
            else if (f.type === 'document' && f.data) parts.push({ type: 'text', text: '[' + f.name + ']\n' + f.data });
            else parts.push({ type: 'text', text: '[Attached: ' + f.name + ']' });
          });
          apiMsgs.push({ role: 'user', content: parts });
        } else { apiMsgs.push({ role: 'user', content: m.t }); }
      } else { apiMsgs.push({ role: 'assistant', content: m.t }); }
    });

    /* Stream */
    abortCtrl = new AbortController();
    try {
      var res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getKey(), 'Content-Type': 'application/json', 'HTTP-Referer': location.href, 'X-Title': 'opensky' },
        body: JSON.stringify({ model: API_MODEL, messages: apiMsgs, stream: true }),
        signal: abortCtrl.signal
      });

      if (!res.ok) { var ej = await res.json().catch(function () { return {}; }); throw new Error((ej.error && ej.error.message) || ('HTTP ' + res.status)); }

      stopThinking();
      if (gi >= 0 && typeof Planner !== 'undefined') Planner.markStep(gi, 'done');
      if (plan.length > 0 && typeof Planner !== 'undefined') Planner.markStep(plan.length - 1, 'active');

      var mu = res.headers.get('x-model-used') || res.headers.get('openrouter-model');
      if (mu && $mdl) $mdl.textContent = mu;

      var body = document.getElementById('aiBody');
      body.innerHTML = '';
      var reader = res.body.getReader(), dec = new TextDecoder(), full = '', buf = '';
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buf += dec.decode(chunk.value, { stream: true });
        var lines = buf.split('\n'); buf = lines.pop() || '';
        for (var i = 0; i < lines.length; i++) {
          var ln = lines[i].trim();
          if (!ln || ln.indexOf('data:') !== 0) continue;
          var payload = ln.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            var json = JSON.parse(payload);
            var delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
            if (delta) { full += delta; body.innerHTML = md(full) + '<span class="stream-wave"></span>'; smoothSc(); }
          } catch (pe) {}
        }
      }

      body.innerHTML = md(full);
      if (plan.length > 0 && typeof Planner !== 'undefined') { Planner.markStep(plan.length - 1, 'done'); setTimeout(function () { Planner.removePlan(); }, 600); }

      var taEl = document.getElementById('toolArea');
      var savedPills = taEl ? taEl.innerHTML : '';

      /* Persist */
      con.msgs.push({ role: 'assistant', t: full, toolHtml: savedPills });
      saveC(); renderMsgs();

      /* REMOVED: Auto-remember from AI response was storing garbage facts.
         Memory is now only updated through explicit user commands ("remember that...")
         handled by Agent.route() → Agent.handleMem() */

    } catch (err) {
      stopThinking();
      if (typeof Planner !== 'undefined') Planner.removePlan();
      if (err.name === 'AbortError') {
        var ar = document.getElementById('aiRow');
        if (ar) { var bd = ar.querySelector('.msg-ai-body'); if (bd && bd.textContent.trim()) { con.msgs.push({ role: 'assistant', t: bd.textContent }); saveC(); } }
        renderMsgs(); toast('Stopped', 'ok');
      } else {
        var ar2 = document.getElementById('aiRow'); if (ar2) ar2.remove();
        var msg = err.message || 'Request failed';
        if (msg.indexOf('429') !== -1) msg = 'Rate limited — wait a moment';
        else if (msg.indexOf('401') !== -1) msg = 'Invalid API key — check OPENKEY secret';
        else if (msg.indexOf('402') !== -1) msg = 'No credits — check OpenRouter account';
        toast(msg, 'err');
      }
    } finally { streaming = false; abortCtrl = null; updBtn(); }
  }

  /* ══════════════════════════════════════════════════════
   *  SIDEBAR
   * ══════════════════════════════════════════════════════ */
  function closeSide() { if ($side) $side.classList.remove('open'); if ($over) $over.classList.remove('show'); }
  var $mt = document.getElementById('menuToggle'); if ($mt) $mt.addEventListener('click', function () { if ($side) $side.classList.toggle('open'); if ($over) $over.classList.toggle('show'); });
  if ($over) $over.addEventListener('click', closeSide);
  var $nc = document.getElementById('newChatBtn'); if ($nc) $nc.addEventListener('click', newCon);
  var $cc = document.getElementById('clearChatBtn'); if ($cc) $cc.addEventListener('click', clrCon);

  /* ══════════════════════════════════════════════════════
   *  BOOT
   * ══════════════════════════════════════════════════════ */
  loadC();
  if (convos.length) activeId = convos[0].id;
  if ($dot) $dot.classList.toggle('on', hasKey());
  if ($tmd) $tmd.textContent = Agent.label();
  renList(); renderMsgs(); updBtn(); initRecog();
  $inp.focus();
})();
