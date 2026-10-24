import type { PokemonDefinition } from '@arena/shared-types';

/** Base-stat comparison score; skills and elemental matchups are excluded. */
export function combatPower(
  stats: Pick<
    PokemonDefinition,
    'hp' | 'attack' | 'defense' | 'speed' | 'sprintSpeed' | 'maxStamina'
  >,
): number {
  return Math.round(
    stats.hp +
      stats.attack * 5 +
      stats.defense * 5 +
      stats.speed +
      stats.sprintSpeed +
      stats.maxStamina,
  );
}
