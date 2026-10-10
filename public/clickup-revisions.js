(() => {
 const config=window.ALNUQTA_SUPABASE_PUBLIC||{},client=supabase.createClient(config.url,config.anonKey),$=id=>document.getElementById(id);
 const fields={title:'العنوان',subtitle:'العنوان الفرعي',excerpt:'الملخص',body:'النص الكامل',sources:'المصادر',section:'النوع الصحفي',category:'القسم',methodology:'المنهجية',right_of_reply:'حق الرد',cover_image_url:'رابط الصورة',cover_image_caption:'وصف الصورة',cover_image_credit:'حقوق الصورة'};
 let authorized=false,role='',userId='';
 function text(value){return Array.isArray(value)?value.join('\n'):String(value??'');}
 function snapshot(record){return Object.entries(fields).map(([key,label])=>label+'\n'+text(record[key])).join('\n\n');}
 async function load(){
  if(!authorized)return;$('refresh').disabled=true;$('message').textContent='جاري تحميل المقترحات…';
  try{
   const {data:rows,error}=await client.from('article_pending_revisions').select('id,article_id,status,proposed_changes,created_at').eq('status','pending').order('created_at',{ascending:false}).limit(100);if(error)throw error;
   const ids=[...new Set((rows||[]).map(row=>row.article_id))];let articles=[];
   if(ids.length){const result=await client.from('articles').select('*').in('id',ids);if(result.error)throw result.error;articles=result.data||[];}
   const byId=new Map(articles.map(a=>[a.id,a]));$('revisions').replaceChildren();
   for(const row of rows||[]){
    const current=byId.get(row.article_id);if(!current)continue;
    const article=document.createElement('article'),heading=document.createElement('h2'),date=document.createElement('p'),columns=document.createElement('div');
    heading.textContent=current.title||'مادة بدون عنوان';date.textContent='وصل المقترح: '+new Date(row.created_at).toLocaleString('ar-IQ');columns.className='columns';
    for(const [label,record] of [['النسخة الحالية',current],['التعديل المقترح',row.proposed_changes||{}]]){
     const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=label;pre.textContent=snapshot(record);details.append(summary,pre);columns.append(details);
    }
    const link=document.createElement('a');link.href='dashboard.html?article='+encodeURIComponent(row.article_id);link.textContent='فتح المادة للمراجعة والتعديل';
    article.append(heading,date,columns,link);
    if(role==='owner'){
      const close=document.createElement('button');close.textContent='إغلاق المقترح دون تطبيق';close.onclick=async()=>{
       if(!confirm('إغلاق هذا المقترح دون تطبيقه على المادة المنشورة؟'))return;
       const {data:aal,error:aalError}=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(aalError||aal?.currentLevel!=='aal2'){location.href='mfa.html?next=clickup-revisions.html';return;}
       close.disabled=true;const {data,error}=await client.from('article_pending_revisions').update({status:'rejected',reviewed_by:userId,reviewed_at:new Date().toISOString()}).eq('id',row.id).eq('status','pending').select('id');
       if(error||!data?.length){$('message').textContent='لم يُغلق المقترح: '+(error?.message||'تغيرت حالته؛ حدّث القائمة.');close.disabled=false;return;}await load();
      };article.append(document.createElement('br'),close);
    }
    $('revisions').append(article);
   }
   $('message').textContent=rows?.length?'المقترحات بانتظار المراجعة: '+rows.length:'لا توجد تعديلات مقترحة بانتظار المراجعة.';
  }catch(error){$('message').textContent='تعذر تحميل المقترحات: '+error.message;}finally{$('refresh').disabled=false;}
 }
 $('refresh').onclick=load;
 (async()=>{const {data:{user},error}=await client.auth.getUser();if(error||!user){location.href='index.html';return;}
 const {data:profile,error:profileError}=await client.from('profiles').select('role').eq('id',user.id).single();
 if(profileError||!['owner','editor'].includes(profile?.role)){$('message').textContent='هذه الصفحة للـOwner والمحرر فقط.';$('refresh').hidden=true;return;}role=profile.role;userId=user.id;authorized=true;await load();})().catch(error=>{$('message').textContent=error.message;});
})();