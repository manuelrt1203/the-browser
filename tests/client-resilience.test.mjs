import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {clientRequest,retryAfterSeconds} from '../src/lib/client-request.ts';
import {premiumSessionRevision} from '../src/lib/premium-auth.ts';
import {createAvailabilityCache,regionalProviderOptions} from '../src/lib/regional-payments.ts';

async function withFetch(replacement,operation){const previous=globalThis.fetch;try{globalThis.fetch=replacement;await operation();}finally{globalThis.fetch=previous;}}
test('délai borné : en-têtes et corps bloqués, une seule tentative et aucun retry POST implicite',async()=>{
 for(const fetcher of [()=>new Promise(()=>{}),async()=>({ok:true,json:()=>new Promise(()=>{})})]){
  let count=0,signal;
  await withFetch((...args)=>{count++;signal=args[1].signal;return fetcher(...args);},async()=>{
   await assert.rejects(clientRequest('/payment',{method:'POST'},20),e=>e.kind==='timeout');assert.equal(count,1);assert.equal(signal.aborted,true);
  });
 }
});
test('annulation par le composant : même si le transport ignore le signal, le résultat est abandonné',async()=>{
 const controller=new AbortController();let resolve;
 await withFetch(()=>new Promise(r=>{resolve=r;}),async()=>{
  const pending=clientRequest('/session',{signal:controller.signal},1000);controller.abort();
  await assert.rejects(pending,e=>e.name==='AbortError');resolve(Response.json({status:'connected'}));
 });
 let calls=0;await withFetch(()=>{calls++;return Response.json({});},async()=>{
  await assert.rejects(clientRequest('/session',{signal:controller.signal}),e=>e.name==='AbortError');assert.equal(calls,0);
 });
});
test('erreurs HTTP : délai429 lisible et preuve de non-création préservée',async()=>{
 await withFetch(async()=>Response.json({error:'internal'},{status:429,headers:{'retry-after':'7'}}),async()=>{
  await assert.rejects(clientRequest('/session'),e=>e.status===429&&e.retryAfter===7&&e.message.includes('7 secondes'));
 });
 await withFetch(async()=>Response.json({attemptCreated:false,error:'Indisponible'},{status:503}),async()=>{
  await assert.rejects(clientRequest('/payment'),e=>e.body.attemptCreated===false&&e.kind==='http');
 });
 assert.equal(retryAfterSeconds('garbage'),60);assert.equal(retryAfterSeconds('999999'),3600);
 assert.equal(retryAfterSeconds('Thu, 01 Jan 2026 00:01:00 GMT',Date.parse('2026-01-01T00:00:00Z')),60);
});
test('réponses invalides et panne réseau : erreurs publiques sans trace technique',async()=>{
 await withFetch(async()=>new Response('not json'),async()=>{await assert.rejects(clientRequest('/test'),e=>e.kind==='invalid');});
 await withFetch(async()=>{throw new Error('private_details');},async()=>{await assert.rejects(clientRequest('/test'),e=>e.kind==='network'&&!e.message.includes('private'));});
});
test('révision de session : opaque, stable, distincte du jeton et du hash d’authentification',()=>{
 const token=randomBytes(32).toString('base64url'),revision=premiumSessionRevision(token);
 assert.match(revision,/^[0-9a-f]{32}$/);assert.equal(revision,premiumSessionRevision(token));assert.notEqual(revision,premiumSessionRevision(randomBytes(32).toString('base64url')));
 assert.ok(!token.includes(revision));assert.notEqual(revision,createHash('sha256').update(token).digest('hex').slice(0,32));assert.throws(()=>premiumSessionRevision('invalid'));
});
test('cache des disponibilités : une lecture en vol, TTL après résolution et reprise15s après panne',async()=>{
 let now=0,calls=0,resolve;
 const cache=createAvailabilityCache(()=>{calls++;return new Promise(r=>{resolve=r;});},()=>now);
 const a=cache(),b=cache();assert.equal(a,b);await Promise.resolve();assert.equal(calls,1);
 now=1_000_000;assert.equal(cache(),a,'une requête en vol n’est pas dupliquée');
 resolve({countries:{},providers:{stripe:'ready',saspay:'unavailable'}});await a;
 now+=14999;assert.equal(cache(),a);now+=1;const retry=cache();assert.notEqual(retry,a);await Promise.resolve();assert.equal(calls,2);
 resolve({countries:{},providers:{stripe:'ready',saspay:'ready'}});await retry;
 now+=299999;assert.equal(cache(),retry);now+=1;const refreshed=cache();await Promise.resolve();assert.equal(calls,3);resolve({countries:{},providers:{stripe:'ready',saspay:'ready'}});await refreshed;
});
test('panne inattendue non gardée5min et référentiel incomplet refusé sans exception',async()=>{
 let now=0,calls=0;
 const cache=createAvailabilityCache(async()=>{calls++;throw new Error('down');},()=>now);
 await assert.rejects(cache());await assert.rejects(cache());assert.equal(calls,1);now=15000;await assert.rejects(cache());assert.equal(calls,2);
 assert.equal(regionalProviderOptions([], [null,{country_code:'CG',currency:'XAF',payin:{available:true,tiers:{}}}]).CG.monthly.saspay,false);
});
