import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { ASSETS, ARENAS, ROSTER } from '@arena/game-data';
import { ANIMATIONS } from '@arena/shared-types';
function paths(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(paths);
  return [];
}
it('every declared asset and arena reference exists locally', () => {
  const assets = paths(ASSETS);
  expect(assets).toHaveLength(32);
  for (const path of assets)
    expect(existsSync(resolve('apps/frontend/public', `.${path}`)), path).toBe(true);
  for (const arena of ARENAS)
    for (const path of [...arena.layers, arena.ambient]) expect(assets).toContain(path);
});
it('all animation definitions point to authored sprite frames', () => {
  for (const pokemon of ROSTER) {
    const sheet = readFileSync(
      resolve('apps/frontend/public', `.${ASSETS.sprites[pokemon.id]}`),
      'utf8',
    );
    expect(sheet).toContain('width="960" height="2400"');
    for (const [i, state] of ANIMATIONS.entries()) {
      expect(pokemon.animations[state].start).toBe(i * 6);
      expect(pokemon.animations[state].end).toBe(i * 6 + 5);
    }
  }
});
