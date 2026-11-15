import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { premiumRedis, PremiumStorageError } from '../src/lib/premium-redis.ts';

async function isolated(run) {
  const names = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  const old = Object.fromEntries(names.map(n => [n, process.env[n]]));
  const fetch = globalThis.fetch;
  try { for (const n of names) delete process.env[n]; await run(); }
  finally {
    globalThis.fetch = fetch;
    for (const [n,v] of Object.entries(old)) { if (v === undefined) delete process.env[n]; else process.env[n] = v; }
  }
}

test('Premium Redis : aucune configuration partielle, URL non sécurisée ou valeur locale de repli', () => isolated(async () => {
  const store = premiumRedis('test');
  await assert.rejects(() => store.getOrder(randomUUID()), e => e.code === 'CONFIG');
  process.env.KV_REST_API_URL = 'https://redis.example';
  await assert.rejects(() => store.getOrder(randomUUID()), e => e.code === 'CONFIG');
  process.env.KV_REST_API_TOKEN = 'fixture-token';
  for (const url of ['http://redis.example', 'https://user:pass@redis.example', 'https://redis.example/?token=secret']) {
    process.env.KV_REST_API_URL = url;
    await assert.rejects(() => store.getOrder(randomUUID()), e => e.code === 'CONFIG');
  }
}));

test('Premium Redis : erreurs expurgées et panne réseau distincte d’une commande absente', () => isolated(async () => {
  process.env.KV_REST_API_URL = 'https://redis.example'; process.env.KV_REST_API_TOKEN = 'fixture-token';
  const store = premiumRedis('test');
  globalThis.fetch = async () => { throw new Error('fixture-token'); };
  await assert.rejects(() => store.getOrder(randomUUID()), e => e.code === 'NETWORK' && !e.message.includes('fixture-token'));
  for (const response of [Response.json({ error: 'fixture-token' }), new Response('not json'), Response.json({})]) {
    globalThis.fetch = async () => response;
    await assert.rejects(() => store.getOrder(randomUUID()), e => e instanceof PremiumStorageError && !e.message.includes('fixture-token'));
  }
  globalThis.fetch = async () => Response.json({ result: null });
  assert.equal(await store.getOrder(randomUUID()), null);
}));

test('Premium Redis : environnement, ID de commande et identité Telegram validés avant tout accès', async () => {
  assert.throws(() => premiumRedis('preview'));
  const store = premiumRedis('test');
  await assert.rejects(() => store.getOrder('../file'));
  for (const user of ['@name', '-100123', '0', '9007199254740992']) await assert.rejects(() => store.createOrder(randomUUID(), user, 'stripe'));
  await assert.rejects(() => store.bindSession(randomUUID(), 'bad:key'));
});

test('Premium Redis : une commande d’un autre environnement ou corrompue ne donne pas de droits', () => isolated(async () => {
  process.env.KV_REST_API_URL = 'https://redis.example'; process.env.KV_REST_API_TOKEN = 'fixture-token';
  const id = randomUUID();
  for (const value of ['{}', JSON.stringify({ id, environment: 'live', telegramUserId: '123', provider: 'stripe', amountMinor: 457, currency: 'EUR', status: 'pending' })]) {
    globalThis.fetch = async () => Response.json({ result: value });
    await assert.rejects(() => premiumRedis('test').getOrder(id), e => e.code === 'CORRUPT');
  }
}));
