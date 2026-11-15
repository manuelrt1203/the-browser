import test from 'node:test';
import assert from 'node:assert/strict';
import { premiumAuthStore, premiumEnvironment, premiumCookieName, premiumSiteOrigin,
  isPremiumSameOrigin, premiumTelegramReply } from '../src/lib/premium-auth.ts';
import { premiumTelegramUpdates } from '../scripts/telegram-updates.mjs';

async function isolated(run) {
  const names=['PREMIUM_ENVIRONMENT','PREMIUM_TELEGRAM_AUTH_ENABLED','SITE_URL','NODE_ENV'];
  const old=Object.fromEntries(names.map(n=>[n,process.env[n]]));const fetch=globalThis.fetch;
  try { await run(); } finally {
    globalThis.fetch=fetch;
    for(const [n,v] of Object.entries(old)){if(v===undefined)delete process.env[n];else process.env[n]=v;}
  }
}

test('notifications du webhook : ajout sans perte, abonnement global préservé, forme inconnue refusée',()=>{
  assert.deepEqual(premiumTelegramUpdates(undefined,true),[]);
  assert.deepEqual(premiumTelegramUpdates([],true),[]);
  const updates=premiumTelegramUpdates(['channel_post','edited_channel_post','my_chat_member'],true);
  assert.ok(updates.includes('my_chat_member'));assert.ok(updates.includes('message'));assert.ok(updates.includes('callback_query'));
  assert.deepEqual(premiumTelegramUpdates(updates,false),updates);
  assert.throws(()=>premiumTelegramUpdates('unknown',true));
});

test('auth : environnement serveur et cookies séparés entre test et réel',()=>isolated(async()=>{
  delete process.env.PREMIUM_ENVIRONMENT;assert.equal(premiumEnvironment(),'test');
  assert.equal(premiumCookieName(),'tb_premium_test_session');
  process.env.PREMIUM_ENVIRONMENT='live';assert.equal(premiumCookieName(),'tb_premium_live_session');
  process.env.PREMIUM_ENVIRONMENT='wrong';assert.throws(()=>premiumEnvironment());
  assert.throws(()=>premiumAuthStore('wrong'));
}));

test('auth : origine configurée obligatoire et HTTP limité au développement local',()=>isolated(async()=>{
  process.env.NODE_ENV='production';delete process.env.SITE_URL;assert.throws(()=>premiumSiteOrigin());
  for(const url of ['http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com/?secret=1']) {
    process.env.SITE_URL=url;assert.throws(()=>premiumSiteOrigin());
  }
  process.env.SITE_URL='https://example.com';
  assert.equal(isPremiumSameOrigin(new Request('https://internal/',{headers:{origin:'https://example.com'}})),true);
  assert.equal(isPremiumSameOrigin(new Request('https://internal/',{headers:{origin:'https://attacker.example'}})),false);
  assert.equal(isPremiumSameOrigin(new Request('https://internal/')),false);
  process.env.NODE_ENV='development';process.env.SITE_URL='http://127.0.0.1:3005';assert.equal(premiumSiteOrigin(),'http://127.0.0.1:3005');
}));

test('auth : cookie malformé ou absent ne déclenche aucun accès au stockage',()=>isolated(async()=>{
  globalThis.fetch=async()=>{throw Error('Accès réseau inattendu');};
  const auth=premiumAuthStore('test');
  for(const token of ['', '../file', 'a'.repeat(42)]) assert.deepEqual(await auth.status(token),{status:'anonymous'});
  assert.equal(await auth.claim('bad','123'),false);assert.equal(await auth.confirm('bad','123'),false);
}));

test('auth : notifications de groupe, bots, expéditeurs incohérents et autre environnement ignorés',()=>isolated(async()=>{
  process.env.PREMIUM_TELEGRAM_AUTH_ENABLED='1';process.env.PREMIUM_ENVIRONMENT='test';
  globalThis.fetch=async()=>{throw Error('Ne doit pas accéder à Redis');};
  const code='a'.repeat(32);
  for(const message of [
    {chat:{id:123,type:'group'},from:{id:123,is_bot:false},text:`/start premium_test_${code}`},
    {chat:{id:123,type:'private'},from:{id:456,is_bot:false},text:`/start premium_test_${code}`},
    {chat:{id:123,type:'private'},from:{id:123,is_bot:true},text:`/start premium_test_${code}`},
    {chat:{id:123,type:'private'},from:{id:123,is_bot:false},text:`/start premium_live_${code}`},
  ]) assert.equal(await premiumTelegramReply({message}),null);
  process.env.PREMIUM_TELEGRAM_AUTH_ENABLED='0';
  assert.equal(await premiumTelegramReply({message:{chat:{id:123,type:'private'},from:{id:123,is_bot:false},text:`/start premium_test_${code}`}}),null);
}));
