import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basalMetabolicRate, computeNeeds, validateProfile, ProfileError, MEAL_TYPES } from '../server/nutrition.js';

const homme = { sex: 'homme', age: 30, weightKg: 80, heightCm: 180, activity: 'modere', goal: 'maintien' };

test('métabolisme de base Mifflin-St Jeor', () => {
  // 10*80 + 6.25*180 - 5*30 + 5 = 1780
  assert.equal(basalMetabolicRate(homme), 1780);
  // 10*60 + 6.25*165 - 5*30 - 161 = 1320.25
  assert.equal(basalMetabolicRate({ sex: 'femme', weightKg: 60, heightCm: 165, age: 30 }), 1320.25);
});

test('maintien : cible = dépense (BMR x activité)', () => {
  const needs = computeNeeds(homme);
  assert.equal(needs.bmrKcal, 1780);
  assert.equal(needs.maintenanceKcal, 2760); // 1780 * 1.55 = 2759
  assert.equal(needs.targetKcal, 2760);
  assert.equal(needs.daily.proteinG, 128); // 1.6 g/kg
  assert.equal(needs.floorApplied, false);
});

test('sèche et prise de masse ajustent les calories', () => {
  const seche = computeNeeds({ ...homme, goal: 'seche' });
  const masse = computeNeeds({ ...homme, goal: 'prise_de_masse' });
  assert.equal(seche.targetKcal, 2350); // 2759 * 0.85
  assert.equal(masse.targetKcal, 3030); // 2759 * 1.1
  assert.equal(seche.daily.proteinG, 160); // 2 g/kg
});

test('les macros redonnent bien les calories cibles', () => {
  const { targetKcal, daily } = computeNeeds(homme);
  const kcal = daily.proteinG * 4 + daily.carbsG * 4 + daily.fatG * 9;
  assert.ok(Math.abs(kcal - targetKcal) < 15, `${kcal} vs ${targetKcal}`);
});

test('la répartition des repas fait 100 %', () => {
  const total = Object.values(MEAL_TYPES).reduce((s, m) => s + m.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  const { perMeal } = computeNeeds(homme);
  assert.equal(perMeal.dejeuner.kcal, 970); // 2759 * 0.35
});

test('plancher de sécurité en sèche pour un petit gabarit sédentaire', () => {
  const needs = computeNeeds({ sex: 'femme', age: 70, weightKg: 45, heightCm: 150, activity: 'sedentaire', goal: 'seche' });
  // BMR = 450 + 937.5 - 350 - 161 = 876.5 ; sèche = 894 -> plancher 1200
  assert.equal(needs.targetKcal, 1200);
  assert.equal(needs.floorApplied, true);
});

test('les valeurs saisies en texte (formulaire) sont acceptées', () => {
  const needs = computeNeeds({ ...homme, age: '30', weightKg: '80', heightCm: '180' });
  assert.equal(needs.bmrKcal, 1780);
});

test('validation du profil', () => {
  assert.deepEqual(validateProfile(homme), []);
  const errors = validateProfile({ sex: 'x', age: 5, weightKg: '', heightCm: 180 });
  assert.ok(errors.includes('L\'âge doit être entre 15 et 100 ans.'));
  assert.ok(errors.includes('Le poids est obligatoire.'));
  assert.ok(errors.includes('Le sexe est obligatoire.'));
  assert.ok(errors.includes('Le niveau d\'activité est obligatoire.'));
  assert.throws(() => computeNeeds({}), ProfileError);
});
