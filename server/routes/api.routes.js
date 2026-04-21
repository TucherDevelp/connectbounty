const { healthController } = require("../controllers/health.controller");
const { register, login, getMe } = require("../controllers/auth.controller");
const { getListings, getListingById, createListing } = require("../controllers/listings.controller");
const { getProfile, updateProfile, updatePayment, requestPayout } = require("../controllers/user.controller");
const { getReferral } = require("../controllers/referral.controller");
const { sendMessage, getMessages } = require("../controllers/chat.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const { corsMiddleware } = require("../middleware/cors.middleware");
const { sendError } = require("../middleware/response.helper");

function handleRoutes(req, res) {
  // CORS für alle Requests
  corsMiddleware(req, res, async () => {
    const { url, method } = req;

    // Pfad ohne Query-String
    const path = url.split("?")[0];

    // ── Health ──────────────────────────────
    if (path === "/api/health" && method === "GET") {
      return healthController(req, res);
    }

    // ── Auth ────────────────────────────────
    if (path === "/api/auth/register" && method === "POST") {
      return register(req, res);
    }
    if (path === "/api/auth/login" && method === "POST") {
      return login(req, res);
    }
    if (path === "/api/auth/me" && method === "GET") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return getMe(req, res, user);
    }

    // ── Listings ────────────────────────────
    if (path === "/api/listings" && method === "GET") {
      return getListings(req, res);
    }
    if (path === "/api/listings" && method === "POST") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return createListing(req, res, user);
    }
    // Dynamische Route: /api/listings/:id
    const listingMatch = path.match(/^\/api\/listings\/([^/]+)$/);
    if (listingMatch && method === "GET") {
      return getListingById(req, res, listingMatch[1]);
    }

    // ── User Profil ──────────────────────────
    if (path === "/api/user/profile" && method === "GET") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return getProfile(req, res, user);
    }
    if (path === "/api/user/profile" && method === "PUT") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return updateProfile(req, res, user);
    }
    if (path === "/api/user/payment" && method === "PUT") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return updatePayment(req, res, user);
    }
    if (path === "/api/user/payout" && method === "POST") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return requestPayout(req, res, user);
    }

    // ── Referral ────────────────────────────
    if (path === "/api/referral" && method === "GET") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return getReferral(req, res, user);
    }

    // ── Chat ─────────────────────────────────
    if (path === "/api/chat/messages" && method === "GET") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return getMessages(req, res, user);
    }
    if (path === "/api/chat/messages" && method === "POST") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return sendMessage(req, res, user);
    }

    // ── 404 ──────────────────────────────────
    sendError(res, 404, "Route nicht gefunden");
  });
}

module.exports = { handleRoutes };