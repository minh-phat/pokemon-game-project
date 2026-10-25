import { describe, expect, it } from 'vitest';
import { createWorldEncounter, replayWorldEncounter } from '@arena/game-core';
import { decideAction } from '@arena/game-ai';
import { POKEMON, ARENAS } from '@arena/game-data';
import type { SpeciesId, WorldEncounterTicket, Projectile } from '@arena/shared-types';
import {
  worldCombatOffset,
  worldArenaPlacement,
  WORLD_ARENA_VIEW,
  WORLD_COMBAT_HEIGHT_SCALE,
} from '../apps/frontend/src/game/world-combat-visuals';

function ticket(species: SpeciesId = 'pikachu', seed = 1): WorldEncounterTicket {
  return {
    id: 'test',
    combatVersion: 2,
    seed,
    pet: { id: 'owned', species, level: 10, quality: 'C', acquiredAt: '' },
    wild: { id: 1, species: 'pikachu', level: 10, quality: 'C', x: 0, y: 0 },
  };
}
function setup(species: SpeciesId = 'pikachu') {
  const engine = createWorldEncounter(ticket(species));
  const [pet, enemy] = engine.state.fighters;
  Object.assign(pet, { x: 500, depth: 0, dodgeCooldown: 0, actionTime: 0, thinkIn: 0 });
  Object.assign(enemy, { x: 900, depth: 0 });
  return { engine, pet, enemy };
}
function projectile(x: number, y: number): Projectile {
  return {
    id: 'threat',
    ownerId: '1-0',
    team: 1,
    skillId: 'thunderbolt',
    x,
    previousX: x,
    depth: 0,
    y,
    vx: -500,
    vDepth: 0,
    width: 20,
    height: 16,
    life: 2,
  };
}

describe('tactical world Auto', () => {
  it('enables full advanced AI for both sides while keeping older replay tickets compatible', () => {
    const current = createWorldEncounter(ticket());
    expect(current.config.aiTeams).toEqual([0, 1]);
    expect(current.state.rules.difficulty).toBe('hard');
    expect(current.state.manualTeams).toEqual([false, false]);
    expect(
      createWorldEncounter({ ...ticket(), combatVersion: undefined }).state.rules.difficulty,
    ).toBe('normal');
  });
  it('jumps sideways over a low projectile, including defensive species', () => {
    for (const species of ['pikachu', 'squirtle'] as const) {
      const { engine, pet } = setup(species);
      engine.state.projectiles.push(projectile(680, 18));
      const action = decideAction(pet, engine.state, () => 0, 'hard');
      expect(action).toMatchObject({ type: 'dodge', mode: 'jump', direction: 0 });
      if (action.type === 'dodge') expect(Math.abs(action.depthDirection!)).toBe(1);
    }
  });
  it('crouches when a high projectile is too close to jump over', () => {
    const { engine, pet } = setup();
    engine.state.projectiles.push(projectile(550, 48));
    expect(decideAction(pet, engine.state, () => 0, 'hard')).toMatchObject({
      type: 'dodge',
      mode: 'crouch',
    });
  });
  it('leaves a ranged windup firing line before attacking', () => {
    const { engine, pet, enemy } = setup();
    enemy.x = 700;
    enemy.aimX = -1;
    enemy.aimDepth = 0;
    enemy.cast = { skillId: 'thunderbolt', elapsed: 0.01, fired: 0, hitIds: [] };
    expect(decideAction(pet, engine.state, () => 0, 'hard')).toMatchObject({
      type: 'move',
      state: 'MaintainDistance',
      direction: 0,
    });
  });
  it('dodges a beam sideways into the arena instead of through its edge', () => {
    const { engine, pet } = setup();
    pet.depth = 185;
    engine.state.beams = [
      {
        ownerId: '1-0',
        team: 1,
        skillId: 'solar-beam',
        startX: 200,
        startDepth: 185,
        endX: 1000,
        endDepth: 185,
        width: 30,
      },
    ];
    const action = decideAction(pet, engine.state, () => 0, 'hard');
    expect(action).toMatchObject({ type: 'dodge', mode: 'dash', direction: 0, depthDirection: -1 });
    if (action.type === 'dodge') {
      const bounds = ARENAS.find((a) => a.id === engine.state.rules.arena)!.depthBounds;
      expect(pet.depth + action.depthDirection! * 200).toBeGreaterThan(bounds[0]);
      expect(pet.depth + action.depthDirection! * 200).toBeLessThan(bounds[1]);
    }
    pet.stamina = 0;
    expect(decideAction(pet, engine.state, () => 0, 'hard')).toMatchObject({
      type: 'move',
      sprint: false,
    });
  });
  it('escapes enemy ground damage, respects dodge cooldown and ignores friendly areas', () => {
    const { engine, pet } = setup();
    engine.state.groundHazards = [
      {
        id: 'fire',
        ownerId: '1-0',
        team: 1,
        skillId: 'flame-burst',
        x: 470,
        depth: 0,
        radius: 80,
        duration: 3,
        pulse: 0,
      },
    ];
    expect(decideAction(pet, engine.state, () => 0, 'hard')).toMatchObject({
      type: 'dodge',
      mode: 'dash',
      direction: 1,
    });
    pet.dodgeCooldown = 1;
    expect(decideAction(pet, engine.state, () => 0, 'hard').type).toBe('move');
    pet.dodgeCooldown = 0;
    engine.state.groundHazards[0].team = 0;
    expect(decideAction(pet, engine.state, () => 0, 'hard').type).not.toBe('dodge');
  });
  it('actually uses skills, lateral movement, dashes and jumps without manual commands, with exact replay', () => {
    const skills = new Set<string>();
    let jumps = 0,
      dashes = 0,
      moved = false;
    for (let seed = 1; seed <= 10; seed++) {
      const value = ticket('pikachu', seed),
        engine = createWorldEncounter(value);
      let lastId = 0;
      while (engine.state.phase === 'battle') {
        engine.updateBattle(1 / 60);
        moved ||= Math.abs(engine.state.fighters[0].depth + 100) > 60;
        for (const event of engine.state.events.filter((e) => e.id > lastId)) {
          lastId = event.id;
          if (event.fighterId !== '0-0') continue;
          if (event.kind === 'skill') skills.add(event.text);
          if (event.kind === 'dodge' && event.text.includes('jumps')) jumps++;
          if (event.kind === 'dodge' && event.text.includes('dashes')) dashes++;
        }
      }
      expect(replayWorldEncounter(value, [], engine.state.tick)).toEqual(engine.state);
    }
    expect(skills.size).toBe(POKEMON.pikachu.skills.length);
    expect(jumps).toBeGreaterThan(0);
    expect(dashes).toBeGreaterThan(0);
    expect(moved).toBe(true);
  });
});

describe('world combat presentation', () => {
  it('preserves jump height and both movement axes at the same scale as arena effects', () => {
    const ground = worldCombatOffset(500, -50);
    const jump = worldCombatOffset(500, -50, 80);
    expect(jump.x).toBe(ground.x);
    expect(ground.y - jump.y).toBe(20);
    expect(worldCombatOffset(600, -50).x - ground.x).toBe(25);
    expect(worldCombatOffset(500, 50).y - ground.y).toBe(25);
  });
  it('aligns composited arena feet and projectiles with world ground, including camera headroom', () => {
    const origin = { x: 133, y: 244 };
    const layer = worldArenaPlacement(origin.x, origin.y);
    for (const [x, depth, height] of [
      [650, -100, 0],
      [450, -200, 80],
      [900, 100, 50],
    ]) {
      const point = worldCombatOffset(x, depth, height);
      expect(layer.x + x * WORLD_COMBAT_HEIGHT_SCALE).toBe(origin.x + point.x);
      expect(
        layer.y + (520 + depth - height - WORLD_ARENA_VIEW.top) * WORLD_COMBAT_HEIGHT_SCALE,
      ).toBe(origin.y + point.y);
    }
  });
});
