// ── Referral Page ─────────────────────────────────
async function renderReferral() {
  const { user } = Store.getState();
  if (!user) {
    return `<div class="container section"><div class="empty-state">
      <div class="empty-state-icon">🔐</div>
      <div class="empty-state-title">Bitte einloggen</div>
      <button class="btn btn-primary mt-4" onclick="navigate('/login')">Jetzt anmelden</button>
    </div></div>`;
  }

  const data = await UserAPI.getReferral();
  const code = data.referralCode || '------';
  const refLink = `${window.location.origin}/#/register?ref=${code}`;
  const waText = encodeURIComponent(`🍬 Tritt Connect Bounty bei und verdiene Boni bei Job-Vermittlungen!\n${refLink}`);

  return `
    <div class="container" style="padding-top:var(--sp-8);padding-bottom:var(--sp-16);max-width:560px;">
      <h1 class="text-h2 mb-6">Mein Referral-Code</h1>

      <!-- Code-Karte -->
      <div class="card text-center mb-4" style="padding:var(--sp-8);">
        <div class="text-sm text-muted" style="margin-bottom:var(--sp-4);">Dein persönlicher Code</div>

        <div class="referral-code-display" id="ref-code-display">
          ${code.split('').map(c => `<div class="referral-code-char">${c}</div>`).join('')}
        </div>

        <button class="btn btn-ghost btn-sm mt-4" onclick="copyCode('${code}')">
          📋 Code kopieren
        </button>
      </div>

      <!-- Statistiken -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-4);">
        <div class="card text-center card-compact">
          <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:800;color:var(--c-primary);">${data.totalReferrals || 0}</div>
          <div class="text-xs text-muted">Referrals</div>
        </div>
        <div class="card text-center card-compact">
          <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:800;color:var(--c-primary);">${data.referralPoints || 0}</div>
          <div class="text-xs text-muted">Punkte</div>
        </div>
        <div class="card text-center card-compact">
          <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:800;color:var(--c-primary);">Lv.${Math.floor((data.referralPoints||0)/10)+1}</div>
          <div class="text-xs text-muted">Rang</div>
        </div>
      </div>

      <!-- Info Box -->
      <div class="card mb-4" style="background:var(--c-primary-glow);border-color:rgba(245,166,35,0.2);">
        <h3 class="text-h3" style="margin-bottom:12px;">So verdienst du Punkte</h3>
        <div class="flex-col gap-2 text-sm">
          <div>🔗 <strong>1 Punkt</strong> für jeden, den du einlädst</div>
          <div>✅ <strong>2 Punkte</strong> für jede erfolgreiche Registrierung</div>
          <div>💼 Punkte verbessern dein Ranking auf dem Marktplatz</div>
          <div>💰 Zukünftig gegen Provisionen eintauschbar</div>
        </div>
      </div>

      <!-- Share Buttons -->
      <div class="flex-col gap-3">
        <a class="btn btn-primary btn-full"
           href="https://wa.me/?text=${waText}"
           target="_blank" rel="noopener">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Via WhatsApp teilen
        </a>
        <button class="btn btn-secondary btn-full" onclick="shareEmail('${refLink}','${code}')">
          ✉️ Via E-Mail teilen
        </button>
        <button class="btn btn-ghost btn-full" onclick="copyCode('${refLink}')">
          🔗 Link kopieren
        </button>
      </div>
    </div>
  `;
}

function copyCode(text) {
  navigator.clipboard.writeText(text).then(() => {
    Toast.success('Kopiert!', 'In die Zwischenablage kopiert.');
  });
}

function shareEmail(link, code) {
  const subject = encodeURIComponent('Tritt Connect Bounty bei!');
  const body = encodeURIComponent(`Hey!\n\nIch nutze Connect Bounty – die Plattform für Job-Vermittlungsboni.\n\nRegistriere dich mit meinem Code ${code}:\n${link}\n\nDu hilfst mir dabei, mehr Punkte zu sammeln. Danke!`);
  window.open(`mailto:?subject=${subject}&body=${body}`);
}
