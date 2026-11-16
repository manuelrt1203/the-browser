import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac,randomUUID } from 'node:crypto';
import { saspayTestClient,sasPayCustomer,verifySasPaySignature,verifiedSasPayResult,saspayTestEnabled,sasPayOrderDescription } from '../src/lib/saspay.ts';
import { createPremiumOrder } from '../src/lib/subscription.ts';

const customer={firstName:'Test',lastName:'Client',email:'client@example.com',phone:'+242061234567',network:'fixture_mtn_cg'};
test('SasPay : aucune clé réelle ou marqueur proxy ne peut initier un paiement de test',()=>{
  for(const key of ['', 'sk_live_not_a_real_fixture_key','proxy_placeholder_fixture'])assert.throws(()=>saspayTestClient(key));
});
test('SasPay : identité client et numéro Congo-Brazzaville obligatoires',()=>{
  assert.equal(sasPayCustomer({...customer,phone:'+242 06 123 45 67',amount:1}).phone,'+242061234567');
  for(const input of [{...customer,phone:'+243061234567'},{...customer,email:'wrong'},{...customer,firstName:''},null])assert.throws(()=>sasPayCustomer(input));
});
test('SasPay : signature corps brut/horodatage, rejet des valeurs malformées et anciennes',()=>{
  const body=JSON.stringify({event:'transaction.success',data:{id:randomUUID()}});const secret='local_fixture_secret';const timestamp='1794820000';const now=Number(timestamp)*1000;
  const signature=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
  assert.equal(verifySasPaySignature(body,signature,timestamp,secret,now),true);
  for(const [b,s,t,n] of [[body+' ',signature,timestamp,now],[body,signature,'NaN',now],[body,signature,timestamp,now+301000],[body,'abc',timestamp,now],[body,signature,timestamp,now-301000]])assert.equal(verifySasPaySignature(b,s,t,secret,n),false);
});
test('SasPay : montant demandé exact, devise, sens entrant et paiement rapproché requis',()=>{
  const id=randomUUID(),paymentId=randomUUID();const order={...createPremiumOrder(id,'saspay'),environment:'test',telegramUserId:'123',providerSessionId:paymentId};
  const payment={id:paymentId,status:'SUCCESS',currency:'XAF',requested_amount:'3000.00',transaction_type:'PAIEMENT',flow_direction:'INBOUND',updated_at:'2026-11-16T10:00:00Z',description:sasPayOrderDescription(id)};
  assert.equal(verifiedSasPayResult(order,payment).status,'confirmed');
  for(const change of [{id:randomUUID()},{currency:'XOF'},{requested_amount:'3000.01'},{requested_amount:3000},{flow_direction:'OUTBOUND'},{transaction_type:'PAYOUT'},{updated_at:'bad'},{description:'another order'}])assert.throws(()=>verifiedSasPayResult(order,{...payment,...change}));
  assert.equal(verifiedSasPayResult(order,{...payment,status:'PENDING'}).status,'pending');
  assert.equal(verifiedSasPayResult(order,{...payment,status:'FAILED'}).status,'failed');
});
test('SasPay : référentiel réel filtré par pays et réseau actif, prix serveur et idempotence',async()=>{
  const old=globalThis.fetch;const country=randomUUID(),paymentId=randomUUID(),order=randomUUID();let initiation;let redirect='https://pay.saspay.me/checkout/fixture';
  try{
    globalThis.fetch=async(url,options)=>{
      if(url.endsWith('/countries/'))return Response.json({success:true,data:[{id:country,iso_code:'CG',is_active:true,default_currency:'XAF'}]});
      if(url.includes('/networks/'))return Response.json({success:true,data:{next:null,results:[
        {country,code:'fixture_mtn_cg',name:'MTN',is_active:true},
        {country:'other',code:'fixture_mtn_cd',name:'MTN',is_active:true},
        {country,code:'fixture_airtel_cg',name:'Airtel',is_active:false}]}});
      initiation={body:JSON.parse(options.body),headers:options.headers};return Response.json({success:true,data:{id:paymentId,status:'PENDING',checkout_url:redirect}});
    };
    const client=saspayTestClient('sk_test_fixture_not_a_real_key');
    assert.deepEqual(await client.networks(),[{code:'fixture_mtn_cg',name:'MTN'}]);
    assert.equal((await client.initiate(order,{...customer,amount:1,currency:'EUR'})).id,paymentId);
    assert.equal(initiation.body.amount,'3000');assert.equal(initiation.body.currency,'XAF');assert.equal(initiation.body.country,'CG');
    assert.equal(initiation.headers['Idempotency-Key'],`the-browser-saspay-test-${order}`);
    await assert.rejects(()=>client.initiate(order,{...customer,network:'fixture_mtn_cd'}));
    redirect='https://attacker.example/checkout';await assert.rejects(()=>client.initiate(order,customer),e=>e.code==='REDIRECT_UNSUPPORTED');
  }finally{globalThis.fetch=old;}
});
test('SasPay : erreurs prestataire expurgées',async()=>{
  const old=globalThis.fetch;
  try{
    globalThis.fetch=async()=>Response.json({success:false,error:'sk_test_fixture_not_a_real_key'},{status:401});
    await assert.rejects(()=>saspayTestClient('sk_test_fixture_not_a_real_key').verify(randomUUID()),e=>!e.message.includes('sk_test_'));
  }finally{globalThis.fetch=old;}
});
test('SasPay : pilote désactivé sur le site de production',()=>{
  const names=['NODE_ENV','VERCEL','VERCEL_ENV','SASPAY_TEST_ENABLED','PREMIUM_ENVIRONMENT'];const old=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  try{
    process.env.NODE_ENV='development';delete process.env.VERCEL;process.env.VERCEL_ENV='production';process.env.SASPAY_TEST_ENABLED='1';process.env.PREMIUM_ENVIRONMENT='test';assert.equal(saspayTestEnabled(),true);
    process.env.NODE_ENV='production';assert.equal(saspayTestEnabled(),false);
    process.env.NODE_ENV='development';process.env.VERCEL='1';assert.equal(saspayTestEnabled(),false);
  }finally{for(const[n,v]of Object.entries(old)){if(v===undefined)delete process.env[n];else process.env[n]=v;}}
});
