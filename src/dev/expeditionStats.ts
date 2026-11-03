// Dev: statistics of the last expedition as one block of text to copy and paste into a chat.
// Pure (no Phaser): a recorder per fight, a log of the fights of one expedition and the text. Saved apart from
// the game's save (its own key), so it needs no save migration and "reset save" does not touch it.

import { RINGS, SPAWN, BALANCE, CHEST } from '../config/balance';
import { SEASON } from '../config/world';
import { formatTime } from '../logic/progression';
import { buildSummary, shortNumber, sourceName, type DamageSource } from './arenaLogic';
import type { Loadout } from '../logic/stats';

/** Where the log is kept (device storage, not part of the game's save) */
export const EXPEDITION_STATS_KEY = 'survivor-rpg.dev.expeditionStats';

/** Health below this share counts as a close call ("dip") ... */
export const DIP_BELOW = 0.3;
/** ...and the next dip only counts after health was back above this share. */
export const DIP_RESET = 0.5;

export type FightEnd = 'cleared' | 'fallen';

/** One fight of the expedition, as it is kept and printed. */
export interface FightLog {
  /** Where: ring, biome and what the goal was */
  ring: number;
  biome: string;
  goal: string;
  outcome: FightEnd;
  timeSec: number;
  levelFrom: number;
  levelTo: number;
  /** Seconds into the fight at which each level was reached */
  levelUps: { level: number; at: number }[];
  kills: number;
  peakEnemies: number;
  avgEnemies: number;
  /** Health lost in total as a share of maximum health (heals refill, so it can pass 100) */
  hpLostPct: number;
  /** Lowest health reached, as a share of maximum */
  minHpPct: number;
  /** Times health dropped below `DIP_BELOW` */
  dips: number;
  chests: number;
  embers: number;
  potions: number;
  /** Damage dealt in total and by source (largest first) */
  damage: number;
  shares: { source: DamageSource; share: number }[];
  /** The build at the end of the fight (`buildSummary`) */
  build: string;
}

export type ExpeditionEnd = 'running' | 'fallen' | 'home';

/** All fights of one expedition (the last one is kept). */
export interface ExpeditionLog {
  startedAt: string;
  /** Which build of the game: "main", "pr-91" (from the address) or "dev" */
  build: string;
  seed: string;
  generator: number;
  mainWeapon: string;
  ended: ExpeditionEnd;
  fights: FightLog[];
}

/** What a fight starts with, for the recorder. */
export interface FightStart {
  ring: number;
  biome: string;
  goal: string;
  level: number;
  maxHp: number;
}

/** What the end of a fight adds from outside the recorder. */
export interface FightFinish {
  outcome: FightEnd;
  timeSec: number;
  level: number;
  embers: number;
  damage: number;
  shares: { source: DamageSource; share: number }[];
  loadout: Loadout;
}

/** Watches one fight: how many enemies, how hard it hurt, how close it got. */
export class FightRecorder {
  private enemySeconds = 0;
  private seconds = 0;
  private peak = 0;
  private lost = 0;
  private minShare = 1;
  private dips = 0;
  private inDip = false;
  private kills = 0;
  private chests = 0;
  private potions = 0;
  private readonly levelUps: { level: number; at: number }[] = [];

  constructor(private readonly start: FightStart) {}

  /** Once per frame (or so): enemies alive and health now. */
  sample(dtSec: number, enemies: number, hp: number, maxHp: number): void {
    if (dtSec <= 0) return;
    this.seconds += dtSec;
    this.enemySeconds += enemies * dtSec;
    this.peak = Math.max(this.peak, enemies);
    const share = maxHp > 0 ? Math.max(0, hp) / maxHp : 1;
    this.minShare = Math.min(this.minShare, share);
    if (!this.inDip && share < DIP_BELOW) {
      this.inDip = true;
      this.dips += 1;
    } else if (this.inDip && share > DIP_RESET) {
      this.inDip = false;
    }
  }

  damageTaken(amount: number): void {
    if (amount > 0) this.lost += amount;
  }

  kill(): void {
    this.kills += 1;
  }

  chest(): void {
    this.chests += 1;
  }

  potion(): void {
    this.potions += 1;
  }

  levelUp(level: number, atSec: number): void {
    this.levelUps.push({ level, at: Math.round(atSec) });
  }

  finish(end: FightFinish): FightLog {
    const timeSec = Math.round(end.timeSec);
    return {
      ring: this.start.ring,
      biome: this.start.biome,
      goal: this.start.goal,
      outcome: end.outcome,
      timeSec,
      levelFrom: this.start.level,
      levelTo: end.level,
      levelUps: this.levelUps,
      kills: this.kills,
      peakEnemies: this.peak,
      avgEnemies: this.seconds > 0 ? Math.round(this.enemySeconds / this.seconds) : 0,
      hpLostPct: this.start.maxHp > 0 ? Math.round((this.lost / this.start.maxHp) * 100) : 0,
      minHpPct: Math.round(this.minShare * 100),
      dips: this.dips,
      chests: this.chests,
      embers: Math.round(end.embers),
      potions: this.potions,
      damage: Math.round(end.damage),
      shares: end.shares,
      build: buildSummary(end.loadout, end.level),
    };
  }
}

/** A new, empty log for an expedition that starts now. */
export function startLog(info: { now: Date; build: string; mainWeapon: string }): ExpeditionLog {
  return {
    startedAt: info.now.toISOString(),
    build: info.build,
    seed: SEASON.seed,
    generator: SEASON.generatorVersion,
    mainWeapon: info.mainWeapon,
    ended: 'running',
    fights: [],
  };
}

/** The log with one more fight; a fall ends the expedition. */
export function addFight(log: ExpeditionLog, fight: FightLog): ExpeditionLog {
  return {
    ...log,
    ended: fight.outcome === 'fallen' ? 'fallen' : 'running',
    fights: [...log.fights, fight],
  };
}

/** The log marked as ended by going home (a fallen expedition stays fallen). */
export function markHome(log: ExpeditionLog): ExpeditionLog {
  return log.ended === 'running' ? { ...log, ended: 'home' } : log;
}

/** "pr-91" on a PR preview, "main" on the published game, "dev" on a dev server. */
export function buildName(pathname: string, isDevServer: boolean): string {
  const pr = /\/pr-preview\/(pr-\d+)/.exec(pathname);
  if (pr) return pr[1];
  return isDevServer ? 'dev' : 'main';
}

/** The numbers of the balance that matter for this text, in one line each. */
export function balanceLines(): string[] {
  const rings = RINGS.table.slice(0, 5);
  return [
    `balance: enemy speed ${BALANCE.enemySpeed} | spawn ${SPAWN.baseRate}/s (+ every ${SPAWN.growthSec}s), cap ${SPAWN.capBase}+${SPAWN.capPerRing}/ring+${SPAWN.capPerSec}/s | chests ${(CHEST.dropChance * 100).toFixed(2)}%`,
    `rings 1-${rings.length}: health x${rings.map((r) => r.hp).join(', ')} | damage x${rings.map((r) => r.damage).join(', ')} | numbers x${rings.map((r) => r.spawnRate).join(', ')}`,
  ];
}

function percent(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** One fight as a short block of lines. */
export function fightLines(n: number, f: FightLog): string[] {
  const levels = f.levelUps.map((l) => `L${l.level} ${formatTime(l.at)}`).join(', ');
  const perMin = f.timeSec > 0 ? Math.round((f.kills * 60) / f.timeSec) : 0;
  const head =
    `#${n} ring ${f.ring} ${f.biome} · ${f.goal} · ${formatTime(f.timeSec)} · ${f.outcome.toUpperCase()}` +
    ` · L${f.levelFrom}→L${f.levelTo}${levels ? ` (${levels})` : ''}`;
  const flow =
    `   ${f.kills} kills (${perMin}/min) · enemies peak ${f.peakEnemies}, avg ${f.avgEnemies}` +
    ` · health lost ${f.hpLostPct}%, lowest ${f.minHpPct}%, close calls ${f.dips}` +
    ` · chests ${f.chests} · potions ${f.potions} · embers ${f.embers}`;
  const dps = f.timeSec > 0 ? f.damage / f.timeSec : 0;
  const shares = f.shares
    .slice(0, 6)
    .map((s) => `${sourceName(s.source)} ${percent(s.share)}`)
    .join(', ');
  const dmg = `   damage ${shortNumber(f.damage)} (${shortNumber(dps)}/s)${shares ? `: ${shares}` : ''}`;
  return [head, flow, dmg, `   build: ${f.build}`];
}

/** The whole log as text to paste: header, balance, one block per fight, summary. */
export function logText(log: ExpeditionLog, now: Date): string {
  const total = log.fights.reduce((s, f) => s + f.timeSec, 0);
  const last = log.fights[log.fights.length - 1];
  const result =
    log.ended === 'fallen'
      ? `fell in fight ${log.fights.length} (ring ${last?.ring})`
      : log.ended === 'home'
        ? 'went home'
        : 'still out there';
  const lines = [
    'NIGHTWATCH EXPEDITION STATS',
    `copied ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC · started ${log.startedAt.slice(0, 16).replace('T', ' ')} UTC · game ${log.build} · seed ${log.seed} (generator ${log.generator})`,
    ...balanceLines(),
    `main weapon ${log.mainWeapon} · ${log.fights.length} fights, ${formatTime(total)} in fights · ${result}`,
    '',
  ];
  log.fights.forEach((f, i) => lines.push(...fightLines(i + 1, f)));
  if (log.fights.length === 0) lines.push('(no fight finished yet)');
  return lines.join('\n');
}

/** Reads the log back from storage; anything that does not look like a log gives null. */
export function parseLog(raw: string | null | undefined): ExpeditionLog | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ExpeditionLog> | null;
    if (!v || typeof v !== 'object' || !Array.isArray(v.fights) || typeof v.startedAt !== 'string')
      return null;
    return v as ExpeditionLog;
  } catch {
    return null;
  }
}

/** The part of localStorage used here (the same as the save's). */
export interface StatsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadLog(storage: StatsStorage | undefined): ExpeditionLog | null {
  try {
    return parseLog(storage?.getItem(EXPEDITION_STATS_KEY));
  } catch {
    return null;
  }
}

export function saveLog(storage: StatsStorage | undefined, log: ExpeditionLog): void {
  try {
    storage?.setItem(EXPEDITION_STATS_KEY, JSON.stringify(log));
  } catch {
    // Storage full or blocked: the stats are only a convenience.
  }
}
