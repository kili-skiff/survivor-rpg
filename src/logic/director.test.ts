import { describe, expect, it } from 'vitest';
import { DIRECTOR, type DirectorParams, type SurgeKind } from '../config/director';
import {
  announcementText,
  burstCount,
  directionName,
  forEachSpawnPoint,
  pressure,
  SpawnDirector,
  type SpawnOrder,
  headingOf,
  scatterAngle,
  recycleAngle,
  edgeDistance,
  outsideView,
} from './director';
import { createRng } from './rng';
import { baseSpawnRate } from './spawning';

const DT = 1 / 30;

/** Runs a director for `seconds` and reports what it did. */
function run(
  director: SpawnDirector,
  seconds: number,
  opts: { time?: number; rate?: number; room?: number } = {},
) {
  const log = {
    spawned: 0,
    perPhase: { build: 0, warning: 0, surge: 0, breather: 0 },
    announcements: [] as { at: number; kind: SurgeKind; text: string }[],
    orders: [] as { at: number; order: SpawnOrder }[],
    phaseAt: [] as { at: number; phase: string }[],
  };
  let last = '';
  for (let t = 0; t < seconds; t += DT) {
    const phaseBefore = director.phase;
    const step = director.update(DT, { time: opts.time ?? 0, rate: opts.rate ?? 2, room: opts.room ?? 1000 });
    for (const order of step.orders) {
      log.spawned += order.count;
      log.perPhase[phaseBefore] += order.count;
      log.orders.push({ at: t, order: { ...order } });
    }
    if (step.announce) log.announcements.push({ at: t, kind: step.announce.kind, text: step.announce.text });
    if (director.phase !== last) {
      log.phaseAt.push({ at: t, phase: director.phase });
      last = director.phase;
    }
  }
  return log;
}

/** Fixed durations make cycles easy to reason about. */
function steady(over: Partial<DirectorParams> = {}): DirectorParams {
  return { ...DIRECTOR, openingSec: 10, buildMinSec: 10, buildMaxSec: 10, ...over };
}

describe('director cycle', () => {
  it('goes through build-up, warning, surge and breather, then starts over', () => {
    const d = new SpawnDirector(createRng(1), steady());
    const log = run(d, 60);
    const phases = log.phaseAt.map((p) => p.phase);
    expect(phases.slice(0, 5)).toEqual(['build', 'warning', 'surge', 'breather', 'build']);
    // Opening 10s, then a swarm warning of 2.5s and so on.
    expect(log.phaseAt[1].at).toBeCloseTo(10, 0);
    expect(log.phaseAt[2].at).toBeCloseTo(12.5, 0);
    expect(log.phaseAt[3].at).toBeCloseTo(20.5, 0);
    expect(log.phaseAt[4].at).toBeCloseTo(26.5, 0);
  });

  it('starts with a longer opening', () => {
    const d = new SpawnDirector(createRng(1));
    const log = run(d, 30);
    expect(log.phaseAt[1].phase).toBe('warning');
    expect(log.phaseAt[1].at).toBeCloseTo(DIRECTOR.openingSec, 0);
  });

  it('announces every surge when its warning starts, and the first one is a swarm', () => {
    const d = new SpawnDirector(createRng(7), steady());
    const log = run(d, 200, { time: 200 });
    expect(log.announcements.length).toBeGreaterThanOrEqual(5);
    expect(log.announcements[0].kind).toBe('swarm');
    expect(log.announcements[0].at).toBeCloseTo(10, 0);
    expect(log.announcements[0].text).toMatch(/^A wave is coming from the /);
  });

  it('only picks surge kinds that are unlocked yet', () => {
    const d = new SpawnDirector(createRng(3), steady());
    const early = run(d, 400, { time: 10 });
    expect(new Set(early.announcements.map((a) => a.kind))).toEqual(new Set(['swarm']));

    const late = run(new SpawnDirector(createRng(3), steady()), 800, { time: 500 });
    const kinds = new Set(late.announcements.map((a) => a.kind));
    expect(kinds.has('ring')).toBe(true);
    expect(kinds.has('wall')).toBe(true);
  });
});

describe('pacing', () => {
  it('spawns much more in a surge than in a breather', () => {
    const d = new SpawnDirector(createRng(1), steady());
    const log = run(d, 26, { rate: 4 });
    const surgeSec = DIRECTOR.surges.swarm.surgeSec;
    const perSecSurge = log.perPhase.surge / surgeSec;
    const perSecBreather = log.perPhase.breather / DIRECTOR.breatherSec;
    expect(perSecSurge).toBeGreaterThan(perSecBreather * 6);
  });

  it('builds up: the end of a build-up spawns more than the start', () => {
    expect(pressure('build', 'swarm', 0)).toBeCloseTo(DIRECTOR.buildFrom);
    expect(pressure('build', 'swarm', 1)).toBeCloseTo(DIRECTOR.buildTo);
    expect(pressure('build', 'swarm', 0.5)).toBeGreaterThan(pressure('build', 'swarm', 0.1));
    expect(pressure('warning', 'swarm', 0)).toBeLessThan(pressure('build', 'swarm', 1));
  });

  it('keeps about as many enemies per cycle as the old constant stream', () => {
    // Average pressure over a whole cycle, weighted by how long each phase lasts.
    for (const kind of Object.keys(DIRECTOR.surges) as SurgeKind[]) {
      const s = DIRECTOR.surges[kind];
      const build = (DIRECTOR.buildMinSec + DIRECTOR.buildMaxSec) / 2;
      const mean = (DIRECTOR.buildFrom + DIRECTOR.buildTo) / 2;
      const total =
        build * mean +
        s.warningSec * DIRECTOR.warningMult +
        s.surgeSec * s.surgeMult +
        DIRECTOR.breatherSec * DIRECTOR.breatherMult;
      const length = build + s.warningSec + s.surgeSec + DIRECTOR.breatherSec;
      const average = total / length;
      expect(average).toBeGreaterThan(0.7);
      expect(average).toBeLessThan(1.1);
    }
  });

  it('never spawns more than there is room for', () => {
    const d = new SpawnDirector(createRng(5), steady());
    const log = run(d, 120, { time: 300, rate: 20, room: 3 });
    // 3 slots are never refilled here (the test does not despawn), so at most one batch per frame of 3.
    for (const o of log.orders) expect(o.order.count).toBeLessThanOrEqual(3);
    const none = run(new SpawnDirector(createRng(5), steady()), 60, { time: 300, rate: 20, room: 0 });
    expect(none.spawned).toBe(0);
  });

  it('does not save up a flood while the enemy cap is reached', () => {
    const d = new SpawnDirector(createRng(5), steady());
    run(d, 20, { rate: 10, room: 0 }); // full
    const step = d.update(DT, { time: 0, rate: 10, room: 1000 });
    const first = step.orders.reduce((n, o) => n + o.count, 0);
    expect(first).toBeLessThanOrEqual(DIRECTOR.maxPerFrame);
  });

  it('places at most a few per frame from the stream', () => {
    const d = new SpawnDirector(createRng(2), steady());
    const log = run(d, 60, { rate: 200 });
    for (const o of log.orders) {
      if (o.order.pattern === 'scatter' || o.order.pattern === 'side') {
        expect(o.order.count).toBeLessThanOrEqual(DIRECTOR.maxPerFrame);
      }
    }
  });

  it('swarm surges come from one side, the rest of the time enemies scatter', () => {
    const d = new SpawnDirector(createRng(1), steady());
    const log = run(d, 26, { rate: 4 });
    const patterns = new Set(log.orders.map((o) => o.order.pattern));
    expect(patterns.has('side')).toBe(true);
    expect(patterns.has('scatter')).toBe(true);
  });
});

describe('ring and wall bursts', () => {
  // Make the first surge a ring or a wall by unlocking only that kind at the start.
  function only(kind: SurgeKind): DirectorParams {
    const surges = { ...DIRECTOR.surges };
    for (const k of Object.keys(surges) as SurgeKind[]) {
      surges[k] = { ...surges[k], weight: k === kind ? 1 : 0, from: 0 };
    }
    return steady({ surges });
  }

  it('a ring arrives at once when its surge starts', () => {
    // The first surge is a swarm; skip it and look at the second one.
    const d = new SpawnDirector(createRng(1), only('ring'));
    const log = run(d, 80, { time: 100, rate: 0 });
    const ring = log.orders.find((o) => o.order.pattern === 'ring');
    expect(ring).toBeDefined();
    expect(ring!.order.count).toBe(burstCount('ring', 100));
    // It comes with the surge, not with the warning.
    const surgeStart = log.phaseAt.filter((p) => p.phase === 'surge')[1].at;
    expect(ring!.at).toBeCloseTo(surgeStart, 0);
  });

  it('a wall arrives at once when its surge starts', () => {
    const d = new SpawnDirector(createRng(1), only('wall'));
    const log = run(d, 80, { time: 100, rate: 0 });
    expect(log.orders.some((o) => o.order.pattern === 'wall')).toBe(true);
  });

  it('the burst grows with the fight and is capped', () => {
    expect(burstCount('swarm', 100)).toBe(0);
    expect(burstCount('ring', 0)).toBe(DIRECTOR.surges.ring.burstBase);
    expect(burstCount('ring', 120)).toBeGreaterThan(burstCount('ring', 0));
    expect(burstCount('ring', 100000)).toBe(DIRECTOR.surges.ring.burstMax);
  });

  it('a burst also respects the enemy cap', () => {
    const d = new SpawnDirector(createRng(1), only('ring'));
    const log = run(d, 80, { time: 100, rate: 0, room: 4 });
    const ring = log.orders.find((o) => o.order.pattern === 'ring');
    expect(ring!.order.count).toBeLessThanOrEqual(4);
  });
});

describe('where enemies appear', () => {
  const rng = createRng(11);
  const collect = (order: SpawnOrder) => {
    const pts: { x: number; y: number }[] = [];
    forEachSpawnPoint(order, 100, 50, 500, rng, (x, y) => pts.push({ x, y }));
    return pts;
  };
  const dist = (p: { x: number; y: number }) => Math.hypot(p.x - 100, p.y - 50);

  it('places exactly as many as ordered, never inside the view', () => {
    for (const pattern of ['scatter', 'side', 'ring', 'wall'] as const) {
      const pts = collect({ count: 30, pattern, angle: 1 });
      expect(pts).toHaveLength(30);
      for (const p of pts) expect(dist(p)).toBeGreaterThanOrEqual(499);
    }
  });

  it('a ring surrounds the player: all sides are covered', () => {
    const pts = collect({ count: 24, pattern: 'ring', angle: 0 });
    const sectors = new Set(
      pts.map((p) => Math.floor(((Math.atan2(p.y - 50, p.x - 100) + Math.PI) / (Math.PI * 2)) * 8)),
    );
    expect(sectors.size).toBe(8);
  });

  it('a side stream stays on its side', () => {
    const angle = Math.PI / 2; // south
    const pts = collect({ count: 40, pattern: 'side', angle });
    for (const p of pts) {
      const a = Math.atan2(p.y - 50, p.x - 100);
      expect(Math.abs(a - angle)).toBeLessThanOrEqual(DIRECTOR.sideSpread / 2 + 1e-9);
    }
  });

  it('a wall is a line across one side: far from the player in its direction, wide across', () => {
    const pts = collect({ count: 20, pattern: 'wall', angle: 0 }); // from the east
    for (const p of pts) {
      expect(p.x - 100).toBeGreaterThanOrEqual(499); // all in front on the east side
      expect(p.x - 100).toBeLessThanOrEqual(515);
    }
    const ys = pts.map((p) => p.y).sort((a, b) => a - b);
    expect(ys[ys.length - 1] - ys[0]).toBeCloseTo(19 * DIRECTOR.wallSpacing, 0);
  });

  it('a long wall gets more rows', () => {
    const pts = collect({ count: DIRECTOR.wallMax + 5, pattern: 'wall', angle: 0 });
    const far = Math.max(...pts.map((p) => p.x - 100));
    expect(far).toBeGreaterThanOrEqual(500 + DIRECTOR.wallSpacing - 1);
  });
});

describe('announcements', () => {
  it('names the compass side, with north at the top of the screen', () => {
    expect(directionName(0)).toBe('east');
    expect(directionName(Math.PI / 2)).toBe('south');
    expect(directionName(Math.PI)).toBe('west');
    expect(directionName(-Math.PI / 2)).toBe('north');
    expect(directionName(Math.PI * 2 + 0.1)).toBe('east');
    expect(directionName((Math.PI * 7) / 4)).toBe('north-east');
  });

  it('writes a line per kind', () => {
    expect(announcementText('swarm', 0)).toBe('A wave is coming from the east!');
    expect(announcementText('wall', Math.PI)).toBe('A wall of enemies approaches from the west!');
    expect(announcementText('ring', 1)).toBe('Something is closing in from all sides!');
  });
});

describe('against the old stream', () => {
  it('over a long fight brings about as many enemies as the constant stream did', () => {
    // Use the real fight rate for 3 minutes and compare the director's total with the old stream.
    const d = new SpawnDirector(createRng(42));
    let t = 0;
    let spawned = 0;
    let old = 0;
    for (; t < 180; t += DT) {
      const rate = baseSpawnRate(t);
      old += rate * DT;
      const step = d.update(DT, { time: t, rate, room: 1000 });
      for (const o of step.orders) spawned += o.count;
    }
    expect(spawned / old).toBeGreaterThan(0.7);
    expect(spawned / old).toBeLessThan(1.25);
  });
});

describe('spawning ahead of a moving player', () => {
  const seq = (...values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('has no heading while the player stands', () => {
    expect(headingOf(5, 5)).toBeNull();
    expect(headingOf(120, 0)).toBe(0);
    expect(headingOf(0, -120)).toBeCloseTo(-Math.PI / 2);
  });

  it('puts a share of scattered enemies ahead, within the spread', () => {
    const heading = 0;
    // First roll below aheadShare: ahead; the second decides where within the spread.
    const a = scatterAngle(seq(0.1, 1), heading);
    expect(Math.abs(a)).toBeLessThanOrEqual(DIRECTOR.aheadSpread / 2 + 1e-9);
    // First roll above aheadShare: anywhere.
    expect(scatterAngle(seq(0.9, 0.75), heading)).toBeCloseTo(0.75 * Math.PI * 2);
  });

  it('scatters evenly around a standing player', () => {
    expect(scatterAngle(seq(0.25), null)).toBeCloseTo(0.5 * Math.PI);
  });

  it('about half of many scattered enemies come from ahead', () => {
    let s = 3;
    const rng = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    let ahead = 0;
    for (let i = 0; i < 2000; i++) if (Math.cos(scatterAngle(rng, 0)) > 0) ahead += 1;
    // Half come from ahead on purpose, and half of the rest by chance.
    expect(ahead / 2000).toBeGreaterThan(0.65);
    expect(ahead / 2000).toBeLessThan(0.85);
  });

  it('moves enemies that fell behind ahead of a moving player', () => {
    for (const r of [0, 0.5, 0.999]) {
      const a = recycleAngle(seq(r), Math.PI);
      expect(Math.cos(a)).toBeLessThan(0); // heading west: they come back in the west
    }
  });
});

describe('the edge of the view', () => {
  it('is half the width to the side and half the height up and down, plus the margin', () => {
    expect(edgeDistance(0, 400, 200, 40)).toBeCloseTo(440);
    expect(edgeDistance(Math.PI / 2, 400, 200, 40)).toBeCloseTo(240);
    expect(edgeDistance(Math.PI, 400, 200, 0)).toBeCloseTo(400);
  });

  it('reaches the corner on the diagonal', () => {
    const a = Math.atan2(200, 400);
    expect(edgeDistance(a, 400, 200, 0)).toBeCloseTo(Math.hypot(400, 200));
  });

  it('tells what lies outside the view and its margin', () => {
    expect(outsideView(390, 0, 400, 200, 50)).toBe(false);
    expect(outsideView(0, 260, 400, 200, 50)).toBe(true);
    expect(outsideView(-460, 0, 400, 200, 50)).toBe(true);
  });

  it('places scattered enemies on the edge it is given', () => {
    const points: number[] = [];
    forEachSpawnPoint(
      { count: 20, pattern: 'scatter', angle: 0 },
      0,
      0,
      999,
      createRng(4),
      (x, y) => points.push(Math.hypot(x, y) - edgeDistance(Math.atan2(y, x), 400, 200, 40)),
      DIRECTOR,
      null,
      (a) => edgeDistance(a, 400, 200, 40),
    );
    for (const p of points) expect(Math.abs(p)).toBeLessThan(1e-6);
  });
});

describe('softer endings', () => {
  const step = 0.1;
  const input = { time: 100, rate: 5, room: 1000 };
  const spawnedOver = (d: SpawnDirector, sec: number) => {
    let n = 0;
    for (let t = 0; t < sec; t += step) for (const o of d.update(step, input).orders) n += o.count;
    return n;
  };

  it('a calm is a breather right away, and the stream comes back after it', () => {
    const d = new SpawnDirector(createRng(1));
    spawnedOver(d, 30);
    d.calm(8);
    expect(d.phase).toBe('breather');
    expect(spawnedOver(d, 7.5)).toBeLessThan(5 * 8 * DIRECTOR.breatherMult + 2);
    expect(spawnedOver(d, 20)).toBeGreaterThan(20);
  });

  it('announces the last surge once, then nothing new comes', () => {
    const d = new SpawnDirector(createRng(2));
    spawnedOver(d, 10);
    d.finale();
    d.finale();
    const first = d.update(step, input);
    expect(first.announce?.text).toBe(DIRECTOR.finaleText);
    expect(d.update(step, input).announce).toBeNull();
    // Warning and surge, then quiet for good.
    spawnedOver(d, DIRECTOR.surges.swarm.warningSec + DIRECTOR.surges.swarm.surgeSec + 0.5);
    expect(d.finaleState).toBe('over');
    expect(spawnedOver(d, 60)).toBe(0);
  });

  it('the last surge brings enemies', () => {
    const d = new SpawnDirector(createRng(3));
    d.finale();
    expect(spawnedOver(d, DIRECTOR.surges.swarm.warningSec + DIRECTOR.surges.swarm.surgeSec)).toBeGreaterThan(
      10,
    );
  });

  it('no calm interrupts the last surge', () => {
    const d = new SpawnDirector(createRng(4));
    d.finale();
    d.calm(8);
    expect(d.phase).toBe('warning');
  });
});
