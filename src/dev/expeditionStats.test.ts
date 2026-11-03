import { describe, expect, it } from 'vitest';
import { createStartLoadout } from '../logic/stats';
import {
  addFight,
  balanceLines,
  buildName,
  DIP_BELOW,
  DIP_RESET,
  FightRecorder,
  loadLog,
  logText,
  markHome,
  parseLog,
  saveLog,
  startLog,
  type FightFinish,
  type FightStart,
  type StatsStorage,
} from './expeditionStats';

const start: FightStart = { ring: 3, biome: 'forest', goal: 'Survive 01:15', level: 5, maxHp: 100 };
const finish = (over: Partial<FightFinish> = {}): FightFinish => ({
  outcome: 'cleared',
  timeSec: 75,
  level: 7,
  embers: 12,
  damage: 5000,
  shares: [
    { source: 'bolt', share: 0.7 },
    { source: 'chain', share: 0.3 },
  ],
  loadout: createStartLoadout('bolt'),
  ...over,
});
const now = new Date('2026-11-03T14:22:00Z');

describe('FightRecorder', () => {
  it('counts enemies, kills, chests, potions and level-ups', () => {
    const r = new FightRecorder(start);
    r.sample(1, 10, 100, 100);
    r.sample(1, 30, 100, 100);
    r.kill();
    r.kill();
    r.chest();
    r.potion();
    r.levelUp(6, 20.4);
    const f = r.finish(finish());
    expect(f.peakEnemies).toBe(30);
    expect(f.avgEnemies).toBe(20);
    expect(f.kills).toBe(2);
    expect(f.chests).toBe(1);
    expect(f.potions).toBe(1);
    expect(f.levelUps).toEqual([{ level: 6, at: 20 }]);
    expect(f.levelFrom).toBe(5);
    expect(f.levelTo).toBe(7);
  });

  it('adds up the health lost, also beyond the maximum, and remembers the lowest point', () => {
    const r = new FightRecorder(start);
    r.damageTaken(60);
    r.sample(1, 5, 40, 100);
    r.damageTaken(70);
    r.sample(1, 5, 80, 100);
    r.damageTaken(0);
    const f = r.finish(finish());
    expect(f.hpLostPct).toBe(130);
    expect(f.minHpPct).toBe(40);
  });

  it('counts a close call once until health has recovered', () => {
    const r = new FightRecorder(start);
    const hp = (share: number) => r.sample(1, 1, share * 100, 100);
    hp(DIP_BELOW - 0.05);
    hp(DIP_BELOW - 0.1);
    hp((DIP_BELOW + DIP_RESET) / 2); // not recovered enough yet
    hp(DIP_BELOW - 0.05); // same dip
    hp(DIP_RESET + 0.1); // recovered
    hp(DIP_BELOW - 0.05); // a second dip
    expect(r.finish(finish()).dips).toBe(2);
  });

  it('copes with an empty fight', () => {
    const f = new FightRecorder(start).finish(finish({ timeSec: 0 }));
    expect(f.avgEnemies).toBe(0);
    expect(f.peakEnemies).toBe(0);
    expect(f.minHpPct).toBe(100);
  });
});

describe('expedition log', () => {
  const fight = (outcome: 'cleared' | 'fallen' = 'cleared') =>
    new FightRecorder(start).finish(finish({ outcome }));

  it('collects fights, a fall ends it and going home does not undo that', () => {
    let log = startLog({ now, build: 'pr-91', mainWeapon: 'bolt' });
    expect(log.ended).toBe('running');
    log = addFight(log, fight());
    expect(log.fights).toHaveLength(1);
    expect(log.ended).toBe('running');
    expect(markHome(log).ended).toBe('home');
    log = addFight(log, fight('fallen'));
    expect(log.ended).toBe('fallen');
    expect(markHome(log).ended).toBe('fallen');
  });

  it('names the game build from the address', () => {
    expect(buildName('/survivor-rpg/pr-preview/pr-91/', false)).toBe('pr-91');
    expect(buildName('/survivor-rpg/', false)).toBe('main');
    expect(buildName('/', true)).toBe('dev');
  });

  it('is kept in storage and read back, and bad data gives nothing', () => {
    const data = new Map<string, string>();
    const storage: StatsStorage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
    };
    expect(loadLog(storage)).toBeNull();
    const log = addFight(startLog({ now, build: 'main', mainWeapon: 'boomerang' }), fight());
    saveLog(storage, log);
    expect(loadLog(storage)).toEqual(log);
    expect(parseLog('not json')).toBeNull();
    expect(parseLog('{"fights": 3}')).toBeNull();
    expect(parseLog(null)).toBeNull();
    expect(loadLog(undefined)).toBeNull();
  });
});

describe('the text', () => {
  it('has the header, the balance, one block per fight and the result', () => {
    let log = startLog({ now, build: 'pr-91', mainWeapon: 'bolt' });
    const r = new FightRecorder(start);
    r.sample(1, 20, 80, 100);
    r.kill();
    r.levelUp(6, 30);
    log = addFight(log, r.finish(finish()));
    log = addFight(log, new FightRecorder({ ...start, ring: 4 }).finish(finish({ outcome: 'fallen' })));
    const text = logText(log, now);
    expect(text).toContain('NIGHTWATCH EXPEDITION STATS');
    expect(text).toContain('game pr-91');
    expect(text).toContain('2026-11-03 14:22 UTC');
    expect(text).toContain('seed nightwatch-season-');
    for (const line of balanceLines()) expect(text).toContain(line);
    expect(text).toContain('2 fights');
    expect(text).toContain('fell in fight 2 (ring 4)');
    expect(text).toContain('#1 ring 3 forest · Survive 01:15 · 01:15 · CLEARED · L5→L7 (L6 00:30)');
    expect(text).toContain('#2 ring 4');
    expect(text).toContain('Arcane Bolt 70%');
    expect(text).toContain('build: L7');
  });

  it('says so when there is no fight yet', () => {
    const text = logText(startLog({ now, build: 'main', mainWeapon: 'bolt' }), now);
    expect(text).toContain('still out there');
    expect(text).toContain('(no fight finished yet)');
  });
});
