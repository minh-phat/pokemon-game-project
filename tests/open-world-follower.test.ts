import { describe, expect, it } from 'vitest';
import { createWorld, tileAt, traversable } from '@arena/game-data/world';
import { createMotion } from '../apps/frontend/src/game/open-world-motion';
import { stepFollower, type FollowerMotion } from '../apps/frontend/src/game/open-world-follower';

function setup() {
  const world = createWorld(42);
  for (let y = 96; y < 128; y++)
    for (let x = 96; x < 128; x++)
      Object.assign(tileAt(world, x, y)!, {
        level: 10,
        water: false,
        lava: false,
        decoration: null,
        prop: -1,
        cityBlocked: false,
      });
  const follower: FollowerMotion = {
    motion: createMotion(world, { x: 100.5, y: 100.5 }),
    path: [],
    repath: 0,
    following: false,
    speed: 0,
  };
  return { world, follower };
}

describe('open-world following', () => {
  it('coasts to rest rather than cutting movement off at the resting radius', () => {
    const { world, follower } = setup();
    const destination = { x: 103.5, y: 100.5 };
    let enteredRest = false;
    let coastingFrames = 0;
    for (let i = 0; i < 240; i++) {
      const before = follower.motion.position.x;
      const previousSpeed = follower.speed;
      const wasFollowing = follower.following;
      stepFollower(world, follower, destination, 1 / 60);
      if (wasFollowing && !follower.following) enteredRest = true;
      if (enteredRest && follower.speed > 0) {
        expect(follower.motion.position.x).toBeGreaterThan(before);
        expect(follower.speed).toBeLessThan(previousSpeed);
        coastingFrames++;
      }
      expect(follower.motion.position.x).toBeLessThan(destination.x);
    }
    expect(coastingFrames).toBeGreaterThan(10);
    expect(follower.speed).toBe(0);
  });

  it('alternates quiet pauses and short strolls near its owner, then resumes following', () => {
    const { world, follower } = setup();
    const anchor = { ...follower.motion.position };
    let restingFrames = 0;
    let strollingFrames = 0;
    for (let i = 0; i < 60 * 25; i++) {
      stepFollower(world, follower, anchor, 1 / 60, { relaxed: true, phase: 0.7 });
      if (follower.idle?.wander) strollingFrames++;
      if (follower.speed === 0) restingFrames++;
      expect(
        Math.hypot(follower.motion.position.x - anchor.x, follower.motion.position.y - anchor.y),
      ).toBeLessThan(1.1);
      expect(traversable(world, follower.motion.position.x, follower.motion.position.y)).toBe(true);
    }
    expect(restingFrames).toBeGreaterThan(300);
    expect(strollingFrames).toBeGreaterThan(30);
    expect(follower.idle?.lookAt).not.toBeNull();
    stepFollower(world, follower, { x: anchor.x + 5, y: anchor.y }, 1 / 60, { relaxed: false });
    expect(follower.idle?.wander).toBeNull();
    expect(follower.idle?.lookAt).toBeNull();
    expect(follower.following).toBe(true);
  });

  it('keeps idle strolls out of water and blocked surroundings', () => {
    const { world, follower } = setup();
    const anchor = { ...follower.motion.position };
    for (let y = 99; y <= 101; y++)
      for (let x = 99; x <= 101; x++) if (x !== 100 || y !== 100) tileAt(world, x, y)!.water = true;
    for (let i = 0; i < 60 * 25; i++) {
      stepFollower(world, follower, anchor, 1 / 60, { relaxed: true });
      expect(follower.idle?.wander).toBeNull();
    }
    expect(follower.motion.position).toEqual(anchor);
  });

  it.each([30, 60, 144])(
    'follows a walking player without stop/start or zigzag at %s fps',
    (fps) => {
      const { world, follower } = setup();
      const destination = { x: 102.5, y: 102.5 };
      for (let i = 0; i < fps * 4; i++) {
        destination.x += 2 / fps;
        destination.y += 2 / fps;
        const before = { ...follower.motion.position };
        stepFollower(world, follower, destination, 1 / fps);
        const p = follower.motion.position;
        expect(p.x).toBeGreaterThan(before.x);
        expect(p.y).toBeGreaterThan(before.y);
        expect(p.x - before.x).toBeCloseTo(p.y - before.y, 8);
      }
      const p = follower.motion.position;
      expect(Math.hypot(p.x - destination.x, p.y - destination.y)).toBeLessThan(1.3);
      for (let i = 0; i < fps * 3; i++) stepFollower(world, follower, destination, 1 / fps);
      expect(follower.following).toBe(false);
      const stopped = { ...p };
      for (let i = 0; i < fps; i++) stepFollower(world, follower, destination, 1 / fps);
      expect(p).toEqual(stopped);
    },
  );

  it('routes around a blocked tile without crossing it', () => {
    const { world, follower } = setup();
    tileAt(world, 102, 100)!.cityBlocked = true;
    const destination = { x: 105.5, y: 100.5 };
    for (let i = 0; i < 600; i++) {
      stepFollower(world, follower, destination, 1 / 60);
      const p = follower.motion.position;
      expect(traversable(world, p.x, p.y)).toBe(true);
    }
    const p = follower.motion.position;
    expect(Math.hypot(p.x - destination.x, p.y - destination.y)).toBeLessThan(0.5);
  });
});
