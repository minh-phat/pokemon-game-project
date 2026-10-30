import { z } from 'zod';

export const MIN_PET_LEVEL = 1;
export const MAX_PET_LEVEL = 100;
export const PET_QUALITIES = ['C', 'B', 'A', 'S', 'SS'] as const;
export const PetProgressionSchema = z.object({
  level: z.number().int().min(MIN_PET_LEVEL).max(MAX_PET_LEVEL),
  quality: z.enum(PET_QUALITIES),
});
export type PetProgression = z.infer<typeof PetProgressionSchema>;
export type PetQuality = PetProgression['quality'];

export const speciesIds = [
  'pikachu',
  'charmander',
  'squirtle',
  'bulbasaur',
  'eevee',
  'runedrake',
  'water-slime',
] as const;
export const SpeciesSchema = z.enum(speciesIds);
export type SpeciesId = z.infer<typeof SpeciesSchema>;
export type Element = 'normal' | 'electric' | 'fire' | 'water' | 'grass' | 'poison';
export const RulesSchema = z
  .object({
    teamSize: z.number().int().min(1).max(4),
    activeSize: z.number().int().min(1).max(4),
    duration: z.union([z.literal(0), z.literal(60), z.literal(120), z.literal(180)]),
    difficulty: z.enum(['easy', 'normal', 'hard']),
    arena: z.enum(['forest', 'volcano', 'lake', 'ruins']),
    duplicates: z.boolean(),
    elements: z.boolean(),
    switching: z.boolean(),
  })
  .strict()
  .refine((v) => v.activeSize <= v.teamSize, {
    message: 'Active Pokémon cannot exceed team size',
    path: ['activeSize'],
  });
export type MatchRules = z.infer<typeof RulesSchema>;
export const DEFAULT_RULES: MatchRules = {
  teamSize: 2,
  activeSize: 1,
  duration: 120,
  difficulty: 'normal',
  arena: 'forest',
  duplicates: false,
  elements: true,
  switching: true,
};
export const TeamSchema = z.array(SpeciesSchema).min(1).max(4);
export function validateTeam(team: unknown, rules: MatchRules): SpeciesId[] {
  const parsed = TeamSchema.parse(team);
  if (parsed.length !== rules.teamSize) throw new Error(`Choose exactly ${rules.teamSize} Pokémon`);
  if (!rules.duplicates && new Set(parsed).size !== parsed.length)
    throw new Error('Duplicate Pokémon are disabled');
  return parsed;
}
export const PlayerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[\p{L}\p{N} _.-]+$/u, 'Use letters, numbers, spaces, or ._-');
export const JoinSchema = z.object({ name: PlayerNameSchema.default('Trainer') }).strip();
export const RoomCodeSchema = z.string().regex(/^[a-zA-Z0-9_-]{6,12}$/);
export type AIState =
  | 'Idle'
  | 'FindTarget'
  | 'Chase'
  | 'MaintainDistance'
  | 'Retreat'
  | 'Attack'
  | 'CastSkill'
  | 'Dodge'
  | 'Jump'
  | 'Guard'
  | 'Recover'
  | 'Stunned'
  | 'Fainted';
export const ANIMATIONS = [
  'idle',
  'run',
  'jump',
  'fall',
  'land',
  'attack',
  'cast',
  'dash',
  'backstep',
  'crouch',
  'guard',
  'hit',
  'knockback',
  'faint',
  'victory',
] as const;
export type AnimationName = (typeof ANIMATIONS)[number];
export type StatusKind = 'stun' | 'slow' | 'leech' | 'burn' | 'shield' | 'invisible';
export interface StatusEffect {
  kind: StatusKind;
  duration: number;
  /** Burn/leech: % of source Attack per second. Other statuses keep their own units. */
  strength: number;
  sourceId?: string;
  pulse?: number;
}
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  element: Element;
  behavior: 'melee' | 'projectile' | 'area' | 'buff' | 'debuff';
  damageType: 'physical' | 'special';
  /** Percentage of the caster's Attack; 100 means 100% ATK. */
  damagePercent: number;
  finisherDamagePercent?: number;
  energy: number;
  cooldown: number;
  range: number;
  startup: number;
  active: number;
  recovery: number;
  projectileSpeed: number;
  hitbox: { width: number; height: number; altitude: number };
  knockback: number;
  effects: StatusEffect[];
  animation: AnimationName;
  vfx: string;
  sfx: string;
  usage: { minRange: number; priority: number; belowHP?: number };
  events: { at: number; kind: 'hit' | 'projectile' | 'buff' }[];
  channel?: { interval: number; halfAngle: number };
  beam?: { width: number; interval: number; clashPower: number };
  electricAura?: { reach: number; damageScale: number };
  movement?: { speed: number; duration: number; delay?: number };
  groundHazard?: { radius: number; duration: number; interval: number; damagePercent: number };
  homing?: { turnRate: number; duration: number };
}
export interface PokemonDefinition {
  id: SpeciesId;
  name: string;
  number: string;
  element: Element;
  role: string;
  description: string;
  passive?: { name: string; description: string };
  color: string;
  /** Visual height above the arena floor; combat hitboxes stay unchanged. */
  hoverHeight?: number;
  hp: number;
  energy: number;
  maxStamina: number;
  attack: number;
  defense: number;
  speed: number;
  sprintSpeed: number;
  acceleration: number;
  jumpStrength: number;
  dodgeCooldown: number;
  attackRange: number;
  collision: { width: number; height: number };
  skills: SkillDefinition[];
  animations: Record<
    AnimationName,
    { start: number; end: number; frameRate: number; repeat: number }
  >;
  ai: {
    aggression: number;
    dodge: number;
    guard: number;
    preferredDistance: number;
    retreat: number;
  };
}
/** Height samples in a rectangular or isometric basis; shared by simulation and rendering. */
export interface ArenaSurface {
  origin: { x: number; depth: number };
  axisX: { x: number; depth: number };
  axisZ: { x: number; depth: number };
  columns: number;
  rows: number;
  heights: number[];
  blocked: boolean[];
  /** World tile props occupy only the center, just like exploration collision. */
  props?: boolean[];
  water?: boolean[];
  stepHeight: number;
  climbHeight: number;
}
export interface ArenaObstacle {
  id: string;
  kind: 'rock' | 'pillar' | 'wall';
  climbable?: boolean;
  x: number;
  depth: number;
  width: number;
  length: number;
  height: number;
}
export interface ArenaDefinition {
  surface?: ArenaSurface;
  /** Procedural world terrain, sampled on demand outside the initial encounter patch. */
  worldTerrain?: {
    seed: number;
    /** Missing on archived tickets, which use the original archipelago. */
    geographyVersion?: 1 | 2;
    /** Missing on archived tickets: preserve the original camp terrain. */
    cityVersion?: 0 | 1 | 2;
    origin: { x: number; y: number };
    baseLevel: number;
  };
  height?: number;
  background?: string;
  thumbnail?: string;
  spawnSpacing?: number;
  obstacles?: ArenaObstacle[];
  spawnDepth?: number;

  id: MatchRules['arena'];
  name: string;
  subtitle: string;
  color: string;
  width: number;
  ground: number;
  depthBounds: [number, number];
  bounds: [number, number];
  spawns: [number, number];
  layers: string[];
  ambient: string;
}
export interface HydroDrop {
  id: number;
  emittedAt: number;
  x: number;
  depth: number;
  vx: number;
  vDepth: number;
}
export interface Cast {
  skillId: string;
  elapsed: number;
  fired: number;
  hitIds: string[];
  channelTicks?: number;
  hydroDrops?: HydroDrop[];
  hydroSource?: { x: number; depth: number };
  autoBasic?: boolean;
  targetId?: string;
  counterAt?: number;
  counterTargetId?: string;
  originX?: number;
  originDepth?: number;
  lockX?: number;
  lockDepth?: number;
  lockY?: number;
  bound?: boolean;
  bindEligible?: boolean;
}
export interface Fighter {
  groundHeight?: number;
  traversal?: 'jump' | 'fall' | 'climb';
  climbing?: {
    fromX: number;
    fromDepth: number;
    fromY: number;
    x: number;
    depth: number;
    y: number;
    elapsed: number;
    duration: number;
  };
  progression?: PetProgression;
  id: string;
  playerId: string;
  team: 0 | 1;
  species: SpeciesId;
  slot: number;
  hp: number;
  energy: number;
  stamina: number;
  maxStamina: number;
  sprinting: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  depth: number;
  vDepth: number;
  moveDepth: number;
  aimX: number;
  aimDepth: number;
  facing: 1 | -1;
  active: boolean;
  state: AIState;
  animation: AnimationName;
  animationTime: number;
  cooldowns: Record<string, number>;
  dodgeCooldown: number;
  invulnerable: number;
  actionTime: number;
  thinkIn: number;
  cast: Cast | null;
  effects: StatusEffect[];
  targetId: string | null;
  guarded: boolean;
  crouched: boolean;
  moveIntent: number;
  swapCooldown: number;
  damageDealt: number;
  adaptiveCharge?: number;
  dodgeOriginX?: number;
  dodgeOriginDepth?: number;
  dodgeWindow?: number;
  dodgeEarned?: boolean;
}
export interface Projectile {
  vy?: number;
  previousY?: number;
  id: string;
  ownerId: string;
  team: 0 | 1;
  skillId: string;
  x: number;
  y: number;
  depth?: number;
  previousDepth?: number;
  vDepth?: number;
  previousX: number;
  vx: number;
  width: number;
  height: number;
  life: number;
  auraHitIds?: string[];
  targetId?: string;
  age?: number;
}
export interface GroundHazard {
  id: string;
  ownerId: string;
  team: 0 | 1;
  skillId: string;
  x: number;
  depth: number;
  radius: number;
  duration: number;
  pulse: number;
}
export interface BattleBeam {
  ownerId: string;
  team: 0 | 1;
  skillId: string;
  startX: number;
  startDepth: number;
  endX: number;
  endDepth: number;
  width: number;
  clashWith?: string;
}
export interface BattleEvent {
  id: number;
  tick: number;
  kind: 'damage' | 'dodge' | 'skill' | 'faint' | 'deploy' | 'heal' | 'switch' | 'guard';
  fighterId: string;
  targetId?: string;
  value?: number;
  text: string;
  x: number;
  y: number;
  element?: Element;
  depth?: number;
}
export interface BattleConfig {
  /** Server-verified open-world rosters may have unequal, unrestricted sizes. */
  worldEncounter?: boolean;
  arenaDefinition?: ArenaDefinition;
  progressions?: [PetProgression[], PetProgression[]];
  /** Stop a wild encounter below 10% HP, including otherwise lethal hits. */
  captureTeam?: 0 | 1;
  rules: MatchRules;
  players: [string, string];
  teams?: [SpeciesId[], SpeciesId[]];
  aiTeams?: number[];
}
export interface BattleResult {
  winner: 0 | 1 | 'draw';
  reason: 'elimination' | 'time' | 'disconnect';
  scores: [number, number];
}
export interface BattleSnapshot {
  arenaDefinition?: ArenaDefinition;
  seed: number;
  tick: number;
  elapsed: number;
  phase: 'selection' | 'battle' | 'finished';
  rules: MatchRules;
  manualTeams: [boolean, boolean];
  controlledFighterIds: [string | null, string | null];
  fighters: Fighter[];
  projectiles: Projectile[];
  beams?: BattleBeam[];
  groundHazards: GroundHazard[];
  events: BattleEvent[];
  result: BattleResult | null;
}
export interface LobbyPlayer {
  id: string;
  name: string;
  team: SpeciesId[];
  ready: boolean;
  connected: boolean;
  rematch: boolean;
}
export interface LobbySnapshot {
  code: string;
  hostId: string;
  rules: MatchRules;
  players: LobbyPlayer[];
  phase: 'lobby' | 'countdown' | 'battle' | 'finished';
  countdown: number;
  reconnectSeconds: number;
}
export const BASIC_GUARD_REDUCTION = 0.2;
export const STAMINA_RULES = {
  dodgeCost: 15,
  sprintRecovery: 3,
  moveRecovery: 10,
  idleRecovery: 15,
  guardDrain: 10,
  lowThreshold: 0.2,
} as const;

export const ManualBattleCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('move'),
      fighterId: z.string().min(1),
      direction: z.number().finite().min(-1).max(1),
      depthDirection: z.number().finite().min(-1).max(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('target'),
      fighterId: z.string().min(1),
      targetId: z.string().min(1),
    })
    .strict(),
  z
    .object({ type: z.literal('guard'), fighterId: z.string().min(1), active: z.boolean() })
    .strict(),
  z
    .object({
      type: z.literal('dodge'),
      fighterId: z.string().min(1),
      mode: z.enum(['dash', 'jump', 'crouch']),
      direction: z.number().finite().min(-1).max(1).optional(),
      depthDirection: z.number().finite().min(-1).max(1).optional(),
    })
    .strict(),
  z
    .object({ type: z.literal('skill'), fighterId: z.string().min(1), skillId: z.string().min(1) })
    .strict(),
]);
export type ManualBattleCommand = z.infer<typeof ManualBattleCommandSchema>;

export type AIAction =
  | { type: 'guard' }
  | { type: 'move'; direction: number; depthDirection?: number; state: AIState; sprint?: boolean }
  | { type: 'skill'; skillId: string }
  | {
      type: 'dodge';
      mode: 'dash' | 'jump' | 'crouch' | 'guard';
      direction: number;
      depthDirection?: number;
    }
  | { type: 'wait' };

/** Fade-in is visible; after half a second enemies lose their target. */
export function isConcealed(f: Pick<Fighter, 'effects'>): boolean {
  return f.effects.some((e) => e.kind === 'invisible' && e.duration <= 4.5 && e.duration > 0);
}

/** Milestones repeat independently; early lucky rolls do not reset them. */
export const SUMMON_GUARANTEES = [
  { quality: 'A', interval: 11 },
  { quality: 'S', interval: 101 },
  { quality: 'SS', interval: 1001 },
] as const;
export interface OwnedPet {
  experience?: number;
  id: string;
  species: SpeciesId;
  quality: PetQuality;
  level: number;
  acquiredAt: string;
}
export function summonQualityOdds(attempts: number): Record<PetQuality, number> {
  const progress = Math.min(1000, Math.max(0, attempts)) / 1000;
  const odds = {
    C: 0,
    B: Math.round(3000 + 500 * progress),
    A: Math.round(1200 + 1800 * progress),
    S: Math.round(280 + 920 * progress),
    SS: Math.round(20 + 280 * progress),
  };
  odds.C = 10000 - odds.B - odds.A - odds.S - odds.SS;
  const floor = SUMMON_GUARANTEES.filter(({ interval }) => (attempts + 1) % interval === 0).at(
    -1,
  )?.quality;
  if (floor) {
    for (const quality of PET_QUALITIES) {
      if (quality === floor) break;
      odds[floor] += odds[quality];
      odds[quality] = 0;
    }
  }
  return odds;
}
/** Roll is an integer in [0, 10000), generated exclusively by the server. */
export function rollSummonQuality(attempts: number, roll: number): PetQuality {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 10000) throw new Error('Invalid quality roll');
  const odds = summonQualityOdds(attempts);
  for (const quality of PET_QUALITIES) {
    if (roll < odds[quality]) return quality;
    roll -= odds[quality];
  }
  return 'SS';
}
export interface PetCollection {
  attempts: number;
  pets: OwnedPet[];
  qualityOdds: Record<PetQuality, number>;
  guarantees: { quality: PetQuality; remaining: number }[];
  cost: number;
}
export interface SummonResult extends PetCollection {
  received: OwnedPet;
}

export interface WorldWildPet extends PetProgression {
  id: number;
  species: SpeciesId;
  x: number;
  y: number;
}
export interface WorldEncounterTicket {
  /** Missing on older tickets, whose deterministic replay keeps the original AI. */
  combatVersion?: 2 | 3 | 4 | 5;
  arenaDefinition?: ArenaDefinition;
  id: string;
  seed: number;
  pet: OwnedPet;
  wild: WorldWildPet;
  pets?: OwnedPet[];
  wilds?: WorldWildPet[];
}
export const WorldBattleActionSchema = z.discriminatedUnion('type', [
  z
    .object({
      tick: z.number().int().min(0).max(7200),
      type: z.literal('control'),
      fighterId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      tick: z.number().int().min(0).max(7200),
      type: z.literal('mode'),
      manual: z.boolean(),
    })
    .strict(),
  z
    .object({
      tick: z.number().int().min(0).max(7200),
      type: z.literal('command'),
      command: ManualBattleCommandSchema,
    })
    .strict(),
]);
export type WorldBattleAction = z.infer<typeof WorldBattleActionSchema>;
export interface WorldBattleReward {
  pets?: OwnedPet[];
  capturedPets?: OwnedPet[];
  pet: OwnedPet;
  experience: number;
  captured: OwnedPet | null;
}
