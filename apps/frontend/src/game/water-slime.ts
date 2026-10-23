import type { Fighter } from '@arena/shared-types';

/** Continuous deformation supplements the authored poses between sprite frames. */
export function slimePose(f: Fighter, reduced = false) {
  if (reduced) return { x: 1, y: 1, lift: 0 };
  const t = f.animationTime;
  let squash = Math.sin(t * 5) * 0.025;
  let lift = 0;
  if (f.animation === 'run') {
    const bounce = Math.sin(t * (f.sprinting ? 16 : 11));
    squash = bounce * 0.1;
    lift = Math.max(0, bounce) * 7;
  } else if (f.animation === 'jump' || f.animation === 'fall') squash = -0.09;
  else if (f.animation === 'land' || f.animation === 'hit' || f.animation === 'knockback')
    squash = Math.cos(t * 22) * Math.exp(-t * 6) * 0.17;
  if (f.cast?.skillId === 'spring-tackle') {
    const age = f.cast.elapsed;
    squash =
      age < 0.3
        ? Math.sin(((age / 0.3) * Math.PI) / 2) * 0.28
        : age < 0.52
          ? -Math.sin(((age - 0.3) / 0.22) * Math.PI) * 0.2
          : Math.sin((age - 0.52) * 22) * Math.exp(-(age - 0.52) * 12) * 0.12;
  } else if (f.cast?.skillId === 'liquid-guard') squash = Math.sin(f.cast.elapsed * 8) * 0.045;
  return { x: 1 + squash, y: 1 / (1 + squash), lift };
}

export function slimeOpacity(f: Fighter, owner: boolean) {
  const veil = f.effects.find((e) => e.kind === 'invisible');
  if (!veil || f.hp <= 0) return 1;
  const fade = Math.min(1, Math.max(0, (5 - veil.duration) / 0.5));
  return 1 - fade * (owner ? 0.72 : 1);
}
