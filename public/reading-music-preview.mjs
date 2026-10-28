// Preview-only: the normal site does not load this module.
export const startMusicByDefault=storedChoice=>storedChoice!=='false';
export class ReadingMusic {
 constructor(audio, render=()=>{}) { this.audio=audio;this.render=render;this.enabled=false;this.blockers=new Set();this.needsGesture=false;this.failed=false;this.version=0; }
 async sync() {
  const version=++this.version;
  if(!this.enabled||this.blockers.size){this.audio.pause();this.render(this);return;}
  try {await this.audio.play();if(version!==this.version){if(!this.enabled||this.blockers.size)this.audio.pause();return;}this.needsGesture=false;}
  catch(e){if(version===this.version&&e.name!=='AbortError'){this.needsGesture=e.name==='NotAllowedError';this.failed=!this.needsGesture;}}
  this.render(this);
 }
 toggle(){this.enabled=!this.enabled;this.failed=false;this.needsGesture=false;return this.sync();}
 block(key,playing){if(playing)this.blockers.add(key);else this.blockers.delete(key);return this.sync();}
 clear(keys){for(const key of keys)this.blockers.delete(key);return this.sync();}
}

if(typeof document!=='undefined'){
 const audio=document.getElementById('reading-music'),button=document.getElementById('music-toggle'),state=document.getElementById('music-state'),volume=document.getElementById('music-volume'),frame=document.getElementById('reading-page');
 const read=(key)=>{try{return localStorage.getItem(key);}catch{return null;}};
 const save=(key,v)=>{try{localStorage.setItem(key,v);}catch{ /* private mode */ }};
 const controller=new ReadingMusic(audio,c=>{
  button.textContent=c.enabled?'إيقاف الموسيقى':'تشغيل الموسيقى';
  button.setAttribute('aria-pressed',String(c.enabled));
  state.textContent=c.failed?'تعذّر تحميل الموسيقى؛ حاول تشغيلها مجدداً':!c.enabled?'الموسيقى متوقفة':c.blockers.size?'متوقفة مؤقتاً أثناء الفيديو':c.needsGesture?'المتصفح منع الصوت؛ يبدأ مع أول تفاعل':'الموسيقى تعمل بصوت منخفض';
 });
 const stored=Number(read('alnuqta-music-trial-volume')??8);
 volume.value=String(Number.isFinite(stored)?Math.max(0,Math.min(30,stored)):8);
 function setVolume(){audio.volume=Number(volume.value)/100;document.getElementById('volume-value').textContent=volume.value+'%';save('alnuqta-music-trial-volume',volume.value);}
 setVolume();button.addEventListener('click',()=>{controller.toggle();save('alnuqta-music-trial-enabled',String(controller.enabled));});
 volume.addEventListener('input',setVolume);
 audio.addEventListener('error',()=>{controller.failed=true;controller.render(controller);});
 audio.addEventListener('playing',()=>{if(!controller.enabled||controller.blockers.size)audio.pause();});
 controller.enabled=startMusicByDefault(read('alnuqta-music-trial-enabled'));
 controller.sync();
 // A real gesture is required when the browser rejects audible autoplay.
 const unlock=e=>{if(!controller.enabled||!controller.needsGesture||controller.blockers.size)return;
  if(e.target.closest?.('#music-toggle,#music-volume,#exit-trial'))return;
  if(e.type==='keydown'&&(e.altKey||e.ctrlKey||e.metaKey||e.key==='Tab'||e.key==='Escape'))return;
  controller.sync();
 };
 for(const name of ['pointerdown','keydown'])document.addEventListener(name,unlock,true);

 function watchNative(doc,keys){
  const handle=e=>{if(e.target===audio||!['VIDEO','AUDIO'].includes(e.target.tagName))return;keys.add(e.target);controller.block(e.target,e.type==='play'||e.type==='playing');};
  for(const name of ['play','playing','pause','ended','emptied','error'])doc.addEventListener(name,handle,true);
  for(const el of doc.querySelectorAll('video,audio'))if(el!==audio&&!el.paused&&!el.ended){keys.add(el);controller.block(el,true);}
  return ()=>{for(const name of ['play','playing','pause','ended','emptied','error'])doc.removeEventListener(name,handle,true);};
 }
 watchNative(document,new Set());
 let cleanup=()=>{};
 let pageGeneration=0;
 const script=(win,url,ready)=>new Promise((resolve,reject)=>{
  if(ready()){resolve();return;}const el=win.document.createElement('script');el.src=url;el.onload=()=>{if(ready())resolve();else reject(new Error('Player API unavailable'));};el.onerror=reject;win.document.head.append(el);
 });
 async function watchProviders(doc,win,keys,generation){
  const seen=new WeakSet(),players=[];let stopped=false;
  const current=()=>!stopped&&generation===pageGeneration;
  let ytReady,vimeoReady;
  function yt(){if(!ytReady)ytReady=new Promise((resolve,reject)=>{
   if(win.YT?.Player){resolve();return;}
   const old=win.onYouTubeIframeAPIReady;win.onYouTubeIframeAPIReady=()=>{old?.();resolve();};
   const s=doc.createElement('script');s.src='https://www.youtube.com/iframe_api';s.onerror=reject;doc.head.append(s);
  });return ytReady;}
  async function scan(){
   // Remove blockers for a video removed by the article reader without navigation.
   for(const key of [...keys])if(key.nodeType&&!key.isConnected){keys.delete(key);controller.block(key,false);}
   for(const el of doc.querySelectorAll('iframe[src]')){
    if(seen.has(el))continue;let u;try{u=new URL(el.src);}catch{continue;}
    if(!['www.youtube.com','www.youtube-nocookie.com','player.vimeo.com'].includes(u.hostname))continue;
    seen.add(el);keys.add(el);
    try{
     if(u.hostname==='player.vimeo.com'){
      vimeoReady??=script(win,'https://player.vimeo.com/api/player.js',()=>!!win.Vimeo?.Player);await vimeoReady;if(!current()||!el.isConnected)continue;
      const p=new win.Vimeo.Player(el);players.push(p);
      p.on('play',()=>{if(current())controller.block(el,true);});
      for(const event of ['pause','ended','error'])p.on(event,()=>{if(current())controller.block(el,false);});
     }else{
      await yt();if(!current()||!el.isConnected)continue;
      u.searchParams.set('enablejsapi','1');u.searchParams.set('origin',location.origin);el.src=u.href;
      const p=new win.YT.Player(el,{events:{onStateChange:e=>{
       if(!current())return;if(e.data===1)controller.block(el,true);else if([0,2,5,-1].includes(e.data))controller.block(el,false);
      },onError:()=>{if(current())controller.block(el,false);}}});players.push(p);
     }
    }catch{ /* Native videos continue to work if a provider API is blocked. */ }
   }
  }
  const observer=new win.MutationObserver(()=>{scan();});observer.observe(doc.body,{childList:true,subtree:true});scan();
  return ()=>{stopped=true;observer.disconnect();for(const p of players){try{p.destroy()?.catch?.(()=>{});}catch{ /* departed page */ }}};
 }
 function safePage(value){try{const u=new URL(value,location.origin);return u.origin===location.origin&&!/^\/(admin\/|experiments\/reading-music\.html)/.test(u.pathname)&&/\.(html)$/.test(u.pathname)?u.pathname+u.search+u.hash:null;}catch{return null;}}
 function navigate(value){const page=safePage(value);if(page)frame.src=page;}
 for(const b of document.querySelectorAll('[data-page]'))b.addEventListener('click',()=>navigate(b.dataset.page));
 let lastDocument;
 async function bindPage(){
  let incoming;try{incoming=frame.contentDocument;}catch{return;}
  if(!incoming||incoming===lastDocument||incoming.readyState==='loading')return;lastDocument=incoming;
  cleanup();const generation=++pageGeneration;const keys=new Set();let providerCleanup=()=>{};
  let nativeCleanup=()=>{};
  cleanup=()=>{nativeCleanup();providerCleanup();controller.clear(keys);};
  try{
   const doc=frame.contentDocument,win=frame.contentWindow;if(!doc?.body)return;
   const unwatch=watchNative(doc,keys);
   for(const name of ['pointerdown','keydown'])doc.addEventListener(name,unlock,true);
   nativeCleanup=()=>{unwatch();for(const name of ['pointerdown','keydown'])doc.removeEventListener(name,unlock,true);};
   // Keep internal browsing in the preview frame, including article links.
   doc.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(!a||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||a.hasAttribute('download'))return;const u=new URL(a.href);if(u.origin!==location.origin)return;
    if(/^\/admin\//.test(u.pathname)||u.pathname==='/experiments/reading-music.html'){e.preventDefault();return;}
    if(a.target==='_blank'&&safePage(u.href)){e.preventDefault();win.location.href=u.href;}
   },true);
   providerCleanup=await watchProviders(doc,win,keys,generation);if(generation!==pageGeneration)providerCleanup();
  }catch{state.textContent='هذه الصفحة لا تدعم التصفح داخل التجربة';}
 }
 frame.addEventListener('load',bindPage);
 bindPage();
 const selected=safePage(new URLSearchParams(location.search).get('page')||'/newsroom.html');if(selected&&selected!=='/newsroom.html')navigate(selected);
 const panel=document.getElementById('check-panel'),check=document.getElementById('check-video'),show=document.getElementById('show-check');
 show.addEventListener('click',()=>{panel.hidden=!panel.hidden;show.setAttribute('aria-expanded',String(!panel.hidden));if(panel.hidden)check.pause();});
 document.getElementById('close-check').addEventListener('click',()=>{check.pause();panel.hidden=true;show.setAttribute('aria-expanded','false');show.focus();});
 document.getElementById('exit-trial').addEventListener('click',()=>{controller.enabled=false;controller.sync();});
}
