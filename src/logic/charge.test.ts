import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../config/enemies';
import { dashDistance, newChargeState, stepCharge, type ChargeParams } from './charge';

const P: ChargeParams = {
  kind: 'charge',
  range: 200,
  windupSec: 0.5,
  dashSec: 0.6,
  dashSpeed: 3,
  restSec: 1,
};

describe('charge', () => {
  it('walks up until the player is in range', () => {
    const s = newChargeState();
    expect(stepCharge(s, P, 0, 0, 500, 0, 0)).toBe('approach');
    expect(stepCharge(s, P, 250, 0, 500, 0, 10)).toBe('approach');
    expect(stepCharge(s, P, 320, 0, 500, 0, 20)).toBe('windup');
  });

  it('fixes the direction of the dash when the warning starts', () => {
    const s = newChargeState();
    stepCharge(s, P, 0, 0, 0, 150, 0);
    expect(s.dirX).toBeCloseTo(0);
    expect(s.dirY).toBeCloseTo(1);
    // The player runs off: the line stays.
    stepCharge(s, P, 0, 0, 300, -50, 200);
    expect(s.dirX).toBeCloseTo(0);
    expect(s.dirY).toBeCloseTo(1);
  });

  it('goes through warning, dash and rest, then approaches again', () => {
    const s = newChargeState();
    stepCharge(s, P, 0, 0, 100, 0, 1000); // windup until 1500
    expect(stepCharge(s, P, 0, 0, 100, 0, 1499)).toBe('windup');
    expect(stepCharge(s, P, 0, 0, 100, 0, 1500)).toBe('dash'); // until 2100
    expect(stepCharge(s, P, 0, 0, 100, 0, 2099)).toBe('dash');
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

  it('copes with standing exactly on the player', () => {
    const s = newChargeState();
    expect(stepCharge(s, P, 5, 5, 5, 5, 0)).toBe('windup');
    expect(Math.hypot(s.dirX, s.dirY)).toBeCloseTo(1);
  });

  it('dashes about as far as the warning range, a little less', () => {
    const b = ENEMIES.ghoul.behavior;
    expect(b?.kind).toBe('charge');
    if (b?.kind !== 'charge') return;
    const reach = dashDistance(b, ENEMIES.ghoul.speed);
    expect(reach).toBeLessThan(b.range);
    expect(reach).toBeGreaterThan(b.range * 0.6);
    // The warning is long enough to see and short enough to stay tense.
    expect(b.windupSec).toBeGreaterThanOrEqual(0.4);
    expect(b.windupSec).toBeLessThanOrEqual(0.8);
  });
});
