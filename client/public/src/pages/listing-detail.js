// ── Listing Detail Page ───────────────────────────
async function renderListingDetail({ id }) {
  const listing = await ListingsAPI.getById(id);
  const { user } = Store.getState();

  if (listing.error) {
    return `<div class="container section"><div class="empty-state">
      <div class="empty-state-icon">😕</div>
      <div class="empty-state-title">Inserat nicht gefunden</div>
      <button class="btn btn-primary mt-4" onclick="navigate('/marketplace')">Zurück zum Marktplatz</button>
    </div></div>`;
  }

  const icon = CAT_ICONS[listing.category] || '💰';
  const catLabel = CATEGORIES.find(c => c.id === listing.category)?.label || listing.category;

  return `
    <div class="container" style="padding-top:var(--sp-8);padding-bottom:var(--sp-16);">
      <button class="btn btn-ghost btn-sm mb-6" onclick="navigate('/marketplace')" style="padding-left:0;">
        ← Zurück zum Marktplatz
      </button>

      <div style="display:grid;grid-template-columns:1fr;gap:var(--sp-6);">

        <!-- Detail Card -->
        <div class="card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:var(--sp-4);">
              <div style="font-size:3rem;">${icon}</div>
              <div>
                <div style="font-size:1.5rem;font-weight:700;font-family:var(--font-display);">${listing.company}</div>
                <div class="text-muted">${catLabel}</div>
              </div>
            </div>
            <div style="background:var(--c-primary-glow);border:2px solid var(--c-primary);border-radius:var(--r-lg);padding:12px 20px;text-align:center;">
              <div style="font-family:var(--font-display);font-size:1.75rem;font-weight:800;color:var(--c-primary);">${listing.bonus.toLocaleString('de-DE')} ${listing.currency}</div>
              <div style="font-size:0.75rem;color:var(--c-text-muted);">Bonus bei Vermittlung</div>
            </div>
          </div>

          <div class="divider"></div>

          <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:8px;">${listing.title}</h2>
          ${listing.location ? `<div class="text-muted text-sm" style="margin-bottom:16px;">📍 ${listing.location}</div>` : ''}
          <p style="color:var(--c-text-muted);line-height:1.7;">${listing.description || 'Keine Beschreibung verfügbar.'}</p>

          <div class="divider"></div>

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div class="text-xs text-muted">Inseriert am ${new Date(listing.created_at).toLocaleDateString('de-DE')}</div>
            ${listing.is_anonymous ? '<div class="badge badge-muted">Anonym inseriert</div>' : ''}
          </div>
        </div>

        <!-- Chat / Match Section -->
        <div class="card">
          <h3 class="text-h3" style="margin-bottom:4px;">
            💬 Kontakt aufnehmen
            <span class="chat-ai-badge" style="margin-left:8px;">KI-überwacht</span>
          </h3>
          <p class="text-sm text-muted" style="margin-bottom:var(--sp-4);">
            Alle Nachrichten werden durch unsere KI auf Richtlinienverstöße geprüft. 
            Vermittlungen außerhalb der Plattform sind nicht erlaubt.
          </p>
          ${user
            ? `<div class="chat-widget" id="chat-widget">
                <div class="chat-messages" id="chat-messages">
                  <div class="chat-msg chat-msg-in" style="background:var(--c-primary-glow);color:var(--c-primary);border:1px solid rgba(245,166,35,0.2);">
                    🍬 Willkommen! Stelle eine Frage zu diesem Inserat. Alle Nachrichten werden durch Connect Bounty überwacht.
                  </div>
                </div>
                <div class="chat-input-row">
                  <input class="chat-input" id="chat-input" type="text" placeholder="Nachricht schreiben..." maxlength="2000"
                    onkeydown="if(event.key==='Enter')sendChat('${listing.id}','${user.id}')">
                  <button class="btn btn-primary btn-sm" onclick="sendChat('${listing.id}','${user.id}')">→</button>
                </div>
              </div>`
            : `<div style="background:var(--c-surface-2);border-radius:var(--r-md);padding:var(--sp-6);text-align:center;">
                <div style="font-size:1.5rem;margin-bottom:8px;">🔐</div>
                <div style="font-weight:600;margin-bottom:8px;">Anmeldung erforderlich</div>
                <div class="text-sm text-muted" style="margin-bottom:16px;">Um den Inserenten zu kontaktieren, musst du eingeloggt sein.</div>
                <button class="btn btn-primary" onclick="navigate('/login')">Jetzt anmelden</button>
              </div>`
          }
        </div>

      </div>
    </div>
  `;
}

async function sendChat(listingId, receiverId) {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  const messagesEl = document.getElementById('chat-messages');

  // Optimistic UI – eigene Nachricht sofort anzeigen
  const ownMsg = document.createElement('div');
  ownMsg.className = 'chat-msg chat-msg-out';
  ownMsg.textContent = msg;
  messagesEl.appendChild(ownMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const result = await UserAPI.sendChatMessage({ listingId, receiverId, message: msg });

    if (result.flagged && result.aiWarning) {
      const warningEl = document.createElement('div');
      warningEl.className = 'chat-msg chat-msg-flagged';
      warningEl.textContent = result.aiWarning;
      messagesEl.appendChild(warningEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      Toast.warning('Nachricht markiert', 'Möglicher Richtlinienverstoß erkannt.');
    }
  } catch (e) {
    Toast.error('Fehler', 'Nachricht konnte nicht gesendet werden.');
  }
}
