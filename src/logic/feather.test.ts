import { describe, expect, it } from 'vitest';
import boot from '../scenes/BootScene.ts?raw';
import { EMBER_KEY, PHOENIX_FEATHER } from '../config/merchant';
import { hexKey, ORIGIN, type Hex } from './hex';
import { goHome, homeWay } from './journey';
import { buyFeather, embersOf } from './merchant';
import { emptySave, migrate, type SaveData } from './save';
import { startExpedition } from './expedition';
import { homeIsFree, lightWatchfire, walkTo } from './worldProgress';

/** A save standing on `hex` in the middle of an expedition, carrying some herbs. */
function out(hex: Hex, feathers = 0): SaveData {
  const base = emptySave();
  const world = walkTo(base.world, hex);
  return {
    ...base,
    feathers,
    world: { ...world, expedition: { ...startExpedition('0,0'), loot: { herb: 3 } } },
  };
}

const far: Hex = { q: 4, r: 0 };

describe('going home', () => {
  it('is free next to the village and at a lit watchfire', () => {
    expect(homeIsFree(out({ q: 1, r: 0 }).world)).toBe(true);
    expect(homeIsFree(out(far).world)).toBe(false);
    const fire = out(far);
    const lit = { ...fire, world: lightWatchfire(fire.world, hexKey(far), 1) };
    expect(homeIsFree(lit.world)).toBe(true);
    expect(homeWay(lit)).toBe('free');
    expect(goHome(lit)?.feathers).toBe(0);
  });

  it('far out it burns a Phoenix Feather and brings the loot home', () => {
    const save = out(far, 2);
    expect(homeWay(save)).toBe('feather');
    const home = goHome(save)!;
    expect(home.feathers).toBe(1);
    expect(home.world.position).toBe(hexKey(ORIGIN));
    expect(home.world.expedition).toBeNull();
    expect(home.stash.herb).toBe(3);
  });

  it('without a feather there is no way home from far out', () => {
    const save = out(far, 0);
    expect(homeWay(save)).toBe('none');
    expect(goHome(save)).toBeNull();
  });
});

describe('Phoenix Feather', () => {
  it('is bought at the merchant for embers, up to the most you can carry', () => {
    const r = buyFeather({ [EMBER_KEY]: PHOENIX_FEATHER.price + 4 }, 0)!;
    expect(r.feathers).toBe(1);
    expect(embersOf(r.stash)).toBe(4);
    expect(buyFeather({ [EMBER_KEY]: PHOENIX_FEATHER.price - 1 }, 0)).toBeNull();
    expect(buyFeather({ [EMBER_KEY]: 999 }, PHOENIX_FEATHER.max)).toBeNull();
    expect(boot).toContain("'icon-feather'");
  });

  it('is saved, and older saves start without', () => {
    expect(emptySave().feathers).toBe(0);
    expect(migrate({ ...emptySave(), feathers: 2 }).feathers).toBe(2);
    expect(migrate({ ...emptySave(), feathers: 99 }).feathers).toBe(PHOENIX_FEATHER.max);
    expect(migrate({ version: 18 }).feathers).toBe(0);
  });
});
