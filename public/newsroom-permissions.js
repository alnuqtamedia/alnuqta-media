(function(root){
'use strict';
function scoped(profile){return profile?.own_article_publisher===true&&['editor','writer'].includes(profile.role);}
function owns(article,userId){return Boolean(userId&&article&&(article.author_id===userId||article.writer_id===userId));}
function edit(profile,userId,article){if(!profile||!article)return false;if(scoped(profile))return owns(article,userId);return ['owner','editor'].includes(profile.role)||['author_id','writer_id','editor_id','photographer_id','videographer_id','designer_id'].some(k=>article[k]===userId&&Boolean(userId));}
function publish(profile,userId,article){return profile?.role==='owner'||(scoped(profile)&&owns(article,userId));}
function remove(profile,userId,article){return profile?.role==='owner'||(scoped(profile)&&owns(article,userId));}
function status(profile,value){if(profile?.role==='owner'||scoped(profile))return ['draft','review','ready','published'].includes(value);if(profile?.role==='editor')return ['draft','review','ready'].includes(value);if(profile?.role==='writer')return ['draft','review'].includes(value);return value==='draft';}
root.NEWSROOM_ACCESS={scoped,owns,edit,publish,remove,status};
})(typeof window==='undefined'?globalThis:window);
