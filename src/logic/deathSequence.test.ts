import { describe, expect, it } from 'vitest';
import { DEATH } from '../config/death';
import { deathFrame } from './deathSequence';

describe('death sequence', () => {
  it('starts with a burning lantern in the usual night', () => {
    const f = deathFrame(0, 0);
    expect(f.light).toBeGreaterThan(0.95);
    expect(f.light).toBeLessThanOrEqual(1.01);
    expect(f.envelope).toBe(1);
    expect(f.black).toBe(0);
    expect(f.out).toBe(false);
  });

  it('is out and black at the end', () => {
    const f = deathFrame(1, 1234);
    expect(f.light).toBe(0);
    expect(f.envelope).toBe(0);
    expect(f.out).toBe(true);
    expect(f.black).toBe(1);
  });

  it('goes out before the screen is fully black', () => {
    const f = deathFrame(DEATH.outAt, 0);
    expect(f.out).toBe(true);
    expect(f.black).toBeLessThan(1);
  });

  it('takes its time: a third of the way in, the light has hardly gone', () => {
    expect(deathFrame(0.33, 0).envelope).toBeGreaterThan(0.45);
    expect(deathFrame(0.33, 0).black).toBe(0);
  });

  it('shrinks the light circle steadily, never back up', () => {
    let last = 1;
    for (let p = 0; p <= 1; p += 0.005) {
      const e = deathFrame(p, 0).envelope;
      expect(e).toBeLessThanOrEqual(last + 1e-9);
      last = e;
    }
  });

  it('never makes the light circle jump from one frame to the next', () => {
    const frameMs = 16;
    let last = deathFrame(0, 0).envelope;
    for (let t = frameMs; t <= DEATH.fadeMs; t += frameMs) {
      const e = deathFrame(t / DEATH.fadeMs, t).envelope;
      expect(Math.abs(e - last)).toBeLessThan(0.01);
      last = e;
    }
  });

  it('never makes the flame itself jump hard from one frame to the next', () => {
    const frameMs = 16;
    let last = deathFrame(0, 0).light;
    for (let t = frameMs; t <= DEATH.fadeMs; t += frameMs) {
      const l = deathFrame(t / DEATH.fadeMs, t).light;
      expect(Math.abs(l - last)).toBeLessThan(0.06);
      last = l;
    }
  });

  it('gets weaker over time, whatever the flicker does', () => {
    for (let t = 0; t < 2000; t += 37) {
      expect(deathFrame(0.75, t).light).toBeLessThan(deathFrame(0.1, t).light);
    }
  });

  it('gasps a little at its moments, but never flares up to more than it had', () => {
    const mean = (p: number) => {
      let sum = 0;
      let n = 0;
      for (let t = 0; t < 4000; t += 7) {
        const f = deathFrame(p, t);
        sum += f.light / f.envelope;
        n += 1;
      }
      return sum / n;
    };
    for (const g of DEATH.gasps) {
      // Relative to the light circle, the flame is brighter at its gasp than a little before it...
      expect(mean(g.at)).toBeGreaterThan(mean(g.at - 0.08));
      // ...and still never brighter than at the start.
      for (let t = 0; t < 2000; t += 37) expect(deathFrame(g.at, t).light).toBeLessThan(1);
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
