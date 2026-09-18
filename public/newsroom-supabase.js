(() => {
  const config = window.ALNUQTA_SUPABASE_PUBLIC || {};
  const url = config.url || '';
  const key = config.anonKey || '';
  const statusEl = document.getElementById('status');

  if (!url || !key) {
    if (statusEl) statusEl.textContent = 'مصدر غرفة الأخبار غير مفعّل حاليًا.';
    return;
  }

  const endpoint = `${url.replace(/\/$/,'')}/rest/v1/articles?select=*&status=eq.published`;

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

      // Some existing Supabase rows may not have a slug. Give every published
      // row a stable browser key so the reader button can always open it.
      data = data.filter(p => String(p.title || '').trim()).sort((a,b) => new Date(b.published_at||b.updated_at||b.created_at||0)-new Date(a.published_at||a.updated_at||a.created_at||0));
      data = data.map((p, i) => ({
        ...p,
        slug: String(p.slug || p.id || `published-${i}`)
      }));

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
