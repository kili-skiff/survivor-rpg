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
  /**
   * All enemies walk this share of the speed in their config (config/enemies.ts); one knob for the pace of
   * the whole horde. Leaps of pouncers are timed and not affected.
   */
  enemySpeed: 0.65,
} as const;

/** Further rings are harder: enemies get more health and damage and come in denser waves. */
export const RINGS = {
  /**
   * Per ring (index 0 = ring 1): enemy health, enemy damage and how many enemies come (see SPAWN), each a
   * multiplier. Rings 1–2 stay easy; from ring 3 on enemies get tougher and hit harder, while the crowd
   * grows evenly. Beyond the last ring the last step repeats.
   */
  table: [
    { hp: 1.0, damage: 1.0, spawnRate: 1.0 },
    { hp: 1.2, damage: 1.05, spawnRate: 1.1 },
    { hp: 1.6, damage: 1.3, spawnRate: 1.4 },
    { hp: 2.1, damage: 1.5, spawnRate: 1.6 },
    { hp: 2.7, damage: 1.65, spawnRate: 1.8 },
    { hp: 3.5, damage: 1.85, spawnRate: 2.0 },
    { hp: 4.6, damage: 2.1, spawnRate: 2.25 },
    { hp: 6.0, damage: 2.4, spawnRate: 2.5 },
  ],
} as const;

/**
 * How many enemies come (logic/spawning.ts): a smooth curve without jumps. Per second
 * `baseRate` x the ring's `spawnRate` x (1 + fight time / `growthSec`); the spawn director shapes this
 * into build-ups, surges and breathers. At most `capBase` + `capPerRing` per ring beyond the first +
 * `capPerSec` per second of the fight are alive at once. Only the time of this fight counts, not the
 * ring's difficulty offset (that only decides which enemy types come).
 */
export const SPAWN = {
  baseRate: 0.9,
  growthSec: 120,
  capBase: 30,
  capPerRing: 12,
  capPerSec: 0.8,
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

/** Tools against a crowd that piles up: knockback, bursts and damage as a share of health (logic/hitEffects.ts). */
export const HIT_EFFECTS = {
  /** A burst around a hit enemy does this share of the hit's damage to its neighbours */
  splashShare: 0.6,
  /** Elites take only this share of damage that is a share of health (else they would melt) */
  percentVsElite: 0.25,
  /** Elites shrug off this share of every push, on top of their type's own resistance */
  eliteKnockResist: 0.6,
  /** A push slows down: its speed is multiplied by exp(-this * seconds) */
  pushDecay: 7,
  /** No push is faster than this (px/s), however many hits land at once */
  pushMax: 520,
  /** Pushes slower than this stop at once (px/s) */
  pushStop: 8,
  /** How long a burst ring is shown (ms) */
  burstFxMs: 260,
} as const;

/** Arcane Bolt's focus fire (logic/focus.ts). */
export const BOLT_FOCUS = {
  /** An enemy this close to the player (px, to its edge) pulls the bolt away from a target further off */
  dangerRadius: 90,
} as const;

/** Chain Lightning (systems/weapons/ChainWeapon.ts, logic/chain.ts). Distances in px, times in ms. */
export const CHAIN = {
  /** How far from the player a strike may start */
  range: 340,
  /** How far a strike jumps on from one enemy to the next (times the weapon's area) */
  jumpRange: 150,
  /** Each jump deals this share of the damage of the one before */
  falloff: 0.92,
  /** Radius in which "seek" counts the neighbours of a possible target */
  crowdRadius: 110,
  /** How long a bolt of lightning stays visible */
  fxMs: 240,
} as const;

/** Item effects that need a number of their own (config/passives.ts holds the per-level values). */
export const ITEMS = {
  /** The most that dodge, crit chance and the like can reach */
  maxDodge: 0.75,
  maxCrit: 1,
  /** Skill cooldowns never drop below this share of their base through items */
  minSkillHaste: 0.25,
  /** Executioner: elites are finished off at this share of the threshold */
  executeVsElite: 0.25,
} as const;

/** One-time cards (config/boons.ts). */
export const BOONS = {
  /** Hidden Cache: embers in normal drops (see embersPerDrop) */
  cacheDrops: 12,
  /** Shockwave: radius, damage, share of health and push */
  shockRadius: 420,
  shockDamage: 90,
  shockPercent: 0.2,
  shockPush: 520,
  /** Judgement: elites lose this share of their current health; everybody else on screen dies */
  judgementRadius: 520,
  judgementElite: 0.4,
  /** Second Wind: health restored on the revive (share of maximum), then this long without damage (ms) */
  windHeal: 0.5,
  windProtectMs: 2500,
  /** Ember Surge: damage bonus and how long it lasts (ms) */
  surgeBonus: 0.5,
  surgeMs: 45000,
} as const;

/** At most this many chargers are in their warning or dash at the same time; the others wait. */
export const MAX_CHARGERS_AT_ONCE = 2;
/** Global cooldown (ms): after any charger starts its warning, none of them may start another for this long. */
export const CHARGE_COOLDOWN_MS = 3000;
/** A charger hesitates a random time up to this (ms) once the player is in range. */
export const CHARGE_MAX_DELAY_MS = 1500;

/**
 * How the horde moves, so it stays a loose crowd instead of one blob (logic/swarm.ts).
 * First tuning, still to be finetuned: in tight crowds enemies can look as if they shove each other.
 * Distances are px, times are ms.
 */
export const SWARM = {
  /** Size of the grid cells used to find neighbours. Personal space of the biggest pairs should fit in 3x3 cells. */
  cell: 72,
  /** Bodies counted per cell; further ones still feel the push, but do not push back */
  maxPerCell: 8,
  /** Soft personal space: enemies closer than this (times the sum of both radii) push each other away */
  personalSpace: 1.9,
  /** How hard that push bends the course (1 = as strong as the pull toward the player) */
  separation: 1.3,
  /** Share of the push that is left right next to the player, so a crowd can still close in to bite */
  separationNear: 0.4,
  /** Between these distances to the player the push grows from `separationNear` to full strength */
  closeInStart: 50,
  closeInEnd: 220,
  /** Sideways drift as a share of speed, fading out close to the player */
  wobble: 0.35,
  /** How fast the drift swings left and right (cycles per second) */
  wobbleHz: 0.4,
  /** Far away, an enemy aims at where the player was a moment ago; this long until it looks again */
  aimLagMin: 150,
  aimLagMax: 450,
  /** Each enemy's speed varies by this share around its type's speed */
  speedJitter: 0.25,
  /** Bodies may overlap this much (share of the sum of both radii) before they are pushed apart */
  bodyOverlap: 0.9,
  /** Each enemy sways and steps at its own pace: this share faster or slower than its type */
  rhythmJitter: 0.3,
} as const;

/** Treasure chests from elites: rewards are rolled like a slot machine. */
export const CHEST = {
  /** Chance that a killed enemy leaves a chest: rare for anyone, likely for elites */
  dropChance: 0.003,
  eliteDropChance: 0.5,
  /** Chance for 5 upgrades at once, else for 3, else 1 */
  fiveChance: 0.05,
  threeChance: 0.25,
  /** Embers: this many normal drops (random in the range) */
  embersMin: 2,
  embersMax: 5,
} as const;

/**
 * Light in fights. For now it is only atmosphere: darkness around a light circle; enemies outside
 * it are dimmed but still visible. A better lantern could raise `radius` later.
 */
export const LIGHT = {
  /** Enemies show their eyes up to this share of the light radius; weapons only aim that far */
  visionReach: 1.15,
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
  glowRadius: 7,
  glowStrength: 0.25,
} as const;
