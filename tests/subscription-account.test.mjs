import test from 'node:test';
import assert from 'node:assert/strict';
import {subscriptionAccount} from '../src/lib/subscription-account.ts';
const now=new Date('2026-11-16T12:00:00Z');
const order=(changes={})=>({id:'fixture-order',provider:'stripe',amountMinor:457,currency:'EUR',status:'confirmed',environment:'test',telegramUserId:'123',providerSessionId:'cs_test_private',confirmedPaymentId:'pi_private',providerCheckoutUrl:'https://example.invalid/private',startsAt:'2026-11-01T12:00:00Z',expiresAt:'2026-12-01T12:00:00Z',...changes});
test('Compte : période active prioritaire, échéance la plus éloignée sans cumul, données privées exclues',()=>{
 const result=subscriptionAccount([order(),order({id:'second',expiresAt:'2026-12-16T12:00:00Z'}),order({id:'pending',status:'pending',startsAt:undefined,expiresAt:undefined})],'test','123',now);
 assert.equal(result.status,'active');assert.equal(result.expiresAt,'2026-12-16T12:00:00Z');assert.equal(result.renewal,'manual');
 for(const key of ['telegramUserId','providerSessionId','confirmedPaymentId','providerCheckoutUrl'])assert.equal(JSON.stringify(result).includes(key),false);
});
test('Compte : propriétaire et environnement imposés, échec plutôt que fuite',()=>{
 assert.throws(()=>subscriptionAccount([order({telegramUserId:'456'})],'test','123',now));
 assert.throws(()=>subscriptionAccount([order({environment:'live'})],'test','123',now));
});
test('Compte : échéance exacte, historique expiré et absence de commande',()=>{
 const result=subscriptionAccount([order({expiresAt:now.toISOString()})],'test','123',now);
 assert.equal(result.status,'expired');assert.equal(result.orders[0].status,'expired');assert.equal(result.expiresAt,null);
 assert.equal(subscriptionAccount([],'live','123',now).status,'inactive');
 assert.equal(subscriptionAccount([order({startsAt:'2027-01-01T00:00:00Z',expiresAt:'2027-02-01T00:00:00Z'})],'test','123',now).orders[0].status,'upcoming');
});
