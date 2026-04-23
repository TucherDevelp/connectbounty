// ── Register Page ─────────────────────────────────
function renderRegister() {
  // Referral-Code aus URL extrahieren (#/register?ref=XXXXX)
  const hash = window.location.hash;
  const refMatch = hash.match(/[?&]ref=([A-Z0-9]+)/i);
  const prefilledRef = refMatch ? refMatch[1].toUpperCase() : '';

  return `
    <div class="flex-center" style="min-height:calc(100dvh - var(--nav-h));padding:var(--sp-8) var(--sp-4);">
      <div class="card anim-scale-in" style="width:100%;max-width:440px;">
        <div class="text-center mb-6">
          <div style="width:80px;height:48px;margin:0 auto 12px;">
            <img src="/assets/bonbon-logo.svg" alt="Connect Bounty" style="width:100%;height:100%;object-fit:contain;" />
          </div>
          <h1 class="text-h2">Konto erstellen</h1>
          <p class="text-sm text-muted mt-4">Registriere dich kostenlos und starte mit Connect Bounty.</p>
        </div>

        <form id="reg-form" class="flex-col gap-4" onsubmit="submitRegister(event)">
          <div class="form-group">
            <label class="form-label">Benutzername</label>
            <input class="form-input" id="r-username" type="text" placeholder="@dein_name" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label class="form-label">E-Mail</label>
            <input class="form-input" id="r-email" type="email" placeholder="deine@email.de" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Passwort (min. 6 Zeichen)</label>
            <input class="form-input" id="r-password" type="password" placeholder="••••••••" required autocomplete="new-password" minlength="6" />
          </div>
          <div class="form-group">
            <label class="form-label">Referral-Code (optional)</label>
            <input class="form-input" id="r-referral" type="text" placeholder="z.B. A4BC2G" value="${prefilledRef}"
              style="letter-spacing:0.1em;text-transform:uppercase;" maxlength="6" />
            <span class="text-xs text-muted">Hast du einen Code? Dein Werber erhält 2 Punkte.</span>
          </div>

          <div id="reg-error" class="form-error hidden"></div>

          <button type="submit" class="btn btn-primary btn-full" id="reg-btn">Jetzt registrieren</button>
        </form>

        <div class="divider"></div>
        <p class="text-sm text-center text-muted">
          Bereits registriert? 
          <a onclick="navigate('/login')" style="color:var(--c-primary);cursor:pointer;font-weight:600;">Anmelden</a>
        </p>
      </div>
    </div>
  `;
}

async function submitRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('reg-btn');
  const errEl = document.getElementById('reg-error');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Wird registriert...';

  const result = await AuthAPI.register({
    username: document.getElementById('r-username').value,
    email: document.getElementById('r-email').value,
    password: document.getElementById('r-password').value,
    referralCode: document.getElementById('r-referral').value.toUpperCase() || undefined,
  });

  if (result.error) {
    errEl.textContent = result.error;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Jetzt registrieren';
  } else if (result.pendingApproval) {
    // Registrierung war erfolgreich, aber noch nicht aktiv
    document.getElementById('reg-form').innerHTML = `
      <div style="text-align:center;padding:32px 0;">
        <div style="font-size:3rem;margin-bottom:16px;">⏳</div>
        <h3 class="text-h3" style="margin-bottom:8px;">Registrierung erfolgreich!</h3>
        <p class="text-muted" style="line-height:1.6;margin-bottom:24px;">Dein Account wurde erstellt, muss aber noch von einem Administrator freigegeben werden. Bitte überprüfe später, ob der Login möglich ist.</p>
        <button class="btn btn-secondary" onclick="navigate('/login')">Zum Login</button>
      </div>
    `;
  } else {
    Store.setState({ user: result.user, token: result.token });
    Store.persist();
    Toast.success('Willkommen!', `Account erstellt. Dein Referral-Code: ${result.user.referralCode}`);
    if (window.replaySplash) {
      replaySplash();
      setTimeout(() => navigate('/referral'), 3200);
    } else {
      navigate('/referral');
    }
  }
}
