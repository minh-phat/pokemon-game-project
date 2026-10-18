import { describe, expect, it } from 'vitest';
import {
  initializeBattle,
  calculateDamage,
  fighterBox,
  overlaps,
  seededRandom,
  FIXED_DELTA,
} from '@arena/game-core';
import { decideAction, predictThreat } from '@arena/game-ai';
import {
  DEFAULT_RULES,
  RulesSchema,
  validateTeam,
  speciesIds,
  type MatchRules,
  type SpeciesId,
  type Projectile,
} from '@arena/shared-types';
import { POKEMON, SKILLS } from '@arena/game-data';
function battle(
  teams: [SpeciesId[], SpeciesId[]] = [['pikachu'], ['charmander']],
  rules: Partial<MatchRules> = {},
  seed = 42,
) {
  const engine = initializeBattle(
    {
      rules: { ...DEFAULT_RULES, teamSize: teams[0].length, activeSize: 1, ...rules },
      players: ['a', 'b'],
      teams,
      aiTeams: [1],
    },
    seed,
  );
  engine.startBattle();
  return engine;
}
function step(engine: ReturnType<typeof battle>, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) engine.updateBattle(FIXED_DELTA);
}
describe('rules and contracts', () => {
  it('rejects invalid active size, duration, and unknown settings', () => {
    expect(RulesSchema.safeParse({ ...DEFAULT_RULES, teamSize: 1, activeSize: 2 }).success).toBe(
      false,
    );
    expect(RulesSchema.safeParse({ ...DEFAULT_RULES, duration: 4 }).success).toBe(false);
    expect(RulesSchema.safeParse({ ...DEFAULT_RULES, damage: 999 }).success).toBe(false);
  });
  it('requires complete legal teams and honors optional duplicates', () => {
    expect(() => validateTeam(['pikachu'], DEFAULT_RULES)).toThrow();
    expect(() => validateTeam(['pikachu', 'pikachu'], DEFAULT_RULES)).toThrow();
    expect(
      validateTeam(['pikachu', 'pikachu'], { ...DEFAULT_RULES, duplicates: true }),
    ).toHaveLength(2);
    expect(() => validateTeam(['mew', 'pikachu'], DEFAULT_RULES)).toThrow();
  });
});
describe('damage and hit geometry', () => {
  it('scales damage with attack, defense, effectiveness, and guard', () => {
    const normal = calculateDamage(25, 25, 20, 'fire', 'grass', false);
    expect(calculateDamage(25, 25, 40, 'fire', 'grass', false)).toBeLessThan(normal);
    expect(calculateDamage(25, 25, 20, 'fire', 'grass', true)).toBeGreaterThan(normal);
    expect(calculateDamage(25, 25, 20, 'fire', 'water', true)).toBeLessThan(normal);
    expect(calculateDamage(25, 25, 20, 'fire', 'grass', false, 0.65)).toBeLessThan(normal / 2);
  });
  it('jumping clears a low shot and crouching clears a high shot', () => {
    const f = battle().state.fighters[0];
    const low = { left: f.x - 10, right: f.x + 10, bottom: 4, top: 24 };
    const high = { ...low, bottom: 32, top: 56 };
    expect(overlaps(fighterBox(f), low)).toBe(true);
    f.y = 30;
    expect(overlaps(fighterBox(f), low)).toBe(false);
    f.y = 0;
    f.crouched = true;
    expect(overlaps(fighterBox(f), high)).toBe(false);
    expect(overlaps(fighterBox(f), low)).toBe(true);
  });
  it('does not deal melee damage before its startup event, then hits once', () => {
    const e = battle();
    const [a, b] = e.state.fighters;
    a.x = 500;
    b.x = 555;
    for (const f of [a, b]) {
      f.invulnerable = 0;
      f.thinkIn = 100;
    }
    const hp = b.hp;
    expect(e.beginSkill(a, 'quick-attack')).toBe(true);
    step(e, 0.1);
    expect(b.hp).toBe(hp);
    step(e, 0.1);
    expect(b.hp).toBeLessThan(hp);
    const after = b.hp;
    step(e, 0.2);
    expect(b.hp).toBe(after);
  });
  it('uses actual projectile collision and respects invulnerability', () => {
    const e = battle();
    const [a, b] = e.state.fighters;
    a.x = 400;
    b.x = 500;
    a.thinkIn = b.thinkIn = 100;
    b.invulnerable = 5;
    const p: Projectile = {
      id: 'test',
      ownerId: a.id,
      team: 0,
      skillId: 'thunderbolt',
      x: 460,
      previousX: 460,
      y: 28,
      vx: 660,
      width: 28,
      height: 26,
      life: 1,
    };
    e.state.projectiles.push(p);
    const hp = b.hp;
    step(e, 0.2);
    expect(b.hp).toBe(hp);
    b.invulnerable = 0;
    e.state.projectiles = [{ ...p, id: 'test2', x: 460, previousX: 460, life: 1 }];
    step(e, 0.2);
    expect(b.hp).toBeLessThan(hp);
  });
  it('applies gravity, ground landing, and safe arena bounds', () => {
    const e = battle();
    const f = e.state.fighters[0];
    f.thinkIn = 100;
    f.y = 100;
    f.vy = 100;
    f.x = 1140;
    f.vx = 500;
    f.actionTime = 2;
    step(e, 1);
    expect(f.y).toBe(0);
    expect(f.vy).toBe(0);
    expect(f.x).toBeLessThanOrEqual(1145);
  });
  it('separates intersecting character bodies', () => {
    const e = battle();
    const [a, b] = e.state.fighters;
    a.x = 500;
    b.x = 510;
    a.thinkIn = b.thinkIn = 100;
    e.updateBattle(FIXED_DELTA);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(41);
  });
});
describe('skills and state', () => {
  it.each(
    Object.values(POKEMON).flatMap((p) => p.skills.map((s) => ({ species: p.id, skill: s.id }))),
  )('$species activates $skill and resolves a real hit', ({ species, skill }) => {
    const e = battle([[species], ['charmander']]);
    const [a, b] = e.state.fighters;
    const s = POKEMON[species].skills.find((v) => v.id === skill)!;
    a.x = 400;
    b.x = s.behavior === 'projectile' || s.behavior === 'debuff' ? 600 : 470;
    for (const f of [a, b]) {
      f.thinkIn = 100;
      f.invulnerable = 0;
    }
    const hp = b.hp;
    expect(e.beginSkill(a, skill)).toBe(true);
    step(e, 2);
    expect(b.hp).toBeLessThan(hp);
  });
  it('charges energy once, enforces cooldowns and disallows foreign skills', () => {
    const e = battle();
    const a = e.state.fighters[0];
    a.thinkIn = 100;
    expect(e.beginSkill(a, 'thunderbolt')).toBe(true);
    expect(a.energy).toBe(80);
    expect(e.beginSkill(a, 'thunderbolt')).toBe(false);
    step(e, 1);
    expect(a.cooldowns.thunderbolt).toBeGreaterThan(2);
    expect(e.beginSkill(a, 'thunderbolt')).toBe(false);
    expect(e.beginSkill(a, 'solar-beam')).toBe(false);
    a.energy = 0;
    expect(e.beginSkill(a, 'volt-tackle')).toBe(false);
  });
  it('regenerates energy and expires cooldowns', () => {
    const e = battle();
    const a = e.state.fighters[0];
    a.thinkIn = 100;
    a.energy = 0;
    a.cooldowns.thunderbolt = 0.5;
    step(e, 1);
    expect(a.energy).toBeCloseTo(6.5);
    expect(a.cooldowns.thunderbolt).toBe(0);
  });
  it('stun cancels a cast and wears off', () => {
    const e = battle();
    const a = e.state.fighters[0];
    e.beginSkill(a, 'thunderbolt');
    a.effects.push({ kind: 'stun', duration: 0.2, strength: 1 });
    e.updateBattle(FIXED_DELTA);
    expect(a.cast).toBeNull();
    expect(a.state).toBe('Stunned');
    step(e, 0.25);
    expect(a.effects).toHaveLength(0);
  });
  it('Leech Seed transfers actual health and fainting deploys a reserve', () => {
    const e = battle(
      [
        ['bulbasaur', 'pikachu'],
        ['charmander', 'squirtle'],
      ],
      { switching: false },
    );
    const a = e.state.fighters[0],
      b = e.state.fighters[2];
    a.hp = 50;
    a.thinkIn = b.thinkIn = 100;
    b.hp = 3;
    b.effects = [{ kind: 'leech', duration: 2, strength: 4, sourceId: a.id, pulse: 0.99 }];
    e.updateBattle(FIXED_DELTA);
    expect(b.state).toBe('Fainted');
    expect(b.active).toBe(false);
    expect(e.state.fighters[3].active).toBe(true);
    expect(a.hp).toBe(53);
  });
  it('supports protective buff behaviors', () => {
    const e = battle([['squirtle'], ['pikachu']]);
    const a = e.state.fighters[0];
    a.thinkIn = 100;
    expect(e.beginSkill(a, 'rapid-spin')).toBe(true);
    step(e, 0.2);
    expect(a.effects.some((s) => s.kind === 'shield')).toBe(true);
  });
  it('switches a weakened unit only when enabled', () => {
    const e = battle([
      ['pikachu', 'squirtle'],
      ['charmander', 'bulbasaur'],
    ]);
    const a = e.state.fighters[0];
    a.hp = 10;
    a.swapCooldown = 0;
    a.thinkIn = 100;
    e.updateBattle(FIXED_DELTA);
    expect(a.active).toBe(false);
    expect(e.state.fighters[1].active).toBe(true);
  });
});
describe('AI and determinism', () => {
  it('predicts incoming shots while ignoring outgoing and allied shots', () => {
    const f = battle().state.fighters[0];
    const p: Projectile = {
      id: 'p',
      ownerId: '1-0',
      team: 1,
      skillId: 'ember',
      x: f.x + 200,
      previousX: f.x + 200,
      y: 20,
      vx: -500,
      width: 28,
      height: 20,
      life: 1,
    };
    expect(predictThreat(f, p)).toBeCloseTo(0.332);
    expect(predictThreat(f, { ...p, vx: 500 })).toBeNull();
    expect(predictThreat(f, { ...p, team: 0 })).toBeNull();
  });
  it('jumps over predicted low attacks and crouches beneath high attacks', () => {
    const e = battle();
    const f = e.state.fighters[0];
    f.dodgeCooldown = 0;
    e.state.projectiles = [
      {
        id: 'p',
        ownerId: '1-0',
        team: 1,
        skillId: 'ember',
        x: f.x + 150,
        previousX: f.x + 150,
        y: 10,
        vx: -400,
        width: 20,
        height: 12,
        life: 1,
      },
    ];
    expect(decideAction(f, e.state, () => 0)).toMatchObject({ type: 'dodge', mode: 'jump' });
    e.state.projectiles[0].x = f.x + 40;
    e.state.projectiles[0].y = 45;
    expect(decideAction(f, e.state, () => 0)).toMatchObject({ type: 'dodge', mode: 'crouch' });
  });
  it('has distinguishable ranged retreat and aggressive chase decisions', () => {
    const e = battle([['bulbasaur'], ['charmander']]);
    const [a, b] = e.state.fighters;
    a.x = 500;
    b.x = 560;
    for (const s of POKEMON[a.species].skills) a.cooldowns[s.id] = 2;
    expect(decideAction(a, e.state, () => 0)).toMatchObject({ type: 'move', state: 'Retreat' });
    b.x = 1000;
    expect(decideAction(b, e.state, () => 0)).toMatchObject({ type: 'move', state: 'Chase' });
  });
  it('repeats exact snapshots and seeded RNG sequences', () => {
    const a = battle(),
      b = battle();
    step(a, 15);
    step(b, 15);
    expect(a.getBattleSnapshot()).toEqual(b.getBattleSnapshot());
    const r = seededRandom(11),
      s = seededRandom(11);
    expect(Array.from({ length: 20 }, () => r())).toEqual(Array.from({ length: 20 }, () => s()));
  });
  it('reset restores selection phase and reproducible battle results', () => {
    const e = battle();
    step(e, 8);
    const previous = e.getBattleSnapshot();
    e.resetBattle();
    expect(e.state.phase).toBe('selection');
    e.startBattle();
    step(e, 8);
    expect(e.getBattleSnapshot()).toEqual(previous);
  });
});
describe('complete matches', () => {
  it.each(speciesIds)('completes a real %s match without state manipulation', (id) => {
    const e = battle([[id], ['squirtle']], { duration: 60 });
    step(e, 61);
    expect(e.state.phase).toBe('finished');
    expect(e.state.result).not.toBeNull();
    expect(e.state.fighters.some((f) => f.damageDealt > 0)).toBe(true);
  });
  it('handles simultaneous 4v4 with reserves disabled by active size', () => {
    const e = battle([[...speciesIds], [...speciesIds]], { activeSize: 4, duration: 60 });
    step(e, 61);
    expect(e.state.phase).toBe('finished');
    expect(e.state.fighters.every((f) => f.hp >= 0)).toBe(true);
    expect(e.state.fighters.every((f) => Number.isFinite(f.x) && Number.isFinite(f.y))).toBe(true);
  });
  it('ends unlimited battles through roster elimination', () => {
    const e = battle([['pikachu'], ['charmander']], { duration: 0 });
    step(e, 240);
    expect(e.state.result?.reason).toBe('elimination');
  });
  it.each(speciesIds.flatMap((a) => speciesIds.map((b) => [a, b] as const)))(
    'unlimited %s vs %s cannot stall',
    (a, b) => {
      const e = battle([[a], [b]], { duration: 0 });
      step(e, 300);
      expect(e.state.result?.reason).toBe('elimination');
    },
  );
  it('resolves time limits by normalized health then survivors', () => {
    const e = battle([['pikachu'], ['squirtle']], { duration: 60 });
    e.state.elapsed = 60;
    e.state.fighters[0].hp = POKEMON.pikachu.hp * 0.8;
    e.state.fighters[1].hp = POKEMON.squirtle.hp * 0.7;
    expect(e.determineWinner()).toMatchObject({ winner: 0, reason: 'time' });
    e.state.fighters[0].hp = 0;
    e.state.fighters[1].hp = 0;
    expect(e.determineWinner()).toMatchObject({ winner: 'draw', reason: 'elimination' });
  });
});
