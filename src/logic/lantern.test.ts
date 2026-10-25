import { describe, expect, it } from 'vitest';
import { LANTERN } from '../config/balance';
import { handFor, restingLantern, stepLantern, type HandMotion } from './lantern';

const still: HandMotion = { vx: 0, vy: 0, ax: 0, ay: 0 };

/** Runs the lantern at 60 frames per second. */
function run(seconds: number, motion: (t: number) => HandMotion, start = restingLantern()) {
  let s = start;
  for (let t = 0; t < seconds; t += 1 / 60) s = stepLantern(s, motion(t), 1 / 60);
  return s;
}

describe('lantern physics', () => {
  it('hangs still below the hand when nothing moves', () => {
    const s = run(2, () => still);
    expect(s.x).toBeCloseTo(0, 5);
    expect(s.y).toBeCloseTo(LANTERN.drop, 5);
  });

  it('trails behind a hand that runs at a steady speed', () => {
    const s = run(3, () => ({ vx: 200, vy: 0, ax: 0, ay: 0 }));
    expect(s.x).toBeLessThan(-5);
    expect(s.x).toBeGreaterThanOrEqual(-LANTERN.leanMax - 0.5);
    expect(s.y).toBeCloseTo(LANTERN.drop, 1);
  });

  it('limits the trailing so a dash does not throw it away', () => {
    const s = run(2, () => ({ vx: 900, vy: 0, ax: 0, ay: 0 }));
    expect(s.x).toBeGreaterThanOrEqual(-LANTERN.leanMax - 0.5);
  });

  it('swings forward when the hand stops, then settles again', () => {
    let s = run(2, () => ({ vx: 200, vy: 0, ax: 0, ay: 0 }));
    const before = s.x;
    // The hand brakes in one frame: the lantern swings on.
    s = stepLantern(s, { vx: 0, vy: 0, ax: -200 * 60, ay: 0 }, 1 / 60);
    let maxX = s.x;
    for (let i = 0; i < 20; i++) {
      s = stepLantern(s, still, 1 / 60);
      maxX = Math.max(maxX, s.x);
    }
    expect(maxX).toBeGreaterThan(before + 3);
    s = run(4, () => still, s);
    expect(Math.abs(s.x)).toBeLessThan(0.05);
    expect(s.y).toBeCloseTo(LANTERN.drop, 1);
  });

  it('never leaves the reach of its chain', () => {
    let s = restingLantern();
    for (let i = 0; i < 300; i++) {
      s = stepLantern(s, { vx: 500, vy: 0, ax: i % 2 ? 90000 : -90000, ay: 0 }, 1 / 60);
      expect(Math.hypot(s.x, s.y - LANTERN.drop)).toBeLessThanOrEqual(LANTERN.maxSwing + 1e-6);
    }
  });

  it('stays stable and finite after one very long frame', () => {
    const s = stepLantern(restingLantern(), { vx: 300, vy: 0, ax: 5000, ay: 0 }, 5);
    expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
    expect(Math.hypot(s.x, s.y - LANTERN.drop)).toBeLessThanOrEqual(LANTERN.maxSwing + 1e-6);
  });

  it('does nothing without elapsed time', () => {
    const s = restingLantern();
    expect(stepLantern(s, { vx: 99, vy: 9, ax: 9, ay: 9 }, 0)).toBe(s);
  });
});

describe('where the lantern is held', () => {
  it('goes to the left hand when facing left, otherwise right', () => {
    expect(handFor('left').x).toBeLessThan(0);
    expect(handFor('right').x).toBeGreaterThan(0);
    expect(handFor('down').x).toBeGreaterThan(0);
    expect(handFor(null).x).toBeGreaterThan(0);
  });

  it('is behind the character only when walking away', () => {
    expect(handFor('up').behind).toBe(true);
    expect(handFor('down').behind).toBe(false);
    expect(handFor('left').behind).toBe(false);
  });
});
