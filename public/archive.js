(() => {
  'use strict';
  const $=id=>document.getElementById(id), params=new URLSearchParams(location.search);
  let stored;try{stored=localStorage.getItem('alnuqta-language')}catch{}
  const lang=(params.get('lang')||stored)==='en'?'en':'ar', en=lang==='en', size=20;
  const texts={home:['الرئيسية','Home'],newsroom:['غرفة الأخبار','Newsroom'],archive:['الأرشيف','Archive'],eyebrow:['ذاكرة النقطة','The Alnuqta record'],heading:['قصص تبقى. وأرشيف يسهل الوصول إليه.','Stories that stay. An archive to explore.'],intro:['الأخبار والتقارير والتحقيقات المنشورة، في مكان واحد. ابحث في النص الكامل بالعربية والإنكليزية.','Published news, reports and investigations in one place. Search full articles in Arabic and English.'],published:['مادة منشورة','published articles'],timezone:['التواريخ بتوقيت بغداد','Dates in Baghdad time'],refine:['ابحث في الأرشيف','Explore the archive'],search:['كلمات البحث','Search words'],searchHint:['البحث يتجاهل التشكيل وبعض اختلافات الألف. كل كلمات البحث مطلوبة.','Search ignores Arabic diacritics and normalizes common letter variants. All search words must match.'],category:['القسم التحريري','Editorial section'],type:['النوع الصحفي','Article type'],writer:['الكاتب','Writer'],year:['السنة','Year'],month:['الشهر','Month'],customDates:['فترة مخصصة','Custom date range'],from:['من','From'],to:['إلى','To'],sort:['ترتيب النتائج','Sort results'],apply:['عرض النتائج','Show results'],reset:['مسح الفلاتر','Clear filters'],results:['المواد المنشورة','Published articles'],share:['نسخ رابط البحث','Copy search link'],empty:['لا توجد مواد مطابقة','No matching articles'],emptyHint:['جرّب كلمات أخرى أو وسّع الفترة الزمنية.','Try different words or a wider date range.'],retry:['إعادة المحاولة','Try again'],previous:['السابق','Previous'],next:['التالي','Next'],note:['هذا الأرشيف يعرض المواد المنشورة للجمهور، ولا يعرض المسودات أو معلومات الفريق الخاصة.','This archive contains public articles. Drafts and private team information are excluded.'],policy:['سياسة التحرير','Editorial policy'],corrections:['التصحيحات','Corrections'],contact:['تواصل معنا','Contact us']};
  const t=k=>texts[k]?.[en?1:0]||k;
  const categories=Object.fromEntries(window.ALNUQTA_SECTIONS.map(s=>[s.id,[s.label,s.labelEn]]));
  const types={opinion:['مقال رأي','Opinion article'],news:['خبر','News'],report:['تقرير','Report'],investigation:['تحقيق','Investigation'],analysis:['تحليل','Analysis'],interview:['مقابلة','Interview'],'human-story':['قصة إنسانية','Human story'],video:['فيديو','Video'],gallery:['معرض صور','Photo gallery']};
  const label=(map,k)=>map[k]?.[en?1:0]||k||'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const option=(value,name)=>`<option value="${esc(value)}">${esc(name)}</option>`;
  document.documentElement.lang=lang;document.documentElement.dir=en?'ltr':'rtl';
  document.title=en?'Archive | Alnuqta':'أرشيف النقطة | الأخبار والتقارير والتحقيقات';
  document.querySelector('link[rel=canonical]').href='https://alnuqtamedia.com/archive.html'+(en?'?lang=en':'');
  document.querySelector('meta[name=description]').content=en?'Search Alnuqta’s published Arabic and English journalism by date, section and writer.':'ابحث في أرشيف النقطة بالعربية والإنكليزية حسب التاريخ والقسم والكاتب.';
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  $('query').placeholder=en?'A title, name or word in an article':'عنوان، اسم أو كلمة داخل المادة';
  $('language').textContent=en?'العربية':'English';
  $('language').onclick=()=>{const u=new URL(location.href);u.searchParams.set('lang',en?'ar':'en');try{localStorage.setItem('alnuqta-language',en?'ar':'en')}catch{}location.href=u.href};
  document.querySelectorAll('a[href]').forEach(a=>{const u=new URL(a.href);if(u.origin===location.origin){u.searchParams.set('lang',lang);a.href=u.href}});
  $('category').innerHTML=option('',en?'All sections':'كل الأقسام')+Object.keys(categories).map(k=>option(k,label(categories,k))).join('');
  $('type').innerHTML=option('',en?'All types':'كل الأنواع')+Object.keys(types).map(k=>option(k,label(types,k))).join('');
  $('writer').innerHTML=option('',en?'All writers':'كل الكتّاب');$('year').innerHTML=option('',en?'All years':'كل السنوات');
  $('month').innerHTML=option('',en?'All months':'كل الأشهر')+Array.from({length:12},(_,i)=>option(i+1,new Intl.DateTimeFormat(en?'en-GB':'ar-IQ',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,i,1))))).join('');
  $('sort').innerHTML=option('newest',en?'Newest first':'الأحدث أولاً')+option('oldest',en?'Oldest first':'الأقدم أولاً');
  $('pagination').setAttribute('aria-label',en?'Result pages':'صفحات النتائج');$('skip')?.setAttribute('lang',lang);
  let page=Math.max(1,Math.min(5000,Math.floor(Number(params.get('page')))||1)),total=0,loadedFacets=false,controller,sequence=0;
  const mappings={query:'q',category:'category',type:'type',writer:'writer',year:'year',month:'month',from:'from',to:'to',sort:'sort'};
  function restore(){for(const [id,key] of Object.entries(mappings)){const v=params.get(key);if(v!==null){if(id==='writer'&&v||id==='year'&&/^\d{4}$/.test(v))$(id).insertAdjacentHTML('beforeend',option(v,v));$(id).value=id==='category'&&v?window.normalizeCategory(v):v}}if($('from').value||$('to').value)$('date-details').open=true}
  restore();
  function range(){let from=$('from').value||null,to=$('to').value||null;const y=Number($('year').value),m=Number($('month').value);if(!from&&!to&&y){from=`${y}-${String(m||1).padStart(2,'0')}-01`;to=`${y}-${String(m||12).padStart(2,'0')}-${new Date(Date.UTC(y,m||12,0)).getUTCDate()}`}return {from,to}}
  function syncURL(){const u=new URL(location.href);u.search='';u.searchParams.set('lang',lang);for(const [id,key] of Object.entries(mappings)){const v=$(id).value;if(v&&!(id==='sort'&&v==='newest'))u.searchParams.set(key,v)}if(page>1)u.searchParams.set('page',page);history.replaceState(null,'',u.href)}
  function card(a){const url=`newsroom.html?slug=${encodeURIComponent(a.id)}&lang=${lang}`;let image='';try{const u=new URL(a.image);if(['https:','http:'].includes(u.protocol)){if(u.hostname==='images.pexels.com'){u.search='?auto=compress&cs=tinysrgb&w=640&q=75'}image=u.href}}catch{}
    const date=a.published_at?new Intl.DateTimeFormat(en?'en-GB':'ar-IQ',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Baghdad'}).format(new Date(a.published_at)):'';
    return `<article class="card"><a href="${url}" tabindex="-1" aria-hidden="true"><div class="image">${image?`<img src="${esc(image)}" alt="" loading="lazy" decoding="async" width="640" height="400">`:'<span>النقطة Media</span>'}</div></a><div class="card-content"><div class="meta"><span class="type">${esc(label(types,a.section))}</span><span>${esc(label(categories,window.normalizeCategory(a.category)))}</span></div><h3${en&&!a.translation_available?' lang="ar" dir="rtl"':''}><a href="${url}">${esc(a.title)}</a></h3><p${en&&!a.translation_available?' lang="ar" dir="rtl"':''}>${esc(a.excerpt||a.subtitle)}</p><div class="meta"><time datetime="${esc(a.published_at)}">${esc(date)}</time>${a.writer_name?`<span>${esc(a.writer_name)}</span>`:''}${a.reading_time?`<span>${esc(a.reading_time)} ${en?'min read':'دقائق قراءة'}</span>`:''}</div>${en&&!a.translation_available?'<div class="translation-note">Arabic original · English translation pending</div>':''}<a class="read" href="${url}">${en?'Read article →':'قراءة المادة ←'}</a></div></article>`;
  }
  async function load(){const dates=range();if(dates.from&&dates.to&&dates.from>dates.to){$('status').textContent=en?'The start date must be before the end date.':'تاريخ البداية لازم يسبق تاريخ النهاية.';return}if($('month').value&&!$('year').value&&!dates.from&&!dates.to){$('status').textContent=en?'Choose a year to filter by month.':'اختَر السنة حتى تصفّي حسب الشهر.';return}
    controller?.abort();controller=new AbortController();const requestController=controller,current=++sequence;
    $('results').setAttribute('aria-busy','true');$('status').textContent=en?'Searching the archive…':'جارٍ البحث في الأرشيف…';$('retry').hidden=true;$('previous').disabled=true;$('next').disabled=true;syncURL();
    const config=window.ALNUQTA_SUPABASE_PUBLIC||{};
    const timer=setTimeout(()=>requestController.abort(),15000);
    try{if(!config.url||!config.anonKey)throw Error('config');
      const response=await fetch(config.url+'/rest/v1/rpc/search_newsroom_archive',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.anonKey,Authorization:`Bearer ${config.anonKey}`},body:JSON.stringify({p_query:$('query').value.trim(),p_category:$('category').value,p_type:$('type').value,p_writer:$('writer').value,p_from:dates.from,p_to:dates.to,p_language:lang,p_sort:$('sort').value,p_offset:(page-1)*size,p_limit:size,p_facets:!loadedFacets}),signal:controller.signal});
      if(!response.ok)throw Error('http '+response.status);const data=await response.json();if(current!==sequence)return;
      if(!Array.isArray(data.items)||!Number.isFinite(data.total))throw Error('invalid response');
      total=data.total;
      if(data.facets){const w=$('writer').value||params.get('writer')||'',y=$('year').value||params.get('year')||'';$('archive-count').textContent=data.facets.total;$('year-range').textContent=data.facets.years.length?(en?'Years: ':'السنوات: ')+data.facets.years.slice().reverse().join(' · '):'';$('writer').innerHTML=option('',en?'All writers':'كل الكتّاب')+data.facets.writers.map(v=>option(v,v)).join('');$('year').innerHTML=option('',en?'All years':'كل السنوات')+data.facets.years.map(v=>option(v,v)).join('');$('writer').value=w;$('year').value=y;loadedFacets=true;}
      if(page>1&&(page-1)*size>=total){page=Math.max(1,Math.ceil(total/size));return load()}
      $('grid').innerHTML=data.items.map(card).join('');$('grid').querySelectorAll('img').forEach(img=>img.onerror=()=>{img.replaceWith(document.createTextNode('النقطة Media'))});
      $('empty').hidden=total>0;$('pagination').hidden=total===0;$('status').textContent=en?`${total} matching articles`:`${total} مادة مطابقة`;
      $('page-status').textContent=en?`Page ${page} of ${Math.max(1,Math.ceil(total/size))}`:`الصفحة ${page} من ${Math.max(1,Math.ceil(total/size))}`;$('previous').disabled=page<=1;$('next').disabled=page*size>=total;
      const values=[$('query').value,label(categories,$('category').value),label(types,$('type').value),$('writer').value,dates.from,dates.to].filter(Boolean);$('active-filters').innerHTML=values.map(v=>`<span class="chip">${esc(v)}</span>`).join('');syncURL();
    }catch(error){if(current!==sequence)return;$('status').textContent=en?'The archive could not be loaded. Please try again.':'تعذر تحميل الأرشيف. جرّب مرة ثانية.';$('retry').hidden=false;$('grid').innerHTML='';$('empty').hidden=true;$('pagination').hidden=true}
    finally{clearTimeout(timer);if(current===sequence)$('results').setAttribute('aria-busy','false')}
  }
  $('filters').onsubmit=e=>{e.preventDefault();page=1;load()};$('retry').onclick=load;
  $('year').onchange=$('month').onchange=()=>{$('from').value='';$('to').value=''};
  $('from').onchange=$('to').onchange=()=>{$('year').value='';$('month').value=''};
  $('reset').onclick=()=>{HTMLFormElement.prototype.reset.call($('filters'));page=1;load()};
  $('previous').onclick=()=>{if(page>1){page--;load();$('results').focus()}};$('next').onclick=()=>{if(page*size<total){page++;load();$('results').focus()}};
  $('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('share').textContent=en?'Link copied':'تم نسخ الرابط'}catch{$('status').textContent=en?'Copy the address from your browser.':'انسخ الرابط من شريط المتصفح.'}};
  load();
})();
