import { POKEMON, SKILL_BY_ID } from '@arena/game-data';
import type { Fighter } from '@arena/shared-types';

/** Keep vine contact and seed release aligned with actual startup/active/recovery. */
export function bulbasaurCastFrame(fighter: Pick<Fighter, 'cast' | 'animation'>) {
  const { cast, animation } = fighter;
  if (!cast || !['attack', 'cast'].includes(animation)) return null;
  const skill = SKILL_BY_ID[cast.skillId];
  if (!skill) return null;
  const elapsed = Math.max(0, cast.elapsed);
  const phase =
    elapsed < skill.startup
      ? (elapsed / skill.startup) * 3
      : elapsed < skill.startup + skill.active
        ? 3
        : 4 + ((elapsed - skill.startup - skill.active) / Math.max(0.001, skill.recovery)) * 2;
  return POKEMON.bulbasaur.animations[animation].start + Math.min(5, Math.floor(phase));
}
