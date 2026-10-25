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
  /** Share of the expedition loot you keep when you die (0..1) */
  lootKeptOnDeath: 0.5,
  /** Hard cap on simultaneous enemies (performance) */
  maxEnemiesHardCap: 320,
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
  herbRadius: 70,
  rareHerbRadius: 100,
  /** Enemies in the dark show only their glowing eyes, so you see danger coming */
  eyesColor: 0xff5a3c,
} as const;
