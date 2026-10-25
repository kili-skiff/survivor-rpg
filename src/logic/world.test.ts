import { describe, expect, it } from 'vitest';
import { BIOMES, POIS, SEASON, WORLD } from '../config/world';
import {
  areNeighbors,
  hexDistance,
  hexesInRadius,
  hexKey,
  hexNeighbors,
  hexToPixel,
  hexToPixelFlat,
  ORIGIN,
  parseHexKey,
  pixelToHex,
  pixelToHexFlat,
} from './hex';
import { createRng, hash32, seedFromString } from './rng';
import { emptySave, migrate } from './save';
import {
  applyFightResult,
  createWorldProgress,
  isDiscovered,
  isLit,
  lightWatchfire,
  travelKind,
  walkTo,
} from './worldProgress';
import { generateWorld, segmentForHex } from './worldgen';

describe('rng', () => {
  it('is deterministic', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
    expect(hash32(1, 2, 3, 4)).toBe(hash32(1, 2, 3, 4));
    expect(seedFromString('abc')).toBe(seedFromString('abc'));
    expect(seedFromString('abc')).not.toBe(seedFromString('abd'));
  });

  it('stays within [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hex', () => {
  it('measures distance and neighbours', () => {
    expect(hexDistance(ORIGIN, { q: 2, r: -1 })).toBe(2);
    expect(hexNeighbors(ORIGIN)).toHaveLength(6);
    for (const n of hexNeighbors(ORIGIN)) expect(areNeighbors(ORIGIN, n)).toBe(true);
    expect(parseHexKey(hexKey({ q: -3, r: 5 }))).toEqual({ q: -3, r: 5 });
  });

  it('converts between hexes and pixels', () => {
    for (const h of hexesInRadius(4)) {
      const p = hexToPixel(h, 30);
      expect(pixelToHex(p.x, p.y, 30)).toEqual(h);
      expect(pixelToHex(p.x + 8, p.y - 8, 30)).toEqual(h);
      const f = hexToPixelFlat(h, 30);
      expect(pixelToHexFlat(f.x, f.y, 30)).toEqual(h);
      expect(pixelToHexFlat(f.x - 8, f.y + 8, 30)).toEqual(h);
    }
  });

  it('counts hexes in a radius', () => {
    // 1 + 6 + 12 + ... = 3r(r+1) + 1
    expect(hexesInRadius(2)).toHaveLength(19);
    expect(hexesInRadius(6)).toHaveLength(127);
  });
});

describe('world generation', () => {
  it('produces the same world for the same seed', () => {
    const a = generateWorld('seed-a', 1);
    const b = generateWorld('seed-a', 1);
    expect([...a.hexes.values()]).toEqual([...b.hexes.values()]);
  });

  it('changes with seed or generator version', () => {
    const a = JSON.stringify([...generateWorld('seed-a', 1).hexes.values()]);
    expect(JSON.stringify([...generateWorld('seed-b', 1).hexes.values()])).not.toBe(a);
    expect(JSON.stringify([...generateWorld('seed-a', 2).hexes.values()])).not.toBe(a);
  });

  it('has the village in the centre and respects POI rings', () => {
    for (let s = 0; s < 20; s++) {
      const world = generateWorld(`seed-${s}`, 1);
      expect(world.hexes.get('0,0')?.poi).toBe('village');
      for (const h of world.hexes.values()) {
        if (h.poi && h.poi !== 'village') expect(h.ring).toBeGreaterThanOrEqual(POIS[h.poi].minRing);
      }
      const earlyCamp = [...world.hexes.values()].some((h) => h.poi === 'camp' && h.ring <= 2);
      expect(earlyCamp).toBe(true);
    }
  });

  it('grows every biome close to the village and again further out', () => {
    for (let s = 0; s < 30; s++) {
      const hexes = [...generateWorld(`seed-${s}`, SEASON.generatorVersion).hexes.values()];
      const near = new Set(
        hexes.filter((h) => h.ring >= 1 && h.ring <= WORLD.innerRegionRing).map((h) => h.biome),
      );
      const far = new Set(hexes.filter((h) => h.ring > WORLD.innerRegionRing + 1).map((h) => h.biome));
      for (const biome of Object.keys(BIOMES)) {
        expect(near, `seed-${s} near`).toContain(biome);
        expect(far, `seed-${s} far`).toContain(biome);
      }
    }
  });

  it('grows herbs only on some hexes, but every herb near the village', () => {
    for (let s = 0; s < 30; s++) {
      const hexes = [...generateWorld(`seed-${s}`, SEASON.generatorVersion).hexes.values()];
      const share = hexes.filter((h) => h.herbs).length / hexes.length;
      expect(share).toBeGreaterThan(WORLD.herbHexShare - 0.1);
      expect(share).toBeLessThan(WORLD.herbHexShare + 0.1);
      expect(hexes.find((h) => h.ring === 0)?.herbs).toBe(false);
      const near = hexes.filter((h) => h.herbs && h.ring >= 1 && h.ring <= WORLD.innerRegionRing);
      for (const biome of Object.keys(BIOMES))
        expect(
          near.map((h) => h.biome),
          `seed-${s}`,
        ).toContain(biome);
    }
  });

  it('places one tower in the outer ring and a camp near the village towards it', () => {
    for (let s = 0; s < 30; s++) {
      const world = generateWorld(`seed-${s}`, SEASON.generatorVersion);
      const towers = [...world.hexes.values()].filter((h) => h.poi === 'tower');
      expect(towers.map((h) => h.key)).toEqual([world.tower]);
      expect(towers[0].ring).toBe(world.radius);
      expect(towers[0].herbs).toBe(false);
      const camp = world.hexes.get(world.roadCamp!)!;
      expect(camp.poi).toBe('camp');
      expect(camp.ring).toBe(2);
      // It lies on the tower's side of the village: closer to the tower than the village is.
      expect(hexDistance(camp.hex, towers[0].hex)).toBeLessThan(world.radius);
    }
  });

  it('places one watchfire in each direction', () => {
    for (let s = 0; s < 30; s++) {
      const world = generateWorld(`seed-${s}`, SEASON.generatorVersion);
      const fires = [...world.hexes.values()].filter((h) => h.poi === 'watchfire');
      expect(fires.length, `seed-${s}`).toBeGreaterThanOrEqual(WORLD.watchfires - 1);
      expect(fires.length).toBeLessThanOrEqual(WORLD.watchfires);
      const slices = new Set(
        fires.map((h) => {
          const p = hexToPixel(h.hex, 1);
          const angle = (Math.atan2(p.y, p.x) + Math.PI * 2) % (Math.PI * 2);
          return Math.floor(angle / ((Math.PI * 2) / WORLD.watchfires));
        }),
      );
      expect(slices.size).toBe(fires.length);
      for (const f of fires) {
        expect(f.ring).toBeGreaterThanOrEqual(WORLD.watchfireRingMin);
        expect(f.ring).toBeLessThanOrEqual(WORLD.watchfireRingMax);
      }
    }
  });

  it('lights a watchfire once and reveals the land around it', () => {
    const fire = [...generateWorld(SEASON.seed, SEASON.generatorVersion).hexes.values()].find(
      (h) => h.poi === 'watchfire',
    )!;
    const fresh = createWorldProgress(1, 1);
    const lit = lightWatchfire(fresh, fire.key, 2);
    expect(isLit(lit, fire.key)).toBe(true);
    for (const n of hexNeighbors(fire.hex)) expect(isDiscovered(lit, hexKey(n))).toBe(true);
    expect(isDiscovered(lit, hexKey({ q: fire.hex.q + 2, r: fire.hex.r }))).toBe(true);
    expect(isDiscovered(lit, hexKey({ q: fire.hex.q + 3, r: fire.hex.r }))).toBe(false);
    expect(lightWatchfire(lit, fire.key, 2)).toBe(lit);
  });

  it('spreads points of interest out', () => {
    for (let s = 0; s < 30; s++) {
      const pois = [...generateWorld(`seed-${s}`, SEASON.generatorVersion).hexes.values()].filter(
        (h) => h.poi,
      );
      for (const a of pois) {
        for (const b of pois) {
          if (a === b) continue;
          const d = hexDistance(a.hex, b.hex);
          expect(d).toBeGreaterThanOrEqual(WORLD.poiMinGap);
          if (a.poi === b.poi) expect(d).toBeGreaterThanOrEqual(POIS[a.poi!].minSpacing);
        }
      }
    }
  });

  it('gives fights without herbs no herb plan', () => {
    const world = generateWorld(SEASON.seed, SEASON.generatorVersion);
    const empty = [...world.hexes.values()].find((h) => h.ring > 0 && !h.herbs)!;
    const herbal = [...world.hexes.values()].find((h) => h.herbs)!;
    expect(segmentForHex(empty).herbs).toBeNull();
    expect(segmentForHex(herbal).herbs).toEqual({ biome: herbal.biome, ring: herbal.ring });
  });

  it('forms biome regions of several connected hexes', () => {
    const world = generateWorld(SEASON.seed, SEASON.generatorVersion);
    let lonely = 0;
    for (const h of world.hexes.values()) {
      if (h.ring === 0) continue;
      const same = hexNeighbors(h.hex).some((n) => world.hexes.get(hexKey(n))?.biome === h.biome);
      if (!same) lonely += 1;
    }
    // Jittered borders may leave a stray hex now and then, but biomes are areas, not noise.
    expect(lonely).toBeLessThanOrEqual(3);
  });

  it('makes outer segments longer and harder', () => {
    const world = generateWorld(SEASON.seed, SEASON.generatorVersion);
    const byRing = (ring: number) => [...world.hexes.values()].find((h) => h.ring === ring)!;
    const near = segmentForHex(byRing(1));
    const far = segmentForHex(byRing(WORLD.radius));
    expect(far.durationSec).toBeGreaterThan(near.durationSec);
    expect(far.difficultyOffsetSec).toBeGreaterThan(near.difficultyOffsetSec);
    expect(far.durationSec).toBeLessThanOrEqual(WORLD.maxDurationSec);
  });
});

describe('world progress', () => {
  const world = generateWorld('test', 1);
  const fresh = createWorldProgress(1, 1);
  const east = { q: 1, r: 0 };

  it('starts in the village with its neighbours revealed', () => {
    expect(fresh.position).toBe('0,0');
    for (const n of hexNeighbors(ORIGIN)) expect(isDiscovered(fresh, hexKey(n))).toBe(true);
    expect(isDiscovered(fresh, '3,0')).toBe(false);
  });

  it('only allows travelling to neighbours', () => {
    expect(travelKind(world, fresh, east)).toBe('fight');
    expect(travelKind(world, fresh, { q: 2, r: 0 })).toBe('blocked');
    expect(travelKind(world, fresh, { q: 99, r: 0 })).toBe('blocked');
  });

  it('moves on when cleared and returns home when fallen', () => {
    const cleared = applyFightResult(fresh, east, 'cleared');
    expect(cleared.position).toBe('1,0');
    expect(cleared.cleared).toContain('1,0');
    expect(isDiscovered(cleared, '2,0')).toBe(true);
    expect(travelKind(world, cleared, ORIGIN)).toBe('walk');
    expect(walkTo(cleared, ORIGIN).position).toBe('0,0');

    const fallen = applyFightResult(cleared, { q: 2, r: 0 }, 'fallen');
    expect(fallen.position).toBe('0,0');
    expect(fallen.cleared).not.toContain('2,0');
  });
});

describe('save version 3', () => {
  it('adds world progress to old saves', () => {
    const migrated = migrate({ version: 2, runs: 3, segmentsCleared: 2 });
    expect(migrated.world.position).toBe('0,0');
    expect(migrated.runs).toBe(3);
  });

  it('keeps world progress of the current season', () => {
    const save = emptySave();
    const moved = { ...save, world: applyFightResult(save.world, { q: 1, r: 0 }, 'cleared') };
    expect(migrate(JSON.parse(JSON.stringify(moved))).world.position).toBe('1,0');
  });

  it('resets world progress from another season', () => {
    const old = { ...emptySave(), world: { ...emptySave().world, seasonId: 0, position: '1,0' } };
    expect(migrate(old).world.position).toBe('0,0');
  });
});

describe('segments of hexes', () => {
  it('carry the biome of their hex, which picks the ground tile', () => {
    const w = generateWorld('segment-biome', 1);
    for (const h of [...w.hexes.values()].slice(0, 40)) expect(segmentForHex(h).biome).toBe(h.biome);
  });
});
