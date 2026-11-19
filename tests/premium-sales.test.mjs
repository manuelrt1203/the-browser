import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {livePaymentRuntime,premiumSalesEnabled,liveProviderReady,liveProviderEnabled,liveCheckoutParameters,verifiedLiveStripeSession,purchaseConflict,stripeLiveClient,stripeLiveAccountReady,stripeLiveWebhookConfigured} from '../src/lib/premium-sales.ts';
import {saspayLiveClient,sasPayOrderDescription,verifiedSasPayResult} from '../src/lib/saspay.ts';
const env={VERCEL:'1',VERCEL_ENV:'production',PREMIUM_ENVIRONMENT:'live',PREMIUM_SALES_ENABLED:'1',COMMERCE_REVIEWED:'1',PREMIUM_TELEGRAM_AUTH_ENABLED:'1',PREMIUM_TELEGRAM_ACCESS_ENABLED:'1',SELLER_NAME:'Fixture',SELLER_LEGAL_STATUS:'EI',SELLER_ADDRESS:'Adresse de test',SELLER_COUNTRY:'FR',SELLER_REGISTRATION:'fixture-registration',COMMERCIAL_TERMS_VERSION:'fixture-v1',SUPPORT_EMAIL:'support@example.com',STRIPE_SECRET_KEY:'sk_live_fixture',STRIPE_WEBHOOK_SECRET_LIVE:'whsec_fixture',STRIPE_LIVE_ENABLED:'1'};
const id=randomUUID();
function order(){return {id,provider:'stripe',environment:'live',telegramUserId:'12345',amountMinor:457,currency:'EUR',status:'pending',providerSessionId:'cs_live_fixture'}}
function session(){return {id:'cs_live_fixture',client_reference_id:id,mode:'payment',livemode:true,status:'complete',payment_status:'paid',currency:'eur',amount_total:457,payment_intent:'pi_fixture'}}
test('activation explicite et moyen live requis, aucune ouverture accidentelle depuis les tests',()=>{
 assert.equal(premiumSalesEnabled(env),true);
 assert.equal(premiumSalesEnabled({...env,SELLER_ADDRESS:'',SELLER_REGISTRATION:''}),true,'décision explicite du propriétaire de lancer avant complétion des coordonnées');
 for(const key of ['SELLER_NAME','SUPPORT_EMAIL','COMMERCIAL_TERMS_VERSION','PREMIUM_SALES_ENABLED','STRIPE_SECRET_KEY'])assert.equal(premiumSalesEnabled({...env,[key]:''}),false);
 for(const change of [{VERCEL_ENV:'preview'},{PREMIUM_ENVIRONMENT:'test'},{VERCEL:''}]){assert.equal(livePaymentRuntime({...env,...change}),false);assert.equal(premiumSalesEnabled({...env,...change}),false)}
});
test('modes de clés stricts, aucun marqueur ou clé test sur adaptateurs live',()=>{
 assert.equal(liveProviderReady('stripe',{STRIPE_SECRET_KEY:'sk_live_fixture',STRIPE_WEBHOOK_SECRET_LIVE:'whsec_fixture'}),true);
 assert.equal(liveProviderReady('stripe',{STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET_LIVE:'whsec_fixture'}),false);
 assert.equal(liveProviderReady('saspay',{SASPAY_API_KEY:'sk_live_fixture',SASPAY_WEBHOOK_SECRET:'__managed_codex_secret_fixture__',SASPAY_LIVE_FEE_MODE:'DEDUCTED'}),false);
 assert.equal(liveProviderReady('saspay',{SASPAY_API_KEY:'sk_live_fixture',SASPAY_WEBHOOK_SECRET:'raw_fixture'}),false);
 for(const key of ['','sk_test_fixture','__managed_codex_secret_fixture__'])assert.throws(()=>stripeLiveClient(key));
});
test('Stripe live : propriétaire de commande, montant, devise et mode du paiement obligatoires',()=>{
 assert.equal(verifiedLiveStripeSession(order(),session()),'pi_fixture');
 for(const change of [{livemode:false},{client_reference_id:randomUUID()},{id:'cs_test_fixture'},{currency:'xaf'},{amount_total:1},{mode:'subscription'},{payment_intent:null}])assert.throws(()=>verifiedLiveStripeSession(order(),{...session(),...change}));
 assert.throws(()=>verifiedLiveStripeSession({...order(),environment:'test'},session()));
 assert.equal(verifiedLiveStripeSession(order(),{...session(),payment_status:'unpaid'}),null);
});
test('Checkout live est un achat ponctuel, prix serveur et retour local encodé',()=>{
 const p=liveCheckoutParameters(id,'https://example.com');assert.equal(p.mode,'payment');assert.equal(p.line_items[0].price_data.unit_amount,457);assert.equal(p.line_items[0].price_data.currency,'eur');assert.match(p.success_url,/^https:\/\/example.com\/premium\?order=/);
 for(const origin of ['http://example.com','https://user:secret@example.com','https://example.com/other','https://example.com?x=1'])assert.throws(()=>liveCheckoutParameters(id,origin));
});
test('aucun double achat sur compte actif ou ayant un paiement en attente',()=>{
 const now=new Date('2026-11-19T12:00:00Z');
 assert.equal(purchaseConflict([order()],id,now),false);
 assert.equal(purchaseConflict([{...order(),id:randomUUID()}],id,now),true);
 assert.equal(purchaseConflict([{...order(),id:randomUUID(),status:'confirmed',startsAt:'2026-11-01T00:00:00Z',expiresAt:'2026-12-01T00:00:00Z'}],id,now),true);
 assert.equal(purchaseConflict([{...order(),id:randomUUID(),status:'failed'}],id,now),false);
});
test('SasPay distingue les références de commande test et live',()=>{
 const live={...order(),provider:'saspay',currency:'XAF',amountMinor:3000,providerSessionId:randomUUID()};
 const p={id:live.providerSessionId,status:'SUCCESS',currency:'XAF',requested_amount:'3000.00',transaction_type:'PAIEMENT',flow_direction:'INBOUND',updated_at:'2026-11-19T12:00:00Z',description:sasPayOrderDescription(live.id,'live')};
 assert.equal(verifiedSasPayResult(live,p).status,'confirmed');
 assert.throws(()=>verifiedSasPayResult(live,{...p,description:sasPayOrderDescription(live.id,'test')}));
 assert.throws(()=>verifiedSasPayResult({...live,environment:'test'},p));
});
test('SasPay live : domaine production explicite, prix décimal et frais retenus sur montant',async()=>{
 const previousFetch=globalThis.fetch,previousPolicy=process.env.SASPAY_LIVE_FEE_MODE;
 process.env.SASPAY_LIVE_FEE_MODE='DEDUCTED';let initiation;
 const country=randomUUID(),paymentId=randomUUID();
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(new URL(url).origin,'https://api.saspay.me');assert.equal(options.redirect,'error');
   if(url.endsWith('/countries/'))return Response.json({data:[{id:country,iso_code:'CG',is_active:true,default_currency:'XAF'}]});
   if(url.includes('/networks/'))return Response.json({data:{next:null,results:[{country,code:'actual_mtn',name:'MTN',is_active:true}]}});
   initiation=JSON.parse(options.body);return Response.json({data:{id:paymentId,status:'PENDING',checkout_url:'https://pay.saspay.me/fixture'}});
  };
  assert.throws(()=>saspayLiveClient('sk_test_fixture_not_a_real_key'));
  const client=saspayLiveClient('sk_live_fixture_not_a_real_key');
  await client.initiate(id,{firstName:'Test',lastName:'Client',email:'test@example.com',phone:'+242061234560',network:'actual_mtn'});
  assert.equal(initiation.amount,'3000.00');assert.equal(initiation.fee_charge_mode,'DEDUCTED');assert.equal(initiation.description,sasPayOrderDescription(id,'live'));
 }finally{globalThis.fetch=previousFetch;if(previousPolicy===undefined)delete process.env.SASPAY_LIVE_FEE_MODE;else process.env.SASPAY_LIVE_FEE_MODE=previousPolicy;}
});

test('un compte Stripe restreint ne passe pas la vérification de mise en vente',async()=>{
 const client=(livemode,charges,payouts)=>({balance:{retrieve:async()=>({livemode})},accounts:{retrieve:async()=>({charges_enabled:charges,payouts_enabled:payouts})}});
 assert.equal(await stripeLiveAccountReady(client(true,true,true)),true);
 for(const args of [[false,true,true],[true,false,true],[true,true,false]])assert.equal(await stripeLiveAccountReady(client(...args)),false);
});

test('un prestataire configuré mais non activé reste inaccessible même si l’autre est ouvert',()=>{
 const both={...env,SASPAY_API_KEY:'sk_live_fixture',SASPAY_WEBHOOK_SECRET:'raw_fixture',SASPAY_LIVE_FEE_MODE:'DEDUCTED',SASPAY_LIVE_ENABLED:'1',STRIPE_LIVE_ENABLED:'0'};
 assert.equal(premiumSalesEnabled(both),true);
 assert.equal(liveProviderReady('stripe',both),true);
 assert.equal(liveProviderEnabled('stripe',both),false);
 assert.equal(liveProviderEnabled('saspay',both),true);
 assert.equal(premiumSalesEnabled({...both,SASPAY_LIVE_ENABLED:'0'}),false);
});
test('vérifie destination Live et événements réellement enregistrés chez SasPay',async()=>{
 const original=globalThis.fetch,policy=process.env.SASPAY_LIVE_FEE_MODE;process.env.SASPAY_LIVE_FEE_MODE='DEDUCTED';
 const hook=randomUUID(),expected='https://example.com/api/saspay/webhook';let url=expected,environment='LIVE',events=['transaction.success','transaction.failed','transaction.cancelled'];
 try{
  globalThis.fetch=async input=>{const path=new URL(input).pathname;
   return Response.json({data:{next:null,results:path==='/api/v1/merchant-webhooks/'?[{id:hook,url,environment,is_active:true}]:events.map(event_type=>({webhook:hook,event_type}))}});
  };
  const client=saspayLiveClient('sk_live_fixture_not_a_real_key');assert.equal(await client.webhookConfigured(expected),true);
  url='https://old.example/webhooks/saspay';assert.equal(await client.webhookConfigured(expected),false);url=expected;
  environment='SANDBOX';assert.equal(await client.webhookConfigured(expected),false);environment='LIVE';
  events=['transaction.failed','transaction.cancelled'];assert.equal(await client.webhookConfigured(expected),false);
 }finally{globalThis.fetch=original;if(policy===undefined)delete process.env.SASPAY_LIVE_FEE_MODE;else process.env.SASPAY_LIVE_FEE_MODE=policy;}
});

test('vérifie le webhook Stripe du même compte Live avant activation',async()=>{
 const url='https://example.com/api/stripe/webhook';
 const endpoint={url,livemode:true,status:'enabled',enabled_events:['*']};
 const client={webhookEndpoints:{list:async()=>({data:[endpoint]})}};
 assert.equal(await stripeLiveWebhookConfigured(client,url),true);
 endpoint.url='https://old.example/webhook';assert.equal(await stripeLiveWebhookConfigured(client,url),false);endpoint.url=url;
 endpoint.livemode=false;assert.equal(await stripeLiveWebhookConfigured(client,url),false);endpoint.livemode=true;
 endpoint.enabled_events=['checkout.session.completed'];assert.equal(await stripeLiveWebhookConfigured(client,url),false);
});
