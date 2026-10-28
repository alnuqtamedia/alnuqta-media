export function publicMusicPath(value,origin){
 try{const u=new URL(value,origin);if(u.origin!==origin||/^\/(?:admin|experiments|public|assets|supabase)(?:\/|$)/i.test(u.pathname)||/^\/newsletter-/i.test(u.pathname))return null;
  return u.pathname==='/'||/\.html$/i.test(u.pathname)?u.pathname+u.search+u.hash:null;
 }catch{return null;}
}
export function readyMusicDocument(win,origin){try{return !!(publicMusicPath(win.location.href,origin)&&win.document?.body&&win.document.readyState!=='loading');}catch{return false;}}

export async function bootSiteMusic(){
 if(window.top!==window.self||document.getElementById('reading-music-site'))return;
 const origin=location.origin,start=publicMusicPath(document.body.dataset.musicStart||location.href,origin);if(!start)return;
 const original=[...document.body.children],previousOverflow=document.body.style.overflow;
 const stage=document.createElement('div');stage.id='reading-music-site';stage.style.cssText='position:fixed;inset:0;z-index:2147483000;display:none;height:100dvh;background:#f8fafc';
 stage.innerHTML=`<main style="height:100%;min-height:0"><iframe id="reading-page" title="موقع النقطة" style="border:0;width:100%;height:100%;display:block" allow="autoplay; fullscreen" allowfullscreen></iframe></main>
 <section class="music-player" aria-label="موسيقى القراءة"><div class="music-title"><span id="music-state" role="status" aria-live="polite">جارٍ تشغيل الموسيقى</span></div><button type="button" id="music-toggle" aria-pressed="true">إيقاف الموسيقى</button><details class="music-options"><summary aria-label="إعدادات الموسيقى" title="إعدادات الموسيقى">⋯</summary><div class="options-panel"><label class="volume-label" for="music-volume">الصوت <input id="music-volume" type="range" min="0" max="30" value="8" step="1"><output id="volume-value" for="music-volume">8%</output></label></div></details></section>
 <div hidden><button id="show-check"></button><aside id="check-panel" hidden><video id="check-video"></video><button id="close-check"></button></aside><a id="exit-trial" href="/index.html"></a><audio id="reading-music" preload="none"></audio></div>`;
 const frame=stage.querySelector('#reading-page');let active=false,timeout,readyProbe;
 const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/public/reading-music-preview.css?v=5';
 const styles=new Promise((resolve,reject)=>{sheet.onload=resolve;sheet.onerror=reject;});document.head.append(sheet);
 const firstPage=new Promise((resolve,reject)=>{
  timeout=setTimeout(()=>reject(new Error('Page did not load')),15000);
  const loaded=()=>{try{if(!readyMusicDocument(frame.contentWindow,origin))return;clearInterval(readyProbe);frame.removeEventListener('load',loaded);resolve();}catch(e){reject(e);}};
  frame.addEventListener('load',loaded);
  readyProbe=setInterval(loaded,75);
 });
 document.body.append(stage);frame.src=start;
 const saved=original.map(el=>({el,hidden:el.hidden,inert:el.inert}));
 const reflect=(mode='replace')=>{
  if(!active)return;try{
   const child=frame.contentWindow,path=publicMusicPath(child.location.href,origin);if(!path)return;
   if(path!==location.pathname+location.search+location.hash){const method=mode==='push'?'pushState':'replaceState';history[method]({readingMusic:true},'',path);}
   const doc=frame.contentDocument;document.title=doc.title||'النقطة ميديا';document.documentElement.lang=doc.documentElement.lang||'ar';document.documentElement.dir=doc.documentElement.dir||'rtl';
   for(const selector of ['link[rel="canonical"]','meta[name="description"]','meta[property="og:title"]','meta[property="og:description"]','meta[property="og:url"]','meta[property="og:image"]']){
    const source=doc.querySelector(selector),old=document.head.querySelector(selector);if(!source){old?.remove();continue;}if(old)old.replaceWith(source.cloneNode(true));else document.head.append(source.cloneNode(true));
   }
  }catch{ /* A normal same-origin navigation will bind on load. */ }
 };
 function navigate(url,push=true){
  const path=publicMusicPath(url,origin);if(!path)return false;
  if(push&&path!==location.pathname+location.search+location.hash)history.pushState({readingMusic:true},'',path);
  frame.contentWindow.location.replace(path);return true;
 }
 let boundDocument;
 function bindRoutes(){
  if(!active)return;const doc=frame.contentDocument,win=frame.contentWindow;if(!doc?.body||doc===boundDocument)return;boundDocument=doc;
  const replace=win.history.replaceState.bind(win.history);
  win.history.pushState=(state,title,url)=>{replace(state,title,url);reflect('push');};
  win.history.replaceState=(state,title,url)=>{replace(state,title,url);reflect('replace');};
  doc.addEventListener('click',event=>{
   const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute('download')||link.target==='_blank')return;
   const url=new URL(link.href,win.location.href);if(url.origin!==origin)return;
   if(/^\/admin(?:\/|$)/.test(url.pathname)||/^\/newsletter-/.test(url.pathname)){event.preventDefault();location.href=url.href;return;}
   if(publicMusicPath(url.href,origin)){event.preventDefault();navigate(url.href);}
  });
  win.addEventListener('hashchange',()=>reflect('push'));
  new win.MutationObserver(()=>{document.title=doc.title||document.title;}).observe(doc.head,{childList:true,subtree:true,characterData:true});
  reflect();
 }
 frame.addEventListener('load',bindRoutes);
 window.addEventListener('popstate',()=>{if(active)navigate(location.href,false);});
 try{
  await Promise.all([styles,firstPage]);clearTimeout(timeout);clearInterval(readyProbe);document.body.dataset.readingMusicSite='true';active=true;bindRoutes();
  for(const {el} of saved){el.hidden=true;el.inert=true;}
  document.body.style.overflow='hidden';stage.style.display='block';frame.focus();
  await import('/public/reading-music-preview.mjs?v=site1');
 }catch{
  clearTimeout(timeout);clearInterval(readyProbe);active=false;
  const toggle=stage.querySelector('#music-toggle');if(toggle?.getAttribute('aria-pressed')==='true')toggle.click();
  for(const {el,hidden,inert} of saved){el.hidden=hidden;el.inert=inert;}
  document.body.style.overflow=previousOverflow;delete document.body.dataset.readingMusicSite;stage.remove();sheet.remove();
 }
}

if(typeof window!=='undefined'&&typeof document!=='undefined')bootSiteMusic();
