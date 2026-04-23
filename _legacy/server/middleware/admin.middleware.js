const { sendError } = require("./response.helper");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

function adminMiddleware(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, 401, "Nicht autorisiert: Token fehlt");
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      sendError(res, 403, "Nicht autorisiert: Keine Admin-Rechte");
      return null;
    }
    return decoded; // returned to allow caller to use admin data if needed
  } catch (err) {
    sendError(res, 401, "Nicht autorisiert: Ungültiges Token");
    return null;
  }
}

module.exports = { adminMiddleware };
