import type { ArenaDefinition } from '@arena/shared-types';
type Point = { x: number; depth: number };
/** Earliest swept contact on the ground plane, including the perimeter. */
export function terrainContact(arena: ArenaDefinition, a: Point, b: Point, radius = 0): number {
  if (!arena.obstacles) return 1;
  // Reject outside graph nodes as well as movement starting beyond the perimeter.
  if (
    a.x < arena.bounds[0] + radius ||
    a.x > arena.bounds[1] - radius ||
    a.depth < arena.depthBounds[0] + radius ||
    a.depth > arena.depthBounds[1] - radius
  )
    return 0;
  let first = 1;
  const dx = b.x - a.x,
    dz = b.depth - a.depth;
  for (const o of arena.obstacles) {
    let enter = 0,
      exit = 1;
    for (const [start, delta, lo, hi] of [
      [a.x, dx, o.x - o.width / 2 - radius, o.x + o.width / 2 + radius],
      [a.depth, dz, o.depth - o.length / 2 - radius, o.depth + o.length / 2 + radius],
    ]) {
      if (delta === 0) {
        if (start <= lo || start >= hi) {
          exit = -1;
          break;
        }
      } else {
        const t1 = (lo - start) / delta,
          t2 = (hi - start) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        exit = Math.min(exit, Math.max(t1, t2));
      }
    }
    if (enter <= exit && exit > 0 && enter < 1) first = Math.min(first, enter);
  }
  for (const [start, delta, lo, hi] of [
    [a.x, dx, arena.bounds[0] + radius, arena.bounds[1] - radius],
    [a.depth, dz, arena.depthBounds[0] + radius, arena.depthBounds[1] - radius],
  ]) {
    if (delta > 0 && start + delta > hi) first = Math.min(first, Math.max(0, (hi - start) / delta));
    if (delta < 0 && start + delta < lo) first = Math.min(first, Math.max(0, (lo - start) / delta));
  }
  return first;
}
export function terrainMove(arena: ArenaDefinition, a: Point, b: Point, radius: number): Point {
  const t = terrainContact(arena, a, b, radius);
  if (t === 1) return b;
  const safe = Math.max(0, t - 0.01 / Math.max(0.01, Math.hypot(b.x - a.x, b.depth - a.depth)));
  const p = { x: a.x + (b.x - a.x) * safe, depth: a.depth + (b.depth - a.depth) * safe };
  // Slide along the wall without crossing its corners.
  const x = { x: b.x, depth: p.depth };
  if (terrainContact(arena, p, x, radius) === 1) p.x = x.x;
  const z = { x: p.x, depth: b.depth };
  if (terrainContact(arena, p, z, radius) === 1) p.depth = z.depth;
  return p;
}
/** Visibility graph around expanded obstacle corners; deterministic shortest route. */
export function terrainWaypoint(
  arena: ArenaDefinition,
  start: Point,
  end: Point,
  radius: number,
): Point {
  if (terrainContact(arena, start, end, radius) === 1) return end;
  const nodes = [start, end];
  for (const o of arena.obstacles ?? [])
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const p = {
          x: o.x + sx * (o.width / 2 + radius + 4),
          depth: o.depth + sz * (o.length / 2 + radius + 4),
        };
        if (terrainContact(arena, p, p, radius) === 1) nodes.push(p);
      }
  const distances = nodes.map(() => Infinity),
    previous = nodes.map(() => -1),
    visited = new Set<number>();
  distances[0] = 0;
  while (visited.size < nodes.length) {
    let u = -1;
    nodes.forEach((_, i) => {
      if (!visited.has(i) && (u < 0 || distances[i] < distances[u])) u = i;
    });
    if (u < 0 || !Number.isFinite(distances[u])) break;
    if (u === 1) {
      let v = 1;
      while (previous[v] > 0) v = previous[v];
      return nodes[v];
    }
    visited.add(u);
    nodes.forEach((v, i) => {
      if (visited.has(i) || terrainContact(arena, nodes[u], v, radius) < 1) return;
      const d = distances[u] + Math.hypot(v.x - nodes[u].x, v.depth - nodes[u].depth);
      if (d < distances[i]) {
        distances[i] = d;
        previous[i] = u;
      }
    });
  }
  return start;
}
