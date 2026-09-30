(() => {
  const config = window.ALNUQTA_SUPABASE_PUBLIC || {};
  const url = config.url || '';
  const key = config.anonKey || '';
  const types = { investigation:'تحقيق استقصائي', report:'تقرير', news:'خبر', analysis:'تحليل', interview:'مقابلة', 'human-story':'قصة إنسانية', video:'فيديو', gallery:'معرض صور' };
  const categories = [
    ['politics','السياسة'], ['economy-public-money','الاقتصاد والمال العام'],
    ['field-social','التحقيقات الميدانية والاجتماعية'], ['culture-arts','ثقافة وفنون'],
    ['travel-tourism','سياحة وسفر'], ['sports','الرياضة'], ['human-stories','قصص إنسانية']
  ];
  const esc = (value='') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const formatDate = value => { const parsed=new Date(value||0); return Number.isNaN(parsed.getTime())?'':parsed.toLocaleDateString(window.ALNUQTA_LANGUAGE==='en'?'en-GB':'ar-IQ',{year:'numeric',month:'long',day:'numeric'}); };
  const categoryKey = post => post.category || (post.section==='investigation'?'field-social':'');
  const categoryLabel = post => categories.find(([id])=>id===categoryKey(post))?.[1] || types[post.section] || 'مادة صحفية';
  const cover = post => post.cover_image_url || post.image || post.gallery?.[0]?.url || '';
  const articleUrl = post => `newsroom.html?slug=${encodeURIComponent(post.slug||post.id||'')}`;
  const latestSection = () => document.getElementById('homepage-feed')?.closest('section') || [...document.querySelectorAll('#section-home section')].find(section=>section.querySelector('h2')?.textContent.includes('أحدث المواد'));

  function placeholder(post,extra='') {
    return `<div class="${extra} bg-gradient-to-br from-navy-light via-navy to-navy-dark grid place-items-center p-8 text-center"><div><div class="mx-auto w-14 h-14 rounded-full bg-brandRed flex items-center justify-center text-4xl font-black">.</div><p class="mt-4 text-sm text-gray-300">${esc(categoryLabel(post))}</p></div></div>`;
  }

  function renderHero(post) {
    const hero=document.querySelector('#section-home > section'); if(!hero)return;
    const image=cover(post);
    hero.innerHTML=`<a href="${articleUrl(post)}" class="grid grid-cols-1 lg:grid-cols-12 items-stretch group" aria-label="قراءة أحدث مادة: ${esc(post.title)}"><div class="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center"><div class="flex flex-wrap items-center gap-2 text-xs"><span class="bg-brandRed text-white font-cairo font-black px-3 py-1 rounded-md">أحدث مادة</span><span class="text-red-300 font-bold">${esc(categoryLabel(post))}</span></div><h1 class="font-cairo font-black text-3xl sm:text-4xl lg:text-5xl leading-tight text-white mt-4 group-hover:text-red-300 transition">${esc(post.title)}</h1><p class="font-tajawal text-gray-200 text-sm sm:text-base leading-8 mt-4">${esc(post.excerpt||post.subtitle||'مادة جديدة منشورة من غرفة أخبار النقطة.')}</p><div class="flex flex-wrap items-center gap-4 mt-6 pt-5 border-t border-navy-light/60 text-xs text-gray-300"><span>${formatDate(post.published_at||post.created_at)}</span>${post.reading_time?`<span>${esc(post.reading_time)} دقائق قراءة</span>`:''}<strong class="text-white group-hover:text-red-300">قراءة المادة ←</strong></div></div><div class="lg:col-span-5 min-h-72 lg:min-h-[420px] border-t lg:border-t-0 lg:border-r border-navy-light">${image?`<img src="${esc(image)}" alt="${esc(post.image_alt||post.title)}" class="w-full h-full min-h-72 lg:min-h-[420px] object-cover" loading="eager">`:placeholder(post,'h-full min-h-72 lg:min-h-[420px]')}</div></a>`;
  }

  function articleCard(post) {
    const image=cover(post);
    return `<article class="bg-navy-card border border-navy-light hover:border-brandRed/60 rounded-xl overflow-hidden flex flex-col transition group shadow-lg"><a href="${articleUrl(post)}" class="flex flex-col h-full" aria-label="قراءة ${esc(post.title)}">${image?`<img src="${esc(image)}" alt="${esc(post.image_alt||post.title)}" class="w-full h-44 object-cover" loading="lazy">`:placeholder(post,'h-44')}<div class="p-5 flex flex-col flex-1"><div class="flex items-center justify-between gap-3 text-xs"><span class="text-red-300 font-bold">${esc(categoryLabel(post))}</span><span class="text-gray-400">${formatDate(post.published_at||post.created_at)}</span></div><h3 class="font-cairo font-bold text-lg text-white group-hover:text-red-300 mt-3 leading-8">${esc(post.title)}</h3><p class="text-sm text-gray-300 leading-7 mt-2 line-clamp-3">${esc(post.excerpt||post.subtitle||'')}</p><span class="mt-auto pt-5 text-sm font-bold text-red-300">قراءة المادة ←</span></div></a></article>`;
  }

  function renderCategories(posts,anchor) {
    let section=document.getElementById('homepage-categories');
    if(!section){section=document.createElement('section');section.id='homepage-categories';section.className='space-y-5';anchor.after(section);}
    section.innerHTML=`<div class="flex items-end justify-between gap-4"><div><h2 class="font-cairo font-black text-xl text-white">أقسام النقطة</h2><p class="text-sm text-gray-300 mt-1">تصفح المواد المنشورة حسب الملف التحريري</p></div><a href="newsroom.html" class="text-sm font-bold text-red-300 hover:text-white">كل المواد ←</a></div><div class="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">${categories.map(([id,label])=>{const count=posts.filter(post=>categoryKey(post)===id).length;return `<a href="newsroom.html?section=${id}" class="bg-navy-card border border-navy-light hover:border-brandRed rounded-xl p-4 sm:p-5 transition group"><div class="flex items-center justify-between gap-3"><strong class="font-cairo text-sm sm:text-base text-white group-hover:text-red-300">${label}</strong><span class="min-w-8 h-8 px-2 rounded-full bg-navy grid place-items-center text-xs text-gray-300">${count}</span></div><span class="block text-xs text-gray-400 mt-3">${count?(count===1?'مادة واحدة منشورة':`${count} مواد منشورة`):'بانتظار أول مادة'}</span></a>`;}).join('')}</div>`;
  }

  function render(posts) {
    posts=(Array.isArray(posts)?posts:[]).filter(post=>post&&String(post.title||'').trim()).map((post,index)=>({...post,slug:String(post.slug||post.id||`published-${index}`)})).sort((a,b)=>new Date(b.published_at||b.updated_at||b.created_at||0)-new Date(a.published_at||a.updated_at||a.created_at||0));
    const section=latestSection(),grid=section?.querySelector('.grid');if(!section||!grid)return;
    const heading=section.querySelector('h2'),description=section.querySelector('p'),allButton=section.querySelector('button');
    if(heading)heading.innerHTML='<i data-lucide="newspaper" class="w-5 h-5 text-brandRed" aria-hidden="true"></i> أحدث المواد';
    if(description)description.textContent='أحدث الأخبار والتقارير والتحليلات المنشورة من غرفة الأخبار';
    if(allButton){allButton.removeAttribute('onclick');allButton.innerHTML='عرض غرفة الأخبار كاملة ←';allButton.onclick=()=>{location.href='newsroom.html';};}
    if(!posts.length){const hero=document.querySelector('#section-home > section');if(hero)hero.innerHTML='<div class="p-10 text-center"><h1 class="font-cairo font-black text-3xl">النقطة Media</h1><p class="text-gray-300 mt-3">ستظهر أحدث المواد هنا فور اعتمادها من غرفة الأخبار.</p></div>';grid.innerHTML='<div class="md:col-span-2 lg:col-span-3 bg-navy-card border border-navy-light rounded-xl p-8 text-center text-gray-300">لا توجد مواد منشورة حالياً.</div>';renderCategories([],section);return;}
    renderHero(posts[0]);const latest=posts.slice(1,7);grid.innerHTML=latest.length?latest.map(articleCard).join(''):'<div class="md:col-span-2 lg:col-span-3 bg-navy-card border border-navy-light rounded-xl p-7 text-center text-gray-300">هذه أحدث مادة منشورة حالياً. ستظهر المواد التالية هنا بعد اعتمادها.</div>';renderCategories(posts,section);if(window.lucide)window.lucide.createIcons();
  }

  function showError(error){console.warn('Supabase public feed unavailable.',error);const grid=latestSection()?.querySelector('.grid');if(grid)grid.innerHTML='<div class="md:col-span-2 lg:col-span-3 bg-navy-card border border-navy-light rounded-xl p-7 text-center"><p class="text-gray-300">تعذر تحميل أحدث المواد الآن.</p><a href="newsroom.html" class="inline-block mt-4 text-red-300 font-bold">فتح غرفة الأخبار ←</a></div>';}
  if(!url||!key){console.warn('Alnuqta public Supabase feed is not configured yet.');return;}
  const endpoint=`${url.replace(/\/$/,'')}/rest/v1/articles?select=*&status=eq.published`;
  fetch(endpoint,{headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json'},cache:'no-store'}).then(response=>{if(!response.ok)throw new Error(`Supabase feed request failed: ${response.status}`);return response.json();}).then(rows => window.ALNUQTA_I18N.articles(rows)).then(render).catch(showError);
})();
