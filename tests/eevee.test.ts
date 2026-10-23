import { describe, expect, it } from 'vitest';
import { initializeBattle, FIXED_DELTA, calculateDamage } from '@arena/game-core';
import { decideAction } from '@arena/game-ai';
import { POKEMON, SKILLS } from '@arena/game-data';
import { DEFAULT_RULES } from '@arena/shared-types';

function battle(opponent: 'charmander' | 'squirtle' = 'charmander') {
  const engine = initializeBattle(
    {
      rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1, duration: 0 },
      players: ['eevee-player', 'opponent'],
      teams: [['eevee'], [opponent]],
      aiTeams: [],
    },
    12,
  );
  engine.startBattle();
  const [eevee, enemy] = engine.state.fighters;
  eevee.x = 400;
  enemy.x = 470;
  eevee.depth = enemy.depth = 0;
  eevee.invulnerable = enemy.invulnerable = 0;
  eevee.thinkIn = enemy.thinkIn = 100;
  return { engine, eevee, enemy };
}
function damage(percent: number) {
  return calculateDamage(
    percent,
    POKEMON.eevee.attack,
    POKEMON.charmander.defense,
    'normal',
    'fire',
  );
}
function step(engine: ReturnType<typeof battle>['engine'], seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) engine.updateBattle(FIXED_DELTA);
}

describe('Eevee combat', () => {
  it('launches five individually hittable Swift stars with finite steering', () => {
    const { engine, eevee, enemy } = battle();
    enemy.x = 1000;
    enemy.depth = 100;
    expect(engine.beginSkill(eevee, 'swift')).toBe(true);
    step(engine, 0.7);
    expect(engine.state.projectiles).toHaveLength(5);
    expect(new Set(engine.state.projectiles.map((p) => p.id)).size).toBe(5);
    expect(engine.state.projectiles.every((p) => p.targetId === enemy.id)).toBe(true);
    const first = engine.state.projectiles[0];
    expect(first.vDepth).toBeGreaterThan(0);
    step(engine, 0.3);
    const settled = engine.state.projectiles.find((p) => p.id === first.id)!;
    const angle = Math.atan2(settled.vDepth!, settled.vx);
    enemy.depth = -200;
    step(engine, 0.08);
    const after = engine.state.projectiles.find((p) => p.id === first.id)!;
    expect(Math.atan2(after.vDepth!, after.vx)).toBeCloseTo(angle, 5);
  });

  it('grants the next hit 15% extra damage only after a successful dodge', () => {
    const charged = battle('squirtle');
    const { engine, eevee, enemy } = charged;
    eevee.dodgeCooldown = 0;
    expect(engine.beginDodge(eevee, 'dash', 1)).toBe(true);
    engine.state.projectiles.push({
      id: 'incoming',
      ownerId: enemy.id,
      team: 1,
      skillId: 'water-gun',
      x: 415,
      previousX: 415,
      y: 28,
      depth: 0,
      previousDepth: 0,
      vDepth: 0,
      vx: -100,
      width: 50,
      height: 30,
      life: 0.3,
    });
    step(engine, FIXED_DELTA);
    expect(eevee.adaptiveCharge).toBeGreaterThan(1.9);
    step(engine, 0.35);
    eevee.x = 400;
    enemy.x = 470;
    eevee.vx = enemy.vx = 0;
    eevee.actionTime = 0;
    expect(engine.beginSkill(eevee, 'eevee-strike')).toBe(true);
    step(engine, 0.2);
    const boosted = 215 - enemy.hp;
    expect(eevee.adaptiveCharge).toBe(0);

    const plain = battle('squirtle');
    expect(plain.engine.beginSkill(plain.eevee, 'eevee-strike')).toBe(true);
    step(plain.engine, 0.2);
    expect(boosted).toBeGreaterThan(215 - plain.enemy.hp);
    step(engine, 2.1);
    expect(eevee.adaptiveCharge).toBe(0);
  });

  it('lets Counter Pounce expire, but reduces a triggering hit and returns Attack-based damage', () => {
    const miss = battle();
    expect(miss.engine.beginSkill(miss.eevee, 'counter-pounce')).toBe(true);
    step(miss.engine, 3.2);
    expect(miss.eevee.cast).toBeNull();
    expect(miss.enemy.hp).toBe(180);

    const triggered = battle();
    const { engine, eevee, enemy } = triggered;
    expect(engine.beginSkill(eevee, 'counter-pounce')).toBe(true);
    expect(engine.beginSkill(enemy, 'scratch')).toBe(true);
    step(engine, 0.22);
    expect(eevee.cast?.counterTargetId).toBe(enemy.id);
    const guardedDamage = 165 - eevee.hp;
    expect(guardedDamage).toBeGreaterThan(0);
    const normal = battle();
    normal.eevee.actionTime = 100;
    expect(normal.engine.beginSkill(normal.enemy, 'scratch')).toBe(true);
    step(normal.engine, 0.22);
    expect(guardedDamage).toBeLessThan((165 - normal.eevee.hp) * 0.4);
    step(engine, 0.7);
    expect(enemy.hp).toBe(180 - damage(SKILLS.counterPounce.damagePercent));
  });

  it('makes Shadow Step safe during the dash and lets targets escape later Starfall strikes', () => {
    const shadow = battle();
    const { engine, eevee, enemy } = shadow;
    expect(engine.beginSkill(eevee, 'shadow-step')).toBe(true);
    step(engine, 0.25);
    expect(eevee.invulnerable).toBeGreaterThan(0);
    const hp = eevee.hp;
    engine.state.projectiles.push({
      id: 'incoming',
      ownerId: enemy.id,
      team: 1,
      skillId: 'ember',
      x: eevee.x,
      previousX: eevee.x,
      y: 28,
      depth: eevee.depth,
      previousDepth: eevee.depth,
      vDepth: 0,
      vx: 0,
      width: 70,
      height: 40,
      life: 0.2,
    });
    step(engine, FIXED_DELTA);
    expect(eevee.hp).toBe(hp);
    step(engine, 1.3);
    expect(eevee.cast).toBeNull();

    const rush = battle();
    expect(rush.engine.beginSkill(rush.eevee, 'starfall-rush')).toBe(true);
    step(rush.engine, 0.76);
    const earlyDamage = 180 - rush.enemy.hp;
    expect(earlyDamage).toBe(2 * damage(SKILLS.starfallRush.damagePercent));
    rush.enemy.x += 240;
    step(rush.engine, 1.3);
    expect(180 - rush.enemy.hp).toBe(earlyDamage);
  });

  it('finishes Starfall Rush with four small hits and an Attack-based knockback finisher', () => {
    const { engine, eevee, enemy } = battle();
    expect(engine.beginSkill(eevee, 'starfall-rush')).toBe(true);
    step(engine, 1.65);
    expect(180 - enemy.hp).toBe(
      4 * damage(SKILLS.starfallRush.damagePercent) +
        damage(SKILLS.starfallRush.finisherDamagePercent!),
    );
    expect(Math.hypot(enemy.vx, enemy.vDepth)).toBeGreaterThan(100);
  });

  it('uses Shadow Step against an incoming strong projectile', () => {
    const { engine, eevee, enemy } = battle();
    engine.state.projectiles.push({
      id: 'strong',
      ownerId: enemy.id,
      team: 1,
      skillId: 'flame-burst',
      x: 460,
      previousX: 460,
      y: 28,
      depth: 0,
      previousDepth: 0,
      vDepth: 0,
      vx: -300,
      width: 38,
      height: 26,
      life: 1,
    });
    expect(decideAction(eevee, engine.state, () => 0, 'normal')).toEqual({
      type: 'skill',
      skillId: 'shadow-step',
    });
  });
});
