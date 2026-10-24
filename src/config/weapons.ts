import type { WeaponDef, WeaponId } from './types';

// New weapon = new entry here + its behaviour in GameScene (updateWeapons).
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  bolt: {
    id: 'bolt',
    name: 'Arcane Bolt',
    description: 'Automatically fires at the nearest enemies.',
    texture: 'icon-bolt',
    base: { damage: 12, cooldown: 900, count: 1, pierce: 1, speed: 460, area: 1 },
    levels: [
      { text: '+6 damage', mods: { damage: 6 } },
      { text: '+1 bolt', mods: { count: 1 } },
      { text: 'Faster (−150 ms)', mods: { cooldown: -150 } },
      { text: '+1 pierce, +6 damage', mods: { pierce: 1, damage: 6 } },
      { text: '+1 bolt', mods: { count: 1 } },
      { text: '+12 damage, +1 pierce', mods: { damage: 12, pierce: 1 } },
    ],
  },
  blades: {
    id: 'blades',
    name: 'Blade Vortex',
    description: 'Blades orbit you and hit everything in their path.',
    texture: 'icon-blades',
    base: { damage: 9, cooldown: 400, count: 2, pierce: 0, speed: 200, area: 1 },
    levels: [
      { text: '+1 blade', mods: { count: 1 } },
      { text: '+5 damage, wider orbit', mods: { damage: 5, area: 0.15 } },
      { text: '+1 blade', mods: { count: 1 } },
      { text: 'Spins faster', mods: { speed: 60 } },
      { text: '+1 blade, +5 damage', mods: { count: 1, damage: 5 } },
      { text: '+8 damage, wider orbit', mods: { damage: 8, area: 0.2 } },
    ],
  },
  aura: {
    id: 'aura',
    name: 'Ember Aura',
    description: 'Burns nearby enemies at a steady interval.',
    texture: 'icon-aura',
    base: { damage: 6, cooldown: 700, count: 1, pierce: 0, speed: 0, area: 1 },
    levels: [
      { text: '+20% area', mods: { area: 0.2 } },
      { text: '+4 damage', mods: { damage: 4 } },
      { text: 'Faster (−120 ms)', mods: { cooldown: -120 } },
      { text: '+20% area, +3 damage', mods: { area: 0.2, damage: 3 } },
      { text: '+6 damage', mods: { damage: 6 } },
    ],
  },
};

export const START_WEAPON: WeaponId = 'bolt';
export const MAX_WEAPONS = 4;
/** Base radius of the aura in px (multiplied by area) */
export const AURA_BASE_RADIUS = 70;
/** Base orbit radius of the blades in px */
export const BLADES_BASE_RADIUS = 72;
