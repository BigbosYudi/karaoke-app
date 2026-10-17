const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
  }
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); }
  catch (err) { res.writeHead(400); res.end('Bad Request'); return; }
  // Hanya aset publik aplikasi; jangan pernah sajikan .env, Git, atau skrip internal.
  const rel = urlPath.replace(/^\/+/, '') || 'index.html';
  const parts = rel.split(/[\\/]/);
  const allowed = ['index.html', 'manifest.webmanifest', 'sw.js'].includes(rel) ||
    (/^(css|js|icons)\//.test(rel) && /\.(js|css|png|svg|ico)$/.test(rel));
  const file = path.resolve(ROOT, rel);
  const relative = path.relative(ROOT, file);
  if (!allowed || parts.some(p => p.startsWith('.') || p.includes(':')) ||
      relative.startsWith('..') || path.isAbsolute(relative) || rel.includes('\0')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  // realpath juga menolak symlink yang mengarah keluar projek.
  try {
    const real = path.relative(fs.realpathSync(ROOT), fs.realpathSync(file));
    if (real.startsWith('..') || path.isAbsolute(real)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
  } catch (err) { res.writeHead(404); res.end('Not Found'); return; }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + rel);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Karaoke TV berjalan di http://localhost:' + PORT + '/');
  console.log('Folder: ' + ROOT);
  console.log('Tekan Ctrl+C untuk berhenti.');
});
