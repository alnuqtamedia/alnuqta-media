import fs from 'node:fs';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
const origin='https://alnuqtamedia.com';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function imageUrl(p){const value=p.cover_image_url||p.image||p.gallery?.[0]?.url||'';try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}}
export function renderArticle(template,p){
 if(p.status!=='published'||!/^[-a-zA-Z0-9]+$/.test(p.id))throw Error('Only published safe article IDs may be rendered');
 const url=origin+'/articles/'+p.id+'.html',title=p.title||'مادة صحفية',desc=String(p.excerpt||p.subtitle||p.body||'').replace(/\s+/g,' ').slice(0,240),image=imageUrl(p);
 const attrs=[['name','description',desc],['property','og:type','article'],['property','og:title',title],['property','og:description',desc],['property','og:url',url],['property','og:locale','ar_IQ'],['property','og:site_name','النقطة Media'],['name','twitter:card',image?'summary_large_image':'summary'],['name','twitter:title',title],['name','twitter:description',desc]];
 if(image)attrs.push(['property','og:image',image],['name','twitter:image',image],['property','og:image:alt',p.image_alt||title]);
 let html=template.replace(/<title>[\s\S]*?<\/title>/,'<title>'+escape(title)+' | النقطة</title>').replace(/<meta\b[^>]*(?:name="(?:description|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/g,'').replace(/<link\b[^>]*rel="canonical"[^>]*>/g,'');
 html=html.replace('<head>','<head><base href="'+origin+'/">'+attrs.map(([key,name,value])=>`<meta ${key}="${name}" content="${escape(value)}">`).join('')+'<link rel="canonical" href="'+url+'"><script>window.ALNUQTA_ARTICLE_ID='+JSON.stringify(p.id)+'</script>');
 const context={};vm.createContext(context);vm.runInContext(template.slice(template.indexOf('const esc='),template.indexOf('function displayImageUrl(')),context);
 const body=context.bodyToHtml(p.body);
 const snapshot=`<div class="reader-hero rounded-2xl p-6 md:p-10 mb-8"><h1 class="text-4xl font-extrabold leading-tight">${escape(title)}</h1></div>${image?`<figure class="mb-8"><img src="${escape(image)}" alt="${escape(p.image_alt||title)}" class="w-full rounded-2xl">${String(p.cover_image_caption||'').trim()?`<figcaption>${escape(p.cover_image_caption)}</figcaption>`:''}</figure>`:''}<div class="article-body text-lg" lang="ar" dir="rtl">${body}</div>`;
 html=html.replace('<section id="listing">','<section id="listing" class="hidden">').replace('id="reader" class="hidden ','id="reader" class="').replace('<div id="article"></div>','<div id="article">'+snapshot+'</div>');
 return html;
}
export async function build(){
 const template=fs.readFileSync('newsroom.html','utf8');
 const key=process.env.SUPABASE_ANON_KEY;if(!key)throw Error('Public API key missing');
 const endpoint='https://zsqvmuqlmtnhndwuqlfy.supabase.co/rest/v1/articles?select=id,title,subtitle,excerpt,body,status,cover_image_url,image,gallery,cover_image_caption&status=eq.published&order=id.asc';
 const rows=[];for(let offset=0;;offset+=500){const response=await fetch(endpoint+'&limit=500&offset='+offset,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Published article fetch failed: '+response.status);const batch=await response.json();if(!Array.isArray(batch))throw Error('Invalid feed');rows.push(...batch);if(batch.length<500)break;}
 fs.rmSync('articles',{recursive:true,force:true});fs.mkdirSync('articles');
 for(const p of rows)fs.writeFileSync('articles/'+p.id+'.html',renderArticle(template,p));
 fs.writeFileSync('public/article-link-map.js','window.ALNUQTA_ARTICLE_PAGES='+JSON.stringify(rows.map(p=>p.id))+';\n');
 console.log('Published article pages generated: '+rows.length);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await build();
