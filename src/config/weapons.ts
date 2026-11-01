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
      damage: 7,
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
      { text: '+4 damage, wider orbit', mods: { damage: 4, area: 0.15 } },
      { text: 'Blades rend: each hit also takes 2% of health', mods: { percent: 0.02 } },
      { text: '+1 blade', mods: { count: 1 } },
      { text: 'Spins faster', mods: { speed: 60 } },
      { text: 'Hits throw enemies back harder', mods: { knockback: 90 } },
      { text: '+1 blade, +4 damage', mods: { count: 1, damage: 4 } },
      {
        text: '+6 damage, wider orbit, +1% of health per hit',
        mods: { damage: 6, area: 0.2, percent: 0.01 },
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
      damage: 5,
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
      { text: '+3 damage', mods: { damage: 3 } },
      { text: 'Burns: each pulse also takes 2% of health', mods: { percent: 0.02 } },
      { text: 'Faster (−120 ms)', mods: { cooldown: -120 } },
      { text: '+20% area, +3 damage', mods: { area: 0.2, damage: 3 } },
      { text: 'Stronger push, +1% of health per pulse', mods: { knockback: 100, percent: 0.01 } },
      { text: '+5 damage', mods: { damage: 5 } },
    ],
  },
  chain: {
    id: 'chain',
    name: 'Chain Lightning',
    description: 'Lightning strikes an enemy and jumps on to the ones around it.',
    texture: 'icon-chain',
    rarity: 'magic',
    base: {
      damage: 8,
      cooldown: 1300,
      count: 1,
      pierce: 0,
      speed: 0,
      area: 1,
      knockback: 0,
      splash: 0,
      percent: 0,
      chains: 2,
      seek: 0,
    },
    levels: [
      { text: 'Jumps one more time', mods: { chains: 1 } },
      { text: '+3 damage', mods: { damage: 3 } },
      { text: '+1 strike at a different enemy', mods: { count: 1 } },
      { text: 'Faster (−200 ms)', mods: { cooldown: -200 } },
      { text: 'Seeks out the biggest crowd, +1 jump', mods: { seek: 1, chains: 1 } },
      { text: '+4 damage, each hit takes 1% of health', mods: { damage: 4, percent: 0.01 } },
      { text: '+1 strike at a different enemy', mods: { count: 1 } },
      { text: '+5 damage, +2 jumps', mods: { damage: 5, chains: 2 } },
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
      speed: 420,
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
/**
 * While the main weapon still has level steps to take, one of the level-up cards is always for it: among
 * some 30 possible cards it would come too rarely, and the main weapon carries the build.
 */
export const MAIN_WEAPON_CARD_GUARANTEED = true;
export const MAX_WEAPONS = 4;
/** Base radius of the aura in px (multiplied by area) */
export const AURA_BASE_RADIUS = 70;
/** How far a boomerang flies out (px, times the area) and its hit reach (added to the enemy radius) */
export const BOOMERANG_RANGE = 185;
export const BOOMERANG_REACH = 16;
/** The boomerang's loop: how far it bends to the side (share of its range) and how much the throw turns against the bend (radians) */
export const BOOMERANG_CURVE = { width: 0.38, aimTilt: 0.35 };
/** Base orbit radius of the blades in px */
export const BLADES_BASE_RADIUS = 72;
