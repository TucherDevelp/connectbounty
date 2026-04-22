const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8001;
const PUBLIC_DIR = path.resolve(__dirname, "../admin-portal");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  // Ignoriere Query Parameter
  let filePath = path.join(PUBLIC_DIR, req.url === "/" ? "index.html" : req.url.split("?")[0]);

  // Verhindern von Directory Traversal Attacken
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        // Fallback für SPA: immer index.html laden
        fs.readFile(path.join(PUBLIC_DIR, "index.html"), (errIndex, contentIndex) => {
          if (errIndex) {
            res.writeHead(500);
            res.end("Internal Server Error");
          } else {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(contentIndex, "utf-8");
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🛡️  Admin Portal läuft auf Port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`=========================================`);
});
