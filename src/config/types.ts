// Shared types for all game data. No Phaser imports here!

export type WeaponId = 'bolt' | 'blades' | 'aura';
export type PassiveId = 'vitality' | 'swiftness' | 'might' | 'haste' | 'magnet' | 'regen' | 'armor';
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

export interface EnemyDef {
  id: EnemyId;
  name: string;
  texture: string;
  radius: number;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  /** The enemy can spawn from this second onwards */
  unlockAt: number;
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
}
