import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { Pickup, type PickupKind } from '../entities/Pickup';

/** Distance at which a pickup counts as collected */
const COLLECT_RADIUS = 18;

interface Target {
  x: number;
  y: number;
}

/** Drops XP gems, heals and gold, pulls them towards the player and reports collections. */
export class PickupSystem {
  private readonly group: Phaser.GameObjects.Group;

  constructor(
    scene: Phaser.Scene,
    private readonly target: Target,
    private readonly onCollect: (p: Pickup) => void,
  ) {
    this.group = scene.add.group({ classType: Pickup, maxSize: BALANCE.maxGems });
  }

  drop(x: number, y: number, kind: PickupKind, value: number): void {
    const texture =
      kind === 'heal'
        ? 'heart'
        : kind === 'gold'
          ? 'coin'
          : kind === 'chest'
            ? 'chest'
            : value >= 5
              ? 'gem-big'
              : 'gem';
    const p = this.group.get(x, y, texture) as Pickup | null;
    if (!p) {
      // Pool is full: add the XP to an existing gem.
      const any = (this.group.getChildren() as Pickup[]).find((c) => c.active && c.kind === 'xp');
      if (any && kind === 'xp') any.value += value;
      // Gold and chests are never lost: with a full pool they are collected at once.
      if (kind === 'gold' || kind === 'chest') this.onCollect({ kind, value } as Pickup);
      return;
    }
    p.setTexture(texture).setActive(true).setVisible(true).setDepth(1).setPosition(x, y);
    p.kind = kind;
    p.value = value;
    p.attracted = false;
  }

  /** `magnet` is the radius within which pickups start flying to the player. */
  update(dt: number, magnet: number): void {
    const { x: px, y: py } = this.target;
    const list = this.group.getChildren() as Pickup[];
    for (const p of list) {
      if (!p.active) continue;
      const dx = px - p.x;
      const dy = py - p.y;
      const d = Math.hypot(dx, dy);
      if (d < COLLECT_RADIUS) {
        p.setActive(false).setVisible(false);
        this.onCollect(p);
        continue;
      }
      // Chests stay where they fell: walk over them to open.
      if (p.kind === 'chest') continue;
      if (p.attracted || d < magnet) {
        p.attracted = true;
        const speed = 420 + Math.max(0, 300 - d);
        const step = Math.min(d, speed * dt);
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
  }
}
