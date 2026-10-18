import * as Phaser from 'phaser';
import { ANIMATIONS, type Fighter, type MatchRules } from '@arena/shared-types';
import { ARENAS, ASSETS, ELEMENTS, POKEMON, SKILL_BY_ID } from '@arena/game-data';
import { battleFeed } from '@/lib/battle-feed';
import { useGame } from '@/lib/store';
import { BattleAudio } from './audio';
import { SkillVfx } from './skill-vfx';

type Visual = {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  bars: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  ring: Phaser.GameObjects.Ellipse;
  lastAnimation: string;
};
export function createArenaScene(
  arenaId: MatchRules['arena'],
  onReady: () => void,
  onError: (message: string) => void,
) {
  return class ArenaScene extends Phaser.Scene {
    private actors = new Map<string, Visual>();
    private skillVfx!: SkillVfx;
    private lastEvent = 0;
    private ambience!: BattleAudio;
    private leaves: { dot: Phaser.GameObjects.Ellipse; speed: number; phase: number }[] = [];
    private layers: Phaser.GameObjects.Image[] = [];
    private shownError = false;
    constructor() {
      super('arena');
    }
    preload() {
      const arena = ARENAS.find((a) => a.id === arenaId)!;
      arena.layers.forEach((url, i) => this.load.image(`layer-${i}`, url));
      for (const id of Object.keys(ASSETS.sprites) as (keyof typeof ASSETS.sprites)[])
        this.load.spritesheet(id, ASSETS.sprites[id], { frameWidth: 160, frameHeight: 160 });
      this.load.on('loaderror', () => {
        this.shownError = true;
        onError('An arena asset could not load. Reload the page to retry.');
      });
    }
    create() {
      for (let i = 0; i < 4; i++)
        this.layers.push(
          this.add
            .image(600, 380, `layer-${i}`)
            .setDisplaySize(1200, 760)
            .setDepth(i - 10),
        );
      // A broad ground plane makes vertical travel distinct from jumping.
      const floor = this.add.graphics().setDepth(-5);
      const groundColor =
        arenaId === 'volcano' ? 0x66514b : arenaId === 'lake' ? 0x7bbaa7 : 0x779b62;
      const arena = ARENAS.find((a) => a.id === arenaId)!;
      const left = arena.bounds[0],
        right = arena.bounds[1];
      const top = arena.ground + arena.depthBounds[0];
      const bottom = arena.ground + arena.depthBounds[1];
      const width = right - left,
        height = bottom - top;
      const centerY = (top + bottom) / 2;
      floor.fillStyle(groundColor, 1).fillRoundedRect(12, top - 65, 1176, height + 95, 38);
      floor.lineStyle(3, 0xf3e8c6, 0.4).strokeRoundedRect(left, top, width, height, 24);
      floor.lineStyle(2, 0xf3e8c6, 0.15).strokeEllipse(600, centerY, 260, 210);
      floor.lineBetween(600, top, 600, bottom);
      for (let i = 0; i < 110; i++) {
        floor
          .fillStyle(i % 2 ? 0xffffff : 0x20382c, 0.08)
          .fillEllipse(
            left + 20 + ((i * 173) % (width - 40)),
            top + 15 + ((i * 71) % (height - 30)),
            6 + (i % 9),
            3,
          );
      }
      for (const [id, def] of Object.entries(POKEMON))
        for (const animation of ANIMATIONS) {
          const a = def.animations[animation];
          this.anims.create({
            key: `${id}-${animation}`,
            frames: this.anims.generateFrameNumbers(id, { start: a.start, end: a.end }),
            frameRate: a.frameRate,
            repeat: a.repeat,
          });
        }
      this.skillVfx = new SkillVfx(this);
      const particleColor =
        arenaId === 'volcano' ? 0xf6aa72 : arenaId === 'lake' ? 0xd2edee : 0xc9df94;
      for (let i = 0; i < 25; i++) {
        this.leaves.push({
          dot: this.add
            .ellipse(
              (i * 137) % 1200,
              (i * 83) % 480,
              3 + (i % 3),
              2,
              particleColor,
              0.15 + (i % 4) * 0.1,
            )
            .setDepth(6),
          speed: 9 + (i % 7),
          phase: i,
        });
      }
      this.ambience = new BattleAudio(arenaId);
      this.events.once('shutdown', () => {
        this.ambience.destroy();
        this.actors.clear();
        this.skillVfx.destroy();
        this.leaves = [];
      });
      if (!this.shownError) onReady();
    }
    private createActor(f: Fighter) {
      const visual: Visual = {
        shadow: this.add.ellipse(f.x, 522, 65, 13, 0x142b2c, 0.25).setDepth(1),
        ring: this.add
          .ellipse(f.x, 521, 74, 17)
          .setStrokeStyle(2, f.team === 0 ? 0xf3d36e : 0xeeb4a2, 0.55)
          .setDepth(2),
        sprite: this.add
          .sprite(f.x, 520, f.species)
          .setOrigin(0.5, 0.84)
          .setScale(0.82)
          .setDepth(5),
        bars: this.add.graphics().setDepth(15),
        label: this.add
          .text(f.x, 430, POKEMON[f.species].name, {
            fontFamily: 'system-ui',
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#20332e',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(16),
        lastAnimation: '',
      };
      this.actors.set(f.id, visual);
      return visual;
    }
    update(time: number, delta: number) {
      const settings = useGame.getState();
      if (
        battleFeed.engine &&
        battleFeed.running &&
        !settings.paused &&
        battleFeed.engine.state.phase === 'battle'
      ) {
        battleFeed.engine.updateBattle(Math.min(delta / 1000, 0.25));
        battleFeed.push(battleFeed.engine.getBattleSnapshot());
      }
      const snapshot = battleFeed.latest;
      if (!settings.reducedMotion) {
        for (const particle of this.leaves) {
          particle.dot.x = (particle.dot.x + (delta / 1000) * particle.speed) % 1200;
          particle.dot.y += ((Math.sin(time / 1700 + particle.phase) * delta) / 1000) * 4;
        }
      }
      if (!snapshot) return;
      const previous = battleFeed.previous;
      const alpha = battleFeed.engine
        ? 1
        : Math.min(1, (performance.now() - battleFeed.receivedAt) / 50);
      const cameraTarget =
        snapshot.fighters.filter((f) => f.active).reduce((s, f) => s + f.x, 0) /
        Math.max(1, snapshot.fighters.filter((f) => f.active).length);
      if (!settings.reducedMotion)
        this.layers.slice(0, 3).forEach((layer, i) => {
          layer.x = 600 + (cameraTarget - 600) * (0.004 + i * 0.003);
        });
      for (const f of snapshot.fighters) {
        let v = this.actors.get(f.id);
        if (!f.active && f.hp > 0) {
          if (v) {
            v.sprite.setVisible(false);
            v.shadow.setVisible(false);
            v.ring.setVisible(false);
            v.label.setVisible(false);
            v.bars.clear();
          }
          continue;
        }
        if (!v) v = this.createActor(f);
        const old = previous?.fighters.find((p) => p.id === f.id);
        const x = old && old.active === f.active ? Phaser.Math.Linear(old.x, f.x, alpha) : f.x;
        const y = old && old.active === f.active ? Phaser.Math.Linear(old.y, f.y, alpha) : f.y;
        const depth =
          old && old.active === f.active ? Phaser.Math.Linear(old.depth, f.depth, alpha) : f.depth;
        const ground = 520 + depth;
        const faint = f.hp <= 0;
        const faintAlpha = faint ? Math.max(0, 1 - f.animationTime / 1.6) : 1;
        v.sprite
          .setVisible(faintAlpha > 0)
          .setPosition(x, ground - y)
          .setDepth(10 + (ground - 300) / 300)
          .setFlipX(f.facing < 0)
          .setAlpha(f.invulnerable > 0 ? 0.55 + Math.sin(time / 35) * 0.2 : faintAlpha);
        const animation = `${f.species}-${f.animation}`;
        if (animation !== v.lastAnimation) {
          v.sprite.play(animation);
          v.lastAnimation = animation;
        }
        if (settings.paused) v.sprite.anims.pause();
        else v.sprite.anims.resume();
        v.sprite.setTint(
          f.effects.some((e) => e.kind === 'burn')
            ? 0xffbb99
            : f.effects.some((e) => e.kind === 'slow')
              ? 0xbbddff
              : 0xffffff,
        );
        v.shadow
          .setVisible(!faint)
          .setPosition(x, ground + 2)
          .setScale(Math.max(0.45, 1 - y / 300));
        v.ring.setVisible(!faint).setPosition(x, ground + 1);
        v.label.setVisible(!faint).setPosition(x, ground - 96 - y);
        const def = POKEMON[f.species];
        v.bars.clear();
        if (!faint) {
          v.bars.fillStyle(0x172e2b, 0.75).fillRoundedRect(x - 31, ground - 84 - y, 62, 7, 3);
          v.bars
            .fillStyle(f.team === 0 ? 0xd5e6a9 : 0xf0b0a1)
            .fillRoundedRect(x - 30, ground - 83 - y, 60 * (f.hp / def.hp), 5, 2);
          v.bars
            .fillStyle(0xa1d9e1, 0.85)
            .fillRect(x - 30, ground - 74 - y, (60 * f.energy) / def.energy, 2);
          if (f.cast) {
            const skill = SKILL_BY_ID[f.cast.skillId];
            const progress = Math.min(1, f.cast.elapsed / skill.startup);
            v.bars.lineStyle(
              2,
              Phaser.Display.Color.HexStringToColor(ELEMENTS[skill.element].color).color,
              0.7,
            );
            v.bars.strokeCircle(x, ground - 26 - y, 20 + progress * 12);
          }
        }
      }
      this.skillVfx.update(
        snapshot,
        previous,
        alpha,
        delta,
        settings.paused,
        settings.reducedMotion,
      );
      for (const event of snapshot.events) {
        if (event.id <= this.lastEvent) continue;
        this.lastEvent = event.id;
        this.skillVfx.event(event);
        if (event.kind === 'damage' || event.kind === 'heal') {
          const floating = this.add
            .text(
              event.x,
              445 + (event.depth ?? 0) - event.y,
              `${event.kind === 'heal' ? '+' : '−'}${event.value}`,
              {
                fontFamily: 'system-ui',
                fontSize: '22px',
                fontStyle: 'bold',
                color: event.kind === 'heal' ? '#c4efa9' : '#fff5d8',
                stroke: '#273c37',
                strokeThickness: 4,
              },
            )
            .setOrigin(0.5)
            .setDepth(25);
          this.tweens.add({
            targets: floating,
            y: floating.y - 45,
            alpha: 0,
            duration: 850,
            onComplete: () => floating.destroy(),
          });
        }
        if (event.kind === 'skill') {
          this.ambience.play(event.element ?? 'normal');
          const label = this.add
            .text(event.x, 407 + (event.depth ?? 0) - event.y, event.text, {
              fontFamily: 'system-ui',
              fontSize: '12px',
              color: ELEMENTS[event.element ?? 'normal'].color,
              backgroundColor: '#233a38cc',
              padding: { x: 7, y: 4 },
            })
            .setOrigin(0.5)
            .setDepth(24);
          this.tweens.add({
            targets: label,
            y: label.y - 12,
            alpha: 0,
            delay: 450,
            duration: 300,
            onComplete: () => label.destroy(),
          });
        }
      }
    }
  };
}
