import { canWalkBetween, findPath, tileAt, type Point, type World } from './open-world-world';
import { stepMotion, type Motion } from './open-world-motion';

export type FollowerMotion = {
  motion: Motion;
  path: Point[];
  repath: number;
  following: boolean;
  speed: number;
  idle?: {
    wait: number;
    sequence: number;
    wander: Point | null;
    remaining: number;
    lookAt: Point | null;
    restAt: Point | null;
  };
};

/** Each companion has its own quiet pauses, glances and short strolls. */
function idleDestination(
  world: World,
  follower: FollowerMotion,
  anchor: Point,
  dt: number,
  relaxed: boolean,
  phase: number,
) {
  const idle = (follower.idle ??= {
    wait: 2.5 + (phase % 2),
    sequence: 0,
    wander: null,
    remaining: 0,
    lookAt: null,
    restAt: null,
  });
  if (!relaxed) {
    idle.wait = 2.5 + (phase % 2);
    idle.wander = idle.lookAt = idle.restAt = null;
    return anchor;
  }
  const position = follower.motion.position;
  if (idle.wander) {
    idle.remaining -= dt;
    if (
      idle.remaining > 0 &&
      Math.hypot(idle.wander.x - position.x, idle.wander.y - position.y) > 0.25
    )
      return idle.wander;
    idle.restAt = idle.wander;
    idle.wander = null;
    follower.following = false;
    idle.wait = 3 + (Math.sin(idle.sequence + phase) + 1);
  }
  if (follower.following || follower.speed > 0.08) return idle.restAt ?? anchor;
  idle.wait -= dt;
  if (idle.wait > 0) return idle.restAt ?? anchor;
  idle.sequence++;
  idle.wait = 2.5 + (Math.sin(idle.sequence * 2.7 + phase) + 1);
  const angle = phase + idle.sequence * 2.39996;
  // Alternate looking around and strolling; never choose a blocked or wet landing.
  idle.lookAt = { x: position.x + Math.cos(angle), y: position.y + Math.sin(angle) };
  if (idle.sequence % 2 === 0) {
    const candidate = {
      x: anchor.x + Math.cos(angle) * 0.85,
      y: anchor.y + Math.sin(angle) * 0.85,
    };
    if (!tileAt(world, candidate.x, candidate.y)?.water && clearRoute(world, position, candidate)) {
      idle.restAt = null;
      idle.wander = candidate;
      idle.remaining = 3;
      follower.repath = 0;
      return candidate;
    }
  }
  return idle.restAt ?? anchor;
}

/** Check the whole segment so smoothing respects obstacles and ledges. */
function clearRoute(world: World, from: Point, to: Point) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.2));
  let previous = from;
  for (let i = 1; i <= steps; i++) {
    const next = {
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
    };
    if (!canWalkBetween(world, previous, next)) return false;
    previous = next;
  }
  return true;
}

export function stepFollower(
  world: World,
  follower: FollowerMotion,
  destination: Point,
  dt: number,
  options: { relaxed?: boolean; phase?: number } = {},
) {
  destination = idleDestination(
    world,
    follower,
    destination,
    dt,
    options.relaxed ?? false,
    options.phase ?? 0,
  );
  const wandering = Boolean(follower.idle?.wander);
  const position = follower.motion.position;
  const distance = Math.hypot(destination.x - position.x, destination.y - position.y);
  if (distance > 1.3 || wandering) follower.following = true;
  else if (distance < 0.45) follower.following = false;

  const direct = follower.following && clearRoute(world, position, destination);
  follower.repath -= dt;
  if (follower.repath <= 0) {
    follower.path = follower.following && !direct ? findPath(world, position, destination) : [];
    follower.repath = 0.5;
  }
  while (
    follower.path.length &&
    Math.hypot(follower.path[0].x - position.x, follower.path[0].y - position.y) < 0.4
  )
    follower.path.shift();
  let waypoint = follower.following ? (follower.path[0] ?? destination) : destination;
  if (direct) {
    waypoint = destination;
    follower.path = [];
  }
  const desiredSpeed = follower.following
    ? Math.min(wandering ? 1.1 : 5, Math.max(0, distance - 0.15) * 3)
    : 0;
  follower.speed += (desiredSpeed - follower.speed) * (1 - Math.exp(-7 * dt));
  if (follower.speed < 0.025) follower.speed = 0;
  const dx = waypoint.x - position.x;
  const dy = waypoint.y - position.y;
  const length = Math.hypot(dx, dy);
  // Finish decelerating after entering the resting radius instead of cutting movement off.
  const travel = Math.min(Math.max(0, length - 0.12), follower.speed * dt);
  stepMotion(
    world,
    follower.motion,
    {
      x: length > 0 ? (dx / length) * travel : 0,
      y: length > 0 ? (dy / length) * travel : 0,
      sprint: true,
      climb: true,
      jump: follower.motion.action === 'blocked',
    },
    dt,
  );
}
