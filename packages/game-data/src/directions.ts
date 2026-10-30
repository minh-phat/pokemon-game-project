/** Screen-space headings: positive Y points toward the viewer. */
export const DIRECTIONS = [
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'north',
  'northeast',
] as const;
export type Direction = (typeof DIRECTIONS)[number];

export function movementDirection(x: number, y: number, previous: Direction = 'east'): Direction {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < 0.001) return previous;
  const angle = Math.atan2(y, x);
  const oldAngle = (DIRECTIONS.indexOf(previous) * Math.PI) / 4;
  const difference = Math.atan2(Math.sin(angle - oldAngle), Math.cos(angle - oldAngle));
  // A small overlap prevents flickering at the boundary between two headings.
  if (Math.abs(difference) < Math.PI / 8 + 0.07) return previous;
  return DIRECTIONS[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}

export function worldMovementDirection(dx: number, dy: number, previous: Direction = 'east') {
  return movementDirection(dx - dy, (dx + dy) / 2, previous);
}

/** Six columns: original east idle/run, then authored north, NE, SE and south runs. */
export function directionRow(direction: Direction) {
  switch (direction) {
    case 'north':
      return 2;
    case 'northeast':
    case 'northwest':
      return 3;
    case 'southeast':
    case 'southwest':
      return 4;
    case 'south':
      return 5;
    default:
      return 1;
  }
}

export function directionFlipped(direction: Direction) {
  return direction === 'west' || direction === 'northwest' || direction === 'southwest';
}

export function locomotionFrame(
  direction: Direction,
  moving: boolean,
  elapsed: number,
  frameRate: number,
  reducedMotion = false,
) {
  const row = directionRow(direction);
  const frame = reducedMotion ? 0 : Math.floor(Math.max(0, elapsed) * frameRate) % 6;
  if (!moving) return row === 1 ? frame : row * 6;
  return row * 6 + frame;
}
