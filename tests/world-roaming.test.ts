import { describe, expect, it } from 'vitest';
import { createWorld, tileAt, WORLD_SIZE } from '@arena/game-data/world';
import {
  createRoamingWorldBattleArena,
  createWorldBattleArena,
  worldBattlePoint,
} from '@arena/game-data/world-combat';
import {
  terrainContact,
  terrainHeight,
  terrainWalkable,
  terrainWater,
} from '@arena/game-data/terrain';
import { createWorldEncounter, applyWorldAction, replayWorldEncounter } from '@arena/game-core';
import type { WorldEncounterTicket, WorldBattleAction } from '@arena/shared-types';
import {
  worldArenaViewport,
  worldArenaPlacement,
  worldCombatOffset,
} from '../apps/frontend/src/game/world-combat-visuals';

const world = createWorld(42);
const origin = world.spawn;
const arena = createRoamingWorldBattleArena(world, origin);
const ticket: WorldEncounterTicket = {
  id: 'roaming',
  combatVersion: 5,
  seed: 777,
  arenaDefinition: arena,
  pet: { id: 'pet', species: 'pikachu', level: 50, quality: 'SS', acquiredAt: '' },
  wild: { id: 1, species: 'pikachu', level: 1, quality: 'C', ...origin },
};
function battlePoint(x: number, y: number) {
  return {
    x: 650 + (x - origin.x - (y - origin.y)) * 64,
    depth: -100 + (x - origin.x + y - origin.y) * 32,
  };
}

describe('roaming world encounters', () => {
  it('samples real terrain beyond the old patch after ticket serialization, with no full-map arrays', () => {
    const geometry = JSON.parse(JSON.stringify(arena));
    expect(JSON.stringify(geometry).length).toBeLessThan(50000);
    for (const landmark of world.landmarks) {
      for (let i = -8; i <= 8; i++) {
        const pos = { x: Math.floor(landmark.x) + i + 0.5, y: Math.floor(landmark.y) + 0.5 };
        const p = battlePoint(pos.x, pos.y);
        const tile = tileAt(world, pos.x, pos.y)!;
        expect(terrainHeight(geometry, p)).toBe((tile.level - arena.worldTerrain!.baseLevel) * 32);
        expect(terrainWater(geometry, p)).toBe(Boolean(tile.water));
        expect(terrainWalkable(geometry, p, 4)).toBe(
          !tile.lava && !['tree', 'pine', 'rock'].includes(tile.decoration ?? ''),
        );
        const roundtrip = worldBattlePoint(origin, p.x, p.depth);
        expect(roundtrip.x).toBeCloseTo(pos.x);
        expect(roundtrip.y).toBeCloseTo(pos.y);
      }
    }
    for (const pos of [
      { x: -1, y: origin.y },
      { x: WORLD_SIZE, y: origin.y },
      { x: origin.x, y: -1 },
      { x: origin.x, y: WORLD_SIZE },
    ])
      expect(terrainWalkable(geometry, battlePoint(pos.x, pos.y))).toBe(false);
    expect(world.chunks.size).toBeLessThanOrEqual(64);
  });

  it.each(['left', 'right', 'up', 'down'] as const)('walks through the old %s boundary', (side) => {
    const engine = createWorldEncounter(ticket);
    const [pet, enemy] = engine.state.fighters;
    engine.setManualMode('trainer', true);
    engine.setManualMode('wild', true);
    const horizontal = side === 'left' || side === 'right';
    const sign = side === 'left' || side === 'up' ? -1 : 1;
    const edge = horizontal ? (sign < 0 ? 55 : 1145) : sign < 0 ? -300 : 200;
    let start: { x: number; depth: number } | undefined;
    for (let offset = horizontal ? -250 : 120; offset < (horizontal ? 180 : 1100); offset += 16) {
      const a = horizontal
        ? { x: edge - sign * 24, depth: offset }
        : { x: offset, depth: edge - sign * 24 };
      const b = horizontal
        ? { x: edge + sign * 80, depth: offset }
        : { x: offset, depth: edge + sign * 80 };
      const y = terrainHeight(arena, a);
      if (terrainContact(arena, { ...a, y }, { ...b, y }, 4) === 1) {
        start = a;
        break;
      }
    }
    expect(start).toBeDefined();
    const height = terrainHeight(arena, start!);
    Object.assign(pet, start, { y: height, groundHeight: height, vx: 0, vDepth: 0 });
    Object.assign(enemy, { x: pet.x + 2000, depth: pet.depth + 2000 });
    for (let i = 0; i < 120; i++) {
      engine.command('trainer', {
        type: 'move',
        fighterId: pet.id,
        direction: horizontal ? sign : 0,
        depthDirection: horizontal ? 0 : sign,
      });
      engine.updateBattle(1 / 60);
    }
    expect(((horizontal ? pet.x : pet.depth) - edge) * sign).toBeGreaterThan(30);
  });

  it.each([-2000, 2000])('keeps projectiles alive outside the old arena at x=%i', (x) => {
    const engine = createWorldEncounter(ticket);
    const [owner, enemy] = engine.state.fighters;
    engine.setManualMode('trainer', true);
    engine.setManualMode('wild', true);
    Object.assign(owner, { x, depth: 0, y: terrainHeight(arena, { x, depth: 0 }) + 2000 });
    Object.assign(enemy, { x: x + 2000, depth: 2000 });
    engine.state.projectiles.push({
      id: 'distant-shot',
      ownerId: owner.id,
      team: 0,
      skillId: 'thunderbolt',
      x,
      previousX: x,
      depth: 0,
      y: owner.y,
      vx: 20,
      vDepth: 0,
      width: 20,
      height: 16,
      life: 2,
    });
    engine.updateBattle(1 / 60);
    expect(engine.state.projectiles.some((p) => p.id === 'distant-shot')).toBe(true);
  });

  it('replays serialized roaming tickets and movement commands exactly while preserving legacy bounds', () => {
    const value = JSON.parse(JSON.stringify(ticket)) as WorldEncounterTicket;
    const engine = createWorldEncounter(value);
    const actions: WorldBattleAction[] = [{ tick: 0, type: 'mode', manual: true }];
    for (let tick = 0; tick < 180; tick += 6)
      actions.push({
        tick,
        type: 'command',
        command: { type: 'move', fighterId: '0-0', direction: 0, depthDirection: -1 },
      });
    actions.push({ tick: 180, type: 'mode', manual: false });
    let index = 0;
    while (engine.state.phase === 'battle') {
      while (actions[index]?.tick === engine.state.tick) applyWorldAction(engine, actions[index++]);
      engine.updateBattle(1 / 60);
    }
    expect(replayWorldEncounter(value, actions, engine.state.tick)).toEqual(engine.state);
    const old = createWorldEncounter({
      ...ticket,
      combatVersion: 4,
      arenaDefinition: createWorldBattleArena(world, origin),
    });
    expect(old.state.arenaDefinition!.bounds).toEqual([55, 1145]);
    expect(old.state.arenaDefinition!.worldTerrain).toBeUndefined();
  });

  it('keeps sprites and effects aligned in a moving, zoomed view far from the battle origin', () => {
    const center = { x: -4800, y: 6200 };
    const view = worldArenaViewport(center, 1800, 1200, 4 / 3);
    const placement = worldArenaPlacement(133, 244, view);
    for (const height of [-600, 0, 1000]) {
      const fighter = { x: -4700, depth: 5800 };
      const offset = worldCombatOffset(fighter.x, fighter.depth, height);
      expect(placement.x + (fighter.x - view.left!) * 0.25).toBeCloseTo(133 + offset.x);
      expect(placement.y + (520 + fighter.depth - height - view.top) * 0.25).toBeCloseTo(
        244 + offset.y,
      );
    }
    expect(view.width).toBeGreaterThan(1800);
    expect(view.height).toBeGreaterThan(1200);
    expect(view.width / view.height).toBeCloseTo(4 / 3);
  });
});
