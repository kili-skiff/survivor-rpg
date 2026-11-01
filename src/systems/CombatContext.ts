import type * as Phaser from 'phaser';
import type { ModifierId } from '../config/modifiers';
import type { EnemySystem } from './EnemySystem';
import type { PlayerController } from './PlayerController';

/** What weapons and skills need from the game, without depending on the whole scene. */
export interface CombatContext {
  scene: Phaser.Scene;
  player: PlayerController;
  enemies: EnemySystem;
  /** Game clock in ms (stops while paused) */
  now(): number;
  /** How far weapons aim (px): what the player can see */
  visionRange(): number;
  /** True when the main weapon has this modifier in this run */
  hasModifier(id: ModifierId): boolean;
}
