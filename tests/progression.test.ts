import { describe, expect, it } from 'vitest';
import { calculatePetStats, combatPower, POKEMON, ROSTER, PET_QUALITIES } from '@arena/game-data';

describe('summoned pet progression', () => {
  it.each(ROSTER)('$name starts with its existing stats at level 1 / F', (pet) => {
    const stats = calculatePetStats(pet);
    for (const key of Object.keys(stats) as (keyof typeof stats)[])
      expect(stats[key]).toBe(pet[key]);
    expect(combatPower(stats)).toBe(combatPower(pet));
  });

  it('calculates Pikachu at level 10 and applies quality A before rounding', () => {
    expect(calculatePetStats(POKEMON.pikachu, { level: 10, quality: 'F' })).toEqual({
      hp: 267,
      attack: 39,
      defense: 22,
      speed: 257.1,
      sprintSpeed: 321.3,
      maxStamina: 109,
    });
    const stats = calculatePetStats(POKEMON.pikachu, { level: 10, quality: 'A' });
    expect(stats).toEqual({
      hp: 467,
      attack: 69,
      defense: 38,
      speed: 353.5,
      sprintSpeed: 441.8,
      maxStamina: 191,
    });
    expect(combatPower(stats)).toBe(1988);
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
    let previous = calculatePetStats(pet, { level: 10, quality: PET_QUALITIES[0] });
    for (const quality of PET_QUALITIES.slice(1)) {
      const stats = calculatePetStats(pet, { level: 10, quality });
      for (const key of Object.keys(stats) as (keyof typeof stats)[])
        expect(stats[key]).toBeGreaterThan(previous[key]);
      previous = stats;
    }
    expect(pet).toEqual(original);
  });

  it.each(ROSTER)('$name keeps level-100 SSS movement at 2.99 times base', (pet) => {
    const strongest = calculatePetStats(pet, { level: 100, quality: 'SSS' });
    const weakest = calculatePetStats(pet, { level: 1, quality: 'F' });
    for (const key of ['speed', 'sprintSpeed'] as const) {
      expect(strongest[key]).toBeCloseTo(pet[key] * 1.495 * 2, 0);
      expect(strongest[key] / weakest[key]).toBeCloseTo(2.99, 3);
    }
    expect(strongest.hp).toBe(Math.round(pet.hp * 8.92 * 3));
    expect(strongest.attack).toBe(Math.round(pet.attack * 5.95 * 3));
  });

  it.each([0, -1, 101, 1.5, NaN, Infinity])('rejects invalid level %s', (level) => {
    expect(() => calculatePetStats(POKEMON.pikachu, { level, quality: 'C' })).toThrow();
  });
});
