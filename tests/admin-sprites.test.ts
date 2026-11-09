import { describe, expect, it } from 'vitest';
import {
  ANIMATION_OVERRIDES,
  BASE_ANIMATIONS,
  POKEMON,
  isValidAnimationSpec,
  spriteFrameWidth,
} from '@arena/game-data';
import { ANIMATIONS } from '@arena/shared-types';

describe('Admin sprite studio data & overrides', () => {
  it('correctly validates animation specs', () => {
    expect(isValidAnimationSpec({ start: 0, end: 5, frameRate: 10, repeat: -1 })).toBe(true);
    expect(isValidAnimationSpec({ start: 10, end: 15, frameRate: 14.5, repeat: 0 })).toBe(true);

    // Invalid specs
    expect(isValidAnimationSpec({ start: -1, end: 5, frameRate: 10, repeat: -1 })).toBe(false);
    expect(isValidAnimationSpec({ start: 5, end: 2, frameRate: 10, repeat: -1 })).toBe(false);
    expect(isValidAnimationSpec({ start: 0, end: 5, frameRate: 0, repeat: -1 })).toBe(false);
    expect(isValidAnimationSpec({ start: 0, end: 5, frameRate: 70, repeat: -1 })).toBe(false);
    expect(isValidAnimationSpec({ start: 0, end: 5, frameRate: 10, repeat: -2 })).toBe(false);
    expect(isValidAnimationSpec(null)).toBe(false);
  });

  it('provides base animations for every species', () => {
    for (const [id, def] of Object.entries(POKEMON)) {
      expect(BASE_ANIMATIONS[id as keyof typeof BASE_ANIMATIONS]).toBeDefined();
      for (const anim of ANIMATIONS) {
        expect(def.animations[anim]).toBeDefined();
        expect(def.animations[anim].start).toBeGreaterThanOrEqual(0);
        expect(def.animations[anim].end).toBeGreaterThanOrEqual(def.animations[anim].start);
      }
    }
  });

  it('resolves correct sprite frame widths (Runedrake 320px, others 160px)', () => {
    expect(spriteFrameWidth('runedrake')).toBe(320);
    expect(spriteFrameWidth('pikachu')).toBe(160);
    expect(spriteFrameWidth('charmander')).toBe(160);
    expect(spriteFrameWidth('bulbasaur')).toBe(160);
    expect(spriteFrameWidth('eevee')).toBe(160);
    expect(spriteFrameWidth('water-slime')).toBe(160);
    expect(spriteFrameWidth('squirtle')).toBe(160);
  });
});
