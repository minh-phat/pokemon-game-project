import { describe, expect, it } from 'vitest';
import {
  worldArenaView,
  worldArenaPlacement,
  worldCombatOffset,
} from '../apps/frontend/src/game/world-combat-visuals';
import { ARENAS, fighterDefinition } from '@arena/game-data';
import { createWorld, tileAt } from '@arena/game-data/world';
import { createWorldBattleArena, worldBattlePoint } from '@arena/game-data/world-combat';
import {
  BattleEngine,
  terrainHeight,
  terrainContact,
  terrainRoute,
  createWorldEncounter,
  replayWorldEncounter,
} from '@arena/game-core';
import {
  DEFAULT_RULES,
  type ArenaDefinition,
  type WorldEncounterTicket,
} from '@arena/shared-types';
import { tacticalPosition, terrainSight } from '../packages/game-core/src/navigation';

function arena(height: number): ArenaDefinition {
  return {
    ...ARENAS[0],
    obstacles: [{ id: 'shelf', kind: 'rock', x: 650, depth: -50, width: 260, length: 500, height }],
  };
}
function battle(geometry: ArenaDefinition, automatic = false) {
  const e = new BattleEngine(
    {
      rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1 },
      arenaDefinition: geometry,
      players: ['a', 'b'],
      teams: [['pikachu'], ['squirtle']],
      aiTeams: [0, 1],
    },
    21,
  );
  e.startBattle();
  const [a, b] = e.state.fighters;
  Object.assign(a, {
    x: 450,
    depth: -100,
    y: 0,
    groundHeight: 0,
    moveIntent: 1,
    thinkIn: automatic ? 0 : 1000,
  });
  Object.assign(b, { x: 1000, depth: -100, thinkIn: 1000 });
  for (const f of [a, b])
    for (const skill of fighterDefinition(f).skills) f.cooldowns[skill.id] = 1000;
  return e;
}

describe('shared terrain traversal', () => {
  it.each([52, 144])(
    'crosses a %i-high shelf and falls back onto the lower floor without clipping',
    (height) => {
      const geometry = arena(height),
        e = battle(geometry),
        f = e.state.fighters[0];
      const actions = new Set<string>();
      let reached = false,
        landed = false;
      for (let i = 0; i < 330; i++) {
        e.updateBattle(1 / 60);
        if (f.traversal) actions.add(f.traversal);
        if (f.x > 560 && f.x < 740 && f.y >= height) reached = true;
        if (f.x > 830 && f.y === 0) landed = true;
        if (!f.climbing)
          expect(terrainContact(geometry, f, f, fighterDefinition(f).collision.width / 2)).toBe(1);
      }
      expect(actions.has(height === 52 ? 'jump' : 'climb')).toBe(true);
      expect(actions.has('fall')).toBe(true);
      expect(reached).toBe(true);
      expect(landed).toBe(true);
    },
  );
  it('continues falling while dashing off a raised shelf', () => {
    const e = battle(arena(144)),
      f = e.state.fighters[0];
    Object.assign(f, { x: 760, y: 144, groundHeight: 144, dodgeCooldown: 0, moveIntent: 0 });
    expect(e.beginDodge(f, 'dash', 1)).toBe(true);
    let airborneDuringDash = false;
    for (let i = 0; i < 120; i++) {
      e.updateBattle(1 / 60);
      airborneDuringDash ||= f.actionTime > 0 && f.y < 144 && f.traversal === 'fall';
    }
    expect(airborneDuringDash).toBe(true);
    expect(f.y).toBe(0);
  });
  it('autonomous AI climbs to pursue an opponent on a raised platform', () => {
    const geometry = arena(144),
      e = battle(geometry, true),
      [f, target] = e.state.fighters;
    Object.assign(target, { x: 690, y: 144, groundHeight: 144 });
    let climbing = false,
      reached = false;
    for (let i = 0; i < 600; i++) {
      e.updateBattle(1 / 60);
      climbing ||= f.traversal === 'climb';
      reached ||= f.x > 530 && f.groundHeight === 144 && !f.climbing;
    }
    expect(climbing).toBe(true);
    expect(reached).toBe(true);
  });
  it('does not climb an unreachable cliff or enter a forbidden perimeter', () => {
    const geometry = arena(400),
      e = battle(geometry);
    for (let i = 0; i < 240; i++) e.updateBattle(1 / 60);
    expect(e.state.fighters[0].x).toBeLessThan(520);
    expect(e.state.fighters[0].y).toBe(0);
    expect(
      terrainRoute(geometry, { x: 450, depth: -100 }, { x: 900, depth: -100 }, 20).every(
        (p) => p.x < 520,
      ),
    ).toBe(true);
  });
  it('interrupts climbing on stun and falls instead of completing the climb', () => {
    const e = battle(arena(144)),
      f = e.state.fighters[0];
    for (let i = 0; i < 120 && !f.climbing; i++) e.updateBattle(1 / 60);
    expect(f.climbing).toBeDefined();
    for (let i = 0; i < 15; i++) e.updateBattle(1 / 60);
    f.effects.push({ kind: 'stun', duration: 2, strength: 1, sourceId: '1-0' });
    e.updateBattle(1 / 60);
    expect(f.climbing).toBeUndefined();
    for (let i = 0; i < 90; i++) e.updateBattle(1 / 60);
    expect(f.y).toBe(0);
    expect(f.x).toBeLessThan(520);
  });
  it('lets high shots clear low cover while ground shots hit it', () => {
    const geometry = arena(52);
    expect(
      terrainContact(geometry, { x: 450, depth: -100, y: 80 }, { x: 900, depth: -100, y: 80 }),
    ).toBe(1);
    expect(
      terrainContact(geometry, { x: 450, depth: -100, y: 25 }, { x: 900, depth: -100, y: 25 }),
    ).toBeLessThan(1);
  });
  it('selects actual cover while under ranged pressure', () => {
    const geometry = {
      ...ARENAS[0],
      obstacles: [
        {
          id: 'cover',
          kind: 'rock' as const,
          x: 600,
          depth: -100,
          width: 60,
          length: 80,
          height: 144,
        },
      ],
    };
    const e = battle(geometry),
      [f, target] = e.state.fighters;
    Object.assign(f, { x: 680, depth: 20 });
    Object.assign(target, { x: 400, depth: -100 });
    target.cast = { skillId: 'water-gun', elapsed: 0, fired: 0, hitIds: [] };
    const p = tacticalPosition(geometry, f, target, e.state);
    expect(p).not.toBeNull();
    expect(terrainSight(geometry, p!, target)).toBe(false);
  });
  it('all arena types expose reachable low and high terrain', () => {
    for (const a of ARENAS) {
      expect(a.obstacles?.some((o) => o.climbable !== false && o.height < 90)).toBe(true);
      expect(a.obstacles?.some((o) => o.climbable !== false && o.height > 90)).toBe(true);
    }
  });
});

describe('world battle geography', () => {
  it('keeps actors and effects aligned when the render canvas expands for tall cliffs', () => {
    const world = createWorld(128),
      geometry = createWorldBattleArena(world, world.spawn);
    geometry.surface!.heights[0] = 1000;
    geometry.surface!.heights[1] = -600;
    const view = worldArenaView(geometry),
      placement = worldArenaPlacement(133, 244, view);
    expect(view.top).toBeLessThan(220 - 1000);
    expect(view.top + view.height).toBeGreaterThan(720 + 600);
    const offset = worldCombatOffset(600, -100, 1000);
    expect(placement.y + (520 - 100 - 1000 - view.top) * 0.25).toBe(244 + offset.y);
  });
  it.each([64, 192])(
    'crosses a sampled %i-high world ledge and descends below the encounter origin',
    (height) => {
      const geometry: ArenaDefinition = {
        ...ARENAS[0],
        obstacles: undefined,
        surface: {
          origin: { x: 0, depth: -350 },
          axisX: { x: 100, depth: 0 },
          axisZ: { x: 0, depth: 100 },
          columns: 12,
          rows: 6,
          heights: Array.from({ length: 72 }, (_, i) =>
            i % 12 >= 5 && i % 12 < 8 ? height : i % 12 >= 8 ? -64 : 0,
          ),
          blocked: Array(72).fill(false),
          stepHeight: 32,
          climbHeight: 256,
        },
      };
      const e = battle(geometry),
        f = e.state.fighters[0];
      const actions = new Set<string>();
      let reached = false;
      for (let i = 0; i < 340; i++) {
        e.updateBattle(1 / 60);
        if (f.traversal) actions.add(f.traversal);
        reached ||= f.x > 550 && f.x < 750 && f.groundHeight === height;
        if (!f.climbing) expect(f.y).toBeGreaterThanOrEqual(terrainHeight(geometry, f) - 0.01);
      }
      expect(reached).toBe(true);
      expect(actions.has(height === 64 ? 'jump' : 'climb')).toBe(true);
      expect(f.y).toBe(-64);
    },
  );
  it('blocks even a short step into a cliff or a lava tile', () => {
    const geometry: ArenaDefinition = {
      ...ARENAS[0],
      obstacles: undefined,
      surface: {
        origin: { x: 0, depth: -350 },
        axisX: { x: 100, depth: 0 },
        axisZ: { x: 0, depth: 100 },
        columns: 12,
        rows: 6,
        heights: Array.from({ length: 72 }, (_, i) => (i % 12 >= 5 ? 400 : 0)),
        blocked: Array(72).fill(false),
        stepHeight: 32,
        climbHeight: 256,
      },
    };
    expect(
      terrainContact(geometry, { x: 499, depth: -100, y: 32 }, { x: 501, depth: -100, y: 32 }),
    ).toBeLessThan(1);
    geometry.surface!.heights.fill(0);
    geometry.surface!.blocked[2 * 12 + 5] = true;
    expect(
      terrainContact(geometry, { x: 499, depth: -100, y: 100 }, { x: 501, depth: -100, y: 100 }),
    ).toBeLessThan(1);
  });

  it('samples the same elevation as exploration at combat positions', () => {
    const world = createWorld(128),
      origin = world.spawn,
      geometry = createWorldBattleArena(world, origin);
    const base = tileAt(world, origin.x, origin.y)!.level;
    for (const x of [100, 350, 650, 1000])
      for (const depth of [-250, -100, 150]) {
        const p = worldBattlePoint(origin, x, depth);
        expect(terrainHeight(geometry, { x, depth })).toBe(
          (tileAt(world, p.x, p.y)!.level - base) * 32,
        );
      }
  });
  it('replays a serialized world heightfield exactly on the server', () => {
    const world = createWorld(128),
      p = world.spawn;
    const ticket: WorldEncounterTicket = {
      id: 'terrain',
      combatVersion: 3,
      seed: 71,
      arenaDefinition: createWorldBattleArena(world, p),
      pet: {
        id: 'owned',
        species: 'pikachu',
        level: 10,
        quality: 'A',
        experience: 0,
        acquiredAt: '2026-01-01',
      },
      wild: { id: 1, species: 'charmander', level: 2, quality: 'C', x: p.x, y: p.y },
    };
    const e = createWorldEncounter(ticket);
    while (e.state.phase === 'battle') e.updateBattle(1 / 60);
    expect(replayWorldEncounter(JSON.parse(JSON.stringify(ticket)), [], e.state.tick)).toEqual(
      e.state,
    );
  });
});
