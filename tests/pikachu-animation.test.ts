import { expect, it } from 'vitest';
import sharp from 'sharp';
import { ASSETS, POKEMON } from '@arena/game-data';

it('supplies all 15 summon actions with six distinct, grounded and unclipped frames', async () => {
  const { data, info } = await sharp(`apps/frontend/public${ASSETS.sprites.pikachu}`)
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect([info.width, info.height, info.channels]).toEqual([960, 2400, 4]);
  for (const [action, animation] of Object.entries(POKEMON.pikachu.animations)) {
    const unique = new Set<string>();
    for (let frame = animation.start; frame <= animation.end; frame++) {
      const cell = await sharp(data, { raw: info })
        .extract({
          left: (frame % 6) * 160,
          top: Math.floor(frame / 6) * 160,
          width: 160,
          height: 160,
        })
        .raw()
        .toBuffer();
      let visible = 0,
        border = 0,
        bottom = 0;
      for (let y = 0; y < 160; y++)
        for (let x = 0; x < 160; x++)
          if (cell[(y * 160 + x) * 4 + 3] > 60) {
            visible++;
            bottom = Math.max(bottom, y);
            if (x === 0 || x === 159 || y === 0 || y === 159) border++;
          }
      expect(visible, `${action}/${frame} empty`).toBeGreaterThan(1000);
      expect(border, `${action}/${frame} clipped`).toBe(0);
      expect(bottom).toBeGreaterThanOrEqual(147);
      expect(bottom).toBeLessThanOrEqual(150);
      unique.add(cell.toString('base64'));
    }
    expect(unique.size, `${action} frames`).toBe(6);
  }
  const portrait = await sharp(`apps/frontend/public${ASSETS.portraits.pikachu}`).raw().toBuffer();
  const idle = await sharp(data, { raw: info })
    .extract({ left: 0, top: 0, width: 160, height: 160 })
    .raw()
    .toBuffer();
  expect(portrait.equals(idle)).toBe(true);
});
