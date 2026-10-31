import { performance } from 'node:perf_hooks';
import { initializeBattle } from '@arena/game-core';
import { FULL_ROSTER_ARENA } from '@arena/game-data';
import { DEFAULT_RULES, speciesIds } from '@arena/shared-types';

const team = Array.from({ length: 50 }, (_, i) => speciesIds[i % speciesIds.length]);
const engine = initializeBattle(
  {
    rules: {
      ...DEFAULT_RULES,
      teamSize: 1,
      activeSize: 1,
      duration: 0,
      duplicates: true,
      switching: false,
    },
    players: ['a', 'b'],
    teams: [team, team],
    fullRoster: true,
    arenaDefinition: FULL_ROSTER_ARENA,
    aiTeams: [0, 1],
  },
  42,
);
engine.startBattle();
for (const f of engine.state.fighters) {
  f.active = true;
  f.x = 2800 + f.team * 400 + (f.slot % 10) * 18;
  f.depth = -20 + Math.floor(f.slot / 10) * 40;
}
const start = performance.now();
for (let i = 0; i < 600 && engine.state.phase === 'battle'; i++) engine.updateBattle(1 / 60);
const elapsed = performance.now() - start;
console.log(
  JSON.stringify(
    {
      fighters: 100,
      ticks: engine.state.tick,
      milliseconds: +elapsed.toFixed(1),
      msPerTick: +(elapsed / engine.state.tick).toFixed(3),
      remaining: engine.state.fighters.filter((f) => f.hp > 0).length,
      snapshotBytes: Buffer.byteLength(JSON.stringify(engine.getBattleSnapshot())),
    },
    null,
    2,
  ),
);
