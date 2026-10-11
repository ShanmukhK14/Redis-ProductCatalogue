// Every call to the backend goes through here, so the UI never builds URLs itself.
const json = async (url, options) => {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
};

export const api = {
  list: (q, category) => json(`/api/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`),
  product: (id) => json(`/api/products/${id}`),
  updatePrice: (id, price) => json(`/api/products/${id}/price`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price }),
  }),
  clearCache: () => json('/api/cache/clear', { method: 'POST' }),
  stats: () => json('/api/stats'),
  resetStats: () => json('/api/stats/reset', { method: 'POST' }),
};
