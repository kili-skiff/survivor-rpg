import { describe, expect, it } from 'vitest';
import { REBIRTH, REBIRTH_TOTAL_MS } from '../config/rebirth';
import { rebirthFrame } from './rebirth';

describe('rebirth', () => {
  it('starts dark: no fire yet, nobody there, the lantern out', () => {
    const f = rebirthFrame(0);
    expect(f.fire).toBe(0);
    expect(f.body).toBe(0);
    expect(f.glow).toBe(0);
    expect(f.lantern).toBe(0);
    expect(f.walk).toBe(0);
    expect(f.done).toBe(false);
  });

  it('has the fire at its peak before the watchman appears', () => {
    expect(rebirthFrame(REBIRTH.fireUpMs).fire).toBeCloseTo(1, 5);
    expect(rebirthFrame(REBIRTH.riseFrom - 1).body).toBeLessThan(0.01);
  });

  it('shows him more and more, glowing at first and cooling to his own colours', () => {
    let last = 0;
    for (let t = 0; t <= REBIRTH_TOTAL_MS; t += 25) {
      const b = rebirthFrame(t).body;
      expect(b).toBeGreaterThanOrEqual(last);
      last = b;
    }
    expect(rebirthFrame(REBIRTH.riseFrom + REBIRTH.riseMs / 2).glow).toBeGreaterThan(0.8);
    expect(rebirthFrame(REBIRTH.glowFrom + REBIRTH.glowMs).glow).toBe(0);
  });

  it('is hunched and trembling when he appears, gets up only part of the way and stays bent while walking', () => {
    const start = rebirthFrame(REBIRTH.getUpFrom);
    expect(start.hunch).toBe(1);
    expect(start.tremble).toBeGreaterThan(0.9);
    const walking = rebirthFrame(REBIRTH.walkFrom + REBIRTH.walkMs / 2);
    expect(walking.hunch).toBeCloseTo(REBIRTH.hunchWalk, 5);
    expect(walking.tremble).toBeGreaterThan(0);
    expect(walking.tremble).toBeLessThan(start.tremble);
  });

  it('straightens up and stops trembling at the end', () => {
    const f = rebirthFrame(REBIRTH_TOTAL_MS);
    expect(f.hunch).toBe(0);
    expect(f.tremble).toBe(0);
    expect(f.done).toBe(true);
    expect(rebirthFrame(REBIRTH_TOTAL_MS - 1).done).toBe(false);
  });

  it('flinches hard at the moments of pain and calms down quickly', () => {
    for (const at of REBIRTH.flinchAt) {
      expect(rebirthFrame(at).flinch).toBeGreaterThan(0.9);
      expect(rebirthFrame(at + REBIRTH.flinchMs * 6).flinch).toBeLessThan(0.1);
    }
    expect(rebirthFrame(100).flinch).toBe(0);
  });

  it('staggers out in lunges: forward only, with pauses in between', () => {
    expect(rebirthFrame(REBIRTH.walkFrom).walk).toBe(0);
    expect(rebirthFrame(REBIRTH.walkFrom + REBIRTH.walkMs).walk).toBe(1);
    let last = 0;
    let moving = 0;
    let standing = 0;
    for (let t = REBIRTH.walkFrom; t < REBIRTH.walkFrom + REBIRTH.walkMs; t += 10) {
      const f = rebirthFrame(t);
      expect(f.walk).toBeGreaterThanOrEqual(last);
      last = f.walk;
      if (f.stepping) moving += 1;
      else standing += 1;
    }
    expect(moving).toBeGreaterThan(standing);
    expect(standing).toBeGreaterThan(0);
  });

  it('leans one way, then the other, from step to step', () => {
    const leans = new Set<number>();
    for (let t = REBIRTH.walkFrom; t < REBIRTH.walkFrom + REBIRTH.walkMs; t += 10)
      leans.add(rebirthFrame(t).lean);
    expect([...leans].sort()).toEqual([-1, 1]);
  });

  it('lights the lantern with a small flare above normal, ending at normal', () => {
    let peak = 0;
    for (let t = REBIRTH.lanternFrom; t <= REBIRTH_TOTAL_MS; t += 10)
      peak = Math.max(peak, rebirthFrame(t).lantern);
    expect(peak).toBeGreaterThan(1);
    expect(rebirthFrame(REBIRTH_TOTAL_MS).lantern).toBeCloseTo(1, 5);
  });

  it('has every part finished before the end', () => {
    expect(REBIRTH.fireOutAt).toBeLessThanOrEqual(REBIRTH_TOTAL_MS);
    expect(REBIRTH.lanternFrom + REBIRTH.lanternMs).toBeLessThanOrEqual(REBIRTH_TOTAL_MS);
    expect(REBIRTH.getUpFrom + REBIRTH.getUpMs).toBeLessThanOrEqual(REBIRTH.walkFrom);
    expect(REBIRTH.glowFrom + REBIRTH.glowMs).toBeLessThanOrEqual(REBIRTH_TOTAL_MS);
  });
});
