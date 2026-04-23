const db = require("../config/database");
const { parseBody } = require("../middleware/bodyParser");
const { sendOK, sendError } = require("../middleware/response.helper");
const { encryptData, decryptData } = require("../utils/crypto.util");

function getProfile(req, res, user) {
  const dbUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  if (!dbUser) return sendError(res, 404, "Benutzer nicht gefunden");

  sendOK(res, {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    realName: decryptData(dbUser.real_name),
    dateOfBirth: decryptData(dbUser.date_of_birth),
    country: dbUser.country, // not highly sensitive
    city: decryptData(dbUser.city),
    postalCode: decryptData(dbUser.postal_code),
    profileVisibility: dbUser.profile_visibility,
    referralCode: dbUser.referral_code,
    referralPoints: dbUser.referral_points,
    paymentType: dbUser.payment_type,
    paymentIban: decryptData(dbUser.payment_iban),
    paymentBic: decryptData(dbUser.payment_bic),
    paymentPaypal: decryptData(dbUser.payment_paypal),
    kycVerified: !!dbUser.kyc_verified,
    kycStatus: dbUser.kyc_status,
  });
}

async function updateProfile(req, res, user) {
  const body = await parseBody(req);
  const { realName, dateOfBirth, country, city, postalCode, profileVisibility } = body;

  const encRealName = realName !== undefined ? encryptData(realName) : undefined;
  const encDob = dateOfBirth !== undefined ? encryptData(dateOfBirth) : undefined;
  const encCity = city !== undefined ? encryptData(city) : undefined;
  const encPostal = postalCode !== undefined ? encryptData(postalCode) : undefined;

  db.prepare(`
    UPDATE users SET
      real_name = COALESCE(?, real_name),
      date_of_birth = COALESCE(?, date_of_birth),
      country = COALESCE(?, country),
      city = COALESCE(?, city),
      postal_code = COALESCE(?, postal_code),
      profile_visibility = COALESCE(?, profile_visibility)
    WHERE id = ?
  `).run(encRealName ?? null, encDob ?? null, country ?? null, encCity ?? null, encPostal ?? null, profileVisibility ?? null, user.id);

  sendOK(res, { message: "Profil aktualisiert" });
}

async function updatePayment(req, res, user) {
  const body = await parseBody(req);
  const { paymentType, iban, bic, paypal } = body;

  const encIban = iban !== undefined ? encryptData(iban) : undefined;
  const encBic = bic !== undefined ? encryptData(bic) : undefined;
  const encPaypal = paypal !== undefined ? encryptData(paypal) : undefined;

  db.prepare(`
    UPDATE users SET
      payment_type = COALESCE(?, payment_type),
      payment_iban = COALESCE(?, payment_iban),
      payment_bic = COALESCE(?, payment_bic),
      payment_paypal = COALESCE(?, payment_paypal)
    WHERE id = ?
  `).run(paymentType ?? null, encIban ?? null, encBic ?? null, encPaypal ?? null, user.id);

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

const { parseMultipartImage } = require("../middleware/upload.middleware");
const { GEMINI_API_KEY } = require("../config/env.config");

async function uploadKyc(req, res, user) {
  try {
    const { buffer, mimeType } = await parseMultipartImage(req);
    
    // Fetch user profile data to match against
    const dbUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    if (!dbUser) return sendError(res, 404, "Benutzer nicht gefunden");
    
    const realName = decryptData(dbUser.real_name);
    const dob = decryptData(dbUser.date_of_birth);

    if (!realName || !dob) {
      return sendError(res, 400, "Bitte trage zuerst deinen echten Namen und dein Geburtsdatum im Profil ein.");
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
      // Mockup-Fallback wenn kein API Key da ist
      db.prepare("UPDATE users SET kyc_verified = 1, kyc_status = 'verified' WHERE id = ?").run(user.id);
      return sendOK(res, { message: "KYC-Verifizierung (Mock) erfolgreich", kycVerified: true });
    }

    // Google Generative AI initialisieren
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    // Bild an Gemini schicken
    const prompt = `Analysiere dieses Ausweisdokument (Personalausweis, Pass oder Führerschein).
Extrahiere NUR den vollen Namen und das Geburtsdatum.
Prüfe ob der extrahierte Name (auch bei leichten Abweichungen wie zweiter Vorname) zu "${realName}" passt.
Prüfe ob das extrahierte Geburtsdatum zu "${dob}" passt.

Antworte EXAKT im folgenden JSON Format, nichts anderes:
{"nameMatch": true/false, "dobMatch": true/false, "extractedName": "...", "extractedDob": "..."}`;

    const imagePart = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: mimeType
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().trim();
    
    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      db.prepare("UPDATE users SET kyc_status = 'rejected' WHERE id = ?").run(user.id);
      return sendError(res, 500, "KI konnte das Dokument nicht lesen. Bitte lade ein schärferes Bild hoch.");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    if (parsed.nameMatch && parsed.dobMatch) {
      db.prepare("UPDATE users SET kyc_verified = 1, kyc_status = 'verified' WHERE id = ?").run(user.id);
      return sendOK(res, { message: "Ausweis erfolgreich verifiziert!", kycVerified: true });
    } else {
      db.prepare("UPDATE users SET kyc_verified = 0, kyc_status = 'rejected' WHERE id = ?").run(user.id);
      return sendError(res, 400, `Daten stimmen nicht überein. Gefunden: ${parsed.extractedName}, ${parsed.extractedDob}`);
    }

  } catch (err) {
    console.error("KYC Upload Error:", err);
    return sendError(res, 400, err.message || "Fehler beim Upload");
  }
}

module.exports = { getProfile, updateProfile, updatePayment, requestPayout, uploadKyc };
