const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleRoutes } = require("./routes/api.routes");

// Statische Dateien aus client/public servieren
const CLIENT_DIR = path.resolve(__dirname, "../client/public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function serveStatic(req, res) {
  let filePath = path.join(CLIENT_DIR, req.url === "/" ? "/index.html" : req.url);

  // Sicherheitscheck: Pfad muss innerhalb CLIENT_DIR bleiben
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  // Für SPA: alle unbekannten Routen → index.html (Hash-Router übernimmt)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(CLIENT_DIR, "index.html");
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // API-Requests → Router
  if (req.url.startsWith("/api/")) {
    return handleRoutes(req, res);
  }
  // Alles andere → Static Files
  serveStatic(req, res);
});

module.exports = server;