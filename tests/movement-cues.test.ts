import { describe, expect, it } from 'vitest';
import { initializeBattle, FIXED_DELTA } from '@arena/game-core';
import { DEFAULT_RULES, speciesIds } from '@arena/shared-types';

describe('summoned creature movement sound events', () => {
  it.each(speciesIds)(
    '%s emits exactly one wind cue on a successful dash, backstep or jump',
    (species) => {
      for (const [mode, direction] of [
        ['dash', 1],
        ['dash', -1],
        ['jump', 1],
      ] as const) {
        const engine = initializeBattle(
          {
            rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1 },
            players: ['a', 'b'],
            teams: [[species], ['squirtle']],
          },
          42,
        );
        engine.startBattle();
        const [fighter, opponent] = engine.state.fighters;
        fighter.dodgeCooldown = 0;
        fighter.thinkIn = opponent.thinkIn = 100;
        const cues = () => engine.state.events.filter((event) => event.movement);
        expect(engine.beginDodge(fighter, mode, direction)).toBe(true);
        expect(cues()).toHaveLength(1);
        expect(cues()[0]).toMatchObject({ fighterId: fighter.id, movement: mode });
        expect(engine.beginDodge(fighter, mode, direction)).toBe(false);
        engine.updateBattle(FIXED_DELTA);
        expect(cues()).toHaveLength(1);
      }
    },
  );

  it('plays one wind cue throughout a skill dash, rather than one per simulation frame', () => {
    const engine = initializeBattle(
      {
        rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1 },
        players: ['a', 'b'],
        teams: [['eevee'], ['squirtle']],
      },
      42,
    );
    engine.startBattle();
    const [fighter, target] = engine.state.fighters;
    fighter.x = 400;
    target.x = 550;
    fighter.depth = target.depth = 0;
    fighter.thinkIn = target.thinkIn = 100;
    expect(engine.beginSkill(fighter, 'shadow-step')).toBe(true);
    for (let i = 0; i < 40; i++) engine.updateBattle(FIXED_DELTA);
    expect(engine.state.events.filter((event) => event.kind === 'movement')).toEqual([
      expect.objectContaining({ fighterId: fighter.id, movement: 'dash' }),
    ]);
  });

  it('does not emit wind for crouching or rejected actions', () => {
    const engine = initializeBattle(
      {
        rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1 },
        players: ['a', 'b'],
        teams: [['squirtle'], ['pikachu']],
      },
      42,
    );
    engine.startBattle();
    const fighter = engine.state.fighters[0];
    fighter.dodgeCooldown = 0;
    fighter.stamina = 0;
    expect(engine.beginDodge(fighter, 'dash', 1)).toBe(false);
    fighter.stamina = fighter.maxStamina;
    expect(engine.beginDodge(fighter, 'crouch', 1)).toBe(true);
    expect(engine.state.events.filter((event) => event.movement)).toHaveLength(0);
  });
});
