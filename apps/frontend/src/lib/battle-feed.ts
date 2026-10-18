import type { BattleSnapshot } from '@arena/shared-types';
import type { BattleEngine } from '@arena/game-core';
import { useGame } from './store';
/** Phaser reads this mutable feed; React receives at most ten HUD updates/second. */
export const battleFeed: {
  latest: BattleSnapshot | null;
  previous: BattleSnapshot | null;
  receivedAt: number;
  engine: BattleEngine | null;
  running: boolean;
  lastUI: number;
  push: (snapshot: BattleSnapshot) => void;
  clear: () => void;
} = {
  latest: null,
  previous: null,
  receivedAt: 0,
  engine: null,
  running: false,
  lastUI: 0,
  push(snapshot) {
    const now = performance.now();
    if (this.latest && snapshot.tick === this.latest.tick && snapshot.phase === this.latest.phase)
      return;
    this.previous = this.latest;
    this.latest = snapshot;
    this.receivedAt = now;
    if (now - this.lastUI >= 100 || snapshot.phase === 'finished') {
      useGame.getState().set({ snapshot });
      this.lastUI = now;
    }
  },
  clear() {
    this.latest = null;
    this.previous = null;
    this.engine = null;
    this.running = false;
    this.lastUI = 0;
    useGame.getState().set({ snapshot: null, paused: false });
  },
};
