"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import "./admin.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-project.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key"
);

export default function AdminPortal() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users");
  
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [allListings, setAllListings] = useState([]);

  // Edit Modal State
  const [editModal, setEditModal] = useState({ open: false, listing: null });
  const [editForm, setEditForm] = useState({ title: "", company: "", category: "", bonus: "", status: "" });

  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        fetchData();
      }
    });
  }, []);

  const fetchData = async () => {
    fetchUsers();
    fetchListings();
    fetchAllListings();
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("account_status", "pending");
    setUsers(data || []);
  };

  const fetchListings = async () => {
    const { data } = await supabase.from("listings").select("*, profiles(username)").eq("status", "pending");
    setListings(data || []);
  };

  const fetchAllListings = async () => {
    const { data } = await supabase.from("listings").select("*, profiles(username)").order("created_at", { ascending: false });
    setAllListings(data || []);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    
    // In a real scenario, you'd check if the user is an admin.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.session) {
      setSession(data.session);
      fetchData();
    } else {
      alert(error?.message || "Login fehlgeschlagen");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const approveUser = async (id) => {
    await supabase.from("profiles").update({ account_status: "active" }).eq("id", id);
    fetchUsers();
  };

  const rejectUser = async (id) => {
    await supabase.from("profiles").delete().eq("id", id);
    fetchUsers();
  };

  const approveListing = async (id) => {
    await supabase.from("listings").update({ status: "active" }).eq("id", id);
    fetchListings();
    fetchAllListings();
  };

  const rejectListing = async (id) => {
    await supabase.from("listings").delete().eq("id", id);
    fetchListings();
    fetchAllListings();
  };

  const openEdit = (listing) => {
    setEditForm({
      title: listing.title,
      company: listing.company,
      category: listing.category,
      bonus: listing.bonus,
      status: listing.status
    });
    setEditModal({ open: true, listing });
  };

  const saveEdit = async () => {
    await supabase.from("listings").update(editForm).eq("id", editModal.listing.id);
    setEditModal({ open: false, listing: null });
    fetchAllListings();
    fetchListings();
  };

  const deleteListing = async (id) => {
    if (confirm("Wirklich löschen?")) {
      await supabase.from("listings").delete().eq("id", id);
      fetchAllListings();
    }
  };

  if (loading) return <div id="loading-screen" className="screen"><div className="card" style={{textAlign: 'center', background: 'transparent', border: 'none'}}><h2>Lade...</h2></div></div>;

  if (!session) {
    return (
      <div id="login-screen" className="screen">
        <div className="card">
          <h2>Admin Login</h2>
          <p>Melde dich mit deinem Administrator-Account an.</p>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>E-Mail</label>
              <input type="email" name="email" placeholder="admin@connectbounty.de" required />
            </div>
            <div className="form-group">
              <label>Passwort</label>
              <input type="password" name="password" placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn-primary w-full">Einloggen</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <div id="dashboard-screen" className="screen">
        <header>
          <h1>Connect Bounty | Admin Dashboard</h1>
          <button onClick={handleLogout} className="btn-danger">Logout</button>
        </header>

        <div className="tabs">
          <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Pending Users</button>
          <button className={`tab ${activeTab === 'listings' ? 'active' : ''}`} onClick={() => setActiveTab('listings')}>Pending Listings</button>
          <button className={`tab ${activeTab === 'all-listings' ? 'active' : ''}`} onClick={() => setActiveTab('all-listings')}>Alle Inserate</button>
        </div>

        <main>
          {activeTab === 'users' && (
            <div id="tab-users" className="tab-content">
              <div className="actions-bar">
                <button onClick={fetchUsers}>Refresh</button>
              </div>
              <table>
                <thead>
                  <tr><th>ID</th><th>Username</th><th>Email</th><th>Real Name</th><th>KYC Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.length === 0 ? <tr><td colSpan="6" className="text-center">Keine Daten</td></tr> : users.map(u => (
                    <tr key={u.id}>
                      <td style={{fontSize:'0.8rem'}}>{u.id}</td>
                      <td>{u.username}</td>
                      <td>{u.email}</td>
                      <td>{u.real_name}</td>
                      <td>{u.kyc_status}</td>
                      <td>
                        <button onClick={() => approveUser(u.id)} style={{color:'green', marginRight:'10px'}}>Approve</button>
                        <button onClick={() => rejectUser(u.id)} style={{color:'red'}}>Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'listings' && (
            <div id="tab-listings" className="tab-content">
              <div className="actions-bar">
                <button onClick={fetchListings}>Refresh</button>
              </div>
              <table>
                <thead>
                  <tr><th>ID</th><th>Creator</th><th>Company</th><th>Title</th><th>Bonus</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {listings.length === 0 ? <tr><td colSpan="6" className="text-center">Keine Daten</td></tr> : listings.map(l => (
                    <tr key={l.id}>
                      <td style={{fontSize:'0.8rem'}}>{l.id}</td>
                      <td>{l.profiles?.username || 'Unknown'}</td>
                      <td>{l.company}</td>
                      <td>{l.title}</td>
                      <td>{l.bonus} {l.currency}</td>
                      <td>
                        <button onClick={() => approveListing(l.id)} style={{color:'green', marginRight:'10px'}}>Approve</button>
                        <button onClick={() => rejectListing(l.id)} style={{color:'red'}}>Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'all-listings' && (
            <div id="tab-all-listings" className="tab-content">
              <div className="actions-bar">
                <button onClick={fetchAllListings}>Refresh</button>
              </div>
              <table>
                <thead>
                  <tr><th>ID</th><th>Firma</th><th>Titel</th><th>Bonus</th><th>Status</th><th>Aktionen</th></tr>
                </thead>
                <tbody>
                  {allListings.length === 0 ? <tr><td colSpan="6" className="text-center">Keine Daten</td></tr> : allListings.map(l => (
                    <tr key={l.id}>
                      <td style={{fontSize:'0.8rem'}}>{l.id}</td>
                      <td>{l.company}</td>
                      <td>{l.title}</td>
                      <td>{l.bonus} {l.currency}</td>
                      <td>{l.status}</td>
                      <td>
                        <button onClick={() => openEdit(l)} style={{color:'blue', marginRight:'10px'}}>Bearbeiten</button>
                        <button onClick={() => deleteListing(l.id)} style={{color:'red'}}>Löschen</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {editModal.open && (
        <div id="edit-modal" className="screen" style={{ background: 'rgba(0,0,0,0.8)', zIndex: 1000, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', width: '100%' }}>
            <h2>Inserat bearbeiten</h2>
            
            <div className="form-group">
              <label>Titel</label>
              <input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Firma</label>
              <input type="text" value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Kategorie</label>
              <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px' }}>
                <option value="student-programs">Student Programs</option>
                <option value="sign-on-bonuses">Sign-On Bonuses</option>
                <option value="contractor-roles">Contractor Roles</option>
                <option value="sales-incentives">Sales Incentives</option>
              </select>
            </div>
            <div className="form-group">
              <label>Bonus (EUR)</label>
              <input type="number" value={editForm.bonus} onChange={e => setEditForm({...editForm, bonus: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px' }}>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <button onClick={saveEdit} className="btn-primary w-full">Speichern</button>
            <button onClick={() => setEditModal({open: false, listing: null})} className="btn-danger w-full" style={{ marginTop: '10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}>Abbrechen</button>
          </div>
        </div>
      )}
    </>
  );
}
