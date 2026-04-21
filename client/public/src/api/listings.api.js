// ── Listings API ──────────────────────────────────
const ListingsAPI = (() => {
  const BASE = '/api/listings';

  async function getAll(category) {
    const url = category ? `${BASE}?category=${category}` : BASE;
    const res = await fetch(url);
    return res.json();
  }

  async function getById(id) {
    const res = await fetch(`${BASE}/${id}`);
    return res.json();
  }

  async function create(data) {
    const { token } = Store.getState();
    const res = await fetch(BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  return { getAll, getById, create };
})();
