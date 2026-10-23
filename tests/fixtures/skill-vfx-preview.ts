import Phaser from 'phaser';
import { SKILL_BY_ID } from '@arena/game-data';
import { createSkillTextures } from '../../apps/frontend/src/game/skill-textures';
import { SkillVfx } from '../../apps/frontend/src/game/skill-vfx';
import { DEFAULT_RULES, type BattleSnapshot, type Fighter } from '@arena/shared-types';

new Phaser.Game({
  type: (window as any).vfxRenderer === 'webgl' ? Phaser.WEBGL : Phaser.CANVAS,
  width: 1000,
  height: 1000,
  backgroundColor: '#172d30',
  scene: {
    preload() {
      this.load.image('ember-glyph-art', (window as any).emberGlyphAsset);
      this.load.image('runedrake-bind-rig', (window as any).bindRigAsset);
      this.load.image('bind-victim', (window as any).bindVictimAsset);
    },
    create() {
      createSkillTextures(this);
      const skills = Object.values(SKILL_BY_ID).filter((skill) => skill.id !== 'tail-whip');
      const vfx = new SkillVfx(this);
      const snapshot: BattleSnapshot = {
        seed: 1,
        tick: 1,
        elapsed: 0,
        phase: 'battle',
        rules: DEFAULT_RULES,
        manualTeams: [false, false],
        controlledFighterIds: [null, null],
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
            effects: [{ kind: 'burn', duration: 4, strength: 12 }],
          } as unknown as Fighter,
          {
            id: 'bind-preview',
            species: 'runedrake',
            active: true,
            hp: 190,
            x: 470,
            depth: 100,
            y: 0,
            aimX: 1,
            aimDepth: 0,
            facing: 1,
            cast: {
              skillId: 'cursed-scroll-bind',
              elapsed: 0.48,
              fired: 1,
              hitIds: [],
              targetId: 'bound-preview',
              bound: true,
            },
            effects: [],
          } as unknown as Fighter,
          {
            id: 'bound-preview',
            species: 'charmander',
            active: true,
            hp: 180,
            x: 510,
            depth: 100,
            y: 0,
            cast: null,
            effects: [],
          } as unknown as Fighter,
        ],
        events: [],
        result: null,
        beams: [],
        groundHazards: [
          {
            id: 'preview-pool',
            ownerId: 'preview',
            team: 0,
            skillId: 'sludge-bomb',
            x: 855,
            depth: 220,
            radius: SKILL_BY_ID['sludge-bomb'].groundHazard!.radius,
            duration: 4,
            pulse: 0,
          },
        ],
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
      const victim = this.add
        .image(510, 620, 'bind-victim')
        .setOrigin(0.5, 0.84)
        .setScale(0.82)
        .setDepth(11);
      const controls = {
        paused: false,
        reduced: false,
        clear: false,
        angle: 0,
        boundSpecies: 'charmander',
        bindElapsed: 0.48,
        bindFacing: 1,
        showLaser: false,
      };
      Object.assign(window, {
        vfxPreview: {
          controls,
          focusBind: () => {
            snapshot.fighters[0].active = false;
            snapshot.fighters[1].active = false;
            snapshot.projectiles = [];
            snapshot.groundHazards = [];
            this.children.list.forEach((object) => {
              if (object instanceof Phaser.GameObjects.Text) object.setVisible(false);
              if (object instanceof Phaser.GameObjects.Particles.ParticleEmitter) object.killAll();
            });
          },
          inspect: () => ({
            frames: skills.map((s) =>
              s.id === 'ember-glyph'
                ? Number(this.textures.exists('ember-glyph-art'))
                : this.anims.get(`skill-vfx-${s.id}`).frames.length,
            ),
            sprites: this.children.list.filter((o) => o instanceof Phaser.GameObjects.Sprite)
              .length,
            puddles: this.children.list.filter(
              (o) =>
                o instanceof Phaser.GameObjects.Sprite &&
                o.texture.key === 'skill-vfx-sludge-puddle',
            ).length,
            bindCoils: this.children.list.filter((o) => o.name === 'bind-body-front').length,
            bindCoilWidth: this.children.getByName('bind-body-front')?.getData('radius'),
            bindArt: this.children.getByName('bind-body-front')?.getData('art'),
            bindTails: this.children.list.filter((o) => o.name === 'bind-tail').length,
            bindTextures: this.textures.getTextureKeys().filter((key) => /^bind-\d+-/.test(key))
              .length,
            bindBodyPoints: this.children.getByName('bind-body-front')?.getData('points'),
            bindLayers: this.children.list
              .filter((o) => o.name === 'bind-body-front' || o.name === 'bind-body-back')
              .map((o) => (o as Phaser.GameObjects.Image).depth),
            bindHeadX: (this.children.getByName('bind-head') as Phaser.GameObjects.Sprite)?.x,
            bindHeadY: (this.children.getByName('bind-head') as Phaser.GameObjects.Sprite)?.y,
            laserCores: this.children.list.filter(
              (o) =>
                o instanceof Phaser.GameObjects.Sprite &&
                o.texture.key === 'skill-vfx-dragon-laser' &&
                o.displayWidth > 150,
            ).length,
            laserClashes: this.children.list.filter(
              (o) =>
                o instanceof Phaser.GameObjects.Sprite &&
                o.texture.key === 'skill-vfx-dragon-laser-impact',
            ).length,
            laserMouths: this.children.list.filter(
              (o) =>
                o instanceof Phaser.GameObjects.Sprite &&
                o.texture.key === 'skill-vfx-dragon-laser-charge',
            ).length,
            sludgeBombs: this.children.list.filter(
              (o) =>
                o instanceof Phaser.GameObjects.Sprite && o.texture.key === 'skill-vfx-sludge-bomb',
            ).length,
            sludgeTrails: this.children.list.filter(
              (o) =>
                o instanceof Phaser.GameObjects.Sprite &&
                o.texture.key === 'skill-vfx-sludge-trail',
            ).length,
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
        victim.setVisible(!controls.clear);
        snapshot.fighters[0].aimX = Math.cos(controls.angle);
        snapshot.fighters[0].aimDepth = Math.sin(controls.angle);
        snapshot.fighters[3].species = controls.boundSpecies as Fighter['species'];
        snapshot.fighters[2].cast!.elapsed = controls.bindElapsed;
        snapshot.fighters[2].facing = controls.bindFacing as 1 | -1;
        snapshot.fighters[0].cast = controls.showLaser
          ? { skillId: 'dragon-laser', elapsed: 1.2, fired: 0, hitIds: [] }
          : { skillId: 'inferno-stream', elapsed: 1.2, fired: 1, hitIds: [] };
        snapshot.beams = controls.showLaser
          ? [
              {
                ownerId: 'stream-preview',
                team: 0,
                skillId: 'dragon-laser',
                startX: 310,
                startDepth: 338,
                endX: 500,
                endDepth: 338,
                width: 34,
                clashWith: 'burn-preview',
              },
              {
                ownerId: 'burn-preview',
                team: 1,
                skillId: 'dragon-laser',
                startX: 690,
                startDepth: 338,
                endX: 500,
                endDepth: 338,
                width: 34,
                clashWith: 'stream-preview',
              },
            ]
          : [];
        vfx.update(
          controls.clear
            ? { ...snapshot, fighters: [], projectiles: [], beams: [], groundHazards: [] }
            : snapshot,
          null,
          1,
          delta,
          controls.paused,
          controls.reduced,
          new Map(),
        );
      });
      this.events.once('shutdown', () => vfx.destroy());
    },
  },
});
