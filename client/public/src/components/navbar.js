// ── Navbar Actions Renderer ───────────────────────
function renderNavActions() {
  const { user } = Store.getState();
  const el = document.getElementById('nav-actions');
  if (!el) return;

  if (user) {
    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="navigate('/create')">+ Inserieren</button>
      <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="navigate('/profile')">
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#F5A623,#C47A10);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem;color:#0A0A0F;">
          ${(user.username || 'U').replace('@','').charAt(0).toUpperCase()}
        </div>
        <span style="font-size:0.875rem;color:var(--c-text-muted);">${user.username}</span>
      </div>
    `;
  } else {
    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="navigate('/login')">Anmelden</button>
      <button class="btn btn-primary btn-sm" onclick="navigate('/register')">Registrieren</button>
    `;
  }
}
