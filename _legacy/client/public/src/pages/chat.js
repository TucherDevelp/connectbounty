// ── Chat List Page ────────────────────────────────
async function renderChatList() {
  const { user } = Store.getState();
  if (!user) {
    return `<div class="container section"><div class="empty-state">
      <div class="empty-state-icon">🔐</div>
      <div class="empty-state-title">Bitte einloggen</div>
      <button class="btn btn-primary mt-4" onclick="navigate('/login')">Jetzt anmelden</button>
    </div></div>`;
  }

  const conversations = await UserAPI.getConversations();
  const convList = Array.isArray(conversations) ? conversations : [];

  if (convList.length === 0) {
    return `
      <div class="container section">
        <h1 class="text-h2 mb-6">💬 Meine Chats</h1>
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-title">Noch keine Konversationen</div>
          <p class="text-sm text-muted mt-2">Starte eine Anfrage über ein Inserat im Marktplatz.</p>
          <button class="btn btn-primary mt-4" onclick="navigate('/marketplace')">Zum Marktplatz</button>
        </div>
      </div>`;
  }

  const convCards = convList.map(c => {
    const timeStr = c.last_message_at
      ? new Date(c.last_message_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';
    const preview = c.last_message
      ? (c.last_message.length > 60 ? c.last_message.substring(0, 60) + '...' : c.last_message)
      : 'Noch keine Nachrichten';
    const roleLabel = c.isOwner
      ? '<span class="badge badge-primary" style="font-size:0.65rem;">Mein Inserat</span>'
      : '<span class="badge badge-muted" style="font-size:0.65rem;">Bewerber</span>';

    return `
      <div class="card chat-conv-card" onclick="navigate('/chat/${c.id}')" style="cursor:pointer;transition:transform 0.15s ease,box-shadow 0.15s ease;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-weight:700;font-size:1rem;">${escapeHtml(c.listing_company)}</span>
              ${roleLabel}
            </div>
            <div class="text-sm" style="color:var(--c-text);margin-bottom:4px;">${escapeHtml(c.listing_title)}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <div class="profile-avatar" style="width:24px;height:24px;font-size:0.65rem;">${escapeHtml((c.partnerUsername || 'U').replace('@','').charAt(0).toUpperCase())}</div>
              <span class="text-sm text-muted">${escapeHtml(c.partnerUsername)}</span>
            </div>
            <div class="text-sm text-muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(preview)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-weight:800;color:var(--c-primary);font-size:0.95rem;">${c.listing_bonus?.toLocaleString('de-DE') || '–'} ${escapeHtml(c.listing_currency || 'EUR')}</div>
            <div class="text-xs text-muted" style="margin-top:4px;">${timeStr}</div>
            <div class="text-xs text-muted">${c.message_count || 0} Nachr.</div>
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="container" style="padding-top:var(--sp-8);padding-bottom:var(--sp-16);max-width:680px;">
      <h1 class="text-h2 mb-6">💬 Meine Chats</h1>
      <div class="flex-col gap-4">
        ${convCards}
      </div>
    </div>`;
}
