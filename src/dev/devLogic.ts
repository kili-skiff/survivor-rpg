// Dev-only game logic (no Phaser, tested). See devMode.ts for how to remove dev tools.

import { HERBS } from '../config/herbs';
import { addLoot, type Loot } from '../logic/expedition';
import type { Hex } from '../logic/hex';
import type { SaveData } from '../logic/save';
import { walkTo } from '../logic/worldProgress';

/** Adds `amount` of every herb to the stash. */
export function grantAllHerbs(stash: Loot, amount: number): Loot {
  const gift: Loot = {};
  for (const id of Object.keys(HERBS)) gift[id] = amount;
  return addLoot(stash, gift);
}

/** Jumps to any hex without a fight: the expedition and its loot stay as they are. */
export function jumpTo(save: SaveData, target: Hex): SaveData {
  return { ...save, world: walkTo(save.world, target) };
}
