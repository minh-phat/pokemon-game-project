/** Ballistic water keeps the direction it had when it left the rotating shell. */
export const HYDRO_CROSSFIRE = {
  duration: 3,
  range: 240,
  speed: 640,
  angularSpeed: Math.PI,
  width: 16,
  pushSpeed: 110,
  interval: 0.15,
};
export function hydroCrossfirePoint(age: number, arm: number, radius: number) {
  const angle =
    Math.max(0, age - radius / HYDRO_CROSSFIRE.speed) * HYDRO_CROSSFIRE.angularSpeed +
    (arm * Math.PI) / 2;
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
