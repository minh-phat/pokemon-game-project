/** Coarse continental height field and drainage graph. Never expanded to full world resolution. */
export const WORLD_SIZE = 256;
export const SEA = 0.19;
export const BIOMES = [
  'ocean',
  'beach',
  'meadow',
  'forest',
  'mountain',
  'snow',
  'volcano',
  'river',
] as const;
export type Biome = (typeof BIOMES)[number];
export type Species = 'pikachu' | 'bulbasaur' | 'squirtle' | 'charmander' | 'eevee';
export type Point = { x: number; y: number };
export type Tile = {
  x: number;
  y: number;
  height: number;
  level: number;
  biome: Biome;
  flow: number;
  downstream: number;
  water: boolean;
  lava: boolean;
  decoration: 'tree' | 'pine' | 'rock' | 'grass' | 'flower' | null;
  variant: number;
};
export type WildPokemon = Point & {
  id: number;
  species: Species;
  group: number;
  leader: number;
  home: Point;
  phase: number;
  moving: boolean;
  facing: number;
};
export type World = { seed: number; tiles: Tile[]; spawn: Point; wildlife: WildPokemon[] };
export const biomeNames: Record<Biome, [string, string]> = {
  ocean: ['Biển ngọc lam', 'Turquoise sea'],
  beach: ['Bờ cát vàng', 'Golden shore'],
  meadow: ['Đồng cỏ ban mai', 'Dawn meadows'],
  forest: ['Rừng thì thầm', 'Whispering woods'],
  mountain: ['Dãy núi đá', 'Stone highlands'],
  snow: ['Đỉnh tuyết trắng', 'Snowcap peaks'],
  volcano: ['Miệng núi lửa', 'Ember caldera'],
  river: ['Dòng nước bạc', 'Silver waters'],
};
export const biomeColors: Record<Biome, string> = {
  ocean: '#327e9b',
  beach: '#dfcc8b',
  meadow: '#88af5b',
  forest: '#51865a',
  mountain: '#93998b',
  snow: '#dbe9e5',
  volcano: '#675862',
  river: '#56aaa8',
};
export function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x ^ seed, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  return mix(
    mix(hash(ix, iy, seed), hash(ix + 1, iy, seed), u),
    mix(hash(ix, iy + 1, seed), hash(ix + 1, iy + 1, seed), u),
    v,
  );
}
// A small priority queue keeps drainage construction O(n log n), including depressions.
export class FloodQueue {
  heap: { id: number; h: number }[] = [];
  push(id: number, h: number) {
    const node = { id, h };
    let i = this.heap.length;
    this.heap.push(node);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].h <= h) break;
      this.heap[i] = this.heap[p];
      i = p;
    }
    this.heap[i] = node;
  }
  pop() {
    const root = this.heap[0],
      last = this.heap.pop()!;
    if (this.heap.length) {
      let i = 0;
      while (i * 2 + 1 < this.heap.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.heap.length && this.heap[c + 1].h < this.heap[c].h) c++;
        if (this.heap[c].h >= last.h) break;
        this.heap[i] = this.heap[c];
        i = c;
      }
      this.heap[i] = last;
    }
    return root;
  }
}
export function tileAt(world: World, x: number, y: number): Tile | undefined {
  if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return;
  return world.tiles[Math.floor(y) * WORLD_SIZE + Math.floor(x)];
}
export function traversable(world: World, x: number, y: number) {
  const tile = tileAt(world, x, y);
  const solid =
    tile?.decoration === 'tree' || tile?.decoration === 'pine' || tile?.decoration === 'rock';
  if (solid && Math.hypot(x - Math.floor(x) - 0.5, y - Math.floor(y) - 0.5) < 0.24) return false;
  return Boolean(tile && !tile.lava && x > 1 && y > 1 && x < WORLD_SIZE - 2 && y < WORLD_SIZE - 2);
}
export function habitat(species: Species, tile: Tile) {
  if (tile.lava) return false;
  if (species === 'squirtle') return tile.water || tile.biome === 'beach';
  if (tile.water) return false;
  if (species === 'charmander') return tile.biome === 'volcano' || tile.biome === 'mountain';
  if (species === 'bulbasaur') return tile.biome === 'forest' || tile.biome === 'meadow';
  if (species === 'pikachu') return tile.biome === 'meadow' || tile.biome === 'forest';
  return tile.biome !== 'volcano';
}
export function createWorld(inputSeed: number): World {
  const seed = inputSeed >>> 0;
  const n = WORLD_SIZE,
    tiles: Tile[] = [],
    volcanic = new Uint8Array(n * n);
  const snowX = 0.29 + hash(1, 1, seed) * 0.12,
    snowY = 0.24 + hash(2, 1, seed) * 0.1;
  const volcanoX = 0.67 + hash(3, 1, seed) * 0.09,
    volcanoY = 0.38 + hash(4, 1, seed) * 0.12;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = x / n,
        v = y / n;
      const radius = Math.hypot((u - 0.5) * 1.9, (v - 0.51) * 1.95);
      const continental = Math.max(0, 1 - radius * radius);
      const mountain = Math.exp(-((u - snowX) ** 2 / 0.016 + (v - snowY) ** 2 / 0.025));
      const cone = Math.max(0, 1 - Math.hypot(u - volcanoX, v - volcanoY) / 0.145);
      const h =
        0.015 +
        continental * 0.36 +
        mountain * 0.57 +
        cone * 0.49 +
        (noise(x / 24, y / 24, seed) - 0.5) * 0.12 +
        (noise(x / 8, y / 8, seed + 13) - 0.5) * 0.035;
      volcanic[y * n + x] = cone > 0.2 ? 1 : 0;
      tiles.push({
        x,
        y,
        height: h,
        level: 0,
        biome: 'meadow',
        flow: 1,
        downstream: -1,
        water: false,
        lava: cone > 0.83,
        decoration: null,
        variant: hash(x, y, seed + 41),
      });
    }
  const queue = new FloodQueue(),
    seen = new Uint8Array(n * n),
    order: number[] = [];
  tiles.forEach((t, id) => {
    if (t.height <= SEA || t.x === 0 || t.y === 0 || t.x === n - 1 || t.y === n - 1) {
      seen[id] = 1;
      queue.push(id, t.height);
    }
  });
  while (queue.heap.length) {
    const { id } = queue.pop();
    const t = tiles[id];
    order.push(id);
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ]) {
      const x = t.x + dx,
        y = t.y + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const next = y * n + x;
      if (seen[next]) continue;
      seen[next] = 1;
      const neighbor = tiles[next];
      neighbor.downstream = id;
      neighbor.height = Math.max(neighbor.height, t.height + 0.00001);
      queue.push(next, neighbor.height);
    }
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const t = tiles[order[i]];
    if (t.downstream >= 0) tiles[t.downstream].flow += t.flow;
  }
  tiles.forEach((t, id) => {
    const wet = noise(t.x / 18, t.y / 18, seed + 109);
    t.biome =
      t.height <= SEA
        ? 'ocean'
        : volcanic[id]
          ? 'volcano'
          : t.height > 0.66
            ? 'snow'
            : t.height > 0.47
              ? 'mountain'
              : t.height < SEA + 0.027
                ? 'beach'
                : wet > 0.47
                  ? 'forest'
                  : 'meadow';
    // Accumulation naturally merges small headwater streams into larger rivers.
    if (t.flow > 68 && t.height > SEA && !volcanic[id]) t.biome = 'river';
    t.water = t.biome === 'ocean' || t.biome === 'river';
    t.level = t.biome === 'ocean' ? 0 : Math.max(1, Math.round((t.height - SEA) * 29));
    const r = t.variant;
    if (!t.water && !t.lava) {
      if (t.biome === 'forest' && r < 0.32) t.decoration = 'tree';
      else if (t.biome === 'snow' && r < 0.09) t.decoration = 'pine';
      else if (t.biome === 'meadow' && r < 0.065) t.decoration = 'tree';
      else if ((t.biome === 'mountain' || t.biome === 'volcano') && r < 0.14) t.decoration = 'rock';
      else if ((t.biome === 'meadow' || t.biome === 'forest') && r > 0.85) t.decoration = 'flower';
      else if ((t.biome === 'meadow' || t.biome === 'forest') && r > 0.48) t.decoration = 'grass';
    }
  });
  const world: World = { seed, tiles, spawn: { x: 80.5, y: 90.5 }, wildlife: [] };
  // A dry meadow by a river gives every expedition a useful, accessible starting point.
  let score = Infinity;
  for (const t of tiles)
    if (t.biome === 'meadow') {
      const riverNearby = [-1, 1, -n, n, -2, 2, -2 * n, 2 * n].some(
        (offset) => tiles[t.y * n + t.x + offset]?.biome === 'river',
      );
      const s = Math.hypot(t.x - n * 0.48, t.y - n * 0.58) - (riverNearby ? 18 : 0);
      if (s < score) {
        score = s;
        world.spawn = { x: t.x + 0.5, y: t.y + 0.5 };
      }
    }
  for (const t of tiles)
    if (Math.hypot(t.x + 0.5 - world.spawn.x, t.y + 0.5 - world.spawn.y) < 2.5) t.decoration = null;
  return world;
}
