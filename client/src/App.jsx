import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const CATEGORIES = ['Phones', 'Laptops', 'Audio', 'Wearables', 'Accessories'];
const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');

// Small badge: green HIT (served by Redis) or orange MISS (served by the database)
function Badge({ source }) {
  const hit = source === 'cache';
  return <span className={`badge ${hit ? 'hit' : 'miss'}`}>{hit ? 'HIT' : 'MISS'}</span>;
}

// Shows the steps the backend took for one request, so the audience can follow the flow.
function Trace({ meta, dbDelayMs }) {
  const hit = meta.source === 'cache';
  const steps = hit
    ? [['Redis GET', `found ${meta.key}`, 'ok'], ['Database', 'skipped', 'skip']]
    : [['Redis GET', `${meta.key} not found`, 'bad'], ['Database query', `SQLite, simulated ${dbDelayMs} ms`, 'warn'], ['Redis SET', `stored for ${meta.ttl} s`, 'ok']];
  return (
    <ol className="trace">
      {steps.map(([name, note, tone]) => (
        <li key={name} className={tone}><strong>{name}</strong><span>{note}</span></li>
      ))}
    </ol>
  );
}

export default function App() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [list, setList] = useState(null);       // { data: [...], meta }
  const [detail, setDetail] = useState(null);   // { data, meta }
  const [stats, setStats] = useState(null);
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshStats = useCallback(() => api.stats().then(setStats).catch(() => {}), []);

  const loadList = useCallback(async () => {
    try { setError(''); setList(await api.list(q, category)); refreshStats(); }
    catch (e) { setError(e.message); }
  }, [q, category, refreshStats]);

  // Reload the product list when the search text or category changes (with a small debounce)
  useEffect(() => { const t = setTimeout(loadList, 250); return () => clearTimeout(t); }, [loadList]);
  useEffect(() => { refreshStats(); const t = setInterval(refreshStats, 3000); return () => clearInterval(t); }, [refreshStats]);

  const openProduct = async (id) => {
    setBusy(true);
    try { const r = await api.product(id); setDetail(r); setPrice(String(r.data.price)); refreshStats(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };
  const changePrice = async () => {
    if (!detail) return;
    try { await api.updatePrice(detail.data.id, Number(price)); await openProduct(detail.data.id); loadList(); }
    catch (e) { setError(e.message); }
  };
  const clearCache = async () => { await api.clearCache(); setDetail(null); await loadList(); };
  const resetStats = async () => { await api.resetStats(); refreshStats(); };

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1>Catalogue Cache Lab</h1>
          <p>Product lookups served from Redis when possible, from the database when not.</p>
        </div>
        <div className="status">
          <span className={`dot ${stats?.redisUp ? 'on' : 'off'}`} />
          {stats ? (stats.redisUp ? 'Redis connected' : 'Redis down, using database only') : 'Connecting…'}
          {stats && <small>TTL {stats.ttlSeconds}s · DB delay {stats.dbDelayMs} ms (simulated)</small>}
        </div>
      </header>

      {error && <div className="error" role="alert">{error}</div>}

      <main className="layout">
        <section className="catalogue">
          <div className="controls">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products or brands" aria-label="Search products" />
            <div className="chips">
              <button className={!category ? 'chip active' : 'chip'} onClick={() => setCategory('')}>All</button>
              {CATEGORIES.map((c) => (
                <button key={c} className={category === c ? 'chip active' : 'chip'} onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
          </div>
          {list && (
            <p className="listmeta">
              {list.data.length} products · this list came from {list.meta.source === 'cache' ? 'Redis' : 'the database'} in {list.meta.timeMs} ms <Badge source={list.meta.source} />
            </p>
          )}
          <div className="grid">
            {list?.data.map((p) => (
              <button key={p.id} className={`card ${detail?.data.id === p.id ? 'selected' : ''}`} onClick={() => openProduct(p.id)}>
                <span className="cat">{p.category}</span>
                <strong>{p.name}</strong>
                <span className="price">{rupees(p.price)}</span>
              </button>
            ))}
            {list && list.data.length === 0 && <p className="empty">No products match. Clear the search or pick another category.</p>}
          </div>
        </section>

        <aside className="side">
          <div className="panel">
            <h2>Request inspector</h2>
            {!detail ? <p className="empty">Select a product to see where its data came from.</p> : (
              <>
                <div className="detail-head">
                  <div><strong className="name">{detail.data.name}</strong><span className="cat">{detail.data.category} · {detail.data.stock} in stock</span></div>
                  <Badge source={detail.meta.source} />
                </div>
                <div className="timing"><b>{detail.meta.timeMs}</b> ms</div>
                <Trace meta={detail.meta} dbDelayMs={stats?.dbDelayMs ?? 0} />
                <button className="secondary" disabled={busy} onClick={() => openProduct(detail.data.id)}>Request this product again</button>
                <div className="pricebox">
                  <label htmlFor="price">Update price (clears this product from the cache)</label>
                  <div className="row">
                    <input id="price" type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} />
                    <button onClick={changePrice}>Save price</button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="panel">
            <h2>Cache statistics</h2>
            {stats && (
              <>
                <dl className="stats">
                  <div><dt>Hits</dt><dd>{stats.hits}</dd></div>
                  <div><dt>Misses</dt><dd>{stats.misses}</dd></div>
                  <div><dt>Hit ratio</dt><dd>{stats.hitRatio}%</dd></div>
                  <div><dt>Database queries</dt><dd>{stats.dbQueries}</dd></div>
                  <div><dt>Avg time on hit</dt><dd>{stats.avgHitMs} ms</dd></div>
                  <div><dt>Avg time on miss</dt><dd>{stats.avgMissMs} ms</dd></div>
                </dl>
                <p className="improve">Redis responses are <b>{stats.improvementPct}%</b> faster than database responses.</p>
                <p className="keys">Cached keys: {stats.cachedKeys.length ? stats.cachedKeys.join(', ') : 'none'}</p>
                <ul className="recent">
                  {stats.recent.map((r, i) => <li key={i}><Badge source={r.source} /> <span>{r.key}</span> <em>{r.timeMs} ms</em></li>)}
                </ul>
              </>
            )}
            <div className="row actions">
              <button className="secondary" onClick={clearCache}>Clear cache</button>
              <button className="secondary" onClick={resetStats}>Reset statistics</button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
