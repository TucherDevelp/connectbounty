// ── Marketplace Page ──────────────────────────────
const CATEGORIES = [
  { id: null, label: 'Alle' },
  { id: 'sign-on-bonuses', label: 'Sign-On Boni' },
  { id: 'contractor-roles', label: 'Freelancer-Rollen' },
  { id: 'student-programs', label: 'Studentenprogramme' },
  { id: 'sales-incentives', label: 'Sales Incentives' },
];

const CAT_ICONS = {
  'sign-on-bonuses': '🚀',
  'contractor-roles': '💼',
  'student-programs': '🎓',
  'sales-incentives': '📈',
};

function renderListingCard(l) {
  const icon = CAT_ICONS[l.category] || '💰';
  return `
    <div class="listing-card" onclick="navigate('/marketplace/${l.id}')">
      <div class="listing-card-header">
        <div>
          <div style="font-size:1.5rem;margin-bottom:4px;">${icon}</div>
          <div class="listing-card-company">${l.company}</div>
        </div>
        <div class="listing-card-bonus">${l.bonus.toLocaleString('de-DE')} ${l.currency}</div>
      </div>
      <div class="listing-card-title">${l.title}</div>
      ${l.location ? `<div class="listing-card-location">📍 ${l.location}</div>` : ''}
      <div class="listing-card-desc">${l.description || ''}</div>
      <div class="listing-card-footer">
        <span class="badge badge-muted">${CATEGORIES.find(c => c.id === l.category)?.label || l.category}</span>
        <span class="text-xs text-muted">${new Date(l.created_at).toLocaleDateString('de-DE')}</span>
      </div>
    </div>
  `;
}

async function renderMarketplace() {
  // Kategorie aus URL lesen
  const hash = window.location.hash;
  const catParam = hash.includes('?cat=') ? hash.split('?cat=')[1] : null;
  const activeCat = catParam || null;

  const listings = await ListingsAPI.getAll(activeCat);

  return `
    <div class="container section-sm">
      <div class="section-header">
        <h1 class="text-h1 section-title">Marktplatz</h1>
        <p class="section-subtitle">Aktive Bonusprogramme finden und Vermittlungen starten</p>
      </div>

      <!-- Kategorie-Filter -->
      <div class="category-tabs mb-6">
        ${CATEGORIES.map(c => `
          <button
            class="tab-btn ${activeCat === c.id ? 'active' : ''}"
            onclick="filterMarketplace(${c.id ? `'${c.id}'` : 'null'})"
          >${c.label}</button>
        `).join('')}
      </div>

      <!-- Inserieren Button -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:var(--sp-4);">
        <button class="btn btn-primary" onclick="navigate('/create')">+ Inserat erstellen</button>
      </div>

      <!-- Listings Grid -->
      <div class="grid-cards stagger" id="listings-grid">
        ${listings.length === 0
          ? `<div class="empty-state" style="grid-column:1/-1;">
               <div class="empty-state-icon">🔍</div>
               <div class="empty-state-title">Keine Inserate gefunden</div>
               <div class="empty-state-text">In dieser Kategorie gibt es noch keine aktiven Programme.</div>
               <button class="btn btn-primary mt-4" onclick="navigate('/create')">Erstes Inserat erstellen</button>
             </div>`
          : listings.map(renderListingCard).join('')
        }
      </div>
    </div>
  `;
}

function filterMarketplace(category) {
  const hash = category ? `#/marketplace?cat=${category}` : '#/marketplace';
  // Seite neu rendern ohne full-navigation-sound
  window.location.hash = hash;
}
