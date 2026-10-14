// Calcul des besoins nutritionnels (estimations indicatives, pas un avis médical).
// Métabolisme de base : formule de Mifflin-St Jeor.

export const ACTIVITY_LEVELS = {
  sedentaire: { label: 'Sédentaire (peu ou pas de sport)', factor: 1.2 },
  leger: { label: 'Légèrement actif (1-3 séances/semaine)', factor: 1.375 },
  modere: { label: 'Modérément actif (3-5 séances/semaine)', factor: 1.55 },
  actif: { label: 'Très actif (6-7 séances/semaine)', factor: 1.725 },
  tres_actif: { label: 'Extrêmement actif (sport intense + travail physique)', factor: 1.9 },
};

// calorieFactor : ajustement de la dépense ; proteinPerKg : g de protéines par kg ; fatShare : part des calories en lipides
export const GOALS = {
  seche: { label: 'Sèche', calorieFactor: 0.85, proteinPerKg: 2.0, fatShare: 0.25 },
  maintien: { label: 'Maintien', calorieFactor: 1.0, proteinPerKg: 1.6, fatShare: 0.3 },
  prise_de_masse: { label: 'Prise de masse', calorieFactor: 1.1, proteinPerKg: 1.8, fatShare: 0.25 },
};

// Part de l'apport journalier par type de repas
export const MEAL_TYPES = {
  petit_dejeuner: { label: 'Petit-déjeuner', share: 0.25 },
  dejeuner: { label: 'Déjeuner', share: 0.35 },
  diner: { label: 'Dîner', share: 0.3 },
  encas: { label: 'En-cas', share: 0.1 },
};

export const SEXES = { homme: 'Homme', femme: 'Femme' };

// Plancher de sécurité : jamais en dessous du métabolisme de base ni de ces minimums
const MIN_DAILY_KCAL = { homme: 1500, femme: 1200 };

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

const LIMITS = {
  age: [15, 100],
  weightKg: [30, 300],
  heightCm: [120, 230],
};

export class ProfileError extends Error {
  constructor(errors) {
    super(errors.join(' '));
    this.name = 'ProfileError';
    this.errors = errors;
  }
}

/** Renvoie la liste des erreurs du profil (vide si le profil est valide). */
export function validateProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object') return ['Profil manquant.'];

  const labels = { age: 'L\'âge', weightKg: 'Le poids', heightCm: 'La taille' };
  const units = { age: 'ans', weightKg: 'kg', heightCm: 'cm' };
  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    const value = Number(profile[field]);
    if (profile[field] === undefined || profile[field] === '' || !Number.isFinite(value)) {
      errors.push(`${labels[field]} est obligatoire.`);
    } else if (value < min || value > max) {
      errors.push(`${labels[field]} doit être entre ${min} et ${max} ${units[field]}.`);
    }
  }
  if (!SEXES[profile.sex]) errors.push('Le sexe est obligatoire.');
  if (!ACTIVITY_LEVELS[profile.activity]) errors.push('Le niveau d\'activité est obligatoire.');
  if (!GOALS[profile.goal]) errors.push('L\'objectif est obligatoire.');
  return errors;
}

/** Métabolisme de base (kcal/jour), formule de Mifflin-St Jeor. */
export function basalMetabolicRate({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'homme' ? base + 5 : base - 161;
}

function macrosFor(kcal, weightKg, goal) {
  const protein = goal.proteinPerKg * weightKg;
  const fat = (kcal * goal.fatShare) / KCAL_PER_G.fat;
  const carbs = Math.max(0, (kcal - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs);
  return { protein, carbs, fat };
}

const round10 = (n) => Math.round(n / 10) * 10;

/**
 * Besoins journaliers et cible par type de repas, pour une personne.
 * @throws {ProfileError} si le profil est invalide
 */
export function computeNeeds(rawProfile) {
  const errors = validateProfile(rawProfile);
  if (errors.length) throw new ProfileError(errors);

  const profile = {
    ...rawProfile,
    age: Number(rawProfile.age),
    weightKg: Number(rawProfile.weightKg),
    heightCm: Number(rawProfile.heightCm),
  };
  const goal = GOALS[profile.goal];

  const bmr = basalMetabolicRate(profile);
  const maintenance = bmr * ACTIVITY_LEVELS[profile.activity].factor;
  const floor = Math.max(bmr, MIN_DAILY_KCAL[profile.sex]);
  const target = Math.max(maintenance * goal.calorieFactor, floor);

  const daily = macrosFor(target, profile.weightKg, goal);

  const perMeal = {};
  for (const [id, meal] of Object.entries(MEAL_TYPES)) {
    perMeal[id] = {
      kcal: round10(target * meal.share),
      proteinG: Math.round(daily.protein * meal.share),
      carbsG: Math.round(daily.carbs * meal.share),
      fatG: Math.round(daily.fat * meal.share),
    };
  }

  return {
    bmrKcal: Math.round(bmr),
    maintenanceKcal: round10(maintenance),
    targetKcal: round10(target),
    floorApplied: target === floor,
    daily: {
      proteinG: Math.round(daily.protein),
      carbsG: Math.round(daily.carbs),
      fatG: Math.round(daily.fat),
    },
    perMeal,
  };
}
