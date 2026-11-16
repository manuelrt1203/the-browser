import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn,execFile as callback } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID,createHmac } from 'node:crypto';
import Stripe from 'stripe';

const execFile=promisify(callback);
test('Parcours HTTP : Telegram confirmé → commandes Redis → Stripe et SasPay vérifiés',async()=>{
  if(!process.env.REDIS_TEST_SERVER||!process.env.REDIS_TEST_CLI)throw Error('Configurer les binaires Redis de test');
  const directory=await mkdtemp(join(tmpdir(),'premium-flow-'));const socket=join(directory,'redis.sock');
  const paymentState=join(directory,'provider-state.json');await writeFile(paymentState,JSON.stringify({saspayPaid:false}));
  const redis=spawn(process.env.REDIS_TEST_SERVER,['--port','0','--unixsocket',socket,'--save','','--appendonly','no','--dir',directory],{stdio:'ignore'});
  let app;let logs='';
  async function command(args){const {stdout}=await execFile(process.env.REDIS_TEST_CLI,['-s',socket,'--json',...args.map(String)]);return JSON.parse(stdout);}
  try{
    let ready=false;
    for(let i=0;i<100;i++){try{if(await command(['PING'])==='PONG'){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,20));}
    assert.ok(ready);
    const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
    const origin=`http://127.0.0.1:${port}`;
    const webhookSecret='whsec_fixture_for_isolated_http_test';
    app=spawn(process.execPath,['--import',resolve('tests/fixtures/premium-runtime.mjs'),resolve('node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{
      env:{...process.env,PREMIUM_TEST_FIXTURES:'1',PREMIUM_TEST_REDIS_SOCKET:socket,PREMIUM_TEST_PAYMENT_STATE:paymentState,
        NODE_ENV:'development',PREMIUM_ENVIRONMENT:'test',PREMIUM_TELEGRAM_AUTH_ENABLED:'1',SITE_URL:origin,
        KV_REST_API_URL:'https://premium-redis.invalid',KV_REST_API_TOKEN:'local-fixture-token',
        TELEGRAM_CHANNEL_ID:'-1004339801492',TELEGRAM_WEBHOOK_SECRET:'telegram_fixture_secret',
        TELEGRAM_WEBHOOK_SECRET_NEXT:'telegram_fixture_next_secret',
        STRIPE_TEST_CHECKOUT_ENABLED:'1',STRIPE_SECRET_KEY_TEST:'sk_test_fixture_not_a_real_key',STRIPE_WEBHOOK_SECRET:webhookSecret,
        SASPAY_TEST_ENABLED:'1',SASPAY_API_KEY_TEST:'sk_test_fixture_not_a_real_key',SASPAY_WEBHOOK_SECRET:'saspay_local_fixture_secret',
        VERCEL:'',NODE_USE_ENV_PROXY:'0',NODE_OPTIONS:''},stdio:['ignore','pipe','pipe']});
    for(const stream of [app.stdout,app.stderr])stream.on('data',chunk=>{logs=(logs+chunk.toString()).slice(-16000);});
    ready=false;
    for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/premium/auth/session')).status===200){ready=true;break;}}catch{}if(app.exitCode!==null)break;await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready,'Next doit démarrer : '+logs.slice(-2000));
    const post=(path,body,headers={})=>fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)});
    let updateId=100;
    const telegram=update=>post('/api/telegram',{update_id:updateId++,...update},{'x-telegram-bot-api-secret-token':'telegram_fixture_secret'});
    assert.equal((await fetch(origin+'/api/premium/auth/start',{method:'POST',headers:{origin:'https://attacker.example'}})).status,403);
    async function login(user){
      const response=await post('/api/premium/auth/start',{});assert.equal(response.status,200);
      const rawCookie=response.headers.get('set-cookie');assert.match(rawCookie,/HttpOnly/i);assert.match(rawCookie,/SameSite=lax/i);
      const cookie=rawCookie.split(';')[0];const link=new URL((await response.json()).telegramUrl);const payload=link.searchParams.get('start');
      const start=await telegram({message:{chat:{id:user,type:'private'},from:{id:user,is_bot:false},text:`/start ${payload}`}});
      assert.equal(start.status,200);const prompt=await start.json();assert.equal(prompt.method,'sendMessage');
      const status=await fetch(origin+'/api/premium/auth/session',{headers:{cookie}});assert.equal((await status.json()).status,'pending');
      assert.equal((await post('/api/stripe/test/checkout',{}, {cookie,'idempotency-key':randomUUID()})).status,401);
      const callback={id:`cb_${user}`,from:{id:user,is_bot:false},message:{chat:{id:user,type:'private'}},data:prompt.reply_markup.inline_keyboard[0][0].callback_data};
      const forged=await telegram({callback_query:{...callback,from:{id:user+1,is_bot:false}}});assert.equal((await forged.json()).ignored,true);
      const confirm=await telegram({callback_query:callback});assert.equal(confirm.status,200);assert.match((await confirm.json()).text,/Compte associé/);
      const session=await fetch(origin+'/api/premium/auth/session',{headers:{cookie}});assert.equal((await session.json()).telegramUserId,String(user));
      return cookie;
    }
    const cookie=await login(12345);const otherCookie=await login(54321);const orderId=randomUUID();
    const response=await post('/api/stripe/test/checkout',{telegramUserId:'54321',amount:1},{cookie,'idempotency-key':orderId});
    assert.equal(response.status,200);const checkout=await response.json();
    const repeat=await post('/api/stripe/test/checkout',{}, {cookie,'idempotency-key':orderId});assert.equal((await repeat.json()).checkoutUrl,checkout.checkoutUrl);
    const rawOrder=await command(['GET',`the-browser:{premium:test}:order:${orderId}`]);const order=JSON.parse(rawOrder);
    assert.equal(order.telegramUserId,'12345');assert.equal(order.amountMinor,457);assert.equal(order.status,'pending');
    assert.equal((await fetch(origin+`/api/stripe/test/status?order=${orderId}`,{headers:{cookie:otherCookie}})).status,404);
    assert.equal((await post('/api/stripe/test/checkout',{}, {cookie:otherCookie,'idempotency-key':orderId})).status,503);
    const event={id:'evt_http_paid',object:'event',type:'checkout.session.completed',created:Math.floor(Date.now()/1000),livemode:false,data:{object:{id:order.providerSessionId,payment_status:'paid'}}};
    const client=new Stripe('sk_test_fixture_not_a_real_key');const payload=JSON.stringify(event);const signature=client.webhooks.generateTestHeaderString({payload,secret:webhookSecret});
    assert.equal((await fetch(origin+'/api/stripe/test/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload+' '})).status,400);
    const send=()=>fetch(origin+'/api/stripe/test/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload});
    assert.equal((await send()).status,200);
    const status=await fetch(origin+`/api/stripe/test/status?order=${orderId}`,{headers:{cookie}});const paid=await status.json();assert.equal(paid.status,'confirmed');assert.equal(paid.telegramAccessGranted,false);
    assert.equal((await send()).status,200);
    assert.equal(JSON.parse(await command(['GET',`the-browser:{premium:test}:order:${orderId}`])).expiresAt,paid.expiresAt);
    const networks=await fetch(origin+'/api/saspay/test/networks',{headers:{cookie}}).then(r=>r.json());assert.equal(networks.networks.length,2);
    const sasOrder=randomUUID();const customer={firstName:'Test',lastName:'Client',email:'client@example.com',phone:'+242061234567',network:'fixture_mtn_cg',amount:1,telegramUserId:'54321'};
    const sasResponse=await post('/api/saspay/test/payment',customer,{cookie,'idempotency-key':sasOrder});assert.equal(sasResponse.status,200);const sas=await sasResponse.json();assert.equal(sas.status,'pending');
    const sasReplay=await post('/api/saspay/test/payment',customer,{cookie,'idempotency-key':sasOrder}).then(r=>r.json());assert.equal(sasReplay.checkoutUrl,sas.checkoutUrl);
    const storedSas=JSON.parse(await command(['GET',`the-browser:{premium:test}:order:${sasOrder}`]));assert.equal(storedSas.amountMinor,3000);assert.equal(storedSas.telegramUserId,'12345');
    assert.equal((await fetch(origin+`/api/saspay/test/status?order=${sasOrder}`,{headers:{cookie:otherCookie}})).status,404);
    const sasBody=JSON.stringify({event:'transaction.success',data:{id:storedSas.providerSessionId,status:'SUCCESS'}});const timestamp=String(Math.floor(Date.now()/1000));
    const sasSignature=createHmac('sha256','saspay_local_fixture_secret').update(`${timestamp}.${sasBody}`).digest('hex');
    const sendSas=(body=sasBody)=>fetch(origin+'/api/saspay/test/webhook',{method:'POST',headers:{'x-webhook-signature':sasSignature,'x-webhook-timestamp':timestamp,'x-webhook-event':'transaction.success'},body});
    assert.equal((await sendSas(sasBody+' ')).status,400);assert.equal((await sendSas()).status,200);
    assert.equal(JSON.parse(await command(['GET',`the-browser:{premium:test}:order:${sasOrder}`])).status,'pending','un webhook succès ne remplace pas la vérification prestataire');
    // Simulate a crash after the provider push but before local payment binding.
    const unbound={...storedSas};delete unbound.providerSessionId;delete unbound.providerCheckoutUrl;
    await command(['SET',`the-browser:{premium:test}:order:${sasOrder}`,JSON.stringify(unbound)]);
    await command(['DEL',`the-browser:{premium:test}:session:saspay:${storedSas.providerSessionId}`]);
    await writeFile(paymentState,JSON.stringify({saspayPaid:true}));assert.equal((await sendSas()).status,200);
    const sasPaid=JSON.parse(await command(['GET',`the-browser:{premium:test}:order:${sasOrder}`]));assert.equal(sasPaid.status,'confirmed');
    assert.equal((await sendSas()).status,200);assert.equal(JSON.parse(await command(['GET',`the-browser:{premium:test}:order:${sasOrder}`])).expiresAt,sasPaid.expiresAt);
    // Public channel route continues to save ordinary publications through its original Lua.
    const publication=await telegram({channel_post:{message_id:999,date:Math.floor(Date.now()/1000),chat:{id:-1004339801492,type:'channel'},text:''}});
    assert.equal(publication.status,200);
    assert.ok((await command(['HLEN','the-browser:telegram:-1004339801492']))>0);
    const nextHealth=await fetch(origin+'/api/telegram',{headers:{'x-telegram-bot-api-secret-token':'telegram_fixture_next_secret'}});assert.equal(nextHealth.status,200);
    const nextPublication=await post('/api/telegram',{update_id:updateId++,channel_post:{message_id:1001,date:Math.floor(Date.now()/1000),chat:{id:-1004339801492,type:'channel'},text:''}},{'x-telegram-bot-api-secret-token':'telegram_fixture_next_secret'});
    assert.equal(nextPublication.status,200,'le nouveau secret doit fonctionner avant de retirer l’ancien');
    const publicCount=await command(['HLEN','the-browser:telegram:-1004339801492']);
    for(const channelId of [-1003958043288,-1009999999999]) {
      const ignored=await telegram({channel_post:{message_id:1000,date:Math.floor(Date.now()/1000),chat:{id:channelId,type:'channel'},text:'Private channel publication'}});
      assert.equal(ignored.status,200);assert.equal((await ignored.json()).ignored,true);
      assert.equal(await command(['HLEN',`the-browser:telegram:${channelId}`]),0);
    }
    assert.equal(await command(['HLEN','the-browser:telegram:-1004339801492']),publicCount);
    const unauthorized=await post('/api/telegram',{update_id:updateId++,channel_post:{chat:{id:-1003958043288,type:'channel'}}},{'x-telegram-bot-api-secret-token':'wrong-fixture-secret'});
    assert.equal(unauthorized.status,401,'Ignorer un canal ne doit jamais contourner le secret du webhook');
    assert.equal((await post('/api/premium/auth/logout',{}, {cookie})).status,200);
    assert.equal((await fetch(origin+'/api/premium/auth/session',{headers:{cookie}}).then(r=>r.json())).status,'anonymous');
    assert.equal((await fetch(origin+`/api/stripe/test/status?order=${orderId}`,{headers:{cookie}})).status,401);
  }finally{
    for(const child of [app,redis])if(child&&child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}
    await rm(directory,{recursive:true,force:true});
  }
});
