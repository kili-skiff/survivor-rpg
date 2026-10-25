import type { PotionDef, PotionId } from './types';

// Potions are brewed in the village from herbs and drunk during a fight with a button.
export const POTIONS: Record<PotionId, PotionDef> = {
  healing: {
    id: 'healing',
    name: 'Healing Potion',
    short: 'Heal',
    description: 'Restores 40% of your health at once.',
    color: 0xf87171,
    recipe: { moonbloom: 2, mirewort: 1 },
    effect: { healShare: 0.4, durationSec: 0 },
  },
  haste: {
    id: 'haste',
    name: 'Haste Potion',
    short: 'Haste',
    description: 'For 10 s you move 30% faster and weapons and skills recharge 30% faster.',
    color: 0xfacc15,
    recipe: { emberroot: 2, shadowcap: 1 },
    effect: { durationSec: 10, moveSpeedMul: 1.3, cooldownMul: 0.7 },
  },
  ward: {
    id: 'ward',
    name: 'Warding Potion',
    short: 'Ward',
    description: 'For 10 s you take 50% less damage.',
    color: 0x60a5fa,
    recipe: { gravemoss: 2, shadowcap: 1 },
    effect: { durationSec: 10, damageTakenMul: 0.5 },
  },
};

/** Display and belt order */
export const POTION_IDS: readonly PotionId[] = ['healing', 'haste', 'ward'];

export const POTION_RULES = {
  /** Potions you can carry on an expedition */
  beltSize: 3,
  /** Short lockout after drinking a potion so a double tap does not waste a second one (ms) */
  drinkLockoutMs: 600,
} as const;
