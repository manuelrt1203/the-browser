// Explicit suite: REDIS_TEST_SERVER=/path/redis-server REDIS_TEST_CLI=/path/redis-cli node --test tests/premium-redis.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { premiumRedis } from '../src/lib/premium-redis.ts';
import { withChannelAccess } from '../src/lib/premium-channel-access.ts';
import { premiumAuthStore, premiumTelegramReply } from '../src/lib/premium-auth.ts';
import { createHash } from 'node:crypto';

const execFile = promisify(execFileCallback);

test('Premium : vrais scripts Lua sur un Redis isolé, sans accès à la production', async t => {
  if (!process.env.REDIS_TEST_SERVER || !process.env.REDIS_TEST_CLI) throw new Error('Renseigner REDIS_TEST_SERVER et REDIS_TEST_CLI');
  const directory = await mkdtemp(join(tmpdir(), 'premium-redis-'));
  const socket = join(directory, 'redis.sock');
  const server = spawn(process.env.REDIS_TEST_SERVER, ['--port','0','--unixsocket',socket,'--unixsocketperm','700','--save','','--appendonly','no','--dir',directory], { stdio: 'ignore' });
  const previousFetch = globalThis.fetch;
  const names = ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN', 'PREMIUM_ENVIRONMENT', 'PREMIUM_TELEGRAM_AUTH_ENABLED','PREMIUM_TELEGRAM_ACCESS_ENABLED','TELEGRAM_PREMIUM_CHANNEL_ID','TELEGRAM_CHANNEL_ID','TELEGRAM_BOT_TOKEN','PREMIUM_TELEGRAM_TEST_AUTH_ENABLED'];
  const old = Object.fromEntries(names.map(n => [n,process.env[n]]));
  async function command(args) {
    const { stdout } = await execFile(process.env.REDIS_TEST_CLI, ['-s',socket,'--json',...args.map(String)]);
    return JSON.parse(stdout);
  }
  try {
    let ready = false;
    for (let i=0;i<100;i++) {
      try { if (await command(['PING']) === 'PONG') { ready=true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve,20));
    }
    assert.ok(ready, 'Le serveur Redis doit démarrer');
    process.env.KV_REST_API_URL='https://isolated-redis.example';process.env.KV_REST_API_TOKEN='local-fixture-token';
    delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;
    // REST adapter only: the production Lua is executed verbatim by the real Redis server.
    globalThis.fetch = async (url,options) => {
      assert.equal(url,'https://isolated-redis.example/'); assert.equal(options.cache,'no-store');
      assert.equal(options.headers.Authorization,'Bearer local-fixture-token');
      return Response.json({ result: await command(JSON.parse(options.body)) });
    };
    const store=premiumRedis('test');const id=randomUUID();const user='12345';
    const payment={orderId:id,provider:'stripe',sessionId:'cs_test_a',paymentId:'pi_test_a',amountMinor:457,currency:'EUR',paidAt:'2026-01-31T14:00:00Z'};
    await t.test('création concurrente idempotente, propriétaire immuable et session unique',async()=>{
      const orders=await Promise.all(Array.from({length:8},()=>store.createOrder(id,user,'stripe')));
      assert.ok(orders.every(o=>o.id===id));
      await assert.rejects(()=>store.createOrder(id,'99999','stripe'),e=>e.code==='ORDER_CONFLICT');
      await store.bindSession(id,'cs_test_a');
      const other=randomUUID();await store.createOrder(other,user,'stripe');
      await assert.rejects(()=>store.bindSession(other,'cs_test_a'),e=>e.code==='SESSION_CONFLICT');
      await assert.rejects(()=>store.bindSession(id,'cs_test_changed'),e=>e.code==='SESSION_CONFLICT');
    });
    await t.test('24 confirmations concurrentes ne donnent qu’une période',async()=>{
      const orders=await Promise.all(Array.from({length:24},()=>store.confirmPayment(payment)));
      assert.ok(orders.every(o=>o.expiresAt==='2026-02-28T14:00:00.000Z'));
      const replay=await store.confirmPayment({...payment,paidAt:'2026-02-01T14:00:00Z'});
      assert.equal(replay.startsAt,'2026-01-31T14:00:00.000Z');
      assert.equal((await premiumRedis('test').getOrder(id)).status,'confirmed');
    });
    await t.test('un paiement ne peut pas payer une seconde commande',async()=>{
      const second=randomUUID();await store.createOrder(second,user,'stripe');await store.bindSession(second,'cs_test_second');
      await assert.rejects(()=>store.confirmPayment({...payment,orderId:second,sessionId:'cs_test_second'}),e=>e.code==='PAYMENT_CONFLICT');
      assert.equal((await store.getOrder(second)).status,'pending');
    });
    await t.test('montant ou session incompatibles ne modifient pas les données',async()=>{
      await assert.rejects(()=>store.confirmPayment({...payment,amountMinor:1}),e=>e.code==='PAYMENT_MISMATCH');
      await assert.rejects(()=>store.confirmPayment({...payment,sessionId:'cs_test_other'}),e=>e.code==='SESSION_CONFLICT');
      assert.equal((await store.getOrder(id)).confirmedPaymentId,'pi_test_a');
    });
    await t.test('test et live sont isolés et l’accès cesse exactement à échéance',async()=>{
      assert.equal(await premiumRedis('live').getOrder(id),null);
      assert.equal((await store.activeOrders(user,new Date('2026-02-15T12:00:00Z'))).length,1);
      assert.equal((await store.activeOrders('99999',new Date('2026-02-15T12:00:00Z'))).length,0);
      assert.equal((await store.activeOrders(user,new Date('2026-02-28T14:00:00Z'))).length,0);
    });
    await t.test('index utilisateur corrompu : aucune écriture partielle',async()=>{
      await command(['SET','the-browser:{premium:test}:user:54321:orders','wrong-type']);
      const corruptId=randomUUID();await assert.rejects(()=>store.createOrder(corruptId,'54321','stripe'));
      assert.equal(await store.getOrder(corruptId),null);
    });
    await t.test('les clés du catalogue public restent intactes',async()=>{
      assert.deepEqual(await command(['KEYS','the-browser:telegram:*']),[]);
    });
    await t.test('auth : confirmation explicite, code à usage unique, mauvais compte refusé et déconnexion',async()=>{
      process.env.PREMIUM_ENVIRONMENT='test';process.env.PREMIUM_TELEGRAM_AUTH_ENABLED='1';
      const auth=premiumAuthStore('test');const challenge=await auth.start();
      assert.deepEqual(await auth.status(challenge.token),{status:'pending'});
      assert.equal(await auth.confirm(challenge.code,'12345'),false,'un clic sur le lien ne confirme pas la connexion');
      const reply=await premiumTelegramReply({message:{chat:{id:12345,type:'private'},from:{id:12345,is_bot:false},text:`/start premium_test_${challenge.code}`}});
      assert.equal(reply.method,'sendMessage');
      assert.match(reply.text,/Si vous n’avez pas demandé/);
      assert.deepEqual(await auth.status(challenge.token),{status:'pending'});
      assert.equal(await auth.claim(challenge.code,'99999'),false);
      assert.equal(await auth.confirm(challenge.code,'99999'),false);
      const callback={id:'callback-fixture',from:{id:12345,is_bot:false},message:{chat:{id:12345,type:'private'}},data:reply.reply_markup.inline_keyboard[0][0].callback_data};
      const confirmation=await premiumTelegramReply({callback_query:callback});
      assert.equal(confirmation.method,'answerCallbackQuery');
      assert.match(confirmation.text,/Compte associé/);
      assert.deepEqual(await auth.status(challenge.token),{status:'connected',telegramUserId:'12345'});
      assert.equal(await auth.confirm(challenge.code,'12345'),false,'le code consommé ne prolonge jamais la session');
      assert.deepEqual(await premiumAuthStore('live').status(challenge.token),{status:'anonymous'});
      const orderId=randomUUID();await store.createOrder(orderId,(await auth.status(challenge.token)).telegramUserId,'stripe');
      assert.equal((await store.getOrder(orderId)).telegramUserId,'12345');
      await auth.logout(challenge.token);assert.deepEqual(await auth.status(challenge.token),{status:'anonymous'});
    });
    await t.test('auth : expiration et hachage des secrets de session/challenge dans Redis',async()=>{
      const auth=premiumAuthStore('test');const {token,code}=await auth.start();
      const tokenHash=createHash('sha256').update(token).digest('hex');
      const codeHash=createHash('sha256').update(code).digest('hex');
      const sessionKey=`the-browser:{premium:test}:auth:session:${tokenHash}`;
      const codeKey=`the-browser:{premium:test}:auth:challenge:${codeHash}`;
      assert.ok(await command(['TTL',sessionKey])<=600);
      assert.equal(await command(['GET',codeKey]),tokenHash);
      assert.ok(!(await command(['KEYS','the-browser:{premium:test}:auth:*'])).some(key=>key.includes(token)||key.includes(code)));
      await command(['PEXPIRE',codeKey,1]);await new Promise(resolve=>setTimeout(resolve,10));
      assert.equal(await auth.claim(code,'12345'),false);
      await command(['DEL',sessionKey]);assert.deepEqual(await auth.status(token),{status:'anonymous'});
    });
    await t.test('auth : un seul des deux comptes concurrents peut associer la demande',async()=>{
      const auth=premiumAuthStore('test');const challenge=await auth.start();
      const results=await Promise.all([auth.claim(challenge.code,'111'),auth.claim(challenge.code,'222')]);
      assert.equal(results.filter(Boolean).length,1);
      const winner=results[0]?'111':'222';
      assert.equal(await auth.confirm(challenge.code,winner),true);
      assert.equal((await auth.status(challenge.token)).telegramUserId,winner);
    });
    await t.test('échec impayé puis confirmation ; un événement ancien ne révoque pas les droits',async()=>{
      const unpaid=randomUUID();await store.createOrder(unpaid,'777','stripe');await store.bindSession(unpaid,'cs_test_unpaid');
      assert.equal((await store.markUnpaid(unpaid,'cs_test_unpaid','failed')).status,'failed');
      await store.confirmPayment({...payment,orderId:unpaid,sessionId:'cs_test_unpaid',paymentId:'pi_unpaid_then_paid'});
      assert.equal((await store.markUnpaid(unpaid,'cs_test_unpaid','cancelled')).status,'confirmed');
    });
    await t.test('auth : webhook live accepte explicitement les sessions preview sans mélanger les identités',async()=>{
      process.env.PREMIUM_ENVIRONMENT='live';process.env.PREMIUM_TELEGRAM_AUTH_ENABLED='1';
      const auth=premiumAuthStore('test');const challenge=await auth.start();
      const update={message:{chat:{id:12345,type:'private'},from:{id:12345,is_bot:false},text:'/start premium_test_'+challenge.code}};
      delete process.env.PREMIUM_TELEGRAM_TEST_AUTH_ENABLED;
      assert.equal(await premiumTelegramReply(update),null);
      process.env.PREMIUM_TELEGRAM_TEST_AUTH_ENABLED='1';
      assert.equal((await premiumTelegramReply(update)).method,'sendMessage');
      const reply=await premiumTelegramReply({callback_query:{id:'fixture',from:{id:12345,is_bot:false},message:{chat:{id:12345,type:'private'}},data:'premium_test_'+challenge.code}});
      assert.equal(reply.method,'answerCallbackQuery');assert.equal((await auth.status(challenge.token)).status,'connected');
      assert.equal((await premiumAuthStore('live').status(challenge.token)).status,'anonymous');
    });
    await t.test('live : retrait et confirmation sérialisés, verrou libéré après erreur',async()=>{
      const live=premiumRedis('live'),id=randomUUID();await live.createOrder(id,'888','stripe');await live.bindSession(id,'cs_live_lock');
      const lock='the-browser:{premium:live}:channel-access:lock:888';
      await command(['SET',lock,'worker','EX',120]);
      await assert.rejects(()=>live.confirmPayment({...payment,orderId:id,sessionId:'cs_live_lock',paymentId:'pi_live_lock'}),e=>e.code==='ACCESS_BUSY');
      assert.equal((await live.getOrder(id)).status,'pending');await command(['DEL',lock]);
      assert.equal((await live.confirmPayment({...payment,orderId:id,sessionId:'cs_live_lock',paymentId:'pi_live_lock'})).status,'confirmed');
      process.env.PREMIUM_ENVIRONMENT='live';process.env.PREMIUM_TELEGRAM_ACCESS_ENABLED='1';process.env.TELEGRAM_PREMIUM_CHANNEL_ID='-100123';process.env.TELEGRAM_CHANNEL_ID='-100456';process.env.TELEGRAM_BOT_TOKEN='fixture';
      await assert.rejects(()=>withChannelAccess('888',async()=>{assert.ok(await command(['GET',lock]));throw new Error('fixture')}));
      assert.equal(await command(['GET',lock]),null);
    });
  } finally {
    globalThis.fetch=previousFetch;
    for (const [n,v] of Object.entries(old)) { if(v===undefined) delete process.env[n];else process.env[n]=v; }
    if(server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}
    await rm(directory,{recursive:true,force:true});
  }
});
