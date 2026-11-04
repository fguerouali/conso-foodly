import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fetchNetwork } from './server/lacaisse.js';

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

function lacaisseApi() {
  return {
    name: 'lacaisse-api',
    configureServer(server) {
      server.middlewares.use('/api/conso', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const body = await readJson(req);
          const report = await fetchNetwork(body.month);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(report));
        } catch (error) {
          res.statusCode = error.status || 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: error.message || 'Lecture impossible.' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  process.env.LACAISSE_LOGIN ||= env.LACAISSE_LOGIN;
  process.env.LACAISSE_PASSWORD ||= env.LACAISSE_PASSWORD;
  return {
    plugins: [react(), lacaisseApi()],
    server: { port: 5173, host: true },
    optimizeDeps: { include: ['xlsx'] },
  };
});
