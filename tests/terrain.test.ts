import { describe, expect, it } from 'vitest';
import { ARENAS, POKEMON, RUINS_ART, ruinsPoint } from '@arena/game-data';
import { DEFAULT_RULES } from '@arena/shared-types';
import { initializeBattle, terrainContact, terrainMove, terrainWaypoint } from '@arena/game-core';
const arena = ARENAS.find((a) => a.id === 'ruins')!;
function battle() {
  const e = initializeBattle(
    {
      rules: { ...DEFAULT_RULES, arena: 'ruins', teamSize: 4, activeSize: 4 },
      players: ['a', 'b'],
      teams: [
        ['pikachu', 'charmander', 'squirtle', 'bulbasaur'],
        ['pikachu', 'charmander', 'squirtle', 'bulbasaur'],
      ],
    },
    42,
  );
  e.startBattle();
  return e;
}
describe('citadel terrain', () => {
  it('spawns eight fighters safely on their team platforms', () => {
    const e = battle();
    expect(e.state.fighters.filter((f) => f.active)).toHaveLength(8);
    for (const f of e.state.fighters) {
      expect(f.x).toBe(arena.spawns[f.team]);
      expect(terrainContact(arena, f, f, POKEMON[f.species].collision.width / 2)).toBe(1);
    }
  });
  it('sweeps fast movement against rocks, both wall arms, columns and perimeter', () => {
    for (const o of arena.obstacles!.filter((o) => !o.id.startsWith('perimeter-'))) {
      const a = { x: o.x - o.width / 2 - 80, depth: o.depth };
      const b = { x: o.x + o.width / 2 + 100, depth: o.depth };
      expect(terrainContact(arena, a, b, 20)).toBeLessThan(1);
      expect(terrainMove(arena, a, b, 20).x).toBeLessThan(o.x - o.width / 2 - 19);
    }
    expect(
      terrainMove(arena, ruinsPoint(120, 395), ruinsPoint(-500, 395), 20).x,
    ).toBeGreaterThanOrEqual(arena.bounds[0] + 20);
  });
  it('keeps the platform exit open and blocks the side walls and river', () => {
    expect(terrainContact(arena, ruinsPoint(120, 395), ruinsPoint(400, 395), 29)).toBe(1);
    expect(terrainContact(arena, ruinsPoint(1820, 395), ruinsPoint(1540, 395), 29)).toBe(1);
    expect(terrainContact(arena, ruinsPoint(120, 395), ruinsPoint(120, 240), 29)).toBeLessThan(1);
    expect(terrainContact(arena, ruinsPoint(1820, 395), ruinsPoint(1820, 570), 29)).toBeLessThan(1);
    expect(terrainContact(arena, ruinsPoint(970, 620), ruinsPoint(970, 750), 29)).toBeLessThan(1);
  });
  it('finds a traversable route around a rock', () => {
    let p = ruinsPoint(500, 265);
    const target = ruinsPoint(750, 265);
    for (let i = 0; i < 10 && Math.hypot(p.x - target.x, p.depth - target.depth) > 1; i++) {
      const next = terrainWaypoint(arena, p, target, 25);
      expect(terrainContact(arena, p, next, 25)).toBe(1);
      expect(next).not.toEqual(p);
      p = next;
    }
    expect(p).toEqual(target);
  });
  it('removes a projectile crossing a pillar without damaging the fighter behind it', () => {
    const e = battle();
    const [source] = e.state.fighters;
    const target = e.state.fighters[4];
    Object.assign(source, ruinsPoint(450, 425));
    Object.assign(target, ruinsPoint(650, 425));
    target.invulnerable = 0;
    for (const f of e.state.fighters) f.thinkIn = 100;
    const hp = target.hp;
    e.state.projectiles.push({
      id: 'wall-test',
      ownerId: source.id,
      team: 0,
      skillId: 'electro-ball',
      x: 490 * RUINS_ART.scale,
      previousX: 490 * RUINS_ART.scale,
      y: 30,
      depth: ruinsPoint(0, 425).depth,
      vx: 18000,
      width: 20,
      height: 20,
      life: 1,
    });
    e.updateBattle(1 / 60);
    expect(e.state.projectiles).toHaveLength(0);
    expect(target.hp).toBe(hp);
  });
  it.each(['runedrake', 'squirtle'] as const)(
    'clips %s’s sustained beam at a pillar and protects the target behind it',
    (species) => {
      const e = initializeBattle(
        {
          rules: { ...DEFAULT_RULES, arena: 'ruins', teamSize: 1, activeSize: 1 },
          players: ['a', 'b'],
          teams: [[species], ['charmander']],
        },
        1,
      );
      e.startBattle();
      const [a, b] = e.state.fighters;
      Object.assign(a, ruinsPoint(430, 425));
      Object.assign(b, ruinsPoint(650, 425));
      a.thinkIn = b.thinkIn = 100;
      a.invulnerable = b.invulnerable = 0;
      const hp = b.hp;
      expect(e.beginSkill(a, species === 'squirtle' ? 'aqua-barrage' : 'dragon-laser')).toBe(true);
      for (let i = 0; i < 70; i++) e.updateBattle(1 / 60);
      expect(e.state.beams).toHaveLength(1);
      expect(e.state.beams![0].endX).toBeLessThanOrEqual(525 * RUINS_ART.scale);
      expect(b.hp).toBe(hp);
    },
  );
  it('blocks rushing skills and melee damage across the narrow L wall', () => {
    const e = battle();
    const a = e.state.fighters[0],
      b = e.state.fighters[4];
    Object.assign(a, ruinsPoint(1000, 270));
    Object.assign(b, ruinsPoint(1110, 270));
    for (const f of e.state.fighters) f.thinkIn = 100;
    a.invulnerable = b.invulnerable = 0;
    const hp = b.hp;
    expect(e.beginSkill(a, 'volt-tackle')).toBe(true);
    for (let i = 0; i < 60; i++) e.updateBattle(1 / 60);
    expect(a.x).toBeLessThan(1043 * RUINS_ART.scale - POKEMON[a.species].collision.width / 2);
    expect(b.hp).toBe(hp);
  });
  it('keeps all fighters outside obstacles throughout an eight-fighter match', () => {
    const e = battle();
    for (let i = 0; i < 3600; i++) {
      e.updateBattle(1 / 60);
      if (i % 60 === 0)
        for (const f of e.state.fighters.filter((f) => f.active && f.hp > 0))
          expect(
            terrainContact(arena, f, f, POKEMON[f.species].collision.width / 2),
            JSON.stringify({ tick: i, f }),
          ).toBe(1);
    }
    expect(e.state.fighters.some((f) => f.damageDealt > 0)).toBe(true);
  });
});
