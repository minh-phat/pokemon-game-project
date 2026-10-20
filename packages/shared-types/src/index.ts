import { z } from 'zod';

export const speciesIds = [
  'pikachu',
  'charmander',
  'squirtle',
  'bulbasaur',
  'eevee',
  'runedrake',
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
    arena: z.enum(['forest', 'volcano', 'lake']),
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
export type StatusKind = 'stun' | 'slow' | 'leech' | 'burn' | 'shield';
export interface StatusEffect {
  kind: StatusKind;
  duration: number;
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
  damage: number;
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
  electricAura?: { reach: number; damageScale: number };
  movement?: { speed: number; duration: number };
  groundHazard?: { radius: number; duration: number; interval: number; damage: number };
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
export interface ArenaDefinition {
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
export interface Cast {
  skillId: string;
  elapsed: number;
  fired: number;
  hitIds: string[];
  channelTicks?: number;
  autoBasic?: boolean;
  targetId?: string;
  counterAt?: number;
  counterTargetId?: string;
  originX?: number;
  originDepth?: number;
  lockX?: number;
  lockDepth?: number;
}
export interface Fighter {
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
  seed: number;
  tick: number;
  elapsed: number;
  phase: 'selection' | 'battle' | 'finished';
  rules: MatchRules;
  manualTeams: [boolean, boolean];
  controlledFighterIds: [string | null, string | null];
  fighters: Fighter[];
  projectiles: Projectile[];
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
