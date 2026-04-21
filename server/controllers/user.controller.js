const db = require("../config/database");
const { parseBody } = require("../middleware/bodyParser");
const { sendOK, sendError } = require("../middleware/response.helper");

function getProfile(req, res, user) {
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
    paymentType: dbUser.payment_type,
    paymentIban: dbUser.payment_iban,
    paymentBic: dbUser.payment_bic,
    paymentPaypal: dbUser.payment_paypal,
    kycVerified: !!dbUser.kyc_verified,
  });
}

async function updateProfile(req, res, user) {
  const body = await parseBody(req);
  const { realName, dateOfBirth, country, city, postalCode, profileVisibility } = body;

  db.prepare(`
    UPDATE users SET
      real_name = COALESCE(?, real_name),
      date_of_birth = COALESCE(?, date_of_birth),
      country = COALESCE(?, country),
      city = COALESCE(?, city),
      postal_code = COALESCE(?, postal_code),
      profile_visibility = COALESCE(?, profile_visibility)
    WHERE id = ?
  `).run(realName ?? null, dateOfBirth ?? null, country ?? null, city ?? null, postalCode ?? null, profileVisibility ?? null, user.id);

  sendOK(res, { message: "Profil aktualisiert" });
}

async function updatePayment(req, res, user) {
  const body = await parseBody(req);
  const { paymentType, iban, bic, paypal } = body;

  db.prepare(`
    UPDATE users SET
      payment_type = COALESCE(?, payment_type),
      payment_iban = COALESCE(?, payment_iban),
      payment_bic = COALESCE(?, payment_bic),
      payment_paypal = COALESCE(?, payment_paypal)
    WHERE id = ?
  `).run(paymentType ?? null, iban ?? null, bic ?? null, paypal ?? null, user.id);

  sendOK(res, { message: "Zahlungsmethode gespeichert" });
}

async function requestPayout(req, res, user) {
  const { v4: uuidv4 } = require("uuid");
  const body = await parseBody(req);
  const { amount } = body;

  if (!amount || amount <= 0) return sendError(res, 400, "Ungültiger Betrag");

  const id = uuidv4();
  db.prepare(`
    INSERT INTO payout_requests (id, user_id, amount, method)
    VALUES (?, ?, ?, (SELECT payment_type FROM users WHERE id = ?))
  `).run(id, user.id, amount, user.id);

  sendOK(res, { message: "Auszahlungsanfrage gestellt", requestId: id });
}

module.exports = { getProfile, updateProfile, updatePayment, requestPayout };
