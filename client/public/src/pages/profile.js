// ── Profile Page ──────────────────────────────────
async function renderProfile() {
  const { user } = Store.getState();
  if (!user) {
    return `<div class="container section"><div class="empty-state">
      <div class="empty-state-icon">🔐</div>
      <div class="empty-state-title">Bitte einloggen</div>
      <button class="btn btn-primary mt-4" onclick="navigate('/login')">Jetzt anmelden</button>
    </div></div>`;
  }

  const profile = await UserAPI.getProfile();
  const initial = (profile.username || 'U').replace('@','').charAt(0).toUpperCase();

  return `
    <div class="container" style="padding-top:var(--sp-8);padding-bottom:var(--sp-16);max-width:640px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-6);">
        <h1 class="text-h2">Mein Profil</h1>
        <button class="btn btn-ghost btn-sm" onclick="logoutUser()" style="color:var(--c-error);">Abmelden</button>
      </div>

      <!-- Avatar + Username -->
      <div class="card mb-4" style="display:flex;align-items:center;gap:var(--sp-4);">
        <div class="profile-avatar">${initial}</div>
        <div>
          <div style="font-weight:700;font-size:1.1rem;">${profile.username}</div>
          <div class="text-sm text-muted">${profile.email}</div>
          <div class="badge badge-primary" style="margin-top:6px;">${profile.referralPoints} Punkte</div>
        </div>
      </div>

      <!-- Persoenliche Daten -->
      <div class="card mb-4">
        <h3 class="text-h3" style="margin-bottom:var(--sp-4);">Persoenliche Daten</h3>
        <form class="flex-col gap-4" onsubmit="saveProfile(event)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);">
            <div class="form-group">
              <label class="form-label">Vollstaendiger Name</label>
              <input class="form-input" id="p-realname" type="text" value="${profile.realName || ''}" placeholder="Max Mustermann" />
            </div>
            <div class="form-group">
              <label class="form-label">Geburtsdatum</label>
              <input class="form-input" id="p-dob" type="date" value="${profile.dateOfBirth || ''}" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);">
            <div class="form-group">
              <label class="form-label">Stadt</label>
              <input class="form-input" id="p-city" type="text" value="${profile.city || ''}" placeholder="Berlin" />
            </div>
            <div class="form-group">
              <label class="form-label">PLZ</label>
              <input class="form-input" id="p-plz" type="text" value="${profile.postalCode || ''}" placeholder="10115" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Land</label>
            <select class="form-select" id="p-country">
              ${['Deutschland','Oesterreich','Schweiz','USA','Vereinigtes Koenigreich','Andere'].map(c =>
                `<option ${profile.country === c ? 'selected' : ''}>${c}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Profil-Sichtbarkeit</label>
            <select class="form-select" id="p-visibility">
              <option value="public" ${profile.profileVisibility === 'public' ? 'selected' : ''}>Oeffentlich</option>
              <option value="private" ${profile.profileVisibility === 'private' ? 'selected' : ''}>Privat</option>
            </select>
          </div>
          <div id="profile-msg" class="hidden"></div>
          <button type="submit" class="btn btn-primary">Speichern</button>
        </form>
      </div>

      <!-- KYC-Verifizierung -->
      <div class="card mb-4">
        <h3 class="text-h3" style="margin-bottom:var(--sp-4);">🛡️ KYC-Verifizierung</h3>
        <p class="text-sm text-muted mb-4">Lade ein Foto deines Ausweises hoch. Unser System gleicht deinen angegebenen Namen und Geburtsdatum automatisch ab. Bilder werden nach der Prüfung <b>sofort gelöscht</b>.</p>
        
        ${profile.kycVerified
          ? `<div style="display:flex;align-items:center;gap:8px;padding:12px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:var(--r-md);">
              <span style="font-size:1.5rem;">✅</span>
              <div>
                <div style="font-weight:700;color:#22C55E;">Verifiziert</div>
                <div class="text-sm text-muted">Du kannst Inserenten kontaktieren.</div>
              </div>
            </div>`
          : `<div style="padding:12px;background:var(--c-surface-2);border-radius:var(--r-md);margin-bottom:12px;">
              ${profile.kycStatus === 'rejected' ? `<div style="color:var(--c-error);margin-bottom:8px;font-weight:600;font-size:0.85rem;">Letzter Versuch fehlgeschlagen. Daten stimmten nicht überein.</div>` : ''}
              
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:1.5rem;">⚠️</span>
                <div>
                  <div style="font-weight:700;">Nicht verifiziert</div>
                  <div class="text-sm text-muted">Lade ein klares Foto deines Ausweises hoch.</div>
                </div>
              </div>
              <input type="file" id="kyc-file-input" accept="image/jpeg, image/png" style="margin-bottom: 12px; width: 100%;" />
              <button class="btn btn-primary btn-full" id="kyc-verify-btn" onclick="doKycVerify()">Jetzt verifizieren</button>
            </div>`
        }
      </div>

      <!-- Quick Links -->
      <div class="card" style="display:flex;flex-direction:column;gap:var(--sp-2);">
        <button class="btn btn-secondary" onclick="navigate('/chat')">Meine Chats</button>
        <button class="btn btn-secondary" onclick="navigate('/referral')">Mein Referral-Code</button>
        <button class="btn btn-secondary" onclick="navigate('/payment')">Zahlungsmethode &amp; Auszahlung</button>
      </div>
    </div>
  `;
}

async function saveProfile(e) {
  e.preventDefault();
  const result = await UserAPI.updateProfile({
    realName: document.getElementById('p-realname').value,
    dateOfBirth: document.getElementById('p-dob').value,
    country: document.getElementById('p-country').value,
    city: document.getElementById('p-city').value,
    postalCode: document.getElementById('p-plz').value,
    profileVisibility: document.getElementById('p-visibility').value,
  });
  if (result.error) {
    Toast.error('Fehler', result.error);
  } else {
    Toast.success('Gespeichert!', 'Profil wurde aktualisiert.');
  }
}

async function doKycVerify() {
  const fileInput = document.getElementById('kyc-file-input');
  if (!fileInput || !fileInput.files[0]) {
    return Toast.warning('Datei fehlt', 'Bitte wähle ein Ausweisfoto aus.');
  }

  const btn = document.getElementById('kyc-verify-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'KI analysiert Ausweis...';
  }

  const result = await UserAPI.uploadKyc(fileInput.files[0]);
  
  if (result.error) {
    Toast.error('Fehler', result.error);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Jetzt verifizieren';
    }
    // Refresh to show rejected state if applicable
    if (result.error.includes("stimmen nicht überein") || result.error.includes("konnte das Dokument nicht lesen")) {
      setTimeout(() => navigate('/profile'), 1500);
    }
  } else {
    Toast.success('Verifiziert!', 'Dein KYC-Status wurde aktualisiert.');
    navigate('/profile');
  }
}

function logoutUser() {
  Store.logout();
  renderNavActions();
  Toast.info('Abgemeldet', 'Bis bald!');
  navigate('/');
}
