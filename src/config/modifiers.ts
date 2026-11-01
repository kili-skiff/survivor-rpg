import type { WeaponId } from './types';

// Modifiers for main weapons, like the Daedalus hammer in Hades: cards that change how the weapon behaves,
// not just its numbers. They come at fixed levels (MODIFIER_LEVELS), three to choose from, and only for
// the main weapon you carry. Most stack; a few true opposites exclude each other.

export type ModifierId =
  | 'heavybolt'
  | 'volley'
  | 'ricochet'
  | 'sparkchain'
  | 'blasttip'
  | 'frostbolt'
  | 'whirl'
  | 'pull'
  | 'wideblade'
  | 'orbit'
  | 'keen'
  | 'embertrail';

export interface ModifierDef {
  id: ModifierId;
  /** The main weapon it belongs to */
  weapon: WeaponId;
  name: string;
  description: string;
  texture: string;
  /** Modifiers that cannot be taken together with this one (both ways) */
  excludes?: ModifierId[];
}

/** The levels where a modifier choice replaces the level-up cards: `first`, then every `every` levels. */
export const MODIFIER_LEVELS = { first: 5, every: 5 };
/** How many modifiers a choice offers */
export const MODIFIER_CHOICES = 3;

/** The numbers behind the modifiers. */
export const MOD = {
  heavy: { damageMul: 3.5, pierce: 2, knockback: 160, scale: 1.8 },
  volley: { extra: 3, damageMul: 0.75, spread: 0.2 },
  /** How far a bolt looks for the next enemy after its last hit (px) */
  ricochet: { bounces: 2, range: 170 },
  /** Share of the hit that jumps over, and how far (px) */
  spark: { share: 0.5, range: 110, showMs: 90 },
  /** Burst radius at the last hit (px, before area) */
  blast: { radius: 64 },
  frost: { factor: 0.6, ms: 1500 },
  /** Stays at the turn for `holdMs` and hits everything near every `tickMs` */
  whirl: { holdMs: 800, tickMs: 150 },
  /** Pull towards the player on the way back (px/s, like knockback) */
  pull: { speed: 260 },
  wide: { area: 0.5 },
  /** Circles the player once before it is caught, at this distance (px, before area), with a share of the damage */
  orbit: { radius: 70, damageMul: 0.3 },
  /** Hits per enemy on each way, and the time between two hits on the same enemy (ms) */
  keen: { hits: 2, gapMs: 250 },
  /** An ember every `step` px, burning for `ms`; every `tickMs` it deals `share` of the damage within `radius` */
  trail: { step: 26, ms: 1500, tickMs: 400, share: 0.1, radius: 20 },
};

export const MODIFIERS: Record<ModifierId, ModifierDef> = {
  heavybolt: {
    id: 'heavybolt',
    weapon: 'bolt',
    name: 'Heavy Bolt',
    description: 'One big bolt: ×3.5 damage, +2 pierce and a hard push',
    texture: 'icon-mod-heavybolt',
    excludes: ['volley'],
  },
  volley: {
    id: 'volley',
    weapon: 'bolt',
    name: 'Volley',
    description: '+3 bolts in a wide fan, each with 75% damage',
    texture: 'icon-mod-volley',
    excludes: ['heavybolt'],
  },
  ricochet: {
    id: 'ricochet',
    weapon: 'bolt',
    name: 'Ricochet',
    description: 'After its last hit a bolt bounces on to the next enemy, up to two times',
    texture: 'icon-mod-ricochet',
  },
  sparkchain: {
    id: 'sparkchain',
    weapon: 'bolt',
    name: 'Spark Chain',
    description: 'Every hit jumps to a nearby enemy for 50% damage',
    texture: 'icon-mod-sparkchain',
  },
  blasttip: {
    id: 'blasttip',
    weapon: 'bolt',
    name: 'Blast Tip',
    description: 'Bolts explode at their last hit',
    texture: 'icon-mod-blasttip',
  },
  frostbolt: {
    id: 'frostbolt',
    weapon: 'bolt',
    name: 'Frost Bolt',
    description: 'Hits slow enemies by 40% for 1.5 s',
    texture: 'icon-mod-frostbolt',
  },
  whirl: {
    id: 'whirl',
    weapon: 'boomerang',
    name: 'Whirl',
    description: 'Stops at the turn and spins for a moment, hitting again and again',
    texture: 'icon-mod-whirl',
    excludes: ['pull'],
  },
  pull: {
    id: 'pull',
    weapon: 'boomerang',
    name: 'Undertow',
    description: 'On the way back it drags the enemies it hits towards you',
    texture: 'icon-mod-pull',
    excludes: ['whirl'],
  },
  wideblade: {
    id: 'wideblade',
    weapon: 'boomerang',
    name: 'Wide Blade',
    description: '+50% size: a bigger loop and a wider blade',
    texture: 'icon-mod-wideblade',
  },
  orbit: {
    id: 'orbit',
    weapon: 'boomerang',
    name: 'Orbit',
    description: 'Circles you once before you catch it, hitting for 30% damage',
    texture: 'icon-mod-orbit',
  },
  keen: {
    id: 'keen',
    weapon: 'boomerang',
    name: 'Keen Edge',
    description: 'Hits every enemy twice on each way',
    texture: 'icon-mod-keen',
  },
  embertrail: {
    id: 'embertrail',
    weapon: 'boomerang',
    name: 'Ember Trail',
    description: 'Leaves a trail of embers that burn enemies for 1.5 s',
    texture: 'icon-mod-embertrail',
  },
};
