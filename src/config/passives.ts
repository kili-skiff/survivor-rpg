import type { PassiveDef, PassiveId, PlayerStats } from './types';

export const BASE_PLAYER_STATS: PlayerStats = {
  maxHp: 100,
  moveSpeed: 165,
  might: 1,
  haste: 1,
  magnet: 70,
  regen: 0,
  armor: 0,
};

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  vitality: {
    id: 'vitality',
    name: 'Lebenskraft',
    description: '+20 maximale Lebenspunkte',
    texture: 'icon-vitality',
    maxLevel: 5,
    perLevel: { maxHp: 20 },
  },
  swiftness: {
    id: 'swiftness',
    name: 'Flinke Stiefel',
    description: '+10 % Lauftempo',
    texture: 'icon-swiftness',
    maxLevel: 5,
    perLevel: { moveSpeed: 16 },
  },
  might: {
    id: 'might',
    name: 'Macht',
    description: '+10 % Schaden',
    texture: 'icon-might',
    maxLevel: 5,
    perLevel: { might: 0.1 },
  },
  haste: {
    id: 'haste',
    name: 'Eile',
    description: '−8 % Abklingzeiten',
    texture: 'icon-haste',
    maxLevel: 5,
    perLevel: { haste: -0.08 },
  },
  magnet: {
    id: 'magnet',
    name: 'Magnet',
    description: '+35 % Sammelradius',
    texture: 'icon-magnet',
    maxLevel: 4,
    perLevel: { magnet: 25 },
  },
  regen: {
    id: 'regen',
    name: 'Regeneration',
    description: '+0,5 Lebenspunkte pro Sekunde',
    texture: 'icon-regen',
    maxLevel: 5,
    perLevel: { regen: 0.5 },
  },
  armor: {
    id: 'armor',
    name: 'Rüstung',
    description: '−1 Schaden pro Treffer',
    texture: 'icon-armor',
    maxLevel: 5,
    perLevel: { armor: 1 },
  },
};

export const MAX_PASSIVES = 5;
