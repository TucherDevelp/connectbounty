"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-project.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key"
);

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    const refMatch = hash.match(/[?&]ref=([A-Z0-9]+)/i);
    if (refMatch) setReferralCode(refMatch[1].toUpperCase());
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Sign Up with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            referred_by: referralCode || null,
          }
        }
      });

      if (signUpError) throw signUpError;

      setSuccess(true);
      setTimeout(() => router.push("/login"), 5000);
    } catch (err) {
      setError(err.message || "Registrierung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (googleError) throw googleError;
    } catch (err) {
      setError(err.message || "Google-Registrierung fehlgeschlagen");
    }
  };

  if (success) {
    return (
      <div className="flex-center" style={{ minHeight: 'calc(100dvh - var(--nav-h))', padding: 'var(--sp-8) var(--sp-4)' }}>
        <div className="card anim-scale-in" style={{ width: '100%', maxWidth: '440px' }}>
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
            <h3 className="text-h3" style={{ marginBottom: '8px' }}>Registrierung erfolgreich!</h3>
            <p className="text-muted" style={{ lineHeight: '1.6', marginBottom: '24px' }}>
              Dein Account wurde erstellt, muss aber noch von einem Administrator freigegeben werden. Bitte überprüfe deine E-Mails (Supabase Bestätigung) und probiere später den Login.
            </p>
            <button className="btn btn-secondary" onClick={() => router.push('/login')}>Zum Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-center" style={{ minHeight: 'calc(100dvh - var(--nav-h))', padding: 'var(--sp-8) var(--sp-4)' }}>
      <div className="card anim-scale-in" style={{ width: '100%', maxWidth: '440px' }}>
        <div className="text-center mb-6">
          <div style={{ width: '80px', height: '48px', margin: '0 auto 12px' }}>
            <img src="/assets/bonbon-logo.svg" alt="Connect Bounty" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h1 className="text-h2">Konto erstellen</h1>
          <p className="text-sm text-muted mt-4">Registriere dich kostenlos und starte mit Connect Bounty.</p>
        </div>

        <form id="reg-form" className="flex-col gap-4" onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Benutzername</label>
            <input 
              className="form-input" 
              id="r-username" 
              type="text" 
              placeholder="@dein_name" 
              required 
              autoComplete="username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">E-Mail</label>
            <input 
              className="form-input" 
              id="r-email" 
              type="email" 
              placeholder="deine@email.de" 
              required 
              autoComplete="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Passwort (min. 6 Zeichen)</label>
            <input 
              className="form-input" 
              id="r-password" 
              type="password" 
              placeholder="••••••••" 
              required 
              autoComplete="new-password" 
              minLength="6" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Referral-Code (optional)</label>
            <input 
              className="form-input" 
              id="r-referral" 
              type="text" 
              placeholder="z.B. A4BC2G" 
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }} 
              maxLength="6" 
            />
            <span className="text-xs text-muted">Hast du einen Code? Dein Werber erhält 2 Punkte.</span>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" id="reg-btn" disabled={loading}>
            {loading ? "Wird registriert..." : "Jetzt registrieren"}
          </button>
        </form>

        <div className="divider"></div>

        <button 
          onClick={handleGoogleLogin} 
          className="btn btn-secondary btn-full" 
          style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          type="button"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Mit Google registrieren
        </button>

        <p className="text-sm text-center text-muted">
          Bereits registriert? 
          <a onClick={() => router.push('/login')} style={{ color: 'var(--c-primary)', cursor: 'pointer', fontWeight: '600', marginLeft: '5px' }}>
            Anmelden
          </a>
        </p>
      </div>
    </div>
  );
}
