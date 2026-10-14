import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DEFAULT_DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

// Contenu par défaut de chaque fichier quand il n'existe pas encore
const FILES = {
  recipes: { file: 'recipes.json', empty: () => [] },
  favorites: { file: 'favorites.json', empty: () => [] },
  profile: { file: 'profile.json', empty: () => null },
  shoppingList: { file: 'shopping-list.json', empty: () => null },
};

// Sous Windows, un antivirus ou l'indexeur peut verrouiller brièvement le fichier cible
async function renameWithRetry(from, to, attempts = 5) {
  for (let i = 1; ; i++) {
    try {
      return await fs.rename(from, to);
    } catch (err) {
      if (i >= attempts || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 50 * i));
    }
  }
}

/**
 * Stockage des données dans des fichiers JSON.
 * - Écriture atomique (fichier temporaire puis renommage) : un arrêt brutal ne corrompt pas les données.
 * - Les modifications d'un même fichier sont mises en file d'attente pour éviter les écritures concurrentes.
 */
export function createStorage(dataDir = process.env.BATCH_DATA_DIR || DEFAULT_DATA_DIR) {
  const queues = new Map();

  function filePath(key) {
    return path.join(dataDir, FILES[key].file);
  }

  async function read(key) {
    const target = filePath(key);
    let raw;
    try {
      raw = await fs.readFile(target, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return FILES[key].empty();
      throw err;
    }
    try {
      return JSON.parse(raw);
    } catch {
      // Fichier illisible : on le met de côté au lieu de l'écraser, pour pouvoir le récupérer à la main
      const backup = `${target}.corrompu-${Date.now()}`;
      await fs.rename(target, backup);
      console.warn(`[storage] ${FILES[key].file} illisible, sauvegardé sous ${path.basename(backup)}`);
      return FILES[key].empty();
    }
  }

  async function write(key, value) {
    await fs.mkdir(dataDir, { recursive: true });
    const target = filePath(key);
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
    await renameWithRetry(tmp, target);
  }

  // Lecture-modification-écriture sérialisée par fichier
  function update(key, mutate) {
    const previous = queues.get(key) || Promise.resolve();
    const next = previous.then(async () => {
      const current = await read(key);
      const { value, result } = await mutate(current);
      await write(key, value);
      return result;
    });
    // La file continue même si une modification échoue
    queues.set(key, next.catch(() => {}));
    return next;
  }

  const api = {
    // --- Recettes ---
    async getRecipes() {
      return read('recipes');
    },

    async getRecipe(id) {
      const recipes = await read('recipes');
      return recipes.find((r) => r.id === id) || null;
    },

    /** Ajoute des recettes (id et date de création attribués ici) et renvoie les recettes enregistrées. */
    addRecipes(newRecipes) {
      return update('recipes', (recipes) => {
        const now = new Date().toISOString();
        const added = newRecipes.map((r) => ({ ...r, id: randomUUID(), createdAt: now }));
        return { value: [...recipes, ...added], result: added };
      });
    },

    /** Supprime une recette (et son éventuel favori). Renvoie false si elle n'existait pas. */
    async deleteRecipe(id) {
      const removed = await update('recipes', (recipes) => {
        const kept = recipes.filter((r) => r.id !== id);
        return { value: kept, result: kept.length !== recipes.length };
      });
      if (removed) await api.removeFavorite(id);
      return removed;
    },

    // --- Favoris ---
    async getFavorites() {
      return read('favorites');
    },

    addFavorite(id) {
      return update('favorites', (favs) => {
        const value = favs.includes(id) ? favs : [...favs, id];
        return { value, result: value };
      });
    },

    removeFavorite(id) {
      return update('favorites', (favs) => {
        const value = favs.filter((f) => f !== id);
        return { value, result: value };
      });
    },

    // --- Profil ---
    async getProfile() {
      return read('profile');
    },

    saveProfile(profile) {
      return update('profile', () => ({ value: profile, result: profile }));
    },

    // --- Liste de courses ---
    async getShoppingList() {
      return read('shoppingList');
    },

    saveShoppingList(list) {
      return update('shoppingList', () => ({ value: list, result: list }));
    },
  };

  return api;
}

export const storage = createStorage();
