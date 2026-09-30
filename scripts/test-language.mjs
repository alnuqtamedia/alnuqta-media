import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/language.js','utf8');
function setup(search,stored,versions,ok=true) {
 const document={documentElement:{},addEventListener(){}};
 const context={URL,URLSearchParams,document,location:{search},localStorage:{getItem:()=>stored},console,window:{ALNUQTA_SUPABASE_PUBLIC:{url:'https://example.supabase.co',anonKey:'public'}},fetch:async()=>({ok,json:async()=>versions})};
 vm.runInNewContext(source,context);return context;
}
const row={id:'article-1',title:'Arabic title',body:'Original body',status:'published',updated_at:'2026-09-30T00:00:00Z'};
const version={article_id:row.id,status:'published',language:'en',source_updated_at:row.updated_at,title:'English title',body:'English body',id:'untrusted-id'};
const en=setup('?lang=en',null,[version]);
assert.equal(en.document.documentElement.dir,'ltr');
const [translated]=await en.window.ALNUQTA_I18N.articles([row]);
assert.equal(translated.title,'English title');assert.equal(translated.id,row.id);assert.equal(row.title,'Arabic title');
for(const unsafe of [{...version,status:'draft'},{...version,source_updated_at:'2026-09-29T00:00:00Z'},{...version,article_id:'another-article'}]){
 const [result]=await setup('?lang=en',null,[unsafe]).window.ALNUQTA_I18N.articles([row]);
 assert.equal(result.translation_available,false);assert.equal(result.body,row.body);
}
const ar=setup('?lang=ar','en',[version]);assert.equal(ar.document.documentElement.dir,'rtl');
assert.equal((await ar.window.ALNUQTA_I18N.articles([row]))[0].title,row.title);
const [failed]=await setup('?lang=en',null,[],false).window.ALNUQTA_I18N.articles([row]);assert.equal(failed.translation_available,false);
assert.equal(en.window.ALNUQTA_I18N.translate('عدد المواد: 9'),'Articles: 9');
assert.equal(en.window.ALNUQTA_I18N.translate(' · ثقافة وفنون'),' · Culture and arts');
assert.equal(en.window.ALNUQTA_I18N.translate('قراءة English title'),'Read English title');
console.log('Language checks passed: source preserved, approved current versions only, URL preference, API failure fallback.');
