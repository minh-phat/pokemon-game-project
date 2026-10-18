import * as Phaser from 'phaser';
import { ELEMENTS, SKILL_BY_ID } from '@arena/game-data';
import type { BattleEvent, BattleSnapshot, Element } from '@arena/shared-types';
import { createSkillTextures } from './skill-textures';

type Effect = { sprite: Phaser.GameObjects.Sprite; key: string };

export class SkillVfx {
  private attached = new Map<string, Effect>();
  private impacts: { sprite: Phaser.GameObjects.Sprite; remaining: number }[] = [];
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
    if (key !== 'electro-ball-art') sprite.play(key);
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
    if (this.reduced) effect.sprite.setFrame(3);
  }

  update(
    snapshot: BattleSnapshot,
    previous: BattleSnapshot | null | undefined,
    alpha: number,
    delta: number,
    paused: boolean,
    reduced: boolean,
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
    for (const f of snapshot.fighters) {
      if (!f.active || f.hp <= 0) continue;
      const old = previous?.fighters.find((v) => v.id === f.id && v.active === f.active);
      const x = old ? Phaser.Math.Linear(old.x, f.x, alpha) : f.x;
      const y =
        492 +
        (old
          ? Phaser.Math.Linear(old.depth, f.depth, alpha) - Phaser.Math.Linear(old.y, f.y, alpha)
          : f.depth - f.y);
      if (f.effects.some((effect) => effect.kind === 'stun')) {
        const statusId = `paralyzed-${f.id}`;
        this.place(statusId, 'skill-vfx-paralyzed', x, y, 94, 94, 0);
        live.add(statusId);
        if (emit) this.emitters.get('electric')!.emitParticleAt(x, y, 2);
      }
      if (!f.cast) continue;
      const skill = SKILL_BY_ID[f.cast.skillId];
      const charge = f.cast.elapsed < skill.startup;
      const active = f.cast.elapsed <= skill.startup + skill.active + 0.1;
      if (!charge && (!active || skill.behavior === 'projectile' || skill.behavior === 'debuff'))
        continue;
      const id = `cast-${f.id}`;
      const electroCharge = charge && skill.id === 'electro-ball';
      const directional = !charge && skill.behavior !== 'buff';
      const angle = Math.atan2(f.aimDepth, f.aimX);
      const length = directional ? skill.range : 76;
      const center = directional ? length * 0.45 : 0;
      this.place(
        id,
        `skill-vfx-${electroCharge ? 'electro-charge' : charge ? `charge-${skill.element}` : skill.id}`,
        x + Math.cos(angle) * center,
        y + Math.sin(angle) * center,
        electroCharge ? 112 : length * (directional ? 1.2 : 1),
        electroCharge ? 112 : skill.behavior === 'area' && !charge ? 100 : 80,
        directional ? angle : 0,
      );
      live.add(id);
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
        skill.id === 'solar-beam'
          ? 160
          : skill.id === 'flame-burst'
            ? 100
            : Math.max(76, p.width * 2);
      const auraSize = skill.electricAura
        ? ((p.width + skill.electricAura.reach * 2) * 128) / 116
        : null;
      this.place(
        id,
        skill.id === 'electro-ball' ? 'electro-ball-art' : `skill-vfx-${skill.id}`,
        x,
        y,
        auraSize ?? width,
        auraSize ?? Math.max(60, p.height * 2.3),
        angle,
      );
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
    for (const impact of this.impacts) {
      if (paused || reduced) impact.sprite.anims.pause();
      else impact.sprite.anims.resume();
      if (!paused) impact.remaining -= delta;
      if (reduced) impact.sprite.setFrame(4).setAlpha(Math.max(0, impact.remaining / 400) * 0.6);
      if (impact.remaining <= 0) impact.sprite.destroy();
    }
    this.impacts = this.impacts.filter((v) => v.remaining > 0);
  }

  event(event: BattleEvent) {
    if (event.kind !== 'damage' && event.kind !== 'heal') return;
    const element = event.kind === 'heal' ? 'grass' : (event.element ?? 'normal');
    const x = event.x,
      y = 492 + (event.depth ?? 0) - event.y;
    const electroBall = event.text.startsWith('Electro Ball');
    const sprite = this.sprite(
      electroBall ? 'skill-vfx-electro-impact' : `skill-vfx-impact-${element}`,
    )
      .setPosition(x, y)
      .setDisplaySize(
        this.reduced ? 62 : electroBall ? 150 : 110,
        this.reduced ? 62 : electroBall ? 150 : 110,
      );
    if (this.paused || this.reduced) sprite.anims.pause();
    if (this.reduced) sprite.setFrame(4).setAlpha(0.6);
    this.impacts.push({ sprite, remaining: 400 });
    if (this.impacts.length > 32) this.impacts.shift()!.sprite.destroy();
    if (!this.reduced && !this.paused) this.emitters.get(element)!.emitParticleAt(x, y, 16);
  }

  destroy() {
    for (const effect of this.attached.values()) effect.sprite.destroy();
    for (const impact of this.impacts) impact.sprite.destroy();
    for (const emitter of this.emitters.values()) emitter.destroy();
    this.attached.clear();
    this.impacts = [];
    this.emitters.clear();
  }
}
