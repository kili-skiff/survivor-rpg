import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../config/enemies';
import { leapAt, newChargeState, stepCharge, windupProgress, type ChargeParams } from './charge';

const P: ChargeParams = {
  kind: 'charge',
  range: 200,
  windupSec: 0.5,
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

  it('fixes the landing spot when the warning starts', () => {
    const s = newChargeState();
    stepCharge(s, P, 0, 0, 0, 150, 0);
    expect([s.targetX, s.targetY]).toEqual([0, 150]);
    // The player runs off: the spot stays.
    stepCharge(s, P, 0, 0, 300, -50, 200);
    expect([s.targetX, s.targetY]).toEqual([0, 150]);
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
