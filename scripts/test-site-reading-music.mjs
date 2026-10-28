import assert from 'node:assert/strict';
import {publicMusicPath} from '../public/reading-music-site.mjs';
const origin='https://alnuqtamedia.com';
assert.equal(publicMusicPath('/index.html',origin),'/index.html');
assert.equal(publicMusicPath('/',origin),'/');
assert.equal(publicMusicPath('/articles/abc.html?lang=en#story',origin),'/articles/abc.html?lang=en#story');
for(const value of ['https://other.test/news.html','/admin/dashboard.html','/experiments/reading-music.html','/assets/check.mp4','/public/key.js','/newsletter-result.html?token=test','javascript:alert(1)'])assert.equal(publicMusicPath(value,origin),null,value);
console.log('Site music routes: public pages and canonical paths preserved; admin, newsletter flows, assets and foreign destinations excluded.');
