import { describe, expect, it } from 'vitest';
import { coneCos, inCone } from './aim';

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
