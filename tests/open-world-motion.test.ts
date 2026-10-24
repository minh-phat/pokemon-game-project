import { describe, expect, it } from 'vitest';
import {
  createWorld,
  tileAt,
  canWalkBetween,
  findPath,
  sampleTerrain,
  MAX_TERRAIN_LEVEL,
} from '../apps/frontend/src/game/open-world-world';
import {
  createMotion,
  stepMotion,
  CLIMB_REACH,
  type MotionInput,
} from '../apps/frontend/src/game/open-world-motion';

const base = createWorld(42);
function shelf(rise = 4) {
  const world = { ...base, chunks: new Map() };
  for (let y = 96; y < 128; y++)
    for (let x = 96; x < 128; x++) {
      Object.assign(tileAt(world, x, y)!, {
        level: x >= 103 ? 10 + rise : 10,
        biome: 'meadow',
        water: false,
        lava: false,
        decoration: null,
        prop: -1,
      });
    }
  return world;
}
const input: MotionInput = { x: 1, y: 0, jump: false, climb: false, sprint: false };

describe('vertical exploration', () => {
  it('blocks ordinary walking across a ledge and bounds walking pathfinding by height', () => {
    const world = shelf(),
      state = createMotion(world, { x: 102.7, y: 101.5 });
    for (let i = 0; i < 40; i++) stepMotion(world, state, input, 1 / 60);
    expect(state.position.x).toBeLessThan(103);
    expect(state.z).toBe(10);
    expect(state.action).toBe('blocked');
    expect(canWalkBetween(world, { x: 102.5, y: 101.5 }, { x: 103.5, y: 101.5 })).toBe(false);
    const path = findPath(world, state.position, { x: 104.5, y: 101.5 });
    let previous = state.position;
    for (const next of path) {
      expect(canWalkBetween(world, previous, next)).toBe(true);
      previous = next;
    }
  });
  it.each([2, 3])('jumps onto a %s m shelf and lands on its top', (rise) => {
    const world = shelf(rise),
      state = createMotion(world, { x: 102.4, y: 101.5 });
    let peak = 0;
    for (let i = 0; i < 100; i++) {
      stepMotion(world, state, { ...input, jump: i === 0 }, 1 / 60);
      peak = Math.max(peak, state.z);
    }
    expect(peak).toBeGreaterThan(13);
    expect(state.position.x).toBeGreaterThan(103);
    expect(state.grounded).toBe(true);
    expect(state.z).toBe(10 + rise);
  });
  it('does not jump through a taller wall or double-jump in midair', () => {
    const world = shelf(),
      state = createMotion(world, { x: 102.4, y: 101.5 });
    let peak = 0;
    for (let i = 0; i < 65; i++) {
      stepMotion(world, state, { ...input, jump: i < 60 }, 1 / 60);
      peak = Math.max(peak, state.z);
    }
    expect(peak).toBeLessThan(14);
    expect(state.position.x).toBeLessThan(103);
  });
  it('climbs a 4 m face continuously and ends on a valid shelf', () => {
    const world = shelf(),
      state = createMotion(world, { x: 102.9, y: 101.5 });
    let intermediate = false;
    for (let i = 0; i < 110; i++) {
      stepMotion(world, state, { ...input, climb: true }, 1 / 60);
      intermediate ||= state.action === 'climb' && state.z > 10 && state.z < 14;
    }
    expect(intermediate).toBe(true);
    expect(state.position.x).toBeGreaterThan(103);
    expect(state.z).toBe(14);
    expect(state.grounded).toBe(true);
    expect(state.climbing).toBeNull();
  });
  it('cannot climb a face beyond reach, into lava, or through a trunk', () => {
    for (const obstruction of ['height', 'lava', 'trunk'] as const) {
      const world = shelf(obstruction === 'height' ? CLIMB_REACH + 1 : 4);
      if (obstruction === 'lava') tileAt(world, 103, 101)!.lava = true;
      if (obstruction === 'trunk') tileAt(world, 103, 101)!.decoration = 'tree';
      const state = createMotion(world, { x: 102.9, y: 101.5 });
      for (let i = 0; i < 120; i++) stepMotion(world, state, { ...input, climb: true }, 1 / 60);
      expect(state.position.x).toBeLessThan(103);
      expect(state.z).toBe(10);
    }
  });
  it('falls from a shelf with gravity and lands without sinking into the ground', () => {
    const world = shelf(6),
      state = createMotion(world, { x: 103.3, y: 101.5 });
    let airborne = false;
    for (let i = 0; i < 180; i++) {
      stepMotion(world, state, { ...input, x: -1, jump: i === 0 }, 1 / 60);
      airborne ||=
        !state.grounded && state.z > tileAt(world, state.position.x, state.position.y)!.level;
    }
    expect(airborne).toBe(true);
    expect(state.position.x).toBeLessThan(103);
    expect(state.z).toBe(10);
    expect(state.grounded).toBe(true);
  });
  it('keeps swimming on the water surface and rejects jumping from a boat', () => {
    const world = shelf(0),
      state = createMotion(world, { x: 101.5, y: 101.5 });
    tileAt(world, 101, 101)!.water = true;
    stepMotion(world, state, { ...input, x: 0, jump: true }, 1 / 60);
    expect(state.grounded).toBe(true);
    expect(state.z).toBe(10);
  });
});

describe('local hills and valleys', () => {
  it('has visible relief, climbable terraces, and valley floors beside the drainage network', () => {
    const levels: number[] = [];
    let cliffs = 0,
      valleys = 0;
    for (let y = Math.floor(base.spawn.y) - 36; y < base.spawn.y + 36; y++)
      for (let x = Math.floor(base.spawn.x) - 36; x < base.spawn.x + 36; x++) {
        const a = sampleTerrain(base, x, y),
          b = sampleTerrain(base, x + 1, y);
        levels.push(a.level);
        if (Math.abs(a.level - b.level) >= 3) cliffs++;
        if (a.landform === 'valley') valleys++;
        expect(a.level).toBeLessThanOrEqual(MAX_TERRAIN_LEVEL);
      }
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThanOrEqual(8);
    expect(cliffs).toBeGreaterThan(20);
    expect(valleys).toBeGreaterThan(0);
    expect(tileAt(base, base.spawn.x, base.spawn.y)!.level).toBe(base.campLevel);
  });
});
