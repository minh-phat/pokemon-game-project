import { expect, it } from 'vitest';
import { POKEMON } from '@arena/game-data';
import { easeHover, hoverTarget } from '../apps/frontend/src/game/hover';

it('keeps Runedrake aloft through ordinary movement and lowers it when grounded', () => {
  const height = POKEMON.runedrake.hoverHeight ?? 0;
  expect(height).toBeGreaterThan(0);
  expect(hoverTarget(height, false, 0, true)).toBe(height);
  expect(hoverTarget(height, false, 660, false)).toBeGreaterThan(height);
  expect(hoverTarget(height, true, 0, false)).toBe(0);
  expect(hoverTarget(POKEMON.pikachu.hoverHeight ?? 0, false, 0, false)).toBe(0);
});

it('eases the fall and return to hovering without a position jump', () => {
  const height = POKEMON.runedrake.hoverHeight ?? 0;
  const firstFall = easeHover(height, 0, 16);
  expect(firstFall).toBeGreaterThan(0);
  expect(firstFall).toBeLessThan(height);
  expect(easeHover(firstFall, 0, 16)).toBeLessThan(firstFall);
  const firstRise = easeHover(0, height, 16);
  expect(firstRise).toBeGreaterThan(0);
  expect(firstRise).toBeLessThan(height);
});
