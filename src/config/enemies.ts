import type { EnemyDef, EnemyId } from './types';

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  bat: {
    id: 'bat',
    name: 'Bat',
    texture: 'enemy-bat',
    radius: 9,
    hp: 10,
    speed: 105,
    damage: 5,
    xp: 1,
    unlockAt: 0,
    // Erratic flyer: swings wildly from side to side on the way.
    behavior: { kind: 'flutter', sway: 0.9, swayHz: 1.1 },
    weight: 10,
  },
  zombie: {
    id: 'zombie',
    name: 'Zombie',
    texture: 'enemy-zombie',
    sprite: 'zombie',
    radius: 13,
    hp: 28,
    speed: 62,
    damage: 9,
    xp: 2,
    unlockAt: 30,
    // The plain, relentless chaser: slow and straight, so the others stand out next to it.
    behavior: { kind: 'chase' },
    weight: 6,
  },
  ghoul: {
    id: 'ghoul',
    name: 'Ghoul',
    texture: 'enemy-ghoul',
    sprite: 'ghoul',
    radius: 12,
    hp: 22,
    speed: 125,
    damage: 8,
    xp: 3,
    unlockAt: 90,
    // Fast: it cuts in from the side and heads for where the player is going.
    behavior: { kind: 'flank', arcDeg: 38, leadSec: 1.1 },
    weight: 4,
  },
  brute: {
    id: 'brute',
    name: 'Colossus',
    texture: 'enemy-brute',
    sprite: 'brute',
    radius: 22,
    hp: 160,
    speed: 48,
    damage: 18,
    xp: 12,
    unlockAt: 180,
    // For now a plain chaser; a charger with a warning is planned.
    behavior: { kind: 'chase' },
    weight: 1,
  },
};
