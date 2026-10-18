import {
  ANIMATIONS,
  type PokemonDefinition,
  type SkillDefinition,
  type Element,
  type SpeciesId,
  type ArenaDefinition,
  type AnimationName,
} from '@arena/shared-types';
export * from './manifest';

function skill(
  id: string,
  name: string,
  element: Element,
  behavior: SkillDefinition['behavior'],
  damage: number,
  energy: number,
  cooldown: number,
  range: number,
  options: Partial<SkillDefinition> = {},
): SkillDefinition {
  const startup = options.startup ?? (behavior === 'melee' ? 0.15 : 0.38);
  return {
    id,
    name,
    description: '',
    element,
    behavior,
    damageType: behavior === 'melee' ? 'physical' : 'special',
    damage,
    energy,
    cooldown,
    range,
    startup,
    active: 0.12,
    recovery: 0.32,
    projectileSpeed: 460,
    hitbox: { width: 28, height: 26, altitude: 28 },
    knockback: 100,
    effects: [],
    animation: behavior === 'melee' ? 'attack' : 'cast',
    vfx: element,
    sfx: element,
    usage: { minRange: 0, priority: 1 },
    events: [
      {
        at: startup,
        kind:
          behavior === 'buff'
            ? 'buff'
            : behavior === 'projectile' || behavior === 'debuff'
              ? 'projectile'
              : 'hit',
      },
    ],
    ...options,
  };
}
export const SKILLS = {
  quickAttack: skill('quick-attack', 'Quick Attack', 'normal', 'melee', 13, 0, 0.9, 88, {
    description: 'A fast lunge that closes the gap.',
    knockback: 70,
    recovery: 0.16,
    movement: { speed: 320, duration: 0.18 },
  }),
  thunderbolt: skill('thunderbolt', 'Thunderbolt', 'electric', 'projectile', 24, 20, 3.4, 520, {
    description: 'A quick electric bolt with a brief stun.',
    projectileSpeed: 660,
    effects: [{ kind: 'stun', duration: 0.3, strength: 1 }],
  }),
  thunderWave: skill('thunder-wave', 'Thunder Wave', 'electric', 'debuff', 7, 14, 5, 430, {
    description: 'A low wave of electricity that slows its target.',
    hitbox: { width: 42, height: 18, altitude: 13 },
    effects: [{ kind: 'slow', duration: 2.6, strength: 0.48 }],
    usage: { minRange: 120, priority: 1.2 },
  }),
  voltTackle: skill('volt-tackle', 'Volt Tackle', 'electric', 'melee', 34, 32, 6, 150, {
    description: 'An electrified dash with heavy knockback.',
    startup: 0.28,
    knockback: 260,
    usage: { minRange: 0, priority: 1.6 },
    animation: 'dash',
    movement: { speed: 480, duration: 0.3 },
  }),
  scratch: skill('scratch', 'Scratch', 'normal', 'melee', 15, 0, 1, 83, {
    description: 'A sharp close-range strike.',
  }),
  ember: skill('ember', 'Ember', 'fire', 'projectile', 19, 14, 2.6, 440, {
    description: 'A small fireball that burns over time.',
    effects: [{ kind: 'burn', duration: 2, strength: 2 }],
  }),
  flamethrower: skill('flamethrower', 'Flamethrower', 'fire', 'area', 32, 30, 5.5, 230, {
    description: 'A sweeping cone of flame. Hits enemies in front.',
    hitbox: { width: 230, height: 58, altitude: 30 },
    startup: 0.5,
    usage: { minRange: 0, priority: 1.5 },
  }),
  flameBurst: skill('flame-burst', 'Flame Burst', 'fire', 'projectile', 35, 34, 6.4, 480, {
    description: 'A high fireball with explosive power.',
    hitbox: { width: 38, height: 26, altitude: 42 },
    startup: 0.6,
    knockback: 190,
    usage: { minRange: 100, priority: 1.4 },
  }),
  tackle: skill('tackle', 'Tackle', 'normal', 'melee', 13, 0, 1.15, 88, {
    description: 'A sturdy body check.',
    knockback: 160,
  }),
  waterGun: skill('water-gun', 'Water Gun', 'water', 'projectile', 20, 14, 2.8, 500, {
    description: 'A focused stream of water.',
    projectileSpeed: 560,
  }),
  bubbleBeam: skill('bubble-beam', 'Bubble Beam', 'water', 'debuff', 24, 24, 4.5, 480, {
    description: 'A low stream of bubbles that slows pursuit.',
    hitbox: { width: 48, height: 19, altitude: 14 },
    effects: [{ kind: 'slow', duration: 2, strength: 0.4 }],
    usage: { minRange: 90, priority: 1.3 },
  }),
  rapidSpin: skill('rapid-spin', 'Rapid Spin', 'water', 'buff', 21, 24, 5, 115, {
    description: 'Guard in your shell, spin, and strike nearby foes.',
    animation: 'guard',
    effects: [{ kind: 'shield', duration: 1.8, strength: 0.55 }],
    usage: { minRange: 0, priority: 1.6 },
    events: [
      { at: 0.15, kind: 'buff' },
      { at: 0.35, kind: 'hit' },
    ],
    startup: 0.15,
    active: 0.3,
  }),
  vineWhip: skill('vine-whip', 'Vine Whip', 'grass', 'melee', 14, 0, 1.25, 170, {
    description: 'A vine lashes out beyond ordinary melee range.',
    hitbox: { width: 170, height: 35, altitude: 25 },
  }),
  razorLeaf: skill('razor-leaf', 'Razor Leaf', 'grass', 'projectile', 22, 17, 3, 540, {
    description: 'A fast leaf thrown from a safe distance.',
    projectileSpeed: 550,
    usage: { minRange: 80, priority: 1.3 },
  }),
  leechSeed: skill('leech-seed', 'Leech Seed', 'grass', 'debuff', 8, 23, 6, 480, {
    description: 'A seed drains health back to Bulbasaur.',
    effects: [{ kind: 'leech', duration: 4, strength: 4 }],
    usage: { minRange: 100, priority: 1.5 },
  }),
  solarBeam: skill('solar-beam', 'Solar Beam', 'grass', 'projectile', 46, 42, 8, 680, {
    description: 'Charge sunlight into a powerful, high beam.',
    startup: 0.9,
    projectileSpeed: 850,
    hitbox: { width: 84, height: 24, altitude: 43 },
    knockback: 200,
    usage: { minRange: 200, priority: 1.8 },
  }),
};
const animations = Object.fromEntries(
  ANIMATIONS.map((name, i) => [
    name,
    {
      start: i * 6,
      end: i * 6 + 5,
      frameRate: name === 'run' ? 14 : 10,
      repeat: ['idle', 'run', 'guard', 'crouch', 'victory'].includes(name) ? -1 : 0,
    },
  ]),
) as PokemonDefinition['animations'];
export const POKEMON: Record<SpeciesId, PokemonDefinition> = {
  pikachu: {
    id: 'pikachu',
    name: 'Pikachu',
    number: '025',
    element: 'electric',
    role: 'Agile striker',
    description:
      'Small sparks. Big energy. A lightning-fast fighter that darts around danger and strikes before you blink.',
    color: '#f6cf55',
    hp: 155,
    energy: 100,
    attack: 27,
    defense: 15,
    speed: 205,
    acceleration: 1250,
    jumpStrength: 440,
    dodgeCooldown: 1.6,
    attackRange: 88,
    collision: { width: 40, height: 54 },
    skills: [SKILLS.quickAttack, SKILLS.thunderbolt, SKILLS.thunderWave, SKILLS.voltTackle],
    animations,
    ai: { aggression: 0.82, dodge: 0.9, guard: 0.1, preferredDistance: 140, retreat: 0.5 },
  },
  charmander: {
    id: 'charmander',
    name: 'Charmander',
    number: '004',
    element: 'fire',
    role: 'Fearless brawler',
    description:
      'A fiery little fighter with an unstoppable spirit. Closes in, leaps over danger, and turns up the heat.',
    color: '#f2966d',
    hp: 180,
    energy: 100,
    attack: 31,
    defense: 20,
    speed: 160,
    acceleration: 900,
    jumpStrength: 470,
    dodgeCooldown: 2.2,
    attackRange: 83,
    collision: { width: 42, height: 56 },
    skills: [SKILLS.scratch, SKILLS.ember, SKILLS.flamethrower, SKILLS.flameBurst],
    animations,
    ai: { aggression: 0.98, dodge: 0.65, guard: 0.12, preferredDistance: 90, retreat: 0.2 },
  },
  squirtle: {
    id: 'squirtle',
    name: 'Squirtle',
    number: '007',
    element: 'water',
    role: 'Shell defender',
    description:
      'Cool under pressure. Uses its sturdy shell, well-timed counters, and rolling dodges to outlast the opposition.',
    color: '#79c8e8',
    hp: 215,
    energy: 100,
    attack: 22,
    defense: 40,
    speed: 125,
    acceleration: 800,
    jumpStrength: 365,
    dodgeCooldown: 2.5,
    attackRange: 88,
    collision: { width: 48, height: 50 },
    skills: [SKILLS.tackle, SKILLS.waterGun, SKILLS.bubbleBeam, SKILLS.rapidSpin],
    animations,
    ai: { aggression: 0.5, dodge: 0.6, guard: 0.85, preferredDistance: 180, retreat: 0.3 },
  },
  bulbasaur: {
    id: 'bulbasaur',
    name: 'Bulbasaur',
    number: '001',
    element: 'grass',
    role: 'Ranged tactician',
    description:
      'Patience is a superpower. Keeps its distance, controls the field with vines, and recovers health with Leech Seed.',
    color: '#91cda3',
    hp: 185,
    energy: 100,
    attack: 25,
    defense: 27,
    speed: 140,
    acceleration: 850,
    jumpStrength: 380,
    dodgeCooldown: 2.3,
    attackRange: 170,
    collision: { width: 55, height: 45 },
    skills: [SKILLS.vineWhip, SKILLS.razorLeaf, SKILLS.leechSeed, SKILLS.solarBeam],
    animations,
    ai: { aggression: 0.55, dodge: 0.7, guard: 0.25, preferredDistance: 330, retreat: 0.9 },
  },
};
export const ROSTER = Object.values(POKEMON);
export const SKILL_BY_ID = Object.fromEntries(Object.values(SKILLS).map((s) => [s.id, s]));
export const ELEMENTS: Record<Element, { label: string; color: string; symbol: string }> = {
  normal: { label: 'Normal', color: '#c6c3b9', symbol: '◈' },
  electric: { label: 'Electric', color: '#f6cf55', symbol: 'ϟ' },
  fire: { label: 'Fire', color: '#f2966d', symbol: '♨' },
  water: { label: 'Water', color: '#79c8e8', symbol: '◉' },
  grass: { label: 'Grass', color: '#91cda3', symbol: '❧' },
};
export const EFFECTIVENESS: Partial<Record<Element, Partial<Record<Element, number>>>> = {
  electric: { water: 1.4, grass: 0.75, electric: 0.75 },
  fire: { grass: 1.4, water: 0.75, fire: 0.75 },
  water: { fire: 1.4, grass: 0.75, water: 0.75 },
  grass: { water: 1.4, fire: 0.75, grass: 0.75 },
};
export const ARENAS: ArenaDefinition[] = [
  {
    id: 'forest',
    name: 'Enchanted Forest',
    subtitle: 'Beneath an emerald canopy',
    color: '#88bca2',
    width: 1200,
    ground: 520,
    bounds: [55, 1145],
    spawns: [210, 990],
    layers: [
      '/assets/forest-sky.svg',
      '/assets/forest-far.svg',
      '/assets/forest-near.svg',
      '/assets/forest-ground.svg',
    ],
    ambient: '/assets/forest.wav',
  },
  {
    id: 'volcano',
    name: 'Volcanic Battlefield',
    subtitle: 'Where the earth comes alive',
    color: '#ee927a',
    width: 1200,
    ground: 520,
    bounds: [55, 1145],
    spawns: [210, 990],
    layers: [
      '/assets/volcano-sky.svg',
      '/assets/volcano-far.svg',
      '/assets/volcano-near.svg',
      '/assets/volcano-ground.svg',
    ],
    ambient: '/assets/volcano.wav',
  },
  {
    id: 'lake',
    name: 'Crystal Lake',
    subtitle: 'A quiet place for a great battle',
    color: '#93bde3',
    width: 1200,
    ground: 520,
    bounds: [55, 1145],
    spawns: [210, 990],
    layers: [
      '/assets/lake-sky.svg',
      '/assets/lake-far.svg',
      '/assets/lake-near.svg',
      '/assets/lake-ground.svg',
    ],
    ambient: '/assets/lake.wav',
  },
];
export const DIFFICULTY = {
  easy: { reaction: 0.34, accuracy: 0.55, aggression: 0.8 },
  normal: { reaction: 0.2, accuracy: 0.75, aggression: 1 },
  hard: { reaction: 0.12, accuracy: 0.9, aggression: 1.12 },
};
export const animationFrames = ANIMATIONS as readonly AnimationName[];
