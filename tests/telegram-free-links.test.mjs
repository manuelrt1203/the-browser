import test from 'node:test';import assert from 'node:assert/strict';
import{telegramFreeEnabled,freeAssetUrl,freePostUrl}from'../src/lib/telegram-free-links.ts';
import{publicationsForTitle}from'../src/lib/catalogue-links.ts';
const source='-1004339801492';
test('gratuit : fermé hors Production, liens séparés des paiements et tokens stricts',()=>{
 const env={VERCEL:'1',VERCEL_ENV:'production',TELEGRAM_FREE_GATE_ENABLED:'1',TELEGRAM_CHANNEL_ID:source};assert.equal(telegramFreeEnabled(env),true);assert.equal(telegramFreeEnabled({...env,VERCEL_ENV:'preview'}),false);assert.equal(telegramFreeEnabled({...env,TELEGRAM_FREE_GATE_ENABLED:'0'}),false);
 assert.equal(freePostUrl(10),'https://t.me/Thebrowser365_bot?start=free_post_10');assert.equal(freePostUrl(-1),null);assert.equal(freeAssetUrl('unsafe/url'),null);
});
test('catalogue : publications protégées prioritaires, adhésion via bot sans fichier privé exposé',()=>{
 const ref={kind:'serie',id:1,season:1,episode:1},base={version:1,updateId:1,text:'',pending:[],fileName:'S01E01.mp4',titles:[ref]};
 const posts={[`${source}:10`]:{...base,messageId:10},[`${source}:20`]:{...base,messageId:20,freeAccessToken:'a'.repeat(24)}};
 const result=publicationsForTitle('serie-1',posts,source);assert.equal(result.length,1);assert.equal(result[0].url,freeAssetUrl('a'.repeat(24)));assert.equal(result[0].requiresFreeJoin,true);assert.equal(result[0].protectedFile,true);
 assert.equal(publicationsForTitle('serie-1',{[`${source}:10`]:posts[`${source}:10`]},source)[0].url,freePostUrl(10));
 assert.equal(publicationsForTitle('serie-1',posts,'-100999999')[0].url,'https://t.me/TheBrowser365/10');
});
