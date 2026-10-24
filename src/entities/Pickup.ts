import * as Phaser from 'phaser';

export type PickupKind = 'xp' | 'heal';

/** Pooled XP gem or heal pickup. */
export class Pickup extends Phaser.GameObjects.Image {
  value = 0;
  kind: PickupKind = 'xp';
  attracted = false;
}
