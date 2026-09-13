(() => {
  const sectionLabels = {
    investigation: 'تحقيق استقصائي',
    report: 'تقرير',
    news: 'خبر',
    analysis: 'تحليل',
    interview: 'مقابلة',
    'human-story': 'قصة إنسانية',
    video: 'فيديو',
    gallery: 'معرض صور'
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

  const publishedPosts = (payload) => (Array.isArray(payload?.posts) ? payload.posts : [])
    .filter((post) => post && post.status === 'published' && post.title && post.slug)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const card = (post) => {
    const section = sectionLabels[post.section] || 'مادة صحفية';
    const excerpt = post.excerpt || post.subtitle || 'مادة منشورة من غرفة أخبار النقطة.';
    const image = post.image ? `<img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.image_alt || post.title)}" class="w-full h-44 object-cover rounded-lg mb-4" loading="lazy">` : '';
    return `<article class="bg-navy-card border border-navy-light hover:border-brandRed/50 rounded-xl p-5 flex flex-col justify-between transition duration-300 group shadow-lg">
      <div class="space-y-3">${image}<div class="flex items-center justify-between gap-3 text-xs"><span class="bg-brandRed/20 text-red-300 font-cairo font-bold px-2.5 py-0.5 rounded border border-brandRed/30">${escapeHtml(section)}</span><span class="text-gray-300 font-mono">${formatDate(post.date)}</span></div>
      <h3 class="font-cairo font-bold text-base text-white group-hover:text-red-400 transition">${escapeHtml(post.title)}</h3>
      <p class="text-xs text-gray-200 font-tajawal line-clamp-3 leading-relaxed">${escapeHtml(excerpt)}</p></div>
      <div class="pt-4 mt-4 border-t border-navy-light/60 flex items-center justify-between gap-3"><a href="newsroom.html?slug=${encodeURIComponent(post.slug)}" class="text-xs font-cairo font-bold text-white group-hover:text-red-400 flex items-center gap-1">قراءة المادة <i data-lucide="arrow-left" class="w-3.5 h-3.5" aria-hidden="true"></i></a><span class="text-[11px] text-gray-300 font-cairo">${post.reading_time ? `${escapeHtml(post.reading_time)} دقائق` : 'غرفة الأخبار'}</span></div>
    </article>`;
  };

  const updateHomepage = (posts) => {
    const headings = [...document.querySelectorAll('#section-home h2')];
    const heading = headings.find((el) => el.textContent.includes('أحدث التحقيقات الاستقصائية'));
    const grid = heading?.closest('section')?.querySelector('.grid');
    if (!grid) return;

    if (!posts.length) {
      grid.innerHTML = '<div class="md:col-span-2 lg:col-span-3 bg-navy-card border border-navy-light rounded-xl p-6 text-center text-sm text-gray-300 font-tajawal">لا توجد مواد منشورة حاليًا.</div>';
      return;
    }

    grid.innerHTML = posts.slice(0, 6).map(card).join('');
    if (window.lucide) window.lucide.createIcons();
  };

  fetch('data/posts.json', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Content index request failed: ${response.status}`);
      return response.json();
    })
    .then((payload) => updateHomepage(publishedPosts(payload)))
    .catch((error) => console.warn('Homepage newsroom feed unavailable; keeping editorial fallback.', error));
})();
