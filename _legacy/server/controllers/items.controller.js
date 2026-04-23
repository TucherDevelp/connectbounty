const { items } = require("../data/items.data");

function getItems(req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(items));
}

module.exports = { getItems };