import { randomUUID } from 'node:crypto';
import { premiumRedis, premiumRedisCommand } from '../src/lib/premium-redis.ts';
import { premiumEnvironment } from '../src/lib/premium-auth.ts';

// Random probe key, read-only GET and Lua GET; no writes, no order data printed.
try {
  const environment = premiumEnvironment();
  const id = randomUUID();
  await premiumRedis(environment).getOrder(id);
  await premiumRedisCommand(['EVAL', "return redis.call('GET', KEYS[1])", 1,
    `the-browser:{premium:${environment}}:probe:${id}`]);
  console.log(JSON.stringify({ ready: true, environment, read: true, scripting: true, writes: false }));
} catch { console.error('Redis Premium inaccessible ou non configuré ; aucun détail de connexion affiché.'); process.exitCode = 1; }
