import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '1mb' }));

// Santé du serveur + état de la configuration (sans jamais renvoyer la clé)
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
  });
});

app.use(express.static(PUBLIC_DIR));

// Toute route /api inconnue -> 404 JSON
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route inconnue' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Batch Cooking : http://localhost:${PORT}`);
});
