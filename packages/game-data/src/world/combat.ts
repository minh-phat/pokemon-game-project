import type { ArenaDefinition } from '@arena/shared-types';
import { createWorld, tileAt, WORLD_SIZE, type World, type Point } from './world';

const terrainWorlds = new WeakMap<ArenaDefinition, World>();

/** Uses the same bounded terrain chunk cache as exploration, never a full-world height array. */
export function sampleWorldBattleTerrain(arena: ArenaDefinition, x: number, depth: number) {
  const terrain = arena.worldTerrain;
  if (!terrain) return null;
  let world = terrainWorlds.get(arena);
  if (!world) {
    world = createWorld(terrain.seed);
    terrainWorlds.set(arena, world);
  }
  const point = worldBattlePoint(terrain.origin, x, depth);
  const tile = tileAt(world, point.x, point.y);
  return { point, tile, baseLevel: terrain.baseLevel };
}

/** Version 5 encounters roam the world; older tickets retain their original arena for replay. */
export function createRoamingWorldBattleArena(world: World, origin: Point): ArenaDefinition {
  const arena = createWorldBattleArena(world, origin);
  arena.worldTerrain = {
    seed: world.seed,
    origin: { x: origin.x, y: origin.y },
    baseLevel: tileAt(world, origin.x, origin.y)!.level,
  };
  const xCenter = 650 + (origin.y - origin.x) * 64;
  const depthStart = -100 - (origin.x + origin.y) * 32;
  arena.bounds = [xCenter - WORLD_SIZE * 64, xCenter + WORLD_SIZE * 64];
  arena.depthBounds = [depthStart, depthStart + WORLD_SIZE * 64];
  terrainWorlds.set(arena, world);
  return arena;
}

// The exploration renderer uses 16/8 isometric pixels and 8 pixels per elevation level.
// Combat sprites and hitboxes are displayed at 1/4 scale.
export const WORLD_COMBAT_SCALE = 0.25;
export function worldBattlePoint(origin: Point, x: number, depth: number): Point {
  const dx = (x - 650) / 64,
    dz = (depth + 100) / 32;
  return { x: origin.x + (dx + dz) / 2, y: origin.y + (dz - dx) / 2 };
}
export function createWorldBattleArena(world: World, origin: Point): ArenaDefinition {
  const base = tileAt(world, origin.x, origin.y)!.level;
  const left = Math.floor(origin.x) - 16,
    top = Math.floor(origin.y) - 16;
  const surface: NonNullable<ArenaDefinition['surface']> = {
    origin: {
      x: 650 + (left - origin.x - (top - origin.y)) * 64,
      depth: -100 + (left - origin.x + (top - origin.y)) * 32,
    },
    axisX: { x: 64, depth: 32 },
    axisZ: { x: -64, depth: 32 },
    columns: 33,
    rows: 33,
    heights: [],
    blocked: [],
    props: [],
    water: [],
    stepHeight: 32,
    climbHeight: 256,
  };
  for (let y = 0; y < 33; y++)
    for (let x = 0; x < 33; x++) {
      const tile = tileAt(world, left + x, top + y);
      surface.heights.push(((tile?.level ?? base) - base) * 32);
      surface.blocked.push(!tile || tile.lava || left + x <= 1 || top + y <= 1);
      surface.props!.push(
        Boolean(tile && ['tree', 'pine', 'rock'].includes(tile.decoration ?? '')),
      );
      surface.water!.push(Boolean(tile?.water));
    }
  return {
    id: 'forest',
    name: 'World terrain',
    subtitle: '',
    color: '#88bca2',
    width: 1200,
    ground: 520,
    bounds: [55, 1145],
    depthBounds: [-300, 200],
    spawns: [450, 650],
    spawnDepth: -100,
    layers: [],
    ambient: '/assets/forest.wav',
    surface,
  };
}
