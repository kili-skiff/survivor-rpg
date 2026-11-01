import { describe, expect, it } from 'vitest';
// The symbols are drawn in code, so the test reads the source of the scene that draws them.
import boot from '../scenes/BootScene.ts?raw';
import { REWARDS } from '../config/rewards';
import type { RewardKind } from '../config/types';
import { planHerbBlooms } from './herbs';
import { createRng } from './rng';
import { rewardForHex, rewardLabel, rewardsFor } from './rewards';
import { createStartLoadout } from './stats';
import { describeUpgrade, rollRareOptions } from './upgrades';

describe('hex rewards', () => {
  it('bring rare cards only from their ring on', () => {
    expect(rewardsFor({ key: 'a', ring: 1, herbs: true })).not.toContain('card');
    expect(rewardsFor({ key: 'a', ring: 2, herbs: true })).toContain('card');
  });

  it('bring a herb harvest only where herbs grow', () => {
    expect(rewardsFor({ key: 'a', ring: 3, herbs: false })).not.toContain('herbs');
    expect(rewardsFor({ key: 'a', ring: 3, herbs: true })).toContain('herbs');
  });

  it('stay the same within one expedition and change between them', () => {
    const hex = { key: '2,-1', ring: 2, herbs: true };
    expect(rewardForHex(hex, 3, 'seed')).toBe(rewardForHex(hex, 3, 'seed'));
    const keys = Array.from({ length: 30 }, (_, i) => `${i},1`);
    const changed = keys.filter(
      (key) =>
        rewardForHex({ key, ring: 3, herbs: true }, 0, 'seed') !==
        rewardForHex({ key, ring: 3, herbs: true }, 1, 'seed'),
    );
    expect(changed.length).toBeGreaterThan(0);
  });

  it('roll every reward somewhere on a map', () => {
    const seen = new Set<RewardKind>();
    for (let i = 0; i < 300; i++) seen.add(rewardForHex({ key: `${i},0`, ring: 3, herbs: true }, 0, 'seed'));
    expect([...seen].sort()).toEqual((Object.keys(REWARDS.weights) as RewardKind[]).sort());
  });

  it('have a name and a drawn symbol', () => {
    for (const kind of Object.keys(REWARDS.weights) as RewardKind[]) {
      expect(rewardLabel(kind).length).toBeGreaterThan(0);
      expect(boot).toContain(`make('${REWARDS.icons[kind]}'`);
    }
  });
});

describe('the rare card reward', () => {
  it('offers only magic and legendary cards, and no one-time cards', () => {
    for (let seed = 1; seed < 20; seed++) {
      const options = rollRareOptions(createStartLoadout('bolt'), createRng(seed), 3);
      expect(options).toHaveLength(3);
      for (const o of options) {
        expect(o.kind).not.toBe('boon');
        expect(describeUpgrade(o).rarity).not.toBe('common');
      }
    }
  });
});

describe('the herb harvest reward', () => {
  it('lets twice as many herbs bloom', () => {
    const plain = planHerbBlooms('forest', 3, 90, createRng(1));
    const harvest = planHerbBlooms('forest', 3, 90, createRng(1), REWARDS.herbsMul);
    expect(harvest.length).toBe(plain.length * REWARDS.herbsMul);
  });
});
