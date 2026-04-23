const { healthController } = require("../controllers/health.controller");
const { register, login, getMe } = require("../controllers/auth.controller");
const { getListings, getListingById, createListing } = require("../controllers/listings.controller");
const { getProfile, updateProfile, updatePayment, requestPayout, uploadKyc } = require("../controllers/user.controller");
const { getReferral } = require("../controllers/referral.controller");
const {
  startConversation, getConversations, getConversationMessages, sendConversationMessage,
  sendMessage, getMessages,
} = require("../controllers/chat.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const { adminMiddleware } = require("../middleware/admin.middleware");
const { corsMiddleware } = require("../middleware/cors.middleware");
const { sendError } = require("../middleware/response.helper");
const {
  getPendingUsers, approveUser, rejectUser,
  getPendingListings, approveListing, rejectListing,
  getAllListings, updateListing, deleteListing
} = require("../controllers/admin.controller");
const {
  getAdminStatus, registerAdmin, loginAdmin,
  forgotPassword, resetPassword
} = require("../controllers/admin.auth.controller");

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

    // ── Admin Auth ──────────────────────────
    if (path === "/api/admin/auth/status" && method === "GET") return getAdminStatus(req, res);
    if (path === "/api/admin/auth/register" && method === "POST") return registerAdmin(req, res);
    if (path === "/api/admin/auth/login" && method === "POST") return loginAdmin(req, res);
    if (path === "/api/admin/auth/forgot-password" && method === "POST") return forgotPassword(req, res);
    if (path === "/api/admin/auth/reset-password" && method === "POST") return resetPassword(req, res);

    // ── Admin API ────────────────────────────
    if (path.startsWith("/api/admin")) {
      const isAdmin = adminMiddleware(req, res);
      if (!isAdmin) return; // Error already sent

      // Users
      if (path === "/api/admin/users/pending" && method === "GET") return getPendingUsers(req, res);
      
      const userApproveMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/approve$/);
      if (userApproveMatch && method === "PUT") return approveUser(req, res, userApproveMatch[1]);
      
      const userRejectMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/reject$/);
      if (userRejectMatch && method === "PUT") return rejectUser(req, res, userRejectMatch[1]);

      // Listings
      if (path === "/api/admin/listings/pending" && method === "GET") return getPendingListings(req, res);
      if (path === "/api/admin/listings/all" && method === "GET") return getAllListings(req, res);
      
      const listingUpdateMatch = path.match(/^\/api\/admin\/listings\/([^/]+)$/);
      if (listingUpdateMatch && method === "PUT") return updateListing(req, res, listingUpdateMatch[1]);
      if (listingUpdateMatch && method === "DELETE") return deleteListing(req, res, listingUpdateMatch[1]);
      
      const listingApproveMatch = path.match(/^\/api\/admin\/listings\/([^/]+)\/approve$/);
      if (listingApproveMatch && method === "PUT") return approveListing(req, res, listingApproveMatch[1]);
      
      const listingRejectMatch = path.match(/^\/api\/admin\/listings\/([^/]+)\/reject$/);
      if (listingRejectMatch && method === "PUT") return rejectListing(req, res, listingRejectMatch[1]);
      
      return sendError(res, 404, "Admin-Route nicht gefunden");
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
    if (path === "/api/user/kyc/upload" && method === "POST") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return uploadKyc(req, res, user);
    }

    // ── Referral ────────────────────────────
    if (path === "/api/referral" && method === "GET") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return getReferral(req, res, user);
    }

    // ── Chat: Conversations ─────────────────
    if (path === "/api/chat/conversations" && method === "POST") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return startConversation(req, res, user);
    }
    if (path === "/api/chat/conversations" && method === "GET") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return getConversations(req, res, user);
    }
    // /api/chat/conversations/:id/messages
    const convMsgMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)\/messages$/);
    if (convMsgMatch && method === "GET") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return getConversationMessages(req, res, user, convMsgMatch[1]);
    }
    if (convMsgMatch && method === "POST") {
      const user = authMiddleware(req, res);
      if (!user) return;
      return sendConversationMessage(req, res, user, convMsgMatch[1]);
    }

    // ── Chat: Legacy ─────────────────────────
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