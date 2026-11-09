import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { handleApi } from './server/api.js';

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
    if (await handleApi(req, res)) return;
    const url = new URL(req.url, 'http://localhost');
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

server.listen(port, '0.0.0.0', () => {
  console.log(`conso-foodly http://localhost:${port}`);
});
