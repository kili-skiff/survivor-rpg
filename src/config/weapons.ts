import type { WeaponDef, WeaponId } from './types';

// New weapon = new entry here + its behaviour in GameScene (updateWeapons).
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  bolt: {
    id: 'bolt',
    name: 'Arkanbolzen',
    description: 'Feuert automatisch auf die nächsten Gegner.',
    texture: 'icon-bolt',
    base: { damage: 12, cooldown: 900, count: 1, pierce: 1, speed: 460, area: 1 },
    levels: [
      { text: '+6 Schaden', mods: { damage: 6 } },
      { text: '+1 Bolzen', mods: { count: 1 } },
      { text: 'Schneller (−150 ms)', mods: { cooldown: -150 } },
      { text: '+1 Durchschlag, +6 Schaden', mods: { pierce: 1, damage: 6 } },
      { text: '+1 Bolzen', mods: { count: 1 } },
      { text: '+12 Schaden, +1 Durchschlag', mods: { damage: 12, pierce: 1 } },
    ],
  },
  blades: {
    id: 'blades',
    name: 'Klingenwirbel',
    description: 'Klingen kreisen um dich und treffen alles in ihrer Bahn.',
    texture: 'icon-blades',
    base: { damage: 9, cooldown: 400, count: 2, pierce: 0, speed: 200, area: 1 },
    levels: [
      { text: '+1 Klinge', mods: { count: 1 } },
      { text: '+5 Schaden, größerer Kreis', mods: { damage: 5, area: 0.15 } },
      { text: '+1 Klinge', mods: { count: 1 } },
      { text: 'Dreht schneller', mods: { speed: 60 } },
      { text: '+1 Klinge, +5 Schaden', mods: { count: 1, damage: 5 } },
      { text: '+8 Schaden, größerer Kreis', mods: { damage: 8, area: 0.2 } },
    ],
  },
  aura: {
    id: 'aura',
    name: 'Glutaura',
    description: 'Verbrennt Gegner in deiner Nähe in regelmäßigen Abständen.',
    texture: 'icon-aura',
    base: { damage: 6, cooldown: 700, count: 1, pierce: 0, speed: 0, area: 1 },
    levels: [
      { text: '+20 % Fläche', mods: { area: 0.2 } },
      { text: '+4 Schaden', mods: { damage: 4 } },
      { text: 'Schneller (−120 ms)', mods: { cooldown: -120 } },
      { text: '+20 % Fläche, +3 Schaden', mods: { area: 0.2, damage: 3 } },
      { text: '+6 Schaden', mods: { damage: 6 } },
    ],
  },
};

export const START_WEAPON: WeaponId = 'bolt';
export const MAX_WEAPONS = 4;
/** Base radius of the aura in px (multiplied by area) */
export const AURA_BASE_RADIUS = 70;
/** Base orbit radius of the blades in px */
export const BLADES_BASE_RADIUS = 72;
