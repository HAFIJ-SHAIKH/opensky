/* ═══════════════════════════════════════════════════════════
 * opensky — app.js  |  Created by Hafij Shaikh
 * Main application logic: chat, streaming, tools, memory
 * ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Inject modal CSS (only once) ──────────────────── */
  if (!document.getElementById('osModalCSS')) {
    var mcs = document.createElement('style');
    mcs.id = 'osModalCSS';
    mcs.textContent =
      '.key-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:300;backdrop-filter:blur(4px);animation:fadeUp .25s ease both}' +
      '.key-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:301;width:90%;max-width:380px;padding:24px;background:var(--b2);border:1px solid var(--bd2);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.7);animation:fadeScale .3s cubic-bezier(.34,1.56,.64,1) both}' +
      '.key-modal h3{font-size:14px;font-weight:600;color:var(--w);margin-bottom:2px}' +
      '.key-modal input:focus{border-color:var(--g2);box-shadow:0 0 0 2px var(--g4)}' +
      '.send-btn.mic-mode{background:transparent;color:var(--g2);border:1px solid var(--bd)}' +
      '.send-btn.mic-mode:hover{color:var(--g1);border-color:var(--bd2);background:var(--b3);opacity:1;transform:translateY(-1px)}' +
      '.send-btn.mic-mode:active{transform:scale(.93)}' +
      '.thinking-text{padding-left:23px;font-size:10.5px;color:var(--g3);animation:fadeUp .3s ease both}' +
      '.thinking-text span{display:inline-block}' +
      '@keyframes thinkPulse{0%,100%{opacity:.4}50%{opacity:1}}' +
      '.thinking-text span.active{color:var(--g1);animation:thinkPulse 1.2s ease-in-out infinite}' +
      '.send-btn svg{transition:transform .2s cubic-bezier(.34,1.56,.64,1),opacity .15s ease}' +
      '.send-btn:active svg{transform:scale(.85)}';
    document.head.appendChild(mcs);
  }

  /* ── Config ───────────────────────────────────────── */
  var API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  var API_MODEL = 'openrouter/free';
  var KEY_PH = '__OPENKEY__';

  /* ── SVG Icons ────────────────────────────────────── */
  var ICON_SEND =
    '<svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_MIC =
    '<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="7" y="2" width="6" height="10" rx="3" stroke="currentColor" stroke-width="1.3"/><path d="M4 9a6 6 0 0012 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10 15v3M7 18h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  var ICON_STOP =
    '<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>';
  var LOGO_SVG =
    '<svg class="msg-ai-icon" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg>';

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

  if (!$msgs || !$inp || !$btn) {
    console.error('opensky: missing critical DOM');
    return;
  }

  /* ══════════════════════════════════════════════════════
   *  API KEY
   * ══════════════════════════════════════════════════════ */
  function getKey() {
    try { var a = localStorage.getItem('os_userkey'); if (a && a.trim().length > 3) return a.trim(); } catch (e) {}
    try { var b = sessionStorage.getItem('os_userkey'); if (b && b.trim().length > 3) return b.trim(); } catch (e) {}
    if (KEY_PH !== '__OPENKEY__' && KEY_PH.trim().length > 3) return KEY_PH.trim();
    return null;
  }
  function hasKey() { return getKey() !== null; }
  function refreshDot() { if ($dot) $dot.classList.toggle('on', hasKey()); }
  function saveKey(k) {
    try { localStorage.setItem('os_userkey', k.trim()); } catch (e) {}
    try { sessionStorage.setItem('os_userkey', k.trim()); } catch (e) {}
    refreshDot(); renderMsgs(); toast('API key saved', 'ok');
  }
  function clearKey() {
    try { localStorage.removeItem('os_userkey'); } catch (e) {}
    try { sessionStorage.removeItem('os_userkey'); } catch (e) {}
    refreshDot(); renderMsgs(); toast('Key removed', 'ok');
  }

  /* Custom key modal — replaces window.prompt() */
  function promptKey() {
    var old = document.getElementById('keyModal');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'keyModal';
    el.innerHTML =
      '<div class="key-modal-overlay"></div>' +
      '<div class="key-modal">' +
        '<h3>OpenRouter API Key</h3>' +
        '<p style="font-size:11px;color:var(--g2);margin:6px 0 14px;line-height:1.5">' +
          'Paste your key (starts with <code style="background:var(--b4);padding:1px 5px;border-radius:3px;font-family:var(--m);font-size:10px;color:var(--g1)">sk-or-</code>)' +
        '</p>' +
        '<input id="keyIn" type="password" placeholder="sk-or-v1-..." ' +
          'style="width:100%;padding:10px 12px;background:var(--b1);border:1px solid var(--bd2);border-radius:8px;color:var(--w);font-family:var(--m);font-size:12px;outline:none;margin-bottom:12px;transition:all .2s" />' +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' +
          '<button id="keyNo" style="padding:8px 18px;background:var(--b3);border:1px solid var(--bd);border-radius:7px;color:var(--g1);font-family:var(--f);font-size:11px;cursor:pointer;transition:all .15s">Cancel</button>' +
          '<button id="keyYes" style="padding:8px 18px;background:var(--w);border:none;border-radius:7px;color:#000;font-family:var(--f);font-size:11px;font-weight:600;cursor:pointer;transition:all .15s">Save Key</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    var inp = document.getElementById('keyIn');
    setTimeout(function () { inp.focus(); }, 80);
    document.getElementById('keyNo').onclick = function () { el.remove(); };
    document.getElementById('keyYes').onclick = function () {
      var v = inp.value.trim();
      if (v.length < 5) { toast('Key too short', 'err'); return; }
      saveKey(v); el.remove();
    };
    el.querySelector('.key-modal-overlay').onclick = function () { el.remove(); };
    inp.onkeydown = function (e) {
      if (e.key === 'Enter') document.getElementById('keyYes').click();
      if (e.key === 'Escape') el.remove();
    };
  }

  /* ══════════════════════════════════════════════════════
   *  BACKGROUND PARTICLES
   * ══════════════════════════════════════════════════════ */
  (function () {
    var c = document.getElementById('bgCanvas');
    if (!c) return;
    var x = c.getContext('2d'), ps = [], N = 28;
    function rz() { c.width = innerWidth; c.height = innerHeight; }
    function sd() {
      ps = [];
      for (var i = 0; i < N; i++)
        ps.push({
          x: Math.random() * c.width, y: Math.random() * c.height,
          r: Math.random() * 0.5 + 0.08, a: Math.random() * 0.05 + 0.008,
          vx: (Math.random() - 0.5) * 0.035, vy: (Math.random() - 0.5) * 0.02,
          ph: Math.random() * 6.28
        });
    }
    function dr(t) {
      x.clearRect(0, 0, c.width, c.height);
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
        if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
        var f = 0.5 + 0.5 * Math.sin(t * 0.0003 + p.ph);
        x.beginPath();
        x.arc(p.x, p.y, Math.max(0.1, p.r), 0, 6.28);
        x.fillStyle = 'rgba(255,255,255,' + (p.a * f).toFixed(4) + ')';
        x.fill();
      }
      requestAnimationFrame(dr);
    }
    addEventListener('resize', function () { rz(); sd(); });
    rz(); sd(); requestAnimationFrame(dr);
  })();

  /* ══════════════════════════════════════════════════════
   *  SCROLL
   * ══════════════════════════════════════════════════════ */
  if ($area) {
    $area.addEventListener('scroll', function () {
      if (!scrollLock) autoScroll = ($area.scrollHeight - $area.scrollTop - $area.clientHeight) < 80;
    });
  }
  function smoothSc() {
    scrollLock = true;
    requestAnimationFrame(function () {
      if (autoScroll && $area) $area.scrollTop = $area.scrollHeight;
      scrollLock = false;
    });
  }
  function forceSc() {
    autoScroll = true;
    requestAnimationFrame(function () { if ($area) $area.scrollTop = $area.scrollHeight; });
  }

  /* ══════════════════════════════════════════════════════
   *  MARKDOWN
   * ══════════════════════════════════════════════════════ */
  function md(raw) {
    var h = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    h = h.replace(/```(html)\n?([\s\S]*?)```/g, function (_, l, c) {
      var id = 'c' + Math.random().toString(36).slice(2, 8);
      return '<pre><code id="' + id + '">' + c.trim() + '</code>' +
        '<button class="copy-code-btn run-btn" data-run="' + id + '">Run</button>' +
        '<button class="copy-code-btn" data-cid="' + id + '">Copy</button></pre>';
    });
    h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, l, c) {
      var id = 'c' + Math.random().toString(36).slice(2, 8);
      return '<pre><code id="' + id + '">' + c.trim() + '</code>' +
        '<button class="copy-code-btn" data-cid="' + id + '">Copy</button>' +
        '<button class="copy-code-btn" data-cid-dl="' + id + '" data-ext="' + (l || 'txt') + '">Save</button></pre>';
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
  function clip(t) {
    navigator.clipboard.writeText(t).then(function () { toast('Copied', 'ok'); }).catch(function () { toast('Copy failed', 'err'); });
  }
  function dl(c, n, m) {
    var b = new Blob([c], { type: m || 'text/plain' }), u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = n; a.click(); URL.revokeObjectURL(u);
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
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
        return '<span' + (i === idx ? ' class="active"' : '') + '>' + (i < idx ? '✓ ' : '') + esc(s) + '</span>';
      }).join(' &nbsp;·&nbsp; ');
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
    /* Copy code */
    t = e.target.closest('[data-cid]');
    if (t) { var c = document.getElementById(t.getAttribute('data-cid')); if (c) clip(c.textContent); return; }
    /* Download code */
    t = e.target.closest('[data-cid-dl]');
    if (t) { var c2 = document.getElementById(t.getAttribute('data-cid-dl')); if (c2) dl(c2.textContent, 'code.' + (t.getAttribute('data-ext') || 'txt')); return; }
    /* Run HTML */
    t = e.target.closest('[data-run]');
    if (t) { var c3 = document.getElementById(t.getAttribute('data-run')); if (c3) openRunner(c3.textContent); return; }
    /* Copy bubble */
    t = e.target.closest('.msg-bubble-copy');
    if (t) { clip(t.getAttribute('data-t')); return; }
    /* Copy AI */
    t = e.target.closest('[data-ai-copy]');
    if (t) { clip(t.getAttribute('data-ai-copy')); return; }
    /* Download AI .md */
    t = e.target.closest('[data-ai-dl]');
    if (t) { dl(t.getAttribute('data-ai-dl'), 'response.md', 'text/markdown'); return; }
    /* Regenerate */
    if (e.target.closest('[data-regen]')) { regen(); return; }
    /* Follow-up */
    t = e.target.closest('[data-fu]');
    if (t) { $inp.value = t.getAttribute('data-fu'); ri($inp); updBtn(); send(); return; }
    /* Suggestion */
    t = e.target.closest('[data-s]');
    if (t) { $inp.value = t.getAttribute('data-s'); ri($inp); updBtn(); send(); return; }
    /* Privacy close */
    if (e.target.closest('#privacyClose')) {
      localStorage.setItem('os_pv', '1');
      var pb = document.getElementById('privacyBanner');
      if (pb) { pb.style.opacity = '0'; pb.style.transform = 'translateY(-6px)'; setTimeout(function () { pb.remove(); }, 300); }
      return;
    }
    /* Key banner */
    if (e.target.closest('#keyBanner')) { promptKey(); return; }
    /* Clear key */
    if (e.target.closest('#clearKeyBtn')) { clearKey(); return; }
  });

  /* ══════════════════════════════════════════════════════
   *  COMBINED SEND / MIC BUTTON
   * ══════════════════════════════════════════════════════ */
  function updBtn() {
    if (streaming) {
      $btn.className = 'send-btn stop';
      $btn.innerHTML = ICON_STOP;
      $btn.title = 'Stop';
      return;
    }
    var has = $inp.value.trim().length > 0 || pendingFiles.length > 0;
    $btn.className = has ? 'send-btn' : 'send-btn mic-mode';
    $btn.innerHTML = has ? ICON_SEND : ICON_MIC;
    $btn.title = has ? 'Send' : 'Voice input';
  }

  function initRecog() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return false;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recog = new SR();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog.onresult = function (e) {
      var t = '';
      for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      $inp.value = t; ri($inp); updBtn();
    };
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
      if ($fin) {
        $fin.accept = t === 'image' ? 'image/*' : t === 'video' ? 'video/*' :
          '.txt,.md,.json,.csv,.py,.js,.ts,.html,.css,.xml,.yaml,.yml,.sh,.c,.cpp,.h,.java,.rb,.go,.rs,.php,.sql,.log,.ini,.cfg';
        $fin.click();
      }
    });
  });
  if ($fin) $fin.addEventListener('change', function () { Array.from($fin.files).forEach(addFile); $fin.value = ''; });

  function addFile(f) {
    var e = { name: f.name, size: f.size, type: '', mime: f.type, data: null, thumb: null };
    var img = f.type.startsWith('image/'), vid = f.type.startsWith('video/'), txt = !img && !vid && f.size < 500000;
    if (img) {
      e.type = 'image';
      var r = new FileReader();
      r.onload = function (x) { e.data = x.target.result.split(',')[1]; e.thumb = x.target.result; pendingFiles.push(e); renFP(); updBtn(); };
      r.readAsDataURL(f);
    } else if (vid) {
      e.type = 'video';
      exVid(f).then(function (d) { e.data = d ? d.split(',')[1] : null; e.thumb = d; e.isVideo = true; pendingFiles.push(e); renFP(); updBtn(); });
    } else if (txt) {
      e.type = 'document';
      var r2 = new FileReader();
      r2.onload = function (x) { e.data = x.target.result; pendingFiles.push(e); renFP(); updBtn(); };
      r2.readAsText(f);
    } else { toast('Unsupported file', 'err'); }
  }
  function exVid(f) {
    return new Promise(function (r) {
      try {
        var v = document.createElement('video'); v.muted = true; v.preload = 'auto';
        v.onloadeddata = function () { v.currentTime = Math.min(1, v.duration * 0.1); };
        v.onseeked = function () { var c = document.createElement('canvas'); c.width = v.videoWidth || 320; c.height = v.videoHeight || 240; c.getContext('2d').drawImage(v, 0, 0); r(c.toDataURL('image/jpeg', 0.6)); };
        v.onerror = function () { r(null); }; v.src = URL.createObjectURL(f);
        setTimeout(function () { r(null); }, 5000);
      } catch (e) { r(null); }
    });
  }
  function renFP() {
    if (!$fpr) return;
    $fpr.innerHTML = pendingFiles.map(function (f, i) {
      var im = f.thumb ? '<img src="' + f.thumb + '" alt="">' : '';
      return '<div class="fp-item">' + im + '<span>' + esc(f.name) + '</span><button class="fp-remove" data-fi="' + i + '">&times;</button></div>';
    }).join('');
  }
  if ($fpr) $fpr.addEventListener('click', function (e) {
    var b = e.target.closest('.fp-remove');
    if (b) { pendingFiles.splice(parseInt(b.getAttribute('data-fi')), 1); renFP(); updBtn(); }
  });

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
    var b = e.target.closest('.mode-btn');
    if (!b) return;
    Agent.setMode(b.getAttribute('data-mode'));
    document.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.remove('active'); });
    b.classList.add('active');
    if ($tmd) { $tmd.textContent = Agent.label(); $tmd.style.background = 'var(--bd2)'; setTimeout(function () { $tmd.style.background = ''; }, 300); }
  });

  /* ══════════════════════════════════════════════════════
   *  CONVERSATIONS
   * ══════════════════════════════════════════════════════ */
  function loadC() { try { convos = JSON.parse(localStorage.getItem('os_c') || '[]'); } catch (e) { convos = []; } }
  function saveC() { try { localStorage.setItem('os_c', JSON.stringify(convos)); } catch (e) {} }
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
      if (!hasKey()) $msgs.innerHTML += keyHTML();
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
      m.files.forEach(function (f) {
        if (f.type === 'image' && f.thumb) fh += '<img class="msg-file-thumb" src="' + f.thumb + '" alt="' + esc(f.name) + '">';
        else fh += '<span class="msg-file-chip"><i class="fas fa-file" style="font-size:8px"></i> ' + esc(f.name) + '</span>';
      });
      fh += '</div>';
    }
    var et = esc(m.t).replace(/"/g, '&quot;');
    return '<div class="msg-row user"><div class="msg-bubble">' + fh + '<div>' + esc(m.t).replace(/\n/g, '<br>') + '</div><button class="msg-bubble-copy" data-t="' + et + '">Copy</button></div></div>';
  }

  function aiHTML(m) {
    var et = esc(m.t).replace(/"/g, '&quot;'), fu = '';
    if (m.fu && m.fu.length) {
      fu = '<div class="follow-ups">';
      m.fu.forEach(function (f) { fu += '<button class="fu-chip" data-fu="' + esc(f).replace(/"/g, '&quot;') + '">' + esc(f) + '</button>'; });
      fu += '</div>';
    }
    var pills = m.toolHtml ? '<div class="tool-status">' + m.toolHtml + '</div>' : '';
    return '<div class="msg-row assistant"><div class="msg-ai-header">' + LOGO_SVG + '<span class="msg-ai-label">opensky</span></div>' +
      pills + '<div class="msg-ai-body">' + md(m.t) + '</div>' + fu +
      '<div class="msg-ai-footer"><button class="msg-ai-action" data-ai-copy="' + et + '"><i class="fas fa-copy"></i> Copy</button><button class="msg-ai-action" data-ai-dl="' + et + '"><i class="fas fa-download"></i> .md</button><button class="msg-ai-action" data-regen="1"><i class="fas fa-rotate"></i> Redo</button></div></div>';
  }

  function privHTML() {
    return '<div class="privacy-banner" id="privacyBanner"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v4c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1z" stroke="currentColor" stroke-width="1"/></svg><span>Please do not upload any personal, confidential, or otherwise sensitive information.</span><button class="privacy-close" id="privacyClose">&times;</button></div>';
  }
  function keyHTML() {
    return '<div class="key-banner" id="keyBanner"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5a3.5 3.5 0 00-3 5.2L3 12.2V15h2.8l5.5-5.5A3.5 3.5 0 0011.5 1.5z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg><span style="flex:1">No API key — <u style="cursor:pointer">click to enter</u></span><button id="clearKeyBtn" class="privacy-close" title="Clear saved key" style="margin:0 0 0 8px">&times;</button></div>';
  }
  function welHTML() {
    return '<div class="welcome"><div class="welcome-logo"><svg style="width:40px;height:40px" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg></div><h2>What can I help with?</h2><p>25 tools, persistent memory, file uploads, voice input, task planning, and live code preview.</p><div class="suggestions"><button class="sugg" data-s="Weather in Tokyo and info about Japan">Weather + Japan</button><button class="sugg" data-s="Build a to-do app with HTML CSS JS">Build a todo app</button><button class="sugg" data-s="Tell me a joke, a quote, and a cat fact">Joke + quote + cat</button><button class="sugg" data-s="Who created you?">Who are you?</button></div></div>';
  }

  /* ══════════════════════════════════════════════════════
   *  CODE RUNNER
   * ══════════════════════════════════════════════════════ */
  function openRunner(code) { if (!$crn || !$cfr) return; $crn.classList.add('open'); $cfr.srcdoc = code; }
  function closeRunner() { if (!$crn) return; $crn.classList.remove('open'); setTimeout(function () { if ($cfr) $cfr.srcdoc = ''; }, 350); }
  var $rc = document.getElementById('runnerClose'); if ($rc) $rc.addEventListener('click', closeRunner);
  var $rn = document.getElementById('runnerNewTab');
  if ($rn) $rn.addEventListener('click', function () { if (!$cfr) return; var w = window.open(); if (w) { w.document.write($cfr.srcdoc); w.document.close(); } });

  /* Download chat */
  var $dc = document.getElementById('downloadChatBtn');
  if ($dc) $dc.addEventListener('click', function () {
    var c = getCon(); if (!c || !c.msgs.length) { toast('Nothing to download', 'err'); return; }
    var o = '# ' + c.title + '\n\n'; c.msgs.forEach(function (m) { o += '### ' + (m.role === 'user' ? 'You' : 'opensky') + '\n\n' + m.t + '\n\n---\n\n'; });
    dl(o, c.title.replace(/[^a-z0-9]/gi, '_') + '.md', 'text/markdown'); toast('Downloaded', 'ok');
  });

  /* ══════════════════════════════════════════════════════
   *  REGENERATE
   * ══════════════════════════════════════════════════════ */
  async function regen() {
    var c = getCon(); if (!c || streaming) return;
    if (c.msgs.length && c.msgs[c.msgs.length - 1].role === 'assistant') { c.msgs.pop(); saveC(); renderMsgs(); }
    await send();
  }

  /* ══════════════════════════════════════════════════════
   *  STOP
   * ══════════════════════════════════════════════════════ */
  function stopGen() { if (abortCtrl) abortCtrl.abort(); }

  /* ══════════════════════════════════════════════════════
   *  FOLLOW-UP GENERATION
   * ══════════════════════════════════════════════════════ */
  async function genFU(conv) {
    try {
      var last = conv.slice(-4);
      var p = 'Suggest exactly 3 short follow-up questions (under 8 words each). Return ONLY a valid JSON array of strings. No explanation.\n\n' +
        last.map(function (m) { return (m.role === 'user' ? 'User: ' : 'AI: ') + m.t; }).join('\n');
      var r = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getKey(), 'Content-Type': 'application/json', 'HTTP-Referer': location.href, 'X-Title': 'opensky' },
        body: JSON.stringify({ model: API_MODEL, messages: [{ role: 'user', content: p }], stream: false })
      });
      var d = await r.json();
      var txt = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
      txt = txt.replace(/```json?/g, '').replace(/```/g, '').trim();
      var arr = JSON.parse(txt);
      if (Array.isArray(arr)) return arr.filter(function (f) { return f.length > 3 && f.length < 60; }).slice(0, 3);
    } catch (e) { /* silent */ }
    return [];
  }

  /* ══════════════════════════════════════════════════════
   *  ★ SEND MESSAGE — Core Agentic Flow ★
   * ══════════════════════════════════════════════════════ */
  async function send() {
    var text = $inp.value.trim();
    var files = pendingFiles.slice();
    if ((!text && !files.length) || streaming) return;

    /* ─ Key check ─ */
    var key = getKey();
    if (!key) {
      toast('No API key — click the banner to add one', 'err');
      if (!activeId) newCon();
      renderMsgs();
      return;
    }

    /* ─ Ensure conversation ─ */
    if (!activeId) newCon();
    var con = getCon();

    /* ─ Build user message ─ */
    var umsg = {
      role: 'user', t: text || '(uploaded files)',
      files: files.length ? files.map(function (f) { return { type: f.type, name: f.name, mime: f.mime, data: f.data, thumb: f.thumb, isVideo: f.isVideo }; }) : null
    };
    con.msgs.push(umsg);
    if (!files.length) autoTit(con); else con.title = files.map(function (f) { return f.name; }).join(', ');
    saveC();

    /* ─ Clear input ─ */
    $inp.value = ''; $inp.style.height = 'auto';
    pendingFiles = []; renFP(); renList(); renderMsgs();

    /* ─ Lock UI ─ */
    streaming = true; updBtn();

    /* ─ Create AI row ─ */
    var row = document.createElement('div');
    row.className = 'msg-row assistant';
    row.id = 'aiRow';
    row.innerHTML =
      '<div class="msg-ai-header">' + LOGO_SVG + '<span class="msg-ai-label">opensky</span></div>' +
      '<div id="toolArea"></div>' +
      '<div id="planArea"></div>' +
      '<div id="thinkSlot"></div>' +
      '<div class="msg-ai-body" id="aiBody"></div>';
    $msgs.appendChild(row);
    forceSc();

    /* ─ Start thinking animation ─ */
    var thinkSlot = document.getElementById('thinkSlot');
    startThinking(thinkSlot);

    /* ─ Route ─ */
    var rr = Agent.route(text);
    var memCtx = '';
    if (typeof Agent.handleMem === 'function') memCtx = Agent.handleMem(rr, text);

    /* ─ Plan ─ */
    var plan = [];
    if (typeof Planner !== 'undefined' && Planner.createPlan) {
      plan = Planner.createPlan(text, rr.tools, rr);
      var pa = document.getElementById('planArea');
      if (pa) Planner.renderPlan(pa, plan);
    }

    /* ─ Execute tools ─ */
    var toolCtx = '';
    if (rr.tools.length && typeof Agent.execTools === 'function') {
      /* Step through plan visually */
      for (var si = 0; si < plan.length - 2; si++) {
        if (typeof Planner !== 'undefined') Planner.markStep(si, 'active');
        await wait(180);
        if (typeof Planner !== 'undefined') Planner.markStep(si, 'done');
      }
      try {
        var results = await Agent.execTools(rr.tools);
        var pillH = '';
        results.forEach(function (r) {
          pillH += '<span class="tool-pill done">' + r.icon + ' ' + r.name + (r.error ? ' ✗' : ' ✓') + '</span>';
        });
        var ta = document.getElementById('toolArea');
        if (ta) ta.innerHTML = pillH;
        if (typeof Agent.toolCtx === 'function') toolCtx = Agent.toolCtx(results);
      } catch (e) {
        toolCtx = '\n[Tool error: ' + e.message + ']\n';
      }
    } else {
      if (plan.length > 0 && typeof Planner !== 'undefined') {
        Planner.markStep(0, 'active');
        await wait(120);
        Planner.markStep(0, 'done');
      }
    }

    /* ─ Mark generate step ─ */
    var gi = plan.length > 0 ? plan.length - 2 : -1;
    if (gi >= 0 && typeof Planner !== 'undefined') Planner.markStep(gi, 'active');

    /* ─ Build API payload ─ */
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
        } else {
          apiMsgs.push({ role: 'user', content: m.t });
        }
      } else {
        apiMsgs.push({ role: 'assistant', content: m.t });
      }
    });

    /* ─ Stream ─ */
    abortCtrl = new AbortController();
    try {
      var res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'HTTP-Referer': location.href, 'X-Title': 'opensky' },
        body: JSON.stringify({ model: API_MODEL, messages: apiMsgs, stream: true }),
        signal: abortCtrl.signal
      });

      if (!res.ok) {
        var ej = await res.json().catch(function () { return {}; });
        throw new Error((ej.error && ej.error.message) || ('HTTP ' + res.status));
      }

      /* Stop thinking, show generating */
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
        var lines = buf.split('\n');
        buf = lines.pop() || '';
        for (var i = 0; i < lines.length; i++) {
          var ln = lines[i].trim();
          if (!ln || ln.indexOf('data:') !== 0) continue;
          var payload = ln.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            var json = JSON.parse(payload);
            var delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
            if (delta) { full += delta; body.innerHTML = md(full) + '<span class="stream-wave"></span>'; smoothSc(); }
          } catch (pe) { /* skip bad json */ }
        }
      }

      /* Final render */
      body.innerHTML = md(full);
      if (plan.length > 0 && typeof Planner !== 'undefined') {
        Planner.markStep(plan.length - 1, 'done');
        setTimeout(function () { Planner.removePlan(); }, 600);
      }

      /* Save tool pills */
      var taEl = document.getElementById('toolArea');
      var savedPills = taEl ? taEl.innerHTML : '';

      /* Follow-ups */
      var fu = await genFU(con.msgs.concat([{ role: 'assistant', t: full }]));

      /* Persist */
      con.msgs.push({ role: 'assistant', t: full, fu: fu, toolHtml: savedPills });
      saveC();
      renderMsgs();

      /* Auto-remember from response */
      try {
        var mm = full.match(/(?:remember|note|save|store|keep in mind)\s*(?:that|this|the fact)\s*:?\s*(.+)/i);
        if (mm) Agent.memory.remember(mm[1].trim().slice(0, 200), 'fact');
      } catch (e) { /* silent */ }

    } catch (err) {
      stopThinking();
      if (typeof Planner !== 'undefined') Planner.removePlan();

      if (err.name === 'AbortError') {
        var ar = document.getElementById('aiRow');
        if (ar) {
          var bd = ar.querySelector('.msg-ai-body');
          if (bd && bd.textContent.trim()) { con.msgs.push({ role: 'assistant', t: bd.textContent }); saveC(); }
        }
        renderMsgs();
        toast('Stopped', 'ok');
      } else {
        var ar2 = document.getElementById('aiRow');
        if (ar2) ar2.remove();
        var msg = err.message || 'Request failed';
        if (msg.indexOf('429') !== -1) msg = 'Rate limited — wait a moment';
        else if (msg.indexOf('401') !== -1) msg = 'Invalid API key';
        else if (msg.indexOf('402') !== -1) msg = 'No credits — check OpenRouter';
        toast(msg, 'err');
      }
    } finally {
      streaming = false; abortCtrl = null; updBtn();
    }
  }

  /* ══════════════════════════════════════════════════════
   *  SIDEBAR
   * ══════════════════════════════════════════════════════ */
  function closeSide() { if ($side) $side.classList.remove('open'); if ($over) $over.classList.remove('show'); }
  var $mt = document.getElementById('menuToggle');
  if ($mt) $mt.addEventListener('click', function () { if ($side) $side.classList.toggle('open'); if ($over) $over.classList.toggle('show'); });
  if ($over) $over.addEventListener('click', closeSide);
  var $nc = document.getElementById('newChatBtn'); if ($nc) $nc.addEventListener('click', newCon);
  var $cc = document.getElementById('clearChatBtn'); if ($cc) $cc.addEventListener('click', clrCon);

  /* ══════════════════════════════════════════════════════
   *  BOOT
   * ══════════════════════════════════════════════════════ */
  loadC();
  if (convos.length) activeId = convos[0].id;
  refreshDot();
  if ($tmd) $tmd.textContent = Agent.label();
  renList();
  renderMsgs();
  updBtn();
  initRecog();
  $inp.focus();

})();
