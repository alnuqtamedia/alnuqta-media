(() => {
  const config = window.ALNUQTA_SUPABASE || {};
  const url = config.url || '';
  const key = config.anonKey || '';
  const statusEl = document.getElementById('status');

  if (!url || !key) {
    if (statusEl) statusEl.textContent = 'مصدر غرفة الأخبار غير مفعّل حاليًا.';
    return;
  }

  const fields = 'id,slug,title,subtitle,excerpt,section,status,date,published_at,author,editor,reading_time,image,image_alt,body,methodology,right_of_reply,sources,documents';
  const endpoint = `${url.replace(/\/$/,'')}/rest/v1/articles?select=${encodeURIComponent(fields)}&status=eq.published&order=published_at.desc.nullslast,date.desc`;

  fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json'
    },
    cache: 'no-store'
  })
    .then(r => {
      if (!r.ok) throw new Error(`Supabase newsroom request failed: ${r.status}`);
      return r.json();
    })
    .then(data => {
      if (!Array.isArray(data)) throw new Error('Supabase returned an invalid newsroom response.');

      window.__ALNUQTA_SUPABASE_POSTS__ = data;

      if (!data.length) {
        if (statusEl) statusEl.textContent = 'تم الاتصال بقاعدة البيانات، لكن لم تُرجع مواد منشورة.';
        return;
      }

      if (typeof posts !== 'undefined') {
        posts = data;
        render();
        const slug = new URLSearchParams(location.search).get('slug');
        if (slug) openPost(slug, false);
      }
    })
    .catch(e => {
      console.warn('Supabase newsroom feed unavailable.', e);
      if (statusEl) statusEl.textContent = `تعذر تحميل المواد من قاعدة البيانات: ${e.message}`;
    });
})();
