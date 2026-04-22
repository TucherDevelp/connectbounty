const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");
const { parseBody } = require("../middleware/bodyParser");
const { sendOK, sendError } = require("../middleware/response.helper");
const { GEMINI_API_KEY } = require("../config/env.config");

// ──────────────────────────────────────────────────
// KI-Compliance: Nachricht prüfen via Gemini Flash
// ──────────────────────────────────────────────────
async function reviewMessageWithAI(message) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
    return { flagged: false, note: "" };
  }

  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const prompt = `Du bist ein Compliance-System für eine Job-Vermittlungsplattform. 
Analysiere folgende Chat-Nachricht und prüfe ob sie versucht:
1. Kontaktdaten (Telefon, E-Mail, WhatsApp, Telegram) auszutauschen
2. Eine Vermittlung OHNE Plattformbeteiligung zu arrangieren
3. Direkte Zahlungsabsprachen außerhalb der Plattform zu treffen
4. Persönliche Treffen ohne Plattformnachweis zu vereinbaren

Nachricht: "${message}"

Antworte NUR mit JSON: {"flagged": true/false, "reason": "kurze Begründung auf Deutsch oder leer"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { flagged: !!parsed.flagged, note: parsed.reason || "" };
    }
  } catch (err) {
    console.error("KI-Review Fehler:", err.message);
  }
  return { flagged: false, note: "" };
}

// ──────────────────────────────────────────────────
// POST /api/chat/conversations – Konversation starten
// ──────────────────────────────────────────────────
async function startConversation(req, res, user) {
  const body = await parseBody(req);
  const { listingId } = body;

  if (!listingId) {
    return sendError(res, 400, "listingId ist erforderlich");
  }

  // KYC prüfen
  const userRow = db.prepare("SELECT kyc_verified FROM users WHERE id = ?").get(user.id);
  if (!userRow || !userRow.kyc_verified) {
    return sendError(res, 403, "KYC-Verifizierung erforderlich, um Kontakt aufzunehmen");
  }

  // Listing prüfen
  const listing = db.prepare("SELECT id, created_by, title, company FROM listings WHERE id = ?").get(listingId);
  if (!listing) {
    return sendError(res, 404, "Inserat nicht gefunden");
  }

  // Kann nicht mit eigenem Inserat chatten
  if (listing.created_by === user.id) {
    return sendError(res, 400, "Du kannst nicht dein eigenes Inserat kontaktieren");
  }

  // Prüfen ob Konversation bereits existiert
  const existing = db.prepare(
    "SELECT id FROM conversations WHERE listing_id = ? AND applicant_id = ?"
  ).get(listingId, user.id);

  if (existing) {
    return sendOK(res, { conversationId: existing.id, existing: true });
  }

  // Neue Konversation erstellen
  const convId = uuidv4();
  db.prepare(`
    INSERT INTO conversations (id, listing_id, applicant_id, owner_id)
    VALUES (?, ?, ?, ?)
  `).run(convId, listingId, user.id, listing.created_by);

  // System-Nachricht einfügen
  const sysMsgId = uuidv4();
  db.prepare(`
    INSERT INTO chat_messages (id, conversation_id, listing_id, sender_id, receiver_id, message, ai_flagged)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(sysMsgId, convId, listingId, user.id, listing.created_by,
    `Anfrage zu "${listing.company} – ${listing.title}" gestartet. Alle Nachrichten werden durch Connect Bounty überwacht.`);

  sendOK(res, { conversationId: convId, existing: false });
}

// ──────────────────────────────────────────────────
// GET /api/chat/conversations – Alle Konversationen
// ──────────────────────────────────────────────────
function getConversations(req, res, user) {
  const conversations = db.prepare(`
    SELECT c.id, c.listing_id, c.applicant_id, c.owner_id, c.status, c.created_at,
           l.title as listing_title, l.company as listing_company, l.bonus as listing_bonus, l.currency as listing_currency,
           app.username as applicant_username,
           own.username as owner_username,
           (SELECT message FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
           (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
           (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count
    FROM conversations c
    JOIN listings l ON c.listing_id = l.id
    JOIN users app ON c.applicant_id = app.id
    JOIN users own ON c.owner_id = own.id
    WHERE c.applicant_id = ? OR c.owner_id = ?
    ORDER BY last_message_at DESC
  `).all(user.id, user.id);

  // Partner-Info hinzufügen
  const result = conversations.map(c => ({
    ...c,
    partnerUsername: c.applicant_id === user.id ? c.owner_username : c.applicant_username,
    isOwner: c.owner_id === user.id,
  }));

  sendOK(res, result);
}

// ──────────────────────────────────────────────────
// GET /api/chat/conversations/:id/messages
// ──────────────────────────────────────────────────
function getConversationMessages(req, res, user, conversationId) {
  // Prüfen ob User Teil der Konversation ist
  const conv = db.prepare(
    "SELECT id FROM conversations WHERE id = ? AND (applicant_id = ? OR owner_id = ?)"
  ).get(conversationId, user.id, user.id);

  if (!conv) {
    return sendError(res, 403, "Kein Zugriff auf diese Konversation");
  }

  const messages = db.prepare(`
    SELECT m.id, m.message, m.ai_flagged, m.ai_review_note, m.created_at,
           m.sender_id,
           s.username as sender_username
    FROM chat_messages m
    JOIN users s ON m.sender_id = s.id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `).all(conversationId);

  sendOK(res, messages);
}

// ──────────────────────────────────────────────────
// POST /api/chat/conversations/:id/messages
// ──────────────────────────────────────────────────
async function sendConversationMessage(req, res, user, conversationId) {
  const body = await parseBody(req);
  const { message } = body;

  if (!message || !message.trim()) {
    return sendError(res, 400, "Nachricht darf nicht leer sein");
  }
  if (message.length > 2000) {
    return sendError(res, 400, "Nachricht zu lang (max. 2000 Zeichen)");
  }

  // Konversation prüfen + Daten laden
  const conv = db.prepare(
    "SELECT id, listing_id, applicant_id, owner_id, status FROM conversations WHERE id = ? AND (applicant_id = ? OR owner_id = ?)"
  ).get(conversationId, user.id, user.id);

  if (!conv) {
    return sendError(res, 403, "Kein Zugriff auf diese Konversation");
  }
  if (conv.status === "closed") {
    return sendError(res, 400, "Diese Konversation wurde geschlossen");
  }

  const receiverId = conv.applicant_id === user.id ? conv.owner_id : conv.applicant_id;

  // KI-Compliance-Check
  const aiReview = await reviewMessageWithAI(message);

  const id = uuidv4();
  db.prepare(`
    INSERT INTO chat_messages (id, conversation_id, listing_id, sender_id, receiver_id, message, ai_flagged, ai_review_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, conversationId, conv.listing_id, user.id, receiverId, message, aiReview.flagged ? 1 : 0, aiReview.note);

  if (aiReview.flagged) {
    return sendOK(res, {
      id,
      message,
      aiWarning: `Diese Nachricht wurde markiert: ${aiReview.note}. Vermittlungen muessen ueber die Plattform laufen.`,
      flagged: true,
    });
  }

  sendOK(res, { id, message, flagged: false });
}

// ──────────────────────────────────────────────────
// Legacy-Endpunkte (Abwärtskompatibel)
// ──────────────────────────────────────────────────
async function sendMessage(req, res, user) {
  const body = await parseBody(req);
  const { listingId, receiverId, message } = body;

  if (!listingId || !receiverId || !message) {
    return sendError(res, 400, "listingId, receiverId und message sind erforderlich");
  }

  const aiReview = await reviewMessageWithAI(message);
  const id = uuidv4();
  db.prepare(`
    INSERT INTO chat_messages (id, listing_id, sender_id, receiver_id, message, ai_flagged, ai_review_note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, listingId, user.id, receiverId, message, aiReview.flagged ? 1 : 0, aiReview.note || "");

  if (aiReview.flagged) {
    return sendOK(res, { id, message: "[Markiert]", aiWarning: aiReview.note, flagged: true });
  }
  sendOK(res, { id, message, flagged: false });
}

function getMessages(req, res, user) {
  const url = new URL(req.url, "http://localhost");
  const listingId = url.searchParams.get("listingId");
  if (!listingId) return sendError(res, 400, "listingId erforderlich");

  const messages = db.prepare(`
    SELECT m.id, m.message, m.ai_flagged, m.ai_review_note, m.created_at,
           s.username as sender_username, r.username as receiver_username
    FROM chat_messages m
    JOIN users s ON m.sender_id = s.id
    JOIN users r ON m.receiver_id = r.id
    WHERE m.listing_id = ? AND (m.sender_id = ? OR m.receiver_id = ?)
    ORDER BY m.created_at ASC
  `).all(listingId, user.id, user.id);

  sendOK(res, messages);
}

module.exports = {
  startConversation,
  getConversations,
  getConversationMessages,
  sendConversationMessage,
  sendMessage,
  getMessages,
};
