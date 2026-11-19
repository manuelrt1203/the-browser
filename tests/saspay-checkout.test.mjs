import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {saspayTestClient,sasPayCheckoutCustomer,sasPayOrderDescription,verifiedSasPayCheckout,verifiedSasPayCheckoutResult} from '../src/lib/saspay.ts';
import {sasPayCheckoutUrl} from '../src/lib/saspay-checkout-url.ts';

test('URL checkout : hôte réellement renvoyé en Live et isolation stricte du Sandbox',()=>{
 for(const host of ['checkout.saspay.me','pay.saspay.me']){
  const url=`https://${host}/checkout/session`;
  assert.equal(sasPayCheckoutUrl(url,'live'),url);
  assert.throws(()=>sasPayCheckoutUrl(url,'test'));
 }
 assert.equal(sasPayCheckoutUrl('https://sandbox-checkout.saspay.me/checkout/session','test'),'https://sandbox-checkout.saspay.me/checkout/session');
 for(const url of ['https://sandbox-checkout.saspay.me/session','https://checkout.saspay.me.attacker.example/session','https://attacker.example/session','http://checkout.saspay.me/session','https://user:pass@checkout.saspay.me/session','https://checkout.saspay.me:8443/session'])assert.throws(()=>sasPayCheckoutUrl(url,'live'));
 const {order,session}=fixture();
 assert.equal(verifiedSasPayCheckout(order,{...session,checkout_url:'https://checkout.saspay.me/checkout/existing'}).checkoutUrl,'https://checkout.saspay.me/checkout/existing');
});

function fixture(){
 const id=randomUUID(),sessionId=randomUUID(),paymentId=randomUUID();
 const order={id,provider:'saspay',environment:'live',telegramUserId:'12345',status:'pending',amountMinor:3000,currency:'XAF',providerSessionId:sessionId,providerFlow:'checkout'};
 const session={id:sessionId,amount:'3000.00',currency:'XAF',description:sasPayOrderDescription(id,'live'),metadata:{order_id:id,environment:'live'},checkout_url:'https://pay.saspay.me/checkout/fixture',transaction:paymentId};
 const state={id:sessionId,status:'PAID',transaction_id:paymentId,transaction_status:'SUCCESS'};
 const payment={id:paymentId,status:'SUCCESS',requested_amount:'4.57',currency:'EUR',transaction_type:'PAIEMENT',flow_direction:'INBOUND',description:session.description,updated_at:'2026-11-19T14:00:00Z'};
 return {order,session,state,payment};
}
test('checkout : source XAF et transaction locale liée, seul verify SUCCESS confirme',()=>{
 const {order,session,state,payment}=fixture();
 const result=verifiedSasPayCheckoutResult(order,session,state,payment);
 assert.equal(result.status,'confirmed');assert.equal(result.payment.amountMinor,3000);assert.equal(result.payment.currency,'XAF');
 assert.equal(verifiedSasPayCheckoutResult(order,session,state,{...payment,description:''}).status,'confirmed','la relation marchande fait foi, sans copie de description supposée');
 assert.equal(result.payment.sessionId,session.id);assert.equal(result.payment.paymentId,payment.id);
 for(const change of [{status:'PENDING'},{id:randomUUID()},{transaction_type:'PAYOUT'},{flow_direction:'OUTBOUND'},{requested_amount:'0.00'},{updated_at:'invalid'}])assert.throws(()=>verifiedSasPayCheckoutResult(order,session,state,{...payment,...change}));
 assert.throws(()=>verifiedSasPayCheckoutResult(order,session,state));
 for(const change of [{id:randomUUID()},{transaction_id:randomUUID()},{transaction_status:'PENDING'}])assert.throws(()=>verifiedSasPayCheckoutResult(order,session,{...state,...change},payment));
});
test('checkout : prix initial, commande, environnement et lien sécurisés avant conversion',()=>{
 const {order,session,state,payment}=fixture();
 for(const change of [{amount:'1.00'},{currency:'EUR'},{metadata:{order_id:randomUUID(),environment:'live'}},{metadata:{order_id:order.id,environment:'test'}},{id:randomUUID()},{transaction:randomUUID()},{checkout_url:'https://attacker.example/pay'}])assert.throws(()=>verifiedSasPayCheckoutResult(order,{...session,...change},state,payment));
 assert.throws(()=>verifiedSasPayCheckoutResult({...order,providerFlow:undefined},session,state,payment),'legacy softpay cannot be reinterpreted');
 assert.throws(()=>verifiedSasPayCheckout({...order,environment:'test'},session));
});
test('checkout : échec réessayable chez SasPay, annulation et expiration terminales',()=>{
 const {order,session,state}=fixture();
 assert.equal(verifiedSasPayCheckoutResult(order,session,{...state,status:'PENDING',transaction_status:'FAILED'}).status,'pending');
 for(const status of ['EXPIRED','CANCELLED'])assert.equal(verifiedSasPayCheckoutResult(order,session,{...state,status}).status,'cancelled');
 assert.throws(()=>verifiedSasPayCheckoutResult(order,session,{...state,status:'UNKNOWN'}));
});
test('checkout : nom/e-mail, aucun numéro ni réseau imposé par le site',()=>{
 assert.deepEqual(sasPayCheckoutCustomer({name:' Awa Test ',email:' client@example.com '}),{name:'Awa Test',email:'client@example.com'});
 for(const input of [null,{}, {name:'Test',email:'invalid'},{name:'Test\nInjected',email:'test@example.com'}])assert.throws(()=>sasPayCheckoutCustomer(input));
});
test('checkout sandbox : champs documentés, prix serveur et pays omis, récupération paginée',async()=>{
 const original=globalThis.fetch,id=randomUUID(),sessionId=randomUUID();let body;
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(new URL(url).origin,'https://sandbox-api.saspay.me');assert.equal(options.redirect,'error');
   if(options.method==='POST'){
    body=JSON.parse(options.body);assert.equal(options.headers['Idempotency-Key'],undefined);
    return Response.json({data:{id:sessionId}});
   }
   return Response.json({data:{results:[{id:sessionId,metadata:{order_id:id,environment:'test'}}],next:null}});
  };
  const client=saspayTestClient('sk_test_fixture_not_a_real_key');
  await client.createCheckout(id,{name:'Awa Test',email:'test@example.com',amount:'1',country:'CG'},'https://example.com');
  assert.equal(body.amount,'3000.00');assert.equal(body.currency,'XAF');assert.equal(body.fee_charge_mode,'DEDUCTED');
  for(const field of ['country','network','customer_phone'])assert.equal(body[field],undefined);
  assert.equal(body.return_url,`https://example.com/premium?order=${id}`);
  assert.equal((await client.findCheckout(id)).id,sessionId);
 }finally{globalThis.fetch=original;}
});
