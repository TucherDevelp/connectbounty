"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const categories = [
    { cat: 'sign-on-bonuses', icon: '🚀', title: 'Sign-On Boni', desc: 'Einstellungsboni beim Antritt einer neuen Stelle' },
    { cat: 'contractor-roles', icon: '💼', title: 'Freelancer-Rollen', desc: 'Vermittlungsboni für Contractor-Projekte' },
    { cat: 'student-programs', icon: '🎓', title: 'Studentenprogramme', desc: 'Praktika und Werkstudentenstellen mit Bonus' },
    { cat: 'sales-incentives', icon: '📈', title: 'Sales Incentives', desc: 'Leistungsbasierte Vertriebsboni' },
  ];

  const steps = [
    { n:1, t:'Registrieren', d:'Erstelle deinen Account und erhalte sofort deinen persönlichen Referral-Code.' },
    { n:2, t:'Inserat finden', d:'Durchsuche den Marketplace nach passenden Bonusprogrammen nach Kategorie.' },
    { n:3, t:'Match herstellen', d:'Vermittle Jobsuchende über den plattforminternen, KI-überwachten Chat.' },
    { n:4, t:'Provision erhalten', d:'Nach erfolgreicher Vermittlung wird deine Provision automatisch gutgeschrieben.' },
  ];

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="anim-fade-in-up">
            <div className="badge badge-primary mb-4" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <img src="/assets/bonbon-logo.svg" alt="" width="28" height="17" style={{ verticalAlign: 'middle' }} />
              Jetzt im Beta
            </div>
            <h1 className="text-display hero-title">
              Verdiene <span className="highlight">Referral-Boni</span><br/>für Job-Vermittlungen
            </h1>
            <p className="hero-subtitle">
              Connect Bounty verbindet Jobsuchende mit Vermittlern. 
              Inseriere Bonusprogramme, finde Matches und erhalte Provisionen – alles sicher über die Plattform.
            </p>
            <div className="hero-cta">
              <button className="btn btn-primary btn-lg glow-primary" onClick={() => router.push('/marketplace')}>
                Marktplatz entdecken
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => router.push('/register')}>
                Kostenlos starten
              </button>
            </div>
          </div>

          <div className="hero-stats stagger anim-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="text-center">
              <div className="hero-stat-value">100%</div>
              <div className="hero-stat-label">Plattform-geschützt</div>
            </div>
            <div className="text-center">
              <div className="hero-stat-value">KI</div>
              <div className="hero-stat-label">Chat-Überwachung</div>
            </div>
            <div className="text-center">
              <div className="hero-stat-value">0€</div>
              <div className="hero-stat-label">Registrierungsgebühr</div>
            </div>
          </div>
        </div>
      </section>

      {/* Kategorien Preview */}
      <section className="section" style={{ paddingTop: '0' }}>
        <div className="container">
          <div className="section-header text-center">
            <h2 className="text-h2 section-title">Verfügbare Kategorien</h2>
            <p className="section-subtitle">Finde das passende Bonusprogramm für deine Situation</p>
          </div>
          <div className="grid-cards stagger">
            {categories.map(c => (
              <div key={c.cat} className="card hover-lift" onClick={() => router.push(`/marketplace?cat=${c.cat}`)} style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{c.icon}</div>
                <h3 className="text-h3">{c.title}</h3>
                <p className="text-sm text-muted mt-4">{c.desc}</p>
                <div style={{ marginTop: '16px', color: 'var(--c-primary)', fontSize: '0.875rem', fontWeight: '600' }}>
                  Jetzt ansehen →
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section how-it-works" style={{ background: 'var(--c-surface)', borderTop: '1px solid var(--c-border)', borderBottom: '1px solid var(--c-border)' }}>
        <div className="container">
          <div className="section-header text-center">
            <h2 className="text-h2 section-title">So funktioniert's</h2>
          </div>
          <div className="grid-cards stagger" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
            {steps.map(s => (
              <div key={s.n} className="how-step">
                <div className="how-step-num">{s.n}</div>
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>{s.t}</div>
                  <div className="text-sm text-muted">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="section">
        <div className="container">
          <div style={{ background: 'linear-gradient(135deg,rgba(245,166,35,0.12),rgba(245,166,35,0.04))', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-12)', textAlign: 'center' }}>
            <h2 className="text-h2" style={{ marginBottom: '12px' }}>Bereit loszulegen?</h2>
            <p className="text-muted" style={{ marginBottom: 'var(--sp-6)' }}>Registriere dich kostenlos und erhalte deinen Referral-Code.</p>
            <button className="btn btn-primary btn-lg glow-primary" onClick={() => router.push('/register')}>
              Jetzt kostenlos registrieren
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
