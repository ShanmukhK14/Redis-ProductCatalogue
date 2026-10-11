// Express routes only: HTTP in, JSON out. All logic is in catalogue.js.
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const catalogue = require('./catalogue');

const app = express();
app.use(cors());
app.use(express.json());

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(500).json({ error: e.message }));

app.get('/api/products', wrap(async (req, res) => {
  res.json(await catalogue.listProducts(req.query.q || '', req.query.category || ''));
}));
app.get('/api/products/:id', wrap(async (req, res) => {
  const result = await catalogue.getProduct(Number(req.params.id));
  if (!result.data) return res.status(404).json({ error: 'Product not found', meta: result.meta });
  res.json(result);
}));
app.patch('/api/products/:id/price', wrap(async (req, res) => {
  const price = Number(req.body.price);
  if (!(price > 0)) return res.status(400).json({ error: 'price must be a positive number' });
  const product = await catalogue.updatePrice(Number(req.params.id), price);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product, invalidated: true });
}));
app.post('/api/cache/clear', wrap(async (req, res) => { await catalogue.clearCache(); res.json({ cleared: true }); }));
app.get('/api/stats', wrap(async (req, res) => res.json(await catalogue.getStats())));
app.post('/api/stats/reset', wrap(async (req, res) => { catalogue.resetStats(); res.json({ reset: true }); }));

// Serve the built React app if it exists (one process, one port: handy on a VM)
const dist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port}  redis=${config.redis.host}:${config.redis.port}  ttl=${config.ttlSeconds}s  dbDelay=${config.dbDelayMs}ms`);
});
