const db = require("../config/database");
const { sendOK, sendError } = require("../middleware/response.helper");
const { decryptData } = require("../utils/crypto.util");

function getPendingUsers(req, res) {
  const users = db.prepare("SELECT * FROM users WHERE account_status = 'pending' ORDER BY created_at DESC").all();
  
  // Entschlüsseln der notwendigen Felder für den Admin
  const decryptedUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    realName: decryptData(u.real_name) || "Nicht angegeben",
    dateOfBirth: decryptData(u.date_of_birth) || "Nicht angegeben",
    createdAt: u.created_at,
    kycStatus: u.kyc_status
  }));

  sendOK(res, decryptedUsers);
}

function approveUser(req, res, id) {
  const result = db.prepare("UPDATE users SET account_status = 'active' WHERE id = ?").run(id);
  if (result.changes === 0) return sendError(res, 404, "Benutzer nicht gefunden");
  sendOK(res, { message: "Account freigegeben" });
}

function rejectUser(req, res, id) {
  const result = db.prepare("UPDATE users SET account_status = 'rejected' WHERE id = ?").run(id);
  if (result.changes === 0) return sendError(res, 404, "Benutzer nicht gefunden");
  sendOK(res, { message: "Account abgelehnt" });
}

function getPendingListings(req, res) {
  const listings = db.prepare(`
    SELECT l.*, u.username as creator_username 
    FROM listings l 
    JOIN users u ON l.created_by = u.id 
    WHERE l.status = 'pending' 
    ORDER BY l.created_at DESC
  `).all();
  
  sendOK(res, listings);
}

function approveListing(req, res, id) {
  const result = db.prepare("UPDATE listings SET status = 'active' WHERE id = ?").run(id);
  if (result.changes === 0) return sendError(res, 404, "Inserat nicht gefunden");
  sendOK(res, { message: "Inserat freigegeben" });
}

function rejectListing(req, res, id) {
  const result = db.prepare("DELETE FROM listings WHERE id = ?").run(id);
  if (result.changes === 0) return sendError(res, 404, "Inserat nicht gefunden");
  sendOK(res, { message: "Inserat gelöscht (abgelehnt)" });
}

module.exports = {
  getPendingUsers,
  approveUser,
  rejectUser,
  getPendingListings,
  approveListing,
  rejectListing
};
