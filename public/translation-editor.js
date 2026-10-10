(() => {
  const config=window.ALNUQTA_SUPABASE_PUBLIC||{}, client=supabase.createClient(config.url,config.anonKey);
  const $=id=>document.getElementById(id), fields=['title','subtitle','excerpt','body','methodology','right_of_reply','cover_image_caption','cover_image_credit'];
  let rows=[],selected=null,role='',sequence=0;
  async function selectArticle() {
    const request=++sequence; $('form').hidden=true;selected=rows.find(row=>row.id===$('article').value);if(!selected)return;
    $('original').textContent=[selected.title,selected.subtitle,selected.excerpt,selected.body,selected.methodology,selected.right_of_reply].filter(Boolean).join('\n\n');
    $('message').textContent='جاري تحميل الترجمة…';
    const {data,error}=await client.from('article_translations').select('*').eq('article_id',selected.id).eq('language','en').maybeSingle();
    if(request!==sequence)return;if(error){$('message').textContent='تعذر تحميل الترجمة: '+error.message;return;}
    fields.forEach(field=>$(field).value=data?.[field]||'');$('state').value=data?.status||'draft';$('reviewed').checked=false;
    const educationFix=new URLSearchParams(location.search).get('education-fix')==='1'&&selected.id==='38aa6367-6dfa-43ad-b4f0-2160cd98fd28';
    if(educationFix&&data&&Date.parse(data.source_updated_at)===Date.parse(selected.updated_at)){
      fields.forEach(field=>$(field).value=$(field).value.replace(/Al-Nugta/g,'Alnuqta').replace(/Remodial/g,'Remedial'));
      if(selected.cover_image_url==='https://upload.wikimedia.org/wikipedia/commons/3/37/DIS_classroom.jpg'){
        $('cover_image_caption').value='Archival photograph of a classroom at Duhok International School, 21 November 2017. Used for illustration; it does not document the cases discussed in this report.';
        $('cover_image_credit').value='Firm Foundations Duhok / Wikimedia Commons — CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:DIS_classroom.jpg — https://creativecommons.org/licenses/by-sa/4.0/ — Original file unchanged';
      }
    }
    $('form').hidden=false;$('message').textContent=data&&Date.parse(data.source_updated_at)!==Date.parse(selected.updated_at)?'تغير الأصل العربي. انتظر اكتمال الترجمة وأعد فتح المادة قبل تطبيق التصحيحات.':educationFix&&data?'تم تجهيز التصحيحات في الحقول فقط؛ راجع النص كاملاً ثم احفظه. لم تُحفظ بعد.':'';
  }
  $('article').onchange=selectArticle;
  $('form').onsubmit=async event=>{
    event.preventDefault(); if(!selected)return;const state=$('state').value;
    if(state==='published'){
      if(role!=='owner'){ $('message').textContent='نشر الترجمة للـOwner فقط.';return; }
      if(!$('reviewed').checked){$('message').textContent='أكد المراجعة التحريرية قبل نشر الترجمة.';return;}
      const {data,error}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if(error||data.currentLevel!=='aal2'){location.href='mfa.html?next=translations.html';return;}
      if(!fields.every(field=>!selected[field]||$(field).value.trim())){$('message').textContent='ترجم جميع حقول النص العربي غير الفارغة قبل النشر.';return;}
    }
    const button=$('form').querySelector('button');button.disabled=true;$('message').textContent='جاري الحفظ…';
    try{
      const {data:current,error:readError}=await client.from('articles').select('updated_at').eq('id',selected.id).single();if(readError)throw readError;
      if(Date.parse(current.updated_at)!==Date.parse(selected.updated_at))throw new Error('تغير الأصل أثناء المراجعة. أعد فتح المادة قبل حفظ الترجمة.');
      const payload={article_id:selected.id,language:'en',status:state,source_updated_at:selected.updated_at,updated_at:new Date().toISOString(),...Object.fromEntries(fields.map(field=>[field,$(field).value.trim()||null]))};
      const {error}=await client.from('article_translations').upsert(payload,{onConflict:'article_id,language'});if(error)throw error;
      $('message').textContent=state==='published'?'تم اعتماد ونشر النسخة الإنكليزية.':'تم حفظ الترجمة؛ لم تُنشر للجمهور.';
    }catch(error){$('message').textContent='تعذر الحفظ: '+error.message;}finally{button.disabled=false;}
  };
  (async()=>{
    const {data:{user},error}=await client.auth.getUser();if(error||!user){location.href='index.html';return;}
    const {data:profile}=await client.from('profiles').select('role').eq('id',user.id).single();role=profile?.role;
    if(!['owner','editor'].includes(role)){$('message').textContent='هذه الصفحة للـOwner والمحرر فقط.';return;}
    if(role!=='owner')$('state').querySelector('[value="published"]').remove();
    const {data,error:loadError}=await client.from('articles').select('*').order('created_at',{ascending:false});if(loadError){$('message').textContent=loadError.message;return;}
    rows=(data||[]).filter(row=>row.title?.trim());$('article').replaceChildren(...rows.map(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=row.title;return option;}));const requested=new URLSearchParams(location.search).get('article');if(rows.some(row=>row.id===requested))$('article').value=requested;await selectArticle();
  })().catch(error=>{$('message').textContent=error.message;});
})();
