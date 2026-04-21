function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendOK(res, data) {
  sendJSON(res, 200, data);
}

function sendCreated(res, data) {
  sendJSON(res, 201, data);
}

function sendError(res, statusCode, message) {
  sendJSON(res, statusCode, { error: message });
}

module.exports = { sendJSON, sendOK, sendCreated, sendError };
