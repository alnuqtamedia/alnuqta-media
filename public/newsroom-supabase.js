(() => {
  const config = window.ALNUQTA_SUPABASE_PUBLIC || {};
  const url = config.url || '';
  const key = config.anonKey || '';
  const statusEl = document.getElementById('status');

  if (!url || !key) {
    if (statusEl) statusEl.textContent = 'مصدر غرفة الأخبار غير مفعّل حاليًا.';
    return;
  }

  // Keep the public query schema-safe: the newsroom only needs published rows.
  const endpoint = `${url.replace(/\/$/,'')}/rest/v1/articles?select=*&status=eq.published&order=date.desc`;

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
