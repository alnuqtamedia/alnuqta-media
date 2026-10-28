// Blend the ending into the opening once, then loop it on the audio clock.
// Initial playback includes the original opening; later loops skip its overlapped part.
export function blendLoopChannel(input,fadeFrames){
 const n=input.length,f=Math.min(Math.max(2,Math.round(fadeFrames)),Math.floor(n/3));
 const out=new Float32Array(input);
 if(f<2)return {samples:out,loopStart:0};
 for(let i=0;i<f;i++){const mix=i/(f-1);out[n-f+i]=input[n-f+i]*(1-mix)+input[i]*mix;}
 return {samples:out,loopStart:f};
}
export class SeamlessMusic {
 constructor(track,options={}){
  this.track=track;this.context=null;this.gain=null;this.buffer=null;this.loading=null;
  this.source=null;this.offset=0;this.startedAt=0;this._volume=.08;this.revision=0;this.trackGeneration=0;
  this.Context=options.Context||globalThis.AudioContext||globalThis.webkitAudioContext;
  this.fetch=options.fetch||((...args)=>globalThis.fetch(...args));this.paused=true;this.onChange=()=>{};
 }
 get duration(){return this.buffer?.duration||0;}
 get currentTime(){
  if(this.paused||!this.context)return this.offset;
  let t=this.offset+this.context.currentTime-this.startedAt;
  if(this.duration&&t>=this.duration)t=this.loopStart+(t-this.duration)%(this.duration-this.loopStart);
  return t;
 }
 get volume(){return this._volume;}
 set volume(value){this._volume=Math.max(0,Math.min(1,Number(value)||0));if(this.gain)this.gain.gain.setTargetAtTime(this._volume,this.context.currentTime,.03);}
 ensureContext(){
  if(!this.Context)throw Object.assign(new Error('Web Audio unavailable'),{name:'NotSupportedError'});
  if(!this.context){this.context=new this.Context();this.gain=this.context.createGain();this.gain.gain.value=this._volume;this.gain.connect(this.context.destination);}
 }
 async load(){
  if(this.buffer)return;
  if(!this.loading){const track=this.track,generation=this.trackGeneration;this.loading=(async()=>{
   const response=await this.fetch(track.url);if(!response.ok)throw new Error('Music request failed');
   const decoded=await this.context.decodeAudioData(await response.arrayBuffer());
   if(generation!==this.trackGeneration)return;
   const buffer=this.context.createBuffer(decoded.numberOfChannels,decoded.length,decoded.sampleRate);
   let loopStart=0;
   for(let c=0;c<decoded.numberOfChannels;c++){
    const result=blendLoopChannel(decoded.getChannelData(c),decoded.sampleRate*track.crossfadeSeconds);
    buffer.copyToChannel(result.samples,c);loopStart=result.loopStart/decoded.sampleRate;
   }
   this.loopStart=loopStart;this.buffer=buffer;this.onChange();
  })().catch(error=>{if(generation===this.trackGeneration)this.loading=null;throw error;});}
  return this.loading;
 }
 async play(){
  if(!this.paused)return;
  const revision=++this.revision;this.ensureContext();
  // resume() may stay pending until a gesture. Report that state without hanging the UI.
  if(this.context.state!=='running'){
   let timer;
   try{await Promise.race([this.context.resume(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Browser blocked autoplay'),{name:'NotAllowedError'})),400);})]);}
   finally{clearTimeout(timer);}
  }
  if(this.context.state!=='running')throw Object.assign(new Error('Browser blocked autoplay'),{name:'NotAllowedError'});
  await this.load();if(revision!==this.revision)return;
  const source=this.context.createBufferSource();source.buffer=this.buffer;source.loop=true;source.loopStart=this.loopStart;source.loopEnd=this.duration;source.connect(this.gain);
  this.source=source;this.startedAt=this.context.currentTime;this.paused=false;source.start(0,this.offset);this.onChange();
 }
 pause(){
  ++this.revision;if(this.source){this.offset=this.currentTime;try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}
  this.paused=true;this.onChange();
 }
 seek(seconds){const resume=!this.paused;this.pause();this.offset=Math.max(0,Math.min(this.duration-.05,Number(seconds)||0));return resume?this.play():Promise.resolve();}
 async setTrack(track){
  this.pause();++this.trackGeneration;
  this.track=track;this.buffer=null;this.loading=null;this.offset=0;this.onChange();
 }
}
