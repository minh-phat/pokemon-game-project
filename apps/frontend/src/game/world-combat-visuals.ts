import type { ArenaDefinition } from '@arena/shared-types';
/** A uniform projection preserves arena hitboxes, jump heights and directional skill art. */
export const WORLD_COMBAT_HEIGHT_SCALE = 0.25;
export const WORLD_ARENA_VIEW = { width: 1200, height: 900, top: -120 } as const;
export type WorldArenaView = { left?: number; top: number; width: number; height: number };

/** Cover the world camera with a fixed-size render texture, even far from the encounter origin. */
export function worldArenaViewport(
  center: { x: number; y: number },
  width: number,
  height: number,
  aspect: number,
): WorldArenaView {
  const viewWidth = Math.max(width + 160, (height + 160) * aspect);
  const viewHeight = viewWidth / aspect;
  return {
    left: center.x - viewWidth / 2,
    top: center.y - viewHeight / 2,
    width: viewWidth,
    height: viewHeight,
  };
}

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
    left: 0,
    width: WORLD_ARENA_VIEW.width,
    top,
    height: Math.max(WORLD_ARENA_VIEW.height, 820 - Math.min(...heights) - top),
  };
}

export function worldArenaPlacement(x: number, y: number, view: WorldArenaView = WORLD_ARENA_VIEW) {
  const scale = WORLD_COMBAT_HEIGHT_SCALE;
  return {
    x: x + ((view.left ?? 0) - 650) * scale,
    y: y - (520 - 100 - view.top) * scale,
    width: view.width * scale,
    height: view.height * scale,
  };
}
