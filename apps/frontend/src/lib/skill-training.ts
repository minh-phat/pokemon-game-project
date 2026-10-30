import { BattleEngine } from '@arena/game-core';
import { ARENAS, POKEMON } from '@arena/game-data';
import { DEFAULT_RULES, type SpeciesId } from '@arena/shared-types';

export const TRAINING_HP = 100000;
/** A private simulation; neither the battle feed nor the player's team is changed. */
export function createSkillTraining(species: SpeciesId, skillId: string) {
  const skill = POKEMON[species].skills.find((move) => move.id === skillId);
  if (!skill) throw new Error('Unknown move for this Pokémon');
  const engine = new BattleEngine(
    {
      players: ['training-player', 'training-dummy'],
      teams: [[species], ['squirtle']],
      rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1, duration: 0, elements: false },
      arenaDefinition: {
        ...ARENAS[0],
        obstacles: [],
        surface: undefined,
        spawns: [400, 400 + Math.max(55, Math.min(260, skill.range * 0.65))],
        spawnDepth: 0,
      },
    },
    42,
  );
  engine.startBattle();
  engine.setManualMode('training-player', true);
  engine.setManualMode('training-dummy', true);
  const [attacker, dummy] = engine.state.fighters;
  dummy.hp = TRAINING_HP;
  attacker.thinkIn = dummy.thinkIn = Number.POSITIVE_INFINITY;
  attacker.targetId = dummy.id;
  attacker.actionTime = 0;
  attacker.invulnerable = dummy.invulnerable = 0;
  if (!engine.beginSkill(attacker, skillId)) throw new Error('Unable to start move');
  return engine;
}

export function advanceSkillTraining(engine: BattleEngine, delta: number) {
  // Hits and completed casts reset the normal combat AI timer. Disable decisions
  // before each simulation step so only the explicitly selected move can fire.
  for (let remaining = Math.min(delta, 0.25); remaining > 1e-9; ) {
    const step = Math.min(remaining, 1 / 60);
    for (const fighter of engine.state.fighters) fighter.thinkIn = Number.POSITIVE_INFINITY;
    engine.updateBattle(step);
    remaining -= step;
  }
}
