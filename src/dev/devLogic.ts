// Dev-only game logic (no Phaser, tested). See devMode.ts for how to remove dev tools.

import { HERBS } from '../config/herbs';
import { GOLD_KEY } from '../config/merchant';
import type { PlayerStats } from '../config/types';
import { addLoot, type Loot } from '../logic/expedition';
import { hexDistance, hexKey, hexNeighbors, ORIGIN, type Hex } from '../logic/hex';
import type { SaveData } from '../logic/save';
import type { World } from '../logic/worldgen';
import { isLit, walkTo } from '../logic/worldProgress';

/** Adds `amount` of every herb and `gold` gold to the stash. */
export function grantTestLoot(stash: Loot, amount: number, gold: number): Loot {
  const gift: Loot = { [GOLD_KEY]: gold };
  for (const id of Object.keys(HERBS)) gift[id] = amount;
  return addLoot(stash, gift);
}

/** God mode: much stronger and faster, so fights are quick to clear (damage is blocked elsewhere). */
export function godModeStats(stats: PlayerStats): PlayerStats {
  return {
    ...stats,
    might: stats.might * 10,
    haste: Math.max(0.2, stats.haste * 0.5),
    moveSpeed: stats.moveSpeed * 1.3,
    magnet: stats.magnet * 3,
  };
}

/**
 * Where a jump to `target` lands. An unlit watchfire is only lit by winning its fight, so the jump
 * lands next to it (on the side towards the village) instead of on it.
 */
export function jumpTarget(world: World, save: SaveData, target: Hex): Hex {
  const info = world.hexes.get(hexKey(target));
  if (info?.poi !== 'watchfire' || isLit(save.world, info.key)) return target;
  const options = hexNeighbors(target).filter((n) => world.hexes.has(hexKey(n)));
  return options.reduce(
    (best, n) => (hexDistance(n, ORIGIN) < hexDistance(best, ORIGIN) ? n : best),
    options[0],
  );
}

/** Jumps without a fight (see jumpTarget): the expedition and its loot stay as they are. */
export function jumpTo(world: World, save: SaveData, target: Hex): SaveData {
  const landing = jumpTarget(world, save, target);
  return { ...save, world: walkTo(save.world, landing) };
}
