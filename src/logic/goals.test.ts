import { describe, expect, it } from 'vitest';
import { GOALS } from '../config/goals';
import type { FightGoal } from '../config/types';
import {
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
      else expect(goal.kills).toBe(huntKills(3));
    }
  });

  it('pick by weight', () => {
    expect(pickGoalKind(0, { survive: 1, hunt: 1 })).toBe('survive');
    expect(pickGoalKind(0.99, { survive: 1, hunt: 1 })).toBe('hunt');
    expect(pickGoalKind(0.5, { survive: 0, hunt: 1 })).toBe('hunt');
  });
});
