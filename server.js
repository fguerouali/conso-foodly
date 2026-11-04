import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fetchNetwork } from './server/lacaisse.js';

const port = Number(process.env.PORT) || 8787;
const root = join(process.cwd(), 'dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function sendFile(res, filePath) {
  await access(filePath);
  res.writeHead(200, { 'Content-Type': types[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/api/conso') {
      const body = await readJson(req);
      const report = await fetchNetwork(body.month);
      sendJson(res, 200, report);
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'Introuvable.' });
      return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^[/\\]+/, '');
    const filePath = relative ? resolve(root, relative) : join(root, 'index.html');
    const rootPath = resolve(root);
    if (filePath !== rootPath && !filePath.startsWith(rootPath + sep)) {
      sendJson(res, 403, { error: 'Interdit.' });
      return;
    }
    try {
      await sendFile(res, filePath);
    } catch {
      await sendFile(res, join(root, 'index.html'));
    }
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || 'Lecture impossible.' });
  }
});

server.listen(port, () => {
  console.log(`conso-foodly http://localhost:${port}`);
});
