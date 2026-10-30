import type { HydroDrop } from '@arena/shared-types';

/** Ballistic water keeps the direction it had when it left the rotating shell. */
export const HYDRO_CROSSFIRE = {
  duration: 3,
  range: 240,
  speed: 640,
  angularSpeed: Math.PI,
  width: 16,
  pushSpeed: 110,
  interval: 0.15,
  emissionInterval: 0.018,
};
export function hydroCrossfirePoint(age: number, arm: number, radius: number) {
  const angle =
    hydroCrossfireRotation(Math.max(0, age - radius / HYDRO_CROSSFIRE.speed)) + (arm * Math.PI) / 2;
  return { x: Math.cos(angle) * radius, depth: Math.sin(angle) * radius };
}
export function hydroCrossfireHits(age: number, x: number, depth: number, bodyRadius: number) {
  const radius = Math.hypot(x, depth);
  if (radius > Math.min(HYDRO_CROSSFIRE.range, age * HYDRO_CROSSFIRE.speed) + bodyRadius)
    return false;
  for (let arm = 0; arm < 4; arm++) {
    const point = hydroCrossfirePoint(age, arm, Math.min(radius, HYDRO_CROSSFIRE.range));
    if (Math.hypot(x - point.x, depth - point.depth) <= HYDRO_CROSSFIRE.width / 2 + bodyRadius)
      return true;
  }
  return false;
}

/** Spin accelerates smoothly; water already in flight never turns with the shell. */
export function hydroCrossfireRotation(age: number) {
  const t = Math.max(0, age);
  return HYDRO_CROSSFIRE.angularSpeed * (t - 0.28 * (1 - Math.exp(-t / 0.28)));
}

export function createHydroDrop(
  emission: number,
  arm: number,
  x: number,
  depth: number,
): HydroDrop {
  const emittedAt = emission * HYDRO_CROSSFIRE.emissionInterval;
  const angle = hydroCrossfireRotation(emittedAt) + (arm * Math.PI) / 2;
  // Small pressure differences break up the surface without steering airborne water.
  const speed = HYDRO_CROSSFIRE.speed * (1 + 0.035 * Math.sin(emission * 2.4 + arm));
  return {
    id: emission * 4 + arm,
    emittedAt,
    x,
    depth,
    vx: Math.cos(angle) * speed,
    vDepth: Math.sin(angle) * speed,
  };
}

export function hydroDropPosition(drop: HydroDrop, age: number) {
  const flight = Math.max(0, age - drop.emittedAt);
  return { x: drop.x + drop.vx * flight, depth: drop.depth + drop.vDepth * flight };
}

export function hydroDropVisible(drop: HydroDrop, age: number) {
  const distance = (age - drop.emittedAt) * Math.hypot(drop.vx, drop.vDepth);
  return distance >= 28 && distance <= HYDRO_CROSSFIRE.range;
}
