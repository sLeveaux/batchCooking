# Plan — Application Batch Cooking (génération de recettes par IA)

## 1. Objectif

Application web **locale** qui génère des recettes de batch cooking avec l'IA Claude selon les critères de l'utilisateur, les sauvegarde en **fichiers JSON**, gère des **favoris** et produit une **liste de courses** (chaque ingrédient rattaché à sa recette).

Critères (repris de `bc.txt`) :

| Critère | Valeurs |
|---|---|
| Profil alimentaire | végé, vegan, flexitarien, viande, poisson, œuf (cases à cocher) |
| Nombre de personnes | nombre |
| Facilement conservable | oui / non (+ durée de conservation affichée) |
| Produits de saison | oui / non (saison calculée d'après la date du jour) |
| Type de cuisine | asiatique, italienne, française, mexicaine, indienne, méditerranéenne… |
| Type de plat | petit-déj, déjeuner, dîner, en-cas |
| Profil physique | âge, sexe, poids, taille, activité (sédentaire → très sportif) |
| Objectif | prise de masse, sèche, maintien |

## 2. Architecture

```
Navigateur (HTML/CSS/JS vanilla)
        │  fetch /api/...
        ▼
Serveur Node.js + Express (localhost:3000)
   ├── sert les fichiers statiques (public/)
   ├── appelle l'API Claude (clé dans .env, jamais exposée au navigateur)
   └── lit / écrit les fichiers JSON (data/)
```

- **Front** : HTML + CSS + JavaScript vanilla (pas de framework).
- **Back** : Node.js + Express, SDK officiel `@anthropic-ai/sdk`.
- **Stockage** : fichiers JSON dans `data/` — pas de base de données.
- **Lancement** : `npm install` puis `npm start` → http://localhost:3000

## 3. Arborescence prévue

```
batchCooking/
├── bc.txt                  # notes d'origine
├── PLAN.md
├── README.md               # installation, lancement, configuration de la clé
├── package.json
├── .env.example            # ANTHROPIC_API_KEY=...
├── .gitignore              # node_modules, .env, data/*.json (option)
├── server/
│   ├── index.js            # Express : routes + statiques
│   ├── claude.js           # appel à l'API Claude, prompt, schéma JSON
│   ├── nutrition.js        # calcul calories / macros (Mifflin-St Jeor)
│   ├── storage.js          # lecture/écriture JSON (écriture atomique)
│   └── shopping.js         # agrégation de la liste de courses
├── public/
│   ├── index.html          # formulaire de critères + résultats
│   ├── recettes.html       # recettes sauvegardées + favoris
│   ├── courses.html        # liste de courses
│   ├── css/style.css
│   └── js/ (app.js, api.js, render.js)
└── data/
    ├── recipes.json        # toutes les recettes générées
    ├── favorites.json      # ids des favoris
    ├── profile.json        # dernier profil saisi (pré-remplissage)
    └── shopping-list.json  # liste de courses en cours
```

## 4. Modèle de données (JSON)

**Recette** (`data/recipes.json` = tableau) :

```json
{
  "id": "uuid",
  "createdAt": "2026-10-14T10:00:00Z",
  "title": "Curry de pois chiches au lait de coco",
  "cuisine": "indienne",
  "mealType": "dîner",
  "diet": ["vegan"],
  "servings": 4,
  "prepTimeMin": 20,
  "cookTimeMin": 35,
  "storage": { "fridgeDays": 4, "freezable": true, "tips": "..." },
  "seasonal": true,
  "ingredients": [
    { "name": "pois chiches", "quantity": 400, "unit": "g", "category": "épicerie" }
  ],
  "steps": ["...", "..."],
  "nutritionPerServing": { "kcal": 520, "proteinG": 22, "carbsG": 60, "fatG": 18 },
  "criteria": { "...critères utilisés pour la générer..." }
}
```

**Favoris** : `["id1", "id2"]` · **Liste de courses** : ingrédients regroupés par rayon, chacun avec la liste des recettes qui l'utilisent.

## 5. Génération par IA (Claude)

- **SDK** : `@anthropic-ai/sdk` côté serveur uniquement.
- **Modèle** : `claude-opus-5-5` par défaut (qualité maximale). Alternative bien moins chère et largement suffisante pour des recettes : `claude-haiku-5-5` ou `claude-sonnet-5-5` — **à choisir par vous**, le modèle sera un paramètre dans `.env` (`CLAUDE_MODEL`).
- **JSON garanti** : *structured outputs* (`output_config.format` avec un schéma JSON) → la réponse respecte toujours le format de la recette ; validation supplémentaire côté serveur avant sauvegarde.
- **Prompt** : critères + besoins nutritionnels calculés + mois courant (saison) + titres des recettes déjà en base (pour éviter les doublons).
- **Génération** : 1 recette ou un « menu de la semaine » (N recettes d'un coup).
- **Gestion d'erreurs** : clé absente, quota, refus, réseau → message clair dans l'interface.
- **Coût indicatif** (à confirmer à l'usage) : quelques centimes par recette avec Opus 5.5 ; moins d'un centime avec Haiku 5.5.

## 6. Nutrition

`server/nutrition.js` :
1. Métabolisme de base (Mifflin-St Jeor) selon âge, sexe, poids, taille.
2. × coefficient d'activité (1,2 → 1,9).
3. Ajustement objectif : sèche −15 %, maintien 0, prise de masse +10 %.
4. Répartition des macros (protéines 1,6–2,2 g/kg selon l'objectif).
5. Cible calorique **par repas** selon le type de plat → transmise à Claude, qui ajuste les portions.

Avertissement affiché : estimations indicatives, pas un avis médical.

## 7. API du serveur

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/generate` | génère 1..N recettes selon les critères, les sauvegarde |
| GET | `/api/recipes` | liste (filtres : cuisine, type, régime, favoris) |
| GET | `/api/recipes/:id` | détail |
| DELETE | `/api/recipes/:id` | supprime une recette |
| POST/DELETE | `/api/favorites/:id` | ajoute / retire un favori |
| GET/PUT | `/api/profile` | profil mémorisé |
| POST | `/api/shopping-list` | construit la liste à partir d'ids de recettes |
| GET | `/api/shopping-list` | liste en cours |

## 8. Écrans

1. **Générer** : formulaire des critères (profil pré-rempli) → cartes de recettes générées, bouton ★ favori, bouton « ajouter à la liste de courses ».
2. **Mes recettes** : toutes les recettes sauvegardées, filtres, onglet favoris, vue détail (ingrédients, étapes, conservation, macros).
3. **Liste de courses** : regroupée par rayon, quantités additionnées, recette(s) associée(s) sous chaque ingrédient, cases à cocher, impression.

Design responsive (mobile pour faire les courses), CSS pur avec variables, mode clair/sombre.

## 9. Git / GitHub

- Dépôt distant : `https://github.com/sLeveaux/batchCooking.git`
- `git init`, branche `main` avec la base (README, PLAN, structure), puis une branche de travail par étape (`feature/server`, `feature/generation`, …) fusionnées dans `main`.
- `.env` (clé API) **jamais** commité. Choix à faire : commiter ou non `data/*.json` (recettes partagées vs personnelles).

## 10. Étapes de réalisation

1. **Socle** : git, `package.json`, Express qui sert `public/`, structure des dossiers, README.
2. **Stockage JSON** : `storage.js` (lecture, écriture atomique, création des fichiers manquants).
3. **Nutrition** : `nutrition.js` + tests simples.
4. **Génération Claude** : `claude.js` (schéma, prompt, structured outputs), route `/api/generate`.
5. **Front – Générer** : formulaire + affichage des recettes.
6. **Favoris & Mes recettes** : routes + page avec filtres.
7. **Liste de courses** : agrégation (normalisation des unités g/kg, ml/l) + page.
8. **Finitions** : responsive, impression, gestion d'erreurs, README complet.

## 11. Prérequis

- Node.js 22.9+ installé.
- Une clé API Anthropic (console.anthropic.com) avec un peu de crédit.
