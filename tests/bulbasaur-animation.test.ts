import { expect, it } from 'vitest';
import { ASSETS, SKILL_BY_ID } from '@arena/game-data';
import type { Fighter } from '@arena/shared-types';
import sharp from 'sharp';
import { bulbasaurCastFrame } from '../apps/frontend/src/game/bulbasaur';

function pose(skillId: string, elapsed: number, animation: Fighter['animation'] = 'cast') {
  return bulbasaurCastFrame({ animation, cast: { skillId, elapsed, fired: 0, hitIds: [] } });
}

it('holds the new casting anticipation until even a long Solar Beam charge completes', () => {
  for (const id of ['razor-leaf', 'leech-seed', 'solar-beam', 'sludge-bomb']) {
    const skill = SKILL_BY_ID[id];
    expect(pose(id, 0)).toBe(36);
    expect(pose(id, skill.startup - 0.001)).toBe(38);
    expect(pose(id, skill.startup)).toBe(39);
    expect(pose(id, skill.startup + skill.active + skill.recovery)).toBe(41);
  }
});

it('aligns vine contact with damage and lets the player control locomotion', () => {
  expect(pose('vine-whip', SKILL_BY_ID['vine-whip'].startup, 'attack')).toBe(33);
  expect(bulbasaurCastFrame({ animation: 'run', cast: null })).toBeNull();
});

it('loads the new portrait and keeps all 90 raster cells visible, grounded and unclipped', async () => {
  expect(ASSETS.portraits.bulbasaur).toBe('/assets/bulbasaur.png');
  expect(ASSETS.sprites.bulbasaur).toBe('/assets/bulbasaur-sheet.png');
  const portrait = await sharp(`apps/frontend/public${ASSETS.portraits.bulbasaur}`).metadata();
  expect([portrait.width, portrait.height, portrait.hasAlpha]).toEqual([160, 160, true]);
  const { data, info } = await sharp(`apps/frontend/public${ASSETS.sprites.bulbasaur}`)
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect([info.width, info.height, info.channels]).toEqual([960, 2400, 4]);
  for (let row = 0; row < 15; row++)
    for (let frame = 0; frame < 6; frame++) {
      let visible = 0,
        border = 0,
        bottom = 0;
      for (let y = 0; y < 160; y++)
        for (let x = 0; x < 160; x++) {
          const alpha = data[((row * 160 + y) * info.width + frame * 160 + x) * 4 + 3];
          if (alpha <= 60) continue;
          visible++;
          bottom = Math.max(bottom, y);
          if (x === 0 || y === 0 || x === 159 || y === 159) border++;
        }
      expect(visible, `visible ${row}/${frame}`).toBeGreaterThan(1000);
      expect(border, `clipped ${row}/${frame}`).toBe(0);
      expect(bottom).toBeGreaterThanOrEqual(147);
      expect(bottom).toBeLessThanOrEqual(151);
    }
});
