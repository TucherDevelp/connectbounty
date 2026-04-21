// ── Login Page ────────────────────────────────────
function renderLogin() {
  return `
    <div class="flex-center" style="min-height:calc(100dvh - var(--nav-h));padding:var(--sp-8) var(--sp-4);">
      <div class="card anim-scale-in" style="width:100%;max-width:420px;">
        <div class="text-center mb-6">
          <div style="width:80px;height:48px;margin:0 auto 12px;">
            <svg viewBox="0 0 50 30" xmlns="http://www.w3.org/2000/svg">
              <defs><radialGradient id="loginGrad" cx="42%" cy="36%"><stop offset="0%" stop-color="#FFD76E"/><stop offset="40%" stop-color="#F5A623"/><stop offset="100%" stop-color="#C47A10"/></radialGradient></defs>
              <path d="M16 15 L5 10 C3 9 1 11 2 12.5 C3 14 5.5 14 7 13 L16 15 Z" fill="#F5A623"/>
              <path d="M16 15 L6 17 C4 17.5 3 19.5 4.5 20.5 C6 21.5 8 20 9 18.5 L16 15 Z" fill="#FFD76E" opacity="0.7"/>
              <path d="M34 15 L45 10 C47 9 49 11 48 12.5 C47 14 44.5 14 43 13 L34 15 Z" fill="#F5A623"/>
              <path d="M34 15 L44 17 C46 17.5 47 19.5 45.5 20.5 C44 21.5 42 20 41 18.5 L34 15 Z" fill="#FFD76E" opacity="0.7"/>
              <circle cx="25" cy="15" r="11" fill="url(#loginGrad)"/>
              <ellipse cx="21" cy="11" rx="4" ry="3" fill="rgba(255,255,255,0.4)" transform="rotate(-20 21 11)"/>
              <ellipse cx="19.5" cy="10" rx="2" ry="1.3" fill="rgba(255,255,255,0.55)" transform="rotate(-25 19.5 10)"/>
            </svg>
          </div>
          <h1 class="text-h2">Willkommen zurück</h1>
          <p class="text-sm text-muted mt-4">Melde dich in deinem Connect Bounty Account an.</p>
        </div>

        <form id="login-form" class="flex-col gap-4" onsubmit="submitLogin(event)">
          <div class="form-group">
            <label class="form-label">E-Mail</label>
            <input class="form-input" id="l-email" type="email" placeholder="deine@email.de" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Passwort</label>
            <input class="form-input" id="l-password" type="password" placeholder="••••••••" required autocomplete="current-password" />
          </div>

          <div id="login-error" class="form-error hidden"></div>

          <button type="submit" class="btn btn-primary btn-full" id="login-btn">Anmelden</button>
        </form>

        <div class="divider"></div>
        <p class="text-sm text-center text-muted">
          Noch kein Account? 
          <a onclick="navigate('/register')" style="color:var(--c-primary);cursor:pointer;font-weight:600;">Jetzt registrieren</a>
        </p>
      </div>
    </div>
  `;
}

async function submitLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Anmelden...';

  const result = await AuthAPI.login({
    email: document.getElementById('l-email').value,
    password: document.getElementById('l-password').value,
  });

  if (result.error) {
    errEl.textContent = result.error;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Anmelden';
  } else {
    Store.setState({ user: result.user, token: result.token });
    Store.persist();
    Toast.success('Angemeldet!', `Willkommen zurück, ${result.user.username}!`);
    navigate('/marketplace');
  }
}
