// Developer helpers for testing. Only reachable with the dev mode switched on (see ui/dev.ts).

import { HERBS } from '../config/herbs';
import { addLoot, type Loot } from './expedition';

/** Adds `amount` of every herb to the stash. */
export function grantAllHerbs(stash: Loot, amount: number): Loot {
  const gift: Loot = {};
  for (const id of Object.keys(HERBS)) gift[id] = amount;
  return addLoot(stash, gift);
}
