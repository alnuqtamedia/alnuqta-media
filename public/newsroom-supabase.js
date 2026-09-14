(() => {
  const config = window.ALNUQTA_SUPABASE_PUBLIC || {};
  const url = config.url || '';
  const key = config.anonKey || '';
  if (!url || !key) return;

  const fields = 'id,slug,title,subtitle,excerpt,section,status,date,published_at,author,editor,reading_time,image,image_alt,body,methodology,right_of_reply,sources,documents';
  const endpoint = `${url.replace(/\/$/,'')}/rest/v1/articles?select=${encodeURIComponent(fields)}&status=eq.published&order=published_at.desc.nullslast,date.desc`;
  const normalize = value => Array.isArray(value) ? value : [];

  fetch(endpoint, { headers: { apikey:key, Authorization:`Bearer ${key}`, Accept:'application/json' }, cache:'no-store' })
    .then(r => { if (!r.ok) throw new Error(`Supabase newsroom request failed: ${r.status}`); return r.json(); })
    .then(data => {
      if (!Array.isArray(data)) return;
      if (typeof posts !== 'undefined') {
        posts = data;
        render();
        const slug = new URLSearchParams(location.search).get('slug');
        if (slug) openPost(slug, false);
      }
      window.__ALNUQTA_SUPABASE_POSTS__ = data;
    })
    .catch(e => console.warn('Supabase newsroom feed unavailable; keeping static feed.', e));
})();
