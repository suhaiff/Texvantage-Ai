import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './src/server/apiRouter';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body Parsers for API routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ----------------------------------------------------
// 1. AUTHORITATIVE BACKEND REST & SSE ROUTER (/api/*)
// ----------------------------------------------------
app.use('/api', apiRouter);

// Fallback for unmatched /api routes (guarantee JSON 404 instead of Vite index.html)
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ detail: `API route not found: ${_req.method} ${_req.url}` });
});

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
