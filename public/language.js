(() => {
  const params = new URLSearchParams(location.search);
  let stored; try { stored = localStorage.getItem('alnuqta-language'); } catch {}
  const language = (params.get('lang') || stored) === 'en' ? 'en' : 'ar';
  window.ALNUQTA_LANGUAGE = language;
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
  const dictionary = {
    'أخبار العالم':'World News','اقتصاد':'Economy','أخبار العراق':'Iraq News','الفن':'Arts','المنوعات':'Miscellaneous','مقالات الرأي':'Opinion Articles','مقال رأي':'Opinion article','تقارير':'Reports','آخر الأخبار':'Latest News','المزيد':'More','عرض الأقسام':'Show sections',
    'الأرشيف':'Archive','النقطة':'Alnuqta','الرئيسية':'Home','غرفة الأخبار':'Newsroom','كل المواد':'All articles',
    'السياسة':'Politics','الاقتصاد والمال العام':'Economy and public funds',
    'التحقيقات الميدانية والاجتماعية':'Field and social investigations','ثقافة وفنون':'Culture and arts',
    'سياحة وسفر':'Travel and tourism','الرياضة':'Sports','قصص إنسانية':'Human stories',
    'التحقيقات':'Investigations','الوثائق':'Documents','عن المنصة':'About us','عن النقطة':'About Alnuqta',
    'إرسال معلومة':'Submit a tip','تواصل معنا':'Contact us','الخصوصية':'Privacy',
    'سياسة التحرير':'Editorial policy','التصحيحات':'Corrections',
    'منصة إعلامية عراقية مستقلة':'An independent Iraqi media platform',
    'نحقق • نكشف • نوصل':'Investigate • Reveal • Inform',
    'من غرفة أخبار النقطة':'From the Alnuqta newsroom','صحافة تتحقق قبل أن تنشر':'Journalism that verifies before publishing',
    'نعرض هنا أحدث مادة منشورة ومعتمدة تحريرياً. لا تظهر المسودات أو المواد قيد المراجعة في الموقع العام.':'Our latest published, editorially approved article. Drafts and articles under review do not appear on the public website.',
    'تصفح غرفة الأخبار':'Browse the newsroom','أحدث المواد المنشورة':'Latest published articles',
    'محتوى حي من نظام التحرير، بحسب تاريخ النشر.':'Live editorial content, ordered by publication date.',
    'عرض جميع المواد':'View all articles','جارٍ تحميل المواد المنشورة…':'Loading published articles…',
    'التحقيقات الاستقصائية':'Investigative journalism','الملفات المنشورة والمعتمدة من غرفة الأخبار.':'Published and approved newsroom investigations.',
    'أرشيف الوثائق':'Document archive','الوثائق المرتبطة بمواد منشورة فقط، مع وصف واضح لحالتها.':'Documents linked to published articles, with their status clearly described.',
    'هل تملك معلومة تهم الرأي العام؟':'Have information in the public interest?',
    'استخدم نموذج الاستلام المخصص للمعلومات العامة. لا ترسل معلومات قد تعرّضك للخطر أو تكشف هويتك.':'Use our form for general information. Do not send information that could put you at risk or reveal your identity.',
    'فتح نموذج الإرسال':'Open the submission form','نشرة النقطة البريدية':'Alnuqta newsletter',
    'بعد الاشتراك نرسل رابط تأكيد إلى بريدك. لن يبدأ الاشتراك قبل الضغط عليه.':'We will email you a confirmation link. Your subscription starts only after you click it.',
    'الموقع':'Website','تسجيل الاشتراك':'Subscribe','بريدك الإلكتروني':'Your email address',
    'أوافق على استخدام بريدي لإرسال نشرة النقطة، ويمكنني إلغاء الاشتراك لاحقاً.':'I agree to receive the Alnuqta newsletter. I can unsubscribe at any time.',
    'أوافق على استلام نشرة النقطة ويمكنني إلغاء الاشتراك لاحقاً.':'I agree to receive the Alnuqta newsletter. I can unsubscribe at any time.',
    'جميع الحقوق محفوظة © 2026':'All rights reserved © 2026',
    '© النقطة — منصة إعلامية استقصائية مستقلة.':'© Alnuqta — an independent investigative media platform.',
    'المواد المنشورة':'Published articles','تُعرض هنا المواد التي وصلت إلى حالة النشر من نظام المحتوى.':'Articles published by our editorial team appear here.',
    'كل الأقسام':'All sections','كل الأنواع الصحفية':'All article types','تحقيق استقصائي':'Investigation',
    'تقرير':'Report','خبر':'News','تحليل':'Analysis','مقابلة':'Interview','قصة إنسانية':'Human story',
    'فيديو':'Video','الفيديو':'Video','معرض صور':'Photo gallery','معرض الصور':'Photo gallery',
    'جاري تحميل المواد...':'Loading articles…','جاري تحميل المواد من قاعدة البيانات...':'Loading articles…',
    '← العودة إلى غرفة الأخبار':'← Back to the newsroom',
    'سجّل بريدك ليصلك رابط التأكيد عند إطلاق النشرة الرسمية.':'Enter your email to receive a confirmation link when the newsletter launches.',
    'ابحث في العناوين والملخصات...':'Search titles and summaries…','البحث في المواد':'Search articles',
    'تصفية حسب النوع الصحفي':'Filter by article type','أقسام غرفة الأخبار':'Newsroom sections',
    'عرض أقسام غرفة الأخبار':'Show newsroom sections','فتح قائمة التنقل':'Open navigation',
    'التنقل الرئيسي':'Main navigation','التنقل للموبايل':'Mobile navigation','روابط السياسات':'Policy links',
    'أحدث مادة':'Latest article','أحدث المواد':'Latest articles','أقسام النقطة':'Alnuqta sections',
    'تصفح المواد المنشورة حسب الملف التحريري':'Browse published articles by editorial section',
    'كل المواد ←':'All articles →','قراءة المادة ←':'Read article →','قراءة المادة':'Read article',
    'أحدث الأخبار والتقارير والتحليلات المنشورة من غرفة الأخبار':'Latest published news, reports and analysis',
    'عرض غرفة الأخبار كاملة ←':'View the newsroom →','بانتظار أول مادة':'No articles yet',
    'مادة واحدة منشورة':'One published article','لا توجد مواد منشورة حالياً.':'No published articles yet.',
    'لا توجد مواد منشورة مطابقة.':'No matching published articles.',
    'الكاتب / المعد':'Writer','المحرر':'Editor','المصور':'Photographer','تصوير الفيديو':'Videography',
    'المصمم':'Designer','وقت القراءة':'Reading time','المنهجية':'Methodology','حق الرد':'Right of reply',
    'المصادر':'Sources','شارك المادة':'Share this article','نسخ الرابط':'Copy link',
    'انشر رابط المادة مباشرة على المنصات التي تدعم مشاركة الروابط.':'Share the article link on these platforms.',
    'مشاركة على فيسبوك':'Share on Facebook','مشاركة على إكس':'Share on X','مشاركة على واتساب':'Share on WhatsApp','مشاركة على تيليغرام':'Share on Telegram',
    'مشاهدة الفيديو':'Watch video','النقطة Media | منصة إعلامية استقصائية عراقية':'Alnuqta Media | Iraqi investigative journalism',
    'غرفة الأخبار | النقطة':'Newsroom | Alnuqta'
  };
  Object.assign(dictionary, window.ALNUQTA_PAGE_TRANSLATIONS || {});
  function translate(value) {
    const clean = value.trim();
    if (clean.startsWith('· ') && dictionary[clean.slice(2)]) return value.replace(clean, '· '+dictionary[clean.slice(2)]);
    if (clean.startsWith('قراءة أحدث مادة: ')) return value.replace('قراءة أحدث مادة: ', 'Read latest article: ');
    if (clean.startsWith('قراءة ')) return value.replace('قراءة ', 'Read ');
    if (dictionary[clean]) return value.replace(clean, dictionary[clean]);
    const total = clean.match(/^عدد (التحقيقات|الوثائق) المنشورة: (\d+)$/); if (total) return `${total[1]==='الوثائق'?'Documents':'Investigations'}: ${total[2]}`;
    const minutes = clean.match(/^(\d+) (دقيقة|دقائق قراءة)$/); if (minutes) return `${minutes[1]} min read`;
    const count = clean.match(/^عدد المواد: (\d+)$/); if (count) return `Articles: ${count[1]}`;
    const published = clean.match(/^(\d+) مواد منشورة$/); if (published) return `${published[1]} published articles`;
    return value;
  }
  function apply(root) {
    if (language !== 'en') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest('script,style,.article-body,[data-language-toggle],[data-original-language]')) continue;
      const translated = translate(node.nodeValue); if (translated !== node.nodeValue) node.nodeValue = translated;
    }
    root.querySelectorAll?.('[placeholder],[aria-label]').forEach(el => {
      for (const attr of ['placeholder','aria-label']) if (el.hasAttribute(attr)) {
        const value = el.getAttribute(attr), translated = translate(value);
        if (value !== translated) el.setAttribute(attr, translated);
      }
    });
  }
  window.ALNUQTA_I18N = {language, translate, async articles(rows) {
    if (language !== 'en' || !rows.length) return rows;
    const config = window.ALNUQTA_SUPABASE_PUBLIC || {};
    try {
      const url = new URL(config.url + '/rest/v1/article_translations');
      url.searchParams.set('select','*'); url.searchParams.set('language','eq.en'); url.searchParams.set('status','eq.published');
      const response = await fetch(url, {headers:{apikey:config.anonKey,Authorization:`Bearer ${config.anonKey}`}});
      if (!response.ok) throw new Error('Translations unavailable');
      const versions = await response.json();
      return rows.map(row => {
        const version = versions.find(v => v.status === 'published' && v.language === 'en' && v.article_id === row.id && Date.parse(v.source_updated_at) === Date.parse(row.updated_at));
        return version ? {...row,...Object.fromEntries(['title','subtitle','excerpt','body','methodology','right_of_reply','cover_image_caption','cover_image_credit'].map(field => [field,version[field]])),translation_available:true} : {...row,translation_available:false};
      });
    } catch (error) { console.warn(error.message); return rows.map(row=>({...row,translation_available:false})); }
  }};
  document.addEventListener('DOMContentLoaded', () => {
    const targets = Array.from(document.querySelectorAll('header nav'));
    if(document.getElementById('language')) targets.length=0;
    if (!targets.length && !document.getElementById('language')) targets.push(document.querySelector('main'));
    for (const nav of targets.filter(Boolean)) {
      const button = document.createElement('button'); button.type='button';button.dataset.languageToggle='';
      button.textContent=language==='en'?'العربية':'English';button.setAttribute('aria-label',language==='en'?'Switch to Arabic':'Switch to English');
      button.style.cssText='border:1px solid currentColor;border-radius:8px;padding:6px 12px;font-weight:bold';
      button.onclick=()=>{const next=language==='en'?'ar':'en';try{localStorage.setItem('alnuqta-language',next)}catch{}const url=new URL(location.href);url.searchParams.set('lang',next);location.href=url.href;};
      nav.append(button);
    }
    apply(document.documentElement);
    new MutationObserver(records=>{
      const roots=new Set();
      for(const record of records){
        if(record.type==='characterData'){const node=record.target;if(!node.parentElement?.closest('script,style,.article-body,[data-language-toggle],[data-original-language]')){const text=translate(node.nodeValue);if(text!==node.nodeValue)node.nodeValue=text;}}
        else for(const node of record.addedNodes){if(node.nodeType===1)roots.add(node);else if(node.nodeType===3&&node.parentElement)roots.add(node.parentElement);}
      }
      for(const root of roots)apply(root);
    }).observe(document.body,{childList:true,subtree:true,characterData:true});
    document.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(!link||link.hasAttribute('download'))return;const url=new URL(link.href);if(url.origin===location.origin&&!url.pathname.includes('/admin/')&&/\.html$|\/$/.test(url.pathname)){url.searchParams.set('lang',language);link.href=url.href;}});
  });
})();
