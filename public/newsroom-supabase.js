(() => {
  const config = window.ALNUQTA_SUPABASE_PUBLIC || {};
  const url = config.url || '';
  const key = config.anonKey || '';
  if (!url || !key) return;

  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const labels = { investigation:'تحقيق استقصائي', report:'تقرير', news:'خبر', analysis:'تحليل', interview:'مقابلة', 'human-story':'قصة إنسانية', video:'فيديو', gallery:'معرض صور' };
  const date = v => { const d = new Date(v || ''); return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleDateString('ar-IQ',{year:'numeric',month:'long',day:'numeric'}); };
  const headers = { apikey:key, Authorization:`Bearer ${key}`, Accept:'application/json' };
  const fields = 'id,slug,title,subtitle,excerpt,section,status,date,published_at,author,editor,reading_time,image,image_alt,body,methodology,right_of_reply,sources,documents';
  const endpoint = `${url.replace(/\/$/,'')}/rest/v1/articles?select=${encodeURIComponent(fields)}&status=eq.published&order=published_at.desc.nullslast,date.desc`;

  fetch(endpoint,{headers,cache:'no-store'})
    .then(r => { if(!r.ok) throw new Error(`Supabase newsroom request failed: ${r.status}`); return r.json(); })
    .then(data => {
      if (!Array.isArray(data)) return;
      window.__ALNUQTA_SUPABASE_POSTS__ = data;
      if (typeof window.__ALNUQTA_RENDER_NEWSROOM__ === 'function') window.__ALNUQTA_RENDER_NEWSROOM__(data);
    })
    .catch(e => console.warn('Supabase newsroom feed unavailable; keeping static feed.', e));
})();
