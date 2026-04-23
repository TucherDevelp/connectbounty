"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-project.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key"
);

export default function CreateListing() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    category: "",
    company: "",
    title: "",
    location: "",
    bonus: "",
    description: "",
    isAnonymous: true,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;
    const key = id.replace('f-', '');
    setFormData(prev => ({
      ...prev,
      [key]: type === 'checkbox' ? checked : value
    }));
  };

  const submitListing = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!session?.user) throw new Error("Nicht eingeloggt");

      const { error: insertError } = await supabase.from("listings").insert({
        category: formData.category,
        company: formData.company,
        title: formData.title,
        location: formData.location,
        bonus: parseInt(formData.bonus),
        description: formData.description,
        is_anonymous: formData.isAnonymous,
        created_by: session.user.id,
        status: 'pending'
      });

      if (insertError) throw insertError;
      
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Fehler beim Erstellen des Inserats");
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="container section">
        <div className="empty-state">
          <div className="empty-state-icon">🔐</div>
          <div className="empty-state-title">Anmeldung erforderlich</div>
          <div className="empty-state-text">Um ein Inserat zu erstellen, musst du eingeloggt sein.</div>
          <button className="btn btn-primary mt-4" onClick={() => router.push('/login')}>Jetzt anmelden</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-8)', paddingBottom: 'var(--sp-16)', maxWidth: '640px' }}>
        <div className="card">
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
            <h3 className="text-h3" style={{ marginBottom: '8px' }}>Inserat eingereicht!</h3>
            <p className="text-muted" style={{ lineHeight: '1.6', marginBottom: '24px' }}>Dein Inserat wurde erfolgreich erstellt und zur Prüfung an einen Administrator gesendet. Es wird veröffentlicht, sobald es genehmigt wurde.</p>
            <button className="btn btn-secondary" onClick={() => router.push('/marketplace')}>Zurück zum Marktplatz</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-8)', paddingBottom: 'var(--sp-16)', maxWidth: '640px' }}>
      <button className="btn btn-ghost btn-sm mb-6" onClick={() => router.push('/marketplace')} style={{ paddingLeft: '0' }}>
        ← Zurück zum Marktplatz
      </button>

      <div className="card">
        <h1 className="text-h2" style={{ marginBottom: '4px' }}>Inserat erstellen</h1>
        <p className="text-sm text-muted" style={{ marginBottom: 'var(--sp-6)' }}>Dein Bonusprogramm anonym auf dem Marktplatz inserieren.</p>

        <form id="create-form" className="flex-col gap-4" onSubmit={submitListing}>
          <div className="form-group">
            <label className="form-label">Kategorie *</label>
            <select className="form-select" id="f-category" required value={formData.category} onChange={handleChange}>
              <option value="">Kategorie wählen...</option>
              <option value="sign-on-bonuses">🚀 Sign-On Boni</option>
              <option value="contractor-roles">💼 Freelancer-Rollen</option>
              <option value="student-programs">🎓 Studentenprogramme</option>
              <option value="sales-incentives">📈 Sales Incentives</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Unternehmen *</label>
            <input className="form-input" id="f-company" type="text" placeholder="z.B. SAP, BMW, PwC" required value={formData.company} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Position / Titel *</label>
            <input className="form-input" id="f-title" type="text" placeholder="z.B. Software Engineer, Tax Assistant" required value={formData.title} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Standort</label>
            <input className="form-input" id="f-location" type="text" placeholder="z.B. München, Berlin, Remote" value={formData.location} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Bonusbetrag (€) *</label>
            <input className="form-input" id="f-bonus" type="number" min="1" placeholder="z.B. 3000" required value={formData.bonus} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Beschreibung</label>
            <textarea className="form-input" id="f-description" placeholder="Details zum Bonus-Programm, Anforderungen, etc." rows="4" value={formData.description} onChange={handleChange}></textarea>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0' }}>
            <input type="checkbox" id="f-isAnonymous" checked={formData.isAnonymous} onChange={handleChange} style={{ width: '18px', height: '18px', accentColor: 'var(--c-primary)' }} />
            <label htmlFor="f-isAnonymous" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>Anonym inserieren (empfohlen)</label>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full btn-lg" id="create-btn" disabled={loading}>
            {loading ? "Wird erstellt..." : "Inserat veröffentlichen"}
          </button>
        </form>
      </div>
    </div>
  );
}
