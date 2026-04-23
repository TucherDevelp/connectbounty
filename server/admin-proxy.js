const http = require('http');
const httpProxy = require('http-proxy');

// Create a proxy server with custom application logic
const proxy = httpProxy.createProxyServer({});

// Listen on port 8001
const server = http.createServer(function(req, res) {
  // Always proxy to localhost:8000/admin (unless it's an asset or API call that needs to go to the main app)
  // We'll just proxy the whole request to 8000, but rewrite the URL to prefix /admin if it's the root
  if (req.url === '/' || req.url === '') {
    req.url = '/admin';
  }
  proxy.web(req, res, { target: 'http://localhost:8000' });
});

console.log("Admin Proxy Server listening on port 8001 and forwarding to http://localhost:8000/admin");
server.listen(8001);
