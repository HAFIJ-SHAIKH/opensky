/* ═══════════════════════════════════════════════════════
 * enhance.js — Reduced motion, drag-drop, keyboard
 * shortcuts, auto-focus, and global UX polish
 * ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════
   *  REDUCED MOTION — respects OS accessibility setting
   * ══════════════════════════════════════════════════════ */
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function applyReduced() {
    if (prefersReduced.matches) {
      document.documentElement.setAttribute('data-reduced', '');
    } else {
      document.documentElement.removeAttribute('data-reduced');
    }
  }

  applyReduced();

  if (prefersReduced.addEventListener) {
    prefersReduced.addEventListener('change', applyReduced);
  } else if (prefersReduced.addListener) {
    prefersReduced.addListener(applyReduced);
  }

  /* ══════════════════════════════════════════════════════
   *  DRAG & DROP — file upload via drag onto page
   * ══════════════════════════════════════════════════════ */
  var dropOverlay = null;
  var dragCounter = 0;

  function createDropOverlay() {
    if (dropOverlay) return;
    var el = document.createElement('div');
    el.className = 'drop-overlay';
    el.id = 'dropOverlay';
    el.innerHTML =
      '<div class="drop-zone">' +
        '<i class="fas fa-cloud-arrow-up"></i>' +
        'Drop files here' +
      '</div>';
    document.body.appendChild(el);
    dropOverlay = el;
  }

  function showDrop() {
    createDropOverlay();
    dragCounter++;
    dropOverlay.classList.add('visible');
    closeAttachMenu();
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

    /* Transfer dragged files to the hidden file input */
    var dt = new DataTransfer();
    for (var i = 0; i < files.length; i++) dt.items.add(files[i]);
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  }

  function hasFiles(e) {
    return e.dataTransfer && e.dataTransfer.types.indexOf('Files') !== -1;
  }

  document.addEventListener('dragenter', function (e) {
    if (hasFiles(e)) { e.preventDefault(); showDrop(); }
  });

  document.addEventListener('dragleave', function (e) {
    if (hasFiles(e)) { e.preventDefault(); hideDrop(); }
  });

  document.addEventListener('dragover', function (e) {
    if (hasFiles(e)) e.preventDefault();
  });

  document.addEventListener('drop', function (e) {
    if (hasFiles(e)) handleDrop(e);
  });

  /* ══════════════════════════════════════════════════════
   *  ATTACH MENU — helper to close it from shortcuts
   * ══════════════════════════════════════════════════════ */
  function closeAttachMenu() {
    var am = document.getElementById('attachMenu');
    if (am) am.classList.remove('open');
  }

  /* ══════════════════════════════════════════════════════
   *  KEYBOARD SHORTCUTS
   * ══════════════════════════════════════════════════════ */
  document.addEventListener('keydown', function (e) {

    /* Ctrl+K / Cmd+K — focus input, clear it */
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      var inp = document.getElementById('messageInput');
      if (inp) {
        inp.focus();
        inp.value = '';
        inp.style.height = 'auto';
        inp.dispatchEvent(new Event('input'));
      }
    }

    /* Ctrl+Shift+N / Cmd+Shift+N — new chat */
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      var btn = document.getElementById('newChatBtn');
      if (btn) btn.click();
    }

    /* Escape — close panels (priority order) */
    if (e.key === 'Escape') {

      /* 1. Code runner */
      var runner = document.getElementById('codeRunner');
      if (runner && runner.classList.contains('open')) {
        var closeBtn = document.getElementById('runnerClose');
        if (closeBtn) closeBtn.click();
        return;
      }

      /* 2. Settings modal */
      var settingsOverlay = document.getElementById('settingsOverlay');
      if (settingsOverlay && settingsOverlay.classList.contains('open')) {
        var settingsClose = document.getElementById('settingsClose');
        if (settingsClose) settingsClose.click();
        return;
      }

      /* 3. Attach menu */
      var am = document.getElementById('attachMenu');
      if (am && am.classList.contains('open')) {
        am.classList.remove('open');
        return;
      }

      /* 4. Sidebar (mobile) */
      var side = document.getElementById('sidebar');
      if (side && side.classList.contains('open')) {
        side.classList.remove('open');
        var ov = document.getElementById('sidebarOverlay');
        if (ov) ov.classList.remove('show');
        return;
      }
    }
  });

  /* ══════════════════════════════════════════════════════
   *  AUTO-FOCUS — input gets focus shortly after load
   * ══════════════════════════════════════════════════════ */
  window.addEventListener('load', function () {
    setTimeout(function () {
      var inp = document.getElementById('messageInput');
      if (inp) inp.focus();
    }, 350);
  });

  /* ══════════════════════════════════════════════════════
   *  INPUT BOX GLOW FOLLOW — subtle glow follows cursor
   *  when hovering the input area
   * ══════════════════════════════════════════════════════ */
  (function () {
    var box = document.getElementById('inputBox');
    if (!box) return;

    /* Check reduced motion — skip if enabled */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    box.addEventListener('mousemove', function (e) {
      var rect = box.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      box.style.setProperty('--glow-x', x + 'px');
      box.style.setProperty('--glow-y', y + 'px');
    });

    box.addEventListener('mouseleave', function () {
      box.style.removeProperty('--glow-x');
      box.style.removeProperty('--glow-y');
    });
  })();

})();
