// Cache stampede demo: 50 simultaneous requests for one product right after the cache is cleared.
// Run it with the server started normally, then with STAMPEDE_LOCK=off, and compare "database queries".
const base = process.env.BASE || 'http://localhost:3000';
const post = (p) => fetch(base + p, { method: 'POST' });
(async () => {
  await post('/api/cache/clear'); await post('/api/stats/reset');
  const t = Date.now();
  await Promise.all(Array.from({ length: 50 }, () => fetch(base + '/api/products/1').then((r) => r.json())));
  const s = await (await fetch(base + '/api/stats')).json();
  console.log(`stampede lock: ${s.stampedeLock ? 'ON' : 'OFF'}`);
  console.log(`50 concurrent requests took ${Date.now() - t} ms`);
  console.log(`database queries: ${s.dbQueries} (hits ${s.hits}, misses ${s.misses})`);
})();
