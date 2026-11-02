import {
  PetProgressionSchema,
  type PetProgression,
  type PokemonDefinition,
} from '@arena/shared-types';
export {
  MIN_PET_LEVEL,
  MAX_PET_LEVEL,
  PET_QUALITIES,
  PetProgressionSchema,
  type PetProgression,
  type PetQuality,
} from '@arena/shared-types';
export const PET_QUALITY_MULTIPLIERS = {
  F: 1,
  E: 1.15,
  D: 1.3,
  C: 1.5,
  B: 1.6,
  A: 1.75,
  S: 2,
  SS: 2.5,
  SSS: 3,
} as const;
export const DEFAULT_PET_PROGRESSION: PetProgression = { level: 1, quality: 'F' };

/** XP is the remainder toward the next level, never a currency. */
export function experienceToNextLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > 100) throw new Error('Invalid level');
  return level === 100 ? 0 : 100 + 25 * (level - 1) + 5 * (level - 1) ** 2;
}
export function gainExperience(pet: { level: number; experience?: number }, amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid experience');
  let level = pet.level;
  experienceToNextLevel(level);
  let experience = (pet.experience ?? 0) + amount;
  if (!Number.isSafeInteger(experience) || experience < 0) throw new Error('Invalid experience');
  while (level < 100 && experience >= experienceToNextLevel(level)) {
    experience -= experienceToNextLevel(level++);
  }
  return { level, experience: level === 100 ? 0 : experience };
}
export function wildBattleExperience(wild: PetProgression, won: boolean) {
  return Math.round(
    (35 + 15 * wild.level) * PET_QUALITY_MULTIPLIERS[wild.quality] * (won ? 1 : 0.25),
  );
}

/** Growth per level, measured from level 1. Energy and skill costs stay fixed. */
export const PET_STAT_GROWTH = {
  hp: 0.08,
  attack: 0.05,
  defense: 0.05,
  speed: 0.005,
  sprintSpeed: 0.005,
  maxStamina: 0.01,
} as const;
/** Movement receives only 50% of the quality bonus: F ×1 through SSS ×2. */
export const PET_SPEED_QUALITY_BONUS_SCALE = 0.5;
export type PetStats = Pick<PokemonDefinition, keyof typeof PET_STAT_GROWTH>;

/** Level 1 / F reproduces the base stats exactly. Never mutates the species definition. */
export function calculatePetStats(
  base: PetStats,
  progression: PetProgression = DEFAULT_PET_PROGRESSION,
): PetStats {
  const { level, quality } = PetProgressionSchema.parse(progression);
  const multiplier = PET_QUALITY_MULTIPLIERS[quality];
  const stat = (key: keyof PetStats) => {
    if (level === 1 && multiplier === 1) return base[key];
    const movement = key === 'speed' || key === 'sprintSpeed';
    const qualityMultiplier = movement
      ? 1 + (multiplier - 1) * PET_SPEED_QUALITY_BONUS_SCALE
      : multiplier;
    const value = base[key] * (1 + (level - 1) * PET_STAT_GROWTH[key]) * qualityMultiplier;
    return movement ? Math.round(value * 10) / 10 : Math.round(value);
  };
  return {
    hp: stat('hp'),
    attack: stat('attack'),
    defense: stat('defense'),
    speed: stat('speed'),
    sprintSpeed: stat('sprintSpeed'),
    maxStamina: stat('maxStamina'),
  };
}
