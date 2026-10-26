import { describe, expect, it } from 'vitest';
import { HERBS } from '../config/herbs';
import { emptySave } from '../logic/save';
import { isDiscovered } from '../logic/worldProgress';
import { SEASON } from '../config/world';
import { areNeighbors, hexDistance, hexKey, hexNeighbors, parseHexKey } from '../logic/hex';
import { generateWorld } from '../logic/worldgen';
import { BASE_PLAYER_STATS } from '../config/passives';
import { DEEDS } from '../config/deeds';
import {
  FrameWindow,
  godModeStats,
  grantTestLoot,
  jumpTo,
  readoutLabel,
  RollingRate,
  toggleAllDeeds,
} from './devLogic';

describe('dev helpers', () => {
  it('adds every herb and some gold to the stash and keeps what is there', () => {
    const stash = grantTestLoot({ moonbloom: 2, healing: 1 }, 5, 50);
    expect(stash.gold).toBe(50);
    expect(stash.moonbloom).toBe(7);
    expect(stash.healing).toBe(1);
    for (const id of Object.keys(HERBS)) expect(stash[id]).toBeGreaterThanOrEqual(5);
  });

  const world = generateWorld(SEASON.seed, SEASON.generatorVersion);

  it('jumps to any hex and reveals its neighbours', () => {
    const plain = [...world.hexes.values()].find((h) => h.ring === 4 && !h.poi)!;
    const save = jumpTo(world, emptySave(), plain.hex);
    expect(save.world.position).toBe(plain.key);
    expect(isDiscovered(save.world, hexKey(hexNeighbors(plain.hex)[0]))).toBe(true);
    expect(save.stash).toEqual(emptySave().stash);
  });

  it('lands next to an unlit watchfire, so its fight can still light it', () => {
    const fire = [...world.hexes.values()].find((h) => h.poi === 'watchfire')!;
    const save = jumpTo(world, emptySave(), fire.hex);
    const pos = parseHexKey(save.world.position);
    expect(areNeighbors(pos, fire.hex)).toBe(true);
    expect(hexDistance(pos, { q: 0, r: 0 })).toBe(fire.ring - 1);
  });

  it('makes the player much stronger in god mode', () => {
    const god = godModeStats(BASE_PLAYER_STATS);
    expect(god.might).toBeCloseTo(BASE_PLAYER_STATS.might * 10);
    expect(god.haste).toBeLessThan(BASE_PLAYER_STATS.haste);
    expect(god.maxHp).toBe(BASE_PLAYER_STATS.maxHp);
  });

  it('grants all deeds, then takes them all back', () => {
    expect(toggleAllDeeds([])).toHaveLength(DEEDS.length);
    expect(toggleAllDeeds(['ring2'])).toHaveLength(DEEDS.length);
    expect(toggleAllDeeds(DEEDS.map((d) => d.id))).toEqual([]);
  });
});

describe('fps window', () => {
  it('reports nothing until half a second of frames is collected', () => {
    const w = new FrameWindow();
    for (let i = 0; i < 20; i++) expect(w.add(16)).toBeNull(); // 320 ms
  });

  it('reports the average frame rate and the worst frame, then starts over', () => {
    const w = new FrameWindow();
    let reading = null;
    for (let i = 0; i < 30 && !reading; i++) reading = w.add(i === 5 ? 40 : 16);
    expect(reading).not.toBeNull();
    expect(reading!.worstMs).toBe(40);
    expect(reading!.fps).toBeGreaterThan(50);
    expect(reading!.fps).toBeLessThan(62);
    // The next window does not remember the hitch.
    let next = null;
    for (let i = 0; i < 40 && !next; i++) next = w.add(16);
    expect(next!.worstMs).toBe(16);
  });

  it('shows a slow game as a low number', () => {
    const w = new FrameWindow();
    let reading = null;
    while (!reading) reading = w.add(50);
    expect(Math.round(reading.fps)).toBe(20);
  });

  it('formats a readable two-line readout', () => {
    const label = readoutLabel({ fps: { fps: 59.6, worstMs: 21.4 }, enemies: 187, killsPerMinute: 41.6 });
    expect(label).toBe('60 fps · worst 21 ms\n187 enemies · 42 kills/min');
  });
});

describe('kills per minute', () => {
  it('is zero until a little time is measured', () => {
    const r = new RollingRate();
    expect(r.update(0, 0)).toBe(0);
    expect(r.update(3, 1000)).toBe(0);
  });

  it('measures a steady rate', () => {
    const r = new RollingRate();
    let rate = 0;
    for (let t = 0; t <= 20000; t += 500) rate = r.update(t / 500, t); // 2 kills per second
    expect(rate).toBeCloseTo(120, 0);
  });

  it('forgets what lies further back than the window', () => {
    const r = new RollingRate(30000);
    let rate = 0;
    for (let t = 0; t <= 60000; t += 500) rate = r.update(Math.min(t, 10000) / 100, t); // busy, then nothing
    expect(rate).toBeCloseTo(0, 0);
  });

  it('starts over when the total goes down (a new run)', () => {
    const r = new RollingRate();
    for (let t = 0; t <= 10000; t += 500) r.update(t / 100, t);
    expect(r.update(0, 10500)).toBe(0);
  });
});
