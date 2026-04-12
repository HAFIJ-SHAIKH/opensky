/* ═══════════════════════════════════════════════════════
 * enhance.js — Drag-drop, keyboard shortcuts, polish
 * Works alongside app.js without modifying it
 * ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Drag & Drop File Support ─────────────────────── */
  var dropOverlay = null;
  var dragCounter = 0;

  function createDropOverlay() {
    if (dropOverlay) return;
    var el = document.createElement('div');
    el.className = 'drop-overlay';
    el.id = 'dropOverlay';
    el.innerHTML = '<div class="drop-zone"><i class="fas fa-cloud-arrow-up"></i>Drop files here</div>';
    document.body.appendChild(el);
    dropOverlay = el;
  }

  function showDrop() {
    createDropOverlay();
    dragCounter++;
    dropOverlay.classList.add('visible');
  }

  function hideDrop() {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (dropOverlay) dropOverlay.classList.remove('visible');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    dragCounter = 0;
    if (dropOverlay) dropOverlay.classList.remove('visible');
    var files = e.dataTransfer.files;
    if (!files.length) return;
    var input = document.getElementById('fileInput');
    if (!input) return;
    var dt = new DataTransfer();
    for (var i = 0; i < files.length; i++) dt.items.add(files[i]);
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  }

  document.addEventListener('dragenter', function (e) {
    if (e.dataTransfer && e.dataTransfer.types.indexOf('Files') !== -1) {
      e.preventDefault();
      showDrop();
    }
  });

  document.addEventListener('dragleave', function (e) {
    if (e.dataTransfer && e.dataTransfer.types.indexOf('Files') !== -1) {
      e.preventDefault();
      hideDrop();
    }
  });

  document.addEventListener('dragover', function (e) {
    if (e.dataTransfer && e.dataTransfer.types.indexOf('Files') !== -1) {
      e.preventDefault();
    }
  });

  document.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.types.indexOf('Files') !== -1) {
      handleDrop(e);
    }
  });

  /* ── Keyboard Shortcuts ───────────────────────────── */
  document.addEventListener('keydown', function (e) {
    var inp = document.getElementById('messageInput');
    if (!inp) return;

    /* Ctrl/Cmd + K — focus input & clear */
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      inp.focus();
      inp.value = '';
      inp.style.height = 'auto';
      inp.dispatchEvent(new Event('input'));
    }

    /* Ctrl/Cmd + Shift + N — new chat */
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      var btn = document.getElementById('newChatBtn');
      if (btn) btn.click();
    }

    /* Escape — close sidebar / code runner */
    if (e.key === 'Escape') {
      var side = document.getElementById('sidebar');
      var over = document.getElementById('sidebarOverlay');
      var runner = document.getElementById('codeRunner');
      if (runner && runner.classList.contains('open')) {
        var closeBtn = document.getElementById('runnerClose');
        if (closeBtn) closeBtn.click();
      } else if (side && side.classList.contains('open')) {
        side.classList.remove('open');
        if (over) over.classList.remove('show');
      }
    }
  });

  /* ── Input auto-focus on page load ────────────────── */
  window.addEventListener('load', function () {
    setTimeout(function () {
      var inp = document.getElementById('messageInput');
      if (inp) inp.focus();
    }, 300);
  });

  /* ── Topbar key button (synced with banner) ──────── */
  var keyBtnTop = document.getElementById('keyBannerTop');
  if (keyBtnTop) {
    /* Show the key button if no key is set */
    function checkKeyVis() {
      var hasKey = false;
      try { hasKey = !!(localStorage.getItem('os_userkey') || sessionStorage.getItem('os_userkey')); } catch (e) {}
      if (typeof KEY_PH !== 'undefined' && KEY_PH !== '__OPENKEY__' && KEY_PH.trim().length > 3) hasKey = true;
      keyBtnTop.style.display = hasKey ? 'none' : 'flex';
    }
    checkKeyVis();
    /* Recheck when storage changes */
    window.addEventListener('storage', checkKeyVis);
    keyBtnTop.addEventListener('click', function () {
      var banner = document.getElementById('keyBanner');
      if (banner) banner.click();
      else {
        /* Trigger app.js promptKey via the banner — create a temp banner and click it */
        var tmp = document.createElement('div');
        tmp.id = 'keyBanner';
        tmp.style.display = 'none';
        document.body.appendChild(tmp);
        tmp.click();
        setTimeout(function () { tmp.remove(); }, 100);
      }
    });
  }

  /* ── Smooth page visibility handling ──────────────── */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      var inp = document.getElementById('messageInput');
      if (inp && document.activeElement !== inp) {
        /* Don't auto-focus if user is interacting with something else */
      }
    }
  });

  /* ── Prevent accidental double-send ───────────────── */
  var lastSendTime = 0;
  var origSendBtn = document.getElementById('sendBtn');
  if (origSendBtn) {
    origSendBtn.addEventListener('mousedown', function () {
      var now = Date.now();
      if (now - lastSendTime < 300) {
        /* Debounce rapid clicks */
      }
      lastSendTime = now;
    }, true);
  }

})();
