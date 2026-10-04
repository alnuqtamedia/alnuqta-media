import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const sectionsSource=fs.readFileSync('public/sections.js','utf8');
const feedSource=fs.readFileSync('public/supabase-feed.js','utf8');
const document={addEventListener(){},querySelectorAll(){return []}};
const window={};vm.runInNewContext(sectionsSource,{window,document});
assert.deepEqual(Array.from(window.ALNUQTA_SECTIONS,s=>s.id),['politics','world','economy','iraq','sports','arts','misc']);
for(const [old,expected] of Object.entries({'economy-public-money':'economy','culture-arts':'arts','field-social':'misc','travel-tourism':'misc','human-stories':'misc','اقتصادي':'economy','سياسي':'politics','رياضي':'sports','unknown':'misc','':'misc'}))assert.equal(window.normalizeCategory(old),expected);
async function feed(rows,fail=false){
 const nodes={ 'homepage-feed':{innerHTML:''},'homepage-ticker':{innerHTML:'',hidden:true},'homepage-featured':{innerHTML:''}};
 const win={...window,ALNUQTA_SUPABASE_PUBLIC:{url:'https://fixture.test',anonKey:'public'}};
 let calls=0;
 const ctx={window:win,URL,AbortController,setTimeout,clearTimeout,document:{getElementById:id=>nodes[id],querySelector:()=>nodes['homepage-featured']},location:{href:'https://example.test/'},console:{warn(){}},fetch:async endpoint=>{assert.ok(!new URL(endpoint).searchParams.get('select').split(',').includes('body'));calls++;return {ok:!fail,status:503,json:async()=>rows}}};
 vm.runInNewContext(feedSource,ctx);await new Promise(resolve=>setImmediate(resolve));return {nodes,calls};
}
const posts=[{id:'hero',category:'politics',title:'Hero',published_at:'2026-10-04'},{id:'next',category:'politics',title:'Next',published_at:'2026-10-03'},...Array.from({length:5},(_,i)=>({id:`e${i}`,category:'economy-public-money',title:i===0?'<script>alert(1)</script>':`Economy ${i}`,published_at:`2026-09-${25-i}`}))];
const result=await feed(posts);assert.equal(result.calls,1);assert.ok(result.nodes['homepage-feed'].innerHTML.includes('home-economy'));assert.ok(!result.nodes['homepage-feed'].innerHTML.includes('slug=hero'));assert.ok(!result.nodes['homepage-feed'].innerHTML.includes('home-world'));assert.ok(result.nodes['homepage-feed'].innerHTML.includes('&lt;script&gt;'));assert.equal((result.nodes['homepage-feed'].innerHTML.match(/<img /g)||[]).length,0);assert.equal((result.nodes['homepage-ticker'].innerHTML.match(/class="ticker-copy"/g)||[]).length,2);
const empty=await feed([]);assert.match(empty.nodes['homepage-feed'].innerHTML,/لا توجد مواد/);assert.equal(empty.nodes['homepage-ticker'].hidden,true);
const failed=await feed([],true);assert.match(failed.nodes['homepage-feed'].innerHTML,/تعذر تحميل/);
const html=fs.readFileSync('newsroom.html','utf8');const inline=html.match(/<script>\s*const labels=[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g,'');
const elements=new Map();const node=id=>{if(!elements.has(id))elements.set(id,{value:id==='section'?'all':'',textContent:'',innerHTML:'',classList:{add(){},remove(){}}});return elements.get(id)};
const location={search:'?type=opinion&section=economy-public-money',href:'https://example.test/newsroom.html?type=opinion&section=economy-public-money'};
const ctx={window:{...window},document:{getElementById:node,querySelectorAll:()=>[],querySelector:()=>null},URL,URLSearchParams,location,history:{pushState(){}},console};
vm.runInNewContext(inline,ctx);vm.runInNewContext(`posts=[{slug:'one',title:'Opinion',section:'opinion',category:'economy-public-money'},{slug:'two',title:'Report',section:'report',category:'economy'}];render();`,ctx);
assert.equal(node('section').value,'opinion');assert.ok(node('grid').innerHTML.includes('Opinion'));assert.ok(!node('grid').innerHTML.includes('Report'));
for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))){const s=fs.readFileSync(file,'utf8');if(!s.includes('<header'))continue;assert.ok(s.includes('site-header.js'),file);assert.ok(s.includes('type=opinion'),file);assert.ok(!/newsroom-menu|newsroom-dropdown/.test(s),file);}
console.log('Section checks passed: legacy aliases, combined filters, empty/failure feed, one request, hero deduplication, escaped content, shared navigation.');
