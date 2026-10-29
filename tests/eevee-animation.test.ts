import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import sharp from 'sharp';
import { ASSETS } from '@arena/game-data';

it('Eevee has six distinct, visible and unclipped poses for every animation', async () => {
  const { data, info } = await sharp(`apps/frontend/public${ASSETS.sprites.eevee}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect([info.width, info.height]).toEqual([960, 2400]);
  for (let row = 0; row < 15; row++) {
    const hashes = new Set<string>();
    for (let frame = 0; frame < 6; frame++) {
      const pixels = Buffer.alloc(160 * 160 * 4);
      let visible = 0,
        border = 0,
        bottom = 0;
      for (let y = 0; y < 160; y++) {
        const offset = ((row * 160 + y) * info.width + frame * 160) * 4;
        data.copy(pixels, y * 160 * 4, offset, offset + 160 * 4);
        for (let x = 0; x < 160; x++) {
          if (data[offset + x * 4 + 3] <= 60) continue;
          visible++;
          bottom = Math.max(bottom, y);
          if (x === 0 || x === 159 || y === 0 || y === 159) border++;
        }
      }
      expect(visible, `empty ${row}/${frame}`).toBeGreaterThan(1000);
      expect(border, `clipped ${row}/${frame}`).toBe(0);
      expect(bottom).toBeGreaterThanOrEqual(147);
      expect(bottom).toBeLessThanOrEqual(150);
      hashes.add(createHash('sha256').update(pixels).digest('hex'));
    }
    expect(hashes.size, `duplicate poses in row ${row}`).toBe(6);
  }
  const portrait = await sharp(`apps/frontend/public${ASSETS.portraits.eevee}`).metadata();
  expect([portrait.width, portrait.height, portrait.hasAlpha]).toEqual([320, 320, true]);
});
