import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {REGIONAL_PRICE_VERSION,PRICING_COUNTRIES,regionalOffer,paymentDecimal,decimalMatches,formatRegionalAmount} from '../src/lib/regional-pricing.ts';
import {createPremiumOrder,orderOffer,confirmPremiumPayment} from '../src/lib/subscription.ts';
import {regionalProviderOptions} from '../src/lib/regional-payments.ts';
import {liveCheckoutParameters,verifiedLiveStripeSession} from '../src/lib/premium-sales.ts';
import {saspayTestClient,verifiedSasPayCheckoutResult} from '../src/lib/saspay.ts';

test('les 31 pays et 93 tarifs correspondent à la grille commerciale approuvée, indépendamment du prestataire',async()=>{
 const csv=(await readFile(new URL('../docs/regional-pricing-proposal.csv',import.meta.url),'utf8')).trim().replace(/^\uFEFF/,'').split(/\r?\n/).slice(1);
 assert.equal(csv.length,31);assert.equal(PRICING_COUNTRIES.length,31);assert.equal(new Set(PRICING_COUNTRIES.map(c=>c.code)).size,31);
 for(const line of csv){const [code,,zone,currency,...prices]=line.split(';');
  for(const [i,plan] of ['monthly','quarterly','annual'].entries()){
   const source=regionalOffer(code,plan);assert.equal(source.currency,currency);assert.equal(source.zone,zone);
   assert.equal(Number(paymentDecimal(source.amountMinor,currency)),Number(prices[i]));
   assert.ok(source.savingMinor>=0);
   for(const provider of ['stripe','saspay']){
    const order=createPremiumOrder(randomUUID(),provider,plan,code),offer=orderOffer(order);
    assert.equal(order.priceVersion,REGIONAL_PRICE_VERSION);assert.equal(order.countryCode,code);
    assert.equal(offer.amountMinor,source.amountMinor);assert.equal(offer.currency,source.currency);
   }
  }
 }
});
test('unités monétaires exactes : EUR et CDF en centimes, CFA/MGA/GNF sans centimes, TND en millièmes',()=>{
 for(const [country,minor,decimal] of [['FR',457,'4.57'],['CD',600000,'6000.00'],['CG',1500,'1500.00'],['GN',25000,'25000.00'],['MG',12000,'12000.00'],['TN',8000,'8.00']]){
  const offer=regionalOffer(country,'monthly');assert.equal(offer.amountMinor,minor);assert.equal(paymentDecimal(minor,offer.currency),decimal);
  assert.ok(decimalMatches(decimal,minor,offer.currency));assert.ok(decimalMatches(`${decimal}0`,minor,offer.currency));
  assert.equal(decimalMatches('1.00',minor,offer.currency),false);
  assert.equal(decimalMatches(`${Number(decimal)*100}`,minor,offer.currency),false);
 }
 assert.match(formatRegionalAmount(600000,'CDF'),/6\s000/);
 for(const value of ['NaN','1e3','-1500','1500.001','1500.0000',1500])assert.equal(decimalMatches(value,1500,'XAF'),false);
 for(const country of ['XX','XC','US','cg','__proto__',''])assert.throws(()=>regionalOffer(country,'monthly'));
 assert.throws(()=>regionalOffer('CG','weekly'));
});
test('une commande régionale falsifiée est refusée ; les deux générations historiques restent valables',()=>{
 const order=createPremiumOrder(randomUUID(),'saspay','annual','CG');
 for(const patch of [{amountMinor:1},{currency:'XOF'},{zone:'Europe francophone'},{countryCode:'FR'},{countryCode:undefined},{priceVersion:'2026-11-22'},{priceVersion:undefined}])assert.throws(()=>orderOffer({...order,...patch}));
 assert.equal(orderOffer(createPremiumOrder('old','saspay')).amountMinor,3000);
 assert.equal(orderOffer(createPremiumOrder('last-week','saspay','annual')).amountMinor,15000);
 const paid=confirmPremiumPayment(order,{orderId:order.id,provider:'saspay',paymentId:'pay_1',amountMinor:15000,currency:'XAF',paidAt:'2026-11-23T12:00:00Z'});
 assert.equal(paid.expiresAt,'2027-11-23T12:00:00.000Z');assert.equal(paid.countryCode,'CG');
});
test('disponibilité : pas de pays fictif global, mauvais sens, devise ou hors limites ; indisponibilité fermée',()=>{
 const rate=(country_code,currency,changes={})=>({country_code,currency,payin:{available:true,tiers:[{currency,min_amount:'1000.00',max_amount:'5000.00'}]},...changes});
 const options=regionalProviderOptions(['eur','xaf'],[rate('CG','XAF'),rate('SN','XAF'),rate('XX','EUR'),rate('GN','GNF',{payin:{available:false}})]);
 assert.equal(options.CG.monthly.saspay,true);assert.equal(options.CG.quarterly.saspay,true);assert.equal(options.CG.annual.saspay,false);
 assert.equal(options.FR.monthly.stripe,true);assert.equal(options.FR.monthly.saspay,false);
 assert.equal(options.SN.monthly.saspay,false);assert.equal(options.GN.monthly.saspay,false);
 assert.equal(options.TN.monthly.stripe,false);assert.equal(options.MR.monthly.stripe,false);
 assert.deepEqual(regionalProviderOptions([],[]).CG.monthly,{stripe:false,saspay:false});
});
test('Stripe facture exactement la devise de la commande, même au Congo et en RDC',()=>{
 for(const country of ['FR','CG','SN','CD','GN','MG']){
  const order={...createPremiumOrder(randomUUID(),'stripe','monthly',country),environment:'live',providerSessionId:'cs_live_example'};
  const params=liveCheckoutParameters(order.id,'https://example.com',order);
  assert.equal(params.line_items[0].price_data.currency,order.currency.toLowerCase());assert.equal(params.line_items[0].price_data.unit_amount,order.amountMinor);
  assert.equal(params.metadata.country,country);assert.equal(params.adaptive_pricing.enabled,false);
  const session={id:'cs_live_example',livemode:true,client_reference_id:order.id,mode:'payment',amount_total:order.amountMinor,currency:order.currency.toLowerCase(),status:'complete',payment_status:'paid',payment_intent:'pi_example'};
  assert.equal(verifiedLiveStripeSession(order,session),'pi_example');
  assert.throws(()=>verifiedLiveStripeSession(order,{...session,currency:'usd'}));assert.throws(()=>verifiedLiveStripeSession(order,{...session,amount_total:order.amountMinor*100}));
 }
});
test('SasPay : prix source régional décimal, pays présélectionné, vérification de session et transaction liée',async()=>{
 const original=globalThis.fetch;
 try{
  let body;globalThis.fetch=async(_,options)=>{body=JSON.parse(options.body);return Response.json({data:{id:randomUUID()}});};
  for(const country of ['FR','CG','SN','CD','GN','MG','TN']){
   const order={...createPremiumOrder(randomUUID(),'saspay','monthly',country),environment:'test',providerFlow:'checkout',providerSessionId:randomUUID()};
   await saspayTestClient('sk_test_fixture_not_a_real_key').createCheckout(order.id,{name:'Test Client',email:'test@example.com'},'https://example.com',order);
   assert.equal(body.country,country);assert.equal(body.currency,order.currency);assert.equal(body.amount,paymentDecimal(order.amountMinor,order.currency));assert.equal(body.metadata.price_version,REGIONAL_PRICE_VERSION);
   const payment={id:randomUUID(),status:'SUCCESS',currency:'EUR',requested_amount:'2.00',transaction_type:'PAIEMENT',flow_direction:'INBOUND',updated_at:'2026-11-23T12:00:00Z'};
   const session={...body,id:order.providerSessionId,transaction:payment.id,checkout_url:'https://sandbox-checkout.saspay.me/checkout/test'};
   const state={id:session.id,status:'PAID',transaction_id:payment.id,transaction_status:'SUCCESS'};
   assert.equal(verifiedSasPayCheckoutResult(order,session,state,payment).payment.currency,order.currency);
   assert.throws(()=>verifiedSasPayCheckoutResult(order,{...session,currency:'USD'},state,payment));
   assert.throws(()=>verifiedSasPayCheckoutResult(order,{...session,amount:'1.00'},state,payment));
   assert.throws(()=>verifiedSasPayCheckoutResult(order,session,state,{...payment,id:randomUUID()}));
  }
 }finally{globalThis.fetch=original;}
});
