import test from 'node:test';
import assert from 'node:assert/strict';
import {channelAccessService,channelEntitlement,premiumChannelAccessEnabled} from '../src/lib/premium-channel-access.ts';
const now=new Date('2026-11-16T12:00:00Z'),end='2026-12-16T12:00:00Z';
const order=(changes={})=>({id:'order',provider:'stripe',status:'confirmed',amountMinor:457,currency:'EUR',environment:'live',telegramUserId:'123',providerSessionId:'cs_live_fixture',confirmedPaymentId:'pi_fixture',startsAt:'2026-11-01T12:00:00Z',expiresAt:end,...changes});
function fixture(initial=null){
 let record=initial,orders=[order()],member='left',failUnban=false,lease=true;
 const calls=[];
 const store={load:async()=>record,save:async r=>{if(!lease)throw new Error('lease');record=r},assertLease:async()=>{if(!lease)throw new Error('lease')}};
 const bot={member:async()=>member,invite:async until=>{calls.push(['invite',until]);return 'https://t.me/+fixture'},revoke:async()=>calls.push(['revoke']),approve:async()=>{calls.push(['approve']);member='member'},decline:async()=>calls.push(['decline']),ban:async()=>{calls.push(['ban']);member='kicked'},unban:async()=>{calls.push(['unban']);if(failUnban)throw new Error('network');member='left'}};
 const service=channelAccessService('-100123',store,bot,async()=>orders,()=>now);
 return {service,calls,get record(){return record},set orders(x){orders=x},set member(x){member=x},set failUnban(x){failUnban=x},set lease(x){lease=x}};
}
test('Accès canal : test, mauvais propriétaire, paiement incomplet et échéance exacte refusés',async()=>{
 for(const changes of [{environment:'test'},{telegramUserId:'456'},{status:'pending'},{confirmedPaymentId:undefined},{expiresAt:now.toISOString()},{startsAt:end}]){
  assert.equal(channelEntitlement([order(changes)],'123',now),null);
  const f=fixture();f.orders=[order(changes)];await assert.rejects(()=>f.service.invite('123'));assert.deepEqual(f.calls,[]);
 }
});
test('Accès canal : invitation courte réutilisée, sans admission immédiate',async()=>{
 const f=fixture();const r=await f.service.invite('123');assert.equal(r.member,false);assert.equal(f.record.status,'invited');
 assert.deepEqual(f.calls,[['invite',Math.floor(now.getTime()/1000)+600]]);
 await f.service.invite('123');assert.equal(f.calls.length,1);
});
test('Accès canal : lien transmis à un tiers ou autre lien jamais approuvé',async()=>{
 const f=fixture();await f.service.invite('123');
 await assert.rejects(()=>f.service.join('456','https://t.me/+fixture'));
 assert.equal(await f.service.join('123','https://t.me/+other'),false);
 assert.equal(f.calls.some(c=>c[0]==='approve'),false);
});
test('Accès canal : demande valide approuvée une fois, doublon acquitté',async()=>{
 const f=fixture();await f.service.invite('123');assert.equal(await f.service.join('123','https://t.me/+fixture'),true);
 await f.service.join('123','https://t.me/+fixture');assert.equal(f.calls.filter(c=>c[0]==='approve').length,1);assert.equal(f.record.status,'member');
});
test('Accès canal : expiration avant admission refusée, renouvellement protège le membre',async()=>{
 const f=fixture();await f.service.invite('123');f.orders=[];await f.service.join('123','https://t.me/+fixture');assert.ok(f.calls.some(c=>c[0]==='decline'));
 f.orders=[order()];f.member='member';assert.equal(await f.service.expire('123'),'active');assert.equal(f.calls.some(c=>c[0]==='ban'),false);
});
test('Accès canal : retrait expiré, reprise après échec de débannissement et répétition',async()=>{
 const f=fixture({userId:'123',channelId:'-100123',status:'member',expiresAt:'2026-11-01T00:00:00Z'});f.orders=[];f.member='member';f.failUnban=true;
 await assert.rejects(()=>f.service.expire('123'));assert.equal(f.record.status,'banned');
 f.failUnban=false;assert.equal(await f.service.expire('123'),'expired');assert.equal(f.calls.filter(c=>c[0]==='ban').length,1);
 assert.equal(await f.service.expire('123'),'ignored');
});
test('Accès canal : administrateurs protégés et perte de verrou sans action',async()=>{
 const record={userId:'123',channelId:'-100123',status:'member',expiresAt:end};
 const f=fixture(record);f.orders=[];f.member='administrator';await assert.rejects(()=>f.service.expire('123'));assert.deepEqual(f.calls,[]);
 const g=fixture();g.lease=false;await assert.rejects(()=>g.service.invite('123'));assert.deepEqual(g.calls,[]);
});
test('Accès canal : activation impossible dans environnement test',()=>{
 const names=['PREMIUM_ENVIRONMENT','PREMIUM_TELEGRAM_ACCESS_ENABLED'];const old=names.map(n=>process.env[n]);
 try{process.env.PREMIUM_TELEGRAM_ACCESS_ENABLED='1';process.env.PREMIUM_ENVIRONMENT='test';assert.equal(premiumChannelAccessEnabled(),false);process.env.PREMIUM_ENVIRONMENT='live';assert.equal(premiumChannelAccessEnabled(),true)}finally{names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i]})}
});

test('Accès canal : renouvellement après échec du retrait débloque le compte',async()=>{
 const f=fixture({userId:'123',channelId:'-100123',status:'banned',expiresAt:'2026-11-01T00:00:00Z'});f.member='kicked';
 assert.equal(await f.service.expire('123'),'active');assert.ok(f.calls.some(c=>c[0]==='unban'));assert.equal(f.record.status,'invited');
});
