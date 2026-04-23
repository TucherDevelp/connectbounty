"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-project.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key"
);

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

export default function Marketplace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCat = searchParams.get("cat");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      let query = supabase.from("listings").select("*").eq("status", "active").order("created_at", { ascending: false });
      
      if (activeCat) {
        query = query.eq("category", activeCat);
      }

      const { data, error } = await query;
      if (!error && data) {
        setListings(data);
      }
      setLoading(false);
    };

    fetchListings();
  }, [activeCat]);

  return (
    <div className="container section-sm">
      <div className="section-header">
        <h1 className="text-h1 section-title">Marktplatz</h1>
        <p className="section-subtitle">Aktive Bonusprogramme finden und Vermittlungen starten</p>
      </div>

      {/* Kategorie-Filter */}
      <div className="category-tabs mb-6">
        {CATEGORIES.map(c => (
          <button
            key={c.id || "all"}
            className={`tab-btn ${activeCat === c.id || (!activeCat && !c.id) ? 'active' : ''}`}
            onClick={() => router.push(c.id ? `/marketplace?cat=${c.id}` : `/marketplace`)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Inserieren Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--sp-4)' }}>
        <button className="btn btn-primary" onClick={() => router.push('/create')}>+ Inserat erstellen</button>
      </div>

      {/* Listings Grid */}
      <div className="grid-cards stagger" id="listings-grid">
        {loading ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>Lade Inserate...</div>
        ) : listings.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-title">Keine Inserate gefunden</div>
            <div className="empty-state-text">In dieser Kategorie gibt es noch keine aktiven Programme.</div>
            <button className="btn btn-primary mt-4" onClick={() => router.push('/create')}>Erstes Inserat erstellen</button>
          </div>
        ) : (
          listings.map(l => (
            <div key={l.id} className="listing-card" onClick={() => router.push(`/marketplace/${l.id}`)}>
              <div className="listing-card-header">
                <div>
                  <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{CAT_ICONS[l.category] || '💰'}</div>
                  <div className="listing-card-company">{l.company}</div>
                </div>
                <div className="listing-card-bonus">{Number(l.bonus).toLocaleString('de-DE')} {l.currency}</div>
              </div>
              <div className="listing-card-title">{l.title}</div>
              {l.location && <div className="listing-card-location">📍 {l.location}</div>}
              <div className="listing-card-desc">{l.description}</div>
              <div className="listing-card-footer">
                <span className="badge badge-muted">{CATEGORIES.find(c => c.id === l.category)?.label || l.category}</span>
                <span className="text-xs text-muted">{new Date(l.created_at).toLocaleDateString('de-DE')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
