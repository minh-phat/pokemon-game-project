import type { ArenaDefinition } from '@arena/shared-types';
/** A uniform projection preserves arena hitboxes, jump heights and directional skill art. */
export const WORLD_COMBAT_HEIGHT_SCALE = 0.25;
export const WORLD_ARENA_VIEW = { width: 1200, height: 900, top: -120 } as const;

export function worldCombatOffset(x: number, depth: number, height = 0) {
  return {
    x: (x - 650) * WORLD_COMBAT_HEIGHT_SCALE,
    y: (depth + 100 - height) * WORLD_COMBAT_HEIGHT_SCALE,
  };
}

export function worldArenaView(arena?: ArenaDefinition) {
  const heights = arena?.surface?.heights ?? [0];
  const top = Math.min(WORLD_ARENA_VIEW.top, 220 - Math.max(...heights) - 180);
  return {
    width: WORLD_ARENA_VIEW.width,
    top,
    height: Math.max(WORLD_ARENA_VIEW.height, 820 - Math.min(...heights) - top),
  };
}

export function worldArenaPlacement(
  x: number,
  y: number,
  view: { width: number; height: number; top: number } = WORLD_ARENA_VIEW,
) {
  const scale = WORLD_COMBAT_HEIGHT_SCALE;
  return {
    x: x - 650 * scale,
    y: y - (520 - 100 - view.top) * scale,
    width: view.width * scale,
    height: view.height * scale,
  };
}
