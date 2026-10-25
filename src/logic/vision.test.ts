import { describe, expect, it } from 'vitest';
import { BALANCE, LIGHT } from '../config/balance';
import { shotLifetimeMs, visionRange } from './vision';

describe('vision', () => {
  it('aims as far as the light reaches in the dark', () => {
    expect(visionRange(1, false)).toBeCloseTo(LIGHT.radius * LIGHT.visionReach);
    expect(visionRange(1, false)).toBeLessThan(BALANCE.boltRange);
  });

  it('grows with a better lantern, but never past the weapon range', () => {
    expect(visionRange(1.7, false)).toBeGreaterThan(visionRange(1, false));
    expect(visionRange(10, false)).toBe(BALANCE.boltRange);
  });

  it('uses the full weapon range when the whole screen is lit', () => {
    expect(visionRange(1, true)).toBe(BALANCE.boltRange);
  });

  it('lets shots fly only about as long as they can reach', () => {
    expect(shotLifetimeMs(200, 400, 1600, 0)).toBe(500);
    expect(shotLifetimeMs(2000, 400, 1600)).toBe(1600);
    expect(shotLifetimeMs(200, 0, 1600)).toBe(1600);
  });
});
