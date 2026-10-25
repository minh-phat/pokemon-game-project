import {
  createWorld as createGeography,
  WORLD_SIZE as GEO_SIZE,
  FloodQueue,
  noise,
  hash,
  habitat,
  biomeNames,
  biomeColors,
  BIOMES,
  SEA,
  type World as Geography,
  type Tile as CoarseTile,
  type Point,
  type Biome,
  type Species,
  type WildPokemon as GeographicPokemon,
} from './geography';
export { hash, habitat, biomeNames, biomeColors, BIOMES, SEA };
export type { Point, Biome, Species };
import type { PetProgression } from '@arena/shared-types';
export type WildPokemon = GeographicPokemon & PetProgression;
export function wildProgression(world: World, id: number, position: Point): PetProgression {
  const distance = Math.hypot(position.x - world.spawn.x, position.y - world.spawn.y);
  const roll = hash(id, 991, world.seed);
  return {
    level:
      distance < 10
        ? 1
        : Math.min(60, 1 + Math.floor(distance / 180) + Math.floor(hash(id, 992, world.seed) * 4)),
    quality: roll < 0.6 ? 'C' : roll < 0.85 ? 'B' : roll < 0.96 ? 'A' : roll < 0.998 ? 'S' : 'SS',
  };
}

export const WORLD_SIZE = 8192;
export const METERS_PER_TILE = 2;
export const METERS_PER_LEVEL = 1;
export const MAX_TERRAIN_LEVEL = 64;
export const WALK_STEP = 1;
export const WORLD_KM = (WORLD_SIZE * METERS_PER_TILE) / 1000;
export const WORLD_AREA_KM2 = WORLD_KM ** 2;
export const TERRAIN_CHUNK_SIZE = 32;
export const TERRAIN_CACHE_LIMIT = 64;
export const WILDLIFE_CACHE_LIMIT = 25;
export const PATH_NODE_LIMIT = 6000;
const SCALE = WORLD_SIZE / GEO_SIZE;
export type Tile = CoarseTile & {
  prop: number;
  moisture: number;
  landform: 'plain' | 'hill' | 'valley' | 'ridge';
};
export type TerrainChunk = { x: number; y: number; tiles: Tile[] };
export type Landmark = Point & { biome: Biome };
export type World = {
  seed: number;
  geography: Geography;
  spawn: Point;
  chunks: Map<number, TerrainChunk>;
  wildlifeChunks: Map<number, WildPokemon[]>;
  wildlife: WildPokemon[];
  landmarks: Landmark[];
  wildlifeCenter: string;
  campLevel: number;
};
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const chunkKey = (x: number, y: number) => y * (WORLD_SIZE / TERRAIN_CHUNK_SIZE) + x;
function coarse(world: World, x: number, y: number) {
  return world.geography.tiles[clamp(y, 0, GEO_SIZE - 1) * GEO_SIZE + clamp(x, 0, GEO_SIZE - 1)];
}
function riverNode(world: World, tile: CoarseTile): Point {
  return {
    x: (tile.x + 0.5) * SCALE + (hash(tile.x, tile.y, world.seed + 71) - 0.5) * 10,
    y: (tile.y + 0.5) * SCALE + (hash(tile.x, tile.y, world.seed + 72) - 0.5) * 10,
  };
}
function nearestRiver(world: World, x: number, y: number) {
  const cx = Math.floor(x / SCALE),
    cy = Math.floor(y / SCALE);
  let distance = Infinity,
    height = 0,
    flow = 0,
    downstream = -1;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cell = coarse(world, cx + dx, cy + dy);
      if (cell.biome !== 'river' || cell.downstream < 0) continue;
      const next = world.geography.tiles[cell.downstream];
      const a = riverNode(world, cell),
        b = riverNode(world, next);
      const vx = b.x - a.x,
        vy = b.y - a.y;
      const t = clamp(((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1), 0, 1);
      const d = Math.hypot(x - a.x - vx * t, y - a.y - vy * t);
      if (d < distance) {
        distance = d;
        height = mix(cell.height, next.height, t);
        flow = cell.flow;
        downstream = cell.downstream;
      }
    }
  return { distance, height, flow, downstream, width: Math.min(8, 0.5 + Math.sqrt(flow) * 0.1) };
}

/** Absolute coordinates only: the same tile is identical after eviction and at every seam. */
export function sampleTerrain(world: World, x: number, y: number): Tile {
  x = Math.floor(x);
  y = Math.floor(y);
  const gx = (x + 0.5) / SCALE - 0.5,
    gy = (y + 0.5) / SCALE - 0.5;
  const ix = Math.floor(gx),
    iy = Math.floor(gy),
    fx = gx - ix,
    fy = gy - iy;
  const a = coarse(world, ix, iy),
    b = coarse(world, ix + 1, iy),
    c = coarse(world, ix, iy + 1),
    d = coarse(world, ix + 1, iy + 1);
  const base = mix(mix(a.height, b.height, fx), mix(c.height, d.height, fx), fy);
  let height = base + (noise(x / 23, y / 23, world.seed + 13) - 0.5) * 0.012;
  const moisture = noise(x / (18 * SCALE), y / (18 * SCALE), world.seed + 109);
  const river = nearestRiver(world, x + 0.5, y + 0.5);
  const volcanicWeight = mix(
    mix(Number(a.biome === 'volcano'), Number(b.biome === 'volcano'), fx),
    mix(Number(c.biome === 'volcano'), Number(d.biome === 'volcano'), fx),
    fy,
  );
  const lavaWeight = mix(
    mix(Number(a.lava), Number(b.lava), fx),
    mix(Number(c.lava), Number(d.lava), fx),
    fy,
  );
  const volcano = volcanicWeight > 0.45 + noise(x / 18, y / 18, world.seed + 15) * 0.12;
  const lava = volcano && lavaWeight > 0.5 && noise(x / 16, y / 16, world.seed + 14) > 0.25;
  if (!volcano && river.distance < river.width + 5) {
    const bank = clamp((river.distance - river.width) / 5, 0, 1);
    height = mix(river.height, Math.max(height, river.height + 0.008), bank);
  }
  let biome: Biome =
    height <= SEA
      ? 'ocean'
      : volcano
        ? 'volcano'
        : height > 0.66
          ? 'snow'
          : height > 0.47
            ? 'mountain'
            : height < SEA + 0.013
              ? 'beach'
              : moisture > 0.47
                ? 'forest'
                : 'meadow';
  if (!volcano && biome !== 'ocean' && river.distance <= river.width) biome = 'river';
  const water = biome === 'ocean' || biome === 'river';
  // Local relief is measured in meters, independent of the continental biome mask.
  // Terraces are 4 m high; narrow smooth bands provide walkable switchback routes.
  const hillNoise =
    noise(x / 17, y / 17, world.seed + 610) * 0.62 + noise(x / 39, y / 39, world.seed + 611) * 0.38;
  const rugged = biome === 'mountain' || biome === 'snow' || biome === 'volcano';
  const rawRelief = Math.max(0, hillNoise - 0.18) * (rugged ? 38 : 25);
  const ramp = clamp(
    (0.42 - Math.abs(Math.sin((x + y * 0.55) / 12 + noise(x / 70, y / 70, world.seed + 612) * 5))) /
      0.3,
    0,
    1,
  );
  const relief = mix(Math.floor(rawRelief / 4) * 4, rawRelief, ramp);
  const coastalFade = clamp((height - SEA - 0.013) / 0.04, 0, 1);
  const valleyFade = clamp((river.distance - river.width - 2) / 16, 0, 1);
  let level =
    biome === 'ocean'
      ? 0
      : Math.max(
          1,
          Math.round((height - SEA) * 42 + (water ? 0 : relief * coastalFade * valleyFade)),
        );
  const campDistance = Math.hypot(x + 0.5 - world.spawn.x, y + 0.5 - world.spawn.y);
  if (!water && world.campLevel >= 0 && campDistance < 7)
    level = Math.round(mix(world.campLevel, level, clamp((campDistance - 3) / 4, 0, 1)));
  level = clamp(level, 0, MAX_TERRAIN_LEVEL);
  const landform: Tile['landform'] =
    biome === 'river'
      ? 'valley'
      : !water && coastalFade > 0.5
        ? valleyFade < 0.8
          ? 'valley'
          : rugged
            ? 'ridge'
            : rawRelief > 4
              ? 'hill'
              : 'plain'
        : 'plain';
  const variant = hash(x, y, world.seed + 41);
  const clearing = Math.hypot(x + 0.5 - world.spawn.x, y + 0.5 - world.spawn.y) < 4;
  let decoration: Tile['decoration'] = null,
    prop = -1;
  if (!water && !lava && !clearing) {
    const spaced = x % 2 === 0 && y % 2 === 0;
    const detail = hash(x, y, world.seed + 42);
    if (biome === 'forest' && spaced && variant < 0.43) {
      decoration = 'tree';
      prop = detail < 0.24 ? 1 : detail < 0.4 ? 2 : 0;
    } else if (biome === 'meadow' && spaced && variant < 0.14) {
      decoration = 'tree';
      prop = detail < 0.2 ? 5 : detail < 0.6 ? 1 : 0;
    } else if (biome === 'snow' && spaced && variant < 0.2) {
      decoration = 'pine';
      prop = 3;
    } else if (biome === 'mountain' && spaced && variant < 0.1) {
      decoration = 'pine';
      prop = 2;
    } else if (biome === 'beach' && spaced && variant < 0.045) {
      decoration = 'tree';
      prop = 7;
    } else if (
      (biome === 'mountain' || biome === 'volcano' || biome === 'snow') &&
      variant < 0.055
    ) {
      decoration = 'rock';
      prop = biome === 'volcano' ? 9 : biome === 'snow' ? 10 : 8;
    } else if ((biome === 'forest' || biome === 'meadow') && variant > 0.89) {
      decoration = 'flower';
      prop = biome === 'forest' ? (detail < 0.35 ? 6 : 15) : 13;
    } else if ((biome === 'forest' || biome === 'meadow') && variant > 0.73) {
      decoration = 'grass';
      prop = 12;
    } else if (biome === 'forest' && variant < 0.025) {
      decoration = 'rock';
      prop = 11;
    }
    if (
      (biome === 'meadow' || biome === 'forest') &&
      river.distance < river.width + 3 &&
      variant > 0.6
    ) {
      decoration = 'grass';
      prop = 14;
    }
    if (
      (biome === 'meadow' || biome === 'forest') &&
      river.distance < river.width + 5 &&
      spaced &&
      variant < 0.1
    ) {
      decoration = 'tree';
      prop = 4;
    }
  }
  return {
    x,
    y,
    height,
    level,
    landform,
    biome,
    flow: river.flow,
    downstream: river.downstream,
    water,
    lava,
    decoration,
    prop,
    moisture,
    variant,
  };
}
export function getTerrainChunk(world: World, cx: number, cy: number): TerrainChunk {
  const key = chunkKey(cx, cy),
    existing = world.chunks.get(key);
  if (existing) {
    world.chunks.delete(key);
    world.chunks.set(key, existing);
    return existing;
  }
  const tiles: Tile[] = [];
  for (let y = 0; y < TERRAIN_CHUNK_SIZE; y++)
    for (let x = 0; x < TERRAIN_CHUNK_SIZE; x++)
      tiles.push(sampleTerrain(world, cx * TERRAIN_CHUNK_SIZE + x, cy * TERRAIN_CHUNK_SIZE + y));
  const chunk = { x: cx, y: cy, tiles };
  world.chunks.set(key, chunk);
  if (world.chunks.size > TERRAIN_CACHE_LIMIT)
    world.chunks.delete(world.chunks.keys().next().value!);
  return chunk;
}
export function tileAt(world: World, x: number, y: number): Tile | undefined {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0 ||
    x >= WORLD_SIZE ||
    y >= WORLD_SIZE
  )
    return;
  x = Math.floor(x);
  y = Math.floor(y);
  const chunk = getTerrainChunk(
    world,
    Math.floor(x / TERRAIN_CHUNK_SIZE),
    Math.floor(y / TERRAIN_CHUNK_SIZE),
  );
  return chunk.tiles[(y % TERRAIN_CHUNK_SIZE) * TERRAIN_CHUNK_SIZE + (x % TERRAIN_CHUNK_SIZE)];
}
export function traversable(world: World, x: number, y: number) {
  if (x <= 1 || y <= 1 || x >= WORLD_SIZE - 2 || y >= WORLD_SIZE - 2) return false;
  const tile = tileAt(world, x, y);
  const solid =
    tile?.decoration === 'tree' || tile?.decoration === 'pine' || tile?.decoration === 'rock';
  return Boolean(
    tile &&
      !tile.lava &&
      !(solid && Math.hypot(x - Math.floor(x) - 0.5, y - Math.floor(y) - 0.5) < 0.24),
  );
}
export function canWalkBetween(world: World, from: Point, to: Point) {
  const a = tileAt(world, from.x, from.y),
    b = tileAt(world, to.x, to.y);
  return Boolean(
    a && b && traversable(world, to.x, to.y) && Math.abs(a.level - b.level) <= WALK_STEP,
  );
}
export function findSafePosition(world: World, point: Point, wanted?: Biome): Point | null {
  for (let radius = 0; radius <= 24; radius++)
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const x = Math.floor(point.x) + dx + 0.5,
          y = Math.floor(point.y) + dy + 0.5;
        if (x <= 1 || y <= 1 || x >= WORLD_SIZE - 2 || y >= WORLD_SIZE - 2) continue;
        const tile = sampleTerrain(world, x, y);
        const solid =
          tile.decoration === 'tree' || tile.decoration === 'pine' || tile.decoration === 'rock';
        if ((!wanted || tile.biome === wanted) && !tile.lava && !solid) return { x, y };
      }
  return null;
}
export function createWorld(seed: number): World {
  const geography = createGeography(seed >>> 0);
  const world: World = {
    seed: seed >>> 0,
    geography,
    spawn: { x: -100, y: -100 },
    chunks: new Map(),
    wildlifeChunks: new Map(),
    wildlife: [],
    landmarks: [],
    wildlifeCenter: '',
    campLevel: -1,
  };
  const candidates = geography.tiles
    .filter((t) => t.biome === 'meadow')
    .sort(
      (a, b) =>
        Math.hypot(a.x - GEO_SIZE * 0.48, a.y - GEO_SIZE * 0.58) -
        Math.hypot(b.x - GEO_SIZE * 0.48, b.y - GEO_SIZE * 0.58),
    );
  for (const t of candidates) {
    const cx = (t.x + 0.5) * SCALE,
      cy = (t.y + 0.5) * SCALE;
    if (nearestRiver(world, cx, cy).distance > 36) continue;
    const position = findSafePosition(world, { x: cx, y: cy }, 'meadow');
    if (position) {
      world.spawn = position;
      break;
    }
  }
  if (world.spawn.x < 0)
    world.spawn = findSafePosition(
      world,
      { x: geography.spawn.x * SCALE, y: geography.spawn.y * SCALE },
      'meadow',
    )!;
  world.campLevel = sampleTerrain(world, world.spawn.x, world.spawn.y).level;
  world.chunks.clear();
  for (const biome of BIOMES) {
    if (biome === 'meadow') {
      world.landmarks.push({ ...world.spawn, biome });
      continue;
    }
    const cells = geography.tiles
      .filter((t) => t.biome === biome && !t.lava)
      .sort(
        (a, b) =>
          Math.hypot(a.x * SCALE - world.spawn.x, a.y * SCALE - world.spawn.y) -
          Math.hypot(b.x * SCALE - world.spawn.x, b.y * SCALE - world.spawn.y),
      );
    for (const cell of cells.slice(0, 128)) {
      const point =
        biome === 'river'
          ? riverNode(world, cell)
          : { x: (cell.x + 0.5) * SCALE, y: (cell.y + 0.5) * SCALE };
      const position = findSafePosition(world, point, biome);
      if (position) {
        world.landmarks.push({ ...position, biome });
        break;
      }
    }
  }
  world.chunks.clear();
  syncWildlife(world, world.spawn);
  return world;
}
function spawnWildlife(world: World, cx: number, cy: number) {
  const animals: WildPokemon[] = [];
  const originX = cx * TERRAIN_CHUNK_SIZE,
    originY = cy * TERRAIN_CHUNK_SIZE;
  for (let slot = 0; slot < 6; slot++) {
    const x = originX + 3 + Math.floor(hash(cx * 6 + slot, cy, world.seed + 200) * 25) + 0.5;
    const y = originY + 3 + Math.floor(hash(cx, cy * 6 + slot, world.seed + 201) * 25) + 0.5;
    const tile = tileAt(world, x, y);
    if (!tile || tile.lava) continue;
    const species: Species =
      tile.water || tile.biome === 'beach'
        ? 'squirtle'
        : tile.biome === 'volcano' || tile.biome === 'mountain'
          ? 'charmander'
          : tile.biome === 'snow'
            ? 'eevee'
            : tile.biome === 'forest'
              ? 'bulbasaur'
              : hash(cx, slot, world.seed) > 0.5
                ? 'pikachu'
                : 'eevee';
    const count =
      hash(cx + slot, cy, world.seed + 202) > 0.48
        ? 3 + Math.floor(hash(cx, cy + slot, world.seed + 203) * 3)
        : 1;
    const leader = chunkKey(cx, cy) * 64 + slot * 6;
    for (let j = 0; j < count; j++) {
      const px = x + (j % 3) * 0.65,
        py = y + Math.floor(j / 3) * 0.65;
      const ground = tileAt(world, px, py);
      if (!ground || !habitat(species, ground)) continue;
      animals.push({
        id: leader + j,
        ...wildProgression(world, leader + j, { x: cx * 32 + 16, y: cy * 32 + 16 }),
        x: px,
        y: py,
        species,
        group: leader,
        leader,
        home: { x, y },
        phase: hash(leader, j, world.seed) * Math.PI * 2,
        moving: false,
        facing: 1,
      });
    }
  }
  if (Math.floor(world.spawn.x / 32) === cx && Math.floor(world.spawn.y / 32) === cy) {
    const leader = chunkKey(cx, cy) * 64 + 48;
    for (let j = 0; j < 3; j++) {
      const candidate = { x: world.spawn.x + 1.5 + j * 0.5, y: world.spawn.y + 1 };
      const position = habitat('pikachu', sampleTerrain(world, candidate.x, candidate.y))
        ? candidate
        : { x: world.spawn.x - 0.2 + j * 0.2, y: world.spawn.y };
      animals.push({
        id: leader + j,
        ...wildProgression(world, leader + j, { x: cx * 32 + 16, y: cy * 32 + 16 }),
        ...position,
        level: 1,
        quality: 'C',
        species: 'pikachu',
        group: leader,
        leader,
        home: { ...world.spawn },
        phase: j,
        moving: false,
        facing: 1,
      });
    }
  }
  return animals;
}
export function syncWildlife(world: World, player: Point) {
  const cx = Math.floor(player.x / TERRAIN_CHUNK_SIZE),
    cy = Math.floor(player.y / TERRAIN_CHUNK_SIZE),
    center = `${cx},${cy}`;
  if (world.wildlifeCenter === center) return;
  world.wildlifeCenter = center;
  const actors: WildPokemon[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx,
        y = cy + dy;
      if (x < 0 || y < 0 || x >= WORLD_SIZE / 32 || y >= WORLD_SIZE / 32) continue;
      const key = chunkKey(x, y);
      const existing = world.wildlifeChunks.get(key) ?? spawnWildlife(world, x, y);
      world.wildlifeChunks.delete(key);
      world.wildlifeChunks.set(key, existing);
      actors.push(...existing);
    }
  while (world.wildlifeChunks.size > WILDLIFE_CACHE_LIMIT)
    world.wildlifeChunks.delete(world.wildlifeChunks.keys().next().value!);
  world.wildlife = actors;
}
export function updateWildlife(world: World, player: Point, dt: number, time: number) {
  syncWildlife(world, player);
  const byId = new Map(world.wildlife.map((a) => [a.id, a]));
  const near = world.wildlife
    .filter((a) => Math.abs(a.x - player.x) < 30 && Math.abs(a.y - player.y) < 30)
    .sort(
      (a, b) =>
        Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y),
    )
    .slice(0, 80);
  for (const actor of near) {
    const leader = byId.get(actor.leader),
      following = leader && leader !== actor;
    const tx = following
      ? leader.x + Math.cos(actor.phase)
      : actor.home.x + Math.cos(time * 0.14 + actor.phase) * 2.8;
    const ty = following
      ? leader.y + Math.sin(actor.phase)
      : actor.home.y + Math.sin(time * 0.11 + actor.phase) * 2.8;
    const dx = tx - actor.x,
      dy = ty - actor.y,
      length = Math.hypot(dx, dy);
    actor.moving = length > 0.3 && Boolean(following || Math.sin(time * 0.6 + actor.phase) > -0.4);
    if (!actor.moving) continue;
    const step = Math.min(length, dt * (following ? 0.9 : 0.65));
    const x = actor.x + (dx / length) * step,
      y = actor.y + (dy / length) * step,
      tile = tileAt(world, x, y);
    if (tile && habitat(actor.species, tile) && canWalkBetween(world, actor, { x, y })) {
      actor.x = x;
      actor.y = y;
      actor.facing = dx - dy >= 0 ? 1 : -1;
    } else actor.moving = false;
  }
  return near.length;
}

/** A* visits a bounded local area; never allocates WORLD_SIZE squared arrays. */
export function findPath(world: World, from: Point, to: Point): Point[] {
  if (Math.hypot(from.x - to.x, from.y - to.y) > 96 || !traversable(world, to.x, to.y)) return [];
  const start = Math.floor(from.y) * WORLD_SIZE + Math.floor(from.x),
    goal = Math.floor(to.y) * WORLD_SIZE + Math.floor(to.x);
  const costs = new Map<number, number>([[start, 0]]),
    previous = new Map<number, number>(),
    closed = new Set<number>(),
    queue = new FloodQueue();
  queue.push(start, 0);
  while (queue.heap.length && closed.size < PATH_NODE_LIMIT) {
    const { id } = queue.pop();
    if (closed.has(id)) continue;
    closed.add(id);
    if (id === goal) {
      const path: Point[] = [];
      let current = goal;
      while (current !== start) {
        path.push({ x: (current % WORLD_SIZE) + 0.5, y: Math.floor(current / WORLD_SIZE) + 0.5 });
        current = previous.get(current)!;
      }
      return path.reverse();
    }
    const x = id % WORLD_SIZE,
      y = Math.floor(id / WORLD_SIZE);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (
        Math.abs(nx - from.x) > 100 ||
        Math.abs(ny - from.y) > 100 ||
        !canWalkBetween(world, { x: x + 0.5, y: y + 0.5 }, { x: nx + 0.5, y: ny + 0.5 })
      )
        continue;
      const next = ny * WORLD_SIZE + nx,
        cost = costs.get(id)! + (tileAt(world, nx, ny)!.water ? 1.5 : 1);
      if (cost >= (costs.get(next) ?? Infinity)) continue;
      costs.set(next, cost);
      previous.set(next, id);
      queue.push(next, cost + Math.abs(nx - Math.floor(to.x)) + Math.abs(ny - Math.floor(to.y)));
    }
  }
  return [];
}
export const SAVE_KEY = 'arena-open-world-v2';
export const LEGACY_SAVE_KEY = 'arena-open-world-v1';
export type WorldSave = {
  version: 2;
  seed: number;
  player: Point;
  seen: Species[];
  visited: Biome[];
};
export function parseWorldSave(raw: string | null): WorldSave | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (
      ![1, 2].includes(s?.version) ||
      !Number.isInteger(s.seed) ||
      s.seed < 0 ||
      s.seed > 0xffffffff ||
      !Number.isFinite(s.player?.x) ||
      !Number.isFinite(s.player?.y) ||
      !Array.isArray(s.seen) ||
      !Array.isArray(s.visited)
    )
      return null;
    const limit = s.version === 1 ? 160 : WORLD_SIZE;
    if (s.player.x < 1 || s.player.y < 1 || s.player.x >= limit - 2 || s.player.y >= limit - 2)
      return null;
    const player = s.version === 1 ? { x: -1, y: -1 } : { x: s.player.x, y: s.player.y };
    const species: Species[] = ['pikachu', 'bulbasaur', 'squirtle', 'charmander', 'eevee'];
    return {
      version: 2,
      seed: s.seed,
      player,
      seen: species.filter((v) => s.seen.includes(v)),
      visited: BIOMES.filter((v) => s.visited.includes(v)),
    };
  } catch {
    return null;
  }
}
