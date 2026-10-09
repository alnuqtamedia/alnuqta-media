import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {scanAttachment} from '../supabase/functions/source-submit/attachment-scan.mjs';
const file=new Blob(['private test document']);
assert.equal(await scanAttachment(file),'not_configured');
const base={url:'https://scanner.example.test/scan',token:'private-test-token',cryptoImpl:webcrypto};
await assert.rejects(scanAttachment(file,{required:true}),/unavailable/);
await assert.rejects(scanAttachment(file,{...base,url:'http://scanner.example.test'}),/unavailable/);
assert.equal(await scanAttachment(file,{...base,fetcher:async(url,request)=>{
  assert.equal(request.redirect,'error');
  assert.equal(request.headers.Authorization,'Bearer private-test-token');
  assert(!('filename' in request.headers));
  assert.equal(new TextDecoder().decode(request.body),'private test document');
  return {ok:true,json:async()=>({verdict:'clean',sha256:request.headers['X-Content-SHA256']})};
}}),'clean');
for(const [verdict,expected] of [['infected',/rejected/],['unknown',/unavailable/]]) {
  await assert.rejects(scanAttachment(file,{...base,fetcher:async(_url,req)=>({ok:true,json:async()=>({verdict,sha256:req.headers['X-Content-SHA256']})})}),expected);
}
await assert.rejects(scanAttachment(file,{...base,fetcher:async()=>({ok:true,json:async()=>({verdict:'clean',sha256:'wrong-file'})})}),/unavailable/);
await assert.rejects(scanAttachment(file,{...base,fetcher:async()=>{throw new Error('timeout');}}),/unavailable/);
await assert.rejects(scanAttachment(file,{...base,fetcher:async()=>({ok:false})}),/unavailable/);
console.log('PASS: scanner configuration, clean/infected, unknown, wrong digest, timeout and failure.');
