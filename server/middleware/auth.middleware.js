const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env.config");

function authMiddleware(req, res) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Nicht authentifiziert" }));
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded; // { id, username, email }
  } catch {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Token ungültig oder abgelaufen" }));
    return null;
  }
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

module.exports = { authMiddleware, signToken };
