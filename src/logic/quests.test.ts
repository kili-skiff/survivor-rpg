import { describe, expect, it } from 'vitest';
import { SEASON } from '../config/world';
import { hexKey, hexNeighbors, parseHexKey } from './hex';
import {
  acceptTowerQuest,
  freshQuests,
  parseQuests,
  questMarked,
  questRevealed,
  questsAfterMove,
  questsOnArrival,
  scoutAvailable,
  talkToScout,
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
    expect(questRevealed(freshQuests(), world)).toEqual([]);
    expect(questRevealed(active, world)).toEqual([world.tower]);
    const told = talkToScout(active);
    expect(questRevealed(told, world)).toEqual([world.tower, world.roadCamp]);
    expect(questMarked(told, world, progress)).toEqual([world.tower, world.roadCamp]);
    // The camp mark goes away once the camp is a waypoint.
    expect(questMarked(told, world, addWaypoint(progress, world.roadCamp!))).toEqual([world.tower]);
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
    expect(questRevealed(done, world)).toContain(world.tower);
  });

  it('is saved and survives broken data', () => {
    expect(parseQuests(null)).toEqual(freshQuests());
    expect(parseQuests({ tower: 'weird', scoutTalked: 'yes' })).toEqual(freshQuests());
    const save = { ...emptySave(), quests: { tower: 'active' as const, scoutTalked: true } };
    expect(migrate(JSON.parse(JSON.stringify(save))).quests).toEqual(save.quests);
    expect(migrate({ version: 6 }).quests).toEqual(freshQuests());
  });
});
