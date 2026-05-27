import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION AT STARTUP/RUNTIME:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION AT STARTUP/RUNTIME:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;
const DIST_DIR = path.join(__dirname, 'dist');

// Check at startup if dist directory and index.html exist
try {
  if (fs.existsSync(DIST_DIR)) {
    console.log(`✓ Startup check: Directory ${DIST_DIR} exists.`);
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      console.log(`✓ Startup check: index.html exists at ${indexPath}.`);
    } else {
      console.warn(`⚠ Startup check: index.html is MISSING at ${indexPath}!`);
    }
  } else {
    console.warn(`⚠ Startup check: Directory ${DIST_DIR} is MISSING! Did the build command run successfully?`);
  }
} catch (e) {
  console.error('Failed to perform startup file checks:', e);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json'
};

const server = http.createServer((req, res) => {
  // Decode URL to handle spaces/special characters
  let filePath = path.join(DIST_DIR, decodeURIComponent(req.url.split('?')[0]));

  // Log incoming requests
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Only allow GET/HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Method Not Allowed');
    return;
  }

  // Check if path is a directory, default to index.html
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.stat(filePath, (errFile, statsFile) => {
      // SPA Fallback: if file doesn't exist, serve index.html
      if (errFile || !statsFile.isFile()) {
        filePath = path.join(DIST_DIR, 'index.html');
      }

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          if (filePath.endsWith('index.html')) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<!DOCTYPE html>
<html>
<head><title>OJT Management System</title></head>
<body>
  <div style="font-family: sans-serif; padding: 40px; text-align: center;">
    <h2>OJT Management System</h2>
    <p>The static assets directory was not found or is still building.</p>
    <p style="color: gray; font-size: 12px;">Path: ${filePath}</p>
  </div>
</body>
</html>`);
            console.warn(`Served health-check fallback because index.html was missing at ${filePath}`);
            return;
          }

          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end('500 Internal Server Error');
          console.error(`Error reading file ${filePath}:`, readErr);
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        
        // Cache static assets for 1 year, index.html no cache
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        res.end(content);
      });
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Serving static files from: ${DIST_DIR}`);
});
