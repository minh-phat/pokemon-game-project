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
export const PET_QUALITY_MULTIPLIERS = { C: 1, B: 1.1, A: 1.25, S: 1.5, SS: 2 } as const;
export const DEFAULT_PET_PROGRESSION: PetProgression = { level: 1, quality: 'C' };

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
export type PetStats = Pick<PokemonDefinition, keyof typeof PET_STAT_GROWTH>;

/** Level 1 / C reproduces the base stats exactly. Never mutates the species definition. */
export function calculatePetStats(
  base: PetStats,
  progression: PetProgression = DEFAULT_PET_PROGRESSION,
): PetStats {
  const { level, quality } = PetProgressionSchema.parse(progression);
  const multiplier = PET_QUALITY_MULTIPLIERS[quality];
  const stat = (key: keyof PetStats) => {
    if (level === 1 && quality === 'C') return base[key];
    const value = base[key] * (1 + (level - 1) * PET_STAT_GROWTH[key]) * multiplier;
    return key === 'speed' || key === 'sprintSpeed'
      ? Math.round(value * 10) / 10
      : Math.round(value);
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
