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
import { ARENAS, POKEMON, SKILLS } from '@arena/game-data';
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

describe('arena ground-plane movement', () => {
  it.each([
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ])('moves along direction (%s, %s) without jumping or gaining diagonal speed', (dx, dz) => {
    const e = battle();
    const [f, other] = e.state.fighters;
    f.x = 600;
    f.depth = -100;
    f.thinkIn = other.thinkIn = 100;
    const length = Math.hypot(dx, dz);
    f.moveIntent = dx / length;
    f.moveDepth = dz / length;
    step(e, 0.25);
    expect(Math.sign(f.x - 600)).toBe(dx);
    expect(Math.sign(f.depth + 100)).toBe(dz);
    expect(Math.hypot(f.vx, f.vDepth)).toBeLessThanOrEqual(POKEMON[f.species].speed + 1e-8);
    expect(f.y).toBe(0);
  });
  it('chases a target diagonally using ground distance', () => {
    const e = battle();
    const [a, b] = e.state.fighters;
    a.depth = -200;
    b.depth = 0;
    const action = decideAction(a, e.state, () => 0.99);
    expect(action.type).toBe('move');
    if (action.type === 'move') {
      expect(action.direction).toBeGreaterThan(0);
      expect(action.depthDirection).toBeGreaterThan(0);
      expect(Math.hypot(action.direction, action.depthDirection!)).toBeCloseTo(1);
    }
  });
  it('clamps depth while keeping jumps independent', () => {
    const e = battle();
    const f = e.state.fighters[0];
    f.thinkIn = 100;
    f.moveDepth = -1;
    f.y = 100;
    step(e, 2);
    expect(f.depth).toBe(ARENAS[0].depthBounds[0]);
    expect(f.y).toBe(0);
    f.moveDepth = 1;
    step(e, 3);
    expect(f.depth).toBe(ARENAS[0].depthBounds[1]);
  });
  it('does not collide with bodies or melee attacks on a different row', () => {
    const e = battle();
    const [a, b] = e.state.fighters;
    a.x = b.x = 600;
    a.depth = -210;
    b.depth = 10;
    a.thinkIn = b.thinkIn = 100;
    a.invulnerable = b.invulnerable = 0;
    const hp = b.hp;
    e.beginSkill(a, 'quick-attack');
    step(e, 0.2);
    expect(b.hp).toBe(hp);
    expect(b.x).toBe(600);
  });
  it.each([0, 150])('sweeps vertical projectiles with lateral offset %s', (offset) => {
    const e = battle();
    const [a, b] = e.state.fighters;
    a.x = 600;
    b.x = 600 + offset;
    a.depth = -210;
    b.depth = 0;
    a.thinkIn = b.thinkIn = 100;
    b.invulnerable = 0;
    const hp = b.hp;
    e.state.projectiles.push({
      id: 'vertical',
      ownerId: a.id,
      team: 0,
      skillId: 'thunderbolt',
      x: 600,
      previousX: 600,
      depth: -150,
      previousDepth: -150,
      vDepth: 660,
      y: 28,
      vx: 0,
      width: 28,
      height: 26,
      life: 1,
    });
    expect(predictThreat(b, e.state.projectiles[0]) !== null).toBe(offset === 0);
    step(e, 0.3);
    expect(b.hp < hp).toBe(offset === 0);
  });
});

it('hits with a melee attack aimed along arena depth', () => {
  const e = battle();
  const [a, b] = e.state.fighters;
  a.x = b.x = 600;
  a.depth = -150;
  b.depth = -90;
  a.aimX = 0;
  a.aimDepth = 1;
  a.thinkIn = b.thinkIn = 100;
  a.invulnerable = b.invulnerable = 0;
  const hp = b.hp;
  expect(e.beginSkill(a, 'quick-attack')).toBe(true);
  step(e, 0.2);
  expect(b.hp).toBeLessThan(hp);
});

describe('varied AI routes', () => {
  it.each(speciesIds)(
    '%s changes rows during a real battle starting on the same row',
    (species) => {
      const e = battle([[species], [species]], { duration: 60 });
      const f = e.state.fighters[0];
      let min = f.depth,
        max = f.depth,
        verticalTravel = 0,
        horizontalTravel = 0;
      let upward = false,
        downward = false;
      for (let i = 0; i < 15 * 60 && e.state.phase === 'battle'; i++) {
        const x = f.x,
          depth = f.depth;
        e.updateBattle(FIXED_DELTA);
        min = Math.min(min, f.depth);
        max = Math.max(max, f.depth);
        verticalTravel += Math.abs(f.depth - depth);
        horizontalTravel += Math.abs(f.x - x);
        upward ||= f.vDepth < -30;
        downward ||= f.vDepth > 30;
      }
      expect(max - min).toBeGreaterThan(70);
      expect(verticalTravel).toBeGreaterThan(horizontalTravel * 0.25);
      expect(upward && downward).toBe(true);
    },
  );
  it.each(ARENAS[0].depthBounds)('steers back into the arena from depth %s', (depth) => {
    const e = battle();
    const [a, b] = e.state.fighters;
    a.depth = b.depth = depth;
    for (const skill of POKEMON[a.species].skills) a.cooldowns[skill.id] = 10;
    const action = decideAction(a, e.state, () => 0.99);
    expect(action.type).toBe('move');
    if (action.type === 'move')
      expect(Math.sign(action.depthDirection!)).toBe(depth === ARENAS[0].depthBounds[0] ? 1 : -1);
  });
});

describe('basic guard', () => {
  function guardedBattle(species: SpeciesId = 'pikachu') {
    const e = battle([[species], ['squirtle']], { switching: false });
    for (const f of e.state.fighters) {
      f.thinkIn = 999;
      f.invulnerable = 0;
      f.depth = 0;
    }
    return e;
  }
  function shoot(e: ReturnType<typeof battle>, skillId = 'water-gun') {
    const [target, source] = e.state.fighters;
    e.state.projectiles.push({
      id: `guard-test-${e.state.tick}`,
      ownerId: source.id,
      team: source.team,
      skillId,
      x: target.x,
      previousX: target.x,
      depth: target.depth,
      y: 28,
      vx: 0,
      width: 28,
      height: 26,
      life: 1,
    });
    e.updateBattle(FIXED_DELTA);
    return e.state.events.filter((v) => v.kind === 'damage').at(-1)!.value!;
  }
  it.each(speciesIds)(
    '%s can guard continuously for free and repeat without cooldown',
    (species) => {
      const e = guardedBattle(species),
        f = e.state.fighters[0];
      f.energy = 0;
      f.dodgeCooldown = 10;
      expect(e.setGuard(f, true)).toBe(true);
      expect(f.energy).toBe(0);
      expect(f.dodgeCooldown).toBe(10);
      step(e, 2);
      expect(f.guarded).toBe(true);
      expect(f.animation).toBe('guard');
      expect(f.actionTime).toBe(0);
      for (let i = 0; i < 10; i++) {
        expect(e.setGuard(f, false)).toBe(true);
        expect(e.setGuard(f, true)).toBe(true);
      }
      expect(POKEMON[species].animations.guard.repeat).toBe(-1);
      expect(POKEMON[species].animations.guard.end).toBeGreaterThan(
        POKEMON[species].animations.guard.start,
      );
    },
  );
  it.each(speciesIds)(
    '%s takes 20% reduced direct damage and keeps guarding repeated hits',
    (species) => {
      const e = guardedBattle(species),
        f = e.state.fighters[0];
      e.setGuard(f, true);
      const expected = calculateDamage(
        SKILLS.waterGun.damage,
        POKEMON.squirtle.attack,
        POKEMON[species].defense,
        'water',
        POKEMON[species].element,
        true,
        0.2,
      );
      for (let i = 0; i < 3; i++) {
        expect(shoot(e)).toBe(expected);
        expect(f.guarded).toBe(true);
        expect(f.animation).toBe('guard');
        expect(f.state).toBe('Guard');
      }
      expect(e.state.events.filter((v) => v.kind === 'guard')).toHaveLength(1);
    },
  );
  it('uses the stronger shield without adding guard reductions together', () => {
    const e = guardedBattle(),
      f = e.state.fighters[0];
    e.setGuard(f, true);
    f.effects.push({ kind: 'shield', duration: 2, strength: 0.55 });
    expect(shoot(e)).toBe(
      calculateDamage(
        SKILLS.waterGun.damage,
        POKEMON.squirtle.attack,
        POKEMON.pikachu.defense,
        'water',
        'electric',
        true,
        0.55,
      ),
    );
  });
  it('reduces ongoing damage but does not grant status immunity', () => {
    const e = guardedBattle(),
      f = e.state.fighters[0];
    e.setGuard(f, true);
    f.effects.push({ kind: 'burn', duration: 2, strength: 5, pulse: 1 });
    const hp = f.hp;
    e.updateBattle(FIXED_DELTA);
    expect(hp - f.hp).toBe(4);
    shoot(e, 'thunderbolt');
    expect(f.effects.some((v) => v.kind === 'stun')).toBe(true);
    expect(f.guarded).toBe(false);
    expect(e.setGuard(f, true)).toBe(false);
  });
  it('leaves guard when attacking and rejects guard during a cast or after fainting', () => {
    const e = guardedBattle(),
      f = e.state.fighters[0];
    e.setGuard(f, true);
    expect(e.beginSkill(f, 'quick-attack')).toBe(true);
    expect(f.guarded).toBe(false);
    expect(e.setGuard(f, true)).toBe(false);
    f.cast = null;
    f.hp = 0;
    expect(e.setGuard(f, true)).toBe(false);
  });
  it.each(speciesIds)(
    '%s AI can guard during dodge cooldown and keep guarding a threat',
    (species) => {
      const e = guardedBattle(species),
        f = e.state.fighters[0];
      f.dodgeCooldown = 99;
      e.state.projectiles.push({
        id: 'threat',
        ownerId: e.state.fighters[1].id,
        team: 1,
        skillId: 'water-gun',
        x: f.x + 80,
        previousX: f.x + 80,
        depth: f.depth,
        y: 28,
        vx: -200,
        width: 28,
        height: 26,
        life: 2,
      });
      expect(decideAction(f, e.state, () => 0)).toEqual({ type: 'guard' });
      e.setGuard(f, true);
      expect(decideAction(f, e.state, () => 1)).toEqual({ type: 'guard' });
      f.thinkIn = 0;
      e.updateBattle(FIXED_DELTA);
      expect(f.guarded).toBe(true);
      e.state.projectiles = [];
      f.thinkIn = 0;
      e.updateBattle(FIXED_DELTA);
      expect(f.guarded).toBe(false);
    },
  );
});
