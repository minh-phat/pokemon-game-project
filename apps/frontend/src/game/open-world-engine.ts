import { createCityGround, CITY_GROUND } from './binh-minh-ground';
import { addCityObjects, paintCityTile, cityColors } from './binh-minh-renderer';
import { geographyColor } from './open-world-geography';
import { automaticCameraFrame } from './arena-camera';
import type { WorldArenaLayer } from './world-arena-layer';
import { ASSETS, POKEMON, fighterDefinition } from '@arena/game-data';
import {
  WORLD_COMBAT_HEIGHT_SCALE,
  worldCombatOffset,
  worldArenaPlacement,
} from './world-combat-visuals';
import {
  speciesIds,
  type OwnedPet,
  type SpeciesId,
  type WorldEncounterTicket,
  type WorldBattleAction,
  type ManualBattleCommand,
} from '@arena/shared-types';
import { createWorldEncounter, applyWorldAction, type BattleEngine } from '@arena/game-core';
import { createMotion, stepMotion, type Motion, type MotionAction } from './open-world-motion';
import {
  insideCity,
  BIOMES,
  WORLD_SIZE,
  METERS_PER_TILE,
  MAX_TERRAIN_LEVEL,
  METERS_PER_LEVEL,
  syncWildlife,
  SAVE_KEY,
  biomeColors,
  createWorld,
  findPath,
  hash,
  tileAt,
  traversable,
  updateWildlife,
  type Biome,
  type Point,
  type Species,
  type Tile,
  type WildPokemon,
  type World,
  type WorldSave,
  type Landmark,
} from './open-world-world';

const HALF_W = 16,
  HALF_H = 8,
  LIFT = 8,
  CHUNK = 256,
  CACHE_LIMIT = 48;
const speciesList: Species[] = ['pikachu', 'bulbasaur', 'squirtle', 'charmander', 'eevee'];
export type WorldStatus = {
  city: boolean;
  biome: Biome;
  x: number;
  y: number;
  seen: Species[];
  visited: Biome[];
  nearby: { id: number; species: Species; level: number; quality: string; count: number } | null;
  companion: OwnedPet | null;
  companions: OwnedPet[];
  selectedTargets: WildPokemon[];
  target: WildPokemon | null;
  combatVisualError: string;
  combatVisualReady: boolean;
  combat: import('@arena/shared-types').BattleSnapshot | null;
  approaching: boolean;
  fps: number;
  active: number;
  chunks: number;
  saving: boolean;
  water: boolean;
  terrainChunks: number;
  landmarks: Landmark[];
  artReady: boolean;
  elevation: number;
  action: MotionAction;
  landform: Tile['landform'];
};
export type WorldInput = {
  x: number;
  y: number;
  sprint: boolean;
  paused: boolean;
  reducedMotion: boolean;
  mapOverview: boolean;
  climb: boolean;
};
function project(x: number, y: number, level = 0): Point {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H - level * LIFT };
}
function unproject(x: number, y: number): Point {
  return { x: (x / HALF_W + y / HALF_H) / 2, y: (y / HALF_H - x / HALF_W) / 2 };
}
function canvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}
function polygon(c: CanvasRenderingContext2D, color: string, points: number[]) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
  c.fill();
}
function shade(hex: string, offset: number) {
  const v = parseInt(hex.slice(1), 16);
  return `rgb(${Math.min(255, Math.max(0, (v >> 16) + offset))},${Math.min(255, Math.max(0, ((v >> 8) & 255) + offset))},${Math.min(255, Math.max(0, (v & 255) + offset))})`;
}

/** Display-resolution canvas, cached ground, bounded simulation and no per-frame React. */
export class OpenWorldEngine {
  readonly world: World;
  readonly input: WorldInput = {
    x: 0,
    y: 0,
    sprint: false,
    paused: false,
    reducedMotion: false,
    mapOverview: false,
    climb: false,
  };
  player: Point;
  private motion: Motion;
  private jumpRequested = false;
  private context: CanvasRenderingContext2D;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private chunks = new Map<string, HTMLCanvasElement>();
  private decorations = new Map<string, HTMLCanvasElement>();
  private sprites = new Map<SpeciesId, HTMLCanvasElement>();
  companions: OwnedPet[] = [];
  get companion() {
    return this.companions[0] ?? null;
  }
  private followers = new Map<string, { motion: Motion; path: Point[]; repath: number }>();
  selectedTargets: WildPokemon[] = [];
  private drag: { id: number; start: Point; end: Point } | null = null;
  rewardPending = false;
  private companionMotion: Motion | null = null;
  private target: WildPokemon | null = null;
  private encounter: BattleEngine | null = null;
  private arenaLayer: WorldArenaLayer | null = null;
  private arenaError = '';
  private combatLevel = 0;
  private ticket: WorldEncounterTicket | null = null;
  private actions: WorldBattleAction[] = [];
  private combatAccumulator = 0;
  private starting = false;
  private finishedReported = false;
  private removed = new Set<number>();
  onEngage?: (wild: WildPokemon) => void;
  onNeedPet?: () => void;
  onBattleFinished?: (
    ticket: WorldEncounterTicket,
    actions: WorldBattleAction[],
    ticks: number,
    capturable: boolean,
  ) => void;
  hideCaptured(ids: number[]) {
    for (const id of ids) this.removed.add(id);
  }
  summon(pet: OwnedPet | null) {
    if (this.target || this.rewardPending) return;
    if (!pet) this.companions = [];
    else if (this.companions.some((p) => p.id === pet.id))
      this.companions = this.companions.filter((p) => p.id !== pet.id);
    else this.companions = [...this.companions, pet];
    this.resetFollowers();
    this.report();
  }
  private resetFollowers() {
    this.followers.clear();
    this.companions.forEach((pet) =>
      this.followers.set(pet.id, {
        motion: createMotion(this.world, this.player),
        path: [],
        repath: 0,
      }),
    );
    this.companionMotion = this.companion ? this.followers.get(this.companion.id)!.motion : null;
  }
  updatePets(pets: OwnedPet[]) {
    this.companions = this.companions.map((p) => pets.find((next) => next.id === p.id) ?? p);
  }
  selectWild(id: number) {
    if (this.input.paused || this.target || this.rewardPending) return;
    const wild = this.world.wildlife.find((a) => a.id === id && !this.removed.has(a.id));
    if (!wild) return;
    this.selectedTargets = this.selectedTargets.some((a) => a.id === id)
      ? this.selectedTargets.filter((a) => a.id !== id)
      : [...this.selectedTargets, wild];
    this.report();
  }
  clearTargets() {
    this.selectedTargets = [];
    this.report();
  }
  engageSelected() {
    if (this.input.paused || this.target || this.rewardPending || !this.selectedTargets.length)
      return;
    if (!this.companion) {
      this.onNeedPet?.();
      return;
    }
    this.target = this.selectedTargets[0];
    this.clearInput();
    this.report();
  }
  beginEncounter(ticket: WorldEncounterTicket) {
    if (!this.target || this.disposed) return;
    this.target.x = ticket.wild.x;
    this.target.y = ticket.wild.y;
    this.ticket = ticket;
    this.encounter = createWorldEncounter(ticket);
    this.actions = [];
    this.combatAccumulator = 0;
    this.finishedReported = false;
    this.combatLevel = tileAt(this.world, this.target.x, this.target.y)?.level ?? 0;
    this.arenaError = '';
    void import('./world-arena-layer')
      .then(({ WorldArenaLayer }) => {
        if (this.disposed || this.ticket !== ticket) return;
        this.arenaLayer = new WorldArenaLayer(this.encounter!.state.rules.arena, () => ({
          snapshot: this.encounter?.state ?? null,
          paused: this.input.paused || document.hidden || this.encounter?.state.phase !== 'battle',
          reducedMotion: this.input.reducedMotion,
          viewport:
            this.encounter?.state.arenaDefinition?.worldTerrain && this.target
              ? this.combatViewport()
              : undefined,
        }));
      })
      .catch(() => {
        if (this.ticket === ticket)
          this.arenaError = 'Không tải được hiệu ứng chiến đấu. Hãy rút lui và thử lại.';
      });
    this.report();
  }
  battleAction(
    action:
      | { type: 'control'; fighterId: string }
      | { type: 'mode'; manual: boolean }
      | { type: 'command'; command: ManualBattleCommand },
  ) {
    if (
      !this.encounter ||
      this.encounter.state.phase !== 'battle' ||
      this.input.paused ||
      this.actions.length >= 3600
    )
      return;
    const entry = { ...action, tick: this.encounter.state.tick } as WorldBattleAction;
    this.actions.push(entry);
    applyWorldAction(this.encounter, entry);
    this.report();
  }
  endEncounter(remove = false, pet?: OwnedPet) {
    this.arenaLayer?.destroy();
    this.arenaLayer = null;
    this.arenaError = '';
    if (remove && this.target) for (const wild of this.selectedTargets) this.removed.add(wild.id);
    if (pet) this.updatePets([pet]);
    this.selectedTargets = [];
    this.target = null;
    this.encounter = null;
    this.resize();
    this.clearInput();
    this.ticket = null;
    this.starting = false;
    this.resetFollowers();
    this.report();
  }
  private combatPoint(x: number, depth: number): Point {
    // Keep the arena's screen-space axes and scale so sprites, hitboxes and VFX stay aligned.
    const origin = project(this.target!.x, this.target!.y);
    const offset = worldCombatOffset(x, depth);
    return unproject(origin.x + offset.x, origin.y + offset.y);
  }
  private combatViewport() {
    const origin = project(this.target!.x, this.target!.y, this.combatLevel);
    return {
      x: (this.camera.x - origin.x) / WORLD_COMBAT_HEIGHT_SCALE + 650,
      y: (this.camera.y - origin.y) / WORLD_COMBAT_HEIGHT_SCALE + 420,
      width: this.viewportWidth / WORLD_COMBAT_HEIGHT_SCALE,
      height: this.viewportHeight / WORLD_COMBAT_HEIGHT_SCALE,
    };
  }
  private updateCompanion(dt: number) {
    if (!this.companionMotion || !this.companion) return;
    if (this.encounter) {
      if (!this.arenaLayer?.ready) return;
      this.combatAccumulator += dt;
      while (this.combatAccumulator >= 1 / 60 && this.encounter.state.phase === 'battle') {
        this.encounter.updateBattle(1 / 60);
        this.combatAccumulator -= 1 / 60;
      }
      if (this.encounter.state.phase === 'finished' && !this.finishedReported) {
        this.finishedReported = true;
        const wild = this.encounter.state.fighters.find(
          (f) => f.team === 1 && f.hp > 0 && f.hp < fighterDefinition(f).hp * 0.1,
        );
        this.onBattleFinished?.(
          this.ticket!,
          this.actions,
          this.encounter.state.tick,
          this.encounter.state.result?.winner === 0 && Boolean(wild),
        );
      }
      return;
    }
    let index = 0;
    for (const follower of this.followers.values()) {
      const angle = index++ * 2.4;
      const destination = this.target ?? {
        x: this.player.x + Math.cos(angle) * 2,
        y: this.player.y + Math.sin(angle) * 2,
      };
      const position = follower.motion.position;
      const distance = Math.hypot(destination.x - position.x, destination.y - position.y);
      if (this.target && distance <= 2.5 && !this.starting) {
        this.starting = true;
        this.onEngage?.(this.target);
      }
      if (this.starting) return;
      follower.repath -= dt;
      if (follower.repath <= 0) {
        follower.path = distance > 1.3 ? findPath(this.world, position, destination) : [];
        follower.repath = 0.5;
      }
      while (
        follower.path.length &&
        Math.hypot(follower.path[0].x - position.x, follower.path[0].y - position.y) < 0.4
      )
        follower.path.shift();
      const waypoint = follower.path[0] ?? destination;
      stepMotion(
        this.world,
        follower.motion,
        {
          x: distance > 1.3 ? waypoint.x - position.x : 0,
          y: distance > 1.3 ? waypoint.y - position.y : 0,
          sprint: true,
          climb: true,
          jump: follower.motion.action === 'blocked',
        },
        dt,
      );
    }
  }

  private cityGround: HTMLCanvasElement | null = null;
  private cityAtlas: HTMLImageElement | null = null;
  private propAtlas: HTMLImageElement | null = null;
  private terrainAtlas: HTMLImageElement | null = null;
  private cliffAtlas: HTMLImageElement | null = null;
  private cliffArt = new Map<string, HTMLCanvasElement>();
  private terrainArt = new Map<string, HTMLCanvasElement>();
  private keys = new Set<string>();
  private seen = new Set<Species>();
  private visited = new Set<Biome>();
  private path: Point[] = [];
  private camera: Point;
  private time = 0;
  private last = 0;
  private uiElapsed = 0;
  private wildlifeElapsed = 0;
  private saveElapsed = 0;
  private frames = 0;
  private frameTime = 0;
  private fps = 60;
  private renderMs = 0;
  private active = 0;
  private facing = 1;
  private moving = false;
  private frame = 0;
  private disposed = false;
  private saveOK = true;
  private observer: ResizeObserver;
  private minimap: HTMLCanvasElement;
  private nearby: WorldStatus['nearby'] = null;
  private pokemonLabels: { x: number; y: number; text: string; color: string }[] = [];
  private lastMini = '';
  private onStatus: (status: WorldStatus) => void;
  constructor(
    private surface: HTMLCanvasElement,
    private map: HTMLCanvasElement,
    seed: number,
    saved: WorldSave | null,
    onStatus: (status: WorldStatus) => void,
  ) {
    const ctx = surface.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    this.context = ctx;
    this.world = createWorld(seed);
    this.onStatus = onStatus;
    this.player =
      saved && traversable(this.world, saved.player.x, saved.player.y)
        ? { ...saved.player }
        : { ...this.world.spawn };
    this.motion = createMotion(this.world, this.player);
    this.player = this.motion.position;
    saved?.seen.forEach((s) => this.seen.add(s));
    saved?.visited.forEach((b) => this.visited.add(b));
    this.camera = project(this.player.x, this.player.y, this.motion.z);
    this.minimap = this.makeMinimap();
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(surface);
    this.resize();
    this.loadSprites();
    this.loadEnvironment();
    syncWildlife(this.world, this.player);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.clearInput);
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('pagehide', this.save);
    surface.addEventListener('pointerdown', this.pointerDown);
    surface.addEventListener('pointermove', this.pointerMove);
    surface.addEventListener('pointerup', this.pointerUp);
    surface.addEventListener('pointercancel', this.cancelDrag);
    surface.addEventListener('lostpointercapture', this.cancelDrag);
    this.frame = requestAnimationFrame(this.tick);
  }
  private resize = () => {
    const r = this.surface.getBoundingClientRect();
    // Keep the same world zoom, but rasterize sprites at display resolution.
    // Limit Retina density to 2x to bound the full-screen framebuffer cost.
    const zoom =
      r.width < 600 ? Math.max(1.1, r.width / 340) : Math.max(1.65, r.width / 960, r.height / 680);
    const density = Math.min(2, window.devicePixelRatio || 1);
    this.viewportWidth = Math.max(1, r.width / zoom);
    this.viewportHeight = Math.max(1, r.height / zoom);
    this.surface.width = Math.max(1, Math.round(r.width * density));
    this.surface.height = Math.max(1, Math.round(r.height * density));
    this.context.setTransform(
      this.surface.width / this.viewportWidth,
      0,
      0,
      this.surface.height / this.viewportHeight,
      0,
      0,
    );
    this.context.imageSmoothingEnabled = false;
  };
  private keyDown = (e: KeyboardEvent) => {
    if (this.input.paused || this.target) return;
    if (
      e.target instanceof HTMLElement &&
      e.target.closest('input, select, textarea, [role="dialog"]')
    )
      return;
    if (e.code === 'Space' && !(e.target instanceof HTMLElement && e.target.closest('button'))) {
      e.preventDefault();
      if (!e.repeat) this.requestJump();
      return;
    }
    if (
      [
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
        'w',
        'a',
        's',
        'd',
        'shift',
        'e',
      ].includes(e.key.toLowerCase())
    ) {
      e.preventDefault();
      this.keys.add(e.key.toLowerCase());
      this.path = [];
    }
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private clearInput = () => {
    this.cancelDrag();
    this.keys.clear();
    this.input.x = 0;
    this.input.y = 0;
    this.input.sprint = false;
    this.input.climb = false;
    this.jumpRequested = false;
    this.path = [];
  };
  private visibility = () => {
    this.clearInput();
    this.save();
    if (document.hidden) {
      cancelAnimationFrame(this.frame);
      this.last = 0;
    } else if (!this.disposed) this.frame = requestAnimationFrame(this.tick);
  };
  private pointerPoint(event: PointerEvent): Point {
    const r = this.surface.getBoundingClientRect();
    return {
      x: ((event.clientX - r.left) * this.viewportWidth) / r.width,
      y: ((event.clientY - r.top) * this.viewportHeight) / r.height,
    };
  }
  private cancelDrag = () => {
    this.drag = null;
  };
  private pointerDown = (event: PointerEvent) => {
    if (this.input.paused || this.target || event.button !== 0 || this.rewardPending) return;
    this.surface.setPointerCapture(event.pointerId);
    const point = this.pointerPoint(event);
    this.drag = { id: event.pointerId, start: point, end: point };
  };
  private pointerMove = (event: PointerEvent) => {
    if (this.drag?.id === event.pointerId) this.drag.end = this.pointerPoint(event);
  };
  private pointerUp = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) return;
    drag.end = this.pointerPoint(event);
    this.drag = null;
    if (this.surface.hasPointerCapture(event.pointerId))
      this.surface.releasePointerCapture(event.pointerId);
    if (this.input.paused || this.target || this.rewardPending) return;
    if (Math.hypot(drag.end.x - drag.start.x, drag.end.y - drag.start.y) < 4) {
      this.tap(event);
      return;
    }
    const selected = this.world.wildlife.filter((actor) => {
      if (this.removed.has(actor.id)) return false;
      const p = project(actor.x, actor.y, tileAt(this.world, actor.x, actor.y)?.level ?? 0);
      const x = p.x - this.camera.x + this.viewportWidth / 2;
      const y = p.y - 13 - this.camera.y + this.viewportHeight / 2;
      return (
        x >= Math.min(drag.start.x, drag.end.x) &&
        x <= Math.max(drag.start.x, drag.end.x) &&
        y >= Math.min(drag.start.y, drag.end.y) &&
        y <= Math.max(drag.start.y, drag.end.y)
      );
    });
    this.selectedTargets = event.shiftKey
      ? [...new Map([...this.selectedTargets, ...selected].map((a) => [a.id, a])).values()]
      : selected;
    this.report();
  };
  private tap = (event: PointerEvent) => {
    if (this.input.paused || event.button !== 0) return;
    const r = this.surface.getBoundingClientRect();
    const sx =
      ((event.clientX - r.left) * this.viewportWidth) / r.width +
      this.camera.x -
      this.viewportWidth / 2;
    const sy =
      ((event.clientY - r.top) * this.viewportHeight) / r.height +
      this.camera.y -
      this.viewportHeight / 2;
    const hit = this.world.wildlife
      .filter((a) => !this.removed.has(a.id))
      .map((actor) => {
        const p = project(actor.x, actor.y, tileAt(this.world, actor.x, actor.y)?.level ?? 0);
        return { actor, distance: Math.hypot(sx - p.x, sy - (p.y - 13)) };
      })
      .filter((a) => a.distance < 18)
      .sort((a, b) => a.distance - b.distance)[0];
    if (hit) {
      this.selectWild(hit.actor.id);
      return;
    }
    if (this.target) return;
    let target = unproject(sx, sy);
    for (let i = 0; i < 5; i++)
      target = unproject(sx, sy + (tileAt(this.world, target.x, target.y)?.level ?? 0) * LIFT);
    this.path = findPath(this.world, this.player, target);
    this.surface.focus({ preventScroll: true });
  };
  private loadSprites() {
    for (const species of speciesIds) {
      const img = new Image();
      img.onload = () => {
        if (this.disposed) return;
        // Rasterize only the idle/walk rows once at their original frame resolution.
        const sheet = canvas(960, 320),
          ctx = sheet.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, 960, 320, 0, 0, 960, 320);
        this.sprites.set(species, sheet);
      };
      img.src = ASSETS.sprites[species];
    }
  }
  private loadEnvironment() {
    const city = new Image();
    city.onload = () => {
      if (!this.disposed) this.cityAtlas = city;
    };
    city.src = '/assets/binh-minh/buildings-v2.png';
    const props = new Image(),
      terrain = new Image(),
      cliffs = new Image();
    props.onload = () => {
      if (this.disposed) return;
      this.propAtlas = props;
      this.decorations.clear();
    };
    terrain.onload = () => {
      if (this.disposed) return;
      this.terrainAtlas = terrain;
      this.chunks.clear();
      this.terrainArt.clear();
    };
    cliffs.onload = () => {
      if (this.disposed) return;
      this.cliffAtlas = cliffs;
      this.cliffArt.clear();
      this.chunks.clear();
    };
    cliffs.src = '/assets/world-v3/cliffs.png';
    props.src = '/assets/world-v2/props.png';
    terrain.src = '/assets/world-v2/terrain.png';
  }
  private groundArt(t: Tile) {
    const material = t.lava
      ? 7
      : t.biome === 'ocean'
        ? t.height < 0.12
          ? 10
          : 8
        : t.biome === 'river'
          ? 9
          : t.biome === 'snow'
            ? 5
            : t.biome === 'volcano'
              ? 6
              : t.biome === 'mountain'
                ? 4
                : t.biome === 'beach'
                  ? 11
                  : t.biome === 'forest'
                    ? t.moisture > 0.67
                      ? 2
                      : 1
                    : 0;
    const variant = Math.floor(t.variant * 8),
      key = `${material}:${variant}`;
    const cached = this.terrainArt.get(key);
    if (cached) return cached;
    const art = canvas(32, 16),
      ctx = art.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(0.5, 0.25, -0.5, 0.25, 16, 0);
    const sx = (material % 4) * 128 + (variant % 4) * 24,
      sy = Math.floor(material / 4) * 128 + Math.floor(variant / 4) * 48;
    ctx.drawImage(this.terrainAtlas!, sx, sy, 48, 48, 0, 0, 32, 32);
    this.terrainArt.set(key, art);
    return art;
  }
  private makeMinimap() {
    const result = canvas(256, 256),
      ctx = result.getContext('2d')!;
    for (const t of this.world.geography.tiles) {
      ctx.fillStyle = geographyColor(this.world.geography, t);
      ctx.fillRect(t.x, t.y, 1, 1);
    }
    return result;
  }
  private paintMinimap() {
    const overview = this.input.mapOverview;
    const key = `${overview}:${Math.floor(this.player.x / 4)},${Math.floor(this.player.y / 4)}`;
    if (key === this.lastMini) return;
    this.lastMini = key;
    const ctx = this.map.getContext('2d')!,
      size = this.map.width;
    ctx.imageSmoothingEnabled = false;
    if (overview) {
      ctx.drawImage(this.minimap, 0, 0, size, size);
      const scale = size / WORLD_SIZE;
      for (const l of this.world.landmarks) {
        ctx.fillStyle = '#f3e0b7';
        ctx.fillRect(l.x * scale - 1, l.y * scale - 1, 3, 3);
      }
      ctx.strokeStyle = '#fff8';
      ctx.strokeRect(
        (this.player.x - 80) * scale,
        (this.player.y - 80) * scale,
        160 * scale,
        160 * scale,
      );
      ctx.fillStyle = '#122e36';
      ctx.fillRect(this.player.x * scale - 3, this.player.y * scale - 3, 7, 7);
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.player.x * scale - 1, this.player.y * scale - 1, 3, 3);
    } else {
      for (let iy = 0; iy < 48; iy++)
        for (let ix = 0; ix < 48; ix++) {
          const tile = tileAt(this.world, this.player.x - 48 + ix * 2, this.player.y - 48 + iy * 2);
          ctx.fillStyle = tile ? (tile.lava ? '#ff914e' : biomeColors[tile.biome]) : '#286b8b';
          if (tile && !tile.water && !tile.lava) {
            const west = tileAt(this.world, tile.x - 2, tile.y)?.level ?? tile.level;
            const east = tileAt(this.world, tile.x + 2, tile.y)?.level ?? tile.level;
            ctx.fillStyle = shade(
              biomeColors[tile.biome],
              Math.max(-38, Math.min(24, (west - east) * 7)),
            );
          }
          if (tile?.citySurface)
            ctx.fillStyle = tile.cityBlocked ? '#68e2ef' : cityColors[tile.citySurface];
          ctx.fillRect((ix * size) / 48, (iy * size) / 48, size / 48 + 1, size / 48 + 1);
        }
      const cx = ((this.world.spawn.x - this.player.x + 48) / 96) * size,
        cy = ((this.world.spawn.y - this.player.y + 48) / 96) * size;
      ctx.fillStyle = '#ffe5ab';
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
      ctx.fillStyle = '#173d39';
      ctx.fillRect(size / 2 - 3, size / 2 - 3, 7, 7);
      ctx.fillStyle = '#fff';
      ctx.fillRect(size / 2 - 1, size / 2 - 1, 3, 3);
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(8, size - 12);
      ctx.lineTo(8 + (50 / (96 * METERS_PER_TILE)) * size, size - 12);
      ctx.stroke();
      ctx.font = '8px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('50 m', 8, size - 16);
    }
  }
  private tileBounds(left: number, top: number, width: number, height: number) {
    const corners = [
      unproject(left - 40, top - 24),
      unproject(left + width + 40, top - 24),
      unproject(left - 40, top + height + MAX_TERRAIN_LEVEL * LIFT + 120),
      unproject(left + width + 40, top + height + MAX_TERRAIN_LEVEL * LIFT + 120),
    ];
    return {
      x0: Math.max(0, Math.floor(Math.min(...corners.map((p) => p.x)))),
      x1: Math.min(WORLD_SIZE - 1, Math.ceil(Math.max(...corners.map((p) => p.x)))),
      y0: Math.max(0, Math.floor(Math.min(...corners.map((p) => p.y)))),
      y1: Math.min(WORLD_SIZE - 1, Math.ceil(Math.max(...corners.map((p) => p.y)))),
    };
  }
  private cliffFace(t: Tile, drop: number, right: boolean) {
    const material =
      t.biome === 'snow' ? 2 : t.biome === 'volcano' ? 3 : t.biome === 'mountain' ? 1 : 0;
    const variant = Math.floor(t.variant * 4);
    const key = `${material}:${drop}:${right}:${variant}`;
    const existing = this.cliffArt.get(key);
    if (existing) return existing;
    const art = canvas(16, drop + 9),
      ctx = art.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, right ? -0.5 : 0.5, 0, 1, 0, right ? 8 : 0);
    if (this.cliffAtlas) {
      ctx.drawImage(
        this.cliffAtlas,
        (material % 2) * 256 + variant * 48,
        Math.floor(material / 2) * 256 + 24,
        48,
        Math.min(208, Math.max(32, drop * 2)),
        0,
        0,
        16,
        drop,
      );
    } else {
      ctx.fillStyle = '#85705b';
      ctx.fillRect(0, 0, 16, drop);
    }
    ctx.fillStyle = right ? '#092a3230' : '#061c324f';
    ctx.fillRect(0, 0, 16, drop);
    ctx.fillStyle = '#081a2938';
    ctx.fillRect(0, Math.max(0, drop - 3), 16, 3);
    this.cliffArt.set(key, art);
    if (this.cliffArt.size > 192) this.cliffArt.delete(this.cliffArt.keys().next().value!);
    return art;
  }
  private paintTile(ctx: CanvasRenderingContext2D, t: Tile) {
    const p = project(t.x, t.y, t.level),
      x = p.x,
      y = p.y;
    const variation = Math.floor(t.variant * 4) * 3;
    const base = t.lava ? '#ed7946' : biomeColors[t.biome];
    const right = tileAt(this.world, t.x + 1, t.y),
      left = tileAt(this.world, t.x, t.y + 1);
    const rd = Math.max(0, (t.level - (right?.level ?? 0)) * LIFT);
    const ld = Math.max(0, (t.level - (left?.level ?? 0)) * LIFT);
    if (ld) ctx.drawImage(this.cliffFace(t, ld, false), x - 16, y + 8);
    if (rd) ctx.drawImage(this.cliffFace(t, rd, true), x, y + 8);
    if (t.citySurface) {
      paintCityTile(ctx, t, x, y);
      return;
    }
    polygon(ctx, shade(base, variation), [x, y, x + 16, y + 8, x, y + 16, x - 16, y + 8]);
    if (t.biome === 'ocean') {
      if (t.height < 0.07) polygon(ctx, '#286b8b', [x, y, x + 16, y + 8, x, y + 16, x - 16, y + 8]);
    } else if (t.biome === 'river') {
      ctx.fillStyle = '#a7dcd3';
      ctx.fillRect(x - 3, y + 7, 4, 1);
      if (rd >= 4 || ld >= 4) {
        ctx.fillStyle = '#b9e2d5';
        ctx.fillRect(x, y + 13, 2, Math.max(rd, ld) + 2);
      }
    } else {
      // Tiny ground details are baked into the terrain, never animated individually.
      for (let i = 0; i < 4; i++) {
        const a = hash(t.x * 4 + i, t.y, this.world.seed),
          b = hash(t.x, t.y * 4 + i, this.world.seed + 3);
        const px = x + Math.floor((a - b) * 13),
          py = y + Math.floor((a + b) * 6) + 2;
        ctx.fillStyle = shade(base, i % 2 ? 16 : -13);
        ctx.fillRect(px, py, 2 + (i % 2), 1);
      }
      if (rd || ld) {
        ctx.fillStyle = shade(base, 24);
        ctx.fillRect(x - 3, y + 13, 4, 1);
      }
    }
    if (this.terrainAtlas) {
      ctx.globalAlpha = t.water ? 0.62 : 0.72;
      ctx.drawImage(this.groundArt(t), x - 16, y);
      ctx.globalAlpha = 1;
    }
    if (!t.water && (rd >= 16 || ld >= 16)) {
      ctx.strokeStyle =
        t.biome === 'snow'
          ? '#f5ffff'
          : t.biome === 'meadow' || t.biome === 'forest'
            ? '#bfcb76'
            : '#bbb6a1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ld >= 16) {
        ctx.moveTo(x - 16, y + 8);
        ctx.lineTo(x, y + 16);
      }
      if (rd >= 16) {
        ctx.moveTo(x, y + 16);
        ctx.lineTo(x + 16, y + 8);
      }
      ctx.stroke();
    }
    if (t.biome === 'beach') {
      // Foam follows the coastline, rather than appearing on arbitrary land tiles.
      ctx.strokeStyle = '#f5edcb';
      ctx.lineWidth = 2;
      for (const [dx, dy, points] of [
        [1, 0, [x + 15, y + 8, x, y + 15]],
        [0, 1, [x - 15, y + 8, x, y + 15]],
        [-1, 0, [x - 15, y + 8, x, y + 1]],
        [0, -1, [x + 15, y + 8, x, y + 1]],
      ] as const) {
        if (tileAt(this.world, t.x + dx, t.y + dy)?.biome !== 'ocean') continue;
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        ctx.lineTo(points[2], points[3]);
        ctx.stroke();
      }
    }
  }
  private getChunk(cx: number, cy: number) {
    const key = `${cx},${cy}`,
      cached = this.chunks.get(key);
    if (cached) {
      this.chunks.delete(key);
      this.chunks.set(key, cached);
      return cached;
    }
    const result = canvas(CHUNK, CHUNK),
      ctx = result.getContext('2d')!;
    ctx.fillStyle = '#286b8b';
    ctx.fillRect(0, 0, CHUNK, CHUNK);
    ctx.translate(-cx * CHUNK, -cy * CHUNK);
    const b = this.tileBounds(cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
    for (let sum = b.x0 + b.y0; sum <= b.x1 + b.y1; sum++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const y = sum - x;
        if (y < b.y0 || y > b.y1) continue;
        const t = tileAt(this.world, x, y)!,
          p = project(x, y, t.level);
        if (
          p.x < cx * CHUNK - 18 ||
          p.x > (cx + 1) * CHUNK + 18 ||
          p.y < cy * CHUNK - MAX_TERRAIN_LEVEL * LIFT - 16 ||
          p.y > (cy + 1) * CHUNK
        )
          continue;
        this.paintTile(ctx, t);
      }
    }
    this.chunks.set(key, result);
    if (this.chunks.size > CACHE_LIMIT) this.chunks.delete(this.chunks.keys().next().value!);
    return result;
  }
  private decoration(t: Tile) {
    const key = String(t.prop),
      cached = this.decorations.get(key);
    if (cached) return cached;
    const art = canvas(96, 112),
      ctx = art.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    if (this.propAtlas && t.prop >= 0)
      ctx.drawImage(
        this.propAtlas,
        (t.prop % 4) * 96,
        Math.floor(t.prop / 4) * 112,
        96,
        112,
        0,
        0,
        96,
        112,
      );
    else {
      ctx.fillStyle = '#548758';
      ctx.fillRect(43, 92, 10, 12);
    }
    this.decorations.set(key, art);
    return art;
  }
  private drawTrainer(x: number, y: number) {
    const c = this.context,
      water = tileAt(this.world, this.player.x, this.player.y)!.water;
    const bob = this.moving ? Math.round(Math.sin(this.time * 15)) : 0;
    c.fillStyle = '#173c3938';
    c.beginPath();
    const shadowDrop = Math.max(
      0,
      (this.motion.z - tileAt(this.world, this.player.x, this.player.y)!.level) * LIFT,
    );
    c.ellipse(x, y + 1 + shadowDrop, Math.max(3, 7 - shadowDrop / 14), 3, 0, 0, Math.PI * 2);
    c.fill();
    if (water) {
      polygon(c, '#634c3d', [x - 12, y - 2, x + 12, y - 2, x + 8, y + 4, x - 5, y + 6]);
      polygon(c, '#d2ac6d', [x - 12, y - 2, x - 5, y - 5, x + 12, y - 2, x + 5, y + 1]);
      c.fillStyle = '#e8d9a1';
      c.fillRect(x + 8, y - 7, 2, 13);
    }
    y += bob - (water ? 3 : 0);
    c.fillStyle = '#293e4d';
    c.fillRect(x - 5, y - 6, 4, 6 - bob);
    c.fillRect(x + 1, y - 6, 4, 6 + bob);
    c.fillStyle = '#efd9a4';
    c.fillRect(x - 6, y - 1 - bob, 5, 2);
    c.fillRect(x + 1, y - 1 + bob, 5, 2);
    c.fillStyle = '#d9d7a5';
    c.fillRect(x - 5, y - 15, 10, 10);
    c.fillStyle = '#42636a';
    c.fillRect(x - 4, y - 15, 8, 4);
    c.fillStyle = '#aa754a';
    c.fillRect(x - 7 * this.facing, y - 13, 4, 8);
    c.fillStyle = '#e3b98b';
    c.fillRect(x - 4, y - 23, 8, 8);
    if (this.motion.action === 'climb') {
      const grip = Math.round(Math.sin(this.time * 13) * 2);
      c.fillRect(x - 7, y - 21 + grip, 3, 8);
      c.fillRect(x + 5, y - 21 - grip, 3, 8);
    } else c.fillRect(x + 5 * this.facing, y - 12, 2, 5);
    c.fillStyle = '#624f43';
    c.fillRect(x - 5, y - 24, 10, 4);
    c.fillStyle = '#c8644c';
    c.fillRect(x - 5, y - 27, 10, 5);
    c.fillStyle = '#e38d65';
    c.fillRect(x - 3, y - 28, 7, 2);
    c.fillStyle = '#f4d999';
    c.fillRect(x - 7, y - 23, 14, 2);
    c.fillStyle = '#364a4b';
    c.fillRect(x + (this.facing > 0 ? 2 : -3), y - 19, 1, 2);
  }
  private drawPokemon(
    actor: Omit<WildPokemon, 'species'> & { species: SpeciesId },
    x: number,
    y: number,
  ) {
    const c = this.context;
    c.fillStyle = '#214b4338';
    c.beginPath();
    c.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2);
    c.fill();
    const sprite = this.sprites.get(actor.species);
    if (!sprite) {
      c.fillStyle = '#ebd083';
      c.fillRect(x - 4, y - 8, 8, 8);
      return;
    }
    const frameRate =
      actor.species === 'charmander' || actor.species === 'bulbasaur'
        ? POKEMON[actor.species].animations[actor.moving ? 'run' : 'idle'].frameRate
        : actor.moving
          ? 9
          : 3;
    const frame = this.input.reducedMotion
      ? 0
      : Math.floor(this.time * frameRate + actor.phase) % 6;
    const bob = this.input.reducedMotion
      ? 0
      : Math.sin(this.time * (actor.moving ? 10 : 2) + actor.phase);
    c.save();
    c.translate(Math.round(x), Math.round(y + bob));
    c.scale(actor.facing, 1);
    c.drawImage(sprite, frame * 160, actor.moving ? 160 : 0, 160, 160, -16, -28, 32, 32);
    c.restore();
    this.pokemonLabels.push({
      x,
      y,
      text: `Lv.${actor.level} · ${actor.quality}`,
      color: actor.quality === 'SS' ? '#ffbe63' : actor.quality === 'S' ? '#e7a4ff' : '#f4edcc',
    });
  }

  private render() {
    this.pokemonLabels = [];
    const c = this.context,
      w = this.viewportWidth,
      h = this.viewportHeight;
    const left = Math.round(this.camera.x - w / 2),
      top = Math.round(this.camera.y - h / 2);
    const playerScreen = project(this.player.x, this.player.y, this.motion.z);
    const visibleActors = [{ ...playerScreen, depth: this.player.x + this.player.y }];
    for (const fighter of this.encounter?.state.fighters ?? []) {
      const pos = this.combatPoint(fighter.x, fighter.depth);
      const point = project(pos.x, pos.y, this.combatLevel);
      visibleActors.push({
        x: point.x,
        y:
          point.y -
          (fighter.y + (fighterDefinition(fighter).hoverHeight ?? 0)) * WORLD_COMBAT_HEIGHT_SCALE,
        depth: pos.x + pos.y,
      });
    }
    c.fillStyle = '#286b8b';
    c.fillRect(0, 0, w, h);
    for (let cy = Math.floor(top / CHUNK); cy <= Math.floor((top + h) / CHUNK); cy++)
      for (let cx = Math.floor(left / CHUNK); cx <= Math.floor((left + w) / CHUNK); cx++)
        c.drawImage(this.getChunk(cx, cy), cx * CHUNK - left, cy * CHUNK - top);
    if (
      this.world.cityVersion &&
      Math.hypot(this.player.x - this.world.spawn.x, this.player.y - this.world.spawn.y) < 100
    ) {
      this.cityGround ??= createCityGround();
      const center = project(this.world.spawn.x, this.world.spawn.y, this.world.campLevel);
      c.drawImage(this.cityGround, center.x - left - CITY_GROUND.x, center.y - top - CITY_GROUND.y);
    }
    const bounds = this.tileBounds(left, top, w, h);
    const objects: { depth: number; draw: () => void }[] = [];
    const occludable = [
      {
        x: playerScreen.x - left,
        y: playerScreen.y - top,
        depth: this.motion.climbing
          ? this.motion.climbing.to.x + this.motion.climbing.to.y + 1
          : this.player.x + this.player.y,
      },
      ...this.world.wildlife
        .filter((a) => Math.abs(a.x - this.player.x) < 27 && Math.abs(a.y - this.player.y) < 27)
        .map((a) => {
          const p = project(a.x, a.y, tileAt(this.world, a.x, a.y)!.level);
          return { x: p.x - left, y: p.y - top, depth: a.x + a.y };
        }),
    ];
    const animation = this.input.reducedMotion ? 0 : this.time;
    for (let y = bounds.y0; y <= bounds.y1; y++)
      for (let x = bounds.x0; x <= bounds.x1; x++) {
        const t = tileAt(this.world, x, y)!,
          p = project(x + 0.5, y + 0.5, t.level);
        const sx = Math.round(p.x - left),
          sy = Math.round(p.y - top);
        if (sx < -55 || sx > w + 55 || sy < -10 || sy > h + 112) continue;
        const foreground = occludable.some(
          (a) =>
            x + y + 0.5 > a.depth && Math.abs(sx - a.x) < 30 && sy < a.y + 6 && sy + 64 > a.y - 32,
        );
        if (foreground && !t.citySurface)
          objects.push({
            depth: x + y + 0.5,
            draw: () => {
              c.save();
              c.translate(-left, -top);
              this.paintTile(c, t);
              c.restore();
            },
          });
        if (t.water && t.variant > 0.57) {
          const phase = animation * (t.biome === 'ocean' ? 0.8 : 1.8) + t.variant * 8;
          c.fillStyle = t.biome === 'ocean' ? '#a1dad44a' : '#d3e8cc88';
          const offset = Math.round(Math.sin(phase) * 3);
          c.fillRect(sx - 5 + offset, sy + offset / 2, 5 + Math.floor(t.variant * 4), 1);
          if (t.variant > 0.87) c.fillRect(sx - 2 + offset, sy + 3 + offset / 2, 3, 1);
        }
        if (t.biome === 'ocean') {
          const wave = (Math.sin(animation * 1.4 + x * 0.3 + y * 0.2) + 1) / 2;
          c.strokeStyle = '#d5eddb';
          c.lineWidth = 1;
          c.globalAlpha = 0.2 + wave * 0.5;
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
          ]) {
            if (tileAt(this.world, x + dx, y + dy)?.biome !== 'beach') continue;
            const sign = dx + dy,
              side = dx - dy,
              inset = 1 - wave * 0.2;
            c.beginPath();
            c.moveTo(sx + side * 15 * inset, sy);
            c.lineTo(sx, sy + sign * 7 * inset);
            c.stroke();
          }
          c.globalAlpha = 1;
        }
        if (t.lava) {
          c.fillStyle = Math.sin(animation * 2 + t.variant * 7) > 0 ? '#f6c16a' : '#d3593c';
          c.fillRect(sx - 4, sy, 7, 2);
          if (t.variant > 0.92) {
            const rise = (animation * 8 + t.variant * 45) % 25;
            c.fillStyle = '#eed3a77a';
            c.fillRect(sx + Math.sin(rise * 0.1) * 5, sy - rise - 10, 3, 3);
          }
        }
        if (t.decoration) {
          const art = this.decoration(t);
          const sway =
            t.decoration === 'rock'
              ? 0
              : Math.round(Math.sin(animation * 1.7 + x * 0.35 + y * 0.28));
          const coversPlayer =
            (t.decoration === 'tree' || t.decoration === 'pine') &&
            visibleActors.some(
              (actor) =>
                x + y + 1 > actor.depth &&
                Math.abs(sx - (actor.x - left)) < 48 &&
                sy > actor.y - top - 12 &&
                sy < actor.y - top + 106,
            );
          objects.push({
            depth: x + y + 1,
            draw: () => {
              c.globalAlpha = coversPlayer ? 0.3 : 1;
              if (t.decoration === 'tree' || t.decoration === 'pine') {
                c.fillStyle = '#102c2936';
                c.beginPath();
                c.ellipse(sx + 10, sy + 2, 22, 6, 0.1, 0, Math.PI * 2);
                c.fill();
              }
              c.drawImage(art, sx - 48 + sway, sy - 104);
              c.globalAlpha = 1;
            },
          });
        }
      }
    for (const actor of this.world.wildlife) {
      if (
        this.removed.has(actor.id) ||
        (this.encounter && this.selectedTargets.some((a) => a.id === actor.id))
      )
        continue;
      if (Math.abs(actor.x - this.player.x) > 27 || Math.abs(actor.y - this.player.y) > 27)
        continue;
      const t = tileAt(this.world, actor.x, actor.y)!;
      const p = project(actor.x, actor.y, t.level),
        x = p.x - left,
        y = p.y - top;
      if (x < -32 || x > w + 32 || y < -32 || y > h + 32) continue;
      objects.push({
        depth: actor.x + actor.y,
        draw: () => {
          if (this.selectedTargets.some((a) => a.id === actor.id)) {
            c.strokeStyle = '#ffcc66';
            c.lineWidth = 1.5;
            c.beginPath();
            c.ellipse(x, y, 13, 5, 0, 0, Math.PI * 2);
            c.stroke();
          }
          this.drawPokemon(actor, x, y);
        },
      });
    }
    for (const pet of this.encounter ? [] : this.companions) {
      const motion = this.followers.get(pet.id)!.motion;
      const pos = motion.position;
      const p = project(pos.x, pos.y, motion.z);
      const actor = {
        ...pos,
        id: -1,
        species: pet.species,
        level: pet.level,
        quality: pet.quality,
        home: this.player,
        group: -1,
        leader: -1,
        phase: 0,
        moving: Math.hypot(pos.x - this.player.x, pos.y - this.player.y) > 1.5,
        facing: 1,
      };
      objects.push({
        depth: pos.x + pos.y,
        draw: () => {
          c.strokeStyle = '#96ffe1';
          c.beginPath();
          c.ellipse(p.x - left, p.y - top, 11, 4, 0, 0, Math.PI * 2);
          c.stroke();
          this.drawPokemon(actor, p.x - left, p.y - top);
        },
      });
    }
    addCityObjects(
      c,
      this.world,
      this.cityAtlas,
      this.propAtlas,
      this.player,
      left,
      top,
      w,
      h,
      animation,
      objects,
    );
    const player = project(this.player.x, this.player.y, this.motion.z);
    objects.push({
      depth: this.motion.climbing
        ? this.motion.climbing.to.x + this.motion.climbing.to.y + 1
        : this.player.x + this.player.y,
      draw: () => this.drawTrainer(Math.round(player.x - left), Math.round(player.y - top)),
    });
    objects.sort((a, b) => a.depth - b.depth);
    objects.forEach((o) => o.draw());
    // Labels are a final overlay; suppress overlapping tags instead of stacking them.
    const drawnLabels: { x: number; y: number }[] = [];
    c.save();
    c.textAlign = 'center';
    c.font = 'bold 7px sans-serif';
    const inCity =
      this.world.cityVersion &&
      insideCity(this.player.x - this.world.spawn.x, this.player.y - this.world.spawn.y);
    for (const tag of this.pokemonLabels) {
      if (
        inCity &&
        Math.abs(tag.x - (player.x - left)) < 32 &&
        Math.abs(tag.y - 38 - (player.y - top - 18)) < 32
      )
        continue;
      if (
        drawnLabels.some(
          (other) => Math.abs(other.x - tag.x) < 51 && Math.abs(other.y - tag.y) < 13,
        )
      )
        continue;
      drawnLabels.push(tag);
      c.fillStyle = '#173c36df';
      c.beginPath();
      c.roundRect(tag.x - 24, tag.y - 43, 48, 11, 3);
      c.fill();
      c.fillStyle = tag.color;
      c.fillText(tag.text, tag.x, tag.y - 35);
    }
    if (inCity && !this.target) {
      const x = player.x - left,
        y = player.y - top;
      c.strokeStyle = '#fff4cd';
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(x, y + 2, 10, 4, 0, 0, Math.PI * 2);
      c.stroke();
      polygon(c, '#fff1bd', [x - 4, y - 36, x, y - 32, x + 4, y - 36, x, y - 40]);
    }
    c.restore();
    if (this.target && this.encounter && this.arenaLayer?.ready) {
      const origin = project(this.target.x, this.target.y, this.combatLevel);
      const placement = worldArenaPlacement(origin.x - left, origin.y - top, this.arenaLayer.view);
      c.drawImage(
        this.arenaLayer.canvas,
        placement.x,
        placement.y,
        placement.width,
        placement.height,
      );
    }
    if (this.path.length) {
      const target = this.path[this.path.length - 1],
        tile = tileAt(this.world, target.x, target.y)!;
      const p = project(target.x, target.y, tile.level);
      c.strokeStyle = '#ffedaf';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(p.x - left, p.y - top, 7, 3, 0, 0, Math.PI * 2);
      c.stroke();
    }
    // Sparse drifting pollen, snowflakes or ash. Fixed count regardless of world size.
    if (!this.input.reducedMotion) {
      const biome = tileAt(this.world, this.player.x, this.player.y)!.biome;
      c.fillStyle =
        biome === 'snow' ? '#f5ffffbb' : biome === 'volcano' ? '#f3c4a27a' : '#fff5bb6b';
      for (let i = 0; i < (biome === 'snow' ? 32 : 12); i++) {
        const px =
          ((hash(i, 0, this.world.seed) * w + animation * (biome === 'snow' ? 8 : 3)) % (w + 10)) -
          5;
        const py =
          ((((hash(i, 1, this.world.seed) * h + animation * (biome === 'snow' ? 11 : -3)) %
            (h + 10)) +
            h +
            10) %
            (h + 10)) -
          5;
        c.fillRect(Math.round(px), Math.round(py), i % 3 === 0 ? 2 : 1, 1);
      }
    }
    if (this.drag) {
      const { start, end } = this.drag;
      c.fillStyle = '#62d9ff30';
      c.strokeStyle = '#8ce8ff';
      c.lineWidth = 1;
      c.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
      c.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    }
  }
  requestJump() {
    if (this.input.paused || this.disposed) return;
    this.jumpRequested = true;
    this.path = [];
  }
  private move(dt: number) {
    if (this.drag) return;
    if (this.target) {
      this.moving = false;
      const snapshot = this.encounter?.state;
      const easing = this.input.reducedMotion ? 1 : 1 - Math.exp(-dt / 0.18);
      let point = project(this.target.x, this.target.y, this.combatLevel);
      if (snapshot) {
        const width = this.surface.clientWidth;
        const height = this.surface.clientHeight;
        const frame = automaticCameraFrame(snapshot, 0, { width: 1200 }, width, height);
        const origin = project(this.target.x, this.target.y, this.combatLevel);
        point = {
          x: origin.x + (frame.x - 650) * WORLD_COMBAT_HEIGHT_SCALE,
          y: origin.y + (frame.y - 420) * WORLD_COMBAT_HEIGHT_SCALE,
        };
        const desiredZoom = frame.zoom / WORLD_COMBAT_HEIGHT_SCALE;
        const currentZoom = width / this.viewportWidth;
        const zoom = Math.min(desiredZoom, currentZoom + (desiredZoom - currentZoom) * easing);
        this.viewportWidth = width / zoom;
        this.viewportHeight = height / zoom;
        this.context.setTransform(
          this.surface.width / this.viewportWidth,
          0,
          0,
          this.surface.height / this.viewportHeight,
          0,
          0,
        );
      }
      this.camera.x += (point.x - this.camera.x) * easing;
      this.camera.y += (point.y - this.camera.y) * easing;
      return;
    }
    let sx =
      this.input.x +
      (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) -
      (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
    let sy =
      this.input.y +
      (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) -
      (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0);
    let dx = sx + sy,
      dy = sy - sx;
    if (sx || sy) this.path = [];
    if (this.path.length) {
      const target = this.path[0];
      dx = target.x - this.player.x;
      dy = target.y - this.player.y;
      if (Math.hypot(dx, dy) < 0.12) {
        this.path.shift();
        dx = 0;
        dy = 0;
      }
    }
    const length = Math.hypot(dx, dy);
    this.moving = length > 0.01;
    if (this.moving) {
      this.facing = dx - dy >= 0 ? 1 : -1;
    }
    stepMotion(
      this.world,
      this.motion,
      {
        x: dx,
        y: dy,
        sprint: this.input.sprint || this.keys.has('shift'),
        jump: this.jumpRequested,
        climb: this.input.climb || this.keys.has('e'),
      },
      dt,
    );
    this.jumpRequested = false;
    const target = project(this.player.x, this.player.y, this.motion.z);
    const easing = this.input.reducedMotion ? 1 : 1 - Math.exp(-dt * 10);
    this.camera.x += (target.x - this.camera.x) * easing;
    this.camera.y += (target.y - this.camera.y) * easing;
  }
  private report() {
    const tile = tileAt(this.world, this.player.x, this.player.y)!;
    this.visited.add(tile.biome);
    let closest: WildPokemon | undefined,
      distance = 4;
    for (const actor of this.world.wildlife) {
      if (this.removed.has(actor.id)) continue;
      const d = Math.hypot(actor.x - this.player.x, actor.y - this.player.y);
      if (d < 4) this.seen.add(actor.species);
      if (d < distance) {
        closest = actor;
        distance = d;
      }
    }
    this.nearby = closest
      ? {
          id: closest.id,
          level: closest.level,
          quality: closest.quality,
          species: closest.species,
          count: this.world.wildlife.filter((a) => a.group === closest!.group).length,
        }
      : null;
    this.paintMinimap();
    this.surface.dataset.position = `${this.player.x.toFixed(2)},${this.player.y.toFixed(2)}`;
    const controlled = this.encounter?.state.fighters.find(
      (f) => f.id === this.encounter?.state.controlledFighterIds[0],
    );
    this.surface.dataset.combatPosition = controlled
      ? `${controlled.x.toFixed(2)},${controlled.depth.toFixed(2)}`
      : '';
    this.surface.dataset.seed = String(this.world.seed);
    this.surface.dataset.renderMs = this.renderMs.toFixed(1);
    this.surface.dataset.terrainChunks = String(this.world.chunks.size);
    this.surface.dataset.artReady = String(
      Boolean(this.propAtlas && this.terrainAtlas && this.cliffAtlas && this.cityAtlas),
    );
    this.surface.dataset.worldSize = String(WORLD_SIZE);
    this.surface.dataset.elevation = this.motion.z.toFixed(2);
    this.surface.dataset.groundLevel = String(tile.level);
    this.surface.dataset.action = this.motion.action;
    this.onStatus({
      biome: tile.biome,
      elevation: Math.round(this.motion.z * METERS_PER_LEVEL),
      action: this.motion.action,
      landform: tile.landform,
      x: this.player.x,
      y: this.player.y,
      seen: [...this.seen],
      visited: BIOMES.filter((b) => this.visited.has(b)),
      nearby: this.nearby,
      companion: this.companion,
      companions: [...this.companions],
      selectedTargets: this.selectedTargets.map((a) => ({ ...a })),
      target: this.target ? { ...this.target } : null,
      combatVisualError: this.arenaError || this.arenaLayer?.error || '',
      combatVisualReady: this.arenaLayer?.ready ?? false,
      combat: this.encounter
        ? {
            ...this.encounter.state,
            fighters: this.encounter.state.fighters.map((f) => ({
              ...f,
              cooldowns: { ...f.cooldowns },
            })),
          }
        : null,
      approaching: Boolean(this.target && !this.encounter),
      fps: this.fps,
      active: this.active,
      chunks: this.chunks.size,
      saving: this.saveOK,
      water: tile.water,
      terrainChunks: this.world.chunks.size,
      landmarks: this.world.landmarks,
      city: insideCity(this.player.x - this.world.spawn.x, this.player.y - this.world.spawn.y),
      artReady: Boolean(this.propAtlas && this.terrainAtlas && this.cliffAtlas && this.cityAtlas),
    });
  }
  private tick = (now: number) => {
    if (this.disposed) return;
    const elapsed = this.last ? (now - this.last) / 1000 : 1 / 60;
    this.last = now;
    const dt = Math.min(0.05, elapsed);
    if (!this.input.paused) {
      this.time += dt;
      this.move(dt);
      this.updateCompanion(dt);
      this.wildlifeElapsed += dt;
      if (this.wildlifeElapsed >= 0.1) {
        const anchor = this.target ? { x: this.target.x, y: this.target.y } : null;
        this.active = updateWildlife(this.world, this.player, this.wildlifeElapsed, this.time);
        if (this.target && anchor) {
          Object.assign(this.target, anchor);
          this.target.moving = false;
        }
        this.wildlifeElapsed = 0;
      }
      const renderStart = performance.now();
      this.render();
      this.renderMs = this.renderMs * 0.9 + (performance.now() - renderStart) * 0.1;
    }
    this.frames++;
    this.frameTime += elapsed;
    if (this.frameTime >= 1) {
      this.fps = Math.round(this.frames / this.frameTime);
      this.frames = 0;
      this.frameTime = 0;
    }
    this.uiElapsed += dt;
    this.saveElapsed += dt;
    if (this.uiElapsed >= 0.3) {
      this.report();
      this.uiElapsed = 0;
    }
    if (this.saveElapsed >= 5) {
      this.save();
      this.saveElapsed = 0;
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  setPaused(paused: boolean) {
    if (this.input.paused === paused) return;
    this.input.paused = paused;
    this.clearInput();
    this.report();
    if (paused) this.save();
  }
  returnToCamp() {
    this.travelTo(this.world.spawn);
  }
  walkTo(destination: Point) {
    if (
      this.target ||
      this.encounter ||
      !Number.isFinite(destination.x) ||
      !Number.isFinite(destination.y)
    )
      return false;
    const path = findPath(this.world, this.player, destination);
    if (!path.length) return false;
    this.clearInput();
    this.path = path;
    return true;
  }
  travelTo(destination: Point) {
    if (this.target || this.encounter) return false;
    if (!Number.isFinite(destination.x) || !Number.isFinite(destination.y)) return false;
    if (!traversable(this.world, destination.x, destination.y)) return false;
    this.clearInput();
    this.selectedTargets = [];
    this.motion = createMotion(this.world, destination);
    this.player = this.motion.position;
    this.resetFollowers();
    this.path = [];
    this.camera = project(this.player.x, this.player.y, this.motion.z);
    this.lastMini = '';
    syncWildlife(this.world, this.player);
    this.chunks.clear();
    this.report();
    this.save();
    return true;
  }
  save = () => {
    const data: WorldSave = {
      version: 2,
      seed: this.world.seed,
      player: this.player,
      seen: [...this.seen],
      visited: [...this.visited],
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.saveOK = true;
    } catch {
      this.saveOK = false;
    }
  };
  destroy() {
    this.disposed = true;
    this.arenaLayer?.destroy();
    this.arenaLayer = null;
    this.save();
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.clearInput);
    window.removeEventListener('pagehide', this.save);
    document.removeEventListener('visibilitychange', this.visibility);
    this.surface.removeEventListener('pointerdown', this.pointerDown);
    this.surface.removeEventListener('pointermove', this.pointerMove);
    this.surface.removeEventListener('pointerup', this.pointerUp);
    this.surface.removeEventListener('pointercancel', this.cancelDrag);
    this.surface.removeEventListener('lostpointercapture', this.cancelDrag);
    this.chunks.clear();
    this.decorations.clear();
    this.sprites.clear();
    this.terrainArt.clear();
    this.cliffArt.clear();
    this.world.chunks.clear();
    this.world.wildlifeChunks.clear();
  }
}
