// ── Login Page ────────────────────────────────────
function renderLogin() {
  return `
    <div class="flex-center" style="min-height:calc(100dvh - var(--nav-h));padding:var(--sp-8) var(--sp-4);">
      <div class="card anim-scale-in" style="width:100%;max-width:420px;">
        <div class="text-center mb-6">
          <div style="width:80px;height:48px;margin:0 auto 12px;">
            <img src="/assets/bonbon-logo.svg" alt="Connect Bounty" style="width:100%;height:100%;object-fit:contain;" />
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
