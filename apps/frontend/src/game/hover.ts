export function hoverTarget(
  height: number,
  grounded: boolean,
  time: number,
  reducedMotion: boolean,
) {
  if (grounded || height <= 0) return 0;
  return height + (reducedMotion ? 0 : Math.sin(time / 420) * 4);
}

export function easeHover(current: number, target: number, delta: number) {
  const step = 1 - Math.exp(-Math.min(Math.max(delta, 0), 100) / 180);
  return current + (target - current) * step;
}
