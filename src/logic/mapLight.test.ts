import { describe, expect, it } from 'vitest';
import { startExpedition } from './expedition';
import { hexKey, hexNeighbors, ORIGIN, parseHexKey } from './hex';
import { brightHexes } from './mapLight';
import { addWaypoint, createWorldProgress, lightWatchfire, walkTo } from './worldProgress';
import { generateWorld } from './worldgen';

const world = generateWorld('light-test', 1);
const SEASON_ID = 1;
const home = () => createWorldProgress(SEASON_ID, 1);
const ring = (key: string) => [key, ...hexNeighbors(parseHexKey(key)).map(hexKey)];

describe('brightHexes', () => {
  it('lights the village and its ring at home, nothing else', () => {
    const bright = brightHexes(world, home());
    expect([...bright].sort()).toEqual(ring(hexKey(ORIGIN)).sort());
  });

  it('follows the player: the ring around the new position is bright, far hexes are not', () => {
    const start = walkTo(home(), hexNeighbors(ORIGIN)[0]);
    const here = start.position;
    const bright = brightHexes(world, start);
    for (const key of ring(here)) expect(bright.has(key)).toBe(true);
    const far = [...world.hexes.values()].find((h) => h.ring >= 4)!;
    expect(bright.has(far.key)).toBe(false);
  });

  it('lights the ring around a lit watchfire, but not around an unlit one', () => {
    const fire = [...world.hexes.values()].find((h) => h.poi === 'watchfire')!;
    expect(brightHexes(world, home()).has(fire.key)).toBe(false);
    const bright = brightHexes(world, lightWatchfire(home(), fire.key, 2));
    for (const key of ring(fire.key)) expect(bright.has(key)).toBe(true);
  });

  it('keeps hexes cleared on this expedition bright, wherever they are', () => {
    const far = [...world.hexes.values()].find((h) => h.ring >= 4)!;
    const progress = { ...home(), expedition: { ...startExpedition(hexKey(ORIGIN)), cleared: [far.key] } };
    expect(brightHexes(world, progress).has(far.key)).toBe(true);
  });

  it('lights a reachable camp so a teleport target does not vanish into the dark', () => {
    const camp = [...world.hexes.values()].find((h) => h.poi === 'camp')!;
    expect(brightHexes(world, home()).has(camp.key)).toBe(false);
    const bright = brightHexes(world, addWaypoint(home(), camp.key));
    expect(bright.has(camp.key)).toBe(true);
  });
});
