(() => {
  const config = window.ALNUQTA_SUPABASE_PUBLIC || {};
  const url = config.url || '';
  const key = config.anonKey || '';

  if (!url || !key) {
    console.warn('Alnuqta public Supabase feed is not configured yet.');
    return;
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json'
  };

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return new Intl.DateTimeFormat('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  };

  const labels = {
    investigation: 'تحقيق استقصائي', report: 'تقرير', news: 'خبر', analysis: 'تحليل',
    interview: 'مقابلة', 'human-story': 'قصة إنسانية', video: 'فيديو', gallery: 'معرض صور'
  };

  const card = (post) => {
    const section = labels[post.section] || 'مادة صحفية';
    const videoBadge = post.section === 'video' || (Array.isArray(post.videos) && post.videos.length) ? '▶ ' : '';
    const excerpt = post.excerpt || post.subtitle || 'مادة منشورة من غرفة أخبار النقطة.';
    const cover = post.cover_image_url || post.image || (Array.isArray(post.gallery) && post.gallery[0]?.url) || '';
    const image = cover
      ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(post.image_alt || post.title)}" class="w-full h-44 object-cover rounded-lg mb-4" loading="lazy">`
      : '';
    return `<article class="bg-navy-card border border-navy-light hover:border-brandRed/50 rounded-xl p-5 flex flex-col justify-between transition duration-300 group shadow-lg">
      <div class="space-y-3">${image}<div class="flex items-center justify-between gap-3 text-xs"><span class="bg-brandRed/20 text-red-300 font-cairo font-bold px-2.5 py-0.5 rounded border border-brandRed/30">${videoBadge}${escapeHtml(section)}</span><span class="text-gray-300 font-mono">${formatDate(post.published_at || post.date || post.created_at)}</span></div>
      <h3 class="font-cairo font-bold text-base text-white group-hover:text-red-400 transition">${escapeHtml(post.title)}</h3>
      <p class="text-xs text-gray-200 font-tajawal line-clamp-3 leading-relaxed">${escapeHtml(excerpt)}</p></div>
      <div class="pt-4 mt-4 border-t border-navy-light/60 flex items-center justify-between gap-3"><a href="newsroom.html?slug=${encodeURIComponent(post.slug)}" class="text-xs font-cairo font-bold text-white group-hover:text-red-400 flex items-center gap-1">قراءة المادة <i data-lucide="arrow-left" class="w-3.5 h-3.5" aria-hidden="true"></i></a><span class="text-[11px] text-gray-300 font-cairo">${post.reading_time ? `${escapeHtml(post.reading_time)} دقائق` : 'غرفة الأخبار'}</span></div>
    </article>`;
  };

  const render = (posts) => {
    const grid = document.getElementById('homepage-feed');
    const hero = document.getElementById('homepage-featured');
    if (!grid || !hero) return;
    if (!posts.length) {
      grid.innerHTML = '<div class="md:col-span-2 lg:col-span-3 bg-navy-card border border-navy-light rounded-xl p-8 text-center"><h3 class="font-cairo font-bold text-lg">لا توجد مواد منشورة حالياً</h3><p class="text-gray-300 mt-2">تظهر المواد هنا تلقائياً بعد اعتمادها ونشرها من غرفة الأخبار.</p></div>';
      return;
    }
    const featured = posts[0];
    const rest = posts.slice(0, 6);
    const cover = featured.cover_image_url || featured.image || featured.gallery?.[0]?.url || '';
    hero.innerHTML = `<div class="grid lg:grid-cols-2 gap-8 items-center"><div><p class="text-red-400 font-cairo font-bold text-sm">الأحدث · ${escapeHtml(labels[featured.section] || 'مادة صحفية')}</p><h1 class="font-cairo font-black text-3xl sm:text-5xl mt-3 leading-tight">${escapeHtml(featured.title)}</h1><p class="text-gray-300 mt-5 leading-8">${escapeHtml(featured.excerpt || featured.subtitle || 'مادة منشورة من غرفة أخبار النقطة.')}</p><div class="flex flex-wrap gap-4 items-center mt-7"><a href="newsroom.html?slug=${encodeURIComponent(featured.slug)}" class="inline-flex items-center gap-2 bg-brandRed hover:bg-brandRed-hover px-6 py-3 rounded-lg font-cairo font-bold">قراءة المادة <i data-lucide="arrow-left" class="w-4 h-4"></i></a><span class="text-sm text-gray-400">${formatDate(featured.published_at || featured.created_at)}</span></div></div>${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(featured.image_alt || featured.title)}" class="w-full h-72 lg:h-96 object-cover rounded-xl" loading="eager">` : ''}</div>`;
    grid.innerHTML = rest.map(card).join('');
    if (window.lucide) window.lucide.createIcons();
  };

  // Do not order by optional columns; only request published rows.
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/articles?select=*&status=eq.published`;

  fetch(endpoint, { headers, cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Supabase feed request failed: ${response.status}`);
      return response.json();
    })
    .then((posts) => {
      if (!Array.isArray(posts)) return;
      posts = posts.filter(post => String(post.title || '').trim()).sort((a,b)=>new Date(b.published_at||b.updated_at||b.created_at||0)-new Date(a.published_at||a.updated_at||a.created_at||0));
      posts = posts.map((post, index) => ({
        ...post,
        slug: String(post.slug || post.id || `published-${index}`)
      }));
      render(posts);
    })
    .catch((error) => {
      const grid = document.getElementById('homepage-feed');
      if (grid) grid.innerHTML = '<div class="md:col-span-2 lg:col-span-3 bg-navy-card border border-red-500/30 rounded-xl p-8 text-center"><h3 class="font-cairo font-bold">تعذر تحميل المواد الآن</h3><p class="text-gray-300 mt-2">يمكنك متابعة المواد المنشورة من غرفة الأخبار والمحاولة لاحقاً.</p><a href="newsroom.html" class="inline-block text-red-400 mt-4 hover:underline">فتح غرفة الأخبار</a></div>';
      console.warn('Supabase public feed unavailable.', error);
    });
})();
