import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { ASSETS, ARENAS, ROSTER } from '@arena/game-data';
import { ANIMATIONS } from '@arena/shared-types';
import sharp from 'sharp';
function paths(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(paths);
  return [];
}
it('every declared asset and arena reference exists locally', () => {
  const assets = paths(ASSETS);
  expect(assets).toHaveLength(43);
  for (const path of assets)
    expect(existsSync(resolve('apps/frontend/public', `.${path}`)), path).toBe(true);
  for (const arena of ARENAS)
    for (const path of [...arena.layers, arena.ambient]) expect(assets).toContain(path);
});
it('all animation definitions point to authored sprite frames', async () => {
  for (const pokemon of ROSTER) {
    const path = resolve('apps/frontend/public', `.${ASSETS.sprites[pokemon.id]}`);
    if (path.endsWith('.png')) {
      const metadata = await sharp(path).metadata();
      expect([metadata.width, metadata.height]).toEqual(
        pokemon.id === 'runedrake' ? [1920, 2400] : [960, 2400],
      );
      expect(metadata.hasAlpha).toBe(true);
    } else expect(readFileSync(path, 'utf8')).toContain('width="960" height="2400"');
    for (const [i, state] of ANIMATIONS.entries()) {
      expect(pokemon.animations[state].start).toBe(i * 6);
      expect(pokemon.animations[state].end).toBe(i * 6 + 5);
    }
  }
});

it('Ember Glyph uses a transparent image asset', async () => {
  const image = await sharp('apps/frontend/public/assets/runedrake-ember-glyph.png').metadata();
  expect([image.width, image.height, image.hasAlpha]).toEqual([256, 128, true]);
});

it('Runedrake run frames keep a stable silhouette', async () => {
  const { data, info } = await sharp('apps/frontend/public/assets/runedrake-sheet.png')
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let frame = 0; frame < 6; frame++) {
    let changed = 0;
    let visible = 0;
    for (let y = 160; y < 320; y++) {
      for (let x = 80; x < 240; x++) {
        const alpha = data[(y * info.width + frame * 320 + x) * info.channels + 3] > 127;
        const next = data[(y * info.width + ((frame + 1) % 6) * 320 + x) * info.channels + 3] > 127;
        if (alpha || next) visible++;
        if (alpha !== next) changed++;
      }
    }
    expect(visible).toBeGreaterThan(1000);
    expect(changed / visible).toBeLessThan(0.25);
  }
});

it('Runedrake tail-whip poses move the attached tail forward', async () => {
  const { data, info } = await sharp('apps/frontend/public/assets/runedrake-sheet.png')
    .extract({ left: 0, top: 5 * 160, width: 1920, height: 160 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const darkTailPixels = (frame: number) => {
    let count = 0;
    for (let y = 0; y < 160; y++)
      for (let x = 260; x < 300; x++) {
        const offset = (y * info.width + frame * 320 + x) * info.channels;
        if (
          data[offset + 3] > 127 &&
          data[offset] < 120 &&
          data[offset + 1] < 95 &&
          data[offset + 2] < 120
        )
          count++;
      }
    return count;
  };
  expect(darkTailPixels(3)).toBeGreaterThan(300);
  expect(darkTailPixels(3)).toBeGreaterThan(darkTailPixels(0) * 4);
  for (let frame = 0; frame < 5; frame++) {
    let changed = 0;
    for (let y = 0; y < 160; y++)
      for (let x = 0; x < 320; x++) {
        const current = data[(y * info.width + frame * 320 + x) * info.channels + 3] > 127;
        const next = data[(y * info.width + (frame + 1) * 320 + x) * info.channels + 3] > 127;
        if (current !== next) changed++;
      }
    expect(changed).toBeGreaterThan(2000);
  }
});

it('citadel uses the original uploaded image at its native aspect ratio', async () => {
  const arena = ARENAS.find((a) => a.id === 'ruins')!;
  const metadata = await sharp(resolve('apps/frontend/public', `.${arena.background}`)).metadata();
  expect([metadata.width, metadata.height]).toEqual([1942, 810]);
  expect(arena.width / arena.height!).toBeCloseTo(metadata.width! / metadata.height!, 10);
  expect(arena.thumbnail).toBe(arena.background);
});

it('Charmander has high-definition raster portrait and 15 animated action states', async () => {
  const portrait = await sharp('apps/frontend/public/assets/charmander.png').metadata();
  expect([portrait.width, portrait.height, portrait.hasAlpha]).toEqual([160, 160, true]);

  const sheet = await sharp('apps/frontend/public/assets/charmander-sheet.png').metadata();
  expect([sheet.width, sheet.height, sheet.hasAlpha]).toEqual([960, 2400, true]);

  const { data, info } = await sharp('apps/frontend/public/assets/charmander-sheet.png')
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 6; c++) {
      let opaque = 0;
      let bottom = 0;
      let border = 0;
      for (let y = r * 160; y < (r + 1) * 160; y++) {
        for (let x = c * 160; x < (c + 1) * 160; x++) {
          if (data[(y * info.width + x) * info.channels + 3] > 60) {
            opaque++;
            bottom = Math.max(bottom, y - r * 160);
            if (x % 160 === 0 || x % 160 === 159 || y % 160 === 0 || y % 160 === 159) border++;
          }
        }
      }
      expect(opaque, `Row ${r} Col ${c} has visible pixels`).toBeGreaterThan(1000);
      expect(border, `Row ${r} Col ${c} must not clip against another frame`).toBe(0);
      // Allow two pixels of antialiasing at the registered y=149 baseline.
      expect(bottom, `Row ${r} Col ${c} shares the ground baseline`).toBeGreaterThanOrEqual(147);
      expect(bottom).toBeLessThanOrEqual(151);
    }
  }
});
