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
    const excerpt = post.excerpt || post.subtitle || 'مادة منشورة من غرفة أخبار النقطة.';
    const image = post.image
      ? `<img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.image_alt || post.title)}" class="w-full h-44 object-cover rounded-lg mb-4" loading="lazy">`
      : '';
    return `<article class="bg-navy-card border border-navy-light hover:border-brandRed/50 rounded-xl p-5 flex flex-col justify-between transition duration-300 group shadow-lg">
      <div class="space-y-3">${image}<div class="flex items-center justify-between gap-3 text-xs"><span class="bg-brandRed/20 text-red-300 font-cairo font-bold px-2.5 py-0.5 rounded border border-brandRed/30">${escapeHtml(section)}</span><span class="text-gray-300 font-mono">${formatDate(post.date || post.published_at)}</span></div>
      <h3 class="font-cairo font-bold text-base text-white group-hover:text-red-400 transition">${escapeHtml(post.title)}</h3>
      <p class="text-xs text-gray-200 font-tajawal line-clamp-3 leading-relaxed">${escapeHtml(excerpt)}</p></div>
      <div class="pt-4 mt-4 border-t border-navy-light/60 flex items-center justify-between gap-3"><a href="newsroom.html?slug=${encodeURIComponent(post.slug)}" class="text-xs font-cairo font-bold text-white group-hover:text-red-400 flex items-center gap-1">قراءة المادة <i data-lucide="arrow-left" class="w-3.5 h-3.5" aria-hidden="true"></i></a><span class="text-[11px] text-gray-300 font-cairo">${post.reading_time ? `${escapeHtml(post.reading_time)} دقائق` : 'غرفة الأخبار'}</span></div>
    </article>`;
  };

  const render = (posts) => {
    const headings = [...document.querySelectorAll('#section-home h2')];
    const heading = headings.find((el) => el.textContent.includes('أحدث التحقيقات الاستقصائية'));
    const grid = heading?.closest('section')?.querySelector('.grid');
    if (!grid) return;
    if (!posts.length) return;
    grid.innerHTML = posts.slice(0, 6).map(card).join('');
    if (window.lucide) window.lucide.createIcons();
  };

  const select = 'id,slug,title,subtitle,excerpt,section,status,date,published_at,author,editor,reading_time,image,image_alt,body,methodology,right_of_reply,sources,documents';
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/articles?select=${encodeURIComponent(select)}&status=eq.published&order=published_at.desc.nullslast,date.desc&limit=6`;

  fetch(endpoint, { headers, cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Supabase feed request failed: ${response.status}`);
      return response.json();
    })
    .then((posts) => render(Array.isArray(posts) ? posts : []))
    .catch((error) => console.warn('Supabase public feed unavailable; keeping static newsroom feed.', error));
})();
