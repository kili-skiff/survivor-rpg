import { BOONS } from './balance';
import type { BoonDef, BoonId } from './types';

// One-time cards: they act at once when picked and do not take a place in the build.
// New boon = entry here + a case in GameScene.applyBoon + an icon in BootScene.
export const BOON_DEFS: Record<BoonId, BoonDef> = {
  cache: {
    id: 'cache',
    name: 'Hidden Cache',
    description: 'A purse of gold.',
    texture: 'icon-cache',
    rarity: 'common',
  },
  gemstorm: {
    id: 'gemstorm',
    name: 'Gem Storm',
    description: 'Every gem on the ground flies to you.',
    texture: 'icon-gemstorm',
    rarity: 'magic',
  },
  feast: {
    id: 'feast',
    name: 'Feast',
    description: 'Restores all your health.',
    texture: 'icon-feast',
    rarity: 'magic',
  },
  novaburst: {
    id: 'novaburst',
    name: 'Shockwave',
    description: 'A huge blast hurts and throws back everything around you.',
    texture: 'icon-novaburst',
    rarity: 'magic',
  },
  judgement: {
    id: 'judgement',
    name: 'Judgement',
    description: `Every normal enemy on screen dies; elites lose ${Math.round(BOONS.judgementElite * 100)}% of their health.`,
    texture: 'icon-judgement',
    rarity: 'legendary',
  },
  secondwind: {
    id: 'secondwind',
    name: 'Second Wind',
    description: 'Once, when you would die, you get up with half your health instead. Stacks.',
    texture: 'icon-secondwind',
    rarity: 'legendary',
  },
  embers: {
    id: 'embers',
    name: 'Ember Surge',
    description: `+${Math.round(BOONS.surgeBonus * 100)}% damage for ${BOONS.surgeMs / 1000} seconds.`,
    texture: 'icon-embers',
    rarity: 'magic',
  },
};
