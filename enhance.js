(function () {
  'use strict';

  /* ── Reduced motion detection ── */
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

  /* ── Drag-Drop ────────────────────────────────────── */
  var dropOverlay = null, dragCounter = 0;
  function createDropOverlay() {
    if (dropOverlay) return;
    var el = document.createElement('div'); el.className = 'drop-overlay'; el.id = 'dropOverlay';
    el.innerHTML = '<div class="drop-zone"><i class="fas fa-cloud-arrow-up"></i>Drop files here</div>';
    document.body.appendChild(el); dropOverlay = el;
  }
  function showDrop() { createDropOverlay(); dragCounter++; dropOverlay.classList.add('visible'); closeAttachMenu(); }
  function hideDrop() { dragCounter--; if (dragCounter <= 0) { dragCounter = 0; if (dropOverlay) dropOverlay.classList.remove('visible'); } }
  function handleDrop(e) {
    e.preventDefault(); dragCounter = 0; if (dropOverlay) dropOverlay.classList.remove('visible');
    var files = e.dataTransfer.files; if (!files.length) return;
    var input = document.getElementById('fileInput'); if (!input) return;
    var dt = new DataTransfer(); for (var i = 0; i < files.length; i++) dt.items.add(files[i]);
    input.files = dt.files; input.dispatchEvent(new Event('change'));
  }
  document.addEventListener('dragenter', function (e) { if (e.dataTransfer && e.dataTransfer.types.indexOf('Files') !== -1) { e.preventDefault(); showDrop(); } });
  document.addEventListener('dragleave', function (e) { if (e.dataTransfer && e.dataTransfer.types.indexOf('Files') !== -1) { e.preventDefault(); hideDrop(); } });
  document.addEventListener('dragover', function (e) { if (e.dataTransfer && e.dataTransfer.types.indexOf('Files') !== -1) e.preventDefault(); });
  document.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.types.indexOf('Files') !== -1) handleDrop(e); });

  /* ── Keyboard Shortcuts ───────────────────────────── */
  function closeAttachMenu() {
    var am = document.getElementById('attachMenu');
    if (am) am.classList.remove('open');
  }

  document.addEventListener('keydown', function (e) {
    /* Ctrl+K — focus input */
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      var inp = document.getElementById('messageInput');
      if (inp) { inp.focus(); inp.value = ''; inp.style.height = 'auto'; inp.dispatchEvent(new Event('input')); }
    }
    /* Ctrl+Shift+N — new chat */
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      var btn = document.getElementById('newChatBtn'); if (btn) btn.click();
    }
    /* Escape — close panels */
    if (e.key === 'Escape') {
      var runner = document.getElementById('codeRunner');
      if (runner && runner.classList.contains('open')) {
        var cb = document.getElementById('runnerClose'); if (cb) cb.click(); return;
      }
      var am = document.getElementById('attachMenu');
      if (am && am.classList.contains('open')) { am.classList.remove('open'); return; }
      var side = document.getElementById('sidebar');
      if (side && side.classList.contains('open')) {
        side.classList.remove('open');
        var ov = document.getElementById('sidebarOverlay'); if (ov) ov.classList.remove('show');
      }
    }
  });

  /* ── Auto-focus input on load ── */
  window.addEventListener('load', function () {
    setTimeout(function () {
      var inp = document.getElementById('messageInput');
      if (inp) inp.focus();
    }, 300);
  });
})();
