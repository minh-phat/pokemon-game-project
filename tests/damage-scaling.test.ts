import { describe, expect, it } from 'vitest';
import { armorDamageMultiplier, calculateDamage } from '@arena/game-core';
import { calculatePetStats, POKEMON, ROSTER, PET_QUALITIES } from '@arena/game-data';

const hit = (attack: number, defense: number) =>
  calculateDamage(100, attack, defense, 'normal', 'normal', false);

describe('relative armor and progression', () => {
  it('keeps mitigation constant when both sides scale, independent of skill power', () => {
    expect(armorDamageMultiplier(100, 100)).toBe(0.8);
    expect(armorDamageMultiplier(100, 400)).toBe(0.5);
    for (const scale of [1, 3, 17.85, 100]) {
      expect(armorDamageMultiplier(22 * scale, 40 * scale)).toBeCloseTo(0.6875);
    }
    expect(calculateDamage(200, 100, 400, 'normal', 'normal', false)).toBe(100);
    expect(calculateDamage(20, 100, 400, 'normal', 'normal', false) * 10).toBe(100);
  });

  it('fixes level 100 SSS Squirtle mirror damage and preserves the stronger pet advantage', () => {
    const low = calculatePetStats(POKEMON.squirtle);
    const high = calculatePetStats(POKEMON.squirtle, { level: 100, quality: 'SSS' });
    expect(high).toMatchObject({ hp: 5753, attack: 393, defense: 714 });
    expect(hit(high.attack, high.defense)).toBe(270);
    expect(Math.ceil(high.hp / hit(high.attack, high.defense))).toBe(22);
    expect(Math.ceil(low.hp / hit(low.attack, low.defense))).toBe(15);
    expect(hit(high.attack, low.defense)).toBeGreaterThan(low.hp);
    expect(hit(low.attack, high.defense) / high.hp).toBeLessThan(
      hit(low.attack, low.defense) / low.hp,
    );
  });

  it.each(ROSTER)(
    '$name mirror match HP loss stays within growth bounds at every level and quality',
    (base) => {
      const baseFraction = hit(base.attack, base.defense) / base.hp;
      for (const quality of PET_QUALITIES) {
        for (let level = 1; level <= 100; level++) {
          const stats = calculatePetStats(base, { level, quality });
          const fraction = hit(stats.attack, stats.defense) / stats.hp;
          // HP grows 8%/level versus ATK's 5%; allow integer rounding at low levels.
          expect(fraction / baseFraction).toBeGreaterThan(0.6);
          expect(fraction / baseFraction).toBeLessThan(1.1);
        }
      }
    },
  );

  it('handles zero stats, armor, elements and guard', () => {
    expect(hit(0, 0)).toBe(0);
    expect(hit(100, 0)).toBe(100);
    expect(hit(100, -50)).toBe(100);
    expect(calculateDamage(0, 100, 100, 'fire', 'grass')).toBe(0);
    expect(calculateDamage(120, 100, 50, 'fire', 'grass', true, 0.2)).toBe(119);
    expect(hit(100, 200)).toBeLessThan(hit(100, 100));
    expect(hit(200, 100)).toBeGreaterThan(hit(100, 100));
  });
});
