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

  async function uploadKyc(file) {
    const { token } = Store.getState();
    const formData = new FormData();
    formData.append('idDocument', file);

    const res = await fetch('/api/user/kyc/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }, // NO Content-Type, browser will set boundary
      body: formData,
    });
    return res.json();
  }

  // ── Conversation-basierter Chat ────────────
  async function startConversation(listingId) {
    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ listingId }),
    });
    return res.json();
  }

  async function getConversations() {
    const res = await fetch('/api/chat/conversations', { headers: authHeader() });
    return res.json();
  }

  async function getConversationMessages(conversationId) {
    const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, { headers: authHeader() });
    return res.json();
  }

  async function sendConversationMessage(conversationId, message) {
    const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ message }),
    });
    return res.json();
  }

  // Legacy
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

  return {
    getProfile, updateProfile, updatePayment, requestPayout, getReferral, uploadKyc,
    startConversation, getConversations, getConversationMessages, sendConversationMessage,
    sendChatMessage, getChatMessages,
  };
})();
