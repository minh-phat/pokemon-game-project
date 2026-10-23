import { terrainContact } from '@arena/game-core';
import * as Phaser from 'phaser';
import { ARENAS, ELEMENTS, POKEMON, SKILL_BY_ID } from '@arena/game-data';
import type { BattleEvent, BattleSnapshot, Element } from '@arena/shared-types';
import { createSkillTextures } from './skill-textures';
import { BindVfx } from './bind-vfx';

type Effect = { sprite: Phaser.GameObjects.Sprite; key: string };

export class SkillVfx {
  private attached = new Map<string, Effect>();
  private beamGraphics = new Map<string, Phaser.GameObjects.Graphics>();
  private binds = new Map<string, BindVfx>();
  private impacts: { sprite: Phaser.GameObjects.Sprite; remaining: number }[] = [];
  private seenHazards = new Set<string>();
  private emitters = new Map<Element, Phaser.GameObjects.Particles.ParticleEmitter>();
  private particleClock = 0;
  private beamTime = 0;
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
      key !== 'water-slime-wrap-art' &&
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
      key !== 'water-slime-wrap-art' &&
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
    if (!paused && !reduced) this.beamTime += Math.min(delta, 100) / 1000;
    for (const emitter of this.emitters.values()) {
      emitter.timeScale = paused ? 0 : 1;
      if (reduced) emitter.killAll();
    }
    if (!paused) this.particleClock += Math.min(delta, 100);
    const emit = !paused && !reduced && this.particleClock >= 35;
    if (emit) this.particleClock %= 35;
    const live = new Set<string>();
    const liveBinds = new Set<string>();
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
      if (skill.id === 'liquid-wrap') {
        const target = snapshot.fighters.find((v) => v.id === f.cast?.targetId);
        if (f.cast.bound && target) {
          const age = Math.max(0, f.cast.elapsed - skill.startup);
          const enter = Math.min(1, age / 0.22);
          const release = Math.min(
            1,
            Math.max(
              0,
              (skill.startup + skill.active + skill.recovery - f.cast.elapsed) / skill.recovery,
            ),
          );
          const wobble = reduced ? 0 : Math.sin(age * 9) * 0.035;
          const size = POKEMON[target.species].collision;
          const id = `liquid-wrap-${f.id}`;
          this.place(
            id,
            'water-slime-wrap-art',
            target.x,
            520 + target.depth - target.y - size.height * 0.6,
            (size.width + 86) * (0.65 + 0.35 * enter) * (1 + wobble),
            (size.height + 96) * (0.65 + 0.35 * enter) * (1 - wobble),
            0,
          );
          this.attached
            .get(id)!
            .sprite.setAlpha(0.6 * enter * release)
            .setDepth(14 + target.depth / 300);
          live.add(id);
          if (emit)
            this.emitters
              .get('water')!
              .emitParticleAt(target.x, 520 + target.depth - target.y - size.height, 2);
        }
        continue;
      }
      if (['spring-tackle', 'water-veil', 'liquid-guard', 'water-orb'].includes(skill.id)) continue;
      if (skill.id === 'tail-whip') continue;
      if (skill.beam) {
        const mouthX = x + f.aimX * 45;
        const mouthY = y + f.aimDepth * 45 - 20;
        const charge = f.cast.elapsed < skill.startup;
        const fade = Math.max(
          0,
          1 - (f.cast.elapsed - skill.startup - skill.active) / skill.recovery,
        );
        if (fade <= 0) continue;
        const id = `beam-mouth-${f.id}`;
        const progress = Math.min(1, f.cast.elapsed / skill.startup);
        const ignition = charge ? 0 : Math.max(0, 1 - (f.cast.elapsed - skill.startup) / 0.16);
        const size = charge ? 30 + 65 * progress * progress : 86 + ignition * 32;
        this.place(
          id,
          'skill-vfx-dragon-laser-charge',
          mouthX,
          mouthY,
          size,
          size,
          Math.atan2(f.aimDepth, f.aimX),
        );
        this.attached
          .get(id)!
          .sprite.setDepth(15)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha((charge ? 0.55 + 0.45 * progress : 0.95) * fade);
        live.add(id);
        if (emit && !reduced)
          this.emitters.get('fire')!.emitParticleAt(mouthX, mouthY, charge ? 2 : 5);
        continue;
      }
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
        if (f.cast.bound && this.scene.textures.exists('runedrake-bind-rig')) {
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
            const elapsed =
              old?.cast?.skillId === f.cast.skillId && old.cast.bound
                ? Phaser.Math.Linear(old.cast.elapsed, f.cast.elapsed, alpha)
                : f.cast.elapsed;
            let bind = this.binds.get(f.id);
            if (!bind) {
              bind = new BindVfx(this.scene);
              this.binds.set(f.id, bind);
            }
            bind.update(
              tx,
              ty,
              size.width,
              size.height,
              f.facing,
              Math.max(0, elapsed - skill.startup),
              skill.active,
              reduced,
            );
            liveBinds.add(f.id);
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
      const arena = ARENAS.find((a) => a.id === snapshot.rules.arena)!;
      const contact = directional
        ? terrainContact(arena, f, {
            x: f.x + Math.cos(angle) * skill.range,
            depth: f.depth + Math.sin(angle) * skill.range,
          })
        : 1;
      const length = directional ? skill.range * contact : 76;
      if (directional && length < 1) continue;
      const center = directional ? length * (stream ? 0.54 : 0.45) : 0;
      this.place(
        id,
        `skill-vfx-${electroCharge ? 'electro-charge' : charge && f.species === 'eevee' ? 'eevee-adaptive' : charge ? `charge-${skill.element}` : skill.id}`,
        x + Math.cos(angle) * center,
        y + Math.sin(angle) * center,
        electroCharge ? 112 : length * (directional && contact === 1 ? (stream ? 1.08 : 1.2) : 1),
        electroCharge ? 112 : stream ? 310 : skill.behavior === 'area' && !charge ? 100 : 80,
        directional ? angle : 0,
      );
      live.add(id);
      if (stream && emit)
        for (const distance of [0.28, 0.55, 0.82])
          this.emitters
            .get('fire')!
            .emitParticleAt(
              x + Math.cos(angle) * length * distance,
              y + Math.sin(angle) * length * distance,
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
    const liveBeams = new Set<string>();
    const liveClashes = new Set<string>();
    for (const beam of snapshot.beams ?? []) {
      const owner = snapshot.fighters.find((f) => f.id === beam.ownerId);
      if (!owner) continue;
      const hover = hoverByFighter.get(owner.id) ?? 0;
      const sx = beam.startX,
        sy = 492 + beam.startDepth - owner.y - hover - 20;
      const ex = beam.endX,
        ey = 492 + beam.endDepth - owner.y - hover - 20;
      const length = Math.hypot(ex - sx, ey - sy);
      const angle = Math.atan2(ey - sy, ex - sx);
      const color = Phaser.Display.Color.HexStringToColor(
        ELEMENTS[SKILL_BY_ID[beam.skillId].element].color,
      ).color;
      let graphics = this.beamGraphics.get(beam.ownerId);
      if (!graphics) {
        graphics = this.scene.add.graphics().setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
        this.beamGraphics.set(beam.ownerId, graphics);
      }
      graphics.clear();
      const time = reduced ? 0 : this.beamTime;
      const dx = Math.cos(angle),
        dy = Math.sin(angle);
      const point = (along: number, across: number) =>
        new Phaser.Geom.Point(sx + dx * along - dy * across, sy + dy * along + dx * across);
      // Flame tongues travel towards the impact while the straight core stays readable.
      const tongues = Math.max(4, Math.ceil(length / 38));
      for (let i = 0; i < tongues; i++) {
        const t = (i / tongues + time * 0.8) % 1;
        const side = i % 2 ? 1 : -1;
        const envelope = Math.sin(t * Math.PI);
        const along = t * length;
        const base = side * beam.width * 0.3;
        const reach = side * beam.width * (0.7 + 0.25 * Math.sin(time * 13 + i)) * envelope;
        graphics.fillStyle(i % 3 ? color : 0xffd16d, reduced ? 0.25 : 0.55);
        graphics.fillPoints(
          [
            point(Math.max(0, along - 26), base),
            point(Math.max(0, along - 18), reach * 0.85),
            point(along - 8, reach),
            point(along + 4, reach * 0.55),
            point(Math.min(length, along + 15), base),
            point(along - 5, base * 0.65),
          ],
          true,
        );
      }
      liveBeams.add(beam.ownerId);
      const id = `beam-core-${beam.ownerId}`;
      this.place(
        id,
        'skill-vfx-dragon-laser',
        (sx + ex) / 2,
        (sy + ey) / 2,
        Math.max(4, length),
        beam.width * 2.8 * (1 + (reduced ? 0 : Math.sin(time * 17) * 0.025)),
        angle,
      );
      this.attached
        .get(id)!
        .sprite.setDepth(12)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(reduced ? 0.72 : 1);
      live.add(id);
      if (beam.clashWith) {
        const pair = [beam.ownerId, beam.clashWith].sort().join('-');
        if (!liveClashes.has(pair)) {
          const impactId = `beam-clash-${pair}`;
          const size = 138 + Math.sin(time * 19) * 5;
          this.place(impactId, 'skill-vfx-dragon-laser-impact', ex, ey, size, size, time * 0.4);
          this.attached.get(impactId)!.sprite.setDepth(16).setBlendMode(Phaser.BlendModes.ADD);
          live.add(impactId);
          liveClashes.add(pair);
          if (emit && !reduced) this.emitters.get('fire')!.emitParticleAt(ex, ey, 8);
        }
      } else if (
        snapshot.fighters.some(
          (f) =>
            f.team !== beam.team &&
            f.active &&
            f.hp > 0 &&
            Math.hypot(f.x - ex, f.depth - beam.endDepth) < 55,
        )
      ) {
        const impactId = `beam-hit-${beam.ownerId}`;
        this.place(impactId, 'skill-vfx-dragon-laser-impact', ex, ey, 96, 96, angle);
        this.attached
          .get(impactId)!
          .sprite.setDepth(14)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.9);
        live.add(impactId);
      }
      if (emit && !reduced)
        for (const part of [0.2, 0.5, 0.8])
          this.emitters
            .get('fire')!
            .emitParticleAt(sx + (ex - sx) * part, sy + (ey - sy) * part, 2);
    }
    for (const [id, graphics] of this.beamGraphics)
      if (!liveBeams.has(id)) {
        graphics.destroy();
        this.beamGraphics.delete(id);
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
        skill.id === 'water-orb'
          ? 36
          : skill.id === 'swift'
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
          (skill.id === 'water-orb'
            ? 36
            : skill.id === 'sludge-bomb'
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
        effect.sprite.destroy();
        this.attached.delete(id);
      }
    for (const [id, bind] of this.binds) {
      if (!liveBinds.has(id)) {
        bind.destroy();
        this.binds.delete(id);
      }
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
    for (const graphics of this.beamGraphics.values()) graphics.destroy();
    this.beamGraphics.clear();
    for (const bind of this.binds.values()) bind.destroy();
    this.binds.clear();
    for (const effect of this.attached.values()) effect.sprite.destroy();
    for (const impact of this.impacts) impact.sprite.destroy();
    for (const emitter of this.emitters.values()) emitter.destroy();
    this.attached.clear();
    this.seenHazards.clear();
    this.impacts = [];
    this.emitters.clear();
  }
}
