import {
  ASSETS,
  directionFlipped,
  directionRow,
  locomotionFrame,
  movementDirection,
  POKEMON,
  type Direction,
} from '@arena/game-data';
import type { Fighter } from '@arena/shared-types';

export function fighterDirection(
  f: Pick<Fighter, 'animation' | 'vx' | 'vDepth' | 'cast'>,
  previous: Direction,
): Direction {
  // Recoil/backsteps retain the creature's facing rather than turning its back to the target.
  if (f.cast || !['run', 'dash', 'jump', 'fall'].includes(f.animation)) return previous;
  return movementDirection(f.vx, f.vDepth, previous);
}

export function creatureLocomotion(
  f: Pick<
    Fighter,
    'species' | 'animation' | 'animationTime' | 'cast' | 'sprinting' | 'stamina' | 'maxStamina'
  >,
  direction: Direction,
  clock: number,
  reducedMotion: boolean,
) {
  if (f.cast || !ASSETS.locomotion[f.species]) return null;
  const state = f.animation;
  const side = directionRow(direction) === 1;
  if (
    state !== 'idle' &&
    state !== 'run' &&
    (side || !['dash', 'backstep', 'jump', 'fall', 'land'].includes(state))
  )
    return null;
  const moving = ['run', 'dash', 'backstep'].includes(state);
  const speed = f.sprinting ? 1.5 : f.stamina < f.maxStamina * 0.2 ? 0.55 : 1;
  let frame = locomotionFrame(
    direction,
    moving,
    clock,
    POKEMON[f.species].animations[moving ? 'run' : 'idle'].frameRate * (moving ? speed : 1),
    reducedMotion,
  );
  if (state === 'jump' || state === 'fall')
    frame = directionRow(direction) * 6 + (reducedMotion ? 0 : 2);
  if (state === 'land') frame = directionRow(direction) * 6 + (reducedMotion ? 0 : 1);
  const scaleY = reducedMotion
    ? 1
    : state === 'idle' && !side
      ? 1 + Math.sin(clock * 2.4) * 0.018
      : state === 'land'
        ? 1 - Math.max(0, 1 - f.animationTime / 0.2) * 0.1
        : 1;
  return { frame, flipX: directionFlipped(direction), scaleY };
}
