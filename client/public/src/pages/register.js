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
            <svg viewBox="0 0 50 30" xmlns="http://www.w3.org/2000/svg">
              <defs><radialGradient id="regGrad" cx="42%" cy="36%"><stop offset="0%" stop-color="#FFD76E"/><stop offset="40%" stop-color="#F5A623"/><stop offset="100%" stop-color="#C47A10"/></radialGradient></defs>
              <path d="M16 15 L5 10 C3 9 1 11 2 12.5 C3 14 5.5 14 7 13 L16 15 Z" fill="#F5A623"/>
              <path d="M16 15 L6 17 C4 17.5 3 19.5 4.5 20.5 C6 21.5 8 20 9 18.5 L16 15 Z" fill="#FFD76E" opacity="0.7"/>
              <path d="M34 15 L45 10 C47 9 49 11 48 12.5 C47 14 44.5 14 43 13 L34 15 Z" fill="#F5A623"/>
              <path d="M34 15 L44 17 C46 17.5 47 19.5 45.5 20.5 C44 21.5 42 20 41 18.5 L34 15 Z" fill="#FFD76E" opacity="0.7"/>
              <circle cx="25" cy="15" r="11" fill="url(#regGrad)"/>
              <ellipse cx="21" cy="11" rx="4" ry="3" fill="rgba(255,255,255,0.4)" transform="rotate(-20 21 11)"/>
              <ellipse cx="19.5" cy="10" rx="2" ry="1.3" fill="rgba(255,255,255,0.55)" transform="rotate(-25 19.5 10)"/>
            </svg>
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
  } else {
    Store.setState({ user: result.user, token: result.token });
    Store.persist();
    Toast.success('Willkommen!', `Account erstellt. Dein Referral-Code: ${result.user.referralCode}`);
    // Bonbon-Entpack-Animation nach Registrierung abspielen
    if (window.replaySplash) {
      replaySplash();
      setTimeout(() => navigate('/referral'), 3200);
    } else {
      navigate('/referral');
    }
  }
}
