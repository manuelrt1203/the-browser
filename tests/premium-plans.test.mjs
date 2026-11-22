import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {premiumOffer,createPremiumOrder,orderOffer,calendarExpiry,confirmPremiumPayment,PREMIUM_PRICE_VERSION} from '../src/lib/subscription.ts';
import {liveCheckoutParameters,verifiedLiveStripeSession} from '../src/lib/premium-sales.ts';
import {sasPayOrderDescription,verifiedSasPayCheckoutResult,saspayTestClient} from '../src/lib/saspay.ts';

test('prix confirmés : 1500/4000/15000 XAF et 457/1300/5000 centimes EUR',()=>{
 for(const [plan,months,xaf,eur] of [['monthly',1,1500,457],['quarterly',3,4000,1300],['annual',12,15000,5000]]){
  for(const [provider,price] of [['saspay',xaf],['stripe',eur]]){
   const order=createPremiumOrder(randomUUID(),provider,plan);assert.equal(order.amountMinor,price);assert.equal(order.priceVersion,PREMIUM_PRICE_VERSION);assert.equal(orderOffer(order).months,months);
  }
 }
 assert.throws(()=>premiumOffer('stripe','weekly'));assert.throws(()=>premiumOffer('unknown','monthly'));
 const legacy=createPremiumOrder('old','saspay');assert.equal(orderOffer(legacy).amountMinor,3000);assert.equal(orderOffer(legacy).months,1);
 const annual=createPremiumOrder('new','saspay','annual');
 for(const change of [{amountMinor:1500},{priceVersion:undefined},{plan:undefined},{priceVersion:'future'}])assert.throws(()=>orderOffer({...annual,...change}));
});
test('trimestre et année : mois calendaires, fin de mois directe et 29 février',()=>{
 for(const [start,months,end] of [
  ['2026-11-22T12:34:56.123Z',3,'2027-02-22T12:34:56.123Z'],
  ['2026-01-31T12:00:00Z',3,'2026-04-30T12:00:00.000Z'],
  ['2026-11-30T12:00:00Z',3,'2027-02-28T12:00:00.000Z'],
  ['2028-02-29T12:00:00Z',12,'2029-02-28T12:00:00.000Z'],
  ['2026-11-22T12:00:00Z',12,'2027-11-22T12:00:00.000Z'],
 ])assert.equal(calendarExpiry(new Date(start),months).toISOString(),end);
 assert.throws(()=>calendarExpiry(new Date(),2));
 for(const plan of ['monthly','quarterly','annual']){
  const order=createPremiumOrder(randomUUID(),'stripe',plan),paid={orderId:order.id,provider:'stripe',paymentId:'pi_test',amountMinor:order.amountMinor,currency:'EUR',paidAt:'2028-02-29T12:00:00Z'};
  const confirmed=confirmPremiumPayment(order,paid);assert.equal(confirmed.expiresAt,calendarExpiry(new Date(paid.paidAt),premiumOffer('stripe',plan).months).toISOString());
  assert.equal(confirmPremiumPayment(confirmed,{...paid,paidAt:'2028-03-10T12:00:00Z'}).expiresAt,confirmed.expiresAt);
 }
});
test('Stripe : la session doit payer le prix de la formule enregistrée',()=>{
 for(const plan of ['quarterly','annual']){
  const order={...createPremiumOrder(randomUUID(),'stripe',plan),environment:'live',telegramUserId:'123',providerSessionId:'cs_live_example'};
  const params=liveCheckoutParameters(order.id,'https://example.com',order);assert.equal(params.line_items[0].price_data.unit_amount,order.amountMinor);assert.match(params.line_items[0].price_data.product_data.name,new RegExp(`${orderOffer(order).months} mois`));
  const session={id:order.providerSessionId,livemode:true,client_reference_id:order.id,mode:'payment',currency:'eur',amount_total:order.amountMinor,status:'complete',payment_status:'paid',payment_intent:'pi_example'};
  assert.equal(verifiedLiveStripeSession(order,session),'pi_example');assert.throws(()=>verifiedLiveStripeSession(order,{...session,amount_total:457}));
 }
});
test('SasPay : prix source propre à chaque durée, transaction liée et ancienne offre acceptée',async()=>{
 for(const plan of [undefined,'monthly','quarterly','annual']){
  const order={...createPremiumOrder(randomUUID(),'saspay',plan),environment:'live',telegramUserId:'123',providerFlow:'checkout',providerSessionId:randomUUID()};
  const payment={id:randomUUID(),status:'SUCCESS',currency:'EUR',requested_amount:'4.00',transaction_type:'PAIEMENT',flow_direction:'INBOUND',description:'',updated_at:'2026-11-22T12:00:00Z'};
  const session={id:order.providerSessionId,amount:`${order.amountMinor}.00`,currency:'XAF',description:sasPayOrderDescription(order.id,'live'),metadata:{order_id:order.id,environment:'live'},checkout_url:'https://checkout.saspay.me/checkout/session',transaction:payment.id};
  const state={id:session.id,status:'PAID',transaction_id:payment.id,transaction_status:'SUCCESS'};
  assert.equal(verifiedSasPayCheckoutResult(order,session,state,payment).payment.amountMinor,order.amountMinor);
  assert.throws(()=>verifiedSasPayCheckoutResult(order,{...session,amount:'1.00'},state,payment));
 }
 const fetch=globalThis.fetch;let body;
 try{
  globalThis.fetch=async(_,options)=>{body=JSON.parse(options.body);return Response.json({data:{id:randomUUID()}});};
  const order=createPremiumOrder(randomUUID(),'saspay','annual');
  await saspayTestClient('sk_test_fixture_not_a_real_key').createCheckout(order.id,{name:'Client Test',email:'test@example.com'},'https://example.com',order);
  assert.equal(body.amount,'15000.00');assert.equal(body.metadata.plan,'annual');assert.equal(body.metadata.months,'12');
 }finally{globalThis.fetch=fetch;}
});
