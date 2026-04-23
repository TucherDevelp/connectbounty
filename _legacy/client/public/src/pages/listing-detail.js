// ── Listing Detail Page ───────────────────────────
// CAT_ICONS and CATEGORIES are defined in marketplace.js


async function renderListingDetail({ id }) {
  const listing = await ListingsAPI.getById(id);
  const { user } = Store.getState();

  if (listing.error) {
    return `<div class="container section"><div class="empty-state">
      <div class="empty-state-icon">&#128533;</div>
      <div class="empty-state-title">Inserat nicht gefunden</div>
      <button class="btn btn-primary mt-4" onclick="navigate('/marketplace')">Zurueck zum Marktplatz</button>
    </div></div>`;
  }

  const icon = CAT_ICONS[listing.category] || '&#128176;';
  const catLabel = CATEGORIES.find(c => c.id === listing.category)?.label || listing.category;

  // Pruefen ob der User der Inserent ist
  const isOwner = user && listing.created_by === user.id;

  // Chat-Bereich bestimmen
  let chatSection = '';
  if (!user) {
    chatSection = `
      <div style="background:var(--c-surface-2);border-radius:var(--r-md);padding:var(--sp-6);text-align:center;">
        <div style="font-size:1.5rem;margin-bottom:8px;">&#128274;</div>
        <div style="font-weight:600;margin-bottom:8px;">Anmeldung erforderlich</div>
        <div class="text-sm text-muted" style="margin-bottom:16px;">Um den Inserenten zu kontaktieren, musst du eingeloggt sein.</div>
        <button class="btn btn-primary" onclick="navigate('/login')">Jetzt anmelden</button>
      </div>`;
  } else if (isOwner) {
    chatSection = `
      <div style="background:var(--c-surface-2);border-radius:var(--r-md);padding:var(--sp-6);text-align:center;">
        <div style="font-size:1.5rem;margin-bottom:8px;">&#128221;</div>
        <div style="font-weight:600;margin-bottom:8px;">Dein Inserat</div>
        <div class="text-sm text-muted" style="margin-bottom:16px;">Anfragen zu diesem Inserat findest du in deinen Chats.</div>
        <button class="btn btn-primary" onclick="navigate('/chat')">Meine Chats oeffnen</button>
      </div>`;
  } else {
    chatSection = `
      <div style="text-align:center;padding:var(--sp-4) 0;">
        <button class="btn btn-primary btn-full" id="start-conv-btn" onclick="startListingConv('${listing.id}')">
          Anfrage starten
        </button>
        <div class="text-xs text-muted" style="margin-top:8px;">KYC-Verifizierung erforderlich. Alle Nachrichten werden KI-ueberwacht.</div>
      </div>`;
  }

  return `
    <div class="container" style="padding-top:var(--sp-8);padding-bottom:var(--sp-16);">
      <button class="btn btn-ghost btn-sm mb-6" onclick="navigate('/marketplace')" style="padding-left:0;">
        &#8592; Zurueck zum Marktplatz
      </button>

      <div style="display:grid;grid-template-columns:1fr;gap:var(--sp-6);">

        <!-- Detail Card -->
        <div class="card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:var(--sp-4);">
              <div style="font-size:3rem;">${icon}</div>
              <div>
                <div style="font-size:1.5rem;font-weight:700;font-family:var(--font-display);">${escapeHtml(listing.company)}</div>
                <div class="text-muted">${escapeHtml(catLabel)}</div>
              </div>
            </div>
            <div style="background:var(--c-primary-glow);border:2px solid var(--c-primary);border-radius:var(--r-lg);padding:12px 20px;text-align:center;">
              <div style="font-family:var(--font-display);font-size:1.75rem;font-weight:800;color:var(--c-primary);">${listing.bonus.toLocaleString('de-DE')} ${escapeHtml(listing.currency)}</div>
              <div style="font-size:0.75rem;color:var(--c-text-muted);">Bonus bei Vermittlung</div>
            </div>
          </div>

          <div class="divider"></div>

          <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:8px;">${escapeHtml(listing.title)}</h2>
          ${listing.location ? `<div class="text-muted text-sm" style="margin-bottom:16px;">&#128205; ${escapeHtml(listing.location)}</div>` : ''}
          <p style="color:var(--c-text-muted);line-height:1.7;">${escapeHtml(listing.description || 'Keine Beschreibung verfuegbar.')}</p>

          <div class="divider"></div>

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div class="text-xs text-muted">Inseriert am ${new Date(listing.created_at).toLocaleDateString('de-DE')}</div>
            ${listing.is_anonymous ? '<div class="badge badge-muted">Anonym inseriert</div>' : ''}
          </div>
        </div>

        <!-- Chat / Anfrage Section -->
        <div class="card">
          <h3 class="text-h3" style="margin-bottom:4px;">
            Kontakt aufnehmen
            <span class="chat-ai-badge" style="margin-left:8px;">KI-ueberwacht</span>
          </h3>
          <p class="text-sm text-muted" style="margin-bottom:var(--sp-4);">
            Alle Nachrichten werden durch unsere KI auf Richtlinienverstoesse geprueft.
          </p>
          ${chatSection}
        </div>

      </div>
    </div>
  `;
}

async function startListingConv(listingId) {
  const btn = document.getElementById('start-conv-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Wird gestartet...'; }

  try {
    const result = await UserAPI.startConversation(listingId);

    if (result.error) {
      if (result.error.includes('KYC')) {
        Toast.warning('KYC erforderlich', 'Bitte verifiziere dich zuerst in deinem Profil.');
        navigate('/profile');
      } else {
        Toast.error('Fehler', result.error);
        if (btn) { btn.disabled = false; btn.textContent = 'Anfrage starten'; }
      }
      return;
    }

    Toast.success('Konversation gestartet!', 'Du kannst jetzt chatten.');
    navigate('/chat/' + result.conversationId);
  } catch (e) {
    Toast.error('Fehler', 'Konversation konnte nicht gestartet werden.');
    if (btn) { btn.disabled = false; btn.textContent = 'Anfrage starten'; }
  }
}
