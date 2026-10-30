import type { BattleSnapshot } from '@arena/shared-types';
import { POKEMON } from '@arena/game-data';

/** Bounds include sprites, airborne movement, labels, and space around the action. */
export function automaticCameraFrame(
  snapshot: Pick<BattleSnapshot, 'fighters' | 'manualTeams' | 'controlledFighterIds'>,
  team: number,
  arena: { width: number; height?: number },
  width: number,
  height: number,
  space: 'arena' | 'world' = 'arena',
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
  let x = (left + right) / 2;
  let y = (top + bottom) / 2;
  // Pull back while following so distant opponents remain easier to see.
  const minWidth = controlled ? 1200 : 900;
  const minHeight = controlled ? 760 : 570;
  let zoom = Math.min(
    width / Math.max(minWidth, right - left),
    height / Math.max(minHeight, bottom - top),
  );
  // Following a single fighter must fill the viewport with arena artwork,
  // rather than reveal empty space beyond its edges on wide or tall screens.
  const bounded = controlled && space === 'arena';
  const minZoom = bounded ? Math.max(width / arena.width, height / (arena.height ?? 760)) : 0;
  zoom = Math.max(zoom, minZoom);
  if (bounded) {
    const halfWidth = width / (2 * zoom);
    const halfHeight = height / (2 * zoom);
    x = Math.max(halfWidth, Math.min(arena.width - halfWidth, x));
    y = Math.max(halfHeight, Math.min((arena.height ?? 760) - halfHeight, y));
  }
  return { x, y, zoom, minZoom, left, right, top, bottom };
}
