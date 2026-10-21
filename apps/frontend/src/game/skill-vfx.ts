import * as Phaser from 'phaser';
import { ELEMENTS, POKEMON, SKILL_BY_ID } from '@arena/game-data';
import type { BattleEvent, BattleSnapshot, Element } from '@arena/shared-types';
import { createSkillTextures } from './skill-textures';

type Effect = { sprite: Phaser.GameObjects.Sprite; key: string };
type WrapMask = { graphics: Phaser.GameObjects.Graphics; sprite: Phaser.GameObjects.Sprite };

export class SkillVfx {
  private attached = new Map<string, Effect>();
  private wrapMasks = new Map<string, WrapMask>();
  private impacts: { sprite: Phaser.GameObjects.Sprite; remaining: number }[] = [];
  private seenHazards = new Set<string>();
  private emitters = new Map<Element, Phaser.GameObjects.Particles.ParticleEmitter>();
  private particleClock = 0;
  private paused = false;
  private reduced = false;

  constructor(private scene: Phaser.Scene) {
    createSkillTextures(scene);
    for (const element of Object.keys(ELEMENTS) as Element[]) {
      const emitter = scene.add
        .particles(0, 0, `skill-particle-${element}`, {
          emitting: false,
          lifespan: { min: 220, max: 480 },
          speed: { min: 18, max: 95 },
          angle: { min: 0, max: 360 },
          scale: { start: element === 'grass' ? 0.45 : 0.55, end: 0.05 },
          alpha: { start: 0.85, end: 0 },
          rotate: { min: -180, max: 180 },
          gravityY: element === 'water' ? 100 : element === 'fire' ? -65 : 22,
          maxParticles: 180,
          maxAliveParticles: 150,
          blendMode: element === 'grass' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD,
        })
        .setDepth(13);
      this.emitters.set(element, emitter);
    }
  }

  private sprite(key: string) {
    const sprite = this.scene.add.sprite(0, 0, key, 0).setDepth(12);
    if (
      key !== 'electro-ball-art' &&
      key !== 'ember-glyph-art' &&
      key !== 'runedrake' &&
      key !== 'runedrake-bind-body' &&
      key !== 'runedrake-bind-head'
    )
      sprite.play(key);
    return sprite;
  }

  private place(
    id: string,
    key: string,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
  ) {
    let effect = this.attached.get(id);
    if (effect && effect.key !== key) {
      effect.sprite.destroy();
      this.attached.delete(id);
      effect = undefined;
    }
    if (!effect) {
      effect = { sprite: this.sprite(key), key };
      this.attached.set(id, effect);
    }
    effect.sprite
      .setPosition(x, y)
      .setDisplaySize(width, height)
      .setRotation(rotation)
      .setAlpha(this.reduced ? 0.65 : 0.95);
    if (this.paused || this.reduced) effect.sprite.anims.pause();
    else effect.sprite.anims.resume();
    if (
      this.reduced &&
      key !== 'electro-ball-art' &&
      key !== 'ember-glyph-art' &&
      key !== 'runedrake' &&
      key !== 'runedrake-bind-body' &&
      key !== 'runedrake-bind-head'
    )
      effect.sprite.setFrame(3);
  }

  update(
    snapshot: BattleSnapshot,
    previous: BattleSnapshot | null | undefined,
    alpha: number,
    delta: number,
    paused: boolean,
    reduced: boolean,
    hoverByFighter: ReadonlyMap<string, number>,
  ) {
    this.paused = paused;
    this.reduced = reduced;
    for (const emitter of this.emitters.values()) {
      emitter.timeScale = paused ? 0 : 1;
      if (reduced) emitter.killAll();
    }
    if (!paused) this.particleClock += Math.min(delta, 100);
    const emit = !paused && !reduced && this.particleClock >= 35;
    if (emit) this.particleClock %= 35;
    const live = new Set<string>();
    for (const hazard of snapshot.groundHazards ?? []) {
      const id = `hazard-${hazard.id}`;
      const age = SKILL_BY_ID[hazard.skillId].groundHazard!.duration - hazard.duration;
      const appear = Math.max(0.25, Math.min(1, age / 0.18));
      const fade = Math.min(1, hazard.duration / 0.55);
      const y = 520 + hazard.depth + 4;
      this.place(
        id,
        'skill-vfx-sludge-puddle',
        hazard.x,
        y,
        hazard.radius * 2.3 * appear,
        hazard.radius * 1.2 * appear,
        0,
      );
      this.attached
        .get(id)!
        .sprite.setDepth(3)
        .setAlpha((reduced ? 0.7 : 0.88) * fade);
      live.add(id);
      if (!this.seenHazards.has(hazard.id)) {
        this.seenHazards.add(hazard.id);
        if (!reduced) {
          const splash = this.sprite('skill-vfx-sludge-impact')
            .setPosition(hazard.x, y - 12)
            .setDisplaySize(160, 92)
            .setDepth(12);
          if (paused) splash.anims.pause();
          this.impacts.push({ sprite: splash, remaining: 400 });
        }
      }
      if (emit) this.emitters.get('poison')!.emitParticleAt(hazard.x, y - 12, 2);
    }
    for (const f of snapshot.fighters) {
      if (!f.active || f.hp <= 0) continue;
      const old = previous?.fighters.find((v) => v.id === f.id && v.active === f.active);
      const x = old ? Phaser.Math.Linear(old.x, f.x, alpha) : f.x;
      const y =
        492 +
        (old
          ? Phaser.Math.Linear(old.depth, f.depth, alpha) - Phaser.Math.Linear(old.y, f.y, alpha)
          : f.depth - f.y) -
        (hoverByFighter.get(f.id) ?? 0);
      if (f.effects.some((effect) => effect.kind === 'stun')) {
        const statusId = `paralyzed-${f.id}`;
        this.place(statusId, 'skill-vfx-paralyzed', x, y, 94, 94, 0);
        live.add(statusId);
        if (emit) this.emitters.get('electric')!.emitParticleAt(x, y, 2);
      }
      if (f.effects.some((effect) => effect.kind === 'burn')) {
        const statusId = `burning-${f.id}`;
        this.place(statusId, 'skill-vfx-burning', x, y - 22, 78, 94, 0);
        this.attached
          .get(statusId)!
          .sprite.setAlpha(this.reduced ? 0.55 : 0.8)
          .setDepth(11);
        live.add(statusId);
        if (emit) this.emitters.get('fire')!.emitParticleAt(x, y - 30, 2);
      }
      if (f.species === 'eevee' && (f.adaptiveCharge ?? 0) > 0) {
        const id = `adaptive-${f.id}`;
        this.place(id, 'skill-vfx-eevee-adaptive', x, y - 20, 105, 105, 0);
        this.attached.get(id)!.sprite.setAlpha(0.62);
        live.add(id);
      }
      if (!f.cast) continue;
      const skill = SKILL_BY_ID[f.cast.skillId];
      if (skill.id === 'tail-whip') continue;
      if (skill.id === 'cursed-scroll-bind') {
        if (f.cast.elapsed < skill.startup && !reduced && this.scene.textures.exists('runedrake')) {
          for (let i = 1; i <= 3; i++) {
            const id = `bind-dash-${f.id}-${i}`;
            this.place(id, 'runedrake', x - f.aimX * i * 33, y - f.aimDepth * i * 33, 288, 144, 0);
            this.attached
              .get(id)!
              .sprite.setFrame(42 + i)
              .setFlipX(f.facing < 0)
              .setAlpha(0.36 - i * 0.08);
            live.add(id);
          }
        }
        if (
          f.cast.bound &&
          this.scene.textures.exists('runedrake-bind-body') &&
          this.scene.textures.exists('runedrake-bind-head')
        ) {
          const target = snapshot.fighters.find(
            (v) => v.id === f.cast?.targetId && v.active && v.hp > 0,
          );
          if (target) {
            const oldTarget = previous?.fighters.find((v) => v.id === target.id);
            const tx = oldTarget ? Phaser.Math.Linear(oldTarget.x, target.x, alpha) : target.x;
            const ty =
              492 +
              (oldTarget
                ? Phaser.Math.Linear(oldTarget.depth, target.depth, alpha) -
                  Phaser.Math.Linear(oldTarget.y, target.y, alpha)
                : target.depth - target.y) -
              (hoverByFighter.get(target.id) ?? 0);
            const size = POKEMON[target.species].collision;
            const baseDiameter = Math.max(210, 125 + (size.width + size.height) * 1.1);
            const bindAge = Math.max(0, f.cast.elapsed - skill.startup);
            const squeeze = Math.min(1, bindAge / skill.active);
            const wrap = reduced ? 1 : Math.min(1, bindAge / 0.9);
            const pulse = reduced
              ? 0
              : Math.max(0, 1 - Math.abs(bindAge - Math.round(bindAge)) / 0.16);
            const diameter = baseDiameter * (1.2 - 0.29 * squeeze - 0.045 * pulse);
            const id = `bind-coil-${f.id}`;
            this.place(
              id,
              'runedrake-bind-body',
              tx,
              ty - 12,
              diameter,
              diameter * (1 - 0.06 * squeeze),
              -0.07 * squeeze + Math.sin(bindAge * 6) * (reduced ? 0 : 0.02),
            );
            const coil = this.attached.get(id)!.sprite;
            coil
              .setFlipX(f.facing < 0)
              .setDepth(14)
              .setAlpha(reduced ? 0.75 : 0.98);
            let wrapMask = this.wrapMasks.get(id);
            if (!wrapMask) {
              const graphics = this.scene.make.graphics({}, false);
              coil.setMask(graphics.createGeometryMask());
              wrapMask = { graphics, sprite: coil };
              this.wrapMasks.set(id, wrapMask);
            }
            const mask = wrapMask.graphics.clear().fillStyle(0xffffff);
            if (wrap >= 1) mask.fillCircle(tx, ty - 12, diameter);
            else {
              const entry = f.facing > 0 ? Math.PI : 0;
              const direction = f.facing;
              const points = [new Phaser.Geom.Point(tx, ty - 12)];
              for (let index = 0; index <= 48; index++) {
                const angle = entry + (direction * wrap * Math.PI * 2 * index) / 48;
                points.push(
                  new Phaser.Geom.Point(
                    tx + Math.cos(angle) * diameter,
                    ty - 12 + Math.sin(angle) * diameter,
                  ),
                );
              }
              mask.fillPoints(points, true);
            }
            live.add(id);
            const entry = f.facing > 0 ? Math.PI : 0;
            const crawl = Math.max(0, Math.min(1, (bindAge - 0.9) / 2.1));
            const headAngle = entry + f.facing * (wrap * Math.PI * 2 + crawl * Math.PI * 0.55);
            const headId = `bind-head-${f.id}`;
            const radius = diameter * 0.35;
            this.place(
              headId,
              'runedrake-bind-head',
              tx + Math.cos(headAngle) * radius,
              ty - 12 + Math.sin(headAngle) * radius,
              diameter * 0.65,
              diameter * 0.44,
              headAngle + (f.facing * Math.PI) / 2,
            );
            this.attached
              .get(headId)!
              .sprite.setOrigin(0.79, 0.53)
              .setDepth(Math.sin(headAngle) < 0 ? 9 : 15)
              .setAlpha(reduced ? 0.76 : 1);
            live.add(headId);
            if (pulse > 0.05) {
              const pressureId = `bind-pressure-${f.id}`;
              this.place(
                pressureId,
                'runedrake-bind-body',
                tx,
                ty - 12,
                diameter * 1.12,
                diameter * 1.05,
                -0.07 * squeeze,
              );
              this.attached
                .get(pressureId)!
                .sprite.setFlipX(f.facing < 0)
                .setDepth(13)
                .setTint(0xffaa77)
                .setAlpha(pulse * 0.28);
              live.add(pressureId);
            }
            if (emit && !reduced) {
              const angle = bindAge * 5;
              this.emitters
                .get('fire')!
                .emitParticleAt(
                  tx + Math.cos(angle) * diameter * 0.34,
                  ty - 12 + Math.sin(angle) * diameter * 0.34,
                  1 + Math.round(pulse * 2),
                );
            }
          }
        }
        continue;
      }
      if (skill.id === 'ember-glyph') {
        if (f.cast.elapsed < skill.startup) {
          for (let i = 0; i < 3; i++) {
            const id = `cast-${f.id}-${i}`;
            this.place(id, 'ember-glyph-art', x + (i - 1) * 27, y - 48 + (i % 2) * 6, 43, 22, 0);
            this.attached
              .get(id)!
              .sprite.setAlpha(
                (this.reduced ? 0.45 : 0.55) + 0.25 * Math.min(1, f.cast.elapsed / skill.startup),
              );
            live.add(id);
          }
        }
        continue;
      }
      if (f.species === 'eevee' && skill.id === 'counter-pounce') {
        const triggered = f.cast.counterAt !== undefined;
        const id = `cast-${f.id}`;
        this.place(
          id,
          triggered ? 'skill-vfx-counter-pounce' : 'skill-vfx-eevee-guard',
          x,
          y - 12,
          triggered ? 150 : 104,
          triggered ? 138 : 104,
          0,
        );
        live.add(id);
        continue;
      }
      if (f.species === 'eevee' && skill.id === 'shadow-step') {
        const p = Math.max(0, Math.min(1, (f.cast.elapsed - skill.startup) / 1));
        if (p > 0 && p < 1) {
          for (let i = 1; i <= 3; i++) {
            const id = `shadow-${f.id}-${i}`;
            const back = i * 28;
            const fade = Math.max(0, 1 - (p - (3 - i) * 0.12) / 0.7);
            if (fade <= 0.03) continue;
            this.place(
              id,
              'skill-vfx-shadow-step',
              x - f.aimX * back,
              y - f.aimDepth * back,
              104 - i * 8,
              92 - i * 6,
              0,
            );
            this.attached.get(id)!.sprite.setAlpha((0.47 - i * 0.1) * fade);
            live.add(id);
          }
        }
        continue;
      }
      if (f.species === 'eevee' && skill.id === 'starfall-rush') {
        if (f.cast.elapsed >= skill.startup) {
          const id = `cast-${f.id}`;
          this.place(
            id,
            'skill-vfx-starfall-rush',
            x,
            y - 20,
            f.cast.elapsed > 1.48 ? 220 : 130,
            f.cast.elapsed > 1.48 ? 180 : 110,
            0,
          );
          live.add(id);
          if (!reduced)
            for (let i = 1; i <= 2; i++) {
              const trailId = `${id}-trail-${i}`;
              this.place(trailId, 'skill-vfx-shadow-step', x - f.aimX * i * 25, y, 110, 90, 0);
              this.attached.get(trailId)!.sprite.setAlpha(0.35 - i * 0.1);
              live.add(trailId);
            }
        }
        continue;
      }
      const charge = f.cast.elapsed < skill.startup;
      const active = f.cast.elapsed <= skill.startup + skill.active + 0.1;
      if (!charge && (!active || skill.behavior === 'projectile' || skill.behavior === 'debuff'))
        continue;
      const id = `cast-${f.id}`;
      const electroCharge = charge && skill.id === 'electro-ball';
      const directional = !charge && skill.behavior !== 'buff';
      const stream = skill.id === 'inferno-stream' && !charge;
      const targetAngle = Math.atan2(f.aimDepth, f.aimX);
      const oldAngle = old ? Math.atan2(old.aimDepth, old.aimX) : targetAngle;
      const angle = stream
        ? oldAngle +
          Math.atan2(Math.sin(targetAngle - oldAngle), Math.cos(targetAngle - oldAngle)) * alpha
        : targetAngle;
      const length = directional ? skill.range : 76;
      const center = directional ? length * (stream ? 0.54 : 0.45) : 0;
      this.place(
        id,
        `skill-vfx-${electroCharge ? 'electro-charge' : charge && f.species === 'eevee' ? 'eevee-adaptive' : charge ? `charge-${skill.element}` : skill.id}`,
        x + Math.cos(angle) * center,
        y + Math.sin(angle) * center,
        electroCharge ? 112 : length * (directional ? (stream ? 1.08 : 1.2) : 1),
        electroCharge ? 112 : stream ? 310 : skill.behavior === 'area' && !charge ? 100 : 80,
        directional ? angle : 0,
      );
      live.add(id);
      if (stream && emit)
        for (const distance of [0.28, 0.55, 0.82])
          this.emitters
            .get('fire')!
            .emitParticleAt(
              x + Math.cos(angle) * skill.range * distance,
              y + Math.sin(angle) * skill.range * distance,
              3,
            );
      if (emit)
        this.emitters
          .get(skill.element)!
          .emitParticleAt(
            x + Math.cos(angle) * center,
            y + Math.sin(angle) * center,
            charge ? 1 : 3,
          );
    }
    for (const p of snapshot.projectiles) {
      const old = previous?.projectiles.find((v) => v.id === p.id);
      const x = old ? Phaser.Math.Linear(old.x, p.x, alpha) : p.x;
      const depth = old ? Phaser.Math.Linear(old.depth ?? 0, p.depth ?? 0, alpha) : (p.depth ?? 0);
      const y = 520 + depth - p.y;
      const skill = SKILL_BY_ID[p.skillId];
      const angle = Math.atan2(p.vDepth ?? 0, p.vx);
      const id = `projectile-${p.id}`;
      const width =
        skill.id === 'swift'
          ? 48
          : skill.id === 'solar-beam'
            ? 160
            : skill.id === 'sludge-bomb'
              ? 104
              : skill.id === 'flame-burst'
                ? 100
                : skill.id === 'ember-glyph'
                  ? 94
                  : Math.max(76, p.width * 2);
      const auraSize = skill.electricAura
        ? ((p.width + skill.electricAura.reach * 2) * 128) / 116
        : null;
      this.place(
        id,
        skill.id === 'electro-ball'
          ? 'electro-ball-art'
          : skill.id === 'ember-glyph'
            ? 'ember-glyph-art'
            : `skill-vfx-${skill.id}`,
        x,
        y,
        auraSize ?? width,
        auraSize ??
          (skill.id === 'sludge-bomb'
            ? 104
            : skill.id === 'ember-glyph'
              ? 47
              : Math.max(60, p.height * 2.3)),
        angle,
      );
      if (skill.id === 'swift')
        this.attached
          .get(id)!
          .sprite.setRotation(snapshot.elapsed * 8)
          .setDepth(13);
      if (skill.id === 'sludge-bomb' && !reduced) {
        const speed = Math.hypot(p.vx, p.vDepth ?? 0) || 1;
        for (let i = 1; i <= 2; i++) {
          const trailId = `${id}-trail-${i}`;
          this.place(
            trailId,
            'skill-vfx-sludge-trail',
            x - (p.vx / speed) * i * 20,
            y - ((p.vDepth ?? 0) / speed) * i * 20,
            48 - i * 10,
            48 - i * 10,
            0,
          );
          this.attached
            .get(trailId)!
            .sprite.setAlpha(0.5 - i * 0.12)
            .setDepth(11);
          live.add(trailId);
        }
      }
      if (skill.id === 'electro-ball') {
        const orb = this.attached.get(id)!.sprite;
        orb.setRotation(this.reduced ? 0 : snapshot.elapsed * 0.8).setDepth(12);
        const arcId = `${id}-arcs`;
        if (!reduced) {
          this.place(
            arcId,
            'skill-vfx-electro-ball',
            x,
            y,
            auraSize ?? width,
            auraSize ?? width,
            0,
          );
          this.attached.get(arcId)!.sprite.setAlpha(0.4).setDepth(13);
          live.add(arcId);
        }
      }
      live.add(id);
      if (skill.id === 'electro-ball' && !reduced) {
        const speed = Math.hypot(p.vx, p.vDepth ?? 0) || 1;
        for (let i = 1; i <= 3; i++) {
          const trailId = `${id}-trail-${i}`;
          const distance = i * 25;
          const trailSize = 94 - i * 17;
          this.place(
            trailId,
            'skill-vfx-electro-trail',
            x - (p.vx / speed) * distance,
            y - ((p.vDepth ?? 0) / speed) * distance,
            trailSize,
            trailSize,
            0,
          );
          this.attached
            .get(trailId)!
            .sprite.setAlpha(0.55 - i * 0.11)
            .setDepth(11);
          live.add(trailId);
        }
      }
      if (emit)
        this.emitters
          .get(skill.element)!
          .emitParticleAt(
            x - Math.cos(angle) * 18,
            y - Math.sin(angle) * 18,
            skill.id === 'electro-ball' ? 6 : 2,
          );
    }
    for (const [id, effect] of this.attached)
      if (!live.has(id)) {
        const wrapMask = this.wrapMasks.get(id);
        if (wrapMask) {
          wrapMask.sprite.clearMask(true);
          wrapMask.graphics.destroy();
          this.wrapMasks.delete(id);
        }
        effect.sprite.destroy();
        this.attached.delete(id);
      }
    for (const impact of this.impacts) {
      if (paused || reduced) impact.sprite.anims.pause();
      else impact.sprite.anims.resume();
      if (!paused) impact.remaining -= delta;
      if (reduced) impact.sprite.setFrame(4).setAlpha(Math.max(0, impact.remaining / 400) * 0.6);
      if (impact.remaining <= 0) impact.sprite.destroy();
    }
    this.impacts = this.impacts.filter((v) => v.remaining > 0);
  }

  event(event: BattleEvent, hoverLift = 0) {
    if (event.kind !== 'damage' && event.kind !== 'heal') return;
    if (event.text.endsWith('· pool')) return;
    const element = event.kind === 'heal' ? 'grass' : (event.element ?? 'normal');
    const x = event.x,
      y = 492 + (event.depth ?? 0) - event.y - hoverLift;
    const electroBall = event.text.startsWith('Electro Ball');
    const sludgeBomb = event.text.startsWith('Sludge Bomb');
    const finale = event.text.startsWith('Starfall Rush · finale');
    const eeveeImpact = finale
      ? 'starfall-impact'
      : event.text.startsWith('Swift')
        ? 'swift'
        : event.text.startsWith('Counter Pounce')
          ? 'counter-pounce'
          : event.text.startsWith('Starfall Rush')
            ? 'swift'
            : event.text.startsWith('Shadow Step')
              ? 'shadow-step'
              : event.text.startsWith('Quick Paw')
                ? 'eevee-strike'
                : null;
    const sprite = this.sprite(
      eeveeImpact
        ? `skill-vfx-${eeveeImpact}`
        : electroBall
          ? 'skill-vfx-electro-impact'
          : sludgeBomb
            ? 'skill-vfx-sludge-impact'
            : `skill-vfx-impact-${element}`,
    )
      .setPosition(x, y)
      .setDisplaySize(
        this.reduced
          ? 62
          : finale
            ? 190
            : eeveeImpact === 'swift'
              ? 66
              : electroBall
                ? 150
                : sludgeBomb
                  ? 128
                  : 110,
        this.reduced
          ? 62
          : finale
            ? 170
            : eeveeImpact === 'swift'
              ? 66
              : electroBall
                ? 150
                : sludgeBomb
                  ? 128
                  : 110,
      );
    if (this.paused || this.reduced) sprite.anims.pause();
    if (this.reduced) sprite.setFrame(4).setAlpha(0.6);
    this.impacts.push({ sprite, remaining: 400 });
    if (this.impacts.length > 32) this.impacts.shift()!.sprite.destroy();
    if (!this.reduced && !this.paused) this.emitters.get(element)!.emitParticleAt(x, y, 16);
  }

  destroy() {
    for (const wrapMask of this.wrapMasks.values()) {
      wrapMask.sprite.clearMask(true);
      wrapMask.graphics.destroy();
    }
    this.wrapMasks.clear();
    for (const effect of this.attached.values()) effect.sprite.destroy();
    for (const impact of this.impacts) impact.sprite.destroy();
    for (const emitter of this.emitters.values()) emitter.destroy();
    this.attached.clear();
    this.seenHazards.clear();
    this.impacts = [];
    this.emitters.clear();
  }
}
