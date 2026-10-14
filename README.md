# Batch Cooking

Application web locale qui génère des recettes de batch cooking avec l'IA Claude selon vos critères (régime, saison, cuisine, objectif nutritionnel…), les enregistre en JSON, gère des favoris et une liste de courses.

Le plan complet est dans [PLAN.md](PLAN.md).

## Prérequis

- Node.js 22.9 ou plus récent
- Une clé API Anthropic : https://console.anthropic.com

## Installation

```bash
npm install
```

Copiez `.env.example` en `.env`, puis renseignez `ANTHROPIC_API_KEY` (et éventuellement `CLAUDE_MODEL`).

## Lancement

```bash
npm start
```

Puis ouvrez http://localhost:3000.

`npm run dev` relance automatiquement le serveur à chaque modification du code.

## Données

Les recettes, favoris, profil et liste de courses sont stockés dans `data/` (fichiers JSON). Ils ne sont pas envoyés sur GitHub (`.gitignore`).
