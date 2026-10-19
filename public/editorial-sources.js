(function(root){
  'use strict';
  const broken = value => /\[object Object\]/i.test(value);
  function sourceText(source){
    if(typeof source==='string')return source.trim();
    if(!source||typeof source!=='object'||Array.isArray(source))return '[object Object]';
    const title=typeof source.title==='string'?source.title.trim():'';
    const url=typeof source.url==='string'?source.url.trim():'';
    return [title,url].filter(Boolean).join(' — ')||'[object Object]';
  }
  function validate(sources){
    if(!Array.isArray(sources))throw Error('صيغة المصادر غير صالحة. راجع المصادر قبل الحفظ.');
    for(const source of sources){
      const text=sourceText(source);
      if(!text||broken(text))throw Error('توجد مصادر تالفة أو غير مقروءة. استرجع المصادر الأصلية أو أدخل مصادر موثقة قبل الحفظ.');
      if(source&&typeof source==='object'&&source.url&&!/^https?:\/\//i.test(source.url.trim()))throw Error('رابط المصدر يجب أن يبدأ بـ https:// أو http://.');
    }
    return sources;
  }
  const toText=sources=>Array.isArray(sources)?sources.map(sourceText).join('\n'):'';
  function fromText(text,original=[]){
    const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    // Keep structured references (and their metadata) when their readable line survives editing.
    const known=new Map();
    for(const source of Array.isArray(original)?original:[]){const line=sourceText(source);if(!known.has(line))known.set(line,[]);known.get(line).push(source);}
    return validate(lines.map(line=>known.get(line)?.length?known.get(line).shift():line));
  }
  root.ALNUQTA_SOURCES={sourceText,toText,fromText,validate,hasBroken:sources=>Array.isArray(sources)&&sources.some(x=>broken(sourceText(x)))};
})(globalThis);
