"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("cb_token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchUser = async () => {
      const res = await fetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        localStorage.removeItem("cb_token");
        router.push("/login");
      } else {
        const data = await res.json();
        setUser(data);
      }
    };

    const fetchListings = async () => {
      const res = await fetch("/api/listings", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
    };

    fetchUser();
    fetchListings();
  }, [router]);

  if (!user) return <div className="screen"><div className="card">Lade...</div></div>;

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Hallo, {user.username}!</h2>
        <button className="btn-danger" onClick={() => {
          localStorage.removeItem("cb_token");
          router.push("/login");
        }}>Logout</button>
      </header>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {listings.map(l => (
          <div key={l.id} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>{l.title}</h3>
            <p className="text-muted" style={{ margin: '0 0 1rem 0' }}>{l.company} &bull; {l.location}</p>
            <p>{l.description}</p>
            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.2rem' }}>
                {l.bonus} {l.currency}
              </span>
              <button className="btn-primary btn-sm">Bewerben</button>
            </div>
          </div>
        ))}
      </div>
      
      {listings.length === 0 && (
        <div className="card text-center text-muted">
          Aktuell keine Inserate verfügbar.
        </div>
      )}
    </div>
  );
}
