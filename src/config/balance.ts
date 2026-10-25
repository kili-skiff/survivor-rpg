// Global balancing knobs in one place.
export const BALANCE = {
  /** Invulnerability after taking a hit (ms) */
  hurtInvulnMs: 450,
  /** Range within which bolts target enemies (px) */
  boltRange: 520,
  /** Bolt lifetime (ms) */
  boltLifetimeMs: 1600,
  /** Chance that a defeated enemy drops a heal */
  healDropChance: 0.012,
  healAmount: 25,
  /** Maximum number of XP gems at once */
  maxGems: 450,
  /**
   * Share of the expedition loot you keep when you die (0..1). Nothing: all you carry is lost.
   * Potions in the belt stay (and later the equipment you wear).
   */
  lootKeptOnDeath: 0,
  /** Hard cap on simultaneous enemies (performance) */
  maxEnemiesHardCap: 320,
} as const;

/** Further rings are harder: enemies get more health and damage and come in denser waves. */
export const RINGS = {
  /** Enemy health +30% per ring beyond the first */
  hpPerRing: 0.3,
  /** Enemy damage +12% per ring beyond the first */
  damagePerRing: 0.12,
  /** Waves come 8% more often per ring beyond the first */
  spawnRatePerRing: 0.08,
} as const;

/** Elite enemies: rare, big and tough, with a golden shimmer; they always leave a treasure chest. */
export const ELITE = {
  /** Elites appear from this ring on */
  minRing: 2,
  /** Chance per spawned enemy: this much per ring, up to `maxChance` */
  chancePerRing: 0.004,
  maxChance: 0.03,
  hp: 8,
  damage: 1.5,
  xp: 5,
  scale: 1.6,
  tint: 0xffcf6b,
  eyesColor: 0xfacc15,
} as const;

/** Treasure chests from elites: rewards are rolled like a slot machine. */
export const CHEST = {
  /** Chance that a killed enemy leaves a chest: rare for anyone, likely for elites */
  dropChance: 0.003,
  eliteDropChance: 0.5,
  /** Chance for 5 upgrades at once, else for 3, else 1 */
  fiveChance: 0.05,
  threeChance: 0.25,
  /** Gold: this many normal drops (random in the range) */
  goldMin: 2,
  goldMax: 5,
} as const;

/**
 * Light in fights. For now it is only atmosphere: darkness around a light circle; enemies outside
 * it are dimmed but still visible. A better lantern could raise `radius` later.
 */
export const LIGHT = {
  /** Radius of the player's light (px, world units). Small at first, so a better lantern matters. */
  radius: 190,
  /** How dark it is outside any light (0..1) */
  darkness: 0.93,
  /** Strength of torch and herb glows (additive, 0..1) */
  glowStrength: 0.35,
  /** Darkness colour: a cold night blue */
  color: 0x05040e,
  /** Light radius flickers by this share */
  flicker: 0.035,
  /** Torches stand on a grid of cells this big; each cell may hold one */
  torchCell: 640,
  /** Share of cells with a torch */
  torchChance: 0.12,
  torchRadius: 95,
  /** Torch glows are kept soft so they do not draw too much attention */
  torchGlow: 0.17,
  torchColor: 0xffc896,
  /** Bloomed herbs give off a faint light so they are easier to spot in the dark */
  herbRadius: 40,
  rareHerbRadius: 55,
  /** Herb glows are subtle and pulse slowly between these strengths */
  herbGlowMin: 0.06,
  herbGlowMax: 0.18,
  /** Dropped treasure chests glow golden, so they can be found in the dark */
  chestRadius: 90,
  chestColor: 0xfbbf24,
  /** XP gems in the dark glimmer faintly (alpha at full darkness) */
  gemGlimmer: 0.3,
  /** Enemies in the dark show only their glowing eyes, so you see danger coming */
  eyesColor: 0xff5a3c,
} as const;

/** The lantern the watchman carries: a small pendulum on a chain, purely visual. */
export const LANTERN = {
  /** How far the lantern hangs below the hand when everything is still (px) */
  drop: 12,
  /** Spring pulling it back to its resting spot (higher = faster swing) */
  stiffness: 130,
  /** Friction of the swing (higher = settles sooner) */
  damping: 6.5,
  /** Up and down the view is foreshortened: the lantern swings less and settles faster that way */
  verticalInertia: 0.4,
  verticalDamping: 11,
  verticalLean: 0.5,
  /** How strongly a push of the hand (acceleration) throws the lantern */
  inertia: 0.75,
  /** While running, the lantern trails behind by speed times this (px per px/s) */
  lean: 0.045,
  /** ...but never further than this (px) */
  leanMax: 11,
  /** The lantern never swings further than this from its hanging spot (px) */
  maxSwing: 20,
  /** Longest physics step; longer frames are split (s) */
  maxStep: 1 / 120,
  /** The hand holds the lantern this far to the side and below the sprite centre (px) */
  handX: 10,
  handY: 4,
  /** How fast the hand moves to the other side when turning (1/s) */
  handFollow: 14,
  /** Light of the flame itself (additive glow on top of the darkness hole) */
  glowRadius: 26,
  glowStrength: 0.3,
} as const;
