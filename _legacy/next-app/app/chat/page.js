"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-project.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key"
);

export default function ChatList() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchConversations(session.user.id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchConversations = async (userId) => {
    // Basic fetch for conversations where user is applicant or owner
    const { data, error } = await supabase
      .from("conversations")
      .select("*, listings(*)")
      .or(`applicant_id.eq.${userId},owner_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setConversations(data);
    }
    setLoading(false);
  };

  if (loading) return <div className="container section">Lade...</div>;

  if (!session) {
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

  if (conversations.length === 0) {
    return (
      <div className="container section">
        <h1 className="text-h2 mb-6">💬 Meine Chats</h1>
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <div className="empty-state-title">Noch keine Konversationen</div>
          <p className="text-sm text-muted mt-2">Starte eine Anfrage über ein Inserat im Marktplatz.</p>
          <button className="btn btn-primary mt-4" onClick={() => router.push('/marketplace')}>Zum Marktplatz</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-8)', paddingBottom: 'var(--sp-16)', maxWidth: '680px' }}>
      <h1 className="text-h2 mb-6">💬 Meine Chats</h1>
      <div className="flex-col gap-4">
        {conversations.map(c => {
          const isOwner = c.owner_id === session.user.id;
          const roleLabel = isOwner
            ? <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Mein Inserat</span>
            : <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>Bewerber</span>;

          const timeStr = new Date(c.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

          return (
            <div key={c.id} className="card chat-conv-card" onClick={() => router.push(`/chat/${c.id}`)} style={{ cursor: 'pointer', transition: 'transform 0.15s ease,box-shadow 0.15s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '700', fontSize: '1rem' }}>{c.listings?.company || 'Unternehmen'}</span>
                    {roleLabel}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--c-text)', marginBottom: '4px' }}>{c.listings?.title}</div>
                  <div className="text-sm text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Klicke um Chat zu öffnen</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: '800', color: 'var(--c-primary)', fontSize: '0.95rem' }}>{c.listings?.bonus?.toLocaleString('de-DE')} {c.listings?.currency || 'EUR'}</div>
                  <div className="text-xs text-muted" style={{ marginTop: '4px' }}>{timeStr}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
