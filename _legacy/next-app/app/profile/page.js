"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-project.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key"
);

export default function Profile() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const [formData, setFormData] = useState({
    realName: "",
    dateOfBirth: "",
    country: "Deutschland",
    city: "",
    postalCode: "",
    profileVisibility: "public",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (!error && data) {
      setProfile(data);
      setFormData({
        realName: data.real_name || "",
        dateOfBirth: data.date_of_birth || "",
        country: data.country || "Deutschland",
        city: data.city || "",
        postalCode: data.postal_code || "",
        profileVisibility: data.profile_visibility || "public",
      });
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.id.replace('p-', '')]: e.target.value }));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg({ text: "Speichere...", type: "info" });
    const { error } = await supabase.from("profiles").update({
      real_name: formData.realName,
      date_of_birth: formData.dateOfBirth,
      country: formData.country,
      city: formData.city,
      postal_code: formData.postalCode,
      profile_visibility: formData.profileVisibility
    }).eq("id", session.user.id);

    if (error) {
      setMsg({ text: error.message, type: "error" });
    } else {
      setMsg({ text: "Profil wurde aktualisiert.", type: "success" });
    }
  };

  const logoutUser = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) return <div className="container section">Lade...</div>;

  if (!session || !profile) {
    return (
      <div className="container section">
        <div className="empty-state">
          <div className="empty-state-icon">🔐</div>
          <div className="empty-state-title">Bitte einloggen</div>
          <button className="btn btn-primary mt-4" onClick={() => router.push('/login')}>Jetzt anmelden</button>
        </div>
      </div>
    );
  }

  const initial = (profile.username || 'U').charAt(0).toUpperCase();

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-8)', paddingBottom: 'var(--sp-16)', maxWidth: '640px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-6)' }}>
        <h1 className="text-h2">Mein Profil</h1>
        <button className="btn btn-ghost btn-sm" onClick={logoutUser} style={{ color: 'var(--c-error)' }}>Abmelden</button>
      </div>

      <div className="card mb-4" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
        <div className="profile-avatar">{initial}</div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{profile.username}</div>
          <div className="text-sm text-muted">{session.user.email}</div>
          <div className="badge badge-primary" style={{ marginTop: '6px' }}>{profile.referral_points} Punkte</div>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="text-h3" style={{ marginBottom: 'var(--sp-4)' }}>Persoenliche Daten</h3>
        <form className="flex-col gap-4" onSubmit={saveProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <div className="form-group">
              <label className="form-label">Vollstaendiger Name</label>
              <input className="form-input" id="p-realName" type="text" value={formData.realName} onChange={handleChange} placeholder="Max Mustermann" />
            </div>
            <div className="form-group">
              <label className="form-label">Geburtsdatum</label>
              <input className="form-input" id="p-dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <div className="form-group">
              <label className="form-label">Stadt</label>
              <input className="form-input" id="p-city" type="text" value={formData.city} onChange={handleChange} placeholder="Berlin" />
            </div>
            <div className="form-group">
              <label className="form-label">PLZ</label>
              <input className="form-input" id="p-postalCode" type="text" value={formData.postalCode} onChange={handleChange} placeholder="10115" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Land</label>
            <select className="form-select" id="p-country" value={formData.country} onChange={handleChange}>
              {['Deutschland','Oesterreich','Schweiz','USA','Vereinigtes Koenigreich','Andere'].map(c =>
                <option key={c} value={c}>{c}</option>
              )}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Profil-Sichtbarkeit</label>
            <select className="form-select" id="p-profileVisibility" value={formData.profileVisibility} onChange={handleChange}>
              <option value="public">Oeffentlich</option>
              <option value="private">Privat</option>
            </select>
          </div>
          
          {msg.text && (
            <div className={`form-error`} style={{ display: 'block', color: msg.type === 'error' ? 'var(--c-error)' : 'var(--c-primary)' }}>
              {msg.text}
            </div>
          )}

          <button type="submit" className="btn btn-primary">Speichern</button>
        </form>
      </div>

      <div className="card mb-4">
        <h3 className="text-h3" style={{ marginBottom: 'var(--sp-4)' }}>🛡️ KYC-Verifizierung</h3>
        <p className="text-sm text-muted mb-4">Lade ein Foto deines Ausweises hoch. Unser System gleicht deinen angegebenen Namen und Geburtsdatum automatisch ab. Bilder werden nach der Prüfung <b>sofort gelöscht</b>.</p>
        
        {profile.kyc_verified
          ? <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--r-md)' }}>
              <span style={{ fontSize: '1.5rem' }}>✅</span>
              <div>
                <div style={{ fontWeight: '700', color: '#22C55E' }}>Verifiziert</div>
                <div className="text-sm text-muted">Du kannst Inserenten kontaktieren.</div>
              </div>
            </div>
          : <div style={{ padding: '12px', background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)', marginBottom: '12px' }}>
              {profile.kyc_status === 'rejected' && <div style={{ color: 'var(--c-error)', marginBottom: '8px', fontWeight: '600', fontSize: '0.85rem' }}>Letzter Versuch fehlgeschlagen. Daten stimmten nicht überein.</div>}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: '700' }}>Nicht verifiziert</div>
                  <div className="text-sm text-muted">Diese Funktion benötigt ein Backend mit Gemini API.</div>
                </div>
              </div>
            </div>
        }
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <button className="btn btn-secondary" onClick={() => router.push('/chat')}>Meine Chats</button>
        <button className="btn btn-secondary" onClick={() => router.push('/referral')}>Mein Referral-Code</button>
        <button className="btn btn-secondary" onClick={() => router.push('/payment')}>Zahlungsmethode &amp; Auszahlung</button>
      </div>
    </div>
  );
}
