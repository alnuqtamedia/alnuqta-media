import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {renderArticle} from './build-article-pages.mjs';
const template=fs.readFileSync('newsroom.html','utf8');
const p={id:'test-id',status:'published',title:'عنوان <script> & "اقتباس"',body:'المحتوى الأصلي\n\nفقرة ثانية',cover_image_url:'https://example.com/image.jpg',cover_image_credit:'Illustration <Gemini> & supplied by owner'};
const html=renderArticle(template,p);
assert.match(html,/<meta property="og:title" content="عنوان &lt;script&gt; &amp; &quot;اقتباس&quot;">/);
assert.match(html,/<meta property="og:image" content="https:\/\/example.com\/image.jpg">/);
assert.match(html,/<meta property="og:url" content="https:\/\/alnuqtamedia.com\/articles\/test-id.html">/);
assert.match(html,/<div id="article">[\s\S]*المحتوى الأصلي/);
assert.match(html,/<section id="listing" class="hidden">/);
assert.match(html,/id="reader" class="max-w-4xl/);
assert.doesNotMatch(html,/content="غرفة الأخبار \| النقطة"/);
assert.doesNotMatch(html,/Illustration &lt;Gemini&gt;/);
assert.match(renderArticle(template,{...p,cover_image_credit:'Author <A> / CC BY-SA 4.0'}),/<details><summary>حقوق الصورة<\/summary><div dir="auto">Author &lt;A&gt; \/ CC BY-SA 4.0<\/div><\/details>/);
assert.match(renderArticle(template,{...p,cover_image_caption:'صورة أرشيفية'}),/<figcaption[^>]*><div>صورة أرشيفية<\/div>/);
assert.doesNotMatch(template,/listBlock\('المصادر'|نظام المحتوى|المواد من قاعدة البيانات/);
assert.doesNotMatch(renderArticle(template,{...p,cover_image_credit:null}),/<figcaption>/);
assert.throws(()=>renderArticle(template,{...p,status:'draft'}));
assert.throws(()=>renderArticle(template,{...p,id:'../private'}));
console.log('PASS: published-only pages, escaped metadata, static content, canonical image and URL, internal credits hidden, required license attribution escaped, editorial captions preserved.');

for(const [category,theme] of [['politics','politics'],['economy','economy'],['economy-public-money','economy'],['sports','sports'],['iraq','iraq'],['world','world'],['arts','arts'],['misc','misc'],['culture-arts','arts'],['unknown','misc']])assert.match(renderArticle(template,{...p,category}),new RegExp('<body data-reader-theme="'+theme+'">'));

assert.match(renderArticle(template,{...p,section:"opinion",category:"economy"}),/<body data-reader-theme="opinion">/);

// History navigation into /articles/ must not move public navigation into that folder.
assert.match(template,/<base href="\/">/);
assert.equal((html.match(/<base\b/g)||[]).length,1);
const base=html.match(/<base href="([^"]+)"/)[1];
for(const page of ['https://alnuqtamedia.com/newsroom.html','https://alnuqtamedia.com/articles/test-id.html']){
 const effectiveBase=new URL('/',page);
 assert.equal(new URL('newsroom.html?type=opinion',effectiveBase).href,'https://alnuqtamedia.com/newsroom.html?type=opinion');
 assert.equal(new URL('newsroom.html?type=opinion',base).pathname,'/newsroom.html');
}
const missing=fs.readFileSync('404.html','utf8');
for(const target of ['/index.html','/newsroom.html'])assert.ok(missing.includes('href="'+target+'"'));

const links={window:{ALNUQTA_ARTICLE_PAGES:['test-id']},document:{baseURI:'https://alnuqtamedia.com/articles/current.html'},URL};
vm.runInNewContext(fs.readFileSync('public/article-links.js','utf8'),links);
assert.equal(links.window.articlePublicUrl({id:'test-id'},'en'),'https://alnuqtamedia.com/articles/test-id.html?lang=en');
assert.equal(links.window.articlePublicUrl({id:'fallback'}),'https://alnuqtamedia.com/newsroom.html?slug=fallback');
