import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {renderArticle} from './build-article-pages.mjs';
const source='https://upload.wikimedia.org/wikipedia/commons/0/02/Iraqi_Museum.jpg';
const mirror='https://alnuqtamedia.com/assets/editorial/iraqi-museum-1280.jpg';
const template=fs.readFileSync(new URL('../newsroom.html',import.meta.url),'utf8');
const article={id:'mirror-test',status:'published',title:'Museum',body:'Report',cover_image_url:source};
const html=renderArticle(template,article);
assert(html.includes('content="'+mirror+'"'));
assert(html.includes('https://creativecommons.org/licenses/by-sa/4.0/'));
assert.equal(article.cover_image_caption,undefined);
assert(fs.statSync(new URL('../assets/editorial/iraqi-museum-1280.jpg',import.meta.url)).size>0);
for(const file of ['../newsroom.html','../public/supabase-feed.js']){
 const text=fs.readFileSync(new URL(file,import.meta.url),'utf8');
 const fn=text.split('\n').find(line=>line.trim().startsWith('function displayImageUrl('));
 const context={URL,location:{href:'https://alnuqtamedia.com/articles/test.html',origin:'https://alnuqtamedia.com'}};
 vm.createContext(context);vm.runInContext(fn,context);
 assert.equal(context.displayImageUrl(source,640),mirror);
 assert.equal(context.displayImageUrl(source+'?cache=1',1280),mirror);
 assert.equal(context.displayImageUrl('https://example.com/unchanged.jpg',640),'https://example.com/unchanged.jpg');
}
console.log('PASS: local media mirror, social metadata, visible license, original record preserved and unrelated images unchanged');
