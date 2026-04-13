/* ═══════════════════════════════════════════════════════════
 * opensky — app.js  |  Created by Hafij Shaikh
 * ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  var API_MODEL = 'openrouter/free';
  var KEY_PH = 'NONE';

  var IC = {
    send: '<svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mic: '<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="7" y="2" width="6" height="10" rx="3" stroke="currentColor" stroke-width="1.3"/><path d="M4 9a6 6 0 0012 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10 15v3M7 18h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    stop: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>',
    gear: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    eye: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    logo: '<svg class="msg-ai-icon" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg>'
  };

  /* ══════════════════════════════════════════════════════
   *  KEY MANAGEMENT
   * ══════════════════════════════════════════════════════ */
  var Keys = {
    _inj: null,
    _man: null,

    init: function () {
      /* Detect injected key — check if KEY_PH is anything other than NONE */
      if (KEY_PH && KEY_PH !== 'NONE' && KEY_PH.length > 10) {
        this._inj = KEY_PH;
      }
      /* Check localStorage for manually saved key */
      try {
        var s = localStorage.getItem('os_key');
        if (s && s.length > 10) this._man = s;
      } catch (e) {}

      console.log('opensky key: source=' + this.src() + ' has=' + this.has());
    },

    get: function () { return this._inj || this._man || null; },
    has: function () { return this.get() !== null; },
    src: function () {
      if (this._inj) return 'secret';
      if (this._man) return 'manual';
      return 'none';
    },

    save: function (k) {
      if (!k || k.length < 10) return false;
      this._man = k;
      try { localStorage.setItem('os_key', k); return true; }
      catch (e) { return false; }
    },

    remove: function () {
      this._man = null;
      try { localStorage.removeItem('os_key'); } catch (e) {}
    }
  };
  Keys.init();

  /* ══════════════════════════════════════════════════════
   *  STATE
   * ══════════════════════════════════════════════════════ */
  var convos = [], activeId = null, streaming = false, abortCtrl = null;
  var autoScroll = true, scrollLock = false, pendingFiles = [];
  var recording = false, recog = null, thinkTimer = null;
  var streamDirty = false, streamRAF = null;

  /* ══════════════════════════════════════════════════════
   *  DOM
   * ══════════════════════════════════════════════════════ */
  var $list = document.getElementById('chatList');
  var $msgs = document.getElementById('chatMessages');
  var $area = document.getElementById('chatArea');
  var $inp  = document.getElementById('messageInput');
  var $btn  = document.getElementById('sendBtn');
  var $ttl  = document.getElementById('topbarTitle');
  var $tmd  = document.getElementById('topbarMode');
  var $mdl  = document.getElementById('modelLabel');
  var $dot  = document.getElementById('statusDot');
  var $side = document.getElementById('sidebar');
  var $over = document.getElementById('sidebarOverlay');
  var $tst  = document.getElementById('toastContainer');
  var $fpr  = document.getElementById('filePreview');
  var $fin  = document.getElementById('fileInput');
  var $amn  = document.getElementById('attachMenu');
  var $crn  = document.getElementById('codeRunner');
  var $cfr  = document.getElementById('runnerFrame');

  if (!$msgs || !$inp || !$btn) { console.error('opensky: missing DOM'); return; }
  if (typeof Agent === 'undefined') { console.error('opensky: Agent not loaded — check script order'); return; }

  /* Inject settings button */
  (function () {
    var sp = document.querySelector('.topbar-spacer');
    if (!sp) return;
    var b = document.createElement('button');
    b.className = 'icon-btn'; b.id = 'settingsBtn';
    b.title = 'Settings'; b.innerHTML = IC.gear;
    sp.parentNode.insertBefore(b, sp);
  })();

  /* ══════════════════════════════════════════════════════
   *  SETTINGS MODAL
   * ══════════════════════════════════════════════════════ */
  function createSettings() {
    if (document.getElementById('settingsOverlay')) return;
    var el = document.createElement('div');
    el.className = 'settings-overlay'; el.id = 'settingsOverlay';
    el.innerHTML =
      '<div class="settings-modal">' +
        '<div class="settings-head"><div class="settings-title-wrap"><span class="settings-gear">' + IC.gear + '</span><span>Settings</span></div><button class="settings-close-btn" id="settingsClose">&times;</button></div>' +
        '<div class="settings-body">' +
          '<div class="s-group"><div class="s-group-label">Connection</div>' +
            '<div class="s-key-status"><span class="s-dot" id="sDot"></span><span id="sStatusText">Checking...</span><span class="s-src-badge" id="sSrcBadge"></span></div>' +
          '</div>' +
          '<div class="s-group"><div class="s-group-label">OpenRouter API Key</div>' +
            '<div class="s-hint">Stored locally. Only sent to OpenRouter.</div>' +
            '<div class="s-key-input-wrap"><input type="password" id="sKeyInput" placeholder="sk-or-v1-..." autocomplete="off" spellcheck="false"/><button class="s-toggle-vis" id="sKeyToggle">' + IC.eye + '</button></div>' +
            '<div class="s-key-btns"><button class="s-btn s-btn-save" id="sKeySave">Save Key</button><button class="s-btn s-btn-remove" id="sKeyRemove">Remove</button></div>' +
          '</div>' +
          '<div class="s-divider"></div>' +
          '<div class="s-group"><div class="s-group-label s-label-red">Danger Zone</div><button class="s-btn s-btn-danger" id="sClearAll">Clear All Data</button><div class="s-hint">Removes all chats, memories, and saved key</div></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    document.getElementById('settingsClose').addEventListener('click', closeSettings);
    el.addEventListener('click', function (e) { if (e.target === el) closeSettings(); });

    var keyVis = false;
    document.getElementById('sKeyToggle').addEventListener('click', function () {
      keyVis = !keyVis;
      document.getElementById('sKeyInput').type = keyVis ? 'text' : 'password';
      this.innerHTML = keyVis ? IC.eyeOff : IC.eye;
    });

    document.getElementById('sKeySave').addEventListener('click', function () {
      var v = document.getElementById('sKeyInput').value.trim();
      if (v.length < 10) { toast('Key must be at least 10 characters', 'err'); return; }
      if (Keys.save(v)) { toast('API key saved', 'ok'); document.getElementById('sKeyInput').value = ''; refreshKeyUI(); renderMsgs(); }
      else toast('Failed to save', 'err');
    });

    document.getElementById('sKeyRemove').addEventListener('click', function () {
      Keys.remove(); document.getElementById('sKeyInput').value = '';
      toast('Key removed', 'ok'); refreshKeyUI(); renderMsgs();
    });

    document.getElementById('sClearAll').addEventListener('click', function () {
      Keys.remove();
      try { localStorage.clear(); } catch (e) {}
      if (typeof Agent !== 'undefined' && Agent.memory) Agent.memory.clear();
      convos = []; activeId = null;
      saveC(); renList(); renderMsgs(); toast('All data cleared', 'ok'); closeSettings();
    });

    document.getElementById('sKeyInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('sKeySave').click();
    });
  }

  function openSettings() { createSettings(); var el = document.getElementById('settingsOverlay'); if (el) { el.classList.add('open'); refreshKeyUI(); setTimeout(function () { document.getElementById('sKeyInput').focus(); }, 200); } }
  function closeSettings() { var el = document.getElementById('settingsOverlay'); if (el) el.classList.remove('open'); }

  function refreshKeyUI() {
    var dot = document.getElementById('sDot'), txt = document.getElementById('sStatusText'), badge = document.getElementById('sSrcBadge');
    if (!dot) return;
    if (Keys.has()) {
      dot.className = 's-dot s-dot-on'; txt.textContent = 'Connected';
      if (badge) { var s = Keys.src(); badge.textContent = s === 'secret' ? 'GitHub Secret' : 'Manual'; badge.className = 's-src-badge ' + (s === 'secret' ? 's-badge-green' : 's-badge-blue'); }
    } else {
      dot.className = 's-dot s-dot-off'; txt.textContent = 'No key configured';
      if (badge) { badge.textContent = ''; badge.className = 's-src-badge'; }
    }
    if ($dot) $dot.classList.toggle('on', Keys.has());
  }

  /* ══════════════════════════════════════════════════════
   *  PARTICLES
   * ══════════════════════════════════════════════════════ */
  (function () {
    var c = document.getElementById('bgCanvas'); if (!c) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var sx = c.getContext('2d'); function rz() { c.width = innerWidth; c.height = innerHeight; } rz();
      sx.fillStyle = 'rgba(255,255,255,0.025)';
      for (var i = 0; i < 18; i++) { sx.beginPath(); sx.arc(Math.random()*c.width, Math.random()*c.height, Math.max(.1,Math.random()*.5+.08), 0, 6.28); sx.fill(); }
      addEventListener('resize', rz); return;
    }
    var x = c.getContext('2d'), ps = [], N = 26, hidden = false;
    function rz() { c.width = innerWidth; c.height = innerHeight; }
    function sd() { ps = []; for (var i = 0; i < N; i++) ps.push({ x: Math.random()*c.width, y: Math.random()*c.height, r: Math.random()*.5+.08, a: Math.random()*.04+.008, vx: (Math.random()-.5)*.03, vy: (Math.random()-.5)*.02, ph: Math.random()*6.28 }); }
    function dr(t) { if (hidden) { requestAnimationFrame(dr); return; } x.clearRect(0,0,c.width,c.height); for (var i = 0; i < ps.length; i++) { var p = ps[i]; p.x += p.vx; p.y += p.vy; if (p.x<0) p.x=c.width; if (p.x>c.width) p.x=0; if (p.y<0) p.y=c.height; if (p.y>c.height) p.y=0; var f=.5+.5*Math.sin(t*.0003+p.ph); x.beginPath(); x.arc(p.x,p.y,Math.max(.1,p.r),0,6.28); x.fillStyle='rgba(255,255,255,'+(p.a*f).toFixed(4)+')'; x.fill(); } requestAnimationFrame(dr); }
    addEventListener('resize', function() { rz(); sd(); });
    document.addEventListener('visibilitychange', function() { hidden = document.hidden; });
    rz(); sd(); requestAnimationFrame(dr);
  })();

  /* ══════════════════════════════════════════════════════
   *  SCROLL
   * ══════════════════════════════════════════════════════ */
  if ($area) $area.addEventListener('scroll', function() { if (!scrollLock) autoScroll = ($area.scrollHeight - $area.scrollTop - $area.clientHeight) < 80; });
  function smoothSc() { scrollLock = true; requestAnimationFrame(function() { if (autoScroll && $area) $area.scrollTop = $area.scrollHeight; scrollLock = false; }); }
  function forceSc() { autoScroll = true; requestAnimationFrame(function() { if ($area) $area.scrollTop = $area.scrollHeight; }); }

  /* ══════════════════════════════════════════════════════
   *  MARKDOWN — now with IMAGE support
   * ══════════════════════════════════════════════════════ */
  function md(raw) {
    var h = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    /* Fenced code blocks */
    h = h.replace(/```(html)\n?([\s\S]*?)```/g, function(_, l, c) {
      var id = 'c' + Math.random().toString(36).slice(2,8);
      return '<pre><code id="'+id+'">'+c.trim()+'</code><button class="copy-code-btn run-btn" data-run="'+id+'">Run</button><button class="copy-code-btn" data-cid="'+id+'">Copy</button></pre>';
    });
    h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, l, c) {
      var id = 'c' + Math.random().toString(36).slice(2,8);
      return '<pre><code id="'+id+'">'+c.trim()+'</code><button class="copy-code-btn" data-cid="'+id+'">Copy</button><button class="copy-code-btn" data-cid-dl="'+id+'" data-ext="'+(l||'txt')+'">Save</button></pre>';
    });

    /* ★ IMAGES — before inline code so ![...](...) doesn't get mangled */
    h = h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="tool-img">');

    /* Inline code */
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    h = h.replace(/^[\-\*] (.+)$/gm, '<!--UL--><li>$1</li>');
    h = h.replace(/^\d+\. (.+)$/gm, '<!--OL--><li>$1</li>');
    h = h.replace(/((?:<!--UL--><li>.*<\/li>\n?)+)/g, function(m) { return '<ul>'+m.replace(/<!--UL-->/g,'')+'</ul>'; });
    h = h.replace(/((?:<!--OL--><li>.*<\/li>\n?)+)/g, function(m) { return '<ol>'+m.replace(/<!--OL-->/g,'')+'</ol>'; });
    h = h.split(/\n\n+/).map(function(b) { b = b.trim(); if (!b) return ''; return b.charAt(0)==='<' ? b : '<p>'+b.replace(/\n/g,'<br>')+'</p>'; }).join('\n');
    return h;
  }

  /* ══════════════════════════════════════════════════════
   *  TOAST / UTILS
   * ══════════════════════════════════════════════════════ */
  function toast(msg, type) {
    if (!$tst) return;
    var el = document.createElement('div'); el.className = 'toast '+(type||'err');
    el.innerHTML = '<i class="fas '+(type==='ok'?'fa-check-circle':'fa-exclamation-circle')+'"></i><span>'+msg+'</span>';
    $tst.appendChild(el); setTimeout(function() { el.remove(); }, 3500);
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function clip(t) { navigator.clipboard.writeText(t).then(function() { toast('Copied','ok'); }).catch(function() { toast('Copy failed','err'); }); }
  function dl(c, n, m) { var b = new Blob([c],{type:m||'text/plain'}), u = URL.createObjectURL(b), a = document.createElement('a'); a.href=u; a.download=n; a.click(); URL.revokeObjectURL(u); }
  function wait(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  function ripple(e, el) {
    var r = el.getBoundingClientRect(), s = document.createElement('span');
    s.className = 'ripple-span'; var sz = Math.max(r.width, r.height)*2;
    s.style.width = s.style.height = sz+'px';
    s.style.left = (e.clientX-r.left-sz/2)+'px'; s.style.top = (e.clientY-r.top-sz/2)+'px';
    el.style.position = 'relative'; el.style.overflow = 'hidden';
    el.appendChild(s); setTimeout(function() { s.remove(); }, 550);
  }

  /* ══════════════════════════════════════════════════════
   *  THINKING
   * ══════════════════════════════════════════════════════ */
  function startThinking(container) {
    var steps = Agent.steps ? Agent.steps() : ['Thinking...'];
    var idx = 0, el = document.createElement('div');
    el.className = 'thinking-text'; el.id = 'thinkAnim';
    container.appendChild(el);
    function tick() {
      if (!document.getElementById('thinkAnim')) return;
      el.innerHTML = steps.map(function(s,i) { return '<span'+(i===idx?' class="active"':'')+'>'+(i<idx?'\u2713 ':'')+esc(s)+'</span>'; }).join(' &nbsp;\xB7&nbsp; ');
      idx = (idx+1) % steps.length;
      thinkTimer = setTimeout(tick, 900);
    }
    tick();
  }
  function stopThinking() {
    if (thinkTimer) { clearTimeout(thinkTimer); thinkTimer = null; }
    var el = document.getElementById('thinkAnim');
    if (el) { el.style.opacity = '0'; setTimeout(function() { if (el.parentNode) el.remove(); }, 200); }
  }

  /* ══════════════════════════════════════════════════════
   *  CLICK DELEGATION
   * ══════════════════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var t;
    t = e.target.closest('[data-cid]'); if (t) { var c = document.getElementById(t.getAttribute('data-cid')); if (c) clip(c.textContent); return; }
    t = e.target.closest('[data-cid-dl]'); if (t) { var c2 = document.getElementById(t.getAttribute('data-cid-dl')); if (c2) dl(c2.textContent,'code.'+(t.getAttribute('data-ext')||'txt')); return; }
    t = e.target.closest('[data-run]'); if (t) { var c3 = document.getElementById(t.getAttribute('data-run')); if (c3) openRunner(c3.textContent); return; }
    t = e.target.closest('.msg-bubble-copy'); if (t) { clip(t.getAttribute('data-t')); return; }
    t = e.target.closest('[data-ai-copy]'); if (t) { clip(t.getAttribute('data-ai-copy')); return; }
    t = e.target.closest('[data-ai-dl]'); if (t) { dl(t.getAttribute('data-ai-dl'),'response.md','text/markdown'); return; }
    if (e.target.closest('[data-regen]')) { regen(); return; }
    t = e.target.closest('[data-s]'); if (t) { $inp.value = t.getAttribute('data-s'); ri($inp); updBtn(); send(); return; }
    if (e.target.closest('#privacyClose')) {
      try { localStorage.setItem('os_pv','1'); } catch(e) {}
      var pb = document.getElementById('privacyBanner');
      if (pb) { pb.style.opacity='0'; pb.style.transform='translateY(-6px)'; setTimeout(function(){ pb.remove(); },300); }
    }
    if (e.target.closest('#settingsBtn') || e.target.closest('#openSettings')) { openSettings(); return; }
    t = e.target.closest('.send-btn,.mode-btn,.new-btn,.sugg,.fu-chip');
    if (t) ripple(e, t);
  });

  /* ══════════════════════════════════════════════════════
   *  SEND / MIC
   * ══════════════════════════════════════════════════════ */
  function updBtn() {
    if (streaming) { $btn.className = 'send-btn stop'; $btn.innerHTML = IC.stop; $btn.title = 'Stop'; return; }
    var has = $inp.value.trim().length > 0 || pendingFiles.length > 0;
    $btn.className = has ? 'send-btn' : 'send-btn mic-mode';
    $btn.innerHTML = has ? IC.send : IC.mic;
    $btn.title = has ? 'Send' : 'Voice input';
  }

  function initRecog() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return false;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recog = new SR(); recog.continuous = false; recog.interimResults = true; recog.lang = 'en-US';
    recog.onresult = function(e) { var t=''; for(var i=0;i<e.results.length;i++) t+=e.results[i][0].transcript; $inp.value=t; ri($inp); updBtn(); };
    recog.onend = function() { recording=false; $btn.classList.remove('recording'); };
    recog.onerror = function() { recording=false; $btn.classList.remove('recording'); };
    return true;
  }

  $btn.addEventListener('click', function() {
    if (streaming) { stopGen(); return; }
    if ($inp.value.trim().length > 0 || pendingFiles.length > 0) send();
    else {
      if (!recog && !initRecog()) { toast('Speech not supported','err'); return; }
      if (recording) { try { recog.stop(); } catch(e) {} }
      else { try { recog.start(); recording=true; $btn.classList.add('recording'); } catch(e) { toast('Mic error','err'); } }
    }
  });

  /* ══════════════════════════════════════════════════════
   *  ATTACH — images + documents only, NO video
   * ══════════════════════════════════════════════════════ */
  var $attBtn = document.getElementById('attachBtn');
  if ($attBtn) $attBtn.addEventListener('click', function(e) { e.stopPropagation(); if ($amn) $amn.classList.toggle('open'); });
  document.addEventListener('click', function(e) { if (!e.target.closest('.attach-wrap') && $amn) $amn.classList.remove('open'); });
  document.querySelectorAll('.attach-opt').forEach(function(b) {
    b.addEventListener('click', function() {
      if ($amn) $amn.classList.remove('open');
      var t = this.getAttribute('data-type');
      if ($fin) {
        if (t === 'image') $fin.accept = 'image/*';
        else $fin.accept = '.txt,.md,.json,.csv,.py,.js,.ts,.html,.css,.xml,.yaml,.yml,.sh,.c,.cpp,.h,.java,.rb,.go,.rs,.php,.sql,.log';
        $fin.click();
      }
    });
  });
  if ($fin) $fin.addEventListener('change', function() { Array.from($fin.files).forEach(addFile); $fin.value = ''; });

  function addFile(f) {
    var e = { name: f.name, size: f.size, type: '', mime: f.type, data: null, thumb: null };
    if (f.type.startsWith('image/')) {
      e.type = 'image';
      var r = new FileReader();
      r.onload = function(x) { e.data = x.target.result.split(',')[1]; e.thumb = x.target.result; pendingFiles.push(e); renFP(); updBtn(); };
      r.readAsDataURL(f);
    } else if (f.size < 500000) {
      e.type = 'document';
      var r2 = new FileReader();
      r2.onload = function(x) { e.data = x.target.result; pendingFiles.push(e); renFP(); updBtn(); };
      r2.readAsText(f);
    } else { toast('File too large or unsupported','err'); }
  }

  function renFP() {
    if (!$fpr) return;
    $fpr.innerHTML = pendingFiles.map(function(f,i) {
      return '<div class="fp-item">'+(f.thumb?'<img src="'+f.thumb+'" alt="">':'')+'<span>'+esc(f.name)+'</span><button class="fp-remove" data-fi="'+i+'">&times;</button></div>';
    }).join('');
  }
  if ($fpr) $fpr.addEventListener('click', function(e) { var b = e.target.closest('.fp-remove'); if (b) { pendingFiles.splice(parseInt(b.getAttribute('data-fi')),1); renFP(); updBtn(); } });

  /* ══════════════════════════════════════════════════════
   *  INPUT
   * ══════════════════════════════════════════════════════ */
  function ri(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight,120)+'px'; }
  $inp.addEventListener('keydown', function(e) { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); send(); } });
  $inp.addEventListener('input', function() { ri($inp); updBtn(); });

  /* ══════════════════════════════════════════════════════
   *  MODE SELECTOR — with visible feedback
   * ══════════════════════════════════════════════════════ */
  var $mSel = document.getElementById('modeSelector');
  if ($mSel) $mSel.addEventListener('click', function(e) {
    var b = e.target.closest('.mode-btn'); if (!b) return;
    var newMode = b.getAttribute('data-mode');
    if (!Agent.modes[newMode]) { console.error('opensky: unknown mode', newMode); return; }
    Agent.setMode(newMode);
    document.querySelectorAll('.mode-btn').forEach(function(x) { x.classList.remove('active'); });
    b.classList.add('active');
    if ($tmd) { $tmd.textContent = Agent.label(); $tmd.classList.add('mode-flash'); setTimeout(function() { $tmd.classList.remove('mode-flash'); }, 350); }
    toast('Switched to ' + Agent.label() + ' mode', 'ok');
  });

  /* ══════════════════════════════════════════════════════
   *  CONVERSATIONS
   * ══════════════════════════════════════════════════════ */
  function loadC() { try { convos = JSON.parse(localStorage.getItem('os_c')||'[]'); } catch(e) { convos=[]; } }
  function saveC() {
    try { localStorage.setItem('os_c', JSON.stringify(convos)); }
    catch(e) { if (convos.length>3) { toast('Storage full — trimming','err'); try { convos=convos.slice(0,Math.max(3,convos.length-5)); localStorage.setItem('os_c',JSON.stringify(convos)); renList(); } catch(e2) { toast('Storage full','err'); } } }
  }
  function getCon() { for(var i=0;i<convos.length;i++) if(convos[i].id===activeId) return convos[i]; return null; }
  function newCon() { var c={id:'c'+Date.now()+'_'+Math.random().toString(36).slice(2,6),title:'New chat',msgs:[],mode:Agent.getMode(),ts:Date.now()}; convos.unshift(c); saveC(); activeId=c.id; renList(); renderMsgs(); closeSide(); }
  function selCon(id) { activeId=id; renList(); renderMsgs(); closeSide(); }
  function delCon(id,ev) { if(ev) ev.stopPropagation(); convos=convos.filter(function(c){return c.id!==id;}); saveC(); if(activeId===id) activeId=convos.length?convos[0].id:null; renList(); renderMsgs(); }
  function clrCon() { var c=getCon(); if(!c) return; c.msgs=[]; c.title='New chat'; saveC(); renList(); renderMsgs(); toast('Cleared','ok'); }
  function autoTit(c) { if(c.msgs.length) { var s=c.msgs[0].t; c.title=s.length>36?s.slice(0,36)+'...':s; } }
  function renList() {
    if(!$list) return;
    if(!convos.length) { $list.innerHTML='<div style="text-align:center;padding:28px 8px;color:var(--g3);font-size:9.5px">No chats yet</div>'; return; }
    $list.innerHTML = convos.map(function(c) { return '<div class="chat-item'+(c.id===activeId?' active':'')+'" data-cid="'+c.id+'"><span class="chat-item-label">'+esc(c.title)+'</span><button class="chat-item-del" data-did="'+c.id+'"><i class="fas fa-xmark"></i></button></div>'; }).join('');
  }
  if ($list) $list.addEventListener('click', function(e) {
    var d=e.target.closest('[data-did]'); if(d) { delCon(d.getAttribute('data-did'),e); return; }
    var c=e.target.closest('[data-cid]'); if(c) selCon(c.getAttribute('data-cid'));
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
      if (!Keys.has()) $msgs.innerHTML += noKeyHTML();
      return;
    }
    if ($ttl) $ttl.textContent = c.title;
    $msgs.innerHTML = c.msgs.map(function(m) { return m.role==='user' ? usrHTML(m) : aiHTML(m); }).join('');
    forceSc();
  }

  function usrHTML(m) {
    var fh = '';
    if (m.files && m.files.length) {
      fh = '<div class="msg-files">';
      m.files.forEach(function(f) { if(f.type==='image'&&f.thumb) fh+='<img class="msg-file-thumb" src="'+f.thumb+'" alt="'+esc(f.name)+'">'; else fh+='<span class="msg-file-chip"><i class="fas fa-file" style="font-size:8px"></i> '+esc(f.name)+'</span>'; });
      fh += '</div>';
    }
    return '<div class="msg-row user"><div class="msg-bubble">'+fh+'<div>'+esc(m.t).replace(/\n/g,'<br>')+'</div><button class="msg-bubble-copy" data-t="'+esc(m.t).replace(/"/g,'&quot;')+'">Copy</button></div></div>';
  }

  function aiHTML(m) {
    var pills = m.toolHtml ? '<div class="tool-status">'+m.toolHtml+'</div>' : '';
    return '<div class="msg-row assistant"><div class="msg-ai-header">'+IC.logo+'<span class="msg-ai-label">opensky</span></div>'+
      pills+'<div class="msg-ai-body">'+md(m.t)+'</div>'+
      '<div class="msg-ai-footer"><button class="msg-ai-action" data-ai-copy="'+esc(m.t).replace(/"/g,'&quot;')+'"><i class="fas fa-copy"></i> Copy</button><button class="msg-ai-action" data-ai-dl="'+esc(m.t).replace(/"/g,'&quot;')+'"><i class="fas fa-download"></i> .md</button><button class="msg-ai-action" data-regen="1"><i class="fas fa-rotate"></i> Redo</button></div></div>';
  }

  function privHTML() {
    return '<div class="privacy-banner" id="privacyBanner"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v4c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1z" stroke="currentColor" stroke-width="1"/></svg><span>Please do not upload personal or sensitive information.</span><button class="privacy-close" id="privacyClose">&times;</button></div>';
  }

  function noKeyHTML() {
    return '<div class="key-banner" id="openSettings"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg><span style="flex:1">Set your OpenRouter API key to get started</span><span class="key-banner-go">Configure &rarr;</span></div>';
  }

  function welHTML() {
    return '<div class="welcome"><div class="welcome-logo"><svg style="width:40px;height:40px" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg></div><h2>What can I help with?</h2><p>27 tools, memory, file uploads, voice input, planning, and code preview.</p><div class="suggestions"><button class="sugg" data-s="Weather in Tokyo and info about Japan">Weather + Japan</button><button class="sugg" data-s="Build a to-do app with HTML CSS JS">Build a todo app</button><button class="sugg" data-s="Tell me a joke and show me a cat fact">Joke + cat fact</button><button class="sugg" data-s="Show me an image of a cat">Image of a cat</button></div></div>';
  }

  /* ══════════════════════════════════════════════════════
   *  CODE RUNNER
   * ══════════════════════════════════════════════════════ */
  function openRunner(code) { if(!$crn||!$cfr) return; $crn.classList.add('open'); $cfr.srcdoc=code; }
  function closeRunner() { if(!$crn) return; $crn.classList.remove('open'); setTimeout(function(){ if($cfr) $cfr.srcdoc=''; },350); }
  var $rc = document.getElementById('runnerClose'); if ($rc) $rc.addEventListener('click', closeRunner);
  var $rn = document.getElementById('runnerNewTab'); if ($rn) $rn.addEventListener('click', function() { if(!$cfr) return; var w=window.open(); if(w) { w.document.write($cfr.srcdoc); w.document.close(); } });
  var $dc = document.getElementById('downloadChatBtn');
  if ($dc) $dc.addEventListener('click', function() {
    var c=getCon(); if(!c||!c.msgs.length) { toast('Nothing to download','err'); return; }
    var o='# '+c.title+'\n\n'; c.msgs.forEach(function(m) { o+='### '+(m.role==='user'?'You':'opensky')+'\n\n'+m.t+'\n\n---\n\n'; });
    dl(o, c.title.replace(/[^a-z0-9]/gi,'_')+'.md', 'text/markdown'); toast('Downloaded','ok');
  });

  /* ══════════════════════════════════════════════════════
   *  REGEN / STOP
   * ══════════════════════════════════════════════════════ */
  async function regen() { var c=getCon(); if(!c||streaming) return; if(c.msgs.length&&c.msgs[c.msgs.length-1].role==='assistant') { c.msgs.pop(); saveC(); renderMsgs(); } await send(); }
  function stopGen() { if(abortCtrl) abortCtrl.abort(); }

  /* ══════════════════════════════════════════════════════
   *  ★ SEND — with stream timeout + empty guard ★
   * ══════════════════════════════════════════════════════ */
  async function send() {
    var text = $inp.value.trim();
    var files = pendingFiles.slice();
    if ((!text && !files.length) || streaming) return;

    if (!Keys.has()) { toast('No API key — click Configure to add one','err'); openSettings(); if(!activeId) newCon(); renderMsgs(); return; }

    if (!activeId) newCon();
    var con = getCon();

    con.msgs.push({
      role: 'user', t: text || '(uploaded files)',
      files: files.length ? files.map(function(f) { return { type:f.type, name:f.name, mime:f.mime, data:f.data, thumb:f.thumb }; }) : null
    });
    if (!files.length) autoTit(con); else con.title = files.map(function(f){return f.name;}).join(', ');
    saveC();

    $inp.value = ''; $inp.style.height = 'auto';
    pendingFiles = []; renFP(); renList(); renderMsgs();
    streaming = true; updBtn();

    var row = document.createElement('div');
    row.className = 'msg-row assistant'; row.id = 'aiRow';
    row.innerHTML = '<div class="msg-ai-header">'+IC.logo+'<span class="msg-ai-label">opensky</span></div><div id="toolArea"></div><div id="planArea"></div><div id="thinkSlot"></div><div class="msg-ai-body" id="aiBody"></div>';
    $msgs.appendChild(row); forceSc();

    startThinking(document.getElementById('thinkSlot'));

    var rr = Agent.route(text);
    var memCtx = '';
    if (typeof Agent.handleMem === 'function') memCtx = Agent.handleMem(rr, text);

    var plan = [];
    if (typeof Planner !== 'undefined' && Planner.createPlan) {
      plan = Planner.createPlan(text, rr.tools, rr);
      var pa = document.getElementById('planArea');
      if (pa) Planner.renderPlan(pa, plan);
    }

    var toolCtx = '';
    if (rr.tools.length && typeof Agent.execTools === 'function') {
      for (var si=0; si<plan.length-2; si++) {
        if (typeof Planner !== 'undefined') Planner.markStep(si, 'active');
        await wait(180);
        if (typeof Planner !== 'undefined') Planner.markStep(si, 'done');
      }
      try {
        var results = await Agent.execTools(rr.tools);
        var pillH = '';
        results.forEach(function(r) { pillH += '<span class="tool-pill done">'+r.icon+' '+r.name+(r.error?' \u2717':' \u2713')+'</span>'; });
        var ta = document.getElementById('toolArea');
        if (ta) ta.innerHTML = pillH;
        if (typeof Agent.toolCtx === 'function') toolCtx = Agent.toolCtx(results);
      } catch(e) { toolCtx = '\n[Tool error: '+e.message+']\n'; }
    } else {
      if (plan.length > 0 && typeof Planner !== 'undefined') { Planner.markStep(0,'active'); await wait(120); Planner.markStep(0,'done'); }
    }

    var gi = plan.length > 0 ? plan.length-2 : -1;
    if (gi >= 0 && typeof Planner !== 'undefined') Planner.markStep(gi, 'active');

    /* Build API messages — images only, NO video */
    var apiMsgs = [{ role: 'system', content: Agent.sys() + memCtx + toolCtx }];
    var recent = con.msgs.slice(-20);
    recent.forEach(function(m) {
      if (m.role === 'user') {
        if (m.files && m.files.length) {
          var parts = [{ type: 'text', text: m.t }];
          m.files.forEach(function(f) {
            if (f.type === 'image' && f.data) parts.push({ type: 'image_url', image_url: { url: 'data:'+f.mime+';base64,'+f.data } });
            else if (f.type === 'document' && f.data) parts.push({ type: 'text', text: '['+f.name+']\n'+f.data });
            else parts.push({ type: 'text', text: '[Attached: '+f.name+']' });
          });
          apiMsgs.push({ role: 'user', content: parts });
        } else { apiMsgs.push({ role: 'user', content: m.t }); }
      } else { apiMsgs.push({ role: 'assistant', content: m.t }); }
    });

    abortCtrl = new AbortController();

    /* ★ Stream timeout — 45 seconds max ★ */
    var streamTimer = setTimeout(function() {
      console.warn('opensky: stream timeout after 45s');
      if (abortCtrl) abortCtrl.abort();
    }, 45000);

    try {
      var res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer '+Keys.get(), 'Content-Type': 'application/json', 'HTTP-Referer': location.href, 'X-Title': 'opensky' },
        body: JSON.stringify({ model: API_MODEL, messages: apiMsgs, stream: true }),
        signal: abortCtrl.signal
      });

      if (!res.ok) {
        var ej = await res.json().catch(function() { return {}; });
        var errMsg = (ej.error && ej.error.message) || ('HTTP '+res.status);
        if (res.status === 401) throw new Error('INVALID_KEY');
        if (res.status === 429) throw new Error('RATE_LIMITED');
        if (res.status === 402) throw new Error('NO_CREDITS');
        throw new Error(errMsg);
      }

      stopThinking();
      clearTimeout(streamTimer);
      if (gi >= 0 && typeof Planner !== 'undefined') Planner.markStep(gi, 'done');
      if (plan.length > 0 && typeof Planner !== 'undefined') Planner.markStep(plan.length-1, 'active');

      var mu = res.headers.get('x-model-used') || res.headers.get('openrouter-model');
      if (mu && $mdl) $mdl.textContent = mu;

      var body = document.getElementById('aiBody');
      body.innerHTML = '';

      if (!res.body) throw new Error('NO_BODY');

      var reader = res.body.getReader(), dec = new TextDecoder(), full = '', buf = '';

      function scheduleRender() {
        if (!streamDirty) {
          streamDirty = true;
          streamRAF = requestAnimationFrame(function() {
            body.innerHTML = md(full) + '<span class="stream-wave"></span>';
            smoothSc();
            streamDirty = false;
            streamRAF = null;
          });
        }
      }

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
            if (delta) { full += delta; scheduleRender(); }
          } catch(pe) {}
        }
      }

      /* Final render */
      if (streamRAF) { cancelAnimationFrame(streamRAF); streamRAF = null; }

      /* ★ Empty response guard ★ */
      if (!full.trim()) throw new Error('EMPTY_RESPONSE');

      body.innerHTML = md(full);

      if (plan.length > 0 && typeof Planner !== 'undefined') { Planner.markStep(plan.length-1,'done'); setTimeout(function(){ Planner.removePlan(); }, 600); }

      var taEl = document.getElementById('toolArea');
      con.msgs.push({ role: 'assistant', t: full, toolHtml: taEl ? taEl.innerHTML : '' });
      saveC(); renderMsgs();

    } catch (err) {
      clearTimeout(streamTimer);
      stopThinking();
      if (typeof Planner !== 'undefined') Planner.removePlan();

      if (err.name === 'AbortError') {
        var ar = document.getElementById('aiRow');
        if (ar) { var bd = ar.querySelector('.msg-ai-body'); if (bd && bd.textContent.trim()) { con.msgs.push({ role:'assistant', t:bd.textContent }); saveC(); } }
        renderMsgs(); toast('Stopped','ok');
      } else {
        var ar2 = document.getElementById('aiRow'); if (ar2) ar2.remove();
        var msg = err.message || 'Request failed';

        if (msg === 'INVALID_KEY') { toast('Invalid API key — update in Settings','err'); openSettings(); }
        else if (msg === 'RATE_LIMITED') { toast('Rate limited — wait 30 seconds','err'); }
        else if (msg === 'NO_CREDITS') { toast('No credits — add funds at openrouter.ai','err'); }
        else if (msg === 'EMPTY_RESPONSE') { toast('Empty response — try rephrasing your question','err'); }
        else if (msg === 'NO_BODY') { toast('No response body from API','err'); }
        else { toast(msg, 'err'); }

        console.error('opensky send error:', msg, err);
      }
    } finally {
      clearTimeout(streamTimer);
      streaming = false; abortCtrl = null; streamDirty = false;
      if (streamRAF) { cancelAnimationFrame(streamRAF); streamRAF = null; }
      updBtn();
    }
  }

  /* ══════════════════════════════════════════════════════
   *  SIDEBAR
   * ══════════════════════════════════════════════════════ */
  function closeSide() { if($side) $side.classList.remove('open'); if($over) $over.classList.remove('show'); }
  var $mt = document.getElementById('menuToggle'); if ($mt) $mt.addEventListener('click', function() { if($side) $side.classList.toggle('open'); if($over) $over.classList.toggle('show'); });
  if ($over) $over.addEventListener('click', closeSide);
  var $nc = document.getElementById('newChatBtn'); if ($nc) $nc.addEventListener('click', newCon);
  var $cc = document.getElementById('clearChatBtn'); if ($cc) $cc.addEventListener('click', clrCon);

  /* ══════════════════════════════════════════════════════
   *  BOOT
   * ══════════════════════════════════════════════════════ */
  loadC();
  if (convos.length) activeId = convos[0].id;
  if ($dot) $dot.classList.toggle('on', Keys.has());
  if ($tmd) $tmd.textContent = Agent.label();
  renList(); renderMsgs(); updBtn(); initRecog();
  setTimeout(function() { $inp.focus(); }, 300);
})();
