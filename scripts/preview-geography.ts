/** Render the actual coarse terrain for art review: npx tsx scripts/preview-geography.ts [output.png] [seed ...] */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  createWorld,
  biomeColors,
  geographyColor,
  SEA,
  WORLD_SIZE,
} from '../packages/game-data/src/world/geography';

const output = process.argv[2] ?? 'test-results/geography.png';
const seeds = process.argv.slice(3).length
  ? process.argv.slice(3).map(Number)
  : [0, 1, 42, 90210, 4294967295, 2026];
const panels: sharp.OverlayOptions[] = [];
const size = WORLD_SIZE;
for (const [index, seed] of seeds.entries()) {
  const world = createWorld(seed);
  const { tiles } = world;
  const pixels = Buffer.alloc(size * size * 3);
  for (const [id, tile] of tiles.entries()) {
    const color = geographyColor(world, tile);
    const channels = color.startsWith('#')
      ? [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16))
      : color.match(/\d+/g)!.map(Number);
    for (let c = 0; c < 3; c++) pixels[id * 3 + c] = channels[c];
  }
  panels.push({
    input: await sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
      .resize(512, 512, { kernel: 'nearest' })
      .png()
      .toBuffer(),
    left: (index % 3) * 536 + 12,
    top: Math.floor(index / 3) * 552 + 32,
  });
  panels.push({
    input: Buffer.from(
      `<svg width="512" height="24"><text x="0" y="17" font-family="sans-serif" font-size="15" fill="#dbe9e5">Seed ${seed}</text></svg>`,
    ),
    left: (index % 3) * 536 + 12,
    top: Math.floor(index / 3) * 552 + 6,
  });
  const seen = new Set<number>();
  const areas: number[] = [];
  for (let id = 0; id < tiles.length; id++) {
    if (seen.has(id) || tiles[id].height <= SEA) continue;
    const stack = [id];
    seen.add(id);
    let area = 0;
    while (stack.length) {
      const tile = tiles[stack.pop()!];
      area++;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = tile.x + dx,
            y = tile.y + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const next = y * size + x;
          if (!seen.has(next) && tiles[next].height > SEA) {
            seen.add(next);
            stack.push(next);
          }
        }
    }
    areas.push(area);
  }
  console.log(
    JSON.stringify({
      seed,
      land: seen.size / tiles.length,
      areas: areas.sort((a, b) => b - a),
      biomes: Object.fromEntries(
        Object.keys(biomeColors).map((b) => [b, tiles.filter((t) => t.biome === b).length]),
      ),
    }),
  );
}
await mkdir(dirname(output), { recursive: true });
await sharp({
  create: {
    width: Math.min(3, seeds.length) * 536,
    height: Math.ceil(seeds.length / 3) * 552,
    channels: 3,
    background: '#102a35',
  },
})
  .composite(panels)
  .png()
  .toFile(output);
console.log(output);
