import { describe, expect, it } from 'vitest';
import { readStick, STICK_FOLLOW } from './stick';

describe('touch stick', () => {
  it('is still inside the dead zone', () => {
    const r = readStick(100, 100, 103, 100, 50);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it('grows with the distance up to full speed at the radius', () => {
    expect(readStick(0, 0, 25, 0, 50).x).toBeCloseTo(0.5);
    expect(readStick(0, 0, 0, 50, 50).y).toBeCloseTo(1);
    expect(readStick(0, 0, 0, 60, 50).y).toBeCloseTo(1);
  });

  it('pulls the base along when the thumb goes far out', () => {
    const r = readStick(0, 0, 200, 0, 50);
    expect(r.originX).toBeCloseTo(200 - 50 * STICK_FOLLOW);
    expect(r.originY).toBe(0);
    expect(r.x).toBeCloseTo(1);
  });

  it('keeps the base while the thumb stays close', () => {
    const r = readStick(10, 20, 40, 20, 50);
    expect(r.originX).toBe(10);
    expect(r.originY).toBe(20);
  });
});
