// The ONLY file that talks to Redis (local Redis today, Memorystore later).
const Redis = require('ioredis');
const config = require('./config');

const redis = new Redis({
  ...config.redis,
  maxRetriesPerRequest: 1,
  retryStrategy: (n) => Math.min(n * 200, 2000),
});
let up = false;
redis.on('ready', () => { up = true; console.log('[cache] Redis connected'); });
redis.on('close', () => { up = false; });
redis.on('error', (e) => console.log('[cache] Redis error:', e.message));

const PREFIX = 'catalogue:';

// If Redis is down every call returns a safe value, so the app still works (just slower).
async function safe(fn, fallback) {
  try { return await fn(); } catch { return fallback; }
}

const cache = {
  isUp: () => up,
  get: (key) => safe(async () => {
    const raw = await redis.get(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  }, null),
  set: (key, value) => safe(() => redis.set(PREFIX + key, JSON.stringify(value), 'EX', config.ttlSeconds), null),
  del: (key) => safe(() => redis.del(PREFIX + key), 0),
  // Delete every cache entry matching a pattern (used after a price change)
  delByPattern: (pattern) => safe(async () => {
    const keys = await redis.keys(PREFIX + pattern);
    return keys.length ? redis.del(...keys) : 0;
  }, 0),
  clear: () => cache.delByPattern('*'),
  keys: () => safe(async () => (await redis.keys(PREFIX + '*')).map((k) => k.slice(PREFIX.length)), []),
  ttl: (key) => safe(() => redis.ttl(PREFIX + key), -2),
  // Lock so only ONE request rebuilds an expired key (stops a cache stampede)
  lock: (key) => safe(async () => (await redis.set('lock:' + key, '1', 'EX', 5, 'NX')) === 'OK', true),
  unlock: (key) => safe(() => redis.del('lock:' + key), 0),
};
module.exports = cache;
