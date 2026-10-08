import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code=fs.readFileSync(new URL('../public/supabase-feed.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function run({config=true,responses=[],hostname='alnuqtamedia.com'}={}){
  const elements={};for(const id of ['homepage-feed','homepage-featured','homepage-ticker','homepage-feed-retry'])elements[id]={innerHTML:'',setAttribute(k,v){this[k]=v;}};
  const calls=[];const location={hostname,href:'https://alnuqtamedia.com/',reload(){calls.push('reload');}};
  const window={ALNUQTA_SECTIONS:[{id:'economy',label:'اقتصاد'}],normalizeCategory:x=>x,...(config?{ALNUQTA_SUPABASE_PUBLIC:{url:'https://example.test',anonKey:'public-test'}}:{})};
  vm.runInNewContext(code,{window,document:{getElementById:id=>elements[id],querySelector:()=>elements['homepage-featured']},location,URL,AbortController,setTimeout,clearTimeout,console:{warn(){}},fetch:async(url,options)=>{calls.push(url);assert.match(url,/status=eq.published/);assert.equal(options.cache,'no-store');const next=responses.shift();if(next instanceof Error)throw next;return {ok:true,json:async()=>next??[]};}});
  return {elements,calls};
}
const missing=run({config:false,hostname:'localhost'});assert.match(missing.elements['homepage-feed'].innerHTML,/setup:dev/);assert.equal(missing.calls.length,0);missing.elements['homepage-feed-retry'].onclick();assert.deepEqual(missing.calls,['reload']);
const retry=run({responses:[new Error('offline'),[{id:'public-id',title:'Published news',category:'economy',published_at:'2026-10-01'}]]});await flush();assert.match(retry.elements['homepage-feed'].innerHTML,/homepage-feed-retry/);retry.elements['homepage-feed-retry'].onclick();retry.elements['homepage-feed-retry'].onclick();await flush();assert.equal(retry.calls.length,2);assert.match(retry.elements['homepage-featured'].innerHTML,/Published news/);assert.equal(retry.elements['homepage-feed']['aria-busy'],'false');
const empty=run();await flush();assert.match(empty.elements['homepage-feed'].innerHTML,/لا توجد مواد/);
const malformed=run({responses:[{items:[]}]});await flush();assert.match(malformed.elements['homepage-feed'].innerHTML,/إعادة المحاولة/);
console.log('PASS: missing local config, failed request, retry recovery, duplicate-click guard, empty feed and malformed response.');

const summary=run({responses:[[{id:'with-summary',title:'Headline',excerpt:'A useful summary',published_at:'2026-10-08'}]]});await flush();assert.match(summary.elements['homepage-featured'].innerHTML,/A useful summary/);
const noSummary=run({responses:[[{id:'no-summary',title:'Headline',subtitle:'النقطة',published_at:'2026-10-08'}]]});await flush();assert.doesNotMatch(noSummary.elements['homepage-featured'].innerHTML,/class="font-tajawal text-gray-200/);
console.log('PASS: hero summary appears when available; missing or brand-only summary is hidden.');
