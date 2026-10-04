import vm from 'node:vm';import fs from 'node:fs';import assert from 'node:assert/strict';
function scenario(wide){
 const callbacks={};let document;
 class Element{
  constructor(){this.attributes={};this.listeners={};this.classes=new Set();this.classList={contains:n=>this.classes.has(n),add:n=>this.classes.add(n),remove:n=>this.classes.delete(n),toggle:(n,force)=>{const next=force??!this.classes.has(n);if(next)this.classes.add(n);else this.classes.delete(n);return next;}};}
  setAttribute(k,v){this.attributes[k]=v} getAttribute(k){return this.attributes[k]??null} addEventListener(k,v){this.listeners[k]=v} focus(){document.activeElement=this} contains(x){return this===x||this.children?.includes(x)}
 }
 const header=new Element(),mobile=new Element(),toggle=new Element(),home=new Element(),navigation=new Element(),link=new Element();
 header.children=[mobile,toggle,home,navigation,link];home.children=[toggle,link];navigation.children=[home,toggle,link];
 const selectors={'.site-mobile-toggle':mobile,'[data-sections-toggle]':toggle,'.home-menu':home,'.site-navigation':navigation};header.querySelector=s=>selectors[s];
 const desktop={matches:wide,addEventListener:(name,fn)=>callbacks.resize=fn};
 document={documentElement:{lang:'ar'},activeElement:null,querySelector:()=>header,addEventListener:(name,fn)=>callbacks[name]=fn};
 vm.runInNewContext(fs.readFileSync('public/site-header.js','utf8'),{document,window:{buildSectionsMenu(){}},matchMedia:()=>desktop});callbacks.DOMContentLoaded();return {header,mobile,toggle,home,navigation,link,callbacks,document};
}
const mobile=scenario(false);mobile.mobile.listeners.click();assert.equal(mobile.home.classList.contains('open'),true);mobile.home.listeners.focusout({relatedTarget:mobile.navigation});assert.equal(mobile.home.classList.contains('open'),true);mobile.link.focus();mobile.callbacks.keydown({key:'Escape'});
assert.equal(mobile.mobile.getAttribute('aria-expanded'),'false');assert.equal(mobile.toggle.getAttribute('aria-expanded'),'false');assert.equal(mobile.document.activeElement,mobile.mobile);
mobile.mobile.listeners.click();assert.equal(mobile.home.classList.contains('open'),true);mobile.mobile.listeners.click();assert.equal(mobile.home.classList.contains('open'),false);
mobile.mobile.listeners.click();mobile.callbacks.resize();assert.equal(mobile.header.classList.contains('mobile-open'),false);
const desktop=scenario(true);desktop.home.listeners.pointerenter({pointerType:'mouse'});desktop.link.focus();desktop.callbacks.keydown({key:'Escape'});assert.equal(desktop.document.activeElement,desktop.toggle);assert.equal(desktop.toggle.getAttribute('aria-expanded'),'false');
desktop.toggle.listeners.click();desktop.callbacks.click({target:{}});assert.equal(desktop.home.classList.contains('open'),false);
assert.ok(!fs.readFileSync('assets/tailwind-input.css','utf8').includes('animation-play-state:paused'));
console.log('Navigation checks passed: mobile Escape focus, accordion reset, viewport changes, desktop Escape and outside click.');
