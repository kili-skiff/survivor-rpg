import { describe, expect, it } from 'vitest';
import { DEATH } from '../config/death';
import { deathFrame } from './deathSequence';

describe('death sequence', () => {
  it('starts with a burning lantern in the usual night', () => {
    const f = deathFrame(0, 0);
    expect(f.light).toBeGreaterThan(0.9);
    expect(f.light).toBeLessThanOrEqual(1);
    expect(f.black).toBe(0);
    expect(f.out).toBe(false);
  });

  it('is out and black at the end', () => {
    const f = deathFrame(1, 1234);
    expect(f.light).toBe(0);
    expect(f.out).toBe(true);
    expect(f.black).toBe(1);
  });

  it('goes out before the screen is fully black', () => {
    const f = deathFrame(DEATH.outAt, 0);
    expect(f.out).toBe(true);
    expect(f.black).toBeLessThan(1);
  });

  it('gets weaker over time, whatever the flicker does', () => {
    for (let t = 0; t < 2000; t += 37) {
      expect(deathFrame(0.75, t).light).toBeLessThan(deathFrame(0.1, t).light);
    }
  });

  it('flares up once on the way', () => {
    const plain = (1 - DEATH.flareAt / DEATH.outAt) ** 2;
    for (let t = 0; t < 2000; t += 37) {
      expect(deathFrame(DEATH.flareAt, t).light).toBeGreaterThan(plain);
    }
  });

  it('keeps the screen lit up to blackFrom, then darkens steadily', () => {
    expect(deathFrame(DEATH.blackFrom, 0).black).toBe(0);
    let last = 0;
    for (let p = DEATH.blackFrom; p <= 1; p += 0.05) {
      const b = deathFrame(p, 0).black;
      expect(b).toBeGreaterThanOrEqual(last);
      last = b;
    }
  });

  it('clamps progress outside 0..1', () => {
    expect(deathFrame(-3, 0)).toEqual(deathFrame(0, 0));
    expect(deathFrame(7, 0)).toEqual(deathFrame(1, 0));
  });
});
