import { expect, it } from 'vitest';
import { initializeBattle, FIXED_DELTA } from '@arena/game-core';
import { decideAction } from '@arena/game-ai';
import { DEFAULT_RULES, isConcealed } from '@arena/shared-types';
import { slimeOpacity, slimePose } from '../apps/frontend/src/game/water-slime';

function battle() {
  const engine = initializeBattle(
    {
      rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1, duration: 0 },
      players: ['slime', 'enemy'],
      teams: [['water-slime'], ['charmander']],
      aiTeams: [],
    },
    12,
  );
  engine.startBattle();
  const [slime, enemy] = engine.state.fighters;
  slime.x = 400;
  enemy.x = 500;
  for (const f of [slime, enemy]) {
    f.depth = 0;
    f.invulnerable = 0;
    f.thinkIn = 100;
  }
  return { engine, slime, enemy };
}
function step(engine: ReturnType<typeof battle>['engine'], seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) engine.updateBattle(FIXED_DELTA);
}
it('compresses before launching its spring tackle, then damages the enemy', () => {
  const { engine, slime, enemy } = battle();
  engine.beginSkill(slime, 'spring-tackle');
  step(engine, 0.2);
  expect(slime.x).toBe(400);
  expect(slimePose(slime).x).toBeGreaterThan(1.2);
  expect(enemy.hp).toBe(180);
  step(engine, 0.35);
  expect(slime.x).toBeGreaterThan(430);
  expect(enemy.hp).toBeLessThan(180);
});
it('spits exactly one small water projectile after mouth startup', () => {
  const { engine, slime, enemy } = battle();
  enemy.x = 1000;
  engine.beginSkill(slime, 'water-orb');
  step(engine, 0.3);
  expect(engine.state.projectiles).toHaveLength(0);
  step(engine, 0.1);
  expect(engine.state.projectiles).toHaveLength(1);
  expect(engine.state.projectiles[0]).toMatchObject({
    skillId: 'water-orb',
    width: 22,
    height: 22,
  });
});
it('liquid guard reduces actual incoming damage and expires', () => {
  const plain = battle();
  plain.enemy.x = 460;
  plain.engine.beginSkill(plain.enemy, 'scratch');
  step(plain.engine, 0.2);
  const damage = 185 - plain.slime.hp;
  const guarded = battle();
  guarded.enemy.x = 460;
  guarded.engine.beginSkill(guarded.slime, 'liquid-guard');
  step(guarded.engine, 0.2);
  guarded.engine.beginSkill(guarded.enemy, 'scratch');
  step(guarded.engine, 0.2);
  expect(185 - guarded.slime.hp).toBeGreaterThan(0);
  expect(185 - guarded.slime.hp).toBeLessThan(damage * 0.5);
  step(guarded.engine, 3.2);
  expect(guarded.slime.effects.some((e) => e.kind === 'shield')).toBe(false);
});
it('wrap immobilizes all axes for three seconds and then releases', () => {
  const { engine, slime, enemy } = battle();
  engine.beginSkill(slime, 'liquid-wrap');
  step(engine, 0.35);
  expect(slime.cast?.bound).toBe(true);
  const position = [enemy.x, enemy.depth, enemy.y];
  enemy.vx = 300;
  enemy.vDepth = 200;
  enemy.vy = 100;
  step(engine, 2.8);
  expect([enemy.x, enemy.depth, enemy.y]).toEqual(position);
  expect(engine.beginSkill(enemy, 'scratch')).toBe(false);
  step(engine, 0.5);
  expect(slime.cast?.skillId).not.toBe('liquid-wrap');
  expect(enemy.actionTime).toBe(0);
  expect(engine.beginSkill(enemy, 'scratch')).toBe(true);
});
it('a missed wrap does not root a distant enemy', () => {
  const { engine, slime, enemy } = battle();
  enemy.x = 1000;
  engine.beginSkill(slime, 'liquid-wrap');
  step(engine, 0.6);
  expect(slime.cast?.skillId).not.toBe('liquid-wrap');
  expect(enemy.actionTime).toBe(0);
  expect(enemy.hp).toBe(180);
});
it('veil fades for owner and enemy, removes AI targeting, then expires', () => {
  const { engine, slime, enemy } = battle();
  engine.beginSkill(slime, 'water-veil');
  step(engine, 0.25);
  expect(isConcealed(slime)).toBe(false);
  expect(slimeOpacity(slime, false)).toBeGreaterThan(0);
  step(engine, 0.35);
  expect(isConcealed(slime)).toBe(true);
  expect(slimeOpacity(slime, false)).toBe(0);
  expect(slimeOpacity(slime, true)).toBeCloseTo(0.28);
  expect(enemy.targetId).toBeNull();
  expect(decideAction(enemy, engine.state, () => 0.5)).toMatchObject({ state: 'FindTarget' });
  expect(slime.invulnerable).toBe(0);
  step(engine, 4.5);
  expect(isConcealed(slime)).toBe(false);
  expect(slimeOpacity(slime, true)).toBe(1);
  expect(enemy.targetId).toBe(slime.id);
});

it('releases the liquid victim when the caster is interrupted', () => {
  const { engine, slime, enemy } = battle();
  engine.beginSkill(slime, 'liquid-wrap');
  step(engine, 0.4);
  expect(slime.cast?.bound).toBe(true);
  slime.effects.push({ kind: 'stun', duration: 1, strength: 1 });
  step(engine, 0.1);
  expect(slime.cast).toBeNull();
  expect(enemy.actionTime).toBe(0);
  expect(engine.beginSkill(enemy, 'scratch')).toBe(true);
});

it('liquid binding also pins a victim processed before the caster', () => {
  const { engine, slime, enemy } = battle();
  engine.state.fighters.reverse();
  engine.beginSkill(slime, 'liquid-wrap');
  step(engine, 0.4);
  const position = [enemy.x, enemy.depth, enemy.y];
  enemy.vx = 200;
  enemy.vDepth = 100;
  enemy.vy = 300;
  step(engine, 1);
  expect([enemy.x, enemy.depth, enemy.y]).toEqual(position);
});
