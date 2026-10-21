import type { BattleSnapshot } from '@arena/shared-types';
import { POKEMON } from '@arena/game-data';

/** Bounds include sprites, airborne movement, labels, and space around the action. */
export function automaticCameraFrame(
  snapshot: Pick<BattleSnapshot, 'fighters' | 'manualTeams' | 'controlledFighterIds'>,
  team: number,
  arena: { width: number; height?: number },
  width: number,
  height: number,
) {
  const active = snapshot.fighters.filter((f) => f.active && f.hp > 0);
  const controlled = snapshot.manualTeams[team]
    ? active.find((f) => f.team === team && f.id === snapshot.controlledFighterIds[team])
    : undefined;
  const subjects = controlled ? [controlled] : active;
  let left = 0,
    right = arena.width,
    top = 0,
    bottom = arena.height ?? 760;
  if (subjects.length) {
    left = Math.min(...subjects.map((f) => f.x - 180));
    right = Math.max(...subjects.map((f) => f.x + 180));
    top = Math.min(
      ...subjects.map((f) => 520 + f.depth - f.y - (POKEMON[f.species].hoverHeight ?? 0) - 200),
    );
    bottom = Math.max(...subjects.map((f) => 520 + f.depth + 100));
  }
  const x = (left + right) / 2;
  const y = (top + bottom) / 2;
  // Pull back while following so distant opponents remain easier to see.
  const minWidth = controlled ? 1200 : 900;
  const minHeight = controlled ? 760 : 570;
  const zoom = Math.min(
    width / Math.max(minWidth, right - left),
    height / Math.max(minHeight, bottom - top),
  );
  return { x, y, zoom, left, right, top, bottom };
}
