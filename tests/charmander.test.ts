import { expect, it } from 'vitest';
import { SKILL_BY_ID } from '@arena/game-data';
import type { Fighter } from '@arena/shared-types';
import { charmanderCastFrame } from '../apps/frontend/src/game/charmander';

function pose(skillId: string, elapsed: number, animation: Fighter['animation'] = 'cast') {
  return charmanderCastFrame({
    animation,
    cast: { skillId, elapsed, fired: 0, hitIds: [] },
  });
}

it('fire release coincides with startup completion for short and charged spells', () => {
  for (const id of ['ember', 'flamethrower', 'flame-burst']) {
    const { startup } = SKILL_BY_ID[id];
    expect(pose(id, 0)).toBe(36);
    expect(pose(id, startup - 0.001)).toBe(38);
    expect(pose(id, startup)).toBe(39);
  }
});

it('holds the mouth open for the entire three-second fire channel, then recovers', () => {
  const { startup, active, recovery } = SKILL_BY_ID['inferno-stream'];
  for (const elapsed of [startup, startup + 1, startup + active - 0.001]) {
    expect(pose('inferno-stream', elapsed)).toBe(39);
  }
  expect(pose('inferno-stream', startup + active)).toBe(40);
  expect(pose('inferno-stream', startup + active + recovery)).toBe(41);
});

it('aligns claw contact with damage and leaves locomotion to the animation player', () => {
  expect(pose('scratch', SKILL_BY_ID.scratch.startup, 'attack')).toBe(33);
  expect(charmanderCastFrame({ animation: 'run', cast: null })).toBeNull();
});
