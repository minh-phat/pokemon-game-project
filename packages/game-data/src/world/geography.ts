import { createWorld as createLegacyGeography } from './legacy-geography';

/** Coarse continental height field and drainage graph. Never expanded to full world resolution. */
export const WORLD_SIZE = 256;
export const SEA = 0.19;
export const GEOGRAPHY_VERSION = 2;
export type GeographyVersion = 1 | 2;
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
/** Shared atlas shading: shallow shelves and northwest-lit mountain relief. */
export function geographyColor(world: World, tile: Tile): string {
  if (tile.lava) return '#ff914e';
  const color = biomeColors[tile.biome];
  const west = tileAt(world, Math.max(0, tile.x - 1), tile.y)!.height;
  const north = tileAt(world, tile.x, Math.max(0, tile.y - 1))!.height;
  const shade =
    tile.biome === 'ocean'
      ? -Math.min(30, (SEA - tile.height) * 180)
      : Math.max(-45, Math.min(35, (west + north - tile.height * 2) * 260));
  const channels = [1, 3, 5].map((offset) =>
    Math.round(Math.max(0, Math.min(255, parseInt(color.slice(offset, offset + 2), 16) + shade))),
  );
  return `rgb(${channels.join(',')})`;
}

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
type Spine = readonly (readonly [x: number, y: number, width: number])[];

/** Signed distance to a branching shelf, with a different width at each node. */
function spineField(x: number, y: number, nodes: Spine) {
  let field = -1;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1],
      b = nodes[i];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)),
    );
    field = Math.max(field, mix(a[2], b[2], t) - Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t));
  }
  return field;
}

function createLandforms(seed: number) {
  // Broad connected interiors, asymmetrical peninsulas and a deep central sea.
  // These are geological spines, not coast polygons: multiscale noise erodes the shores.
  const shelves: Spine[] = [
    [
      [0.15, 0.19, 0.065],
      [0.28, 0.24, 0.12],
      [0.29, 0.4, 0.135],
      [0.24, 0.54, 0.105],
      [0.32, 0.66, 0.075],
      [0.28, 0.82, 0.028],
    ],
    [
      [0.27, 0.28, 0.075],
      [0.4, 0.18, 0.048],
      [0.48, 0.2, 0.018],
    ],
    [
      [0.29, 0.42, 0.08],
      [0.43, 0.43, 0.045],
      [0.49, 0.51, 0.018],
    ],
    [
      [0.23, 0.53, 0.065],
      [0.13, 0.62, 0.04],
      [0.1, 0.72, 0.014],
    ],
    [
      [0.76, 0.28, 0.035],
      [0.81, 0.41, 0.08],
      [0.73, 0.56, 0.105],
      [0.77, 0.72, 0.105],
      [0.63, 0.8, 0.065],
      [0.53, 0.85, 0.023],
    ],
    [
      [0.76, 0.58, 0.07],
      [0.89, 0.54, 0.035],
      [0.92, 0.45, 0.012],
    ],
    [
      [0.78, 0.71, 0.065],
      [0.87, 0.84, 0.025],
      [0.83, 0.91, 0.012],
    ],
    // An elongated northern island and a hooked southern island.
    [
      [0.59, 0.1, 0.023],
      [0.64, 0.16, 0.043],
      [0.6, 0.24, 0.027],
    ],
    [
      [0.11, 0.83, 0.022],
      [0.14, 0.89, 0.035],
      [0.22, 0.92, 0.018],
    ],
  ];
  // Unequal islands along a broken arc through the inland sea, never a regular grid.
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const x = 0.53 + Math.sin(t * Math.PI * 1.5) * 0.08 + (hash(i, 320, seed) - 0.5) * 0.025;
    const y = 0.34 + t * 0.39;
    const width = 0.006 + hash(i, 321, seed) ** 2 * 0.013;
    const angle = -0.9 + t * 3.8;
    const length = width * (1.2 + hash(i, 322, seed) * 1.4);
    shelves.push([
      [x - Math.cos(angle) * length, y - Math.sin(angle) * length, width * 0.45],
      [x, y, width],
      [x + Math.cos(angle + 0.7) * length, y + Math.sin(angle + 0.7) * length, width * 0.35],
    ]);
  }
  const ranges: Spine[] = [
    [
      [0.18, 0.2, 0.018],
      [0.25, 0.28, 0.047],
      [0.28, 0.39, 0.052],
      [0.23, 0.5, 0.043],
      [0.3, 0.63, 0.025],
      [0.28, 0.76, 0.007],
    ],
    [
      [0.28, 0.31, 0.033],
      [0.37, 0.23, 0.025],
      [0.44, 0.2, 0.008],
    ],
    [
      [0.8, 0.37, 0.014],
      [0.76, 0.49, 0.042],
      [0.72, 0.6, 0.052],
      [0.76, 0.71, 0.039],
      [0.66, 0.78, 0.018],
    ],
    [
      [0.63, 0.14, 0.012],
      [0.64, 0.17, 0.028],
      [0.61, 0.22, 0.012],
    ],
  ];
  const vents = [
    { x: 0.34, y: 0.47, radius: 0.047, height: 0.58 },
    { x: 0.81, y: 0.7, radius: 0.044, height: 0.69 },
    { x: 0.14, y: 0.88, radius: 0.03, height: 0.61 },
  ];
  // Shared affine variation preserves navigable straits while changing orientation by seed.
  const angle = (hash(1, 330, seed) - 0.5) * 0.32;
  const flipX = hash(2, 330, seed) > 0.5 ? -1 : 1;
  const flipY = hash(3, 330, seed) > 0.5 ? -1 : 1;
  const transform = (x: number, y: number) => ({
    x: 0.5 + ((x - 0.5) * Math.cos(angle) - (y - 0.5) * Math.sin(angle)) * flipX,
    y: 0.5 + ((x - 0.5) * Math.sin(angle) + (y - 0.5) * Math.cos(angle)) * flipY,
  });
  const warp = (spines: Spine[]) =>
    spines.map((spine) =>
      spine.map(([x, y, width]) => {
        const p = transform(x, y);
        return [p.x, p.y, width] as const;
      }),
    );
  return {
    shelves: warp(shelves),
    ranges: warp(ranges),
    vents: vents.map((v) => ({ ...v, ...transform(v.x, v.y) })),
  };
}

export function createWorld(
  inputSeed: number,
  version: GeographyVersion = GEOGRAPHY_VERSION,
): World {
  if (version === 1) return createLegacyGeography(inputSeed);
  const seed = inputSeed >>> 0;
  const n = WORLD_SIZE,
    tiles: Tile[] = [],
    volcanic = new Uint8Array(n * n);
  const land = createLandforms(seed);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      // Warp the entire geological frame so bays, ranges and islands remain aligned.
      const u = x / n + (noise(x / 47, y / 47, seed + 301) - 0.5) * 0.065,
        v = y / n + (noise(x / 47, y / 47, seed + 302) - 0.5) * 0.065;
      const coast =
        (noise(x / 19, y / 19, seed + 303) - 0.5) * 0.044 +
        (noise(x / 7, y / 7, seed + 304) - 0.5) * 0.02 +
        (noise(x / 2.8, y / 2.8, seed + 305) - 0.5) * 0.007;
      let shore = -1;
      for (const branch of land.shelves) shore = Math.max(shore, spineField(u, v, branch));
      shore += coast;
      // Keep a navigable ocean margin. Mountain height cannot create land offshore.
      shore = Math.min(shore, Math.min(x, y, n - 1 - x, n - 1 - y) / n - 0.022);
      const inland = Math.max(0, Math.min(1, shore / 0.045));
      let h = SEA + (shore < 0 ? Math.max(-0.16, shore * 2.4) : 0.18 * (1 - Math.exp(-shore * 18)));
      let belt = 0;
      for (const range of land.ranges)
        belt = Math.max(belt, Math.max(0, spineField(u, v, range) / 0.05));
      const ridges = 1 - Math.abs(noise(x / 11, y / 11, seed + 310) * 2 - 1);
      h +=
        inland *
        (belt ** 1.25 * (0.32 + ridges * 0.42) +
          (noise(x / 23, y / 23, seed + 311) - 0.35) * 0.075);
      let cone = 0;
      for (const vent of land.vents) {
        const summit = Math.max(0, 1 - Math.hypot(u - vent.x, v - vent.y) / vent.radius);
        cone = Math.max(cone, summit * inland);
        h += summit ** 1.6 * vent.height * inland;
      }
      volcanic[y * n + x] = cone > 0.18 ? 1 : 0;
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
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
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
    // Tributaries join into long continental rivers; small islands retain short streams.
    if (t.flow > 32 && t.height > SEA) {
      t.biome = 'river';
      t.lava = false;
    }
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
