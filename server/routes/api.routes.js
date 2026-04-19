const { healthController } = require("../controllers/health.controller");
const { getItems } = require("../controllers/items.controller");

function handleRoutes(req, res) {
  const url = req.url;
  const method = req.method;

  // Health Check
  if (url === "/api/health" && method === "GET") {
    return healthController(req, res);
  }

  // Items holen
  if (url === "/api/items" && method === "GET") {
    return getItems(req, res);
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Route not found" }));
}

module.exports = { handleRoutes };