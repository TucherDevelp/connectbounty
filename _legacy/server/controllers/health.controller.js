function healthController(req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });

  res.end(JSON.stringify({
    status: "ok",
    message: "API läuft sauber"
  }));
}

module.exports = { healthController };