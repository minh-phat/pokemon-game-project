import { describe, expect, it } from 'vitest';
import {
  createWorld,
  CITY_BUILDINGS,
  CITY_BUILDING_HALF_SIZE,
  CITY_RING_RADIUS,
  cityDistance,
  citySurface,
  CITY_GATES,
  canWalkBetween,
  tileAt,
  traversable,
  insideCity,
  updateWildlife,
} from '@arena/game-data/world';
import {
  createRoamingWorldBattleArena,
  sampleWorldBattleTerrain,
} from '@arena/game-data/world-combat';
import { createMotion, stepMotion } from '../apps/frontend/src/game/open-world-motion';

describe('Bình Minh sanctuary', () => {
  it.each([0, 42, 90210])(
    'seed %s has flat, unobstructed routes from the portal through all four gates',
    (seed) => {
      const world = createWorld(seed);
      expect(tileAt(world, world.spawn.x, world.spawn.y)?.citySurface).toBe('plaza');
      for (const gate of CITY_GATES) {
        let previous = world.spawn;
        for (let d = 1; d <= 37; d++) {
          const next = {
            x: world.spawn.x + Math.sign(gate.x) * d,
            y: world.spawn.y + Math.sign(gate.y) * d,
          };
          expect(canWalkBetween(world, previous, next)).toBe(true);
          expect(tileAt(world, next.x, next.y)?.water).toBe(false);
          previous = next;
        }
      }
      for (const b of CITY_BUILDINGS.filter((b) => b.sprite !== 7))
        expect(traversable(world, world.spawn.x + b.x, world.spawn.y + b.y)).toBe(false);
    },
  );
  it('keeps every building foundation off carriageways and uses green only for parks', () => {
    for (const b of CITY_BUILDINGS) {
      for (const dx of [-CITY_BUILDING_HALF_SIZE, CITY_BUILDING_HALF_SIZE])
        for (const dy of [-CITY_BUILDING_HALF_SIZE, CITY_BUILDING_HALF_SIZE]) {
          const x = b.x + dx,
            y = b.y + dy;
          expect(Math.min(Math.abs(x), Math.abs(y))).toBeGreaterThan(2.05);
          expect(Math.abs(cityDistance(x, y) - CITY_RING_RADIUS)).toBeGreaterThan(1.7);
          expect(citySurface(x, y)).not.toBe('road');
        }
      expect(citySurface(b.x, b.y)).toBe(b.sprite === 7 ? 'garden' : 'pavement');
    }
  });
  it('blocks jumping and climbing through the field while permitting the gate', () => {
    const world = createWorld(42);
    for (const y of [0, 8]) {
      const state = createMotion(world, { x: world.spawn.x + 30, y: world.spawn.y + y });
      for (let i = 0; i < 120; i++)
        stepMotion(world, state, { x: 1, y: 0, sprint: true, jump: i === 0, climb: true }, 1 / 60);
      if (y === 0) expect(state.position.x).toBeGreaterThan(world.spawn.x + 33);
      else expect(state.position.x).toBeLessThan(world.spawn.x + 32);
    }
  });
  it('keeps wild populations outside, including at open gateways', () => {
    const world = createWorld(42);
    const outsiders = world.wildlife.filter(
      (a) => !insideCity(a.home.x - world.spawn.x, a.home.y - world.spawn.y),
    );
    expect(outsiders.length).toBeGreaterThan(0);
    const actor = outsiders[0];
    actor.x = world.spawn.x + 32.1;
    actor.y = world.spawn.y;
    actor.home = { x: world.spawn.x + 33, y: world.spawn.y };
    actor.leader = actor.id;
    actor.phase = Math.PI;
    for (let i = 0; i < 100; i++) updateWildlife(world, actor, 0.1, i * 0.1);
    expect(insideCity(actor.x - world.spawn.x, actor.y - world.spawn.y)).toBe(false);
    expect(
      world.wildlife.filter((a) => insideCity(a.x - world.spawn.x, a.y - world.spawn.y)),
    ).toHaveLength(3);
  });
  it('versions city terrain so archived combat tickets retain their original terrain', () => {
    for (const version of [0, 1, 2] as const) {
      const world = createWorld(42, 2, version);
      const arena = JSON.parse(JSON.stringify(createRoamingWorldBattleArena(world, world.spawn)));
      if (version === 0) delete arena.worldTerrain.cityVersion;
      expect(sampleWorldBattleTerrain(arena, 650, -100)?.tile).toEqual(
        tileAt(world, world.spawn.x, world.spawn.y),
      );
    }
  });
});
