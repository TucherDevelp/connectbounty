let API_TOKEN = localStorage.getItem('cb_admin_token') || '';
let BASE_URL = localStorage.getItem('cb_admin_url') || 'http://localhost:8000';

// Initialize
document.addEventListener('DOMContentLoaded', checkStatus);

async function checkStatus() {
  document.getElementById('loading-screen').classList.remove('hidden');
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard-screen').classList.add('hidden');

  try {
    const res = await fetch(`${BASE_URL}/api/admin/auth/status`);
    const data = await res.json();
    
    document.getElementById('loading-screen').classList.add('hidden');

    if (!data.hasAdmin) {
      // First run: No admin exists
      document.getElementById('register-screen').classList.remove('hidden');
    } else {
      // Admin exists: Check if we are already logged in
      if (API_TOKEN) {
        showDashboard();
      } else {
        document.getElementById('login-screen').classList.remove('hidden');
      }
    }
  } catch (err) {
    document.getElementById('loading-screen').innerHTML = `<div class="card"><h2 class="error">Fehler: API nicht erreichbar</h2><p>Bitte stelle sicher, dass das Backend auf ${BASE_URL} läuft.</p></div>`;
  }
}

// ─── Auth ──────────────────────────────────────────────────
async function registerAdmin() {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const url = document.getElementById('reg-api-url').value.trim();
  const err = document.getElementById('reg-error');
  
  if (!username || !email || !password) {
    err.textContent = "Bitte alle Felder ausfüllen.";
    err.classList.remove('hidden');
    return;
  }

  BASE_URL = url.replace(/\/$/, "");
  localStorage.setItem('cb_admin_url', BASE_URL);

  try {
    const res = await fetch(`${BASE_URL}/api/admin/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    API_TOKEN = data.token;
    localStorage.setItem('cb_admin_token', API_TOKEN);
    showDashboard();
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

async function loginAdmin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const url = document.getElementById('login-api-url').value.trim();
  const err = document.getElementById('login-error');
  
  if (!email || !password) {
    err.textContent = "Bitte E-Mail und Passwort eingeben.";
    err.classList.remove('hidden');
    return;
  }

  BASE_URL = url.replace(/\/$/, "");
  localStorage.setItem('cb_admin_url', BASE_URL);

  try {
    const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    API_TOKEN = data.token;
    localStorage.setItem('cb_admin_token', API_TOKEN);
    showDashboard();
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

function logout() {
  API_TOKEN = '';
  localStorage.removeItem('cb_admin_token');
  document.getElementById('dashboard-screen').classList.add('hidden');
  
  // Clean inputs
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  
  checkStatus(); // Re-evaluate state
}

function showLogin() {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('login-screen').classList.remove('hidden');
}

function showForgotPassword() {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('forgot-password-screen').classList.remove('hidden');
  document.getElementById('forgot-error').classList.add('hidden');
  document.getElementById('forgot-success').classList.add('hidden');
}

async function requestPasswordReset() {
  const email = document.getElementById('forgot-email').value.trim();
  const err = document.getElementById('forgot-error');
  const succ = document.getElementById('forgot-success');
  
  if (!email) {
    err.textContent = "Bitte E-Mail eingeben.";
    err.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/admin/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    succ.textContent = data.message;
    succ.classList.remove('hidden');
    err.classList.add('hidden');

    // Switch to reset screen after a short delay
    setTimeout(() => {
      document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
      document.getElementById('reset-password-screen').classList.remove('hidden');
      document.getElementById('reset-error').classList.add('hidden');
    }, 2000);

  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
    succ.classList.add('hidden');
  }
}

async function submitNewPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  const code = document.getElementById('reset-code').value.trim();
  const newPassword = document.getElementById('reset-password').value;
  const err = document.getElementById('reset-error');

  if (!code || !newPassword) {
    err.textContent = "Bitte Code und neues Passwort eingeben.";
    err.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/admin/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword })
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    alert("Passwort erfolgreich geändert! Bitte logge dich nun ein.");
    showLogin();
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

function showDashboard() {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('dashboard-screen').classList.remove('hidden');
  loadPendingUsers();
  loadPendingListings();
  loadAllListings();
}

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  
  document.querySelector(`button[onclick="switchTab('${tabId}')"]`).classList.add('active');
  document.getElementById(`tab-${tabId}`).classList.remove('hidden');
}

// ─── API Wrapper ──────────────────────────────────────────────
async function apiCall(endpoint, method = 'GET') {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });
    
    if (res.status === 401 || res.status === 403) {
      logout();
      alert("Sitzung abgelaufen oder nicht autorisiert.");
      throw new Error("Unauthorized");
    }
    
    return await res.json();
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
}

// ─── Users ──────────────────────────────────────────────────
async function loadPendingUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
  
  const users = await apiCall('/api/admin/users/pending');
  if (!users) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Keine ausstehenden Accounts</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td title="${u.id}">${u.id.substring(0,8)}...</td>
      <td><strong>${u.username}</strong></td>
      <td>${u.email}</td>
      <td>${u.realName}</td>
      <td>${u.kycStatus === 'verified' ? '<span style="color:var(--success)">Verified</span>' : u.kycStatus}</td>
      <td class="actions-cell">
        <button class="btn-sm btn-success" onclick="approveUser('${u.id}')">Zulassen</button>
        <button class="btn-sm btn-danger" onclick="rejectUser('${u.id}')">Ablehnen</button>
      </td>
    </tr>
  `).join('');
}

async function approveUser(id) {
  if (!confirm("Diesen Account wirklich freigeben?")) return;
  const res = await apiCall(`/api/admin/users/${id}/approve`, 'PUT');
  if (res && !res.error) loadPendingUsers();
}

async function rejectUser(id) {
  if (!confirm("Diesen Account wirklich ABLEHNEN (Status auf rejected setzen)?")) return;
  const res = await apiCall(`/api/admin/users/${id}/reject`, 'PUT');
  if (res && !res.error) loadPendingUsers();
}

// ─── Listings ───────────────────────────────────────────────
async function loadPendingListings() {
  const tbody = document.getElementById('listings-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
  
  const listings = await apiCall('/api/admin/listings/pending');
  if (!listings) return;

  if (listings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Keine ausstehenden Inserate</td></tr>';
    return;
  }

  tbody.innerHTML = listings.map(l => `
    <tr>
      <td title="${l.id}">${l.id.substring(0,8)}...</td>
      <td>${l.creator_username}</td>
      <td><strong>${l.company}</strong></td>
      <td>${l.title}</td>
      <td>${l.bonus} ${l.currency}</td>
      <td class="actions-cell">
        <button class="btn-sm btn-success" onclick="approveListing('${l.id}')">Zulassen</button>
        <button class="btn-sm btn-danger" onclick="rejectListing('${l.id}')">Ablehnen</button>
      </td>
    </tr>
  `).join('');
}

async function approveListing(id) {
  if (!confirm("Dieses Inserat wirklich veröffentlichen?")) return;
  const res = await apiCall(`/api/admin/listings/${id}/approve`, 'PUT');
  if (res && !res.error) loadPendingListings();
}

async function rejectListing(id) {
  if (!confirm("Dieses Inserat wirklich LÖSCHEN?")) return;
  const res = await apiCall(`/api/admin/listings/${id}/reject`, 'PUT');
  if (res && !res.error) loadPendingListings();
}

// ─── All Listings Management ────────────────────────────────

// Store all listings temporarily to populate the edit modal easily
let currentAllListings = [];

async function loadAllListings() {
  const tbody = document.getElementById('all-listings-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
  
  const listings = await apiCall('/api/admin/listings/all');
  if (!listings) return;

  currentAllListings = listings;

  if (listings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Keine Inserate vorhanden</td></tr>';
    return;
  }

  tbody.innerHTML = listings.map(l => `
    <tr>
      <td title="${l.id}">${l.id.substring(0,8)}...</td>
      <td><strong>${l.company}</strong></td>
      <td>${l.title}</td>
      <td>${l.bonus} ${l.currency}</td>
      <td>
        <span style="color: ${l.status === 'active' ? 'var(--success)' : (l.status === 'pending' ? 'var(--primary)' : 'var(--danger)')}">
          ${l.status}
        </span>
      </td>
      <td class="actions-cell">
        <button class="btn-sm btn-primary" onclick="editListing('${l.id}')">Bearbeiten</button>
        <button class="btn-sm btn-danger" onclick="deleteListing('${l.id}')">Löschen</button>
      </td>
    </tr>
  `).join('');
}

function editListing(id) {
  const listing = currentAllListings.find(l => l.id === id);
  if (!listing) return;

  document.getElementById('edit-id').value = listing.id;
  document.getElementById('edit-title').value = listing.title;
  document.getElementById('edit-company').value = listing.company;
  document.getElementById('edit-category').value = listing.category;
  document.getElementById('edit-bonus').value = listing.bonus;
  document.getElementById('edit-status').value = listing.status;

  document.getElementById('edit-error').classList.add('hidden');
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

async function saveListing() {
  const id = document.getElementById('edit-id').value;
  const title = document.getElementById('edit-title').value.trim();
  const company = document.getElementById('edit-company').value.trim();
  const category = document.getElementById('edit-category').value;
  const bonus = parseInt(document.getElementById('edit-bonus').value, 10);
  const status = document.getElementById('edit-status').value;
  
  const err = document.getElementById('edit-error');

  if (!title || !company || isNaN(bonus)) {
    err.textContent = "Bitte alle Felder korrekt ausfüllen.";
    err.classList.remove('hidden');
    return;
  }

  const res = await fetch(`${BASE_URL}/api/admin/listings/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`
    },
    body: JSON.stringify({ title, company, category, bonus, status })
  });
  
  const data = await res.json();
  if (res.status !== 200) {
    err.textContent = data.error || "Fehler beim Speichern";
    err.classList.remove('hidden');
    return;
  }

  closeEditModal();
  loadAllListings();
  loadPendingListings(); // Refresh pending tab too, in case status changed
}

async function deleteListing(id) {
  if (!confirm("Soll dieses Inserat wirklich ENTGÜLTIG gelöscht werden?")) return;
  const res = await apiCall(`/api/admin/listings/${id}`, 'DELETE');
  if (res && !res.error) {
    loadAllListings();
    loadPendingListings();
  }
}
