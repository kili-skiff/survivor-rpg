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
