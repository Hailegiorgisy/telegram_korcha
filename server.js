// server.js: Production Web Server for Korcha Mini App
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const WORKER_USERNAME = process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve built frontend assets
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Korcha Web Server',
    worker: WORKER_USERNAME,
    timestamp: new Date().toISOString(),
  });
});

// Single Page Application (SPA) fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Initialize database & start server
async function startServer() {
  try {
    await runMigrations();
  } catch (err) {
    console.warn('[DB Warning] Database migration deferred:', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Web Server] Korcha web serving on http://0.0.0.0:${PORT}`);
  });
}

startServer();
