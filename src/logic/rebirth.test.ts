import { describe, expect, it } from 'vitest';
import { REBIRTH } from '../config/rebirth';
import { rebirthFrame } from './rebirth';

describe('rebirth', () => {
  it('starts dark: no fire, nobody there, the lantern out', () => {
    const f = rebirthFrame(0);
    expect(f.fire).toBe(0);
    expect(f.body).toBe(0);
    expect(f.glow).toBe(0);
    expect(f.lantern).toBe(0);
    expect(f.done).toBe(false);
  });

  it('has the fire at its peak before the watchman appears', () => {
    expect(rebirthFrame(REBIRTH.fireUpMs).fire).toBeCloseTo(1, 5);
    expect(rebirthFrame(REBIRTH.riseFrom - 1).body).toBeLessThan(0.01);
  });

  it('lets him rise glowing and cool to his own colours', () => {
    const rising = rebirthFrame(REBIRTH.riseFrom + REBIRTH.riseMs / 2);
    expect(rising.body).toBeGreaterThan(0.3);
    expect(rising.glow).toBeGreaterThan(0.8);
    const later = rebirthFrame(REBIRTH.glowFrom + REBIRTH.glowMs);
    expect(later.glow).toBe(0);
    expect(later.body).toBe(1);
  });

  it('shows him more and more, never less', () => {
    let last = 0;
    for (let t = 0; t <= REBIRTH.totalMs; t += 25) {
      const b = rebirthFrame(t).body;
      expect(b).toBeGreaterThanOrEqual(last);
      last = b;
    }
  });

  it('floats up above the fire, hovers, and is back on the ground at the end', () => {
    expect(rebirthFrame(0).lift).toBe(0);
    expect(rebirthFrame(REBIRTH.liftFrom + REBIRTH.liftMs).lift).toBeCloseTo(1, 5);
    expect(rebirthFrame((REBIRTH.liftFrom + REBIRTH.liftMs + REBIRTH.lowerFrom) / 2).lift).toBeCloseTo(1, 5);
    const end = rebirthFrame(REBIRTH.totalMs);
    expect(end.lift).toBe(0);
    expect(end.bob).toBeCloseTo(0, 10);
    expect(end.sway).toBeCloseTo(0, 10);
  });

  it('sinks steadily while landing and never goes below the ground', () => {
    let last = 1;
    for (let t = REBIRTH.lowerFrom; t <= REBIRTH.totalMs; t += 20) {
      const l = rebirthFrame(t).lift;
      expect(l).toBeLessThanOrEqual(last + 1e-9);
      expect(l).toBeGreaterThanOrEqual(0);
      last = l;
    }
  });

  it('bobs and sways only in the air, within the set range', () => {
    for (let t = 0; t <= REBIRTH.totalMs; t += 13) {
      const f = rebirthFrame(t);
      expect(Math.abs(f.bob)).toBeLessThanOrEqual(REBIRTH.bobPx * f.lift + 1e-9);
      expect(Math.abs(f.sway)).toBeLessThanOrEqual(REBIRTH.swayRad * f.lift + 1e-9);
    }
  });

  it('lights the lantern with a flare above normal, ending at normal', () => {
    let peak = 0;
    for (let t = REBIRTH.lanternFrom; t <= REBIRTH.totalMs; t += 10)
      peak = Math.max(peak, rebirthFrame(t).lantern);
    expect(peak).toBeGreaterThan(1);
    expect(rebirthFrame(REBIRTH.totalMs).lantern).toBeCloseTo(1, 5);
  });

  it('ends with the fire out and the village his again', () => {
    const f = rebirthFrame(REBIRTH.totalMs);
    expect(f.fire).toBe(0);
    expect(f.body).toBe(1);
    expect(f.done).toBe(true);
    expect(rebirthFrame(REBIRTH.totalMs - 1).done).toBe(false);
  });

  it('is finished with every part before the end', () => {
    expect(REBIRTH.fireOutAt).toBeLessThanOrEqual(REBIRTH.totalMs);
    expect(REBIRTH.lanternFrom + REBIRTH.lanternMs).toBeLessThanOrEqual(REBIRTH.totalMs);
    expect(REBIRTH.riseFrom + REBIRTH.riseMs).toBeLessThanOrEqual(REBIRTH.totalMs);
    expect(REBIRTH.lowerFrom + REBIRTH.lowerMs).toBeLessThanOrEqual(REBIRTH.totalMs);
    expect(REBIRTH.liftFrom + REBIRTH.liftMs).toBeLessThanOrEqual(REBIRTH.lowerFrom);
  });
});
