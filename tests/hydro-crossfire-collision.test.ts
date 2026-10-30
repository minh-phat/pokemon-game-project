import { describe, expect, it } from 'vitest';
import { BattleEngine, FIXED_DELTA } from '@arena/game-core';
import { ARENAS, SKILLS, createHydroDrop, hydroDropPosition } from '@arena/game-data';
import { DEFAULT_RULES, type ArenaDefinition } from '@arena/shared-types';

function setup(obstacles: ArenaDefinition['obstacles'] = []) {
  const engine = new BattleEngine(
    {
      rules: { ...DEFAULT_RULES, teamSize: 2, activeSize: 2 },
      arenaDefinition: { ...ARENAS[0], obstacles, surface: undefined },
      players: ['a', 'b'],
      teams: [
        ['squirtle', 'pikachu'],
        ['charmander', 'eevee'],
      ],
      aiTeams: [],
    },
    42,
  );
  engine.startBattle();
  engine.setManualMode('a', true);
  engine.setManualMode('b', true);
  const [caster, ally, behind, front] = engine.state.fighters;
  for (const fighter of engine.state.fighters) {
    Object.assign(fighter, { active: true, y: 0, depth: 0, invulnerable: 0, thinkIn: 100 });
  }
  caster.x = 350;
  ally.x = 100;
  behind.x = 510;
  front.x = 445;
  expect(engine.beginSkill(caster, 'hydro-crossfire')).toBe(true);
  // Isolate one packet: subsequent emissions cannot mask an incorrect piercing hit.
  Object.assign(caster.cast!, {
    elapsed: SKILLS.hydroCrossfire.startup,
    hydroDrops: [createHydroDrop(0, 0, caster.x, caster.depth)],
    hydroNextEmission: 10000,
  });
  return { engine, caster, behind, front };
}

function advance(engine: BattleEngine, frames = 20) {
  for (let i = 0; i < frames; i++) engine.updateBattle(FIXED_DELTA);
}

describe('Hydro Crossfire blocking', () => {
  it('absorbs water at a thin wall, hides it, and protects targets behind the wall', () => {
    const { engine, caster, front, behind } = setup([
      { id: 'wall', kind: 'rock', x: 415, depth: 0, width: 2, length: 150, height: 100 },
    ]);
    const hp = [front.hp, behind.hp];
    for (let i = 0; i < 20; i++) {
      engine.updateBattle(FIXED_DELTA);
      for (const drop of caster.cast!.hydroDrops!) {
        expect(
          hydroDropPosition(drop, caster.cast!.elapsed - SKILLS.hydroCrossfire.startup).x,
        ).toBeLessThan(414);
      }
    }
    expect(caster.cast!.hydroDrops).toEqual([]);
    expect([front.hp, behind.hp]).toEqual(hp);
    advance(engine);
    expect(caster.cast!.hydroDrops).toEqual([]);
  });

  it('hits only the first opposing creature even when the farther one comes first in the roster', () => {
    const { engine, caster, front, behind } = setup();
    const hp = [front.hp, behind.hp];
    advance(engine);
    expect(front.hp).toBeLessThan(hp[0]);
    expect(behind.hp).toBe(hp[1]);
    expect(caster.cast!.hydroDrops).toEqual([]);
  });

  it('still blocks water when the front creature is invulnerable', () => {
    const { engine, caster, front, behind } = setup();
    front.invulnerable = 2;
    const hp = [front.hp, behind.hp];
    advance(engine);
    expect([front.hp, behind.hp]).toEqual(hp);
    expect(caster.cast!.hydroDrops).toEqual([]);
  });

  it('allows water past a creature outside the stream and reaches the one behind', () => {
    const { engine, front, behind } = setup();
    front.depth = 80;
    const hp = [front.hp, behind.hp];
    advance(engine);
    expect(front.hp).toBe(hp[0]);
    expect(behind.hp).toBeLessThan(hp[1]);
  });
});
