import { WORLD_ARENA_VIEW, worldArenaViewport, type WorldArenaView } from './world-combat-visuals';
import { isConcealed } from '@arena/shared-types';
import { slimePose, slimeOpacity } from './water-slime';
import { charmanderCastFrame } from './charmander';
import { drawRuins } from './ruins-arena';
import * as Phaser from 'phaser';
import { ANIMATIONS, type Fighter, type MatchRules } from '@arena/shared-types';
import {
  ARENAS,
  ASSETS,
  ELEMENTS,
  POKEMON,
  SKILL_BY_ID,
  fighterDefinition,
} from '@arena/game-data';
import { battleFeed } from '@/lib/battle-feed';
import { selectManualFighter } from '@/lib/network';
import { useGame } from '@/lib/store';
import { BattleAudio } from './audio';
import { easeHover, hoverTarget } from './hover';
import { SkillVfx } from './skill-vfx';
import { DashWind } from './dash-wind';
import { automaticCameraFrame } from './arena-camera';

type Visual = {
  wind: DashWind;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  bars: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  ring: Phaser.GameObjects.Ellipse;
  targetMarker: Phaser.GameObjects.Text;
  lastAnimation: string;
  hoverLift: number;
};
/** External snapshots render on a transparent world layer; the world remains the sole simulation owner. */
export type WorldArenaSource = () => {
  snapshot: import('@arena/shared-types').BattleSnapshot | null;
  paused: boolean;
  reducedMotion: boolean;
  viewport?: { x: number; y: number; width: number; height: number };
};
export function createArenaScene(
  arenaId: MatchRules['arena'],
  onReady: () => void,
  onError: (message: string) => void,
  worldSource?: WorldArenaSource,
  worldView: WorldArenaView = { ...WORLD_ARENA_VIEW },
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
      this.load.image('electro-ball-art', '/assets/electro-ball-art.png');
      this.load.image('water-slime-wrap-art', '/assets/water-slime-wrap.png');
      this.load.image('ember-glyph-art', '/assets/runedrake-ember-glyph.png');
      this.load.image('runedrake-bind-rig', '/assets/runedrake-bind-rig.png');
      for (const id of [
        'eevee-strike',
        'swift',
        'shadow-step',
        'counter-pounce',
        'starfall-rush',
        'starfall-impact',
        'eevee-guard',
        'eevee-adaptive',
      ])
        this.load.spritesheet(`skill-vfx-${id}`, `/assets/eevee-vfx-${id}.png`, {
          frameWidth: 128,
          frameHeight: 128,
        });
      if (!worldSource) {
        if (arena.background) this.load.image('arena-background', arena.background);
        arena.layers.forEach((url, i) => this.load.image(`layer-${i}`, url));
      }
      for (const id of Object.keys(ASSETS.sprites) as (keyof typeof ASSETS.sprites)[])
        this.load.spritesheet(id, ASSETS.sprites[id], {
          frameWidth: id === 'runedrake' ? 320 : 160,
          frameHeight: 160,
        });
      this.load.on('loaderror', () => {
        this.shownError = true;
        onError('An arena asset could not load. Reload the page to retry.');
      });
    }
    create() {
      if (!worldSource && arenaId !== 'ruins') {
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
      }
      const arena = ARENAS.find((a) => a.id === arenaId)!;
      if (!worldSource && arenaId === 'ruins') drawRuins(this, arena);
      if (!worldSource && arenaId !== 'ruins') {
        const arena = ARENAS.find((a) => a.id === arenaId)!;
        for (const o of arena.obstacles ?? []) {
          const shelf = this.add
            .graphics()
            .setDepth(10 + (520 + o.depth - o.length / 2 - 300) / 300);
          const x = o.x - o.width / 2,
            y = 520 + o.depth - o.length / 2;
          const top = arenaId === 'volcano' ? 0x887468 : arenaId === 'lake' ? 0x91baa8 : 0x93a779;
          const side = arenaId === 'volcano' ? 0x514342 : arenaId === 'lake' ? 0x557c7b : 0x596b52;
          this.add
            .graphics()
            .setDepth(10 + (520 + o.depth + o.length / 2 - 300) / 300)
            .fillStyle(side, 1)
            .fillRoundedRect(x, y + o.length - o.height, o.width, o.height, 6);
          shelf.fillStyle(top, 1).fillRoundedRect(x, y - o.height, o.width, o.length, 8);
          shelf
            .lineStyle(2, 0xd1d8b3, 0.4)
            .strokeRoundedRect(x + 2, y - o.height + 2, o.width - 4, o.length - 4, 6);
        }
      }
      if (worldSource) this.cameras.main.setScroll(0, worldView.top);
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
      for (const id of ['eevee', 'runedrake', 'water-slime'])
        this.textures.get(id).setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.textures.get('ember-glyph-art').setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (const id of [
        'eevee-strike',
        'swift',
        'shadow-step',
        'counter-pounce',
        'starfall-rush',
        'starfall-impact',
        'eevee-guard',
        'eevee-adaptive',
      ])
        this.textures.get(`skill-vfx-${id}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.skillVfx = new SkillVfx(this);
      const particleColor =
        arenaId === 'volcano' ? 0xf6aa72 : arenaId === 'lake' ? 0xd2edee : 0xc9df94;
      for (let i = 0; i < (worldSource || arenaId === 'ruins' ? 0 : 25); i++) {
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
      this.ambience = new BattleAudio(arenaId === 'ruins' ? 'forest' : arenaId);
      this.events.once('shutdown', () => {
        this.ambience.destroy();
        for (const actor of this.actors.values()) actor.wind.destroy();
        this.actors.clear();
        this.skillVfx.destroy();
        this.leaves = [];
      });
      if (!this.shownError) onReady();
    }
    private createActor(f: Fighter) {
      const visual: Visual = {
        wind: new DashWind(this),
        shadow: this.add.ellipse(f.x, 522, 65, 13, 0x142b2c, 0.25).setDepth(1),
        ring: this.add
          .ellipse(f.x, 521, 74, 17)
          .setStrokeStyle(2, f.team === 0 ? 0xf3d36e : 0xeeb4a2, 0.55)
          .setDepth(2),
        targetMarker: this.add
          .text(f.x, 400, '▼ TARGET', {
            fontFamily: 'system-ui',
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#ff4949',
            stroke: '#381414',
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(18)
          .setVisible(false),
        sprite: this.add
          .sprite(f.x, 520, f.species)
          .setOrigin(0.5, 0.84)
          .setScale(f.species === 'eevee' ? 0.66 : f.species === 'runedrake' ? 0.9 : 0.82)
          .setDepth(5),
        bars: this.add.graphics().setDepth(15),
        label: this.add
          .text(
            f.x,
            430,
            worldSource && f.progression
              ? `${POKEMON[f.species].name} · Lv.${f.progression.level} · ${f.progression.quality}`
              : POKEMON[f.species].name,
            {
              fontFamily: 'system-ui',
              fontSize: worldSource ? '24px' : '12px',
              color: '#ffffff',
              stroke: '#20332e',
              strokeThickness: 3,
            },
          )
          .setOrigin(0.5)
          .setDepth(16),
        lastAnimation: '',
        hoverLift: POKEMON[f.species].hoverHeight ?? 0,
      };
      this.actors.set(f.id, visual);
      if (!worldSource)
        visual.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          const game = useGame.getState();
          const team =
            game.mode === 'online'
              ? (game.lobby?.players.findIndex((p) => p.id === game.sessionId) ?? -1)
              : 0;
          const current = battleFeed.latest?.fighters.find((actor) => actor.id === f.id);
          if (
            f.team === team &&
            battleFeed.latest?.manualTeams[team] &&
            current?.active &&
            current.hp > 0
          )
            selectManualFighter(f.id);
        });
      return visual;
    }
    update(time: number, delta: number) {
      const external = worldSource?.();
      const settings = {
        ...useGame.getState(),
        ...(external ? { paused: external.paused, reducedMotion: external.reducedMotion } : {}),
      };
      if (worldSource) {
        this.tweens.timeScale = settings.paused ? 0 : 1;
        this.ambience.setPaused(settings.paused);
        if (external?.viewport) {
          const camera = this.cameras.main;
          Object.assign(
            worldView,
            worldArenaViewport(
              external.viewport,
              external.viewport.width,
              external.viewport.height,
              camera.width / camera.height,
            ),
          );
          camera.setZoom(camera.width / worldView.width);
          camera.centerOn(
            (worldView.left ?? 0) + worldView.width / 2,
            worldView.top + worldView.height / 2,
          );
        }
      }
      if (
        !worldSource &&
        battleFeed.engine &&
        battleFeed.running &&
        !settings.paused &&
        battleFeed.engine.state.phase === 'battle'
      ) {
        battleFeed.engine.updateBattle(Math.min(delta / 1000, 0.25));
        battleFeed.push(battleFeed.engine.getBattleSnapshot());
      }
      const snapshot = external ? external.snapshot : battleFeed.latest;
      if (!settings.reducedMotion) {
        for (const particle of this.leaves) {
          particle.dot.x = (particle.dot.x + (delta / 1000) * particle.speed) % 1200;
          particle.dot.y += ((Math.sin(time / 1700 + particle.phase) * delta) / 1000) * 4;
        }
      }
      if (!snapshot) return;
      const previous = worldSource ? null : battleFeed.previous;
      const alpha =
        worldSource || battleFeed.engine
          ? 1
          : Math.min(1, (performance.now() - battleFeed.receivedAt) / 50);
      const cameraTarget =
        snapshot.fighters.filter((f) => f.active).reduce((s, f) => s + f.x, 0) /
        Math.max(1, snapshot.fighters.filter((f) => f.active).length);
      const myTeam =
        !worldSource && settings.mode === 'online'
          ? (settings.lobby?.players.findIndex((p) => p.id === settings.sessionId) ?? -1)
          : 0;
      const controlledId = snapshot.controlledFighterIds[myTeam];
      const controlled = snapshot.fighters.find(
        (f) => f.id === controlledId && f.team === myTeam && f.active && f.hp > 0,
      );
      const targetId = controlled && snapshot.manualTeams[myTeam] ? controlled.targetId : null;
      const camera = this.cameras.main;
      const arena = ARENAS.find((a) => a.id === arenaId)!;
      if (!worldSource) {
        const frame = automaticCameraFrame(snapshot, myTeam, arena, camera.width, camera.height);
        const blend = settings.reducedMotion ? 1 : 1 - Math.exp(-delta / 180);
        // Widen immediately to include new arrivals; ease back in as the group closes up.
        const zoom = Math.min(frame.zoom, Phaser.Math.Linear(camera.zoom, frame.zoom, blend));
        const halfW = camera.width / (2 * zoom);
        const halfH = camera.height / (2 * zoom);
        const centerX = Phaser.Math.Linear(camera.midPoint.x, frame.x, blend);
        const centerY = Phaser.Math.Linear(camera.midPoint.y, frame.y, blend);
        camera.setZoom(zoom);
        camera.centerOn(
          Phaser.Math.Clamp(centerX, frame.right - halfW, frame.left + halfW),
          Phaser.Math.Clamp(centerY, frame.bottom - halfH, frame.top + halfH),
        );
      }
      if (!settings.reducedMotion)
        this.layers.slice(0, 3).forEach((layer, i) => {
          layer.x = 600 + (cameraTarget - 600) * (0.004 + i * 0.003);
        });
      const hoverByFighter = new Map<string, number>();
      for (const f of snapshot.fighters) {
        let v = this.actors.get(f.id);
        if (!f.active && f.hp > 0) {
          if (v) {
            v.sprite.setVisible(false);
            v.shadow.setVisible(false);
            v.ring.setVisible(false);
            v.targetMarker.setVisible(false);
            v.label.setVisible(false);
            v.bars.clear();
            v.wind.update(
              0,
              0,
              0,
              0,
              0,
              false,
              false,
              delta,
              settings.paused,
              settings.reducedMotion,
            );
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
        const hidden = !faint && f.team !== myTeam && isConcealed(f);
        const opacity = slimeOpacity(f, f.team === myTeam);
        const slime =
          f.species === 'water-slime'
            ? slimePose(f, settings.reducedMotion)
            : { x: 1, y: 1, lift: 0 };
        const liquidBinding = f.cast?.skillId === 'liquid-wrap' && f.cast.bound;
        const liquidFade = liquidBinding
          ? Math.max(
              0,
              1 - (f.cast!.elapsed - SKILL_BY_ID['liquid-wrap'].startup) / 0.18,
              Math.min(
                1,
                (f.cast!.elapsed -
                  SKILL_BY_ID['liquid-wrap'].startup -
                  SKILL_BY_ID['liquid-wrap'].active) /
                  SKILL_BY_ID['liquid-wrap'].recovery,
              ),
            )
          : 1;
        const faintAlpha = faint ? Math.max(0, 1 - f.animationTime / 1.6) : 1;
        const hoverHeight = POKEMON[f.species].hoverHeight ?? 0;
        const grounded = faint || f.effects.some((effect) => effect.kind === 'stun');
        const targetHover = hoverTarget(hoverHeight, grounded, time, settings.reducedMotion);
        if (!settings.paused) v.hoverLift = easeHover(v.hoverLift, targetHover, delta);
        hoverByFighter.set(f.id, v.hoverLift);
        const altitude = y + v.hoverLift;
        v.wind.update(
          x,
          ground - altitude - 32,
          10 + (ground - 300) / 300,
          f.vx,
          f.vDepth,
          f.state === 'Dodge' &&
            f.actionTime > 0 &&
            (f.animation === 'dash' || f.animation === 'backstep'),
          !hidden && !faint && !liquidBinding,
          delta,
          settings.paused,
          settings.reducedMotion,
        );
        const glyphCasting =
          f.cast?.skillId === 'ember-glyph' && f.cast.elapsed < SKILL_BY_ID['ember-glyph'].startup;
        const glyphWobble =
          glyphCasting && !settings.reducedMotion ? Math.sin(f.cast!.elapsed * 35) * 0.025 : 0;
        const binder = snapshot.fighters.find(
          (other) =>
            other.cast?.skillId === 'cursed-scroll-bind' &&
            other.cast.bound &&
            other.cast.targetId === f.id,
        );
        const bindAge = binder?.cast
          ? Math.max(0, binder.cast.elapsed - SKILL_BY_ID['cursed-scroll-bind'].startup)
          : 0;
        const bindT = Math.max(0, Math.min(1, (bindAge - 1.05) / 1.95));
        const bindProgress = bindT * bindT * (3 - 2 * bindT);
        const bindPulse =
          binder && !settings.reducedMotion
            ? Math.exp(-Math.pow((bindAge - Math.round(bindAge)) / 0.105, 2)) *
              Math.max(0, Math.min(1, (bindAge - 0.7) / 0.3))
            : 0;
        const enteringBind =
          f.species === 'runedrake' && f.cast?.skillId === 'cursed-scroll-bind' && f.cast.bound;
        const entryFade = enteringBind
          ? settings.reducedMotion
            ? 0
            : 1 -
              Math.min(
                1,
                Math.max(0, f.cast!.elapsed - SKILL_BY_ID['cursed-scroll-bind'].startup) / 0.12,
              )
          : 1;
        const baseScale = f.species === 'eevee' ? 0.66 : f.species === 'runedrake' ? 0.9 : 0.82;
        v.sprite
          .setVisible(faintAlpha > 0 && entryFade > 0)
          .setPosition(
            x + glyphWobble * 70 + Math.sin(bindAge * 22) * bindPulse * 1.5,
            ground - altitude - slime.lift,
          )
          .setRotation(glyphWobble)
          .setScale(
            baseScale * (1 - 0.13 * bindProgress - 0.045 * bindPulse) * slime.x,
            baseScale * (1 + 0.035 * bindProgress) * slime.y,
          )
          .setDepth(10 + (ground - 300) / 300)
          .setFlipX(f.facing < 0)
          .setAlpha(
            (f.invulnerable > 0 ? 0.55 + Math.sin(time / 35) * 0.2 : faintAlpha) *
              entryFade *
              opacity *
              liquidFade,
          );
        const animation = `${f.species}-${f.animation}`;
        if (animation !== v.lastAnimation) {
          v.sprite.play(animation);
          v.lastAnimation = animation;
        }
        v.sprite.anims.timeScale =
          f.animation === 'run'
            ? f.sprinting
              ? 1.5
              : f.stamina < f.maxStamina * 0.2
                ? 0.55
                : 1
            : 1;
        if (settings.paused) v.sprite.anims.pause();
        else v.sprite.anims.resume();
        if (f.species === 'charmander') {
          const frame = charmanderCastFrame(f);
          if (settings.reducedMotion) {
            v.sprite.anims.pause();
            v.sprite.setFrame(POKEMON.charmander.animations[f.animation].start);
          } else if (frame !== null && !settings.paused) {
            v.sprite.anims.pause();
            v.sprite.setFrame(frame);
          }
        }
        v.sprite.setTint(
          f.effects.some((e) => e.kind === 'burn')
            ? 0xffbb99
            : f.effects.some((e) => e.kind === 'slow')
              ? 0xbbddff
              : 0xffffff,
        );
        if (f.species === 'water-slime' && f.cast && !settings.paused) {
          const skill = SKILL_BY_ID[f.cast.skillId];
          const row =
            f.cast.skillId === 'spring-tackle'
              ? 5
              : f.cast.skillId === 'water-orb'
                ? 6
                : f.cast.skillId === 'liquid-guard'
                  ? 10
                  : f.cast.skillId === 'liquid-wrap'
                    ? 7
                    : 0;
          const duration = skill.startup + skill.active + skill.recovery;
          const frame =
            row === 10
              ? f.cast.elapsed < 0.3
                ? Math.min(2, Math.floor(f.cast.elapsed * 10))
                : 2 + (Math.floor(f.cast.elapsed * 8) % 4)
              : Math.min(
                  5,
                  Math.floor((f.cast.elapsed / (row === 7 ? skill.startup : duration)) * 6),
                );
          v.sprite.anims.pause();
          v.sprite.setFrame(row * 6 + frame);
        }
        v.shadow
          .setVisible(!hidden && !liquidBinding && (hoverHeight > 0 ? faintAlpha > 0 : !faint))
          .setPosition(x, ground - (f.groundHeight ?? 0) + 2)
          .setScale(Math.max(0.45, 1 - (altitude - (f.groundHeight ?? 0)) / 300))
          .setAlpha(
            hoverHeight > 0
              ? Math.max(0, 1 - (altitude - (f.groundHeight ?? 0)) / 260) * faintAlpha
              : 1,
          );
        const selected = f.team === myTeam && snapshot.manualTeams[f.team] && controlledId === f.id;
        const targeted = !faint && !hidden && f.id === targetId;
        v.ring
          .setVisible(!faint && !hidden && !liquidBinding)
          .setPosition(x, ground - (f.groundHeight ?? 0) + 1)
          .setStrokeStyle(
            selected || targeted ? 3 : 2,
            targeted ? 0xff4949 : selected ? 0xffe88c : f.team === 0 ? 0xf3d36e : 0xeeb4a2,
            selected || targeted ? 0.95 : 0.55,
          )
          .setScale(selected || targeted ? 1.35 : 1);
        v.label
          .setVisible(!faint && !hidden && !liquidBinding)
          .setPosition(x, ground - 96 - altitude);
        v.targetMarker.setVisible(targeted).setPosition(x, ground - 119 - altitude);
        const def = fighterDefinition(f);
        v.bars.clear();
        if (!faint && !hidden && !liquidBinding) {
          v.bars
            .fillStyle(0x172e2b, 0.75)
            .fillRoundedRect(x - 31, ground - 84 - altitude, 62, 7, 3);
          v.bars
            .fillStyle(f.team === 0 ? 0xd5e6a9 : 0xf0b0a1)
            .fillRoundedRect(x - 30, ground - 83 - altitude, 60 * (f.hp / def.hp), 5, 2);
          v.bars
            .fillStyle(0xa1d9e1, 0.85)
            .fillRect(x - 30, ground - 74 - altitude, (60 * f.energy) / def.energy, 2);
          v.bars.fillStyle(0x292b24, 0.8).fillRect(x - 30, ground - 70 - altitude, 60, 3);
          v.bars
            .fillStyle(f.stamina < f.maxStamina * 0.2 ? 0xee9777 : 0xe0be70, 0.95)
            .fillRect(
              x - 30,
              ground - 70 - altitude,
              60 * Math.max(0, Math.min(1, f.stamina / f.maxStamina)),
              3,
            );
          if (f.cast) {
            const skill = SKILL_BY_ID[f.cast.skillId];
            const progress = Math.min(1, f.cast.elapsed / skill.startup);
            v.bars.lineStyle(
              2,
              Phaser.Display.Color.HexStringToColor(ELEMENTS[skill.element].color).color,
              0.7,
            );
            v.bars.strokeCircle(x, ground - 26 - altitude, 20 + progress * 12);
          }
        }
      }
      this.skillVfx.update(
        {
          ...snapshot,
          fighters: snapshot.fighters.filter((f) => f.team === myTeam || !isConcealed(f)),
        },
        previous,
        alpha,
        delta,
        settings.paused,
        settings.reducedMotion,
        hoverByFighter,
      );
      for (const event of snapshot.events) {
        if (event.id <= this.lastEvent) continue;
        this.lastEvent = event.id;
        const eventFighter = snapshot.fighters.find((f) => f.id === event.fighterId);
        if (eventFighter && eventFighter.team !== myTeam && isConcealed(eventFighter)) continue;
        const eventHover = hoverByFighter.get(event.fighterId) ?? 0;
        this.skillVfx.event(event, eventHover);
        if (event.kind === 'damage' || event.kind === 'heal') {
          const floating = this.add
            .text(
              event.x,
              445 + (event.depth ?? 0) - event.y - eventHover,
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
          this.ambience.play(event.element === 'poison' ? 'water' : (event.element ?? 'normal'));
          const label = this.add
            .text(event.x, 407 + (event.depth ?? 0) - event.y - eventHover, event.text, {
              fontFamily: 'system-ui',
              fontSize: worldSource ? '24px' : '12px',
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
