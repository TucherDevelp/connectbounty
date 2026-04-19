const http = require("http");
const { handleRoutes } = require("./routes/api.routes");

const server = http.createServer((req, res) => {
  handleRoutes(req, res);
});

module.exports = server;