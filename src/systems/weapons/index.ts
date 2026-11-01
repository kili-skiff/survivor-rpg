import type { WeaponId } from '../../config/types';
import type { CombatContext } from '../CombatContext';
import { AuraWeapon } from './AuraWeapon';
import { BladesWeapon } from './BladesWeapon';
import { BoltWeapon } from './BoltWeapon';
import { BoomerangWeapon } from './BoomerangWeapon';
import { ChainWeapon } from './ChainWeapon';
import type { Weapon } from './Weapon';

// Every WeaponId must map to a behaviour; TypeScript fails the build if one is missing.
const FACTORIES: Record<WeaponId, (ctx: CombatContext) => Weapon> = {
  bolt: (ctx) => new BoltWeapon(ctx),
  blades: (ctx) => new BladesWeapon(ctx),
  aura: (ctx) => new AuraWeapon(ctx),
  chain: (ctx) => new ChainWeapon(ctx),
  boomerang: (ctx) => new BoomerangWeapon(ctx),
};

export function createWeapon(id: WeaponId, ctx: CombatContext): Weapon {
  return FACTORIES[id](ctx);
}

export type { Weapon } from './Weapon';
