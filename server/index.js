import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIVITY_LEVELS, GOALS, MEAL_TYPES, SEXES, computeNeeds, ProfileError } from './nutrition.js';

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

// Listes de choix pour le formulaire (activité, objectif, type de repas, sexe)
app.get('/api/options', (req, res) => {
  const labels = (obj) => Object.entries(obj).map(([id, v]) => ({ id, label: typeof v === 'string' ? v : v.label }));
  res.json({
    sexes: labels(SEXES),
    activityLevels: labels(ACTIVITY_LEVELS),
    goals: labels(GOALS),
    mealTypes: labels(MEAL_TYPES),
  });
});

// Besoins nutritionnels calculés à partir du profil
app.post('/api/nutrition', (req, res) => {
  try {
    res.json(computeNeeds(req.body));
  } catch (err) {
    if (err instanceof ProfileError) return res.status(400).json({ error: 'Profil invalide', details: err.errors });
    throw err;
  }
});

app.use(express.static(PUBLIC_DIR));

// Toute route /api inconnue -> 404 JSON
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route inconnue' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Batch Cooking : http://localhost:${PORT}`);
});
