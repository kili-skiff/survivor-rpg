import { describe, expect, it } from 'vitest';
import { SEASON } from '../config/world';
import { hexKey, hexNeighbors, parseHexKey } from './hex';
import {
  acceptFireQuest,
  acceptTowerQuest,
  completeFireQuest,
  nearestWatchfire,
  freshQuests,
  parseQuests,
  questGoals,
  questMarked,
  questRevealed,
  questsAfterMove,
  questsOnArrival,
  scoutAvailable,
  talkToScout,
  toggleTracking,
} from './quests';
import { emptySave, migrate } from './save';
import { generateWorld } from './worldgen';
import { addWaypoint, travelKind, walkTo } from './worldProgress';

const world = generateWorld('quest-test', SEASON.generatorVersion);
const progress = emptySave().world;

describe('tower quest', () => {
  it('is offered after the first return home and accepted at the elder', () => {
    const q = questsOnArrival(freshQuests());
    expect(q.tower).toBe('offered');
    expect(questsOnArrival({ ...q, tower: 'done' }).tower).toBe('done');
    expect(scoutAvailable(q)).toBe(false);
    expect(talkToScout(q).scoutTalked).toBe(false);
    expect(acceptTowerQuest(freshQuests()).tower).toBe('none');
    expect(acceptTowerQuest(q).tower).toBe('active');
  });

  it('reveals and marks the tower, and the road camp once the scout told you', () => {
    const active = acceptTowerQuest(questsOnArrival(freshQuests()));
    expect(questRevealed(freshQuests(), world, progress)).toEqual([]);
    expect(questRevealed(active, world, progress)).toEqual([world.tower]);
    const told = talkToScout(active);
    expect(questRevealed(told, world, progress)).toEqual([world.tower, world.roadCamp]);
    expect(questMarked(told, world, progress)).toEqual([world.tower, world.roadCamp]);
    // The camp mark goes away once the camp is a waypoint.
    expect(questMarked(told, world, addWaypoint(progress, world.roadCamp!))).toEqual([world.tower]);
  });

  it('can switch the map marks off and on', () => {
    const told = talkToScout(acceptTowerQuest(questsOnArrival(freshQuests())));
    const off = toggleTracking(told);
    expect(off.tracked).toBe(false);
    expect(questMarked(off, world, progress)).toEqual([]);
    expect(questGoals(off, world, progress)).toEqual([world.tower, world.roadCamp]);
    // Revealed hexes stay visible either way.
    expect(questRevealed(off, world, progress)).toEqual([world.tower, world.roadCamp]);
    expect(toggleTracking(off).tracked).toBe(true);
  });

  it('is done when standing next to the tower, whose gate stays sealed', () => {
    const active = acceptTowerQuest(questsOnArrival(freshQuests()));
    const tower = parseHexKey(world.tower);
    const next = hexNeighbors(tower).find((n) => world.hexes.has(hexKey(n)))!;
    const there = walkTo(progress, next);
    expect(travelKind(world, there, tower)).toBe('blocked');
    expect(questsAfterMove(active, world, progress).tower).toBe('active');
    const done = questsAfterMove(active, world, there);
    expect(done.tower).toBe('done');
    expect(questMarked(done, world, there)).toEqual([]);
    expect(questRevealed(done, world, progress)).toContain(world.tower);
  });

  it('is saved and survives broken data', () => {
    expect(parseQuests(null)).toEqual(freshQuests());
    expect(parseQuests({ tower: 'weird', scoutTalked: 'yes' })).toEqual(freshQuests());
    const save = {
      ...emptySave(),
      quests: { fire: 'done' as const, tower: 'active' as const, scoutTalked: true, tracked: false },
    };
    expect(migrate(JSON.parse(JSON.stringify(save))).quests).toEqual(save.quests);
    expect(migrate({ version: 6 }).quests).toEqual(freshQuests());
  });
});

describe('watchfire quest', () => {
  const lit = (key: string) => ({ ...progress, litWatchfires: [key] });

  it('is offered on a fresh start and accepted with the lantern', () => {
    expect(freshQuests().fire).toBe('offered');
    expect(acceptFireQuest(freshQuests()).fire).toBe('active');
    expect(acceptFireQuest({ ...freshQuests(), fire: 'done' }).fire).toBe('done');
  });

  it('points at the watchfire closest to the village', () => {
    const key = nearestWatchfire(world, progress)!;
    const fires = [...world.hexes.values()].filter((h) => h.poi === 'watchfire');
    expect(fires.length).toBeGreaterThan(0);
    const ring = Math.min(...fires.map((h) => h.ring));
    expect(world.hexes.get(key)!.ring).toBe(ring);
    // Once lit, the next closest one is meant.
    expect(nearestWatchfire(world, lit(key))).not.toBe(key);
  });

  it('shows the goal on the map only while the quest is active', () => {
    const key = nearestWatchfire(world, progress)!;
    const active = acceptFireQuest(freshQuests());
    expect(questMarked(freshQuests(), world, progress)).toEqual([]);
    expect(questMarked(active, world, progress)).toEqual([key]);
    expect(questRevealed(active, world, progress)).toEqual([key]);
    expect(questMarked({ ...active, fire: 'done' }, world, progress)).toEqual([]);
  });

  it('pays embers once, when the first watchfire is lit', () => {
    const active = acceptFireQuest(freshQuests());
    expect(completeFireQuest(active, false)).toEqual({ quests: active, embers: 0 });
    const done = completeFireQuest(active, true);
    expect(done.quests.fire).toBe('done');
    expect(done.embers).toBeGreaterThan(0);
    expect(completeFireQuest(done.quests, true).embers).toBe(0);
    expect(completeFireQuest(freshQuests(), true).embers).toBe(0);
  });

  it('is skipped by saves that are already further along', () => {
    expect(parseQuests({ tower: 'active' }).fire).toBe('done');
    expect(parseQuests({ tower: 'none' }).fire).toBe('offered');
    expect(parseQuests({ fire: 'active', tower: 'none' }).fire).toBe('active');
  });
});
