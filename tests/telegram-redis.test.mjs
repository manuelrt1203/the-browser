import test from 'node:test';
import assert from 'node:assert/strict';
import { readChannelState, saveChannelPost, hasCatalogueStorage } from '../src/lib/telegram-store.ts';

const vars = ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','TELEGRAM_CHANNEL_ID','CATALOGUE_DATA_DIR','VERCEL'];
async function environment(run) {
  const old = Object.fromEntries(vars.map(k => [k, process.env[k]]));
  const fetch = globalThis.fetch;
  try {
    for (const k of vars) delete process.env[k];
    process.env.VERCEL = '1';
    process.env.KV_REST_API_URL = 'https://test-redis.example';
    process.env.KV_REST_API_TOKEN = 'test-token';
    process.env.TELEGRAM_CHANNEL_ID = '-100123';
    await run();
  } finally {
    globalThis.fetch = fetch;
    for (const k of vars) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; }
  }
}
const post = { messageId: 1, version: 100, updateId: 1, text: 'Titre', titles: [{kind:'film',id:671}], pending:[] };

test('Vercel utilise le contrat Redis REST et une écriture atomique EVAL', () => environment(async () => {
  assert.equal(hasCatalogueStorage(),true);
  let command;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://test-redis.example/');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.cache, 'no-store');
    command = JSON.parse(options.body);
    return Response.json({result: 1});
  };
  assert.equal(await saveChannelPost('-100123', post), true);
  assert.equal(command[0], 'EVAL');
  assert.match(command[1], /redis.call\('HGET'/);
  assert.match(command[1], /redis.call\('HSET'/);
  assert.doesNotMatch(command[1], /cjson\.encode/, 'les tableaux JSON vides doivent rester des tableaux pendant la réanalyse');
  assert.match(command[1], /string\.gsub/);
  assert.equal(command[2], 1);
  assert.equal(command[3], 'the-browser:telegram:-100123');
  assert.equal(command[4], '-100123:1');
  assert.deepEqual(JSON.parse(command[5]), post);
  globalThis.fetch = async () => Response.json({result:0});
  assert.equal(await saveChannelPost('-100123', post), false);
  await assert.rejects(saveChannelPost('-100999', post), /Canal non autorisé/);
}));

test('lecture Redis, état invalide et erreurs réseau ne produisent pas un faux catalogue vide', () => environment(async () => {
  globalThis.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), ['HGETALL','the-browser:telegram:-100123']);
    return Response.json({result:['-100123:1',JSON.stringify(post)]});
  };
  assert.deepEqual((await readChannelState()).posts['-100123:1'], post);
  for (const response of [Response.json({result:['broken']}),Response.json({result:['key','{}']}),Response.json({error:'unauthorized'}),new Response('',{status:503})]) {
    globalThis.fetch = async () => response;
    await assert.rejects(readChannelState());
  }
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(saveChannelPost('-100123',post),/Redis inaccessible/);
}));

test('Vercel refuse le stockage éphémère et les configurations Redis partielles', () => environment(async () => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  process.env.CATALOGUE_DATA_DIR = '/tmp/ephemeral';
  assert.equal(hasCatalogueStorage(),false);
  await assert.rejects(saveChannelPost('-100123',post), /Redis requis/);
  await assert.rejects(readChannelState(), /Redis requis/);
  process.env.KV_REST_API_URL = 'https://test-redis.example';
  await assert.rejects(readChannelState(), /incomplète/);
  process.env.KV_REST_API_URL = 'http://test-redis.example';
  process.env.KV_REST_API_TOKEN = 'test-token';
  await assert.rejects(readChannelState(), /HTTPS/);
}));

test('le diagnostic exécute la migration sans HSET ni modification de ARGV', () => environment(async () => {
  const {checkCatalogueStorage}=await import('../src/lib/telegram-store.ts');
  const seen=[];
  globalThis.fetch=async (_url,options)=>{
    const command=JSON.parse(options.body);seen.push(command);
    if(command[0]==='HGETALL')return Response.json({result:['-100123:1',JSON.stringify(post)]});
    assert.equal(command[0],'EVAL');
    assert.doesNotMatch(command[1],/redis.call\('HSET'/);
    assert.doesNotMatch(command[1],/ARGV\[\d+\]\s*=(?!=)/);
    assert.match(command[1],/serialized = string.gsub/);
    return Response.json({result:1});
  };
  assert.deepEqual(await checkCatalogueStorage(),{ok:true,posts:1,migrationDryRun:true});
  assert.equal(seen.length,2);
}));

test('les erreurs Redis indiquent la cause sans divulguer les jetons', () => environment(async () => {
  const {CatalogueStorageError}=await import('../src/lib/telegram-store.ts');
  globalThis.fetch=async()=>Response.json({error:'ERR readonly token test-token Bearer hidden-value'},{status:400});
  await assert.rejects(saveChannelPost('-100123',post),error=>{
    assert.ok(error instanceof CatalogueStorageError);
    assert.equal(error.code,'REDIS_COMMAND');
    assert.match(error.message,/HTTP 400/);
    assert.match(error.message,/readonly/);
    assert.doesNotMatch(error.message,/test-token|hidden-value/);
    return true;
  });
}));
