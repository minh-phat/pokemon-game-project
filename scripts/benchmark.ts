import { performance } from 'node:perf_hooks';
import { initializeBattle } from '@arena/game-core';
import { DEFAULT_RULES, speciesIds } from '@arena/shared-types';
const measurements: number[] = [];
let ticks = 0,
  bytes = 0;
for (let seed = 1; seed <= 20; seed++) {
  const engine = initializeBattle(
    {
      rules: { ...DEFAULT_RULES, teamSize: 4, activeSize: 4, duration: 180 },
      players: ['a', 'b'],
      teams: [[...speciesIds], [...speciesIds]],
    },
    seed,
  );
  engine.startBattle();
  const start = performance.now();
  while (engine.state.phase === 'battle') {
    engine.updateBattle(1 / 60);
    ticks++;
  }
  measurements.push(performance.now() - start);
  bytes += JSON.stringify(engine.getBattleSnapshot()).length;
}
const total = measurements.reduce((s, n) => s + n, 0);
console.log(
  JSON.stringify(
    {
      matches: 20,
      ticks,
      totalMilliseconds: +total.toFixed(2),
      microsecondsPerTick: +((total / ticks) * 1000).toFixed(2),
      averageFinalSnapshotBytes: Math.round(bytes / 20),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    null,
    2,
  ),
);
