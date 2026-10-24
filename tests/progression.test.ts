import { describe, expect, it } from 'vitest';
import { calculatePetStats, combatPower, POKEMON, ROSTER, PET_QUALITIES } from '@arena/game-data';

describe('summoned pet progression', () => {
  it.each(ROSTER)('$name starts with its existing stats at level 1 / C', (pet) => {
    const stats = calculatePetStats(pet);
    for (const key of Object.keys(stats) as (keyof typeof stats)[])
      expect(stats[key]).toBe(pet[key]);
    expect(combatPower(stats)).toBe(combatPower(pet));
  });

  it('calculates Pikachu at level 10 and applies quality A before rounding', () => {
    expect(calculatePetStats(POKEMON.pikachu, { level: 10, quality: 'C' })).toEqual({
      hp: 267,
      attack: 39,
      defense: 22,
      speed: 257.1,
      sprintSpeed: 321.3,
      maxStamina: 109,
    });
    const stats = calculatePetStats(POKEMON.pikachu, { level: 10, quality: 'A' });
    expect(stats).toEqual({
      hp: 333,
      attack: 49,
      defense: 27,
      speed: 321.3,
      sprintSpeed: 401.7,
      maxStamina: 136,
    });
    expect(combatPower(stats)).toBe(1572);
  });

  it.each(ROSTER)('$name grows monotonically across every level and quality', (pet) => {
    const original = structuredClone(pet);
    for (const quality of PET_QUALITIES) {
      let previous = calculatePetStats(pet, { level: 1, quality });
      for (let level = 2; level <= 100; level++) {
        const stats = calculatePetStats(pet, { level, quality });
        for (const key of Object.keys(stats) as (keyof typeof stats)[]) {
          expect(stats[key]).toBeGreaterThanOrEqual(previous[key]);
          expect(Number.isFinite(stats[key])).toBe(true);
        }
        previous = stats;
      }
    }
    let previous = calculatePetStats(pet, { level: 10, quality: 'C' });
    for (const quality of PET_QUALITIES.slice(1)) {
      const stats = calculatePetStats(pet, { level: 10, quality });
      for (const key of Object.keys(stats) as (keyof typeof stats)[])
        expect(stats[key]).toBeGreaterThan(previous[key]);
      previous = stats;
    }
    expect(pet).toEqual(original);
  });

  it.each([0, -1, 101, 1.5, NaN, Infinity])('rejects invalid level %s', (level) => {
    expect(() => calculatePetStats(POKEMON.pikachu, { level, quality: 'C' })).toThrow();
  });
});
