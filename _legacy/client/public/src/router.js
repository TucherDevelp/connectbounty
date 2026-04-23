// ── Hash Router ───────────────────────────────────
const Router = (() => {
  const routes = {};
  let currentRoute = null;

  function register(path, handler) {
    routes[path] = handler;
  }

  function navigate(path) {
    window.location.hash = '#' + path;
  }

  function resolve() {
    const hash = window.location.hash.slice(1) || '/';
    // Exakter Match
    if (routes[hash]) {
      _render(hash, routes[hash]);
      return;
    }
    // Dynamische Routen: /marketplace/:id
    for (const pattern of Object.keys(routes)) {
      if (pattern.includes(':')) {
        const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$');
        const match = hash.match(regex);
        if (match) {
          const paramNames = [...pattern.matchAll(/:([^/]+)/g)].map(m => m[1]);
          const params = {};
          paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
          _render(hash, () => routes[pattern](params));
          return;
        }
      }
    }
    // Fallback 404
    _render(hash, () => `<div class="container section"><div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Seite nicht gefunden</div><button class="btn btn-primary mt-4" onclick="navigate('/')">Zurück zur Startseite</button></div></div>`);
  }

  function _render(route, handler) {
    currentRoute = route;
    const app = document.getElementById('app');
    const content = handler();
    if (content instanceof Promise) {
      content.then(html => {
        app.innerHTML = html;
        app.classList.add('anim-page-enter');
        setTimeout(() => app.classList.remove('anim-page-enter'), 400);
        _updateNav(route);
        _postRender();
      });
    } else {
      app.innerHTML = content;
      app.classList.add('anim-page-enter');
      setTimeout(() => app.classList.remove('anim-page-enter'), 400);
      _updateNav(route);
      _postRender();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function _updateNav(route) {
    // Desktop Nav
    document.querySelectorAll('.nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });
    // Mobile Bottom Nav
    document.querySelectorAll('.bottom-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });
    // Navbar Actions rendern
    if (window.renderNavActions) renderNavActions();
  }

  function _postRender() {
    // Alle onclick="navigate(...)" Elemente neu binden
    document.querySelectorAll('[data-navigate]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.navigate));
    });
  }

  function getCurrentRoute() { return currentRoute; }

  window.addEventListener('hashchange', resolve);

  return { register, navigate, resolve, getCurrentRoute };
})();

// Globale navigate() Funktion für onclick-Handler in HTML
function navigate(path) {
  Router.navigate(path);
}
