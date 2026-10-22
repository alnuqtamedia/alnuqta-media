import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';
import {chromium} from 'playwright';
const root=path.resolve('.');
const server=http.createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
try{
 for(const scoped of [true,false]){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.addInitScript(({scoped})=>{
   window.ALNUQTA_SUPABASE_PUBLIC={url:'https://synthetic.invalid',anonKey:'synthetic'};window.tailwind={config:{}};window.__test={writes:[],mfa:0,queries:[]};
   const profile={id:'subject',role:'editor',full_name:'محررة الاختبار',own_article_publisher:scoped};
   const article=(id,author,status)=>({id,author_id:author,writer_id:null,writer_name:'محررة الاختبار',title:id==='own'?'Own published':id==='ready'?'Own ready':'Foreign article',body:'Synthetic article body',category:'politics',section:'news',status,updated_at:'2026-10-22T00:00:00Z',sources:[],videos:[],gallery:[]});
   const rows=[article('own','subject','published'),article('ready','subject','ready'),article('foreign','another','ready')];
   function builder(table){const filters=[];let operation='select',payload=null,or='';const q={
    select(){return q},order(){return q},limit(){return q},eq(k,v){filters.push([k,v]);return q},neq(){return q},
    or(value){or=value;window.__test.queries.push(value);return q},update(value){operation='update';payload=value;return q},delete(){operation='delete';return q},insert(value){operation='insert';payload=value;return q},
    async single(){return {data:profile,error:null}},
    then(resolve,reject){try{if(table!=='articles')return Promise.resolve({data:[],count:0}).then(resolve,reject);
     let selected=rows.filter(a=>filters.every(([k,v])=>a[k]===v));if(or&&scoped)selected=selected.filter(a=>a.author_id==='subject'||a.writer_id==='subject');
     if(operation!=='select'){window.__test.writes.push({operation,payload,ids:selected.map(a=>a.id)});if(operation==='update')selected.forEach(a=>Object.assign(a,payload));if(operation==='delete')selected.forEach(a=>rows.splice(rows.indexOf(a),1));}
     return Promise.resolve({data:JSON.parse(JSON.stringify(selected)),error:null}).then(resolve,reject);
    }catch(e){return Promise.reject(e).then(resolve,reject);}}
   };return q;}
   const client={from:builder,rpc:async()=>({data:[]}),auth:{getSession:async()=>({data:{session:{user:{id:'subject',email:'synthetic@example.invalid'},access_token:'synthetic'}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>{window.__test.mfa++;return {data:{currentLevel:'aal1'}}},listFactors:async()=>({data:{totp:[]}})}}};
   window.supabase={createClient:()=>client};
   window.fetch=async()=>new Response(JSON.stringify({ok:true,members:[profile]}),{status:200,headers:{'Content-Type':'application/json'}});
   window.confirm=()=>true;window.prompt=()=> 'Own published';
  },{scoped});
  await page.goto(origin+'/admin/dashboard.html');await page.waitForFunction(()=>document.querySelectorAll('#articles .item').length>0,{},{timeout:5000}).catch(async e=>{console.error('Dashboard diagnostic',JSON.stringify({errors,url:page.url(),body:await page.locator('body').innerText().catch(()=>''),state:await page.evaluate(()=>({config:window.ALNUQTA_SUPABASE_PUBLIC,profile:typeof currentProfile==='undefined'?null:currentProfile,queries:window.__test?.queries})).catch(()=>({}))}));throw e;});
  if(scoped){
   assert.equal(await page.locator('#articles .item').count(),2);assert.equal(await page.locator('#articleStatus option[value="published"]').count(),1);
   assert.equal(await page.locator('[data-action="publish"][data-id="ready"]').count(),1);assert.equal(await page.locator('[data-action="delete"][data-id="own"]').count(),1);
   await page.locator('[data-action="edit"][data-id="own"]').click();await page.locator('#body').fill('Changed own body');
   await page.evaluate(()=>document.getElementById('articleForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   await page.waitForFunction(()=>window.__test.writes.some(w=>w.payload?.body==='Changed own body'));
   assert.equal(await page.evaluate(()=>window.__test.mfa),0);
   assert.equal(await page.evaluate(()=>window.__test.writes.find(w=>w.payload?.body==='Changed own body').payload.writer_id),null,'Null writer ownership was reassigned by the form');
   await page.locator('[data-action="publish"][data-id="ready"]').click();await page.waitForFunction(()=>window.__test.writes.some(w=>w.payload?.status==='published'));
   await page.locator('[data-action="unpublish"][data-id="own"]').click();await page.waitForFunction(()=>window.__test.writes.some(w=>w.payload?.status==='ready'));
   await page.locator('[data-action="delete"][data-id="own"]').click();await page.waitForFunction(()=>window.__test.writes.some(w=>w.operation==='delete'));
   const writes=await page.evaluate(()=>window.__test.writes);assert(writes.every(w=>!w.ids.includes('foreign')));assert.equal(await page.evaluate(()=>window.__test.mfa),0);
  }else{
   assert.equal(await page.locator('#articles .item').count(),3);assert.equal(await page.locator('[data-action="publish"]').count(),0);assert.equal(await page.locator('[data-action="delete"]').count(),0);assert.equal(await page.locator('#articleStatus option[value="published"]').count(),0);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Browser: scoped editor sees own actions, edits published material, publishes/unpublishes/deletes own fixtures, no MFA redirect; unflagged editor unchanged. Mocked API only.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
