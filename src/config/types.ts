// Shared types for all game data. No Phaser imports here!

import type { CharacterSpriteId } from './sprites';

export type WeaponId = 'bolt' | 'blades' | 'aura' | 'chain';
/** How rare a card is: decides how often it is offered and the colour of its frame (config/rarity.ts) */
export type Rarity = 'common' | 'magic' | 'legendary';

export type PassiveId =
  | 'vitality'
  | 'swiftness'
  | 'might'
  | 'haste'
  | 'magnet'
  | 'regen'
  | 'armor'
  | 'lantern'
  | 'reach'
  | 'force'
  | 'rend'
  | 'wisdom'
  | 'bloodthirst'
  | 'fortune'
  | 'twin'
  | 'keenedge'
  | 'deadlyaim'
  | 'executioner'
  | 'hunter'
  | 'quickhands'
  | 'momentum'
  | 'emberheart'
  | 'thorns'
  | 'shadowstep'
  | 'piercing'
  | 'volatile'
  | 'bloodpact';
/** One-time effects offered on level-up cards (config/boons.ts) */
export type BoonId = 'cache' | 'gemstorm' | 'feast' | 'novaburst' | 'judgement' | 'secondwind' | 'embers';
export type SkillId = 'dash' | 'nova';
export type EnemyId = 'bat' | 'zombie' | 'ghoul' | 'brute';

/** Player stats, computed from base values + passive items. */
export interface PlayerStats {
  maxHp: number;
  /** Pixels per second */
  moveSpeed: number;
  /** Damage multiplier (1 = 100 %) */
  might: number;
  /** Cooldown multiplier (lower = faster) */
  haste: number;
  /** Radius within which XP is pulled in */
  magnet: number;
  /** Health per second */
  regen: number;
  /** Subtracted from each incoming hit */
  armor: number;
  /** Light radius multiplier in fights (1 = base lantern) */
  light: number;
  // The stats below come from items (config/passives.ts); the base value changes nothing.
  /** Area multiplier of all weapons and of Frost Nova (1 = as is) */
  area: number;
  /** Push added to every weapon hit (px/s) */
  force: number;
  /** Extra damage per hit as a share of the target's maximum health, on top of the weapon's own */
  rend: number;
  /** Multiplies the XP of every gem */
  xpGain: number;
  /** Health restored per kill */
  bloodthirst: number;
  /** Raises the chance that an enemy leaves a treasure chest (0.5 = half again as often) */
  fortune: number;
  /** Extra projectiles, blades and strikes for every weapon */
  multishot: number;
  /** Extra pierce for every piercing weapon */
  pierce: number;
  /** Radius (px) of a burst that every weapon hit adds around the target */
  blast: number;
  /** Chance (0..1) that a hit is a critical hit */
  crit: number;
  /** Damage multiplier of a critical hit */
  critMul: number;
  /** Hits finish off enemies below this share of their maximum health (elites: a quarter of it) */
  execute: number;
  /** Damage multiplier against elites */
  eliteMul: number;
  /** Cooldown multiplier of Dash and Frost Nova on top of `haste` (lower = faster) */
  skillHaste: number;
  /** Damage bonus while moving (0.2 = +20%) */
  momentum: number;
  /** Damage bonus that grows as health drops: at no health it is this much (1 = +100%) */
  desperation: number;
  /** Damage dealt back to every enemy that hurts you */
  thorns: number;
  /** Chance (0..1) to shrug off a hit completely */
  dodge: number;
  /** Enemies get this much more health (0.2 = +20%) */
  curse: number;
}

export interface WeaponStats {
  damage: number;
  /** Milliseconds */
  cooldown: number;
  count: number;
  pierce: number;
  /** Projectile speed (bolt) or rotation speed in deg/s (blades) */
  speed: number;
  /** Area multiplier */
  area: number;
  /** Chain Lightning: how often the strike jumps on to another enemy */
  chains: number;
  /** Chain Lightning: 1 = the first target is the one in the biggest crowd, 0 = the nearest */
  seek: number;
  /** Push on every hit (px/s, 0 = none): spreads a crowd out and buys time; heavy enemies resist */
  knockback: number;
  /** Radius (px, before `area`) of the burst around a hit enemy that damages its neighbours (0 = none) */
  splash: number;
  /** Extra damage per hit as a share of the enemy's maximum health (0 = none): keeps up with tougher enemies */
  percent: number;
}

export interface LevelStep<T> {
  /** Short text for the level-up card */
  text: string;
  /** Added on top of the previous values */
  mods: Partial<T>;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  description: string;
  texture: string;
  rarity: Rarity;
  base: WeaponStats;
  /** Level 2, 3, … (level 1 = base) */
  levels: LevelStep<WeaponStats>[];
}

export interface BoonDef {
  id: BoonId;
  name: string;
  description: string;
  texture: string;
  rarity: Rarity;
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  /** Text per level */
  description: string;
  texture: string;
  rarity: Rarity;
  maxLevel: number;
  perLevel: Partial<PlayerStats>;
}

export interface SkillStats {
  /** Milliseconds */
  cooldown: number;
  damage: number;
  radius: number;
  /** Milliseconds (dash duration or slow duration) */
  duration: number;
  /** 0..1, how strongly enemies are slowed */
  slow: number;
}

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  texture: string;
  rarity: Rarity;
  base: SkillStats;
  levels: LevelStep<SkillStats>[];
}

/** How an enemy moves toward the player. The movement itself lives in logic/behaviors.ts and logic/swarm.ts. */
export type EnemyBehavior =
  /** Straight at the player (the default) */
  | { kind: 'chase' }
  /** Comes in an arc from one side (chosen per enemy) and aims where the player is going, not where they are */
  | {
      kind: 'flank';
      /** How far the course bends away from a straight line while far away (degrees); it straightens out when close */
      arcDeg: number;
      /** Aims at where the player will be in this many seconds at most (less when close) */
      leadSec: number;
    }
  /** Swings left and right on the way (a small share of its speed; the usual drift is smaller still) */
  | {
      kind: 'flutter';
      /** Sideways swing as a share of its speed */
      sway: number;
      /** Swings per second */
      swayHz: number;
    }
  /**
   * Runs up, crouches (the warning, with a circle on the ground where it will land), then leaps
   * there in an arc and is stunned for a moment. The circle follows the player and freezes shortly before
   * the jump, so it can be dodged by changing direction at the last moment. It cannot be hit in the air and hurts only where it lands.
   */
  | {
      kind: 'charge';
      /** Starts the warning when the player is this close (px); also the longest leap */
      range: number;
      /** How long the warning (the crouch) lasts (s) */
      windupSec: number;
      /** The circle follows the player during the warning, but stands still for the last this many seconds (s) */
      lockSec: number;
      /** How long the leap lasts (s) */
      leapSec: number;
      /** Height of the arc at its peak (px) */
      height: number;
      /** Hurts the player if they stand within this radius of the landing spot (px) */
      landRadius: number;
      /** How long it is slow after landing (s) */
      restSec: number;
    };

export interface EnemyDef {
  id: EnemyId;
  name: string;
  /** Placeholder texture, used when the enemy has no sprite or its sheet could not be loaded */
  texture: string;
  /** Animated sprite (config/sprites.ts) */
  sprite?: CharacterSpriteId;
  radius: number;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  /** The enemy can spawn from this second onwards */
  unlockAt: number;
  /** The enemy only appears in hexes of this ring or further out (default 1: everywhere) */
  minRing?: number;
  /** Share of every push it shrugs off (0..1, default 0): big ones hardly move */
  knockResist?: number;
  /** How it moves toward the player (default: chase) */
  behavior?: EnemyBehavior;
  /** Flies over the others: never pushed by them, never pushes them, and drawn above them */
  flies?: boolean;
  /** Relative spawn weight */
  weight: number;
}

/** One hex segment of an expedition. For now there is only a single default segment. */
/** What a fight asks of the player (config/goals.ts, logic/goals.ts). */
export type FightGoal = { kind: 'survive'; durationSec: number } | { kind: 'hunt'; kills: number };
export type GoalKind = FightGoal['kind'];

export interface SegmentDef {
  id: string;
  name: string;
  /** What clears the fight */
  goal: FightGoal;
  /** How long the fight is meant to last (seconds): the time to survive, and what herbs are planned for */
  durationSec: number;
  /** The countdown turns into a warning colour for the last N seconds */
  warningSec: number;
  /** Added to the run time when choosing enemies and difficulty (seconds) */
  difficultyOffsetSec: number;
  /** Tint for the placeholder ground, used when the biome has no ground tile */
  groundTint: number;
  /** Biome of the hex: picks the ground tile; missing for segments outside the map */
  biome?: BiomeId;
  /** Where herbs grow in this segment; null for segments without herbs */
  herbs: { biome: BiomeId; ring: number } | null;
}

export type BiomeId = 'meadow' | 'forest' | 'swamp' | 'graveyard' | 'hills';
export type PoiId = 'village' | 'camp' | 'merchant' | 'dungeon' | 'tower' | 'watchfire';

export interface BiomeDef {
  id: BiomeId;
  name: string;
  /** Hex colour on the world map */
  color: number;
  /** Ground colour while fighting in this biome (tints the neutral ground texture) */
  groundTint: number;
}

export interface PoiDef {
  id: PoiId;
  name: string;
  /** Short marker shown on the map until real icons exist */
  glyph: string;
  /** Earliest ring where this point of interest can appear */
  minRing: number;
  /** Chance per hex (0..1), before spacing rules remove some */
  chance: number;
  /** Minimum distance to another point of interest of the same kind (in hexes) */
  minSpacing: number;
}

export type HerbId = 'moonbloom' | 'shadowcap' | 'mirewort' | 'gravemoss' | 'emberroot' | 'starlily';

export interface HerbDef {
  id: HerbId;
  name: string;
  /** Biome where this herb grows; null for rare herbs that can grow anywhere */
  biome: BiomeId | null;
  rare: boolean;
  /** Tint of the herb sprite */
  color: number;
}

export type PotionId = 'healing' | 'haste' | 'ward';

/** What drinking a potion does. Buff multipliers apply for `durationSec`. */
export interface PotionEffect {
  /** Share of max health restored at once (0..1) */
  healShare?: number;
  /** How long the buff lasts (seconds); 0 for instant potions */
  durationSec: number;
  /** Multiplies move speed while active */
  moveSpeedMul?: number;
  /** Multiplies weapon and skill cooldowns while active (lower = faster) */
  cooldownMul?: number;
  /** Multiplies incoming damage while active (lower = less damage) */
  damageTakenMul?: number;
}

export interface PotionDef {
  id: PotionId;
  name: string;
  /** Short name for small buttons */
  short: string;
  description: string;
  /** Tint of the potion sprite */
  color: number;
  /** Herbs used up to brew one potion */
  recipe: Partial<Record<HerbId, number>>;
  effect: PotionEffect;
}
