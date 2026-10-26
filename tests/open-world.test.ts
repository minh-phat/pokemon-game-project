import { describe, expect, it } from 'vitest';
import {
  BIOMES,
  SEA,
  WORLD_SIZE,
  WORLD_AREA_KM2,
  METERS_PER_TILE,
  TERRAIN_CACHE_LIMIT,
  WILDLIFE_CACHE_LIMIT,
  createWorld,
  findPath,
  habitat,
  parseWorldSave,
  sampleTerrain,
  tileAt,
  traversable,
  updateWildlife,
  syncWildlife,
  getTerrainChunk,
} from '@arena/game-data/world';

describe('continental geography and streaming', () => {
  it.each([0, 1, 42, 90210, 4294967295])(
    'seed %s has all regions and downhill drainage without allocating the continent',
    (seed) => {
      const world = createWorld(seed);
      expect(WORLD_SIZE).toBe(8192);
      expect(METERS_PER_TILE).toBe(2);
      expect(WORLD_AREA_KM2).toBeCloseTo(268.435456);
      expect(world.geography.tiles).toHaveLength(256 ** 2);
      expect('tiles' in world).toBe(false);
      expect(new Set(world.landmarks.map((l) => l.biome))).toEqual(new Set(BIOMES));
      expect(world.chunks.size).toBeLessThanOrEqual(TERRAIN_CACHE_LIMIT);
      expect(tileAt(world, world.spawn.x, world.spawn.y)?.biome).toBe('meadow');
      expect(traversable(world, world.spawn.x, world.spawn.y)).toBe(true);
      for (const actor of world.wildlife) {
        expect(habitat(actor.species, tileAt(world, actor.x, actor.y)!)).toBe(true);
        expect(world.wildlife.some((other) => other.id === actor.leader)).toBe(true);
      }
      for (const landmark of world.landmarks) {
        expect(tileAt(world, landmark.x, landmark.y)?.biome).toBe(landmark.biome);
        expect(traversable(world, landmark.x, landmark.y)).toBe(true);
      }
      for (const source of world.geography.tiles.filter((t) => t.biome === 'river')) {
        let t = source,
          steps = 0;
        while (t.downstream >= 0) {
          const next = world.geography.tiles[t.downstream];
          expect(next.height).toBeLessThanOrEqual(t.height);
          expect(next.flow).toBeGreaterThanOrEqual(t.flow);
          expect(next.water).toBe(true);
          t = next;
          if (++steps > 256 ** 2) throw new Error('Drainage cycle');
        }
        expect(t.height).toBeLessThanOrEqual(SEA);
      }
    },
  );
  it.each([0, 1, 42, 90210, 4294967295])(
    'seed %s has broad irregular continents, varied islands and open sea',
    (seed) => {
      const world = createWorld(seed);
      const tiles = world.geography.tiles;
      const seen = new Set<number>();
      const islands: {
        size: number;
        snow: number;
        volcano: number;
        peak: number;
        perimeter: number;
        bounds: number[];
      }[] = [];
      for (let start = 0; start < tiles.length; start++) {
        if (seen.has(start) || tiles[start].height <= SEA) continue;
        const stack = [start];
        seen.add(start);
        const island = {
          size: 0,
          snow: 0,
          volcano: 0,
          peak: 0,
          perimeter: 0,
          bounds: [256, 256, 0, 0],
        };
        while (stack.length) {
          const id = stack.pop()!;
          const tile = tiles[id];
          island.size++;
          island.bounds[0] = Math.min(island.bounds[0], tile.x);
          island.bounds[1] = Math.min(island.bounds[1], tile.y);
          island.bounds[2] = Math.max(island.bounds[2], tile.x);
          island.bounds[3] = Math.max(island.bounds[3], tile.y);
          for (const [dx, dy] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]) {
            const neighbor = tiles[(tile.y + dy) * 256 + tile.x + dx];
            if (!neighbor || neighbor.height <= SEA) island.perimeter++;
          }
          island.snow += Number(tile.biome === 'snow');
          island.volcano += Number(tile.biome === 'volcano');
          island.peak = Math.max(island.peak, tile.height);
          // Include diagonal contacts: even a corner bridge would join the islands.
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const x = tile.x + dx,
                y = tile.y + dy;
              if (x < 0 || y < 0 || x >= 256 || y >= 256) continue;
              const next = y * 256 + x;
              if (seen.has(next) || tiles[next].height <= SEA) continue;
              seen.add(next);
              stack.push(next);
            }
        }
        islands.push(island);
      }
      islands.sort((a, b) => b.size - a.size);
      const continents = islands.filter((island) => island.size > 6000);
      expect(continents).toHaveLength(2);
      expect(
        islands.filter((island) => island.size >= 200 && island.size < 2000).length,
      ).toBeGreaterThanOrEqual(2);
      expect(
        islands.filter((island) => island.size >= 10 && island.size < 200).length,
      ).toBeGreaterThanOrEqual(2);
      for (const continent of continents) {
        expect(continent.snow).toBeGreaterThan(100);
        expect(continent.volcano).toBeGreaterThan(50);
        // A circle has compactness 1: long coastlines and deep bays lower it.
        expect((4 * Math.PI * continent.size) / continent.perimeter ** 2).toBeLessThan(0.35);
        const [left, top, right, bottom] = continent.bounds;
        expect(continent.size / ((right - left + 1) * (bottom - top + 1))).toBeLessThan(0.7);
      }
      expect(islands[0].size / seen.size).toBeGreaterThan(0.4);
      expect(islands[0].size / islands[2].size).toBeGreaterThan(6);
      expect(seen.size / tiles.length).toBeGreaterThan(0.3);
      expect(seen.size / tiles.length).toBeLessThan(0.5);
      for (const tile of tiles.filter((t) => t.x === 0 || t.y === 0 || t.x === 255 || t.y === 255))
        expect(tile.biome).toBe('ocean');
      for (const tile of tiles.filter((tile) => tile.lava)) {
        expect(tile.biome).toBe('volcano');
        expect(tile.water).toBe(false);
      }
    },
  );
  it('recreates identical chunks after eviction with seamless absolute-coordinate samples', () => {
    const world = createWorld(42);
    const original = structuredClone(getTerrainChunk(world, 100, 100));
    for (let i = 0; i < 90; i++) getTerrainChunk(world, i * 2, 10);
    expect(world.chunks.size).toBe(TERRAIN_CACHE_LIMIT);
    expect(getTerrainChunk(world, 100, 100)).toEqual(original);
    for (const x of [31, 32, 4095, 4096, 8190])
      for (const y of [31, 32, 4095, 4096, 8190]) {
        expect(tileAt(world, x, y)).toEqual(sampleTerrain(world, x, y));
      }
    expect(tileAt(world, -1, 5)).toBeUndefined();
    expect(tileAt(world, WORLD_SIZE, 5)).toBeUndefined();
    expect(tileAt(world, NaN, 5)).toBeUndefined();
  });
  it('reproduces terrain by seed and varies detail across distant parts of the continent', () => {
    const a = createWorld(42),
      b = createWorld(42),
      c = createWorld(43);
    expect(a.spawn).toEqual(b.spawn);
    expect(a.landmarks).toEqual(b.landmarks);
    const points = [
      [3000, 3000],
      [4096, 4096],
      [7000, 6000],
    ];
    expect(points.map(([x, y]) => sampleTerrain(a, x, y))).toEqual(
      points.map(([x, y]) => sampleTerrain(b, x, y)),
    );
    expect(points.map(([x, y]) => sampleTerrain(a, x, y))).not.toEqual(
      points.map(([x, y]) => sampleTerrain(c, x, y)),
    );
  });
  it('bounds pathfinding and routes around trunks', () => {
    const world = createWorld(42),
      from = world.spawn;
    let destination = { x: from.x + 8, y: from.y + 4 };
    while (!traversable(world, destination.x, destination.y)) destination.x++;
    const path = findPath(world, from, destination);
    expect(path.at(-1)).toEqual(destination);
    expect(path.every((p) => traversable(world, p.x, p.y))).toBe(true);
    expect(findPath(world, from, { x: from.x + 500, y: from.y })).toEqual([]);
    expect(findPath(world, from, { x: -1, y: 0 })).toEqual([]);
  });
});

describe('streamed wildlife and save migration', () => {
  it('has solitary animals and herds, and never retains populations from the entire world', () => {
    const world = createWorld(42),
      groups = new Map<number, number>();
    for (const a of world.wildlife) {
      expect(habitat(a.species, tileAt(world, a.x, a.y)!)).toBe(true);
      expect(world.wildlife.some((b) => b.id === a.leader)).toBe(true);
      groups.set(a.group, (groups.get(a.group) ?? 0) + 1);
    }
    expect([...groups.values()].some((n) => n === 1)).toBe(true);
    expect([...groups.values()].some((n) => n >= 3)).toBe(true);
    for (const p of world.landmarks) {
      syncWildlife(world, p);
      for (let i = 0; i < 20; i++)
        expect(updateWildlife(world, p, 0.1, i * 0.1)).toBeLessThanOrEqual(80);
      expect(world.wildlifeChunks.size).toBeLessThanOrEqual(WILDLIFE_CACHE_LIMIT);
      expect(world.wildlife.length).toBeLessThanOrEqual(9 * 6 * 5 + 3);
      for (const a of world.wildlife)
        expect(habitat(a.species, tileAt(world, a.x, a.y)!)).toBe(true);
    }
  });
  it('validates kilometer-scale positions and migrates the previous journal without overwriting it', () => {
    const good = {
      version: 2,
      seed: 42,
      player: { x: 4500.5, y: 5000.5 },
      seen: ['pikachu', 'invalid'],
      visited: ['snow', 'invalid'],
    };
    expect(parseWorldSave(JSON.stringify(good))).toEqual({
      ...good,
      seen: ['pikachu'],
      visited: ['snow'],
    });
    expect(
      parseWorldSave(JSON.stringify({ ...good, version: 1, player: { x: 80.5, y: 90.5 } })),
    ).toEqual({ ...good, player: { x: -1, y: -1 }, seen: ['pikachu'], visited: ['snow'] });
    for (const raw of [
      null,
      '{}',
      '{broken',
      JSON.stringify({ ...good, version: 3 }),
      JSON.stringify({ ...good, seed: -1 }),
      JSON.stringify({ ...good, player: { x: 8192, y: 200 } }),
      JSON.stringify({ ...good, seen: null }),
    ])
      expect(parseWorldSave(raw)).toBeNull();
  });
});
