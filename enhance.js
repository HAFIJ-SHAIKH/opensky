(function () {
  'use strict';

  var dropOverlay = null, dragCounter = 0;
  function createDropOverlay() {
    if (dropOverlay) return;
    var el = document.createElement('div'); el.className = 'drop-overlay'; el.id = 'dropOverlay';
    el.innerHTML = '<div class="drop-zone"><i class="fas fa-cloud-arrow-up"></i>Drop files here</div>';
    document.body.appendChild(el); dropOverlay = el;
  }
  function showDrop() { createDropOverlay(); dragCounter++; dropOverlay.classList.add('visible'); }
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

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); var inp = document.getElementById('messageInput'); if (inp) { inp.focus(); inp.value = ''; inp.style.height = 'auto'; inp.dispatchEvent(new Event('input')); } }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') { e.preventDefault(); var btn = document.getElementById('newChatBtn'); if (btn) btn.click(); }
    if (e.key === 'Escape') {
      var runner = document.getElementById('codeRunner'); if (runner && runner.classList.contains('open')) { var cb = document.getElementById('runnerClose'); if (cb) cb.click(); return; }
      var side = document.getElementById('sidebar'); if (side && side.classList.contains('open')) { side.classList.remove('open'); var ov = document.getElementById('sidebarOverlay'); if (ov) ov.classList.remove('show'); }
    }
  });

  window.addEventListener('load', function () { setTimeout(function () { var inp = document.getElementById('messageInput'); if (inp) inp.focus(); }, 300); });
})();
