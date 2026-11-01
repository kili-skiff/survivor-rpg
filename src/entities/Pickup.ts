import * as Phaser from 'phaser';

export type PickupKind = 'xp' | 'heal' | 'embers' | 'chest';

/** Pooled XP gem, heal or embers pickup. */
export class Pickup extends Phaser.GameObjects.Image {
  value = 0;
  kind: PickupKind = 'xp';
  attracted = false;
}
