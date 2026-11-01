import { hexKey, hexNeighbors, ORIGIN, parseHexKey } from './hex';
import { travelKind, type WorldProgress } from './worldProgress';
import type { World } from './worldgen';

/**
 * Hexes the world map shows at full brightness; every other hex is dimmed, so your next steps stand out:
 * - the hex you stand on, the village and every lit watchfire, each with the ring of hexes around it,
 * - hexes cleared on this expedition (used up, walked through freely until you return home),
 * - hexes you can teleport to (a camp from the village, the village from a camp).
 */
export function brightHexes(world: World, progress: WorldProgress): Set<string> {
  const bright = new Set<string>();
  const addWithRing = (key: string) => {
    bright.add(key);
    for (const n of hexNeighbors(parseHexKey(key))) bright.add(hexKey(n));
  };
  addWithRing(progress.position);
  addWithRing(hexKey(ORIGIN));
  for (const key of progress.litWatchfires) addWithRing(key);
  for (const key of progress.expedition?.cleared ?? []) bright.add(key);
  for (const h of world.hexes.values()) {
    if (travelKind(world, progress, h.hex) === 'teleport') bright.add(h.key);
  }
  return bright;
}
