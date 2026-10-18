import * as Phaser from 'phaser';
import { ANIMATIONS, type Fighter, type MatchRules } from '@arena/shared-types';
import { ARENAS, ASSETS, ELEMENTS, POKEMON, SKILL_BY_ID } from '@arena/game-data';
import { battleFeed } from '@/lib/battle-feed';
import { useGame } from '@/lib/store';
import { BattleAudio } from './audio';

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
    private projectileGraphics!: Phaser.GameObjects.Graphics;
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
        this.layers.push(this.add.image(600, 300, `layer-${i}`).setDepth(i - 10));
      // Foreground collision surface is at y=520; layers share the same authored baseline.
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
      this.projectileGraphics = this.add.graphics().setDepth(12);
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
        const faint = f.hp <= 0;
        const faintAlpha = faint ? Math.max(0, 1 - f.animationTime / 1.6) : 1;
        v.sprite
          .setVisible(faintAlpha > 0)
          .setPosition(x, 520 - y)
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
          .setPosition(x, 522)
          .setScale(Math.max(0.45, 1 - y / 300));
        v.ring.setVisible(!faint).setPosition(x, 521);
        v.label.setVisible(!faint).setPosition(x, 424 - y);
        const def = POKEMON[f.species];
        v.bars.clear();
        if (!faint) {
          v.bars.fillStyle(0x172e2b, 0.75).fillRoundedRect(x - 31, 436 - y, 62, 7, 3);
          v.bars
            .fillStyle(f.team === 0 ? 0xd5e6a9 : 0xf0b0a1)
            .fillRoundedRect(x - 30, 437 - y, 60 * (f.hp / def.hp), 5, 2);
          v.bars
            .fillStyle(0xa1d9e1, 0.85)
            .fillRect(x - 30, 446 - y, (60 * f.energy) / def.energy, 2);
          if (f.cast) {
            const skill = SKILL_BY_ID[f.cast.skillId];
            const progress = Math.min(1, f.cast.elapsed / skill.startup);
            v.bars.lineStyle(
              2,
              Phaser.Display.Color.HexStringToColor(ELEMENTS[skill.element].color).color,
              0.7,
            );
            v.bars.strokeCircle(x, 494 - y, 20 + progress * 12);
          }
        }
      }
      this.projectileGraphics.clear();
      for (const f of snapshot.fighters) {
        if (!f.active || !f.cast) continue;
        const skill = SKILL_BY_ID[f.cast.skillId];
        const t = f.cast.elapsed - skill.startup;
        if (t < 0 || t > skill.active + 0.1) continue;
        const color = Phaser.Display.Color.HexStringToColor(ELEMENTS[skill.element].color).color;
        const g = this.projectileGraphics;
        const x = f.x,
          y = 492 - f.y,
          reach = f.facing * skill.range;
        if (skill.behavior === 'area') {
          g.fillStyle(color, 0.23)
            .fillTriangle(x, y, x + reach, y - 35, x + reach, y + 20)
            .lineStyle(3, color, 0.7)
            .lineBetween(x, y, x + reach * 0.9, y - 5);
        }
        if (skill.behavior === 'melee') {
          g.lineStyle(skill.element === 'grass' ? 4 : 3, color, 0.8);
          if (skill.element === 'grass') {
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + reach * 0.35, y - 15);
            g.lineTo(x + reach * 0.7, y + 10);
            g.lineTo(x + reach, y);
            g.strokePath();
          } else {
            g.beginPath();
            g.arc(x + reach * 0.6, y, 32, -1.1, 1.1, f.facing < 0);
            g.strokePath();
          }
        }
        if (skill.behavior === 'buff') {
          g.lineStyle(3, color, 0.55)
            .strokeCircle(x, y, 45)
            .lineStyle(1, 0xe4f8fa, 0.7)
            .strokeCircle(x, y, 50);
        }
      }
      for (const p of snapshot.projectiles) {
        const skill = SKILL_BY_ID[p.skillId],
          color = Phaser.Display.Color.HexStringToColor(ELEMENTS[skill.element].color).color;
        const old = previous?.projectiles.find((v) => v.id === p.id);
        const x = old ? Phaser.Math.Linear(old.x, p.x, alpha) : p.x;
        this.projectileGraphics
          .fillStyle(color, 0.16)
          .fillEllipse(x - p.vx * 0.025, 520 - p.y, p.width * 2.5, p.height * 1.5)
          .fillStyle(color, 0.9)
          .fillEllipse(x, 520 - p.y, p.width, p.height)
          .fillStyle(0xffffff, 0.8)
          .fillEllipse(x + Math.sign(p.vx) * 5, 518 - p.y, p.width * 0.4, p.height * 0.35);
        const g = this.projectileGraphics,
          y = 520 - p.y;
        if (skill.element === 'electric') {
          g.lineStyle(3, 0xfff4ac, 0.95).beginPath();
          g.moveTo(x - 27, y - 5);
          g.lineTo(x - 7, y + 4);
          g.lineTo(x - 1, y - 10);
          g.lineTo(x + 25, y + 4);
          g.strokePath();
        }
        if (skill.element === 'grass') {
          g.lineStyle(2, 0x3c7354, 0.9).lineBetween(x - 13, y + 6, x + 13, y - 6);
        }
        if (skill.element === 'water') {
          g.lineStyle(1, 0xd1f1ff, 0.8)
            .strokeCircle(x - 18, y - 8, 7)
            .strokeCircle(x - 29, y + 8, 5)
            .strokeCircle(x + 6, y, 9);
        }
        if (skill.element === 'fire') {
          g.fillStyle(0xffe5a5, 0.85).fillTriangle(x - 9, y + 7, x + 10, y, x - 11, y - 9);
        }
      }
      for (const event of snapshot.events) {
        if (event.id <= this.lastEvent) continue;
        this.lastEvent = event.id;
        if (event.kind === 'damage' || event.kind === 'heal') {
          const floating = this.add
            .text(event.x, 445 - event.y, `${event.kind === 'heal' ? '+' : '−'}${event.value}`, {
              fontFamily: 'system-ui',
              fontSize: '22px',
              fontStyle: 'bold',
              color: event.kind === 'heal' ? '#c4efa9' : '#fff5d8',
              stroke: '#273c37',
              strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(25);
          this.tweens.add({
            targets: floating,
            y: floating.y - 45,
            alpha: 0,
            duration: 850,
            onComplete: () => floating.destroy(),
          });
          if (!settings.reducedMotion) {
            const burst = this.add
              .circle(event.x, 490 - event.y, 9, event.kind === 'heal' ? 0xb2dc99 : 0xffe6ac, 0.5)
              .setDepth(8);
            this.tweens.add({
              targets: burst,
              scale: 3,
              alpha: 0,
              duration: 250,
              onComplete: () => burst.destroy(),
            });
          }
        }
        if (event.kind === 'skill') {
          this.ambience.play(event.element ?? 'normal');
          const label = this.add
            .text(event.x, 407 - event.y, event.text, {
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
