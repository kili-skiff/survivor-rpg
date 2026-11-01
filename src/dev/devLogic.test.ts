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
  readoutParts,
  randomBuild,
  RollingRate,
  toggleAllDeeds,
} from './devLogic';

describe('dev helpers', () => {
  it('adds every herb and some embers to the stash and keeps what is there', () => {
    const stash = grantTestLoot({ moonbloom: 2, healing: 1 }, 5, 50);
    expect(stash.embers).toBe(50);
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
    const parts = readoutParts({ fps: { fps: 59.6, worstMs: 21.4 }, enemies: 187, killsPerMinute: 41.6 });
    expect(parts.summary).toBe('60 fps · 187 enemies');
    expect(parts.details).toBe('worst 21 ms · 42 kills/min');
  });

  it('adds the pace of the spawn director as a third line', () => {
    const parts = readoutParts({
      fps: { fps: 60, worstMs: 16 },
      enemies: 10,
      killsPerMinute: 5,
      director: { phase: 'surge', pressure: 2 },
    });
    expect(parts.details).toBe('worst 16 ms · 5 kills/min\nsurge · x2.0');
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

describe('dev upgrade picker', () => {
  it('lists every missing level step of a weapon as its own entry', async () => {
    const { devUpgradeList } = await import('./devLogic');
    const { createStartLoadout } = await import('../logic/stats');
    const { WEAPONS } = await import('../config/weapons');
    const list = devUpgradeList(createStartLoadout('boomerang'));
    const steps = list.filter((e) => e.option.kind === 'weapon' && e.option.id === 'boomerang');
    expect(steps.length).toBe(WEAPONS.boomerang.levels.length);
    expect(new Set(steps.map((e) => (e.option.kind === 'weapon' ? e.option.step : -1))).size).toBe(
      steps.length,
    );
    expect(list.some((e) => e.option.kind === 'passive')).toBe(true);
    expect(list.every((e) => e.label.length > 0)).toBe(true);
  });

  it('a picked step is gone from the list afterwards', async () => {
    const { devUpgradeList } = await import('./devLogic');
    const { createStartLoadout } = await import('../logic/stats');
    const { applyUpgrade } = await import('../logic/upgrades');
    const start = createStartLoadout('bolt');
    const pick = devUpgradeList(start).find(
      (e) => e.option.kind === 'weapon' && e.option.id === 'bolt' && e.option.step === 3,
    )!;
    const after = applyUpgrade(start, pick.option);
    expect(after.weaponSteps?.bolt).toEqual([3]);
    expect(
      devUpgradeList(after).some(
        (e) => e.option.kind === 'weapon' && e.option.id === 'bolt' && e.option.step === 3,
      ),
    ).toBe(false);
  });

  it('swaps the main weapon for the next one at level 1 and keeps the rest', async () => {
    const { devSwapMainWeapon, devMainWeapon } = await import('./devLogic');
    const loadout = {
      weapons: { bolt: 5, aura: 2 },
      weaponSteps: { bolt: [0, 1, 2, 3] },
      passives: { might: 2 },
      skills: { dash: 1, nova: 1 },
    };
    const swapped = devSwapMainWeapon(loadout);
    expect(swapped.weapons).toEqual({ boomerang: 1, aura: 2 });
    expect(swapped.weaponSteps?.bolt).toBeUndefined();
    expect(swapped.passives).toEqual({ might: 2 });
    expect(devMainWeapon(devSwapMainWeapon(swapped))).toBe('bolt');
  });
});

describe('random build', () => {
  it('takes one upgrade per level and a modifier at the modifier levels', async () => {
    const { createStartLoadout } = await import('../logic/stats');
    const { createRng } = await import('../logic/rng');
    const start = createStartLoadout('boomerang');
    const build = randomBuild(start, 12, createRng(3));
    const levels = (l: Partial<Record<string, number>>) =>
      Object.values(l).reduce((s, v) => s! + (v ?? 0), 0)!;
    const steps = levels(build.weapons) + levels(build.passives) + levels(build.skills);
    // 11 level-ups: 2 modifiers (level 5 and 10) and 9 cards.
    expect(build.modifiers).toHaveLength(2);
    expect(steps - levels(start.weapons) - levels(start.skills)).toBe(9);
    expect(build.weapons.boomerang).toBeGreaterThanOrEqual(1);
  });

  it('level 1 is the start build, and the same seed gives the same build', async () => {
    const { createStartLoadout } = await import('../logic/stats');
    const { createRng } = await import('../logic/rng');
    const start = createStartLoadout('bolt');
    expect(randomBuild(start, 1, createRng(1))).toEqual(start);
    expect(randomBuild(start, 10, createRng(5))).toEqual(randomBuild(start, 10, createRng(5)));
  });
});
