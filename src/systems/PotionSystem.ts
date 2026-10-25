import { POTION_RULES, POTIONS } from '../config/potions';
import type { PotionId } from '../config/types';
import {
  activeBuffs,
  addBuff,
  canDrink,
  potionHeal,
  takeFromBelt,
  type ActiveBuff,
  type Belt,
} from '../logic/potions';

export interface DrinkResult {
  id: PotionId;
  /** Health to restore at once */
  heal: number;
  /** True when a buff started, so stats must be recomputed */
  buffStarted: boolean;
}

/**
 * The potions carried in this fight and the buffs they give.
 * The GameScene asks it to drink and applies the result to the run.
 */
export class PotionSystem {
  private buffs: ActiveBuff[] = [];
  /** Per potion, so a double tap does not waste one, but a different potion can follow at once */
  private lockedUntil: Partial<Record<PotionId, number>> = {};

  constructor(
    private belt: Belt,
    private readonly now: () => number,
  ) {}

  /** What is left in the belt, to be saved after the fight. */
  get remaining(): Belt {
    return this.belt;
  }

  count(id: PotionId): number {
    return this.belt[id] ?? 0;
  }

  /** Running buffs. */
  get active(): ActiveBuff[] {
    return this.buffs;
  }

  /** 1 = just drunk, 0 = not active. */
  buffFraction(id: PotionId): number {
    const buff = this.buffs.find((b) => b.id === id);
    if (!buff) return 0;
    return Math.max(0, (buff.endsAt - this.now()) / (POTIONS[id].effect.durationSec * 1000));
  }

  /** Drinks a potion if there is one and it would do something. */
  drink(id: PotionId, hp: number, maxHp: number): DrinkResult | null {
    const now = this.now();
    if (now < (this.lockedUntil[id] ?? 0) || this.count(id) < 1 || !canDrink(id, hp, maxHp)) return null;
    this.lockedUntil[id] = now + POTION_RULES.drinkLockoutMs;
    this.belt = takeFromBelt(this.belt, id);
    this.buffs = addBuff(this.buffs, id, now);
    return {
      id,
      heal: potionHeal(id, maxHp),
      buffStarted: POTIONS[id].effect.durationSec > 0,
    };
  }

  /** Removes expired buffs. Returns true when one ended, so stats must be recomputed. */
  update(): boolean {
    const still = activeBuffs(this.buffs, this.now());
    const changed = still.length !== this.buffs.length;
    this.buffs = still;
    return changed;
  }
}
