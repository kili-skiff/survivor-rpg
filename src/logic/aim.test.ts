import { describe, expect, it } from 'vitest';
import { coneCos, fanOffset, inCone } from './aim';

describe('inCone', () => {
  const cos = coneCos(45);

  it('accepts what lies straight ahead', () => {
    expect(inCone(100, 0, 1, 0, cos)).toBe(true);
  });

  it('accepts offsets inside the angle and rejects those outside', () => {
    expect(inCone(100, 90, 1, 0, cos)).toBe(true);
    expect(inCone(100, 110, 1, 0, cos)).toBe(false);
  });

  it('rejects what is behind', () => {
    expect(inCone(-100, 0, 1, 0, cos)).toBe(false);
  });

  it('works for any direction, not only along an axis', () => {
    const d = Math.SQRT1_2;
    expect(inCone(50, -50, d, -d, cos)).toBe(true);
    expect(inCone(-50, 50, d, -d, cos)).toBe(false);
  });

  it('counts a spot right on the player as inside', () => {
    expect(inCone(0, 0, 1, 0, cos)).toBe(true);
  });

  it('a half angle of 180° takes everything', () => {
    expect(inCone(-100, 0, 1, 0, coneCos(180))).toBe(true);
  });
});

describe('fanOffset', () => {
  it('sends the first shot straight and the others to alternating sides', () => {
    expect([0, 1, 2, 3, 4].map((k) => fanOffset(k, 0.2))).toEqual([0, 0.2, -0.2, 0.4, -0.4]);
  });

  it('treats a negative index like the first shot', () => {
    expect(fanOffset(-3, 0.2)).toBe(0);
  });
});
