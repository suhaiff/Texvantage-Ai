import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------------------------------------
// 1. REVERSE PROXY TO FASTAPI (/api/*)
// ----------------------------------------------------
app.use(createProxyMiddleware({
  pathFilter: '/api',
  target: 'http://127.0.0.1:8081',
  changeOrigin: true,
  // Chat responses use server-sent events.  Keep the proxy alive while the
  // backend performs a verified database query or creates a report artifact.
  // The previous implicit timeout surfaced to the UI as HTTP 504.
  timeout: 120000,
  proxyTimeout: 120000,
}));

// ----------------------------------------------------
// 2. VITE CLIENT APPLICATION HOSTING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[TexVantage AI] Server listening on port ${PORT} with active /api endpoints`);
  });
}

startServer();
