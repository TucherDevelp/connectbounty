// ── Connect Bounty – App Entry Point ─────────────
// Alle Styles aus /styles/ werden in index.html geladen.
// CSS-Symlink: client/public/styles → client/styles
// (wird beim ersten Start via server.js aufgelöst, oder wir kopieren)

(function initApp() {
  // ── Splash-Screen Timing ─────────────────────
  const splash = document.getElementById('splash');

  function hideSplash() {
    splash.classList.add('hiding');
    setTimeout(() => { splash.style.display = 'none'; }, 700);
  }

  // Splash nach 3.2s ausblenden (Animationen inkl. Münz-Reveal fertig nach ~2.5s)
  setTimeout(hideSplash, 3200);

  // ── Router Routen registrieren ────────────────
  Router.register('/', renderHome);
  Router.register('/marketplace', renderMarketplace);
  Router.register('/marketplace/:id', renderListingDetail);
  Router.register('/create', renderCreateListing);
  Router.register('/login', renderLogin);
  Router.register('/register', renderRegister);
  Router.register('/profile', renderProfile);
  Router.register('/referral', renderReferral);
  Router.register('/payment', renderPayment);

  // ── Initial Render ────────────────────────────
  // Navbar-Actions initial rendern
  renderNavActions();

  // Nach Splash aktuelle Route rendern
  setTimeout(() => {
    Router.resolve();
    // Store-Subscription für Navbar-Updates
    Store.subscribe(() => renderNavActions());
  }, 300); // Kurz warten damit DOM bereit ist

})();
