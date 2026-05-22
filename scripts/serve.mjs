import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const PORT = 8081;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname;

  // Clean trailing slashes (except root)
  if (pathname !== '/' && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // 1. Replicate cleanUrl / support / privacy / terms rewrites
  if (pathname === '/support') pathname = '/support.html';
  if (pathname === '/privacy') pathname = '/privacy.html';
  if (pathname === '/terms') pathname = '/terms.html';

  // 2. /app/_expo/(.*) -> /_expo/$1
  if (pathname.startsWith('/app/_expo/')) {
    pathname = pathname.replace('/app/_expo/', '/_expo/');
  }
  // 3. /app/assets/(.*) -> /assets/$1
  if (pathname.startsWith('/app/assets/')) {
    pathname = pathname.replace('/app/assets/', '/assets/');
  }

  // Determine file path
  let filePath = path.join(distDir, pathname);

  // If path exists and is directory, look for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // 4. SPA rewrites
  if (!fs.existsSync(filePath)) {
    if (pathname.startsWith('/app')) {
      filePath = path.join(distDir, 'app', 'index.html');
    } else {
      filePath = path.join(distDir, 'index.html');
    }
  }

  // Serve the file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Production Preview Server running at:`);
  console.log(`   👉 Marketing Site: http://localhost:${PORT}/`);
  console.log(`   👉 Web Application: http://localhost:${PORT}/app`);
  console.log(`======================================================\n`);
});
