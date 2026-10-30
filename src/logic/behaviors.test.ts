import { describe, expect, it } from 'vitest';
import { SWARM } from '../config/balance';
import { ENEMIES } from '../config/enemies';
import type { EnemyDef } from '../config/types';
import { steeringFor } from './behaviors';
import { createRng } from './rng';
import { pickEnemy } from './spawning';

describe('steering from behaviour', () => {
  it('keeps the usual drift and goes straight for a chaser, or when nothing is set', () => {
    const plain = { arc: 0, lead: 0, wobble: SWARM.wobble, wobbleHz: SWARM.wobbleHz };
    expect(steeringFor({ kind: 'chase' }, createRng(1))).toEqual(plain);
    expect(steeringFor(undefined, createRng(1))).toEqual(plain);
  });

  it('gives a flanker an arc to either side and the lead from the config', () => {
    const rng = createRng(5);
    const sides = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const s = steeringFor({ kind: 'flank', arcDeg: 40, leadSec: 1.2 }, rng);
      expect(Math.abs(s.arc)).toBeCloseTo((40 * Math.PI) / 180, 6);
      expect(s.lead).toBe(1.2);
      sides.add(Math.sign(s.arc));
    }
    expect(sides).toEqual(new Set([-1, 1]));
  });

  it('gives a flutterer its own sway', () => {
    const s = steeringFor({ kind: 'flutter', sway: 0.9, swayHz: 1.1 }, createRng(1));
    expect(s).toEqual({ arc: 0, lead: 0, wobble: 0.9, wobbleHz: 1.1 });
  });

  it('lets a charger walk up like a plain chaser', () => {
    const b = {
      kind: 'charge',
      range: 200,
      windupSec: 0.5,
      lockSec: 0.2,
      leapSec: 0.6,
      height: 40,
      landRadius: 30,
      restSec: 1,
    } as const;
    expect(steeringFor(b, createRng(1))).toEqual(steeringFor({ kind: 'chase' }, createRng(1)));
  });
});

describe('enemy behaviours in the config', () => {
  it('every type says how it moves, and the numbers make sense', () => {
    for (const def of Object.values(ENEMIES)) {
      expect(def.behavior, def.id).toBeDefined();
      const b = def.behavior!;
      if (b.kind === 'flank') {
        expect(b.arcDeg).toBeGreaterThan(0);
        expect(b.arcDeg).toBeLessThan(90);
        expect(b.leadSec).toBeGreaterThan(0);
        expect(b.leadSec).toBeLessThanOrEqual(3);
      }
      if (b.kind === 'charge') {
        expect(b.range).toBeGreaterThan(def.radius * 4);
        expect(b.windupSec).toBeGreaterThan(0);
        expect(b.leapSec).toBeGreaterThan(0);
        expect(b.landRadius).toBeGreaterThan(0);
        expect(b.restSec).toBeGreaterThan(0);
      }
      if (b.kind === 'flutter') {
        expect(b.sway).toBeGreaterThan(0);
        expect(b.sway).toBeLessThanOrEqual(2);
        expect(b.swayHz).toBeGreaterThan(0);
      }
    }
  });

  it('the types differ in how they move, not only in numbers', () => {
    const kinds = new Set(Object.values(ENEMIES).map((d) => d.behavior?.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });
});

describe('enemy types by ring', () => {
  const far: EnemyDef = { ...ENEMIES.ghoul, id: 'ghoul', minRing: 3, unlockAt: 0, weight: 1000 };
  const bat: EnemyDef = { ...ENEMIES.bat, unlockAt: 0, weight: 1 };

  it('only picks a type once the hex is far enough out', () => {
    const rng = createRng(3);
    for (let i = 0; i < 100; i++) {
      expect(pickEnemy(100, [bat, far], rng, 1).id).toBe('bat');
      expect(pickEnemy(100, [bat, far], rng, 2).id).toBe('bat');
    }
    const ids = new Set(Array.from({ length: 100 }, () => pickEnemy(100, [bat, far], rng, 3).id));
    expect(ids.has('ghoul')).toBe(true);
  });

  it('every enemy is allowed everywhere unless it says otherwise', () => {
    expect(pickEnemy(0, Object.values(ENEMIES), createRng(1)).id).toBe('bat');
  });
});
