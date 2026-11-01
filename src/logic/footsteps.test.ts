import { describe, expect, it } from 'vitest';
import { FOOTSTEPS } from '../config/footsteps';
import { footstepsOf } from './footsteps';
import { hexToPixelFlat } from './hex';

describe('footsteps', () => {
  it('has none for a path without a move', () => {
    expect(footstepsOf([])).toEqual([]);
    expect(footstepsOf(['0,0'])).toEqual([]);
    expect(footstepsOf(['0,0', '0,0'])).toEqual([]);
  });

  it('lays steps between the hex centres, none right on a centre', () => {
    const steps = footstepsOf(['0,0', '1,0']);
    const end = hexToPixelFlat({ q: 1, r: 0 }, 1);
    expect(steps.length).toBe(Math.round(Math.hypot(end.x, end.y) / FOOTSTEPS.spacing));
    for (const s of steps) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(end.x);
      expect(Math.hypot(s.x, s.y)).toBeGreaterThan(FOOTSTEPS.sideOffset);
    }
  });

  it('points the steps in the direction of travel', () => {
    // Along +q in a flat-top layout the way goes right and a little down.
    const east = footstepsOf(['0,0', '1,0'])[0];
    expect(Math.cos(east.angle)).toBeGreaterThan(0);
    // Along -r the way goes straight up.
    const north = footstepsOf(['0,0', '0,-1'])[0];
    expect(north.angle).toBeCloseTo(-Math.PI / 2);
    const back = footstepsOf(['0,-1', '0,0'])[0];
    expect(back.angle).toBeCloseTo(Math.PI / 2);
  });

  it('alternates left and right foot, also across hexes', () => {
    const steps = footstepsOf(['0,0', '1,0', '2,0']);
    expect(steps.length).toBeGreaterThan(3);
    for (let i = 1; i < steps.length; i++) expect(steps[i].side).toBe(steps[i - 1].side === 1 ? -1 : 1);
  });

  it('sets the two feet on opposite sides of the line', () => {
    const [a, b] = footstepsOf(['0,0', '0,-1']);
    // Going straight up, the right foot is at a larger x than the left foot.
    const right = a.side === 1 ? a : b;
    const left = a.side === 1 ? b : a;
    expect(right.x).toBeGreaterThan(left.x);
  });

  it('fades older steps and keeps the newest strongest', () => {
    const path = Array.from({ length: 12 }, (_, i) => `${i},0`);
    const steps = footstepsOf(path);
    expect(steps.length).toBeGreaterThan(FOOTSTEPS.fadeSteps);
    expect(steps[steps.length - 1].alpha).toBeCloseTo(FOOTSTEPS.alphaNewest);
    expect(steps[0].alpha).toBeCloseTo(FOOTSTEPS.alphaOldest);
    for (let i = 1; i < steps.length; i++) expect(steps[i].alpha).toBeGreaterThanOrEqual(steps[i - 1].alpha);
  });

  it('assigns each step to the hex it lies in', () => {
    const steps = footstepsOf(['0,0', '1,0']);
    expect(new Set(steps.map((s) => s.key))).toEqual(new Set(['0,0', '1,0']));
    expect(steps[0].key).toBe('0,0');
    expect(steps[steps.length - 1].key).toBe('1,0');
  });

  it('shifts a way walked again sideways', () => {
    const once = footstepsOf(['0,0', '0,-1']);
    const twice = footstepsOf(['0,0', '0,-1', '0,0', '0,-1']);
    const first = once[0];
    // Third trip over the same hexes (after the way back): same direction, one lane over.
    const again = twice[once.length * 2];
    expect(again.angle).toBeCloseTo(first.angle);
    expect(again.y).toBeCloseTo(first.y);
    expect(Math.abs(again.x - first.x)).toBeGreaterThan(FOOTSTEPS.repeatOffset * 0.5);
  });

  it('does not join hexes that are not neighbours', () => {
    expect(footstepsOf(['0,0', '2,0'])).toEqual([]);
    const steps = footstepsOf(['0,0', '2,0', '3,0']);
    expect(steps.every((s) => s.key === '2,0' || s.key === '3,0')).toBe(true);
    expect(steps.length).toBeGreaterThan(0);
  });
});
