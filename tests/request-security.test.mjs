import test from 'node:test';
import assert from 'node:assert/strict';
import {limitedRequestBody,limitedJsonObject,requestBodyErrorResponse} from '../src/lib/request-body.ts';
import {securityHeaders} from '../src/lib/security-headers.ts';
import {requestRateSubject,premiumRateLimit} from '../src/lib/premium-rate-limit.ts';

test('lecture bornée : octets exacts, plusieurs fragments et limite comprise',async()=>{
 const bytes=Buffer.from('{"accent":"é","nul":"\\u0000"}');
 const body=new ReadableStream({start(c){c.enqueue(bytes.subarray(0,13));c.enqueue(bytes.subarray(13));c.close();}});
 const request=new Request('https://example.com',{method:'POST',body,duplex:'half'});
 assert.deepEqual(await limitedRequestBody(request,bytes.length),bytes);
 assert.deepEqual(await limitedJsonObject(new Request('https://example.com',{method:'POST',body:bytes}),bytes.length),{accent:'é',nul:'\0'});
});
test('un corps trop grand est arrêté, même avec Content-Length faux ou absent',async()=>{
 for(const headers of [{},{'content-length':'1'}]){
  let cancelled=false;
  const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(5));c.enqueue(new Uint8Array(5));},cancel(){cancelled=true;}});
  await assert.rejects(limitedRequestBody(new Request('https://example.com',{method:'POST',headers,body:stream,duplex:'half'}),8),e=>e.status===413);
  assert.equal(cancelled,true);
 }
 const request=new Request('https://example.com',{method:'POST',headers:{'content-length':'1000'},body:'small'});
 await assert.rejects(limitedRequestBody(request,8),e=>e.status===413);assert.equal(request.bodyUsed,false);
});
test('JSON incorrect, scalaire, tableau ou null : erreur400 sans fuite',async()=>{
 for(const body of ['{','null','[]','42','"text"']){
  try{await limitedJsonObject(new Request('https://example.com',{method:'POST',body}),128);assert.fail('must reject');}
  catch(error){const response=requestBodyErrorResponse(error);assert.equal(response.status,400);assert.equal(response.headers.get('cache-control'),'private, no-store');}
 }
});
test('en-têtes : protection des cadres, MIME, référent et CSP compatible avec le cache',()=>{
 const prod=Object.fromEntries(securityHeaders().map(h=>[h.key,h.value]));
 assert.equal(prod['X-Frame-Options'],'DENY');assert.equal(prod['X-Content-Type-Options'],'nosniff');assert.equal(prod['Referrer-Policy'],'no-referrer');
 for(const directive of ["frame-ancestors 'none'","object-src 'none'","form-action 'self'","base-uri 'none'",'https://image.tmdb.org'])assert.ok(prod['Content-Security-Policy'].includes(directive));
 assert.ok(!prod['Content-Security-Policy'].includes('unsafe-eval'));assert.ok(prod['Content-Security-Policy'].includes("'unsafe-inline'"),'explicit static/PPR compatibility limitation');
 assert.ok(securityHeaders(true).find(h=>h.key==='Content-Security-Policy').value.includes('unsafe-eval'));
});
test('seule l’adresse issue du proxy Vercel est utilisée, pas un en-tête arbitraire hors Vercel',()=>{
 const request=new Request('https://example.com',{headers:{'x-vercel-forwarded-for':'203.0.113.4','x-forwarded-for':'198.51.100.2'}});
 assert.equal(requestRateSubject(request,{}),'unattributed');assert.equal(requestRateSubject(request,{VERCEL:'1'}),'ip:203.0.113.4');
 assert.equal(requestRateSubject(new Request('https://example.com',{headers:{'x-vercel-forwarded-for':'invalid'}}),{VERCEL:'1'}),'unattributed');
});
test('une panne ou réponse Redis incorrecte ne désactive pas la protection',async()=>{
 for(const command of [async()=>{throw new Error('private-token');},async()=>[],async()=>[-1,2],async()=>[1,'bad']]){
  const response=await premiumRateLimit('auth-start','private-ip',command,'test');assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private'));
 }
});
