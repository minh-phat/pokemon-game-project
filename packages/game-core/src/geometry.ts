import {
  STAMINA_RULES,
  type Fighter,
  type SkillDefinition,
  type Element,
} from '@arena/shared-types';
import { EFFECTIVENESS, POKEMON } from '@arena/game-data';
export interface Rect {
  left: number;
  right: number;
  bottom: number;
  top: number;
}
export function overlaps(a: Rect, b: Rect) {
  return a.left <= b.right && a.right >= b.left && a.bottom <= b.top && a.top >= b.bottom;
}
export function fighterBox(f: Fighter): Rect {
  const c = POKEMON[f.species].collision;
  return {
    left: f.x - c.width / 2,
    right: f.x + c.width / 2,
    bottom: f.y,
    top: f.y + c.height * (f.crouched ? 0.42 : 1),
  };
}
export function calculateDamage(
  base: number,
  attack: number,
  defense: number,
  element: Element,
  target: Element,
  enabled = true,
  guard = 0,
): number {
  return Math.max(
    1,
    Math.round(
      base *
        (0.72 + attack / 70) *
        (100 / (100 + defense)) *
        (enabled ? (EFFECTIVENESS[element]?.[target] ?? 1) : 1) *
        (1 - guard),
    ),
  );
}
export function meleeBox(f: Fighter, s: SkillDefinition): Rect {
  return {
    left: f.facing === 1 ? f.x : f.x - s.range,
    right: f.facing === 1 ? f.x + s.range : f.x,
    bottom: f.y + s.hitbox.altitude - s.hitbox.height / 2,
    top: f.y + s.hitbox.altitude + s.hitbox.height / 2,
  };
}
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Low stamina slows voluntary movement to 5–50%; 20% or more gives full speed. */
export function staminaSpeedMultiplier(f: Pick<Fighter, 'stamina' | 'maxStamina'>): number {
  const ratio = Math.max(0, f.stamina) / Math.max(1, f.maxStamina);
  return ratio >= STAMINA_RULES.lowThreshold
    ? 1
    : 0.05 + (0.45 * ratio) / STAMINA_RULES.lowThreshold;
}
