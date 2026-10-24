import { tileAt, traversable, WALK_STEP, type Point, type World } from './open-world-world';

export const CLIMB_REACH = 8;
export const JUMP_SPEED = 11;
export const GRAVITY = 18;
export type MotionAction = 'walk' | 'jump' | 'fall' | 'climb' | 'blocked';
export type Motion = {
  position: Point;
  z: number;
  velocity: number;
  grounded: boolean;
  action: MotionAction;
  climbing: {
    from: Point;
    to: Point;
    bottom: number;
    top: number;
    elapsed: number;
    duration: number;
  } | null;
};
export type MotionInput = { x: number; y: number; sprint: boolean; jump: boolean; climb: boolean };

export function createMotion(world: World, position: Point): Motion {
  return {
    position: { ...position },
    z: tileAt(world, position.x, position.y)!.level,
    velocity: 0,
    grounded: true,
    action: 'walk',
    climbing: null,
  };
}

/** Fixed bounded steps prevent tunneling. Horizontal collision uses feet height while airborne. */
export function stepMotion(world: World, state: Motion, input: MotionInput, elapsed: number) {
  const dt = Math.min(0.05, Math.max(0, elapsed));
  if (state.climbing) {
    const climb = state.climbing;
    climb.elapsed += dt;
    const t = Math.min(1, climb.elapsed / climb.duration);
    const smooth = t * t * (3 - 2 * t);
    state.position.x = climb.from.x + (climb.to.x - climb.from.x) * smooth;
    state.position.y = climb.from.y + (climb.to.y - climb.from.y) * smooth;
    state.z = climb.bottom + (climb.top - climb.bottom) * smooth;
    state.action = 'climb';
    if (t === 1) {
      state.climbing = null;
      state.grounded = true;
      state.action = 'walk';
    }
    return;
  }
  const ground = tileAt(world, state.position.x, state.position.y)!;
  state.action = state.grounded ? 'walk' : state.velocity > 0 ? 'jump' : 'fall';
  if (input.jump && state.grounded && !ground.water) {
    state.velocity = JUMP_SPEED;
    state.grounded = false;
    state.action = 'jump';
  }
  if (!state.grounded) {
    state.velocity -= GRAVITY * dt;
    state.z += state.velocity * dt;
  }
  const length = Math.hypot(input.x, input.y);
  const speed = (input.sprint ? 5 : 3) * (ground.water ? 0.68 : 1);
  const distance = Math.min(length, speed * dt);
  const attempt = (target: Point) => {
    if (!traversable(world, target.x, target.y)) return;
    const current = tileAt(world, state.position.x, state.position.y)!;
    const next = tileAt(world, target.x, target.y)!;
    const rise = next.level - current.level;
    if (state.grounded && Math.abs(rise) > WALK_STEP) {
      if (input.climb && Math.abs(rise) <= CLIMB_REACH && !current.water && !next.water) {
        // Commit to a clear landing on the neighboring shelf, not into a trunk.
        const landing = { x: Math.floor(target.x) + 0.5, y: Math.floor(target.y) + 0.5 };
        if (!traversable(world, landing.x, landing.y)) {
          state.action = 'blocked';
          return;
        }
        state.climbing = {
          from: { ...state.position },
          to: landing,
          bottom: state.z,
          top: next.level,
          elapsed: 0,
          duration: 0.45 + Math.abs(rise) * 0.13,
        };
        state.grounded = false;
        state.velocity = 0;
        state.action = 'climb';
      } else state.action = 'blocked';
      return;
    }
    if (!state.grounded && next.level > state.z + 0.05) {
      state.action = 'blocked';
      return;
    }
    state.position.x = target.x;
    state.position.y = target.y;
    if (state.grounded) state.z = next.level;
  };
  if (length > 0.01) {
    attempt({ x: state.position.x + (input.x / length) * distance, y: state.position.y });
    if (!state.climbing)
      attempt({ x: state.position.x, y: state.position.y + (input.y / length) * distance });
  }
  if (!state.climbing) {
    const floor = tileAt(world, state.position.x, state.position.y)!.level;
    if (!state.grounded && state.z <= floor && state.velocity <= 0) {
      state.z = floor;
      state.velocity = 0;
      state.grounded = true;
      state.action = 'walk';
    }
  }
}
