'use strict';
(async()=>{
const $=id=>document.getElementById(id),config=window.ALNUQTA_SUPABASE_PUBLIC||{};
if(!config.url||!config.anonKey){$('status').textContent='إعداد الاتصال غير متوفر.';return;}
const client=supabase.createClient(config.url,config.anonKey);
const {data:{session}}=await client.auth.getSession();
if(!session){location.href='./index.html';return;}
const {data:role,error:roleError}=await client.rpc('current_user_role');
if(roleError||role!=='owner'){$('status').textContent='هذه الصفحة متاحة للـOwner فقط.';$('load').disabled=true;return;}
const {data:aal,error:aalError}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
if(aalError||aal.currentLevel!=='aal2'){$('status').textContent='أكمل التحقق الثنائي ثم ارجع لهذه الصفحة.';const a=document.createElement('a');a.href='./mfa.html';a.textContent='فتح التحقق الثنائي';$('status').append(' ',a);$('load').disabled=true;return;}
let before=null,active=null,busy=false;
const {data:articles,error}=await client.from('articles').select('id,title').order('created_at',{ascending:false}).limit(1000);
$('article').replaceChildren(new Option('اختر المادة',''));
if(error){$('status').textContent='تعذر تحميل القائمة. يمكن استخدام معرّف المادة.';}
else for(const a of articles||[])$('article').add(new Option(a.title||a.id,a.id));
const params=new URLSearchParams(location.search);if(params.get('id'))$('uuid').value=params.get('id');
async function load(append=false){
if(busy)return;const id=append?active:($('uuid').value.trim()||$('article').value);
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){$('status').textContent='اختر مادة أو أدخل معرّفاً صحيحاً.';return;}
busy=true;$('load').disabled=true;$('more').disabled=true;
if(!append){before=null;active=id;$('results').replaceChildren();}
$('status').textContent='جاري تحميل النسخ…';
try{
const {data,error}=await client.rpc('owner_content_revisions',{p_article_id:id,p_limit:20,p_before_id:before});
if(error)throw error;
for(const r of data||[]){
const card=document.createElement('article'),h=document.createElement('h2'),meta=document.createElement('small'),pre=document.createElement('pre'),button=document.createElement('button');
const s=r.snapshot||{};h.textContent=s.title||'نسخة مادة';meta.textContent=new Date(r.captured_at).toLocaleString('ar-IQ',{timeZone:'Asia/Baghdad'})+' — '+r.operation+' — '+r.entity+(s.language?' ('+s.language+')':'');pre.textContent=s.body||s.excerpt||'لا يوجد نص';
button.textContent='تنزيل النسخة كاملة JSON';button.type='button';button.onclick=()=>{const blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='revision-'+r.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
card.append(h,meta,pre,button);$('results').append(card);
}
if(data?.length)before=data[data.length-1].id;
$('more').hidden=(data||[]).length<20;
$('status').textContent=data?.length?'تم عرض النسخ. التوقيت: بغداد.':'لا توجد نسخ إضافية لهذه المادة.';
}catch(e){$('status').textContent='تعذر تحميل النسخ. تحقق من جلسة Owner والمصادقة الثنائية، ثم حاول مجدداً.';}
finally{busy=false;$('load').disabled=false;$('more').disabled=false;}
}
$('form').onsubmit=e=>{e.preventDefault();load();};$('more').onclick=()=>load(true);
})().catch(()=>{document.getElementById('status').textContent='تعذر تهيئة الصفحة. حدّثها وحاول مجدداً.';});
