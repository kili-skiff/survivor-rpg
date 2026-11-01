import type { WeaponDef, WeaponId } from './types';

// Level steps come in a random order (logic/upgrades.ts), so write each text so it reads on its own.
// New weapon = new entry here + its class in systems/weapons/ (registered in systems/weapons/index.ts).
// `knockback`, `splash` and `percent` are the tools against a crowd that piles up (logic/hitEffects.ts):
// they start at 0 and come in through level steps, so they show up as normal level-up cards.
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  bolt: {
    id: 'bolt',
    name: 'Arcane Bolt',
    description: 'Automatically fires at the nearest enemies.',
    texture: 'icon-bolt',
    rarity: 'common',
    base: {
      damage: 12,
      cooldown: 900,
      count: 1,
      pierce: 1,
      speed: 460,
      area: 1,
      knockback: 0,
      splash: 0,
      percent: 0,
      chains: 0,
      seek: 0,
    },
    levels: [
      { text: 'Bolts burst on impact and hurt the enemies around', mods: { splash: 48 } },
      { text: '+6 damage', mods: { damage: 6 } },
      { text: '+1 bolt', mods: { count: 1 } },
      { text: '+1 pierce, +6 damage', mods: { pierce: 1, damage: 6 } },
      { text: 'Faster (−150 ms)', mods: { cooldown: -150 } },
      { text: 'Bolts push enemies back', mods: { knockback: 140 } },
      { text: '+1 bolt', mods: { count: 1 } },
      { text: '+6 damage, bursts 28 px wider', mods: { splash: 28, damage: 6 } },
      { text: '+12 damage, +1 pierce', mods: { damage: 12, pierce: 1 } },
    ],
  },
  blades: {
    id: 'blades',
    name: 'Blade Vortex',
    description: 'Blades orbit you and hit everything in their path.',
    texture: 'icon-blades',
    rarity: 'common',
    base: {
      damage: 9,
      cooldown: 400,
      count: 2,
      pierce: 0,
      speed: 200,
      area: 1,
      knockback: 70,
      splash: 0,
      percent: 0,
      chains: 0,
      seek: 0,
    },
    levels: [
      { text: '+1 blade', mods: { count: 1 } },
      { text: '+5 damage, wider orbit', mods: { damage: 5, area: 0.15 } },
      { text: 'Blades rend: each hit also takes 2% of health', mods: { percent: 0.02 } },
      { text: '+1 blade', mods: { count: 1 } },
      { text: 'Spins faster', mods: { speed: 60 } },
      { text: 'Hits throw enemies back harder', mods: { knockback: 90 } },
      { text: '+1 blade, +5 damage', mods: { count: 1, damage: 5 } },
      {
        text: '+8 damage, wider orbit, +1% of health per hit',
        mods: { damage: 8, area: 0.2, percent: 0.01 },
      },
    ],
  },
  aura: {
    id: 'aura',
    name: 'Ember Aura',
    description: 'Burns nearby enemies at a steady interval.',
    texture: 'icon-aura',
    rarity: 'common',
    base: {
      damage: 6,
      cooldown: 700,
      count: 1,
      pierce: 0,
      speed: 0,
      area: 1,
      knockback: 0,
      splash: 0,
      percent: 0,
      chains: 0,
      seek: 0,
    },
    levels: [
      { text: '+20% area', mods: { area: 0.2 } },
      { text: 'Every pulse pushes enemies back', mods: { knockback: 170 } },
      { text: '+4 damage', mods: { damage: 4 } },
      { text: 'Burns: each pulse also takes 2% of health', mods: { percent: 0.02 } },
      { text: 'Faster (−120 ms)', mods: { cooldown: -120 } },
      { text: '+20% area, +3 damage', mods: { area: 0.2, damage: 3 } },
      { text: 'Stronger push, +1% of health per pulse', mods: { knockback: 100, percent: 0.01 } },
      { text: '+6 damage', mods: { damage: 6 } },
    ],
  },
  chain: {
    id: 'chain',
    name: 'Chain Lightning',
    description: 'Lightning strikes an enemy and jumps on to the ones around it.',
    texture: 'icon-chain',
    rarity: 'magic',
    base: {
      damage: 14,
      cooldown: 1300,
      count: 1,
      pierce: 0,
      speed: 0,
      area: 1,
      knockback: 0,
      splash: 0,
      percent: 0,
      chains: 3,
      seek: 0,
    },
    levels: [
      { text: 'Jumps one more time', mods: { chains: 1 } },
      { text: '+6 damage', mods: { damage: 6 } },
      { text: '+1 strike at a different enemy', mods: { count: 1 } },
      { text: 'Faster (−200 ms)', mods: { cooldown: -200 } },
      { text: 'Seeks out the biggest crowd, +2 jumps', mods: { seek: 1, chains: 2 } },
      { text: '+8 damage, each hit takes 1% of health', mods: { damage: 8, percent: 0.01 } },
      { text: '+1 strike at a different enemy', mods: { count: 1 } },
      { text: '+10 damage, +3 jumps', mods: { damage: 10, chains: 3 } },
    ],
  },
  boomerang: {
    id: 'boomerang',
    name: 'Boomerang',
    description: 'Flies out to the nearest enemy and back, hitting everything on both ways.',
    texture: 'icon-boomerang',
    rarity: 'common',
    base: {
      damage: 16,
      cooldown: 1300,
      count: 1,
      pierce: 0,
      speed: 380,
      area: 1,
      knockback: 60,
      splash: 0,
      percent: 0,
      chains: 0,
      seek: 0,
    },
    levels: [
      { text: '+1 boomerang', mods: { count: 1 } },
      { text: '+6 damage', mods: { damage: 6 } },
      { text: 'Flies further and hits wider (+20%)', mods: { area: 0.2 } },
      { text: 'Faster (−250 ms)', mods: { cooldown: -250 } },
      { text: 'Hits throw enemies back harder', mods: { knockback: 90 } },
      { text: '+1 boomerang', mods: { count: 1 } },
      { text: '+8 damage, each hit takes 1% of health', mods: { damage: 8, percent: 0.01 } },
      { text: 'Flies faster, +6 damage', mods: { speed: 90, damage: 6 } },
    ],
  },
};

/**
 * Main weapons: the auto attack you choose in the village (the armory) before an expedition. They carry
 * the build; the other weapons come from cards as extras. A main weapon is never offered as a new weapon
 * on a card, only its level steps.
 */
export const MAIN_WEAPONS: readonly WeaponId[] = ['bolt', 'boomerang'];
export const START_WEAPON: WeaponId = 'bolt';
export const MAX_WEAPONS = 4;
/** Base radius of the aura in px (multiplied by area) */
export const AURA_BASE_RADIUS = 70;
/** How far a boomerang flies out (px, times the area) and its hit reach (added to the enemy radius) */
export const BOOMERANG_RANGE = 230;
export const BOOMERANG_REACH = 16;
/** Base orbit radius of the blades in px */
export const BLADES_BASE_RADIUS = 72;
