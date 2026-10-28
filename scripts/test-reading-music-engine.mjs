import assert from 'node:assert/strict';
import {blendLoopChannel,SeamlessMusic} from '../public/reading-music-engine.mjs';
const original=Float32Array.from({length:100},(_,i)=>i/100);
const {samples,loopStart}=blendLoopChannel(original,10);
assert.equal(loopStart,10);assert.equal(samples.length,100);
assert.equal(samples[90],original[90]);assert.equal(samples[99],original[9]);
assert.ok(Math.abs(samples[loopStart]-samples.at(-1))<.011,'Loop boundary follows adjacent opening samples');
assert.ok(samples.every(n=>Number.isFinite(n)&&n>=0&&n<=1),'Crossfade has no NaNs or additive clipping');
assert.deepEqual(samples.slice(0,90),original.slice(0,90),'Original opening is preserved on the first play');
const sources=[];let resolveDecode;
class Context{
 constructor(){this.state='running';this.currentTime=0;this.destination={};}
 createGain(){return {gain:{value:0,setTargetAtTime(){}},connect(){}};}
 createBufferSource(){const s={connect(){},disconnect(){},stop(){this.stopped=true;},start(t,offset){this.offset=offset;}};sources.push(s);return s;}
 decodeAudioData(){return new Promise(r=>{resolveDecode=r;});}
 createBuffer(channels,length,rate){return {duration:length/rate,copyToChannel(){}};}
}
const decoded={numberOfChannels:1,length:100,sampleRate:10,getChannelData(){return original;}};
const e=new SeamlessMusic({url:'/track',crossfadeSeconds:1},{Context,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})});
const pending=e.play();await new Promise(r=>setImmediate(r));e.pause();resolveDecode(decoded);await pending;
assert.equal(sources.length,0,'Stopping during decode must not start a delayed source');
await e.play();assert.equal(sources.length,1);assert.equal(sources[0].loop,true);assert.equal(sources[0].loopStart,1);
e.context.currentTime=10.5;assert.equal(e.currentTime,1.5,'Playback wraps to the overlapped start');
e.pause();assert.equal(e.offset,1.5);assert.equal(sources[0].stopped,true);
await e.play();assert.equal(sources[1].offset,1.5,'Resume preserves position');
await e.seek(8);assert.equal(sources[2].offset,8);e.pause();
await e.setTrack({url:'/another',crossfadeSeconds:2});assert.equal(e.offset,0);assert.equal(e.buffer,null);
const savedFetch=globalThis.fetch;
try{
 globalThis.fetch=async function(){assert.equal(this,globalThis,'Browser fetch must keep its global receiver');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};};
 const bound=new SeamlessMusic({url:'/bound',crossfadeSeconds:1},{Context});
 const loading=bound.play();await new Promise(r=>setImmediate(r));resolveDecode(decoded);await loading;assert.equal(bound.paused,false);bound.pause();
}finally{globalThis.fetch=savedFetch;}
console.log('Seamless music: sample-continuous join, preserved opening, audio-clock looping, decode cancellation, pause/resume, seek and track reset passed.');
