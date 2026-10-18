import { describe, expect, it } from 'vitest';
import { initializeBattle, FIXED_DELTA, staminaSpeedMultiplier } from '@arena/game-core';
import { decideAction } from '@arena/game-ai';
import { POKEMON } from '@arena/game-data';
import { DEFAULT_RULES, speciesIds, type SpeciesId } from '@arena/shared-types';

function setup(species: SpeciesId = 'pikachu') {
  const engine = initializeBattle(
    {
      rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1, switching: false, duration: 0 },
      players: ['a', 'b'],
      teams: [[species], ['squirtle']],
    },
    42,
  );
  engine.startBattle();
  for (const f of engine.state.fighters) {
    f.thinkIn = 999;
    f.invulnerable = 0;
    f.dodgeCooldown = 0;
    f.depth = 0;
  }
  engine.state.fighters[0].x = 200;
  engine.state.fighters[1].x = 1100;
  return { engine, f: engine.state.fighters[0] };
}
function ticks(engine: ReturnType<typeof initializeBattle>, count = 60) {
  for (let i = 0; i < count; i++) engine.updateBattle(FIXED_DELTA);
}

describe('stamina and sprint movement', () => {
  it.each(speciesIds)('%s starts at 100 points and has its own faster sprint speed', (species) => {
    const { engine, f } = setup(species);
    expect(f.stamina).toBe(100);
    expect(f.maxStamina).toBe(100);
    expect(POKEMON[species].sprintSpeed).toBeGreaterThan(POKEMON[species].speed);
    const snapshot = engine.getBattleSnapshot();
    expect(snapshot.fighters[0].stamina).toBe(100);
    f.stamina = 20;
    expect(snapshot.fighters[0].stamina).toBe(100);
  });

  it.each(['jump', 'crouch', 'dash'] as const)(
    '%s costs exactly 15 points once, not every frame',
    (mode) => {
      const { engine, f } = setup();
      f.stamina = 50;
      expect(engine.beginDodge(f, mode, 1)).toBe(true);
      expect(f.stamina).toBe(35);
      expect(engine.beginDodge(f, mode, 1)).toBe(false);
      expect(f.stamina).toBe(35);
      ticks(engine, 6);
      expect(f.stamina).toBeGreaterThanOrEqual(35);
      expect(f.stamina).toBeLessThanOrEqual(36.5);
    },
  );

  it.each(['jump', 'crouch', 'dash'] as const)(
    '%s requires 15 points and can spend the last 15',
    (mode) => {
      const { engine, f } = setup();
      f.stamina = 14.99;
      expect(engine.beginDodge(f, mode, 1)).toBe(false);
      expect(f.dodgeCooldown).toBe(0);
      expect(f.stamina).toBe(14.99);
      f.stamina = 15;
      expect(engine.beginDodge(f, mode, 1)).toBe(true);
      expect(f.stamina).toBe(0);
    },
  );

  it.each([
    { mode: 'rest', recovery: 15 },
    { mode: 'move', recovery: 10 },
    { mode: 'sprint', recovery: 3 },
    { mode: 'guard', recovery: -10 },
  ])('$mode changes stamina by $recovery per second', ({ mode, recovery }) => {
    const { engine, f } = setup();
    f.stamina = 50;
    if (mode === 'move' || mode === 'sprint') {
      f.moveIntent = 1;
      f.sprinting = mode === 'sprint';
    }
    if (mode === 'guard') engine.setGuard(f, true);
    ticks(engine);
    expect(f.stamina).toBeCloseTo(50 + recovery, 8);
  });

  it('uses the expanded maximum for regeneration and the 20% speed threshold', () => {
    const { engine, f } = setup();
    f.maxStamina = 200;
    f.stamina = 190;
    ticks(engine);
    expect(f.stamina).toBe(200);
    f.stamina = 30;
    expect(staminaSpeedMultiplier(f)).toBeLessThan(0.5);
    f.stamina = 40;
    expect(staminaSpeedMultiplier(f)).toBe(1);
    f.stamina = 0;
    expect(staminaSpeedMultiplier(f)).toBe(0.05);
  });

  it.each(speciesIds)(
    '%s moves faster while sprinting and barely moves at zero stamina',
    (species) => {
      const normal = setup(species),
        sprint = setup(species),
        empty = setup(species),
        low = setup(species);
      for (const { f } of [normal, sprint, empty, low]) f.moveIntent = 1;
      sprint.f.sprinting = true;
      empty.f.stamina = 0;
      low.f.stamina = 10;
      // The first tick measures speed before regeneration, starting at zero velocity.
      ticks(empty.engine, 1);
      expect(empty.f.vx).toBeCloseTo(POKEMON[species].speed * 0.05);
      ticks(normal.engine, 15);
      ticks(sprint.engine, 15);
      ticks(low.engine, 15);
      expect(sprint.f.x).toBeGreaterThan(normal.f.x);
      expect(low.f.x - 200).toBeLessThan((normal.f.x - 200) * 0.6);
    },
  );

  it('does not recover while guarding and allows continuous guard at zero', () => {
    const { engine, f } = setup();
    f.stamina = 5;
    engine.setGuard(f, true);
    ticks(engine, 120);
    expect(f.stamina).toBe(0);
    expect(f.guarded).toBe(true);
    expect(f.animation).toBe('guard');
    engine.setGuard(f, false);
    ticks(engine);
    expect(f.stamina).toBeCloseTo(15);
  });

  it('does not charge stamina for an action rejected during a cast', () => {
    const { engine, f } = setup();
    engine.beginSkill(f, 'thunderbolt');
    expect(engine.beginDodge(f, 'dash', 1)).toBe(false);
    expect(f.stamina).toBe(100);
  });

  it('AI requests sprint for distant pursuit and uses normal movement when tired', () => {
    const { engine, f } = setup();
    expect(decideAction(f, engine.state, () => 0.5)).toMatchObject({ type: 'move', sprint: true });
    f.thinkIn = 0;
    ticks(engine, 1);
    expect(f.sprinting).toBe(true);
    f.stamina = 10;
    expect(decideAction(f, engine.state, () => 0.5)).toMatchObject({ type: 'move', sprint: false });
  });

  it('AI does not request evasive moves without 15 stamina', () => {
    const { engine, f } = setup();
    f.stamina = 14;
    engine.state.projectiles.push({
      id: 'incoming',
      ownerId: engine.state.fighters[1].id,
      team: 1,
      skillId: 'water-gun',
      x: f.x + 150,
      previousX: f.x + 150,
      depth: f.depth,
      y: 10,
      vx: -400,
      width: 20,
      height: 12,
      life: 2,
    });
    expect(decideAction(f, engine.state, () => 0).type).not.toBe('dodge');
  });

  it('clears sprint when starting guard or a skill and when stamina is below 20%', () => {
    const { engine, f } = setup();
    f.sprinting = true;
    engine.setGuard(f, true);
    expect(f.sprinting).toBe(false);
    engine.setGuard(f, false);
    f.sprinting = true;
    engine.beginSkill(f, 'thunderbolt');
    expect(f.sprinting).toBe(false);
    f.cast = null;
    f.sprinting = true;
    f.stamina = 19;
    ticks(engine, 1);
    expect(f.sprinting).toBe(false);
  });
});
