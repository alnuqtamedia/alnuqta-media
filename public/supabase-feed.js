(() => {
  const config = window.ALNUQTA_SUPABASE_PUBLIC || {};
  const url = config.url || '';
  const key = config.anonKey || '';
  const types = { investigation:'تحقيق استقصائي', report:'تقرير', news:'خبر', analysis:'تحليل', interview:'مقابلة', 'human-story':'قصة إنسانية', video:'فيديو', gallery:'معرض صور' };
  const categories = window.ALNUQTA_SECTIONS.map(s=>[s.id,s.label]);
  const esc = (value='') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const formatDate = value => { const parsed=new Date(value||0); return Number.isNaN(parsed.getTime())?'':parsed.toLocaleDateString(window.ALNUQTA_LANGUAGE==='en'?'en-GB':'ar-IQ',{year:'numeric',month:'long',day:'numeric'}); };
  const categoryKey = post => window.normalizeCategory(post.category);
  const categoryLabel = post => categories.find(([id])=>id===categoryKey(post))?.[1] || types[post.section] || 'مادة صحفية';
  const cover = post => post.cover_image_url || post.image || post.gallery?.[0]?.url || '';
  function displayImageUrl(value,width){try{const u=new URL(value,location.href);if(u.hostname==='images.pexels.com'){u.search='';u.searchParams.set('auto','compress');u.searchParams.set('cs','tinysrgb');u.searchParams.set('w',String(width));u.searchParams.set('q','75');return u.href;}return value;}catch{return value;}}
  const articleUrl = post => `newsroom.html?slug=${encodeURIComponent(post.slug||post.id||'')}`;
  const latestSection = () => document.getElementById('homepage-feed');

  function placeholder(post,extra='') {
    return `<div class="${extra} bg-gradient-to-br from-navy-light via-navy to-navy-dark grid place-items-center p-8 text-center"><div><div class="mx-auto w-14 h-14 rounded-full bg-brandRed flex items-center justify-center text-4xl font-black">.</div><p class="mt-4 text-sm text-gray-300">${esc(categoryLabel(post))}</p></div></div>`;
  }

  function renderHero(post) {
    const hero=document.querySelector('#section-home > section'); if(!hero)return;
    const image=cover(post);
    hero.innerHTML=`<a href="${articleUrl(post)}" class="grid grid-cols-1 lg:grid-cols-12 items-stretch group" aria-label="قراءة أحدث مادة: ${esc(post.title)}"><div class="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center"><div class="flex flex-wrap items-center gap-2 text-xs"><span class="bg-brandRed text-white font-cairo font-black px-3 py-1 rounded-md">أحدث مادة</span><span class="text-red-300 font-bold">${esc(categoryLabel(post))}</span></div><h1 class="font-cairo font-black text-3xl sm:text-4xl lg:text-5xl leading-tight text-white mt-4 group-hover:text-red-300 transition">${esc(post.title)}</h1><p class="font-tajawal text-gray-200 text-sm sm:text-base leading-8 mt-4">${esc(post.excerpt||post.subtitle||'مادة جديدة منشورة من غرفة أخبار النقطة.')}</p><div class="flex flex-wrap items-center gap-4 mt-6 pt-5 border-t border-navy-light/60 text-xs text-gray-300"><span>${formatDate(post.published_at||post.created_at)}</span>${post.reading_time?`<span>${esc(post.reading_time)} دقائق قراءة</span>`:''}<strong class="text-white group-hover:text-red-300">قراءة المادة ←</strong></div></div><div class="lg:col-span-5 min-h-72 lg:min-h-[420px] border-t lg:border-t-0 lg:border-r border-navy-light">${image?`<img src="${esc(displayImageUrl(image,960))}" alt="${esc(post.image_alt||post.title)}" class="w-full h-full min-h-72 lg:min-h-[420px] object-cover" loading="eager" decoding="async" fetchpriority="high">`:placeholder(post,'h-full min-h-72 lg:min-h-[420px]')}</div></a>`;
  }

  function articleCard(post) {
    const image=cover(post);
    return `<article class="bg-navy-card border border-navy-light hover:border-brandRed/60 rounded-xl overflow-hidden flex flex-col transition group shadow-lg"><a href="${articleUrl(post)}" class="flex flex-col h-full" aria-label="قراءة ${esc(post.title)}">${image?`<img src="${esc(displayImageUrl(image,640))}" alt="${esc(post.image_alt||post.title)}" class="w-full h-44 object-cover" loading="lazy" decoding="async">`:placeholder(post,'h-44')}<div class="p-5 flex flex-col flex-1"><div class="flex items-center justify-between gap-3 text-xs"><span class="text-red-300 font-bold">${esc(categoryLabel(post))}</span><span class="text-gray-400">${formatDate(post.published_at||post.created_at)}</span></div><h3 class="font-cairo font-bold text-lg text-white group-hover:text-red-300 mt-3 leading-8">${esc(post.title)}</h3><p class="text-sm text-gray-300 leading-7 mt-2 line-clamp-3">${esc(post.excerpt||post.subtitle||'')}</p><span class="mt-auto pt-5 text-sm font-bold text-red-300">قراءة المادة ←</span></div></a></article>`;
  }


  function renderTicker(posts) {
    const ticker=document.getElementById('homepage-ticker');if(!ticker)return;
    const latest=categories.map(([id,label])=>({post:posts.find(p=>categoryKey(p)===id),label})).filter(x=>x.post);
    ticker.hidden=!latest.length;
    const links=latest.map(({post,label})=>`<a href="${articleUrl(post)}"><span>${esc(label)}</span>${esc(post.title)}</a>`).join('');
    ticker.innerHTML=`<strong class="ticker-label">آخر الأخبار</strong><div class="ticker-window"><div class="ticker-track"><div class="ticker-copy">${links}</div><div class="ticker-copy" aria-hidden="true">${links.replaceAll('<a href=', '<a tabindex="-1" href=')}</div></div></div>`;
  }
  function sectionBlock(id,label,rows) {
    const first=rows[0],image=cover(first);
    return `<section id="home-${id}" class="space-y-5"><div class="flex items-center justify-between border-b border-navy-light pb-3"><h2 class="font-cairo font-black text-2xl">${esc(label)}</h2><a href="newsroom.html?section=${id}" class="text-red-300 text-sm font-bold">المزيد</a></div><div class="grid grid-cols-1 lg:grid-cols-12 gap-6"><article class="lg:col-span-7 bg-navy-card border border-navy-light rounded-xl overflow-hidden"><a href="${articleUrl(first)}">${image?`<img src="${esc(displayImageUrl(image,800))}" alt="${esc(first.image_alt||first.title)}" class="w-full h-64 object-cover" loading="lazy" decoding="async">`:placeholder(first,'h-64')}<div class="p-6"><time class="text-gray-400 text-xs" datetime="${esc(first.published_at||first.created_at||'')}">${formatDate(first.published_at||first.created_at)}</time><h3 class="font-cairo font-bold text-xl leading-8 mt-3">${esc(first.title)}</h3><p class="text-gray-300 leading-7 text-sm mt-3">${esc(first.excerpt||first.subtitle||'')}</p></div></a></article>${rows.length>1?`<div class="lg:col-span-5 divide-y divide-navy-light">${rows.slice(1).map(post=>`<article class="py-5"><a href="${articleUrl(post)}" class="hover:text-red-300"><h3 class="font-cairo font-bold text-lg leading-8">${esc(post.title)}</h3><time class="block text-gray-400 text-xs mt-3" datetime="${esc(post.published_at||post.created_at||'')}">${formatDate(post.published_at||post.created_at)}</time></a></article>`).join('')}</div>`:''}</div></section>`;
  }
  function render(posts) {
    posts=(Array.isArray(posts)?posts:[]).filter(post=>post&&String(post.title||'').trim()).map((post,index)=>({...post,slug:String(post.slug||post.id||`published-${index}`)})).sort((a,b)=>new Date(b.published_at||b.created_at||0)-new Date(a.published_at||a.created_at||0));
    const section=latestSection();if(!section)return;
    renderTicker(posts);
    if(!posts.length){const hero=document.getElementById('homepage-featured');if(hero)hero.innerHTML='<h1 class="font-cairo font-black text-3xl">النقطة Media</h1>';section.innerHTML='<p role="status" class="text-gray-300 text-center p-8">لا توجد مواد منشورة حالياً.</p>';return;}
    renderHero(posts[0]);
    section.innerHTML=categories.map(([id,label])=>{const all=posts.filter(p=>categoryKey(p)===id);if(!all.length)return '';const withoutHero=all.filter(p=>p.slug!==posts[0].slug);return sectionBlock(id,label,(withoutHero.length?withoutHero:all).slice(0,4));}).join('')+'<a href="newsroom.html" class="inline-block text-red-300 font-bold">عرض غرفة الأخبار كاملة ←</a>';
    if(window.lucide)window.lucide.createIcons();
  }
  function showError(error){console.warn('Supabase public feed unavailable.',error);const section=latestSection();if(section)section.innerHTML='<div class="bg-navy-card border border-navy-light rounded-xl p-7 text-center" role="status"><p class="text-gray-300">تعذر تحميل أحدث المواد الآن.</p><a href="newsroom.html" class="inline-block mt-4 text-red-300 font-bold">فتح غرفة الأخبار ←</a></div>';}
  if(!url||!key){showError(new Error('Missing public feed configuration'));return;}
  const endpoint=`${url.replace(/\/$/,'')}/rest/v1/articles?select=id,title,subtitle,excerpt,category,section,cover_image_url,image,gallery,published_at,created_at,updated_at,reading_time&status=eq.published&order=published_at.desc.nullslast,id.desc`;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  fetch(endpoint,{signal:controller.signal,headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json'},cache:'no-store'}).then(response=>{if(!response.ok)throw new Error(`Supabase feed request failed: ${response.status}`);return response.json();}).then(rows => window.ALNUQTA_I18N?.articles(rows,{summaryOnly:true}) || rows).then(render).catch(showError).finally(()=>clearTimeout(timer));
})();
