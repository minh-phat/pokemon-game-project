import { describe, expect, it } from 'vitest';
import { initializeBattle, FIXED_DELTA } from '@arena/game-core';
import { BattleSession } from '../apps/game-server/src/session';
import { DEFAULT_RULES } from '@arena/shared-types';
import { POKEMON } from '@arena/game-data';

function engine() {
  const e = initializeBattle(
    {
      rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1, duration: 0 },
      players: ['alice', 'bob'],
      teams: [['pikachu'], ['squirtle']],
    },
    5,
  );
  e.startBattle();
  return e;
}
const move = (fighterId: string) => ({
  type: 'move',
  fighterId,
  direction: 1,
  depthDirection: 0,
  sprint: false,
});
const guard = (fighterId: string, active = true) => ({ type: 'guard', fighterId, active });
function step(e: ReturnType<typeof engine>, count = 60) {
  for (let i = 0; i < count; i++) e.updateBattle(FIXED_DELTA);
}

describe('manual battle commands', () => {
  it('locks the controlled Pokémon onto its target until switched or the target leaves', () => {
    const e = initializeBattle(
      {
        rules: { ...DEFAULT_RULES, teamSize: 2, activeSize: 2, duration: 0 },
        players: ['alice', 'bob'],
        teams: [
          ['pikachu', 'charmander'],
          ['squirtle', 'bulbasaur'],
        ],
      },
      5,
    );
    e.startBattle();
    e.setManualMode('alice', true);
    const [pikachu, ally, squirtle, bulbasaur] = e.state.fighters;
    pikachu.x = 100;
    squirtle.x = 200;
    bulbasaur.x = 900;
    e.updateBattle(FIXED_DELTA);
    expect(pikachu.targetId).toBe(squirtle.id);
    squirtle.x = 900;
    bulbasaur.x = 200;
    e.updateBattle(FIXED_DELTA);
    expect(pikachu.targetId).toBe(squirtle.id);
    expect(e.command('alice', { type: 'target', fighterId: ally.id, targetId: bulbasaur.id })).toBe(
      false,
    );
    expect(e.command('alice', { type: 'target', fighterId: pikachu.id, targetId: ally.id })).toBe(
      false,
    );
    expect(
      e.command('alice', { type: 'target', fighterId: pikachu.id, targetId: bulbasaur.id }),
    ).toBe(true);
    e.updateBattle(FIXED_DELTA);
    expect(pikachu.targetId).toBe(bulbasaur.id);
    bulbasaur.hp = 0;
    bulbasaur.active = false;
    e.updateBattle(FIXED_DELTA);
    expect(pikachu.targetId).toBe(squirtle.id);
  });
  it('switches one team to manual while the other AI keeps acting', () => {
    const e = engine(),
      [a, b] = e.state.fighters;
    a.thinkIn = 0;
    b.thinkIn = 0;
    expect(e.setManualMode('alice', true)).toBe(true);
    expect(e.getBattleSnapshot().manualTeams).toEqual([true, false]);
    step(e, 10);
    expect(a.thinkIn).toBeGreaterThan(0);
    expect(a.moveIntent).not.toBe(0);
    expect(b.thinkIn).toBeGreaterThan(0);
    expect(a.cast).toBeNull();
    expect(e.setManualMode('alice', false)).toBe(true);
    step(e, 1);
    expect(a.thinkIn).toBeGreaterThan(0);
  });
  it('lets unselected allies use the full AI and switches manual control between active Pokémon', () => {
    const e = initializeBattle(
      {
        rules: { ...DEFAULT_RULES, teamSize: 2, activeSize: 2, duration: 0 },
        players: ['alice', 'bob'],
        teams: [
          ['pikachu', 'charmander'],
          ['squirtle', 'bulbasaur'],
        ],
      },
      5,
    );
    e.startBattle();
    const [pikachu, charmander, squirtle, bulbasaur] = e.state.fighters;
    e.setManualMode('alice', true);
    expect(e.state.controlledFighterIds[0]).toBe(pikachu.id);
    expect(e.command('alice', guard(charmander.id))).toBe(false);
    pikachu.x = 100;
    charmander.x = 500;
    squirtle.x = 650;
    bulbasaur.x = 1100;
    charmander.depth = squirtle.depth = 0;
    pikachu.thinkIn = 100;
    squirtle.thinkIn = bulbasaur.thinkIn = 100;
    e.state.tick = 60;
    step(e, 180);
    expect(
      e.state.events.some(
        (event) =>
          event.fighterId === charmander.id &&
          event.kind === 'skill' &&
          event.text !== POKEMON[charmander.species].skills[0].name,
      ),
    ).toBe(true);
    expect(
      e.state.events.some((event) => event.fighterId === pikachu.id && event.kind === 'skill'),
    ).toBe(false);
    expect(e.selectControlledFighter('bob', charmander.id)).toBe(false);
    expect(e.selectControlledFighter('alice', squirtle.id)).toBe(false);
    expect(e.selectControlledFighter('alice', 'missing')).toBe(false);
    expect(e.selectControlledFighter('alice', charmander.id)).toBe(true);
    expect(e.state.controlledFighterIds[0]).toBe(charmander.id);
    expect(e.command('alice', guard(pikachu.id))).toBe(false);
    charmander.cast = null;
    charmander.actionTime = 0;
    charmander.y = 0;
    charmander.effects = [];
    expect(e.command('alice', guard(charmander.id))).toBe(true);
    expect(e.selectControlledFighter('alice', pikachu.id)).toBe(true);
    expect(charmander.guarded).toBe(false);
    expect(e.command('alice', guard(pikachu.id))).toBe(true);
  });
  it('hands manual control to another active Pokémon when the selected one faints', () => {
    const e = initializeBattle(
      {
        rules: { ...DEFAULT_RULES, teamSize: 2, activeSize: 2, duration: 0 },
        players: ['alice', 'bob'],
        teams: [
          ['pikachu', 'charmander'],
          ['squirtle', 'bulbasaur'],
        ],
      },
      5,
    );
    e.startBattle();
    e.setManualMode('alice', true);
    const [pikachu, charmander] = e.state.fighters;
    pikachu.hp = 0;
    step(e, 1);
    expect(e.getBattleSnapshot().controlledFighterIds[0]).toBe(charmander.id);
    expect(e.command('alice', guard(charmander.id))).toBe(true);
  });
  it('rejects unknown players, opposing fighters, auto mode, and malformed commands', () => {
    const e = engine(),
      [a, b] = e.state.fighters;
    expect(e.command('alice', move(a.id))).toBe(false);
    expect(e.setManualMode('intruder', true)).toBe(false);
    e.setManualMode('alice', true);
    expect(e.command('intruder', move(a.id))).toBe(false);
    expect(e.command('alice', move(b.id))).toBe(false);
    expect(e.command('alice', { ...guard(a.id), active: 'yes' })).toBe(false);
    expect(e.command('alice', { ...move(a.id), extra: true })).toBe(false);
    expect(e.command('alice', { type: 'skill', fighterId: a.id, skillId: 'ember' })).toBe(false);
    expect(b.moveIntent).toBe(0);
    expect(b.cast).toBeNull();
  });
  it('moves with a manual stick command, then stops when the stick is released', () => {
    const e = engine();
    e.setManualMode('alice', true);
    const fighter = e.state.fighters[0];
    fighter.thinkIn = 100;
    const start = fighter.x;
    expect(
      e.command('alice', { type: 'move', fighterId: fighter.id, direction: 1, depthDirection: 0 }),
    ).toBe(true);
    step(e, 12);
    expect(fighter.x).toBeGreaterThan(start);
    expect(
      e.command('alice', { type: 'move', fighterId: fighter.id, direction: 0, depthDirection: 0 }),
    ).toBe(true);
    expect(fighter.moveIntent).toBe(0);
  });
  it('accepts Bulbasaur’s fifth skill through the manual command path', () => {
    const e = initializeBattle(
      {
        rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1, duration: 0 },
        players: ['alice', 'bob'],
        teams: [['bulbasaur'], ['charmander']],
      },
      5,
    );
    e.startBattle();
    const [a, b] = e.state.fighters;
    a.x = 400;
    b.x = 620;
    a.depth = b.depth = 0;
    a.thinkIn = b.thinkIn = 100;
    a.invulnerable = b.invulnerable = 0;
    e.setManualMode('alice', true);
    expect(e.command('alice', { type: 'skill', fighterId: a.id, skillId: 'sludge-bomb' })).toBe(
      true,
    );
    expect(a.cast?.skillId).toBe('sludge-bomb');
    step(e, 65);
    expect(e.getBattleSnapshot().groundHazards).toHaveLength(1);
  });
  it('moves automatically in manual mode and pauses movement while guarding', () => {
    const e = engine(),
      [a, b] = e.state.fighters;
    a.x = 250;
    b.x = 1000;
    e.setManualMode('alice', true);
    step(e, 20);
    expect(a.x).toBeGreaterThan(250);
    expect(a.cast).toBeNull();
    expect(e.command('alice', guard(a.id))).toBe(true);
    step(e, 20);
    expect(a.moveIntent).toBe(0);
    expect(Math.abs(a.vx)).toBeLessThan(1);
    expect(e.command('alice', guard(a.id, false))).toBe(true);
    step(e, 2);
    expect(a.moveIntent).not.toBe(0);
    expect(e.setManualMode('alice', false)).toBe(true);
    expect(a.moveIntent).toBe(0);
    expect(a.sprinting).toBe(false);
  });
  it.each(['pikachu', 'charmander', 'squirtle', 'bulbasaur', 'runedrake'] as const)(
    'automatically uses %s basic attack, but no special skill',
    (species) => {
      const e = initializeBattle(
        {
          rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1, duration: 0 },
          players: ['alice', 'bob'],
          teams: [[species], ['squirtle']],
        },
        5,
      );
      e.startBattle();
      const [a, b] = e.state.fighters;
      a.x = 500;
      a.depth = 0;
      b.x = 500 + Math.min(60, POKEMON[species].attackRange * 0.5);
      b.depth = 0;
      b.thinkIn = 100;
      e.setManualMode('alice', true);
      step(e, 1);
      expect(a.cast?.skillId).toBe(POKEMON[species].skills[0].id);
      step(e, 90);
      expect(
        e.state.events
          .filter((event) => event.fighterId === a.id && event.kind === 'skill')
          .every((event) => event.text === POKEMON[species].skills[0].name),
      ).toBe(true);
    },
  );
  it('uses the normal guard, dodge cost, and skill cooldown rules', () => {
    const e = engine(),
      [a] = e.state.fighters;
    a.dodgeCooldown = 0;
    a.invulnerable = 0;
    e.setManualMode('alice', true);
    expect(e.command('alice', { type: 'guard', fighterId: a.id, active: true })).toBe(true);
    expect(a.guarded).toBe(true);
    expect(e.command('alice', { type: 'guard', fighterId: a.id, active: false })).toBe(true);
    expect(e.command('alice', { type: 'dodge', fighterId: a.id, mode: 'dash' })).toBe(true);
    expect(a.stamina).toBe(85);
    expect(e.command('alice', { type: 'dodge', fighterId: a.id, mode: 'dash' })).toBe(false);
    a.actionTime = 0;
    a.dodgeCooldown = 0;
    expect(e.command('alice', { type: 'skill', fighterId: a.id, skillId: 'thunderbolt' })).toBe(
      true,
    );
    expect(a.cast?.skillId).toBe('thunderbolt');
    expect(e.command('alice', { type: 'skill', fighterId: a.id, skillId: 'thunderbolt' })).toBe(
      false,
    );
  });
  it.each(['dash', 'jump', 'crouch'] as const)(
    'allows consecutive %s actions after each animation without a dodge cooldown',
    (mode) => {
      const e = engine();
      const [a, b] = e.state.fighters;
      b.thinkIn = 100;
      a.thinkIn = 100;
      e.setManualMode('alice', true);
      a.dodgeCooldown = 8;
      const command = { type: 'dodge', fighterId: a.id, mode };
      expect(e.command('alice', command)).toBe(true);
      expect(a.stamina).toBe(85);
      expect(a.dodgeCooldown).toBe(0);
      expect(e.command('alice', command)).toBe(false);
      step(e, mode === 'jump' ? 70 : 35);
      expect(a.actionTime).toBe(0);
      expect(a.y).toBe(0);
      const before = a.stamina;
      expect(e.command('alice', command)).toBe(true);
      expect(a.stamina).toBeCloseTo(before - 15);
    },
  );
  it.each([
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [1, -1],
  ])('dashes in the chosen direction (%i, %i) without diagonal speed gain', (x, depth) => {
    const e = engine();
    const [a] = e.state.fighters;
    e.setManualMode('alice', true);
    expect(
      e.command('alice', {
        type: 'dodge',
        fighterId: a.id,
        mode: 'dash',
        direction: x,
        depthDirection: depth,
      }),
    ).toBe(true);
    const speed = Math.hypot(a.vx, a.vDepth);
    expect(speed).toBeGreaterThan(0);
    expect(a.vx / speed).toBeCloseTo(x / Math.hypot(x, depth));
    expect(a.vDepth / speed).toBeCloseTo(depth / Math.hypot(x, depth));
  });
  it('keeps facing as the default dash direction and rejects invalid input', () => {
    const e = engine();
    const [a] = e.state.fighters;
    a.facing = -1;
    e.setManualMode('alice', true);
    expect(e.command('alice', { type: 'dodge', fighterId: a.id, mode: 'dash', direction: 2 })).toBe(
      false,
    );
    expect(
      e.command('alice', { type: 'dodge', fighterId: a.id, mode: 'dash', depthDirection: NaN }),
    ).toBe(false);
    expect(e.command('alice', { type: 'dodge', fighterId: a.id, mode: 'dash' })).toBe(true);
    expect(a.vx).toBeLessThan(0);
    expect(a.vDepth).toBe(0);
  });
  it.each(['dash', 'jump', 'crouch'] as const)(
    'lets a player %s interrupt an AI basic attack immediately',
    (mode) => {
      const e = engine();
      const [a, b] = e.state.fighters;
      a.x = 500;
      a.depth = 0;
      b.x = 550;
      b.depth = 0;
      b.thinkIn = 100;
      e.setManualMode('alice', true);
      step(e, 1);
      expect(a.cast).toMatchObject({ skillId: 'quick-attack', autoBasic: true });
      const before = a.stamina;
      expect(e.command('alice', { type: 'dodge', fighterId: a.id, mode })).toBe(true);
      expect(a.cast).toBeNull();
      expect(a.stamina).toBeCloseTo(before - 15);
      expect(e.state.events.at(-1)?.kind).toBe('dodge');
    },
  );
  it('does not interrupt a skill chosen by the player', () => {
    const e = engine();
    const [a] = e.state.fighters;
    e.setManualMode('alice', true);
    expect(e.command('alice', { type: 'skill', fighterId: a.id, skillId: 'thunderbolt' })).toBe(
      true,
    );
    expect(a.cast?.autoBasic).toBeUndefined();
    const before = a.stamina;
    expect(e.command('alice', { type: 'dodge', fighterId: a.id, mode: 'dash' })).toBe(false);
    expect(a.cast?.skillId).toBe('thunderbolt');
    expect(a.stamina).toBe(before);
  });
  it('keeps automatic-mode dodge cooldowns', () => {
    const e = engine();
    const [a] = e.state.fighters;
    a.dodgeCooldown = 0;
    expect(e.beginDodge(a, 'dash', a.facing)).toBe(true);
    expect(a.dodgeCooldown).toBe(POKEMON[a.species].dodgeCooldown);
    step(e, 20);
    expect(e.beginDodge(a, 'dash', a.facing)).toBe(false);
  });
  it('prevents reserve and fainted Pokémon from receiving commands', () => {
    const e = initializeBattle(
      {
        rules: { ...DEFAULT_RULES, teamSize: 2, activeSize: 1, duration: 0 },
        players: ['alice', 'bob'],
        teams: [
          ['pikachu', 'charmander'],
          ['squirtle', 'bulbasaur'],
        ],
      },
      5,
    );
    e.startBattle();
    e.setManualMode('alice', true);
    const reserve = e.state.fighters.find((f) => f.team === 0 && !f.active)!;
    expect(e.command('alice', move(reserve.id))).toBe(false);
    const active = e.state.fighters.find((f) => f.team === 0 && f.active)!;
    active.hp = 0;
    expect(e.command('alice', move(active.id))).toBe(false);
  });
});

describe('online manual authorization', () => {
  function session() {
    const s = new BattleSession(
      'ABCDEF',
      { ...DEFAULT_RULES, teamSize: 1, activeSize: 1, duration: 60 },
      7,
    );
    s.join('a', 'Alice');
    s.join('b', 'Bob');
    s.select('a', ['pikachu']);
    s.select('b', ['squirtle']);
    s.ready('a', true);
    s.ready('b', true);
    for (let i = 0; i < 182; i++) s.tick(FIXED_DELTA);
    return s;
  }
  it('accepts only the owner’s manual commands and preserves each mode in snapshots', () => {
    const s = session();
    expect(s.engine!.getBattleSnapshot().manualTeams).toEqual([true, true]);
    expect(() => s.manualMode('stranger', true)).toThrow();
    expect(() => s.manualMode('a', 'true')).toThrow();
    s.manualMode('b', false);
    const a = s.engine!.state.fighters.find((f) => f.team === 0)!;
    const b = s.engine!.state.fighters.find((f) => f.team === 1)!;
    expect(s.engine!.getBattleSnapshot().manualTeams).toEqual([true, false]);
    expect(() => s.command('b', move(a.id))).toThrow();
    expect(() => s.command('a', move(b.id))).toThrow();
    expect(() => s.command('a', guard(a.id))).not.toThrow();
    s.manualMode('b', true);
    expect(s.engine!.getBattleSnapshot().manualTeams).toEqual([true, true]);
    s.disconnected('a');
    expect(a.moveIntent).toBe(0);
    expect(s.engine!.state.manualTeams[0]).toBe(true);
  });
  it('authorizes control changes only for the owner and active allies', () => {
    const s = session();
    const a = s.engine!.state.fighters.find((f) => f.team === 0)!;
    const b = s.engine!.state.fighters.find((f) => f.team === 1)!;
    expect(() => s.selectFighter('stranger', a.id)).toThrow();
    expect(() => s.selectFighter('a', b.id)).toThrow();
    expect(() => s.selectFighter('a', 42)).toThrow();
    expect(() => s.selectFighter('a', a.id)).not.toThrow();
  });
  it('applies online control changes to the next battle snapshot and command', () => {
    const s = new BattleSession(
      'ABCDEF',
      { ...DEFAULT_RULES, teamSize: 2, activeSize: 2, duration: 60 },
      7,
    );
    s.join('a', 'Alice');
    s.join('b', 'Bob');
    s.select('a', ['pikachu', 'charmander']);
    s.select('b', ['squirtle', 'bulbasaur']);
    s.ready('a', true);
    s.ready('b', true);
    for (let i = 0; i < 182; i++) s.tick(FIXED_DELTA);
    const [first, second] = s.engine!.state.fighters;
    s.selectFighter('a', second.id);
    expect(s.engine!.getBattleSnapshot().controlledFighterIds[0]).toBe(second.id);
    expect(() => s.command('a', guard(first.id))).toThrow();
    expect(() => s.command('a', guard(second.id))).not.toThrow();
  });
});
