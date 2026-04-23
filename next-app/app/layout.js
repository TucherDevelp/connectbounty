import "./globals.css";
import "./animations.css";
import "./components.css";

export const metadata = {
  title: "Connect Bounty – Bonus-Vermittlungsplattform",
  description: "Connect Bounty – Die Plattform für Bonusprogramme und Personalvermittlung. Inseriere Bonusprogramme, finde Vermittler und verdiene Provisionen.",
  themeColor: "#0A0A0F"
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        {/* Splash Screen Component will be injected here via a client component if needed, or simply static for now */}
        <div id="splash" style={{ display: 'none' }}>
          {/* We will implement Splash as a Client Component later if needed, hiding it by default for Next.js to prevent SSR flicker */}
        </div>

        {/* ── Desktop Navbar ────────────────────────── */}
        <nav id="navbar">
          <div className="nav-inner">
            <div className="nav-logo">
              <img className="nav-logo-icon" src="/assets/bonbon-logo.svg" alt="Connect Bounty Bonbon" />
              <div className="nav-logo-text">CONNECT <span>BOUNTY</span></div>
            </div>

            <div className="nav-links" id="nav-links">
              <a className="nav-link" href="/">Startseite</a>
              <a className="nav-link" href="/marketplace">Marketplace</a>
              <a className="nav-link" href="/referral">Referral</a>
            </div>

            <div className="nav-actions" id="nav-actions">
              <a className="btn-secondary" href="/login">Einloggen</a>
              <a className="btn-primary" href="/register">Registrieren</a>
            </div>
          </div>
        </nav>

        {/* ── Mobile Bottom Nav ──────────────────────── */}
        <nav id="bottom-nav">
          <div className="bottom-nav-inner">
            <a href="/" className="bottom-nav-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Start
            </a>
            <a href="/marketplace" className="bottom-nav-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              Marktplatz
            </a>
            <a href="/create" className="bottom-nav-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              Inserieren
            </a>
            <a href="/chat" className="bottom-nav-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat
            </a>
            <a href="/profile" className="bottom-nav-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Profil
            </a>
          </div>
        </nav>

        <div id="app">{children}</div>
        
        <div id="toast-container"></div>
      </body>
    </html>
  );
}
