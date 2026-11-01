// Dev only: the test arena's numbers (no Phaser, tested). See devMode.ts for how to remove dev tools.

import { MODIFIERS, type ModifierId } from '../config/modifiers';
import type { WeaponId } from '../config/types';
import { WEAPONS } from '../config/weapons';

/** The test arena: a fight outside the map that saves nothing, to compare weapons and builds. */
export const ARENA = {
  /** Horde: the rings to choose from */
  minRing: 1,
  maxRing: 6,
  /** Dummies: how many stand around the player, at which distances (px, taking turns; close ones for aura
   * and blades, far ones for ranged weapons) and how much health they have */
  dummies: 8,
  dummyRadii: [65, 150],
  dummyHp: 1e9,
  /** Damage per second is measured over this window (ms) */
  dpsWindowMs: 10000,
  /** How long the arena's countdown shows (it never ends the fight) */
  durationSec: 99 * 60,
};

export type ArenaMode = 'horde' | 'dummies';

/** Where damage came from: a weapon or modifier id, or 'other' (skills, thorns, boons). */
export type DamageSource = string;

/** A readable name for a damage source. */
export function sourceName(source: DamageSource): string {
  if (source === 'other') return 'Skills & other';
  if (source in WEAPONS) return WEAPONS[source as WeaponId].name;
  if (source in MODIFIERS) return MODIFIERS[source as ModifierId].name;
  return source;
}

/** Adds up damage: per second over a sliding window, in total and per source. */
export class DamageMeter {
  private events: { t: number; amount: number }[] = [];
  private bySource = new Map<DamageSource, number>();
  private startedAt: number | null = null;
  total = 0;
  kills = 0;

  constructor(private readonly windowMs = ARENA.dpsWindowMs) {}

  add(source: DamageSource, amount: number, now: number): void {
    if (amount <= 0) return;
    this.startedAt ??= now;
    this.total += amount;
    this.bySource.set(source, (this.bySource.get(source) ?? 0) + amount);
    this.events.push({ t: now, amount });
  }

  kill(now: number): void {
    this.startedAt ??= now;
    this.kills += 1;
  }

  /** Damage per second over the last window (or since the first hit, when that is shorter). */
  dps(now: number): number {
    const from = now - this.windowMs;
    let i = 0;
    while (i < this.events.length && this.events[i].t < from) i++;
    if (i > 0) this.events.splice(0, i);
    if (this.startedAt === null) return 0;
    const span = Math.max(1000, Math.min(this.windowMs, now - this.startedAt));
    return (this.events.reduce((s, e) => s + e.amount, 0) * 1000) / span;
  }

  /** Kills per minute since the meter started (or was reset). */
  killsPerMinute(now: number): number {
    if (this.startedAt === null) return 0;
    return (this.kills * 60000) / Math.max(5000, now - this.startedAt);
  }

  /** The sources by damage dealt, largest first, with their share of the total. */
  shares(): { source: DamageSource; total: number; share: number }[] {
    return [...this.bySource.entries()]
      .map(([source, total]) => ({ source, total, share: this.total > 0 ? total / this.total : 0 }))
      .sort((a, b) => b.total - a.total);
  }

  reset(): void {
    this.events = [];
    this.bySource.clear();
    this.startedAt = null;
    this.total = 0;
    this.kills = 0;
  }
}

/** Short number: 950, 12.3k, 4.5M. */
export function shortNumber(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

export interface ArenaReadout {
  mode: ArenaMode;
  ring: number;
  falls: number;
  meter: DamageMeter;
  now: number;
}

/** The lines the arena adds to the dev readout. */
export function arenaLines(r: ArenaReadout): string[] {
  const where = r.mode === 'horde' ? `horde · ring ${r.ring}` : 'dummies';
  const lines = [
    `ARENA ${where} · fell ${r.falls}×`,
    `${shortNumber(r.meter.dps(r.now))} dps · ${shortNumber(r.meter.total)} total · ${Math.round(r.meter.killsPerMinute(r.now))} kills/min`,
  ];
  for (const s of r.meter.shares().slice(0, 5)) {
    lines.push(`  ${sourceName(s.source)} ${Math.round(s.share * 100)}%`);
  }
  return lines;
}

/** Where the dummies stand: evenly around (x, y), taking turns between the distances in `radii`. */
export function dummyPositions(
  x: number,
  y: number,
  count = ARENA.dummies,
  radii: readonly number[] = ARENA.dummyRadii,
): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const r = radii[i % radii.length];
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
  });
}

/** The next ring for the horde, kept within the arena's rings. */
export function stepRing(ring: number, delta: number): number {
  return Math.min(ARENA.maxRing, Math.max(ARENA.minRing, ring + delta));
}

/** What the running test arena keeps. */
export interface ArenaState {
  mode: ArenaMode;
  ring: number;
  /** How often the player "fell" (in the arena that refills health instead) */
  falls: number;
  meter: DamageMeter;
}

export function newArenaState(ring = ARENA.minRing): ArenaState {
  return { mode: 'horde', ring, falls: 0, meter: new DamageMeter() };
}
