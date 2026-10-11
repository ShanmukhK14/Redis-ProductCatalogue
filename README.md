# Memorystore Redis Cache for a Read-Heavy Catalogue (24CC3156-P040)

A product catalogue where the first lookup hits the database (CACHE MISS) and repeat lookups are
answered from Redis (CACHE HIT). The UI shows the badge, the response time and the steps taken.

Request flow: React (client) -> Express (server) -> Redis -> SQLite (only on a MISS)

## Run locally
1. Start Redis: `docker compose up -d` (or any local Redis on port 6379)
2. Backend: `cd server && npm install && npm start`   (http://localhost:3000)
3. Frontend (dev): `cd client && npm install && npm run dev`   (http://localhost:5173)
   Or one-process mode: `cd client && npm run build`, then open http://localhost:3000

## Files and what to say about them
| File | Job |
|---|---|
| server/src/config.js | All settings (Redis host/port, TTL, DB delay) from environment variables |
| server/src/db.js | Only file that touches the database. Seeds 60 products. Has a SIMULATED delay |
| server/src/cache.js | Only file that touches Redis. Falls back safely if Redis is down |
| server/src/catalogue.js | Cache-aside logic, stampede lock, invalidation, statistics |
| server/src/app.js | HTTP routes only |
| client/src/App.jsx | UI: catalogue, request inspector, statistics |

## Settings (environment variables)
REDIS_HOST (default 127.0.0.1), REDIS_PORT (6379), CACHE_TTL (60), DB_DELAY_MS (300),
STAMPEDE_LOCK (set to `off` to disable), PORT (3000)

## Demo script
1. Open the page, click a product: MISS, about 300 ms, trace shows Redis empty -> DB -> Redis SET.
2. Click "Request this product again": HIT, about 1 ms, database skipped.
3. Update the price: the cache entry is deleted, the next request is a MISS with the new price.
4. Stampede test: `cd server && npm run loadtest` (lock on: 1 DB query for 50 requests).
   Restart the server with `STAMPEDE_LOCK=off` and run it again (50 DB queries).
5. Show Redis directly: `redis-cli keys "catalogue:*"` and `redis-cli ttl catalogue:product:1`

## Honest notes
- The 300 ms database delay is simulated, because local SQLite is too fast to show the effect.
- Not yet deployed on Google Cloud. Moving to Memorystore means setting REDIS_HOST to its private IP
  (it is only reachable from inside the same VPC, e.g. from a Compute Engine VM).
