import type { ArenaDefinition } from '@arena/shared-types';
import { sampleWorldBattleTerrain } from './world/combat';
import { WORLD_SIZE } from './world/world';
export type TerrainPoint = { x: number; depth: number; y?: number };
type Point = TerrainPoint;
/** Swept contact against obstacle volumes and the sampled heightfield. Omitted y means ground level. */
export function terrainContact(arena: ArenaDefinition, a: Point, b: Point, radius = 0): number {
  if (!arena.obstacles && !arena.surface) return 1;
  const border = arena.id === 'ruins' || arena.surface ? radius : 0;
  // Reject outside graph nodes as well as movement starting beyond the perimeter.
  if (
    a.x < arena.bounds[0] + border ||
    a.x > arena.bounds[1] - border ||
    a.depth < arena.depthBounds[0] + border ||
    a.depth > arena.depthBounds[1] - border
  )
    return 0;
  let first = 1;
  const dx = b.x - a.x,
    dz = b.depth - a.depth;
  for (const o of arena.obstacles ?? []) {
    let enter = 0,
      exit = 1;
    for (const [start, delta, lo, hi] of [
      [a.x, dx, o.x - o.width / 2 - radius, o.x + o.width / 2 + radius],
      [a.depth, dz, o.depth - o.length / 2 - radius, o.depth + o.length / 2 + radius],
      [a.y ?? 0, (b.y ?? a.y ?? 0) - (a.y ?? 0), -Infinity, o.height - 0.01],
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
    [a.x, dx, arena.bounds[0] + border, arena.bounds[1] - border],
    [a.depth, dz, arena.depthBounds[0] + border, arena.depthBounds[1] - border],
  ]) {
    if (delta > 0 && start + delta > hi) first = Math.min(first, Math.max(0, (hi - start) / delta));
    if (delta < 0 && start + delta < lo) first = Math.min(first, Math.max(0, (lo - start) / delta));
  }
  if (arena.surface) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 4));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (t > first || (t === first && first < 1)) break;
      const p = { x: a.x + dx * t, depth: a.depth + dz * t };
      const y = (a.y ?? 0) + ((b.y ?? a.y ?? 0) - (a.y ?? 0)) * t;
      if (!terrainWalkable(arena, p, radius) || terrainHeight(arena, p) > y + 0.05) {
        first = Math.max(0, (i - 1) / steps);
        break;
      }
    }
  }
  return first;
}
export function terrainMove(arena: ArenaDefinition, a: Point, b: Point, radius: number): Point {
  const t = terrainContact(arena, a, b, radius);
  if (t === 1) return b;
  const safe = Math.max(0, t - 0.01 / Math.max(0.01, Math.hypot(b.x - a.x, b.depth - a.depth)));
  const p = {
    x: a.x + (b.x - a.x) * safe,
    depth: a.depth + (b.depth - a.depth) * safe,
    y: b.y ?? a.y,
  };
  // Slide along the wall without crossing its corners.
  const x = { x: b.x, depth: p.depth, y: p.y };
  if (terrainContact(arena, p, x, radius) === 1) p.x = x.x;
  const z = { x: p.x, depth: b.depth, y: p.y };
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

export function surfaceCell(arena: ArenaDefinition, p: Point) {
  const s = arena.surface;
  if (!s) return null;
  const dx = p.x - s.origin.x,
    dz = p.depth - s.origin.depth;
  const det = s.axisX.x * s.axisZ.depth - s.axisZ.x * s.axisX.depth;
  const u = (dx * s.axisZ.depth - dz * s.axisZ.x) / det;
  const v = (dz * s.axisX.x - dx * s.axisX.depth) / det;
  const col = Math.floor(u),
    row = Math.floor(v);
  return {
    u,
    v,
    index: col < 0 || row < 0 || col >= s.columns || row >= s.rows ? -1 : row * s.columns + col,
  };
}

export function terrainHeight(arena: ArenaDefinition, p: Point, radius = 0): number {
  const world = sampleWorldBattleTerrain(arena, p.x, p.depth);
  if (world) return ((world.tile?.level ?? world.baseLevel) - world.baseLevel) * 32;
  const cell = surfaceCell(arena, p);
  let height = cell && cell.index >= 0 ? arena.surface!.heights[cell.index] : 0;
  for (const o of arena.obstacles ?? [])
    if (
      Math.abs(p.x - o.x) < o.width / 2 + radius &&
      Math.abs(p.depth - o.depth) < o.length / 2 + radius
    )
      height = Math.max(height, o.height);
  return height;
}

export function terrainWalkable(arena: ArenaDefinition, p: Point, radius = 0): boolean {
  if (
    p.x < arena.bounds[0] + radius ||
    p.x > arena.bounds[1] - radius ||
    p.depth < arena.depthBounds[0] + radius ||
    p.depth > arena.depthBounds[1] - radius
  )
    return false;
  const world = sampleWorldBattleTerrain(arena, p.x, p.depth);
  if (world) {
    const { point, tile } = world;
    if (
      !tile ||
      tile.lava ||
      point.x <= 1 ||
      point.y <= 1 ||
      point.x >= WORLD_SIZE - 2 ||
      point.y >= WORLD_SIZE - 2
    )
      return false;
    const solid = ['tree', 'pine', 'rock'].includes(tile.decoration ?? '');
    return (
      !solid ||
      Math.hypot(point.x - Math.floor(point.x) - 0.5, point.y - Math.floor(point.y) - 0.5) >=
        0.24 + radius / 160
    );
  }
  const cell = surfaceCell(arena, p);
  if (cell) {
    const s = arena.surface!;
    if (cell.index < 0 || s.blocked[cell.index]) return false;
    // A trunk/rock occupies the same 0.24-tile footprint as the explorer.
    if (
      s.props?.[cell.index] &&
      Math.hypot((cell.u % 1) - 0.5, (cell.v % 1) - 0.5) < 0.24 + radius / 160
    )
      return false;
  }
  return !(arena.obstacles ?? []).some(
    (o) =>
      o.climbable === false &&
      Math.abs(p.x - o.x) < o.width / 2 + radius &&
      Math.abs(p.depth - o.depth) < o.length / 2 + radius,
  );
}

export function terrainWater(arena: ArenaDefinition, p: Point): boolean {
  const world = sampleWorldBattleTerrain(arena, p.x, p.depth);
  if (world) return Boolean(world.tile?.water);
  const cell = surfaceCell(arena, p);
  return Boolean(cell && cell.index >= 0 && arena.surface!.water?.[cell.index]);
}

/** A route edge is legal only if every crossed ledge is reachable and its landing is clear. */
export function terrainReachable(arena: ArenaDefinition, a: Point, b: Point, radius = 0): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.depth - a.depth) / 8));
  let previous = terrainHeight(arena, a);
  for (let i = 1; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, depth: a.depth + ((b.depth - a.depth) * i) / n };
    if (!terrainWalkable(arena, p, radius)) return false;
    const h = terrainHeight(arena, p);
    if (Math.abs(h - previous) > (arena.surface?.climbHeight ?? 256)) return false;
    if (h > previous + (arena.surface?.stepHeight ?? 12) && terrainWater(arena, p)) return false;
    previous = h;
  }
  return true;
}

/** Bounded A* over the ground plane. Edge cost includes time spent jumping/climbing. */
export function terrainRoute(
  arena: ArenaDefinition,
  start: Point,
  end: Point,
  radius = 0,
): Point[] {
  if (terrainReachable(arena, start, end, radius)) return [end];
  const step = 32;
  const left = arena.bounds[0] + radius + 1,
    top = arena.depthBounds[0] + radius + 1;
  const cols = Math.ceil((arena.bounds[1] - radius - left) / step);
  const rows = Math.ceil((arena.depthBounds[1] - radius - top) / step);
  const point = (id: number) => ({
    x: left + (id % cols) * step,
    depth: top + Math.floor(id / cols) * step,
  });
  const key = (p: Point) =>
    Math.max(0, Math.min(rows - 1, Math.round((p.depth - top) / step))) * cols +
    Math.max(0, Math.min(cols - 1, Math.round((p.x - left) / step)));
  const origin = key(start),
    goal = key(end);
  const open = [origin],
    closed = new Set<number>();
  const cost = new Map([[origin, 0]]),
    parent = new Map<number, number>();
  const heuristic = (id: number) => Math.hypot(point(id).x - end.x, point(id).depth - end.depth);
  let closest = origin;
  for (let visited = 0; open.length && visited < 2400; visited++) {
    open.sort((a, b) => cost.get(b)! + heuristic(b) - cost.get(a)! - heuristic(a));
    const id = open.pop()!;
    if (closed.has(id)) continue;
    closed.add(id);
    const p = id === origin ? start : point(id);
    if (heuristic(id) < heuristic(closest)) closest = id;
    if ((id === goal || heuristic(id) < step * 1.5) && terrainReachable(arena, p, end, radius)) {
      const result = [end];
      let cursor = id;
      while (cursor !== origin) {
        result.unshift(point(cursor));
        cursor = parent.get(cursor)!;
      }
      return result;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const col = (id % cols) + dx,
        row = Math.floor(id / cols) + dz;
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      const next = row * cols + col,
        q = point(next);
      if (closed.has(next) || !terrainReachable(arena, p, q, radius)) continue;
      const value =
        cost.get(id)! +
        Math.hypot(q.x - p.x, q.depth - p.depth) +
        Math.abs(terrainHeight(arena, q) - terrainHeight(arena, p)) * 1.5;
      if (value < (cost.get(next) ?? Infinity)) {
        cost.set(next, value);
        parent.set(next, id);
        open.push(next);
      }
    }
  }
  const result: Point[] = [];
  while (closest !== origin) {
    result.unshift(point(closest));
    closest = parent.get(closest)!;
  }
  return result;
}
