const server = require("./server");

const PORT = 8000;

server.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});