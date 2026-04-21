// ── Payment Page ──────────────────────────────────
async function renderPayment() {
  const { user } = Store.getState();
  if (!user) {
    return `<div class="container section"><div class="empty-state">
      <div class="empty-state-icon">🔐</div>
      <div class="empty-state-title">Bitte einloggen</div>
      <button class="btn btn-primary mt-4" onclick="navigate('/login')">Jetzt anmelden</button>
    </div></div>`;
  }

  const profile = await UserAPI.getProfile();

  return `
    <div class="container" style="padding-top:var(--sp-8);padding-bottom:var(--sp-16);max-width:560px;">
      <button class="btn btn-ghost btn-sm mb-6" onclick="navigate('/profile')" style="padding-left:0;">
        ← Zurück zum Profil
      </button>
      <h1 class="text-h2 mb-6">Zahlungsmethode</h1>

      <!-- Methoden-Auswahl -->
      <div class="card mb-4">
        <h3 class="text-h3" style="margin-bottom:var(--sp-4);">Zahlungsmethode wählen</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-4);">
          <button id="tab-bank" class="tab-btn ${profile.paymentType !== 'paypal' ? 'active' : ''}"
            onclick="switchPaymentTab('bank')">🏦 Banküberweisung</button>
          <button id="tab-paypal" class="tab-btn ${profile.paymentType === 'paypal' ? 'active' : ''}"
            onclick="switchPaymentTab('paypal')">💳 PayPal</button>
        </div>

        <!-- Bank Form -->
        <form id="bank-form" class="flex-col gap-4" style="${profile.paymentType === 'paypal' ? 'display:none;' : ''}" onsubmit="savePayment(event,'bank')">
          <div class="form-group">
            <label class="form-label">IBAN</label>
            <input class="form-input" id="p-iban" type="text" value="${profile.paymentIban || ''}"
              placeholder="DE89 3704 0044 0532 0130 00" style="letter-spacing:0.05em;" />
          </div>
          <div class="form-group">
            <label class="form-label">BIC</label>
            <input class="form-input" id="p-bic" type="text" value="${profile.paymentBic || ''}" placeholder="COBADEFFXXX" />
          </div>
          <button type="submit" class="btn btn-primary">Bankdaten speichern</button>
        </form>

        <!-- PayPal Form -->
        <form id="paypal-form" class="flex-col gap-4" style="${profile.paymentType === 'paypal' ? '' : 'display:none;'}" onsubmit="savePayment(event,'paypal')">
          <div class="form-group">
            <label class="form-label">PayPal E-Mail-Adresse</label>
            <input class="form-input" id="p-paypal" type="email" value="${profile.paymentPaypal || ''}"
              placeholder="paypal@email.de" />
          </div>
          <button type="submit" class="btn btn-primary">PayPal speichern</button>
        </form>
      </div>

      <!-- Auszahlung -->
      <div class="card">
        <h3 class="text-h3" style="margin-bottom:var(--sp-4);">Auszahlung beantragen</h3>
        <div style="background:var(--c-primary-glow);border:1px solid rgba(245,166,35,0.2);border-radius:var(--r-md);padding:var(--sp-4);margin-bottom:var(--sp-4);">
          <div class="text-sm text-muted">Verfügbares Guthaben</div>
          <div style="font-family:var(--font-display);font-size:1.75rem;font-weight:800;color:var(--c-primary);">0,00 €</div>
          <div class="text-xs text-muted">Gebühr: 0,2% · Mindestbetrag: 10,00 €</div>
        </div>
        <form class="flex-col gap-4" onsubmit="requestPayoutSubmit(event)">
          <div class="form-group">
            <label class="form-label">Betrag (€)</label>
            <input class="form-input" id="payout-amount" type="number" min="10" step="0.01" placeholder="z.B. 50.00" />
          </div>
          <div id="payout-msg" class="hidden"></div>
          <button type="submit" class="btn btn-primary btn-full">💸 Auszahlung beantragen</button>
        </form>
        <p class="text-xs text-muted text-center mt-4">Auszahlungen werden innerhalb von 3–5 Werktagen bearbeitet.</p>
      </div>
    </div>
  `;
}

function switchPaymentTab(type) {
  const bankForm = document.getElementById('bank-form');
  const paypalForm = document.getElementById('paypal-form');
  const tabBank = document.getElementById('tab-bank');
  const tabPaypal = document.getElementById('tab-paypal');

  if (type === 'bank') {
    bankForm.style.display = '';
    paypalForm.style.display = 'none';
    tabBank.classList.add('active');
    tabPaypal.classList.remove('active');
  } else {
    bankForm.style.display = 'none';
    paypalForm.style.display = '';
    tabBank.classList.remove('active');
    tabPaypal.classList.add('active');
  }
}

async function savePayment(e, type) {
  e.preventDefault();
  const data = { paymentType: type };
  if (type === 'bank') {
    data.iban = document.getElementById('p-iban').value;
    data.bic = document.getElementById('p-bic').value;
  } else {
    data.paypal = document.getElementById('p-paypal').value;
  }
  const result = await UserAPI.updatePayment(data);
  if (result.error) {
    Toast.error('Fehler', result.error);
  } else {
    Toast.success('Gespeichert!', 'Zahlungsmethode wurde aktualisiert.');
  }
}

async function requestPayoutSubmit(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('payout-amount').value);
  if (!amount || amount < 10) {
    Toast.error('Ungültiger Betrag', 'Mindestbetrag für Auszahlungen ist 10,00 €.');
    return;
  }
  const result = await UserAPI.requestPayout(amount);
  if (result.error) {
    Toast.error('Fehler', result.error);
  } else {
    Toast.success('Auszahlung beantragt!', 'Wird innerhalb von 3–5 Werktagen bearbeitet.');
  }
}
