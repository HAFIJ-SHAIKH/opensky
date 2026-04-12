/* ═══════════════════════════════════════════════════════
 * opensky — Full-featured AI chat
 * ═══════════════════════════════════════════════════════ */

var BUILD_KEY = '__OPENKEY__';
var API_URL   = 'https://openrouter.ai/api/v1/chat/completions';
var MODEL     = 'openrouter/free';

var LOGO = '<svg class="msg-ai-icon" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg>';

/* ── State ── */
var convos     = JSON.parse(localStorage.getItem('os_convos') || '[]');
var activeId   = null;
var streaming  = false;
var abortCtrl  = null;
var autoScroll = true;
var pendingFiles = [];

/* ── DOM ── */
var $list    = document.getElementById('chatList');
var $msgs    = document.getElementById('chatMessages');
var $area    = document.getElementById('chatArea');
var $input   = document.getElementById('messageInput');
var $send    = document.getElementById('sendBtn');
var $title   = document.getElementById('topbarTitle');
var $mode    = document.getElementById('topbarMode');
var $mLabel  = document.getElementById('modelLabel');
var $dot     = document.getElementById('statusDot');
var $side    = document.getElementById('sidebar');
var $over    = document.getElementById('sidebarOverlay');
var $toasts  = document.getElementById('toastContainer');
var $fPreview= document.getElementById('filePreview');
var $fInput  = document.getElementById('fileInput');
var $micBtn  = document.getElementById('micBtn');

/* ═══════════════════════════════════════════════════════
 * Key
 * ═══════════════════════════════════════════════════════ */
function getKey() {
  var s = localStorage.getItem('os_userkey');
  if (s) return s;
  if (BUILD_KEY !== '__OPENKEY__') return BUILD_KEY;
  return null;
}
function hasKey() { return getKey() !== null; }
function refreshKeyUI() {
  if (hasKey()) { $dot.classList.add('on'); } else { $dot.classList.remove('on'); }
}

/* ═══════════════════════════════════════════════════════
 * Scroll — only auto-scroll if user is near bottom
 * ═══════════════════════════════════════════════════════ */
 $area.addEventListener('scroll', function() {
  autoScroll = ($area.scrollHeight - $area.scrollTop - $area.clientHeight) < 100;
});

function smartScroll() {
  if (autoScroll) {
    requestAnimationFrame(function() { $area.scrollTop = $area.scrollHeight; });
  }
}

function forceScroll() {
  autoScroll = true;
  requestAnimationFrame(function() { $area.scrollTop = $area.scrollHeight; });
}

/* ═══════════════════════════════════════════════════════
 * Background particles
 * ═══════════════════════════════════════════════════════ */
(function() {
  var c = document.getElementById('bgCanvas'), ctx = c.getContext('2d'), pts = [], N = 60;
  function resize() { c.width = innerWidth; c.height = innerHeight; }
  function seed() {
    pts = [];
    for (var i = 0; i < N; i++) pts.push({
      x: Math.random()*c.width, y: Math.random()*c.height,
      r: Math.random()*1+.2, a: Math.random()*.18+.02,
      vx: (Math.random()-.5)*.12, vy: (Math.random()-.5)*.08, ph: Math.random()*6.28
    });
  }
  function draw(t) {
    ctx.clearRect(0,0,c.width,c.height);
    for (var i=0;i<pts.length;i++) {
      var p=pts[i]; p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=c.width; if(p.x>c.width)p.x=0;
      if(p.y<0)p.y=c.height; if(p.y>c.height)p.y=0;
      var f=.5+.5*Math.sin(t*.0007+p.ph);
      ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(.1,p.r),0,6.2832);
      ctx.fillStyle='rgba(255,255,255,'+(p.a*f).toFixed(3)+')'; ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  addEventListener('resize',function(){resize();seed();});
  resize();seed();requestAnimationFrame(draw);
})();

/* ═══════════════════════════════════════════════════════
 * Markdown parser
 * ═══════════════════════════════════════════════════════ */
function md(raw) {
  var h = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_,lang,code){
    var id='c'+Math.random().toString(36).slice(2,8);
    var ext = lang || 'txt';
    return '<pre><code id="'+id+'">'+code.trim()+'</code>'+
      '<button class="copy-code-btn" data-cid="'+id+'">Copy</button>'+
      '<button class="copy-code-btn" data-cid-dl="'+id+'" data-ext="'+ext+'">Save</button></pre>';
  });
  h = h.replace(/`([^`]+)`/g,'<code>$1</code>');
  h = h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h = h.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g,'<em>$1</em>');
  h = h.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  h = h.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
  h = h.replace(/^[\-\*] (.+)$/gm,'<li>$1</li>');
  h = h.replace(/((?:<li>.*<\/li>\n?)+)/g,'<ul>$1</ul>');
  h = h.replace(/^\d+\. (.+)$/gm,'<li>$1</li>');
  h = h.split(/\n\n+/).map(function(b){
    b=b.trim(); if(!b)return '';
    if(b.charAt(0)==='<')return b;
    return '<p>'+b.replace(/\n/g,'<br>')+'</p>';
  }).join('\n');
  return h;
}

/* ═══════════════════════════════════════════════════════
 * Toast
 * ═══════════════════════════════════════════════════════ */
function toast(msg,type){
  var el=document.createElement('div');
  el.className='toast '+(type||'err');
  el.innerHTML='<i class="fas '+(type==='ok'?'fa-check':'fa-xmark')+'"></i><span>'+msg+'</span>';
  $toasts.appendChild(el);
  setTimeout(function(){el.remove();},3000);
}

/* ═══════════════════════════════════════════════════════
 * Clipboard & Download
 * ═══════════════════════════════════════════════════════ */
function clip(t){navigator.clipboard.writeText(t).then(function(){toast('Copied','ok');});}

function downloadFile(content, name, mime) {
  var blob = new Blob([content], {type: mime || 'text/plain'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('click', function(e) {
  var cb = e.target.closest('.copy-code-btn[data-cid]');
  if (cb) { var el=document.getElementById(cb.getAttribute('data-cid')); if(el)clip(el.textContent); return; }
  var dl = e.target.closest('.copy-code-btn[data-cid-dl]');
  if (dl) {
    var el2=document.getElementById(dl.getAttribute('data-cid-dl'));
    if(el2) downloadFile(el2.textContent, 'code.'+(dl.getAttribute('data-ext')||'txt'), 'text/plain');
    return;
  }
  var mb = e.target.closest('.msg-bubble-copy');
  if (mb) clip(mb.getAttribute('data-t'));
  var mc = e.target.closest('[data-ai-copy]');
  if (mc) clip(mc.getAttribute('data-ai-copy'));
  var md2 = e.target.closest('[data-ai-dl]');
  if (md2) downloadFile(md2.getAttribute('data-ai-dl'), 'opensky-response.md', 'text/markdown');
});

/* ═══════════════════════════════════════════════════════
 * File handling — upload, preview, read
 * ═══════════════════════════════════════════════════════ */
document.getElementById('uploadBtn').addEventListener('click', function() { $fInput.click(); });

 $fInput.addEventListener('change', function() {
  var files = Array.from($fInput.files);
  files.forEach(addFile);
  $fInput.value = '';
});

function addFile(file) {
  var entry = { name: file.name, size: file.size, type: file.type, mime: file.type, data: null, thumb: null };
  var isImage = file.type.startsWith('image/');
  var isVideo = file.type.startsWith('video/');
  var isText  = !isImage && !isVideo && file.size < 500000;

  if (isImage) {
    entry.type = 'image';
    var reader = new FileReader();
    reader.onload = function(e) {
      var base64 = e.target.result.split(',')[1];
      entry.data = base64;
      entry.thumb = e.target.result;
      pendingFiles.push(entry);
      renderFilePreview();
    };
    reader.readAsDataURL(file);
  } else if (isVideo) {
    entry.type = 'video';
    extractVideoFrame(file).then(function(dataUrl) {
      entry.data = dataUrl ? dataUrl.split(',')[1] : null;
      entry.thumb = dataUrl;
      entry.isVideo = true;
      pendingFiles.push(entry);
      renderFilePreview();
    });
  } else if (isText) {
    entry.type = 'document';
    var reader2 = new FileReader();
    reader2.onload = function(e) {
      entry.data = e.target.result;
      pendingFiles.push(entry);
      renderFilePreview();
    };
    reader2.readAsText(file);
  } else {
    toast('File too large or unsupported format', 'err');
  }
}

function extractVideoFrame(file) {
  return new Promise(function(resolve) {
    try {
      var video = document.createElement('video');
      video.muted = true; video.preload = 'auto';
      video.onloadeddata = function() { video.currentTime = Math.min(1, video.duration * 0.1); };
      video.onseeked = function() {
        var canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        canvas.getContext('2d').drawImage(video, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      video.onerror = function() { resolve(null); };
      video.src = URL.createObjectURL(file);
      setTimeout(function() { resolve(null); }, 5000);
    } catch(e) { resolve(null); }
  });
}

function renderFilePreview() {
  $fPreview.innerHTML = pendingFiles.map(function(f, i) {
    var thumb = f.thumb ? '<img src="'+f.thumb+'" alt="">' : '';
    return '<div class="fp-item">'+thumb+'<span>'+esc(f.name)+'</span>'+
      '<button class="fp-remove" data-fi="'+i+'">&times;</button></div>';
  }).join('');
}

 $fPreview.addEventListener('click', function(e) {
  var btn = e.target.closest('.fp-remove');
  if (btn) { pendingFiles.splice(parseInt(btn.getAttribute('data-fi')), 1); renderFilePreview(); }
});

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + 'KB';
  return (bytes/1048576).toFixed(1) + 'MB';
}

/* ═══════════════════════════════════════════════════════
 * Mic — Speech recognition
 * ═══════════════════════════════════════════════════════ */
var recognition = null;
var micActive = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRec();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = function(e) {
    var text = '';
    for (var i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    $input.value = text;
    resizeInput($input);
  };

  recognition.onend = function() { setMicOff(); };
  recognition.onerror = function() { setMicOff(); };
}

 $micBtn.addEventListener('click', function() {
  if (!recognition) { toast('Speech recognition not supported in this browser', 'err'); return; }
  if (micActive) { recognition.stop(); setMicOff(); }
  else { recognition.start(); setMicOn(); }
});

function setMicOn() { micActive = true; $micBtn.classList.add('recording'); }
function setMicOff() { micActive = false; $micBtn.classList.remove('recording'); }

/* ═══════════════════════════════════════════════════════
 * Mode switching
 * ═══════════════════════════════════════════════════════ */
document.getElementById('modeSelector').addEventListener('click', function(e) {
  var btn = e.target.closest('.mode-btn');
  if (!btn) return;
  var m = btn.getAttribute('data-mode');
  Agent.setMode(m);
  document.querySelectorAll('.mode-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  $mode.textContent = Agent.getModeLabel();
});

/* ═══════════════════════════════════════════════════════
 * Convo CRUD
 * ═══════════════════════════════════════════════════════ */
function save() { localStorage.setItem('os_convos', JSON.stringify(convos)); }

function active() {
  for (var i=0;i<convos.length;i++) if(convos[i].id===activeId) return convos[i];
  return null;
}

function newChat() {
  var c = {id:'c'+Date.now()+'_'+Math.random().toString(36).slice(2,6), title:'New chat', msgs:[], mode:Agent.getMode(), ts:Date.now()};
  convos.unshift(c); save(); activeId=c.id; renderList(); renderMsgs(); closeSide();
}

function pick(id) { activeId=id; renderList(); renderMsgs(); closeSide(); }

function del(id,e) {
  e.stopPropagation();
  convos=convos.filter(function(c){return c.id!==id;}); save();
  if(activeId===id) activeId=convos.length?convos[0].id:null;
  renderList(); renderMsgs();
}

function clearChat() {
  var c=active(); if(!c)return;
  c.msgs=[]; c.title='New chat'; save(); renderList(); renderMsgs();
  toast('Chat cleared','ok');
}

function retitle(c) {
  if(c.msgs.length){var s=c.msgs[0].t; c.title=s.length>40?s.slice(0,40)+'...':s;}
}

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

/* ── Render list ── */
function renderList() {
  if(!convos.length){$list.innerHTML='<div style="text-align:center;padding:30px 8px;color:var(--gray-2);font-size:11px;">No chats yet</div>';return;}
  $list.innerHTML=convos.map(function(c){
    return '<div class="chat-item'+(c.id===activeId?' active':'')+'" data-cid="'+c.id+'">'+
      '<span class="chat-item-label">'+esc(c.title)+'</span>'+
      '<button class="chat-item-del" data-did="'+c.id+'"><i class="fas fa-xmark"></i></button></div>';
  }).join('');
}

 $list.addEventListener('click',function(e){
  var d=e.target.closest('[data-did]');
  if(d){del(d.getAttribute('data-did'),e);return;}
  var c=e.target.closest('[data-cid]');
  if(c)pick(c.getAttribute('data-cid'));
});

/* ═══════════════════════════════════════════════════════
 * Render messages
 * ═══════════════════════════════════════════════════════ */
function renderMsgs() {
  var c = active();
  if (!c || !c.msgs.length) {
    $title.textContent = 'opensky';
    $msgs.innerHTML = welcomeHTML();
    if (!hasKey()) $msgs.innerHTML += keyBannerHTML();
    return;
  }
  $title.textContent = c.title;
  $msgs.innerHTML = c.msgs.map(function(m) {
    if (m.role === 'user') return renderUserMsg(m);
    return renderAiMsg(m);
  }).join('');
  forceScroll();
}

function renderUserMsg(m) {
  var filesHtml = '';
  if (m.files && m.files.length) {
    filesHtml = '<div class="msg-files">';
    m.files.forEach(function(f) {
      if (f.type === 'image' && f.thumb) {
        filesHtml += '<img class="msg-file-thumb" src="'+f.thumb+'" alt="'+esc(f.name)+'">';
      } else {
        filesHtml += '<span class="msg-file-chip"><i class="fas fa-file" style="font-size:10px"></i> '+esc(f.name)+'</span>';
      }
    });
    filesHtml += '</div>';
  }
  var et = esc(m.t).replace(/"/g,'&quot;');
  return '<div class="msg-row user"><div class="msg-bubble">'+filesHtml+
    '<div>'+esc(m.t).replace(/\n/g,'<br>')+'</div>'+
    '<button class="msg-bubble-copy" data-t="'+et+'">Copy</button></div></div>';
}

function renderAiMsg(m) {
  var et = esc(m.t).replace(/"/g,'&quot;');
  return '<div class="msg-row assistant">'+
    '<div class="msg-ai-header">'+LOGO+'<span class="msg-ai-label">opensky</span></div>'+
    '<div class="msg-ai-body">'+md(m.t)+'</div>'+
    '<div class="msg-ai-footer">'+
      '<button class="msg-ai-action" data-ai-copy="'+et+'"><i class="fas fa-copy"></i> Copy</button>'+
      '<button class="msg-ai-action" data-ai-dl="'+et+'"><i class="fas fa-download"></i> .md</button>'+
    '</div></div>';
}

function welcomeHTML() {
  return '<div class="welcome">'+
    '<div class="welcome-logo"><svg style="width:44px;height:44px" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg></div>'+
    '<h2>What can I help with?</h2>'+
    '<p>Free AI chat by opensky. Upload images, documents, or use voice input. Switch modes for research or coding.</p>'+
    '<div class="suggestions">'+
      '<button class="sugg" data-s="Explain how neural networks learn">Explain how neural networks learn</button>'+
      '<button class="sugg" data-s="Build a REST API with Node.js">Build a REST API with Node.js</button>'+
      '<button class="sugg" data-s="Research the pros and cons of microservices vs monoliths">Research microservices vs monoliths</button>'+
      '<button class="sugg" data-s="Who created you and what can you do?">Who created you and what can you do?</button>'+
    '</div></div>';
}

function keyBannerHTML() {
  return '<div class="key-banner"><i class="fas fa-key" style="font-size:12px"></i>'+
    '<span>API key not set. Run <code>OPENKEY=sk-or-... node script.js</code> then serve the files.</span></div>';
}

 $msgs.addEventListener('click', function(e) {
  var s = e.target.closest('[data-s]');
  if (s) { $input.value = s.getAttribute('data-s'); resizeInput($input); send(); }
});

/* ═══════════════════════════════════════════════════════
 * Download full chat
 * ═══════════════════════════════════════════════════════ */
document.getElementById('downloadChatBtn').addEventListener('click', function() {
  var c = active();
  if (!c || !c.msgs.length) { toast('Nothing to download', 'err'); return; }
  var out = '# ' + c.title + '\n\n';
  c.msgs.forEach(function(m) {
    var label = m.role === 'user' ? '**You**' : '**opensky**';
    out += '### ' + label + '\n\n' + m.t + '\n\n---\n\n';
  });
  downloadFile(out, c.title.replace(/[^a-z0-9]/gi,'_')+'.md', 'text/markdown');
  toast('Chat downloaded','ok');
});

/* ═══════════════════════════════════════════════════════
 * Input
 * ═══════════════════════════════════════════════════════ */
function resizeInput(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,140)+'px';}
 $input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
 $input.addEventListener('input',function(){resizeInput($input);});

/* ═══════════════════════════════════════════════════════
 * Send & stream
 * ═══════════════════════════════════════════════════════ */
async function send() {
  var text = $input.value.trim();
  var files = pendingFiles.slice();
  if ((!text && !files.length) || streaming) return;

  if (!hasKey()) { toast('Set API key first — run the build script', 'err'); return; }

  if (!activeId) newChat();
  var c = active();

  var msg = { role: 'user', t: text || '(uploaded files)', files: files.length ? files.map(function(f){
    return {type:f.type, name:f.name, mime:f.mime, data:f.data, thumb:f.thumb, isVideo:f.isVideo};
  }) : null };

  c.msgs.push(msg);
  if (!files.length) retitle(c);
  else c.title = files.map(function(f){return f.name;}).join(', ');
  save();

  $input.value = ''; $input.style.height = 'auto';
  pendingFiles = [];
  renderFilePreview();
  renderList();
  renderMsgs();

  streaming = true;
  setSendBtn();

  /* Typing indicator */
  var tip = document.createElement('div');
  tip.className = 'msg-row assistant';
  tip.id = 'typingRow';
  tip.innerHTML = '<div class="msg-ai-header">'+LOGO+'<span class="msg-ai-label">opensky</span></div>'+
    '<div class="msg-ai-body"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  $msgs.appendChild(tip);
  forceScroll();

  /* Build API messages */
  var apiMsgs = [{ role: 'system', content: Agent.getSystemPrompt() }];

  c.msgs.forEach(function(m) {
    if (m.role === 'user') {
      if (m.files && m.files.length) {
        var content = [{ type: 'text', text: m.t }];
        m.files.forEach(function(f) {
          if (f.type === 'image' && f.data) {
            content.push({ type: 'image_url', image_url: { url: 'data:' + f.mime + ';base64,' + f.data } });
          } else if (f.type === 'video' && f.data) {
            content.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + f.data } });
            content.push({ type: 'text', text: '[Video frame extracted from: ' + f.name + ']' });
          } else if (f.type === 'document' && f.data) {
            content.push({ type: 'text', text: '[File: ' + f.name + ']\n' + f.data });
          } else {
            content.push({ type: 'text', text: '[Attached: ' + f.name + ' — could not read content]' });
          }
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
      var ej = await res.json().catch(function(){return{};});
      throw new Error((ej.error&&ej.error.message)||('HTTP '+res.status));
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
          var delta = j.choices&&j.choices[0]&&j.choices[0].delta&&j.choices[0].delta.content;
          if (delta) { full += delta; body.innerHTML = md(full); smartScroll(); }
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
        if (p && p.textContent.trim()) { c.msgs.push({ role:'assistant', t:p.textContent }); save(); }
      }
      renderMsgs();
      toast('Stopped','ok');
    } else {
      var t = document.getElementById('typingRow');
      if (t) t.remove();
      toast(err.message || 'Request failed','err');
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
    $send.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>';
    $send.onclick = stopGen;
  } else {
    $send.className = 'send-btn';
    $send.innerHTML = '<svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    $send.onclick = send;
  }
}

/* ═══════════════════════════════════════════════════════
 * Sidebar
 * ═══════════════════════════════════════════════════════ */
function closeSide(){$side.classList.remove('open');$over.classList.remove('show');}
document.getElementById('menuToggle').addEventListener('click',function(){$side.classList.toggle('open');$over.classList.toggle('show');});
 $over.addEventListener('click',closeSide);
document.getElementById('newChatBtn').addEventListener('click',newChat);
document.getElementById('clearChatBtn').addEventListener('click',clearChat);

/* ═══════════════════════════════════════════════════════
 * Init
 * ═══════════════════════════════════════════════════════ */
(function(){
  if(convos.length) activeId = convos[0].id;
  refreshKeyUI();
  $mode.textContent = Agent.getModeLabel();
  renderList();
  renderMsgs();
  setSendBtn();
  $input.focus();
})();
