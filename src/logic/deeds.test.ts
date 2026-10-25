import { describe, expect, it } from 'vitest';
import { DEEDS } from '../config/deeds';
import { WORLD } from '../config/world';
import { deedBonus, describeEarned, earnDeeds, parseDeeds } from './deeds';
import type { ExpeditionBuild } from './expedition';
import { hexKey, ORIGIN } from './hex';
import { finishFight } from './journey';
import { emptySave, migrate, type SaveData } from './save';
import { computePlayerStats, createStartLoadout } from './stats';
import { generateWorld, type World } from './worldgen';

const world: World = generateWorld('deeds-test', 1);
const hexes = [...world.hexes.values()];
const inRing = (ring: number) => hexes.find((h) => h.ring === ring && !h.poi)!;

function build(hp = 40): ExpeditionBuild {
  return { level: 3, xp: 0, hp, loadout: createStartLoadout('bolt') };
}

function standingOn(key: string, save: SaveData = emptySave()): SaveData {
  return { ...save, world: { ...save.world, position: key, cleared: [...save.world.cleared, key] } };
}

describe('deeds', () => {
  it('earns nothing in the village', () => {
    const { save, earned } = earnDeeds(emptySave(), world);
    expect(earned).toEqual([]);
    expect(save.deeds).toEqual([]);
  });

  it('earns ring deeds up to the furthest ring reached, in listed order', () => {
    const { save, earned } = earnDeeds(standingOn(inRing(5).key), world);
    expect(earned.map((d) => d.id)).toEqual(['ring2', 'ring4']);
    expect(save.deeds).toEqual(['ring2', 'ring4']);
    // Earned once: nothing new the second time, and the save object stays the same.
    const again = earnDeeds(save, world);
    expect(again.earned).toEqual([]);
    expect(again.save).toBe(save);
  });

  it('earns camp, watchfire and tower deeds from the saved progress', () => {
    const base = emptySave();
    const fires = Array.from({ length: WORLD.watchfires }, (_, i) => `fire-${i}`);
    const save: SaveData = {
      ...base,
      world: { ...base.world, waypoints: ['camp'], litWatchfires: fires.slice(0, 3) },
      quests: { ...base.quests, tower: 'done' },
    };
    const ids = earnDeeds(save, world).save.deeds;
    expect(ids).toEqual(['firstCamp', 'firstWatchfire', 'threeWatchfires', 'tower']);
    const all = { ...save, world: { ...save.world, litWatchfires: fires } };
    expect(earnDeeds(all, world).save.deeds).toContain('allWatchfires');
  });

  it('adds up the bonuses of earned deeds', () => {
    expect(deedBonus([])).toEqual({});
    expect(deedBonus(['ring2', 'ring6'])).toEqual({ maxHp: 20 });
    const stats = computePlayerStats(createStartLoadout('bolt'), deedBonus(['ring2', 'ring4']));
    const plain = computePlayerStats(createStartLoadout('bolt'));
    expect(stats.maxHp).toBe(plain.maxHp + 10);
    expect(stats.might).toBeCloseTo(plain.might + 0.05);
  });

  it('every deed gives a bonus and has a unique id', () => {
    expect(new Set(DEEDS.map((d) => d.id)).size).toBe(DEEDS.length);
    for (const d of DEEDS) expect(Object.keys(d.bonus).length).toBeGreaterThan(0);
  });

  it('describes earned deeds', () => {
    const [ring2, ring4] = DEEDS;
    expect(describeEarned([])).toBe('');
    expect(describeEarned([ring2])).toBe('Deed earned: Beyond the Fields (+10 health)');
    expect(describeEarned([ring2, ring4])).toBe('Deeds earned: Beyond the Fields, Into the Dark');
  });
});

describe('deeds on expeditions', () => {
  it('a cleared fight earns deeds and reports them', () => {
    const target = hexes.find((h) => h.ring === 2 && !h.poi)!;
    const { save, report } = finishFight(emptySave(), world, target.hex, 'cleared', build(), {});
    expect(report.deeds.map((d) => d.id)).toEqual(['ring2']);
    expect(save.deeds).toEqual(['ring2']);
  });

  it('a fall earns nothing, but keeps the deeds you have', () => {
    const before = { ...emptySave(), deeds: parseDeeds(['ring2']) };
    const target = hexes.find((h) => h.ring === 4 && !h.poi)!;
    const { save, report } = finishFight(before, world, target.hex, 'fallen', build(), {});
    expect(report.deeds).toEqual([]);
    expect(save.deeds).toEqual(['ring2']);
  });

  it('camps heal up to the health including deeds', () => {
    const camp = hexes.find((h) => h.poi === 'camp')!;
    const before = { ...emptySave(), deeds: parseDeeds(['ring2', 'ring6']) };
    const { save } = finishFight(before, world, camp.hex, 'cleared', build(5), {});
    const maxHp = computePlayerStats(createStartLoadout('bolt'), deedBonus(save.deeds)).maxHp;
    expect(save.world.expedition?.build?.hp).toBe(maxHp);
    expect(maxHp).toBeGreaterThanOrEqual(computePlayerStats(createStartLoadout('bolt')).maxHp + 20);
  });
});

describe('deeds in the save', () => {
  it('starts empty and survives a save round trip', () => {
    expect(emptySave().deeds).toEqual([]);
    const save = { ...emptySave(), deeds: parseDeeds(['tower', 'ring2']) };
    expect(migrate(JSON.parse(JSON.stringify(save))).deeds).toEqual(['ring2', 'tower']);
  });

  it('drops unknown ids and old saves get none', () => {
    expect(parseDeeds(['ring2', 'nope', 3])).toEqual(['ring2']);
    expect(parseDeeds('ring2')).toEqual([]);
    expect(migrate({ version: 9, runs: 3 }).deeds).toEqual([]);
  });

  it('are kept when the map is reset', () => {
    const save = { ...emptySave(), deeds: parseDeeds(['ring2']) };
    const oldMap = { ...save, world: { ...save.world, generatorVersion: -1 } };
    const migrated = migrate(JSON.parse(JSON.stringify(oldMap)));
    expect(migrated.world.position).toBe(hexKey(ORIGIN));
    expect(migrated.deeds).toEqual(['ring2']);
  });
});
