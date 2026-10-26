// Shared types for all game data. No Phaser imports here!

import type { CharacterSpriteId } from './sprites';

export type WeaponId = 'bolt' | 'blades' | 'aura';
export type PassiveId =
  'vitality' | 'swiftness' | 'might' | 'haste' | 'magnet' | 'regen' | 'armor' | 'lantern';
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
  base: WeaponStats;
  /** Level 2, 3, … (level 1 = base) */
  levels: LevelStep<WeaponStats>[];
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  /** Text per level */
  description: string;
  texture: string;
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
   * there in an arc and is stunned for a moment. The landing spot is fixed when the warning starts, so
   * it can be dodged. It cannot be hit in the air and hurts only where it lands.
   */
  | {
      kind: 'charge';
      /** Starts the warning when the player is this close (px); also the longest leap */
      range: number;
      /** How long the warning (the crouch) lasts (s) */
      windupSec: number;
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
  /** How it moves toward the player (default: chase) */
  behavior?: EnemyBehavior;
  /** Flies over the others: never pushed by them, never pushes them, and drawn above them */
  flies?: boolean;
  /** Relative spawn weight */
  weight: number;
}

/** One hex segment of an expedition. For now there is only a single default segment. */
export interface SegmentDef {
  id: string;
  name: string;
  /** Survive this long to clear the segment (seconds) */
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
