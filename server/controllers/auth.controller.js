const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");
const { signToken } = require("../middleware/auth.middleware");
const { parseBody } = require("../middleware/bodyParser");
const { sendOK, sendCreated, sendError } = require("../middleware/response.helper");
const { decryptData } = require("../utils/crypto.util");

// Zufälligen 6-stelligen Referral-Code generieren
function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Eindeutigkeit sicherstellen
  const existing = db.prepare("SELECT id FROM users WHERE referral_code = ?").get(code);
  return existing ? generateReferralCode() : code;
}

async function register(req, res) {
  const body = await parseBody(req);
  const { username, email, password, referralCode } = body;

  if (!username || !email || !password) {
    return sendError(res, 400, "Benutzername, E-Mail und Passwort sind erforderlich");
  }
  if (password.length < 6) {
    return sendError(res, 400, "Passwort muss mindestens 6 Zeichen haben");
  }

  const existingEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existingEmail) return sendError(res, 409, "E-Mail bereits registriert");

  const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existingUser) return sendError(res, 409, "Benutzername bereits vergeben");

  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuidv4();
  const myReferralCode = generateReferralCode();

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, referral_code)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username, email, passwordHash, myReferralCode);

  // Referral-Bonus vergeben wenn ein Code angegeben wurde
  if (referralCode) {
    const referrer = db.prepare("SELECT id FROM users WHERE referral_code = ?").get(referralCode.toUpperCase());
    if (referrer) {
      const eventId = uuidv4();
      db.prepare(`
        INSERT INTO referral_events (id, referrer_id, referred_user_id, points_awarded)
        VALUES (?, ?, ?, 2)
      `).run(eventId, referrer.id, id);
      db.prepare("UPDATE users SET referral_points = referral_points + 2 WHERE id = ?").run(referrer.id);
    }
  }

  // Wir generieren zwar einen Token für interne Zwecke (falls noetig), aber senden ihn nicht zurück
  // Der User muss erst vom Admin freigeschaltet werden.
  sendCreated(res, { 
    message: "Registrierung erfolgreich. Dein Account wird nun von einem Administrator geprüft.",
    pendingApproval: true 
  });
}

const loginAttempts = new Map();

async function login(req, res) {
  const body = await parseBody(req);
  const { email, password } = body;

  const ip = req.socket.remoteAddress;
  const attempts = loginAttempts.get(ip) || { count: 0, time: Date.now() };

  // 1 Minute Sperre nach 5 Fehlversuchen
  if (attempts.count >= 5 && Date.now() - attempts.time < 60000) {
    return sendError(res, 429, "Zu viele Login-Versuche. Bitte warte eine Minute.");
  }

  if (!email || !password) {
    return sendError(res, 400, "E-Mail und Passwort erforderlich");
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    loginAttempts.set(ip, { count: attempts.count + 1, time: Date.now() });
    return sendError(res, 401, "Ungültige Anmeldedaten");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    loginAttempts.set(ip, { count: attempts.count + 1, time: Date.now() });
    return sendError(res, 401, "Ungültige Anmeldedaten");
  }

  if (user.account_status === 'pending') {
    return sendError(res, 403, "Dein Account wartet noch auf die Freigabe durch einen Administrator.");
  }
  
  if (user.account_status === 'rejected') {
    return sendError(res, 403, "Dein Account wurde abgelehnt.");
  }

  // Reset bei Erfolg
  loginAttempts.delete(ip);

  const token = signToken({ id: user.id, username: user.username, email: user.email });
  sendOK(res, {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      referralCode: user.referral_code,
      referralPoints: user.referral_points,
      accountStatus: user.account_status
    },
  });
}

function getMe(req, res, user) {
  const dbUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  if (!dbUser) return sendError(res, 404, "Benutzer nicht gefunden");

  sendOK(res, {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    realName: decryptData(dbUser.real_name),
    dateOfBirth: decryptData(dbUser.date_of_birth),
    country: dbUser.country,
    city: decryptData(dbUser.city),
    postalCode: decryptData(dbUser.postal_code),
    profileVisibility: dbUser.profile_visibility,
    referralCode: dbUser.referral_code,
    referralPoints: dbUser.referral_points,
    kycVerified: !!dbUser.kyc_verified,
    kycStatus: dbUser.kyc_status,
  });
}

module.exports = { register, login, getMe };
