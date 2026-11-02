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
  });
});
