const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");
const { parseBody } = require("../middleware/bodyParser");
const { sendOK, sendError } = require("../middleware/response.helper");
const { GEMINI_API_KEY } = require("../config/env.config");

// Gemini Flash – günstigste Gemini-Option (kostenloser Tier verfügbar)
async function reviewMessageWithAI(message) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
    return { flagged: false, note: "" };
  }

  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" }); // günstigstes Modell

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

async function sendMessage(req, res, user) {
  const body = await parseBody(req);
  const { listingId, receiverId, message } = body;

  if (!listingId || !receiverId || !message) {
    return sendError(res, 400, "listingId, receiverId und message sind erforderlich");
  }
  if (message.length > 2000) {
    return sendError(res, 400, "Nachricht zu lang (max. 2000 Zeichen)");
  }

  // KI-Überwachung (async, aber wir warten auf das Ergebnis)
  const aiReview = await reviewMessageWithAI(message);

  if (aiReview.flagged) {
    // Nachricht trotzdem speichern, aber markieren
    const id = uuidv4();
    db.prepare(`
      INSERT INTO chat_messages (id, listing_id, sender_id, receiver_id, message, ai_flagged, ai_review_note)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(id, listingId, user.id, receiverId, message, aiReview.note);

    return sendOK(res, {
      id,
      message: "[Diese Nachricht wurde zur Überprüfung markiert]",
      aiWarning: `⚠️ Diese Nachricht könnte gegen unsere Richtlinien verstoßen: ${aiReview.note}. Alle Vermittlungen müssen über die Plattform abgewickelt werden.`,
      flagged: true,
    });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO chat_messages (id, listing_id, sender_id, receiver_id, message, ai_flagged)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(id, listingId, user.id, receiverId, message);

  sendOK(res, { id, message, flagged: false });
}

function getMessages(req, res, user) {
  const url = new URL(req.url, "http://localhost");
  const listingId = url.searchParams.get("listingId");

  if (!listingId) return sendError(res, 400, "listingId erforderlich");

  const messages = db.prepare(`
    SELECT m.id, m.message, m.ai_flagged, m.ai_review_note, m.created_at,
           s.username as sender_username,
           r.username as receiver_username
    FROM chat_messages m
    JOIN users s ON m.sender_id = s.id
    JOIN users r ON m.receiver_id = r.id
    WHERE m.listing_id = ?
      AND (m.sender_id = ? OR m.receiver_id = ?)
    ORDER BY m.created_at ASC
  `).all(listingId, user.id, user.id);

  sendOK(res, messages);
}

module.exports = { sendMessage, getMessages };
