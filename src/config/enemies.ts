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
    // Fast and nearly straight; it flies over the crowd instead of squeezing through it.
    // (Flocks that sweep from side to side come with the wave system.)
    behavior: { kind: 'flutter', sway: 0.2, swayHz: 0.7 },
    flies: true,
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
    // Fast pouncer: runs up, crouches (circle on the ground), leaps there in an arc, lands stunned.
    behavior: {
      kind: 'charge',
      range: 250,
      windupSec: 0.55,
      leapSec: 0.55,
      height: 46,
      landRadius: 34,
      restSec: 0.9,
    },
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
