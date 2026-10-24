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
