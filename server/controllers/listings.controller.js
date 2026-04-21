const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");
const { parseBody } = require("../middleware/bodyParser");
const { sendOK, sendCreated, sendError } = require("../middleware/response.helper");

const VALID_CATEGORIES = ["sign-on-bonuses", "contractor-roles", "student-programs", "sales-incentives"];

function getListings(req, res) {
  const url = new URL(req.url, "http://localhost");
  const category = url.searchParams.get("category");

  let listings;
  if (category && VALID_CATEGORIES.includes(category)) {
    listings = db.prepare(`
      SELECT id, category, company, title, location, bonus, currency, description, is_anonymous, created_at
      FROM listings WHERE status = 'active' AND category = ?
      ORDER BY created_at DESC
    `).all(category);
  } else {
    listings = db.prepare(`
      SELECT id, category, company, title, location, bonus, currency, description, is_anonymous, created_at
      FROM listings WHERE status = 'active'
      ORDER BY created_at DESC
    `).all();
  }
  sendOK(res, listings);
}

function getListingById(req, res, id) {
  const listing = db.prepare(`
    SELECT id, category, company, title, location, bonus, currency, description, is_anonymous, created_at
    FROM listings WHERE id = ? AND status = 'active'
  `).get(id);
  if (!listing) return sendError(res, 404, "Inserat nicht gefunden");
  sendOK(res, listing);
}

async function createListing(req, res, user) {
  const body = await parseBody(req);
  const { category, company, title, location, bonus, currency, description, isAnonymous } = body;

  if (!category || !company || !title || !bonus) {
    return sendError(res, 400, "Kategorie, Unternehmen, Titel und Bonus sind erforderlich");
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return sendError(res, 400, "Ungültige Kategorie");
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO listings (id, category, company, title, location, bonus, currency, description, is_anonymous, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, category, company, title, location || "", bonus, currency || "EUR", description || "", isAnonymous !== false ? 1 : 0, user.id);

  const created = db.prepare("SELECT * FROM listings WHERE id = ?").get(id);
  sendCreated(res, created);
}

module.exports = { getListings, getListingById, createListing };
