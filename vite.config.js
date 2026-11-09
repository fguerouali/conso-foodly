import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApi } from './server/api.js';

function lacaisseApi() {
  return {
    name: 'lacaisse-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        await handleApi(req, res);
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
