(() => {
 window.articlePublicUrl=(p,lang)=>{
  const id=String(p.id||p.slug||'');
  const ready=Array.isArray(window.ALNUQTA_ARTICLE_PAGES)&&window.ALNUQTA_ARTICLE_PAGES.includes(id);
  const url=new URL(ready?'articles/'+encodeURIComponent(id)+'.html':'newsroom.html',document.baseURI);
  if(!ready)url.searchParams.set('slug',String(p.slug||p.id||''));
  if(lang==='en')url.searchParams.set('lang','en');
  return url.href;
 };
})();
