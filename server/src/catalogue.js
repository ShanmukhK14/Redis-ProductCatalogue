// The cache-aside logic. This is the heart of the project.
const cache = require('./cache');
const db = require('./db');
const config = require('./config');

const stats = { hits: 0, misses: 0, hitMs: [], missMs: [], recent: [] };
const now = () => Number(process.hrtime.bigint()) / 1e6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (n) => Math.round(n * 100) / 100;

function record(key, source, timeMs) {
  const list = source === 'cache' ? stats.hitMs : stats.missMs;
  if (source === 'cache') stats.hits++; else stats.misses++;
  list.push(timeMs); if (list.length > 500) list.shift();
  stats.recent.unshift({ key, source, timeMs, at: new Date().toISOString() });
  stats.recent.length = Math.min(stats.recent.length, 12);
}

// 1) look in Redis  2) on a MISS ask the database  3) store the answer in Redis
async function cacheAside(key, loadFromDb) {
  const start = now();
  const cached = await cache.get(key);
  if (cached) {                                   // CACHE HIT
    const timeMs = round(now() - start);
    record(key, 'cache', timeMs);
    return { data: cached, meta: { source: 'cache', timeMs, key, ttl: await cache.ttl(key) } };
  }
  // CACHE MISS. Only one request should rebuild the entry (stampede protection).
  let gotLock = !config.stampedeLock || (await cache.lock(key));
  if (!gotLock) {
    for (let i = 0; i < 20 && !gotLock; i++) {    // wait up to ~2s for the winner to fill the cache
      await sleep(100);
      const again = await cache.get(key);
      if (again) {
        const timeMs = round(now() - start);
        record(key, 'cache', timeMs);
        return { data: again, meta: { source: 'cache', timeMs, key, ttl: await cache.ttl(key), waitedForLock: true } };
      }
    }
  }
  try {
    const data = await loadFromDb();
    if (data) await cache.set(key, data);
    const timeMs = round(now() - start);
    record(key, 'database', timeMs);
    return { data, meta: { source: 'database', timeMs, key, ttl: config.ttlSeconds } };
  } finally {
    if (gotLock && config.stampedeLock) await cache.unlock(key);
  }
}

const avg = (a) => (a.length ? round(a.reduce((x, y) => x + y, 0) / a.length) : 0);

module.exports = {
  getProduct: (id) => cacheAside(`product:${id}`, () => db.getProduct(id)),
  listProducts: (q, category) => cacheAside(`list:${category || 'all'}:${(q || '').toLowerCase()}`, () => db.listProducts(q, category)),
  // Cache invalidation: write to DB, then delete the stale cache entries.
  async updatePrice(id, price) {
    const product = await db.updatePrice(id, price);
    await cache.del(`product:${id}`);
    await cache.delByPattern('list:*');
    return product;
  },
  async clearCache() { return cache.clear(); },
  async getStats() {
    const total = stats.hits + stats.misses;
    const avgHit = avg(stats.hitMs), avgMiss = avg(stats.missMs);
    return {
      hits: stats.hits, misses: stats.misses, total,
      hitRatio: total ? round((stats.hits / total) * 100) : 0,
      avgHitMs: avgHit, avgMissMs: avgMiss,
      improvementPct: avgMiss ? round((1 - avgHit / avgMiss) * 100) : 0,
      dbQueries: db.stats.queries,
      redisUp: cache.isUp(), ttlSeconds: config.ttlSeconds, dbDelayMs: config.dbDelayMs,
      stampedeLock: config.stampedeLock,
      cachedKeys: await cache.keys(), recent: stats.recent,
    };
  },
  resetStats() {
    stats.hits = stats.misses = 0; stats.hitMs = []; stats.missMs = []; stats.recent = []; db.stats.queries = 0;
  },
};
