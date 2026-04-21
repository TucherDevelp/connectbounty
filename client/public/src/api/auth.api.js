// ── Auth API ──────────────────────────────────────
const AuthAPI = (() => {
  const BASE = '/api/auth';

  async function register(data) {
    const res = await fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async function login(data) {
    const res = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async function getMe() {
    const { token } = Store.getState();
    if (!token) return null;
    const res = await fetch(`${BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  return { register, login, getMe };
})();
