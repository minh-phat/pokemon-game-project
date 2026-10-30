import Phaser from 'phaser';
import { ARENAS } from '@arena/game-data';
import { DEFAULT_RULES, type BattleSnapshot, type Fighter } from '@arena/shared-types';
import { SkillVfx } from '../../apps/frontend/src/game/skill-vfx';

new Phaser.Game({
  type: (window as any).hydroRenderer === 'webgl' ? Phaser.WEBGL : Phaser.CANVAS,
  width: 720,
  height: 640,
  backgroundColor: '#29453e',
  scene: {
    preload() {
      this.load.image('aqua-barrage-orb', (window as any).hydroOrbData);
    },
    create() {
      const vfx = new SkillVfx(this);
      const controls = { elapsed: 0.15, paused: false, reduced: false, clear: false };
      const snapshot = {
        rules: DEFAULT_RULES,
        arenaDefinition: ARENAS[0],
        fighters: [],
        projectiles: [],
        groundHazards: [],
        beams: [],
      } as unknown as BattleSnapshot;
      const fighter = {
        id: 'hydro',
        species: 'squirtle',
        active: true,
        hp: 215,
        x: 350,
        depth: -170,
        y: 0,
        effects: [],
        cast: { skillId: 'hydro-crossfire', elapsed: controls.elapsed, fired: 1, hitIds: [] },
      } as unknown as Fighter;
      // Ground grid makes scale and silhouettes easy to inspect.
      const ground = this.add.graphics().lineStyle(1, 0x83a79a, 0.12);
      for (let x = 30; x < 720; x += 40) ground.lineBetween(x, 40, x, 600);
      for (let y = 40; y < 640; y += 40) ground.lineBetween(30, y, 690, y);
      const label = this.add.text(24, 20, '', { fontSize: '18px', color: '#e0f3e5' });
      this.events.on('update', (_time: number, delta: number) => {
        fighter.cast!.elapsed = controls.elapsed;
        snapshot.fighters = controls.clear ? [] : [fighter];
        vfx.update(snapshot, null, 1, delta, controls.paused, controls.reduced, new Map());
        label.setText(`HYDRO CROSSFIRE · ${controls.elapsed.toFixed(2)}s`);
      });
      (window as any).hydroPreview = {
        controls,
        hit: () =>
          vfx.event({
            id: 1,
            tick: 1,
            kind: 'damage',
            fighterId: 'victim',
            targetId: 'hydro',
            text: 'Hydro Crossfire',
            x: 520,
            y: 0,
            depth: -120,
            element: 'water',
          }),
        inspect: () => ({
          orbs: [...(vfx as any).attached.values()].filter(
            (effect) => effect.key === 'aqua-barrage-orb',
          ).length,
          streams: (vfx as any).crossfires.size,
          impacts: (vfx as any).hydroImpacts.length,
          remaining: (vfx as any).hydroImpacts[0]?.remaining ?? 0,
          particles: [...(vfx as any).emitters.values()].reduce(
            (n, e) => n + e.getAliveParticleCount(),
            0,
          ),
        }),
        destroy: () => vfx.destroy(),
      };
    },
  },
});
