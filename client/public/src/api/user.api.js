// ── User API ──────────────────────────────────────
const UserAPI = (() => {
  function authHeader() {
    const { token } = Store.getState();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  async function getProfile() {
    const res = await fetch('/api/user/profile', { headers: authHeader() });
    return res.json();
  }

  async function updateProfile(data) {
    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: authHeader(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async function updatePayment(data) {
    const res = await fetch('/api/user/payment', {
      method: 'PUT',
      headers: authHeader(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async function requestPayout(amount) {
    const res = await fetch('/api/user/payout', {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ amount }),
    });
    return res.json();
  }

  async function getReferral() {
    const res = await fetch('/api/referral', { headers: authHeader() });
    return res.json();
  }

  async function sendChatMessage(data) {
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async function getChatMessages(listingId) {
    const res = await fetch(`/api/chat/messages?listingId=${listingId}`, { headers: authHeader() });
    return res.json();
  }

  return { getProfile, updateProfile, updatePayment, requestPayout, getReferral, sendChatMessage, getChatMessages };
})();
