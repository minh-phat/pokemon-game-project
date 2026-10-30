import { describe, expect, it } from 'vitest';
import { ROSTER } from '@arena/game-data';
import {
  advanceSkillTraining,
  createSkillTraining,
  TRAINING_HP,
} from '../apps/frontend/src/lib/skill-training';

describe('skill training', () => {
  for (const pokemon of ROSTER) {
    for (const skill of pokemon.skills) {
      it(`${pokemon.name}: ${skill.id} casts against a passive dummy`, () => {
        const engine = createSkillTraining(pokemon.id, skill.id);
        expect(engine.state.fighters[0].cast?.skillId).toBe(skill.id);
        for (let frame = 0; frame < 1200; frame++) advanceSkillTraining(engine, 1 / 60);
        expect(engine.state.fighters[1].damageDealt).toBe(0);
        expect(engine.state.fighters[1].hp).toBeGreaterThan(0);
        expect(engine.state.fighters[0].cast).toBeNull();
        if (skill.damagePercent > 0 && skill.id !== 'counter-pounce') {
          expect(engine.state.fighters[1].hp).toBeLessThan(TRAINING_HP);
        }
        const fresh = createSkillTraining(pokemon.id, skill.id);
        expect(fresh.state.elapsed).toBe(0);
        expect(fresh.state.fighters[1].hp).toBe(TRAINING_HP);
      });
    }
  }
});
