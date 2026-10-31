import { describe, expect, it } from 'vitest';
// The symbols are drawn in code, so the test reads the source of the scene that draws them.
import boot from '../scenes/BootScene.ts?raw';
import { GOALS } from '../config/goals';
import type { FightGoal } from '../config/types';
import {
  advanceLighting,
  firePlacement,
  goalCounter,
  goalForHex,
  goalLabel,
  goalProgress,
  huntKills,
  isGoalDone,
  pickGoalKind,
} from './goals';

const survive: FightGoal = { kind: 'survive', durationSec: 100 };
const hunt: FightGoal = { kind: 'hunt', kills: 40 };

describe('survive', () => {
  it('is done when the time is up', () => {
    expect(isGoalDone(survive, { time: 99.9, kills: 500 })).toBe(false);
    expect(isGoalDone(survive, { time: 100, kills: 0 })).toBe(true);
    expect(goalProgress(survive, { time: 50, kills: 0 })).toBe(0.5);
  });

  it('counts down and warns only in the last seconds', () => {
    expect(goalCounter(survive, { time: 0, kills: 0 }, 10)).toEqual({ text: '01:40', warning: false });
    expect(goalCounter(survive, { time: 95, kills: 0 }, 10).warning).toBe(true);
    expect(goalCounter(survive, { time: 100, kills: 0 }, 10).warning).toBe(false);
  });
});

describe('hunt', () => {
  it('is done after enough kills, however long it takes', () => {
    expect(isGoalDone(hunt, { time: 999, kills: 39 })).toBe(false);
    expect(isGoalDone(hunt, { time: 3, kills: 40 })).toBe(true);
    expect(goalProgress(hunt, { time: 0, kills: 10 })).toBe(0.25);
  });

  it('shows the kills out of the total, never more than the total', () => {
    expect(goalCounter(hunt, { time: 0, kills: 12 }, 10)).toEqual({ text: '12 / 40', warning: false });
    expect(goalCounter(hunt, { time: 0, kills: 55 }, 10).text).toBe('40 / 40');
  });

  it('asks for more kills further out', () => {
    expect(huntKills(1)).toBe(GOALS.hunt.killsBase);
    expect(huntKills(3)).toBeGreaterThan(huntKills(2));
  });
});

describe('labels', () => {
  it('say the goal in a few words', () => {
    expect(goalLabel(survive)).toBe('Survive 01:40');
    expect(goalLabel(hunt)).toBe('Slay 40 enemies');
  });
});

describe('goals per hex', () => {
  const hex = { key: '3,-1', ring: 3 };

  it('stay the same within one expedition', () => {
    expect(goalForHex(hex, 75, 4, 'seed')).toEqual(goalForHex(hex, 75, 4, 'seed'));
  });

  it('change between expeditions for some hexes', () => {
    const keys = Array.from({ length: 30 }, (_, i) => `${i},${-i}`);
    const changed = keys.filter(
      (key) =>
        goalForHex({ key, ring: 2 }, 60, 0, 'seed').kind !== goalForHex({ key, ring: 2 }, 60, 1, 'seed').kind,
    );
    expect(changed.length).toBeGreaterThan(0);
  });

  it('roll both goals across a map, survive more often', () => {
    const kinds = Array.from(
      { length: 400 },
      (_, i) => goalForHex({ key: `${i},0`, ring: 2 }, 60, 0, 'seed').kind,
    );
    const survives = kinds.filter((k) => k === 'survive').length;
    expect(survives).toBeGreaterThan(400 * 0.5);
    expect(survives).toBeLessThan(400 * 0.8);
  });

  it('use the hex time for survive and the ring for hunt', () => {
    for (let e = 0; e < 20; e++) {
      const goal = goalForHex(hex, 75, e, 'seed');
      if (goal.kind === 'survive') expect(goal.durationSec).toBe(75);
      else if (goal.kind === 'hunt') expect(goal.kills).toBe(huntKills(3));
      else throw new Error('an ordinary hex never asks for light');
    }
  });

  it('pick by weight', () => {
    expect(pickGoalKind(0, { survive: 1, hunt: 1 })).toBe('survive');
    expect(pickGoalKind(0.99, { survive: 1, hunt: 1 })).toBe('hunt');
    expect(pickGoalKind(0.5, { survive: 0, hunt: 1 })).toBe('hunt');
  });
});

describe('goal symbols', () => {
  it('exist for every goal', () => {
    for (const texture of Object.values(GOALS.icons)) expect(boot).toContain(`make('${texture}'`);
  });
});

describe('find the light', () => {
  const light: FightGoal = { kind: 'light', litSec: 4 };
  const fireHex = { key: '4,-2', ring: 3, poi: 'watchfire' as const };

  it('is the goal of every cold watchfire, on every expedition', () => {
    for (let e = 0; e < 10; e++) expect(goalForHex(fireHex, 75, e, 'seed').kind).toBe('light');
  });

  it('is not asked again once the fire burns', () => {
    for (let e = 0; e < 10; e++) expect(goalForHex(fireHex, 75, e, 'seed', true).kind).not.toBe('light');
  });

  it('is done when the fire is lit', () => {
    expect(isGoalDone(light, { time: 500, kills: 500, lit: 0.99 })).toBe(false);
    expect(isGoalDone(light, { time: 0, kills: 0, lit: 1 })).toBe(true);
  });

  it('says what to do: find it first, then how far it is lit', () => {
    expect(goalLabel(light)).toBe('Light the watchfire');
    expect(goalCounter(light, { time: 0, kills: 0, lit: 0 }, 10).text).toBe('Find the watchfire');
    expect(goalCounter(light, { time: 0, kills: 0, lit: 0.6 }, 10).text).toBe('Lighting 60%');
  });

  it('lights while you stand next to it and drains slowly while you are away', () => {
    const params = { litSec: 4, drainSec: 10 };
    expect(advanceLighting(0, true, 1, params)).toBeCloseTo(0.25);
    expect(advanceLighting(0.5, false, 1, params)).toBeCloseTo(0.4);
    expect(advanceLighting(0.98, true, 1, params)).toBe(1);
    expect(advanceLighting(0.05, false, 1, params)).toBe(0);
  });

  it('places the fire within its distance, in any direction', () => {
    let s = 9;
    const rng = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    const params = { distanceMin: 600, distanceMax: 900 };
    const angles = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const p = firePlacement(rng, params);
      const d = Math.hypot(p.x, p.y);
      expect(d).toBeGreaterThanOrEqual(600 - 1e-9);
      expect(d).toBeLessThanOrEqual(900 + 1e-9);
      angles.add(Math.sign(p.x) * 2 + Math.sign(p.y));
    }
    expect(angles.size).toBe(4);
  });
});
