import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStorage } from '../server/storage.js';

let dir;
let storage;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'batchcooking-test-'));
  storage = createStorage(dir);
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

test('valeurs par défaut quand les fichiers n\'existent pas', async () => {
  assert.deepEqual(await storage.getRecipes(), []);
  assert.deepEqual(await storage.getFavorites(), []);
  assert.equal(await storage.getProfile(), null);
  assert.equal(await storage.getShoppingList(), null);
});

test('ajout de recettes : id et date attribués, persistance sur disque', async () => {
  const added = await storage.addRecipes([{ title: 'Curry' }, { title: 'Lasagnes' }]);
  assert.equal(added.length, 2);
  assert.ok(added[0].id && added[0].createdAt);
  assert.notEqual(added[0].id, added[1].id);

  const raw = JSON.parse(await fs.readFile(path.join(dir, 'recipes.json'), 'utf8'));
  assert.deepEqual(raw.map((r) => r.title), ['Curry', 'Lasagnes']);
  assert.equal((await storage.getRecipe(added[1].id)).title, 'Lasagnes');
  assert.equal(await storage.getRecipe('inconnu'), null);
});

test('écritures simultanées : aucune recette perdue', async () => {
  await Promise.all(
    Array.from({ length: 20 }, (_, i) => storage.addRecipes([{ title: `R${i}` }]))
  );
  assert.equal((await storage.getRecipes()).length, 20);
});

test('favoris : pas de doublon, retrait', async () => {
  await storage.addFavorite('a');
  await storage.addFavorite('a');
  await storage.addFavorite('b');
  assert.deepEqual(await storage.getFavorites(), ['a', 'b']);
  await storage.removeFavorite('a');
  assert.deepEqual(await storage.getFavorites(), ['b']);
});

test('supprimer une recette retire aussi son favori', async () => {
  const [r] = await storage.addRecipes([{ title: 'Soupe' }]);
  await storage.addFavorite(r.id);
  assert.equal(await storage.deleteRecipe(r.id), true);
  assert.deepEqual(await storage.getRecipes(), []);
  assert.deepEqual(await storage.getFavorites(), []);
  assert.equal(await storage.deleteRecipe(r.id), false);
});

test('profil et liste de courses', async () => {
  await storage.saveProfile({ age: 30, sexe: 'F' });
  assert.deepEqual(await storage.getProfile(), { age: 30, sexe: 'F' });
  await storage.saveShoppingList({ items: [] });
  assert.deepEqual(await storage.getShoppingList(), { items: [] });
});

test('fichier corrompu : mis de côté, pas écrasé', async () => {
  await fs.writeFile(path.join(dir, 'recipes.json'), '{ pas du json', 'utf8');
  assert.deepEqual(await storage.getRecipes(), []);
  const files = await fs.readdir(dir);
  assert.ok(files.some((f) => f.startsWith('recipes.json.corrompu-')));
});

test('aucun fichier temporaire ne reste après écriture', async () => {
  await storage.addRecipes([{ title: 'X' }]);
  const files = await fs.readdir(dir);
  assert.ok(!files.some((f) => f.endsWith('.tmp')));
});
