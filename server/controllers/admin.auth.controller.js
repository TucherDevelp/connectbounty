const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const { parseBody } = require("../middleware/bodyParser");
const { sendOK, sendCreated, sendError } = require("../middleware/response.helper");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

function signAdminToken(payload) {
  return jwt.sign({ ...payload, role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
}

function getAdminStatus(req, res) {
  const adminCount = db.prepare("SELECT count(*) as count FROM admins").get();
  sendOK(res, { hasAdmin: adminCount.count > 0 });
}

async function registerAdmin(req, res) {
  const adminCount = db.prepare("SELECT count(*) as count FROM admins").get();
  if (adminCount.count > 0) {
    return sendError(res, 403, "Ein Admin existiert bereits. Weitere Registrierungen sind gesperrt.");
  }

  const body = await parseBody(req);
  const { username, email, password } = body;

  if (!username || !email || !password) {
    return sendError(res, 400, "Benutzername, E-Mail und Passwort sind erforderlich");
  }

  if (password.length < 8) {
    return sendError(res, 400, "Passwort muss mindestens 8 Zeichen haben");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuidv4();

  db.prepare(`
    INSERT INTO admins (id, username, email, password_hash)
    VALUES (?, ?, ?, ?)
  `).run(id, username, email, passwordHash);

  const token = signAdminToken({ id, username, email });
  sendCreated(res, { token, admin: { id, username, email } });
}

async function loginAdmin(req, res) {
  const body = await parseBody(req);
  const { email, password } = body;

  if (!email || !password) {
    return sendError(res, 400, "E-Mail und Passwort erforderlich");
  }

  const admin = db.prepare("SELECT * FROM admins WHERE email = ?").get(email);
  if (!admin) {
    return sendError(res, 401, "Ungültige Anmeldedaten");
  }

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    return sendError(res, 401, "Ungültige Anmeldedaten");
  }

  const token = signAdminToken({ id: admin.id, username: admin.username, email: admin.email });
  sendOK(res, {
    token,
    admin: { id: admin.id, username: admin.username, email: admin.email }
  });
}

async function forgotPassword(req, res) {
  const body = await parseBody(req);
  const { email } = body;

  if (!email) {
    return sendError(res, 400, "E-Mail ist erforderlich");
  }

  const admin = db.prepare("SELECT * FROM admins WHERE email = ?").get(email);
  if (!admin) {
    // Return success even if not found to prevent user enumeration
    return sendOK(res, { message: "Falls diese E-Mail existiert, wurde ein Code versendet." });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 15 * 60000).toISOString(); // 15 mins

  db.prepare("UPDATE admins SET reset_code = ?, reset_expires = ? WHERE id = ?").run(code, expires, admin.id);

  // Here you would integrate nodemailer to send an actual email.
  // For now, we simulate the email by logging to the console.
  console.log(`\n=========================================`);
  console.log(`📧 [EMAIL SIMULATION] An: ${email}`);
  console.log(`Betreff: Dein Admin Passwort-Reset Code`);
  console.log(`Code: ${code}`);
  console.log(`=========================================\n`);

  sendOK(res, { message: "Falls diese E-Mail existiert, wurde ein Code versendet." });
}

async function resetPassword(req, res) {
  const body = await parseBody(req);
  const { email, code, newPassword } = body;

  if (!email || !code || !newPassword) {
    return sendError(res, 400, "E-Mail, Code und neues Passwort sind erforderlich");
  }

  if (newPassword.length < 8) {
    return sendError(res, 400, "Passwort muss mindestens 8 Zeichen haben");
  }

  const admin = db.prepare("SELECT * FROM admins WHERE email = ?").get(email);
  if (!admin) {
    return sendError(res, 400, "Ungültiger Code oder E-Mail");
  }

  if (admin.reset_code !== code) {
    return sendError(res, 400, "Ungültiger Code");
  }

  if (new Date() > new Date(admin.reset_expires)) {
    return sendError(res, 400, "Der Code ist abgelaufen");
  }

  // Hash new password and clear reset fields
  const passwordHash = await bcrypt.hash(newPassword, 12);
  db.prepare("UPDATE admins SET password_hash = ?, reset_code = NULL, reset_expires = NULL WHERE id = ?").run(passwordHash, admin.id);

  sendOK(res, { message: "Passwort wurde erfolgreich geändert." });
}

module.exports = {
  getAdminStatus,
  registerAdmin,
  loginAdmin,
  forgotPassword,
  resetPassword
};
