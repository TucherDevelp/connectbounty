const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");
const { signToken } = require("../middleware/auth.middleware");
const { parseBody } = require("../middleware/bodyParser");
const { sendOK, sendCreated, sendError } = require("../middleware/response.helper");

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

  const token = signToken({ id, username, email });
  sendCreated(res, { token, user: { id, username, email, referralCode: myReferralCode } });
}

async function login(req, res) {
  const body = await parseBody(req);
  const { email, password } = body;

  if (!email || !password) {
    return sendError(res, 400, "E-Mail und Passwort erforderlich");
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) return sendError(res, 401, "Ungültige Anmeldedaten");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return sendError(res, 401, "Ungültige Anmeldedaten");

  const token = signToken({ id: user.id, username: user.username, email: user.email });
  sendOK(res, {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      referralCode: user.referral_code,
      referralPoints: user.referral_points,
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
    realName: dbUser.real_name,
    dateOfBirth: dbUser.date_of_birth,
    country: dbUser.country,
    city: dbUser.city,
    postalCode: dbUser.postal_code,
    profileVisibility: dbUser.profile_visibility,
    referralCode: dbUser.referral_code,
    referralPoints: dbUser.referral_points,
    kycVerified: !!dbUser.kyc_verified,
  });
}

module.exports = { register, login, getMe };
