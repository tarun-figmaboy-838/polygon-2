// Minimal static server for QA runs: serves a folder over HTTP with correct
// media types, including paths with encoded spaces.
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain', '.md': 'text/plain', '.ico': 'image/x-icon'
};

function serve(root, port = 0) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.join(root, pathname);
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { requests.push({ path: pathname, status: 404 }); res.writeHead(404); return res.end('not found'); }
      requests.push({ path: pathname, status: 200, bytes: st.size });
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({
    server, requests, url: 'http://127.0.0.1:' + server.address().port, close: () => new Promise(r => server.close(r))
  })));
}
module.exports = { serve };
