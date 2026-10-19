import Phaser from 'phaser';
import { SKILL_BY_ID } from '@arena/game-data';
import { createSkillTextures } from '../../apps/frontend/src/game/skill-textures';
import { SkillVfx } from '../../apps/frontend/src/game/skill-vfx';
import { DEFAULT_RULES, type BattleSnapshot, type Fighter } from '@arena/shared-types';

new Phaser.Game({
  type: Phaser.CANVAS,
  width: 1000,
  height: 1000,
  backgroundColor: '#172d30',
  scene: {
    create() {
      createSkillTextures(this);
      const skills = Object.values(SKILL_BY_ID);
      const vfx = new SkillVfx(this);
      const snapshot: BattleSnapshot = {
        seed: 1,
        tick: 1,
        elapsed: 0,
        phase: 'battle',
        rules: DEFAULT_RULES,
        manualTeams: [false, false],
        fighters: [
          {
            id: 'stream-preview',
            active: true,
            hp: 180,
            x: 280,
            depth: 338,
            y: 0,
            aimX: 1,
            aimDepth: 0,
            cast: { skillId: 'inferno-stream', elapsed: 1.2, fired: 1, hitIds: [] },
            effects: [],
          } as unknown as Fighter,
          {
            id: 'burn-preview',
            active: true,
            hp: 180,
            x: 720,
            depth: 338,
            y: 0,
            aimX: -1,
            aimDepth: 0,
            cast: null,
            effects: [{ kind: 'burn', duration: 4, strength: 3 }],
          } as unknown as Fighter,
        ],
        events: [],
        result: null,
        projectiles: skills.map((s, i) => ({
          id: s.id,
          ownerId: 'preview',
          team: 0,
          skillId: s.id,
          x: 125 + (i % 4) * 250,
          depth: 0,
          y: 520 - (90 + Math.floor(i / 4) * 160),
          previousX: 0,
          vx: 100,
          width: 38,
          height: 28,
          life: 1,
        })),
      };
      skills.forEach((s, i) =>
        this.add
          .text(125 + (i % 4) * 250, 28 + Math.floor(i / 4) * 160, s.name, {
            fontFamily: 'sans-serif',
            fontSize: '17px',
            color: '#e4f5ed',
          })
          .setOrigin(0.5),
      );
      this.add.text(35, 965, 'INFERNO STREAM · FULL CAST', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#fff0c2',
      });
      this.add.text(655, 900, 'BURN STATUS', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#fff0c2',
      });
      const controls = { paused: false, reduced: false, clear: false, angle: 0 };
      Object.assign(window, {
        vfxPreview: {
          controls,
          inspect: () => ({
            frames: skills.map((s) => this.anims.get(`skill-vfx-${s.id}`).frames.length),
            sprites: this.children.list.filter((o) => o instanceof Phaser.GameObjects.Sprite)
              .length,
            particles: this.children.list
              .filter((o) => o instanceof Phaser.GameObjects.Particles.ParticleEmitter)
              .reduce(
                (n, o) =>
                  n + (o as Phaser.GameObjects.Particles.ParticleEmitter).getAliveParticleCount(),
                0,
              ),
            frame: (
              this.children.list.find(
                (o) => o instanceof Phaser.GameObjects.Sprite,
              ) as Phaser.GameObjects.Sprite
            )?.frame.name,
            streamRotation: (
              this.children.list.find(
                (o) =>
                  o instanceof Phaser.GameObjects.Sprite &&
                  o.texture.key === 'skill-vfx-inferno-stream' &&
                  o.displayWidth > 200,
              ) as Phaser.GameObjects.Sprite | undefined
            )?.rotation,
          }),
        },
      });
      this.events.on('update', (_time: number, delta: number) => {
        snapshot.fighters[0].aimX = Math.cos(controls.angle);
        snapshot.fighters[0].aimDepth = Math.sin(controls.angle);
        vfx.update(
          controls.clear ? { ...snapshot, fighters: [], projectiles: [] } : snapshot,
          null,
          1,
          delta,
          controls.paused,
          controls.reduced,
        );
      });
      this.events.once('shutdown', () => vfx.destroy());
    },
  },
});
