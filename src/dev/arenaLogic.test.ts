import { describe, expect, it } from 'vitest';
import {
  ARENA,
  buildSummary,
  logLine,
  DamageMeter,
  arenaLines,
  dummyPositions,
  shortNumber,
  sourceName,
  stepRing,
} from './arenaLogic';

describe('test arena', () => {
  it('measures damage per second over the window', () => {
    const m = new DamageMeter(10000);
    m.add('bolt', 100, 0);
    m.add('bolt', 100, 5000);
    // Since the first hit 10 s have passed: 200 damage over 10 s.
    expect(m.dps(10000)).toBeCloseTo(20);
    // The first hit has left the window.
    expect(m.dps(14000)).toBeCloseTo(10);
    expect(m.total).toBe(200);
  });

  it('splits the damage by source, largest first', () => {
    const m = new DamageMeter();
    m.add('bolt', 300, 0);
    m.add('sparkchain', 100, 10);
    m.add('other', 0, 20);
    const shares = m.shares();
    expect(shares.map((s) => s.source)).toEqual(['bolt', 'sparkchain']);
    expect(shares[0].share).toBeCloseTo(0.75);
  });

  it('counts kills per minute and starts over on reset', () => {
    const m = new DamageMeter();
    for (let i = 0; i < 10; i++) m.kill(i * 1000);
    expect(m.killsPerMinute(60000)).toBeCloseTo(10);
    m.reset();
    expect(m.total).toBe(0);
    expect(m.killsPerMinute(70000)).toBe(0);
    expect(m.dps(70000)).toBe(0);
  });

  it('names sources and writes short numbers', () => {
    expect(sourceName('bolt')).toBe('Arcane Bolt');
    expect(sourceName('embertrail')).toBe('Ember Trail');
    expect(sourceName('other')).toBe('Skills & other');
    expect(shortNumber(950)).toBe('950');
    expect(shortNumber(1234)).toBe('1.2k');
    expect(shortNumber(45678)).toBe('46k');
    expect(shortNumber(4.5e6)).toBe('4.5M');
  });

  it('shows mode, ring and the top sources', () => {
    const m = new DamageMeter();
    m.add('boomerang', 50, 0);
    const lines = arenaLines({ mode: 'horde', ring: 3, falls: 1, meter: m, now: 2000 });
    expect(lines[0]).toContain('ring 3');
    expect(lines[0]).toContain('fell 1×');
    expect(lines[1]).toContain('dps');
  });

  it('places the dummies on a circle and keeps the ring in range', () => {
    const spots = dummyPositions(100, 100, 4, [50, 80]);
    expect(spots[0]).toEqual({ x: 150, y: 100 });
    expect(spots.map((s) => Math.round(Math.hypot(s.x - 100, s.y - 100)))).toEqual([50, 80, 50, 80]);
    expect(stepRing(ARENA.maxRing, 1)).toBe(ARENA.maxRing);
    expect(stepRing(1, -1)).toBe(ARENA.minRing);
    expect(stepRing(2, 1)).toBe(3);
  });
});

describe('measurement log', () => {
  it('writes the build and what it did on one line', () => {
    const loadout = {
      weapons: { bolt: 4, aura: 2 },
      passives: { might: 1 },
      skills: { dash: 1, nova: 1 },
      modifiers: ['volley' as const],
    };
    const build = buildSummary(loadout, 7);
    expect(build).toBe('L7 | Arcane Bolt 4, Ember Aura 2 | mods: Volley | items: Might 1');
    const m = new DamageMeter();
    m.add('bolt', 300, 0);
    m.add('aura', 100, 0);
    const line = logLine({ mode: 'dummies', ring: 1, falls: 0, meter: m, now: 10000, build });
    expect(line).toContain('[dummies] L7');
    expect(line).toContain('40 dps');
    expect(line).toContain('Arcane Bolt 75%, Ember Aura 25%');
  });
});
