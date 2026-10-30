import { describe, expect, it } from 'vitest';
import { HIT_EFFECTS } from '../config/balance';
import type { WeaponId } from '../config/types';
import { WEAPONS } from '../config/weapons';
import { computePlayerStats, computeWeaponStats, createStartLoadout, weaponMaxLevel } from './stats';
import {
  addPush,
  decayPush,
  inBurst,
  percentDamage,
  pushDistance,
  pushSpeed,
  splashDamage,
  type Push,
} from './hitEffects';

describe('damage as a share of health', () => {
  it('is a share of the maximum health, so it keeps up with tougher enemies', () => {
    expect(percentDamage(0.02, 100, false)).toBeCloseTo(2);
    expect(percentDamage(0.02, 300, false)).toBeCloseTo(6);
  });

  it('is nothing without a share or health', () => {
    expect(percentDamage(0, 100, false)).toBe(0);
    expect(percentDamage(0.02, 0, false)).toBe(0);
  });

  it('hurts elites only a part as much', () => {
    expect(percentDamage(0.02, 800, true)).toBeCloseTo(
      percentDamage(0.02, 800, false) * HIT_EFFECTS.percentVsElite,
    );
  });
});

describe('pushing', () => {
  it('pushes away from the source', () => {
    const p: Push = { x: 0, y: 0 };
    addPush(p, 200, 0, 0, 50, 0);
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(0);
    const q: Push = { x: 0, y: 0 };
    addPush(q, 100, 10, 10, 10, 60);
    expect(q.y).toBeCloseTo(100);
  });

  it('picks a direction when the source is right on the target', () => {
    const p: Push = { x: 0, y: 0 };
    addPush(p, 100, 5, 5, 5, 5);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(100);
  });

  it('adds up pushes, but never beyond the limit', () => {
    const p: Push = { x: 0, y: 0 };
    for (let i = 0; i < 20; i++) addPush(p, 200, 0, 0, 10, 0);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(HIT_EFFECTS.pushMax);
  });

  it('does nothing for a push of zero', () => {
    const p: Push = { x: 3, y: 4 };
    addPush(p, 0, 0, 0, 10, 0);
    expect(p).toEqual({ x: 3, y: 4 });
  });

  it('slows down and stops', () => {
    const p: Push = { x: 300, y: 0 };
    decayPush(p, 0.1);
    expect(p.x).toBeLessThan(300);
    expect(p.x).toBeGreaterThan(0);
    for (let i = 0; i < 100; i++) decayPush(p, 0.05);
    expect(p).toEqual({ x: 0, y: 0 });
  });

  it('carries as far as speed over decay, however the frames are cut up', () => {
    const run = (dt: number) => {
      const p: Push = { x: 300, y: 0 };
      let x = 0;
      for (let t = 0; t < 3; t += dt) {
        x += p.x * dt;
        decayPush(p, dt);
      }
      return x;
    };
    // Each frame moves by the speed it starts with, so finer steps land a little closer to the exact value.
    expect(run(1 / 120)).toBeGreaterThan(pushDistance(300) * 0.93);
    expect(run(1 / 120)).toBeLessThan(pushDistance(300) * 1.02);
    expect(Math.abs(run(1 / 30) - run(1 / 120))).toBeLessThan(pushDistance(300) * 0.1);
  });

  it('heavy enemies and elites move less', () => {
    expect(pushSpeed(200, 0, false)).toBe(200);
    expect(pushSpeed(200, 0.5, false)).toBe(100);
    expect(pushSpeed(200, 0, true)).toBeCloseTo(200 * (1 - HIT_EFFECTS.eliteKnockResist));
    expect(pushSpeed(200, 1, false)).toBe(0);
    expect(pushSpeed(200, 5, false)).toBe(0); // resistance is capped
    expect(pushSpeed(0, 0, false)).toBe(0);
  });
});

describe('burst', () => {
  it('hurts neighbours for a share of the hit', () => {
    expect(splashDamage(10)).toBeCloseTo(10 * HIT_EFFECTS.splashShare);
  });

  it('catches enemies whose body reaches into the circle', () => {
    expect(inBurst(50, 10, 45)).toBe(true);
    expect(inBurst(56, 10, 45)).toBe(false);
  });
});

describe('weapon data', () => {
  const player = computePlayerStats(createStartLoadout('bolt'));
  const ids = Object.keys(WEAPONS) as WeaponId[];

  it('starts without any of the tools, so they have to be earned', () => {
    for (const id of ids) {
      const s = computeWeaponStats(id, 1, player);
      expect(s.splash).toBe(0);
      expect(s.percent).toBe(0);
    }
    expect(computeWeaponStats('bolt', 1, player).knockback).toBe(0);
    expect(computeWeaponStats('aura', 1, player).knockback).toBe(0);
  });

  it('never goes below zero at any level', () => {
    for (const id of ids) {
      for (let level = 1; level <= weaponMaxLevel(id); level++) {
        const s = computeWeaponStats(id, level, player);
        expect(s.knockback).toBeGreaterThanOrEqual(0);
        expect(s.splash).toBeGreaterThanOrEqual(0);
        expect(s.percent).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives every weapon a tool against a crowd by its fifth level', () => {
    const bolt = computeWeaponStats('bolt', 5, player);
    expect(bolt.splash).toBeGreaterThan(0);
    expect(bolt.pierce).toBeGreaterThan(1);
    expect(computeWeaponStats('aura', 5, player).percent).toBeGreaterThan(0);
    expect(computeWeaponStats('aura', 5, player).knockback).toBeGreaterThan(0);
    expect(computeWeaponStats('blades', 5, player).percent).toBeGreaterThan(0);
  });

  it('describes every new step on its level-up card', () => {
    for (const id of ids) for (const step of WEAPONS[id].levels) expect(step.text.length).toBeGreaterThan(3);
  });
});
