var BK='__OPENKEY__',AU='https://openrouter.ai/api/v1/chat/completions',MD='openrouter/free';
var LG='<svg class="msg-ai-icon" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg>';

var convos=JSON.parse(localStorage.getItem('os_c')||'[]'),aId=null,strm=false,abrt=null,ascroll=true,pfiles=[],progScroll=false;

var $l=document.getElementById('chatList'),$m=document.getElementById('chatMessages'),$a=document.getElementById('chatArea'),
    $i=document.getElementById('messageInput'),$s=document.getElementById('sendBtn'),$tt=document.getElementById('topbarTitle'),
    $tm=document.getElementById('topbarMode'),$ml=document.getElementById('modelLabel'),$dt=document.getElementById('statusDot'),
    $sb=document.getElementById('sidebar'),$ov=document.getElementById('sidebarOverlay'),$ts=document.getElementById('toastContainer'),
    $fp=document.getElementById('filePreview'),$fi=document.getElementById('fileInput'),$mc=document.getElementById('micBtn'),
    $am=document.getElementById('attachMenu'),$cr=document.getElementById('codeRunner'),$cf=document.getElementById('runnerFrame');

function gk(){
  try{var s=localStorage.getItem('os_userkey');if(s&&s.trim().length>3)return s.trim()}catch(e){}
  try{var ss=sessionStorage.getItem('os_userkey');if(ss&&ss.trim().length>3)return ss.trim()}catch(e){}
  if(BK!=='__OPENKEY__'&&BK.trim().length>3)return BK.trim();
  return null;
}
function hk(){return gk()!==null}
function rku(){if(hk())$dt.classList.add('on');else $dt.classList.remove('on')}
function sk(k){try{localStorage.setItem('os_userkey',k.trim())}catch(e){}try{sessionStorage.setItem('os_userkey',k.trim())}catch(e){}rku();rM();toast('Key saved','ok')}
function clearK(){try{localStorage.removeItem('os_userkey')}catch(e){}try{sessionStorage.removeItem('os_userkey')}catch(e){}rku();rM();toast('Key removed','ok')}

 $a.addEventListener('scroll',function(){if(!progScroll)ascroll=($a.scrollHeight-$a.scrollTop-$a.clientHeight)<70)});
function ss(){progScroll=true;requestAnimationFrame(function(){if(ascroll)$a.scrollTop=$a.scrollHeight;progScroll=false})}
function fs(){ascroll=true;requestAnimationFrame(function(){$a.scrollTop=$a.scrollHeight})}

(function(){var c=document.getElementById('bgCanvas'),x=c.getContext('2d'),p=[],N=35;
function rz(){c.width=innerWidth;c.height=innerHeight}
function sd(){p=[];for(var i=0;i<N;i++)p.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*.6+.1,a:Math.random()*.08+.01,vx:(Math.random()-.5)*.05,vy:(Math.random()-.5)*.03,ph:Math.random()*6.28})}
function dr(t){x.clearRect(0,0,c.width,c.height);for(var i=0;i<p.length;i++){var q=p[i];q.x+=q.vx;q.y+=q.vy;if(q.x<0)q.x=c.width;if(q.x>c.width)q.x=0;if(q.y<0)q.y=c.height;if(q.y>c.height)q.y=0;var f=.5+.5*Math.sin(t*.0003+q.ph);x.beginPath();x.arc(q.x,q.y,Math.max(.1,q.r),0,6.28);x.fillStyle='rgba(255,255,255,'+(q.a*f).toFixed(4)+')';x.fill()}requestAnimationFrame(dr)}
addEventListener('resize',function(){rz();sd()});rz();sd();requestAnimationFrame(dr)})();

function md(r){var h=r.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
h=h.replace(/```(html)\n?([\s\S]*?)```/g,function(_,l,c){var id='c'+Math.random().toString(36).slice(2,8);return'<pre><code id="'+id+'">'+c.trim()+'</code><button class="copy-code-btn run-btn" data-run="'+id+'">Run</button><button class="copy-code-btn" data-cid="'+id+'">Copy</button></pre>'});
h=h.replace(/```(\w*)\n?([\s\S]*?)```/g,function(_,l,c){var id='c'+Math.random().toString(36).slice(2,8);return'<pre><code id="'+id+'">'+c.trim()+'</code><button class="copy-code-btn" data-cid="'+id+'">Copy</button><button class="copy-code-btn" data-cid-dl="'+id+'" data-ext="'+(l||'txt')+'">Save</button></pre>'});
h=h.replace(/`([^`]+)`/g,'<code>$1</code>');h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');h=h.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g,'<em>$1</em>');
h=h.replace(/^### (.+)$/gm,'<h3>$1</h3>');h=h.replace(/^## (.+)$/gm,'<h2>$1</h2>');h=h.replace(/^# (.+)$/gm,'<h1>$1</h1>');
h=h.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');h=h.replace(/^[\-\*] (.+)$/gm,'<li>$1</li>');h=h.replace(/((?:<li>.*<\/li>\n?)+)/g,'<ul>$1</ul>');h=h.replace(/^\d+\. (.+)$/gm,'<li>$1</li>');
h=h.split(/\n\n+/).map(function(b){b=b.trim();if(!b)return'';if(b.charAt(0)==='<')return b;return'<p>'+b.replace(/\n/g,'<br>')+'</p>'}).join('\n');return h}

function toast(m,t){var e=document.createElement('div');e.className='toast '+(t||'err');e.innerHTML='<i class="fas '+(t==='ok'?'fa-check':'fa-xmark')+'"></i><span>'+m+'</span>';$ts.appendChild(e);setTimeout(function(){e.remove()},3000)}
function clip(t){navigator.clipboard.writeText(t).then(function(){toast('Copied','ok')})}
function dl(c,n,m){var b=new Blob([c],{type:m||'text/plain'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=n;a.click();URL.revokeObjectURL(u)}
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}

document.addEventListener('click',function(e){
  var cb=e.target.closest('[data-cid]');if(cb){var el=document.getElementById(cb.getAttribute('data-cid'));if(el)clip(el.textContent);return}
  var cd=e.target.closest('[data-cid-dl]');if(cd){var el2=document.getElementById(cd.getAttribute('data-cid-dl'));if(el2)dl(el2.textContent,'code.'+(cd.getAttribute('data-ext')||'txt'),'text/plain');return}
  var rb=e.target.closest('[data-run]');if(rb){var el3=document.getElementById(rb.getAttribute('data-run'));if(el3)openRunner(el3.textContent);return}
  var mb=e.target.closest('.msg-bubble-copy');if(mb)clip(mb.getAttribute('data-t'));
  var ac=e.target.closest('[data-ai-copy]');if(ac)clip(ac.getAttribute('data-ai-copy'));
  var ad=e.target.closest('[data-ai-dl]');if(ad)dl(ad.getAttribute('data-ai-dl'),'response.md','text/markdown');
  var rg=e.target.closest('[data-regen]');if(rg)regen();
  var fu=e.target.closest('[data-fu]');if(fu){$i.value=fu.getAttribute('data-fu');ri($i);send()}
  var s=e.target.closest('[data-s]');if(s){$i.value=s.getAttribute('data-s');ri($i);send()}
  if(e.target.closest('#privacyClose')){localStorage.setItem('os_pv','1');var pb=document.getElementById('privacyBanner');if(pb){pb.style.opacity='0';pb.style.transform='translateY(-6px)';setTimeout(function(){pb.remove()},250)}return}
  if(e.target.closest('#keyBanner')){handleKeyEntry();return}
  if(e.target.closest('#clearKeyBtn')){clearK();return}
});

function handleKeyEntry(){
  var k=prompt('Enter your OpenRouter API key (sk-or-...):');
  if(!k)return;
  if(k.trim().length<5){toast('Key too short — must be at least 5 characters','err');return}
  sk(k);
}

document.getElementById('attachBtn').addEventListener('click',function(e){e.stopPropagation();$am.classList.toggle('open')});
document.addEventListener('click',function(e){if(!e.target.closest('.attach-wrap'))$am.classList.remove('open')});
document.querySelectorAll('.attach-opt').forEach(function(b){b.addEventListener('click',function(){$am.classList.remove('open');var t=this.getAttribute('data-type');$fi.accept=t==='image'?'image/*':t==='video'?'video/*':'.txt,.md,.json,.csv,.py,.js,.ts,.html,.css,.xml,.yaml,.yml,.sh,.c,.cpp,.h,.java,.rb,.go,.rs,.php,.sql,.log,.ini,.cfg';$fi.click()})});
 $fi.addEventListener('change',function(){Array.from($fi.files).forEach(addFile);$fi.value=''});

function addFile(f){var e={name:f.name,size:f.size,type:'',mime:f.type,data:null,thumb:null},im=f.type.startsWith('image/'),vi=f.type.startsWith('video/'),tx=!im&&!vi&&f.size<500000;
if(im){e.type='image';var r=new FileReader();r.onload=function(x){e.data=x.target.result.split(',')[1];e.thumb=x.target.result;pfiles.push(e);rFP()};r.readAsDataURL(f)}
else if(vi){e.type='video';exFr(f).then(function(d){e.data=d?d.split(',')[1]:null;e.thumb=d;e.isVideo=true;pfiles.push(e);rFP()})}
else if(tx){e.type='document';var r2=new FileReader();r2.onload=function(x){e.data=x.target.result;pfiles.push(e);rFP()};r2.readAsText(f)}
else toast('Unsupported','err')}
function exFr(f){return new Promise(function(r){try{var v=document.createElement('video');v.muted=true;v.preload='auto';v.onloadeddata=function(){v.currentTime=Math.min(1,v.duration*.1)};v.onseeked=function(){var c=document.createElement('canvas');c.width=v.videoWidth||320;c.height=v.videoHeight||240;c.getContext('2d').drawImage(v,0,0);r(c.toDataURL('image/jpeg',.6))};v.onerror=function(){r(null)};v.src=URL.createObjectURL(f);setTimeout(function(){r(null)},5000)}catch(e){r(null)}})}
function rFP(){$fp.innerHTML=pfiles.map(function(f,i){var img=f.thumb?'<img src="'+f.thumb+'" alt="">':'';return'<div class="fp-item">'+img+'<span>'+esc(f.name)+'</span><button class="fp-remove" data-fi="'+i+'">&times;</button></div>'}).join('')}
 $fp.addEventListener('click',function(e){var b=e.target.closest('.fp-remove');if(b){pfiles.splice(parseInt(b.getAttribute('data-fi')),1);rFP()}});

var rec=null,mOn=false;
if('webkitSpeechRecognition' in window||'SpeechRecognition' in window){var SR=window.SpeechRecognition||window.webkitSpeechRecognition;rec=new SR();rec.continuous=false;rec.interimResults=true;rec.lang='en-US';rec.onresult=function(e){var t='';for(var i=0;i<e.results.length;i++)t+=e.results[i][0].transcript;$i.value=t;ri($i)};rec.onend=function(){mOff()};rec.onerror=function(){mOff()}}
 $mc.addEventListener('click',function(){if(!rec){toast('Speech not supported','err');return}if(mOn){rec.stop();mOff()}else{rec.start();mOn=true;$mc.classList.add('recording')}});
function mOff(){mOn=false;$mc.classList.remove('recording')}

document.getElementById('modeSelector').addEventListener('click',function(e){var b=e.target.closest('.mode-btn');if(!b)return;Agent.setMode(b.getAttribute('data-mode'));document.querySelectorAll('.mode-btn').forEach(function(x){x.classList.remove('active')});b.classList.add('active');$tm.textContent=Agent.label();$tm.style.background='var(--bd2)';setTimeout(function(){$tm.style.background=''},300)});

function sv(){localStorage.setItem('os_c',JSON.stringify(convos))}
function ga(){for(var i=0;i<convos.length;i++)if(convos[i].id===aId)return convos[i];return null}
function nc(){var c={id:'c'+Date.now()+'_'+Math.random().toString(36).slice(2,6),title:'New chat',msgs:[],mode:Agent.getMode(),ts:Date.now()};convos.unshift(c);sv();aId=c.id;rL();rM();cS()}
function pk(id){aId=id;rL();rM();cS()}
function dl2(id,e){e.stopPropagation();convos=convos.filter(function(c){return c.id!==id});sv();if(aId===id)aId=convos.length?convos[0].id:null;rL();rM()}
function cc(){var c=ga();if(!c)return;c.msgs=[];c.title='New chat';sv();rL();rM();toast('Cleared','ok')}
function rt(c){if(c.msgs.length){var s=c.msgs[0].t;c.title=s.length>36?s.slice(0,36)+'...':s}}
function rL(){if(!convos.length){$l.innerHTML='<div style="text-align:center;padding:24px 8px;color:var(--g3);font-size:9.5px">No chats yet</div>';return}
 $l.innerHTML=convos.map(function(c){return'<div class="chat-item'+(c.id===aId?' active':'')+'" data-cid="'+c.id+'"><span class="chat-item-label">'+esc(c.title)+'</span><button class="chat-item-del" data-did="'+c.id+'"><i class="fas fa-xmark"></i></button></div>'}).join('')}
 $l.addEventListener('click',function(e){var d=e.target.closest('[data-did]');if(d){dl2(d.getAttribute('data-did'),e);return}var c=e.target.closest('[data-cid]');if(c)pk(c.getAttribute('data-cid'))});

function rM(){var c=ga();
if(!c||!c.msgs.length){$tt.textContent='opensky';$m.innerHTML=wH();if(!localStorage.getItem('os_pv'))$m.innerHTML+=pvH();if(!hk())$m.innerHTML+=kH();return}
 $tt.textContent=c.title;$m.innerHTML=c.msgs.map(function(m){return m.role==='user'?rU(m):rA(m)}).join('');fs()}

function rU(m){var fh='';if(m.files&&m.files.length){fh='<div class="msg-files">';m.files.forEach(function(f){if(f.type==='image'&&f.thumb)fh+='<img class="msg-file-thumb" src="'+f.thumb+'" alt="'+esc(f.name)+'">';else fh+='<span class="msg-file-chip"><i class="fas fa-file" style="font-size:8px"></i> '+esc(f.name)+'</span>'});fh+='</div>'}
var et=esc(m.t).replace(/"/g,'&quot;');return'<div class="msg-row user"><div class="msg-bubble">'+fh+'<div>'+esc(m.t).replace(/\n/g,'<br>')+'</div><button class="msg-bubble-copy" data-t="'+et+'">Copy</button></div></div>'}

function rA(m){var et=esc(m.t).replace(/"/g,'&quot;'),fu='';
if(m.fu&&m.fu.length){fu='<div class="follow-ups">';m.fu.forEach(function(f){fu+='<button class="fu-chip" data-fu="'+esc(f).replace(/"/g,'&quot;')+'">'+esc(f)+'</button>'});fu+='</div>'}
var pills=(m.toolHtml)?'<div class="tool-status">'+m.toolHtml+'</div>':'';
return'<div class="msg-row assistant"><div class="msg-ai-header">'+LG+'<span class="msg-ai-label">opensky</span></div>'+pills+'<div class="msg-ai-body">'+md(m.t)+'</div>'+fu+'<div class="msg-ai-footer"><button class="msg-ai-action" data-ai-copy="'+et+'"><i class="fas fa-copy"></i> Copy</button><button class="msg-ai-action" data-ai-dl="'+et+'"><i class="fas fa-download"></i> .md</button><button class="msg-ai-action" data-regen="1"><i class="fas fa-rotate"></i> Redo</button></div></div>'}

function pvH(){return'<div class="privacy-banner" id="privacyBanner"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v4c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1z" stroke="currentColor" stroke-width="1"/></svg><span>Please do not upload any personal, confidential, or otherwise sensitive information.</span><button class="privacy-close" id="privacyClose">&times;</button></div>'}
function kH(){return'<div class="key-banner" id="keyBanner"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5a3.5 3.5 0 00-3 5.2L3 12.2V15h2.8l5.5-5.5A3.5 3.5 0 0011.5 1.5z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg><span style="flex:1">No API key — <u style="cursor:pointer">click to enter</u></span><button id="clearKeyBtn" class="privacy-close" title="Clear saved key" style="margin:0 0 0 8px">&times;</button></div>'}
function wH(){return'<div class="welcome"><div class="welcome-logo"><svg style="width:40px;height:40px" viewBox="0 0 32 32" fill="none"><path d="M16 2L28 14L16 26L4 14L16 2Z" stroke="white" stroke-width="1.8"/><path d="M16 8L22 14L16 20L10 14L16 8Z" fill="white"/></svg></div><h2>What can I help with?</h2><p>25 tools, memory, file uploads, voice, task planning with sub-agents, and live code preview.</p><div class="suggestions"><button class="sugg" data-s="Weather in Tokyo and info about Japan">Weather + Japan</button><button class="sugg" data-s="Build a to-do app with HTML CSS JS">Build a todo app</button><button class="sugg" data-s="Tell me a joke, a quote, and a cat fact">Joke + quote + cat</button><button class="sugg" data-s="Who created you?">Who are you?</button></div></div>'}

document.getElementById('downloadChatBtn').addEventListener('click',function(){var c=ga();if(!c||!c.msgs.length){toast('Nothing','err');return}var o='# '+c.title+'\n\n';c.msgs.forEach(function(m){o+='### '+(m.role==='user'?'You':'opensky')+'\n\n'+m.t+'\n\n---\n\n'});dl(o,c.title.replace(/[^a-z0-9]/gi,'_')+'.md','text/markdown');toast('Downloaded','ok')});
function openRunner(code){$cr.classList.add('open');$cf.srcdoc=code}
function closeRunner(){$cr.classList.remove('open');setTimeout(function(){$cf.srcdoc=''},350)}
document.getElementById('runnerClose').addEventListener('click',closeRunner);
document.getElementById('runnerNewTab').addEventListener('click',function(){var w=window.open();w.document.write($cf.srcdoc);w.document.close()});
async function regen(){var c=ga();if(!c||strm)return;if(c.msgs.length&&c.msgs[c.msgs.length-1].role==='assistant'){c.msgs.pop();sv();rM()}$i.value=' ';await send()}
function ri(e){e.style.height='auto';e.style.height=Math.min(e.scrollHeight,120)+'px'}
 $i.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
 $i.addEventListener('input',function(){ri($i)});

async function genFU(conv){try{var last=conv.slice(-4);var p='Suggest 3 short follow-up questions (under 8 words). Return ONLY a JSON array of strings.\n\n'+last.map(function(m){return(m.role==='user'?'User: ':'AI: ')+m.t}).join('\n');
var r=await fetch(AU,{method:'POST',headers:{'Authorization':'Bearer '+gk(),'Content-Type':'application/json','HTTP-Referer':location.href,'X-Title':'opensky'},body:JSON.stringify({model:MD,messages:[{role:'user',content:p}],stream:false})});
var d=await r.json();var txt=(d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content||'');txt=txt.replace(/```json?/g,'').replace(/```/g,'').trim();var arr=JSON.parse(txt);if(Array.isArray(arr))return arr.filter(function(f){return f.length>3&&f.length<60}).slice(0,3)}catch(e){}return[]}

async function send(){
  var text=$i.value.trim(),files=pfiles.slice();
  if((!text&&!files.length)||strm)return;

  var key=gk();
  if(!key){
    toast('No API key — click the banner below to enter one','err');
    if(!document.getElementById('keyBanner')){aId=aId||null;if(!aId)nc();rM();}
    return;
  }

  if(!aId)nc();var c=ga();

  var msg={role:'user',t:text||'(uploaded files)',files:files.length?files.map(function(f){return{type:f.type,name:f.name,mime:f.mime,data:f.data,thumb:f.thumb,isVideo:f.isVideo}}):null};
  c.msgs.push(msg);if(!files.length)rt(c);else c.title=files.map(function(f){return f.name}).join(', ');
  sv();$i.value='';$i.style.height='auto';pfiles=[];rFP();rL();rM();
  strm=true;setSB();

  var row=document.createElement('div');row.className='msg-row assistant';row.id='aiRow';
  row.innerHTML='<div class="msg-ai-header">'+LG+'<span class="msg-ai-label">opensky</span></div><div id="toolArea"></div><div id="planArea"></div><div class="msg-ai-body" id="aiBody"></div>';
  $m.appendChild(row);fs();

  var rr=Agent.route(text);
  var memCtx=Agent.handleMem(rr,text);
  var plan=Planner.createPlan(text,rr.tools,rr);
  Planner.renderPlan(document.getElementById('planArea'),plan);

  var toolCtx='';
  if(rr.tools.length){
    Planner.markStep(1,'active');await tick(300);Planner.markStep(1,'done');
    if(rr.tools.length>0)Planner.markStep(2,'active');await tick(200);Planner.markStep(2,'done');
    for(var i=0;i<rr.tools.length;i++){
      Planner.markStep(3+i,'active');
      try{var results=await Agent.execTools(rr.tools);var ph='';results.forEach(function(r){ph+='<span class="tool-pill done">'+r.icon+' '+r.name+(r.error?' \u2717':' \u2713')+'</span>'});toolCtx=Agent.toolCtx(results)}catch(e){toolCtx='Tool error'}
      Planner.markStep(3+i,'done');await tick(100);
    }
  } else {Planner.markStep(0,'active');await tick(250);Planner.markStep(0,'done')}

  if(rr.memStore){var msIdx=rr.tools.length>0?3+rr.tools.length:1;Planner.markStep(msIdx,'active');await tick(200);Planner.markStep(msIdx,'done')}
  if(rr.memRecall){var mrIdx=rr.tools.length>0?1+rr.tools.length:0;Planner.markStep(mrIdx,'active');await tick(200);Planner.markStep(mrIdx,'done')}

  var genIdx=plan.length-2;Planner.markStep(genIdx,'active');

  var apiMsgs=[{role:'system',content:Agent.sys()+memCtx+toolCtx}];
  var maxMsgs=20;
  var recentMsgs=c.msgs.slice(-maxMsgs);
  recentMsgs.forEach(function(m){
    if(m.role==='user'){
      if(m.files&&m.files.length){var ct=[{type:'text',text:m.t}];m.files.forEach(function(f){if(f.type==='image'&&f.data)ct.push({type:'image_url',image_url:{url:'data:'+f.mime+';base64,'+f.data}});else if(f.type==='video'&&f.data){ct.push({type:'image_url',image_url:{url:'data:image/jpeg;base64,'+f.data}});ct.push({type:'text',text:'[Video: '+f.name+']'})}else if(f.type==='document'&&f.data)ct.push({type:'text',text:'['+f.name+']\n'+f.data});else ct.push({type:'text',text:'[Attached: '+f.name+']'})});apiMsgs.push({role:'user',content:ct})}
      else apiMsgs.push({role:'user',content:m.t})
    }else apiMsgs.push({role:'assistant',content:m.t})
  });

  abrt=new AbortController();
  try{
    var res=await fetch(AU,{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json','HTTP-Referer':location.href,'X-Title':'opensky'},body:JSON.stringify({model:MD,messages:apiMsgs,stream:true}),signal:abrt.signal});
    if(!res.ok){var ej=await res.json().catch(function(){return{}});throw new Error((ej.error&&ej.error.message)||('HTTP '+res.status))}

    Planner.markStep(genIdx,'done');
    Planner.markStep(plan.length-1,'active');

    var body=document.getElementById('aiBody');body.innerHTML='';
    var um=res.headers.get('x-model-used')||res.headers.get('openrouter-model');if(um)$ml.textContent=um;

    var reader=res.body.getReader(),dec=new TextDecoder(),full='',buf='';
    while(true){var chunk=await reader.read();if(chunk.done)break;buf+=dec.decode(chunk.value,{stream:true});var lines=buf.split('\n');buf=lines.pop()||'';
    for(var i=0;i<lines.length;i++){var ln=lines[i].trim();if(!ln||ln.indexOf('data:')!==0)continue;var d=ln.slice(5).trim();if(d==='[DONE]')continue;
    try{var j=JSON.parse(d);var delta=j.choices&&j.choices[0]&&j.choices[0].delta&&j.choices[0].delta.content;if(delta){full+=delta;body.innerHTML=md(full)+'<span class="stream-wave"></span>';ss()}}catch(_){}}}

    body.innerHTML=md(full);
    Planner.markStep(plan.length-1,'done');
    setTimeout(function(){Planner.removePlan()},600);

    var ta=document.getElementById('toolArea').innerHTML;

    var fu=await genFU(c.msgs.concat([{role:'assistant',t:full}]));
    c.msgs.push({role:'assistant',t:full,fu:fu,toolHtml:ta});sv();rM()

    try{var mm=full.match(/(?:remember|note|save|store|keep in mind)\s*(?:that|this|the fact)\s*:?\s*(.+)/i);if(mm)Agent.memory.remember(mm[1].trim().slice(0,200),'fact')}catch(e){}

  }catch(err){
    Planner.removePlan();
    if(err.name==='AbortError'){var row2=document.getElementById('aiRow');if(row2){var p=row2.querySelector('.msg-ai-body');if(p&&p.textContent.trim()){c.msgs.push({role:'assistant',t:p.textContent});sv()}}rM();toast('Stopped','ok')}
    else{var row3=document.getElementById('aiRow');if(row3)row3.remove();var msg=err.message||'Request failed';if(msg.indexOf('429')!==-1)msg='Rate limited — wait a moment';else if(msg.indexOf('401')!==-1)msg='Invalid API key';else if(msg.indexOf('402')!==-1)msg='No credits — check OpenRouter account';toast(msg,'err')}
  }finally{strm=false;abrt=null;setSB()}
}

function tick(ms){return new Promise(function(r){setTimeout(r,ms)})}
function stopGen(){if(abrt)abrt.abort()}
function setSB(){if(strm){$s.className='send-btn stop';$s.innerHTML='<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>';$s.onclick=stopGen}else{$s.className='send-btn';$s.innerHTML='<svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';$s.onclick=send}}

function cS(){$sb.classList.remove('open');$ov.classList.remove('show')}
document.getElementById('menuToggle').addEventListener('click',function(){$sb.classList.toggle('open');$ov.classList.toggle('show')});
 $ov.addEventListener('click',cS);document.getElementById('newChatBtn').addEventListener('click',nc);document.getElementById('clearChatBtn').addEventListener('click',cc);

(function(){if(convos.length)aId=convos[0].id;rku();$tm.textContent=Agent.label();rL();rM();setSB();$i.focus()})();
