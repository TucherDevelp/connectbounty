// ── Create Listing Page ───────────────────────────
function renderCreateListing() {
  const { user } = Store.getState();
  if (!user) {
    return `<div class="container section">
      <div class="empty-state">
        <div class="empty-state-icon">🔐</div>
        <div class="empty-state-title">Anmeldung erforderlich</div>
        <div class="empty-state-text">Um ein Inserat zu erstellen, musst du eingeloggt sein.</div>
        <button class="btn btn-primary mt-4" onclick="navigate('/login')">Jetzt anmelden</button>
      </div>
    </div>`;
  }

  return `
    <div class="container" style="padding-top:var(--sp-8);padding-bottom:var(--sp-16);max-width:640px;">
      <button class="btn btn-ghost btn-sm mb-6" onclick="navigate('/marketplace')" style="padding-left:0;">
        ← Zurück zum Marktplatz
      </button>

      <div class="card">
        <h1 class="text-h2" style="margin-bottom:4px;">Inserat erstellen</h1>
        <p class="text-sm text-muted" style="margin-bottom:var(--sp-6);">Dein Bonusprogramm anonym auf dem Marktplatz inserieren.</p>

        <form id="create-form" class="flex-col gap-4" onsubmit="submitListing(event)">

          <div class="form-group">
            <label class="form-label">Kategorie *</label>
            <select class="form-select" id="f-category" required>
              <option value="">Kategorie wählen...</option>
              <option value="sign-on-bonuses">🚀 Sign-On Boni</option>
              <option value="contractor-roles">💼 Freelancer-Rollen</option>
              <option value="student-programs">🎓 Studentenprogramme</option>
              <option value="sales-incentives">📈 Sales Incentives</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Unternehmen *</label>
            <input class="form-input" id="f-company" type="text" placeholder="z.B. SAP, BMW, PwC" required />
          </div>

          <div class="form-group">
            <label class="form-label">Position / Titel *</label>
            <input class="form-input" id="f-title" type="text" placeholder="z.B. Software Engineer, Tax Assistant" required />
          </div>

          <div class="form-group">
            <label class="form-label">Standort</label>
            <input class="form-input" id="f-location" type="text" placeholder="z.B. München, Berlin, Remote" />
          </div>

          <div class="form-group">
            <label class="form-label">Bonusbetrag (€) *</label>
            <input class="form-input" id="f-bonus" type="number" min="1" placeholder="z.B. 3000" required />
          </div>

          <div class="form-group">
            <label class="form-label">Beschreibung</label>
            <textarea class="form-input" id="f-description" placeholder="Details zum Bonus-Programm, Anforderungen, etc." rows="4"></textarea>
          </div>

          <div style="display:flex;align-items:center;gap:10px;padding:12px 0;">
            <input type="checkbox" id="f-anonymous" checked style="width:18px;height:18px;accent-color:var(--c-primary);">
            <label for="f-anonymous" style="font-size:0.9rem;cursor:pointer;">Anonym inserieren (empfohlen)</label>
          </div>

          <div id="create-error" class="form-error hidden"></div>

          <button type="submit" class="btn btn-primary btn-full btn-lg" id="create-btn">
            Inserat veröffentlichen
          </button>
        </form>
      </div>
    </div>
  `;
}

async function submitListing(e) {
  e.preventDefault();
  const btn = document.getElementById('create-btn');
  const errEl = document.getElementById('create-error');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Wird erstellt...';

  const data = {
    category: document.getElementById('f-category').value,
    company: document.getElementById('f-company').value,
    title: document.getElementById('f-title').value,
    location: document.getElementById('f-location').value,
    bonus: parseInt(document.getElementById('f-bonus').value),
    description: document.getElementById('f-description').value,
    isAnonymous: document.getElementById('f-anonymous').checked,
  };

  const result = await ListingsAPI.create(data);

  if (result.error) {
    errEl.textContent = result.error;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Inserat veröffentlichen';
  } else {
    document.querySelector('.card').innerHTML = `
      <div style="text-align:center;padding:32px 0;">
        <div style="font-size:3rem;margin-bottom:16px;">⏳</div>
        <h3 class="text-h3" style="margin-bottom:8px;">Inserat eingereicht!</h3>
        <p class="text-muted" style="line-height:1.6;margin-bottom:24px;">Dein Inserat wurde erfolgreich erstellt und zur Prüfung an einen Administrator gesendet. Es wird veröffentlicht, sobald es genehmigt wurde.</p>
        <button class="btn btn-secondary" onclick="navigate('/marketplace')">Zurück zum Marktplatz</button>
      </div>
    `;
    Toast.success('Eingereicht', 'Dein Inserat wartet auf Freigabe.');
  }
}
