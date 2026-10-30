import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../config/enemies';
import {
  ChargeGate,
  isLocked,
  leapAt,
  newChargeState,
  stepCharge,
  windupProgress,
  type ChargeParams,
} from './charge';

const P: ChargeParams = {
  kind: 'charge',
  range: 200,
  windupSec: 0.5,
  lockSec: 0.2,
  leapSec: 0.6,
  height: 40,
  landRadius: 30,
  restSec: 1,
};

describe('pounce', () => {
  it('walks up until the player is in range', () => {
    const s = newChargeState();
    expect(stepCharge(s, P, 0, 0, 500, 0, 0)).toBe('approach');
    expect(stepCharge(s, P, 250, 0, 500, 0, 10)).toBe('approach');
    expect(stepCharge(s, P, 320, 0, 500, 0, 20)).toBe('windup');
  });

  it('follows the player during the warning and freezes for the last part', () => {
    const s = newChargeState();
    stepCharge(s, P, 0, 0, 0, 150, 0); // warning from 0 to 500, locked from 300
    expect([s.targetX, s.targetY]).toEqual([0, 150]);
    stepCharge(s, P, 0, 0, 100, 100, 200);
    expect([s.targetX, s.targetY]).toEqual([100, 100]);
    expect(isLocked(s, P, 299)).toBe(false);
    expect(isLocked(s, P, 300)).toBe(true);
    // The player runs off after that: the spot stays.
    stepCharge(s, P, 0, 0, 300, -50, 350);
    expect([s.targetX, s.targetY]).toEqual([100, 100]);
  });

  it('never aims further than the leap reaches', () => {
    const s = newChargeState();
    stepCharge(s, P, 0, 0, 100, 0, 0);
    stepCharge(s, P, 0, 0, 190, 0, 100);
    stepCharge(s, P, 10, 0, 1000, 0, 150); // it is 990 away from the player now
    expect(Math.hypot(s.targetX - 10, s.targetY)).toBeCloseTo(P.range);
  });

  it('goes through warning, leap and rest, then approaches again', () => {
    const s = newChargeState();
    stepCharge(s, P, 0, 0, 100, 0, 1000); // windup until 1500
    expect(stepCharge(s, P, 0, 0, 100, 0, 1499)).toBe('windup');
    expect(stepCharge(s, P, 0, 0, 100, 0, 1500)).toBe('leap'); // until 2100
    expect(stepCharge(s, P, 0, 0, 100, 0, 2099)).toBe('leap');
    expect(stepCharge(s, P, 0, 0, 100, 0, 2100)).toBe('rest'); // until 3100
    expect(stepCharge(s, P, 0, 0, 100, 0, 3099)).toBe('rest');
    expect(stepCharge(s, P, 0, 0, 5000, 0, 3100)).toBe('approach');
  });

  it('hesitates for its own delay once the player is in range', () => {
    const s = newChargeState(800);
    expect(stepCharge(s, P, 0, 0, 100, 0, 1000)).toBe('approach');
    expect(stepCharge(s, P, 0, 0, 100, 0, 1799)).toBe('approach');
    expect(stepCharge(s, P, 0, 0, 100, 0, 1800)).toBe('windup');
  });

  it('waits while no slot is free, and starts when one is', () => {
    const s = newChargeState();
    expect(stepCharge(s, P, 0, 0, 100, 0, 0, false)).toBe('approach');
    expect(stepCharge(s, P, 0, 0, 100, 0, 5000, false)).toBe('approach');
    expect(stepCharge(s, P, 0, 0, 100, 0, 5010, true)).toBe('windup');
  });

  it('forgets the delay when the player gets out of range', () => {
    const s = newChargeState(500);
    stepCharge(s, P, 0, 0, 100, 0, 0);
    expect(s.readyAt).toBe(500);
    stepCharge(s, P, 0, 0, 900, 0, 100);
    expect(s.readyAt).toBe(-1);
  });
});

describe('the pounce gate', () => {
  it('lets the first one start at once', () => {
    expect(new ChargeGate(2, 3000).canStart(0, 0)).toBe(true);
  });

  it('holds everyone back for the global cooldown after a start', () => {
    const g = new ChargeGate(5, 3000);
    g.started(1000);
    expect(g.canStart(1000, 0)).toBe(false);
    expect(g.canStart(3999, 0)).toBe(false);
    expect(g.canStart(4000, 0)).toBe(true);
  });

  it('limits how many are busy at once, even without a cooldown', () => {
    const g = new ChargeGate(2, 0);
    g.started(0);
    expect(g.canStart(10, 1)).toBe(true);
    expect(g.canStart(10, 2)).toBe(false);
  });

  it('spaces out a group of chargers that are all ready', () => {
    const g = new ChargeGate(2, 3000);
    const group = [newChargeState(), newChargeState(), newChargeState()];
    const starts: number[] = [];
    for (let now = 0; now < 9000; now += 100) {
      for (const s of group) {
        const busy = group.filter((c) => c.phase === 'windup' || c.phase === 'leap').length;
        const was = s.phase;
        if (stepCharge(s, P, 0, 0, 100, 0, now, g.canStart(now, busy)) === 'windup' && was === 'approach') {
          g.started(now);
          starts.push(now);
        }
      }
    }
    expect(starts).toEqual([0, 3000, 6000]);
  });
});

describe('the warning and the leap', () => {
  it('fills up during the warning', () => {
    const s = newChargeState();
    stepCharge(s, P, 0, 0, 100, 0, 1000);
    expect(windupProgress(s, P, 1000)).toBeCloseTo(0);
    expect(windupProgress(s, P, 1250)).toBeCloseTo(0.5);
    expect(windupProgress(s, P, 1500)).toBeCloseTo(1);
    stepCharge(s, P, 0, 0, 100, 0, 1500);
    expect(windupProgress(s, P, 1600)).toBe(0); // not in the warning any more
  });

  it('flies in an arc from where it jumped to the landing spot', () => {
    const s = newChargeState();
    stepCharge(s, P, 10, 20, 210, 20, 0); // lands at (210, 20)
    stepCharge(s, P, 10, 20, 210, 20, 500); // jumps
    const start = leapAt(s, P, 500);
    const mid = leapAt(s, P, 800);
    const end = leapAt(s, P, 1100);
    expect([start.x, start.y, start.height]).toEqual([10, 20, 0]);
    expect(mid.x).toBeCloseTo(110);
    expect(mid.height).toBeCloseTo(P.height);
    expect([end.x, end.y]).toEqual([210, 20]);
    expect(end.height).toBeCloseTo(0);
  });

  it('is the ghoul: a leap that reaches as far as it warns, with a fair warning', () => {
    const b = ENEMIES.ghoul.behavior;
    expect(b?.kind).toBe('charge');
    if (b?.kind !== 'charge') return;
    expect(b.windupSec).toBeGreaterThanOrEqual(0.4);
    expect(b.windupSec).toBeLessThanOrEqual(0.8);
    expect(b.landRadius).toBeGreaterThan(ENEMIES.ghoul.radius);
    expect(b.height).toBeGreaterThan(0);
  });
});
