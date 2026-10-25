import * as Phaser from 'phaser';

export type PickupKind = 'xp' | 'heal' | 'gold';

/** Pooled XP gem, heal or gold pickup. */
export class Pickup extends Phaser.GameObjects.Image {
  value = 0;
  kind: PickupKind = 'xp';
  attracted = false;
}
