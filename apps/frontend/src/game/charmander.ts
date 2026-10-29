import { POKEMON, SKILL_BY_ID } from '@arena/game-data';
import type { Fighter } from '@arena/shared-types';

/** Match anticipation, contact and recovery to the actual skill timeline. */
export function charmanderCastFrame(fighter: Pick<Fighter, 'cast' | 'animation'>) {
  const { cast, animation } = fighter;
  if (!cast || !['attack', 'cast', 'dash'].includes(animation)) return null;
  const skill = SKILL_BY_ID[cast.skillId];
  if (!skill) return null;
  const t = Math.max(0, cast.elapsed);
  let frame: number;
  if (t < skill.startup) {
    frame = Math.min(2, Math.floor((t / skill.startup) * 3));
  } else if (t < skill.startup + skill.active) {
    // Hold the mouth open during a channel instead of finishing the cast
    // animation while the engine is still emitting fire.
    frame = animation === 'cast' ? 3 : 3 + Math.min(1, Math.floor((t - skill.startup) * 16));
  } else {
    frame =
      4 +
      Math.min(
        1,
        Math.floor(((t - skill.startup - skill.active) / Math.max(0.001, skill.recovery)) * 2),
      );
  }
  return POKEMON.charmander.animations[animation].start + frame;
}
