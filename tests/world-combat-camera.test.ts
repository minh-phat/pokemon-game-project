import { describe, expect, it } from 'vitest';
import { initializeBattle } from '@arena/game-core';
import { DEFAULT_RULES } from '@arena/shared-types';
import { automaticCameraFrame } from '../apps/frontend/src/game/arena-camera';
import {
  worldArenaViewport,
  worldArenaPlacement,
  WORLD_COMBAT_HEIGHT_SCALE,
} from '../apps/frontend/src/game/world-combat-visuals';

function cameraHarness(width: number, height: number) {
  const battle = initializeBattle(
    {
      rules: { ...DEFAULT_RULES, teamSize: 2, activeSize: 2 },
      players: ['you', 'ai'],
      teams: [
        ['squirtle', 'pikachu'],
        ['charmander', 'eevee'],
      ],
    },
    42,
  );
  battle.startBattle();
  battle.setManualMode('you', true);
  return {
    snapshot: battle.state,
    frame: () => automaticCameraFrame(battle.state, 0, { width: 1200 }, width, height, 'world'),
  };
}

describe('manual combat camera in the open world', () => {
  it.each([
    [1440, 1000],
    [390, 844],
    [844, 390],
  ])('follows movement beyond every original arena edge at %i × %i', (width, height) => {
    const { frame, snapshot } = cameraHarness(width, height);
    const fighter = snapshot.fighters[0];
    snapshot.controlledFighterIds[0] = fighter.id;
    for (const [x, depth] of [
      [-1800, -1000],
      [650, 0],
      [4200, 1900],
    ]) {
      Object.assign(fighter, { x, depth, y: 0 });
      const viewport = frame();
      expect(viewport.x).toBeCloseTo(x);
      expect(viewport.y).toBeCloseTo(470 + depth);
    }
    const previous = frame();
    fighter.x += 300;
    fighter.depth += 200;
    expect(frame().x - previous.x).toBeCloseTo(300);
    expect(frame().y - previous.y).toBeCloseTo(200);
  });

  it('changes the followed fighter and resumes following after switching back from auto', () => {
    const { frame, snapshot } = cameraHarness(1440, 1000);
    const [first, second] = snapshot.fighters;
    first.x = -900;
    second.x = 3200;
    snapshot.controlledFighterIds[0] = first.id;
    expect(frame().x).toBeCloseTo(first.x);
    snapshot.controlledFighterIds[0] = second.id;
    expect(frame().x).toBeCloseTo(second.x);
    snapshot.manualTeams[0] = false;
    expect(frame().x).not.toBeCloseTo(second.x);
    snapshot.manualTeams[0] = true;
    second.x += 500;
    expect(frame().x).toBeCloseTo(second.x);
  });

  it('keeps the combat render layer aligned with a distant camera viewport', () => {
    const { frame, snapshot } = cameraHarness(1440, 1000);
    snapshot.controlledFighterIds[0] = snapshot.fighters[0].id;
    Object.assign(snapshot.fighters[0], { x: 5200, depth: -2100 });
    const camera = frame();
    const view = worldArenaViewport(camera, 1440 / camera.zoom, 1000 / camera.zoom, 4 / 3);
    expect(view.left!).toBeLessThan(camera.x);
    expect(view.left! + view.width).toBeGreaterThan(camera.x);
    expect(view.top).toBeLessThan(camera.y);
    expect(view.top + view.height).toBeGreaterThan(camera.y);
    const placement = worldArenaPlacement(0, 0, view);
    expect(placement.x + placement.width / 2).toBeCloseTo(
      (camera.x - 650) * WORLD_COMBAT_HEIGHT_SCALE,
    );
    expect(placement.y + placement.height / 2).toBeCloseTo(
      (camera.y - 420) * WORLD_COMBAT_HEIGHT_SCALE,
    );
  });
});
