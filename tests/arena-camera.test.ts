import { expect, it } from 'vitest';
import { initializeBattle } from '@arena/game-core';
import { DEFAULT_RULES } from '@arena/shared-types';
import { automaticCameraFrame } from '../apps/frontend/src/game/arena-camera';

function battle() {
  const engine = initializeBattle(
    {
      rules: { ...DEFAULT_RULES, teamSize: 1, activeSize: 1 },
      players: ['alice', 'bob'],
      teams: [['pikachu'], ['squirtle']],
    },
    5,
  );
  engine.startBattle();
  const snapshot = engine.getBattleSnapshot();
  snapshot.fighters[0].x = 200;
  snapshot.fighters[1].x = 1800;
  return snapshot;
}
const arena = { width: 2400, height: 1200 };

it('follows the local controlled Pokémon, observes survivors, and resumes on return', () => {
  const snapshot = battle();
  const [own, opponent] = snapshot.fighters;
  snapshot.manualTeams[0] = true;
  snapshot.controlledFighterIds[0] = own.id;
  expect(automaticCameraFrame(snapshot, 0, arena, 1200, 760).x).toBe(own.x);
  own.hp = 0;
  expect(automaticCameraFrame(snapshot, 0, arena, 1200, 760).x).toBe(opponent.x);
  own.hp = 100;
  own.active = false;
  expect(automaticCameraFrame(snapshot, 0, arena, 1200, 760).x).toBe(opponent.x);
  own.active = true;
  expect(automaticCameraFrame(snapshot, 0, arena, 1200, 760).x).toBe(own.x);
  snapshot.manualTeams[0] = false;
  expect(automaticCameraFrame(snapshot, 0, arena, 1200, 760).x).toBe(1000);
  snapshot.manualTeams[1] = true;
  snapshot.controlledFighterIds[1] = opponent.id;
  expect(automaticCameraFrame(snapshot, 1, arena, 1200, 760).x).toBe(opponent.x);
});

it('fits the whole group in portrait and landscape, including jumps and depth', () => {
  const snapshot = battle();
  snapshot.manualTeams = [false, false];
  snapshot.fighters[0].depth = -250;
  snapshot.fighters[0].y = 200;
  snapshot.fighters[1].depth = 500;
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    const frame = automaticCameraFrame(snapshot, 0, arena, width, height);
    expect(frame.x - width / (2 * frame.zoom)).toBeLessThanOrEqual(frame.left);
    expect(frame.x + width / (2 * frame.zoom)).toBeGreaterThanOrEqual(frame.right);
    expect(frame.y - height / (2 * frame.zoom)).toBeLessThanOrEqual(frame.top);
    expect(frame.y + height / (2 * frame.zoom)).toBeGreaterThanOrEqual(frame.bottom);
    snapshot.fighters[1].x = 300;
    expect(automaticCameraFrame(snapshot, 0, arena, width, height).zoom).toBeGreaterThanOrEqual(
      frame.zoom,
    );
    snapshot.fighters[1].x = 1800;
  }
});

it('shows the arena when empty and observes all fighters for a spectator', () => {
  const snapshot = battle();
  expect(automaticCameraFrame(snapshot, -1, arena, 1200, 760).x).toBe(1000);
  snapshot.fighters.forEach((f) => {
    f.active = false;
  });
  const frame = automaticCameraFrame(snapshot, 0, arena, 1200, 760);
  expect(frame.x).toBe(1200);
  expect(frame.y).toBe(600);
  expect(frame.zoom).toBe(0.5);
});
