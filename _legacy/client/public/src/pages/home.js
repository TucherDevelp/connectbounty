// ── Home Page ─────────────────────────────────────
function renderHome() {
  return `
    <section class="hero">
      <div class="container">
        <div class="anim-fade-in-up">
          <div class="badge badge-primary mb-4" style="display:inline-flex;align-items:center;gap:6px;">
            <img src="/assets/bonbon-logo.svg" alt="" width="28" height="17" style="vertical-align:middle;" />
            Jetzt im Beta
          </div>
          <h1 class="text-display hero-title">
            Verdiene <span class="highlight">Referral-Boni</span><br>für Job-Vermittlungen
          </h1>
          <p class="hero-subtitle">
            Connect Bounty verbindet Jobsuchende mit Vermittlern. 
            Inseriere Bonusprogramme, finde Matches und erhalte Provisionen – alles sicher über die Plattform.
          </p>
          <div class="hero-cta">
            <button class="btn btn-primary btn-lg glow-primary" onclick="navigate('/marketplace')">
              Marktplatz entdecken
            </button>
            <button class="btn btn-secondary btn-lg" onclick="navigate('/register')">
              Kostenlos starten
            </button>
          </div>
        </div>

        <div class="hero-stats stagger anim-fade-in-up" style="animation-delay:0.3s;">
          <div class="text-center">
            <div class="hero-stat-value">100%</div>
            <div class="hero-stat-label">Plattform-geschützt</div>
          </div>
          <div class="text-center">
            <div class="hero-stat-value">KI</div>
            <div class="hero-stat-label">Chat-Überwachung</div>
          </div>
          <div class="text-center">
            <div class="hero-stat-value">0€</div>
            <div class="hero-stat-label">Registrierungsgebühr</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Kategorien Preview -->
    <section class="section" style="padding-top:0;">
      <div class="container">
        <div class="section-header text-center">
          <h2 class="text-h2 section-title">Verfügbare Kategorien</h2>
          <p class="section-subtitle">Finde das passende Bonusprogramm für deine Situation</p>
        </div>
        <div class="grid-cards stagger">
          ${[
            { cat: 'sign-on-bonuses', icon: '🚀', title: 'Sign-On Boni', desc: 'Einstellungsboni beim Antritt einer neuen Stelle' },
            { cat: 'contractor-roles', icon: '💼', title: 'Freelancer-Rollen', desc: 'Vermittlungsboni für Contractor-Projekte' },
            { cat: 'student-programs', icon: '🎓', title: 'Studentenprogramme', desc: 'Praktika und Werkstudentenstellen mit Bonus' },
            { cat: 'sales-incentives', icon: '📈', title: 'Sales Incentives', desc: 'Leistungsbasierte Vertriebsboni' },
          ].map(c => `
            <div class="card hover-lift" onclick="navigate('/marketplace?cat=${c.cat}')" style="cursor:pointer;">
              <div style="font-size:2.5rem;margin-bottom:12px;">${c.icon}</div>
              <h3 class="text-h3">${c.title}</h3>
              <p class="text-sm text-muted mt-4">${c.desc}</p>
              <div style="margin-top:16px;color:var(--c-primary);font-size:0.875rem;font-weight:600;">Jetzt ansehen →</div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="section how-it-works" style="background:var(--c-surface);border-top:1px solid var(--c-border);border-bottom:1px solid var(--c-border);">
      <div class="container">
        <div class="section-header text-center">
          <h2 class="text-h2 section-title">So funktioniert's</h2>
        </div>
        <div class="grid-cards stagger" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));">
          ${[
            { n:1, t:'Registrieren', d:'Erstelle deinen Account und erhalte sofort deinen persönlichen Referral-Code.' },
            { n:2, t:'Inserat finden', d:'Durchsuche den Marketplace nach passenden Bonusprogrammen nach Kategorie.' },
            { n:3, t:'Match herstellen', d:'Vermittle Jobsuchende über den plattforminternen, KI-überwachten Chat.' },
            { n:4, t:'Provision erhalten', d:'Nach erfolgreicher Vermittlung wird deine Provision automatisch gutgeschrieben.' },
          ].map(s => `
            <div class="how-step">
              <div class="how-step-num">${s.n}</div>
              <div>
                <div style="font-weight:600;margin-bottom:4px;">${s.t}</div>
                <div class="text-sm text-muted">${s.d}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- CTA Banner -->
    <section class="section">
      <div class="container">
        <div style="background:linear-gradient(135deg,rgba(245,166,35,0.12),rgba(245,166,35,0.04));border:1px solid rgba(245,166,35,0.2);border-radius:var(--r-xl);padding:var(--sp-12);text-align:center;">
          <h2 class="text-h2" style="margin-bottom:12px;">Bereit loszulegen?</h2>
          <p class="text-muted" style="margin-bottom:var(--sp-6);">Registriere dich kostenlos und erhalte deinen Referral-Code.</p>
          <button class="btn btn-primary btn-lg glow-primary" onclick="navigate('/register')">
            Jetzt kostenlos registrieren
          </button>
        </div>
      </div>
    </section>
  `;
}
