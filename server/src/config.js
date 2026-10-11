// All environment-specific settings live here.
// Moving to Memorystore later = set REDIS_HOST to its private IP. Nothing else changes.
module.exports = {
  port: Number(process.env.PORT || 3000),
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  ttlSeconds: Number(process.env.CACHE_TTL || 60),      // how long a cached entry lives
  dbDelayMs: Number(process.env.DB_DELAY_MS || 300),    // SIMULATED remote-database latency
  stampedeLock: process.env.STAMPEDE_LOCK !== 'off',    // set STAMPEDE_LOCK=off to compare
  dbPath: process.env.DB_PATH || 'catalogue.db',
};
