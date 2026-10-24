import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { ENEMIES } from '../config/enemies';
import { DASH_SPEED } from '../config/skills';
import type { EnemyDef, PlayerStats, SkillId, SkillStats, WeaponId, WeaponStats } from '../config/types';
import { AURA_BASE_RADIUS, BLADES_BASE_RADIUS, START_WEAPON } from '../config/weapons';
import { Enemy } from '../entities/Enemy';
import { Pickup, Projectile } from '../entities/Projectile';
import { InputState } from '../input/InputState';
import { addXp } from '../logic/progression';
import { loadSave, recordRun, safeStorage, writeSave, type SaveData } from '../logic/save';
import { enemyHpMultiplier, maxEnemies, pickEnemy, spawnBatchSize, spawnIntervalMs } from '../logic/spawning';
import {
  computePlayerStats,
  computeSkillStats,
  computeWeaponStats,
  createStartLoadout,
  damageAfterArmor,
  type Loadout,
} from '../logic/stats';
import { applyUpgrade, rollUpgradeOptions, type UpgradeOption } from '../logic/upgrades';
import { viewportSize } from '../ui/display';
import { COLORS, FONT } from '../ui/theme';

/** Everything the HUD needs to know about the current run. */
export interface RunState {
  started: boolean;
  alive: boolean;
  time: number;
  hp: number;
  level: number;
  xp: number;
  kills: number;
  loadout: Loadout;
  stats: PlayerStats;
}

export interface GameOverInfo {
  time: number;
  level: number;
  kills: number;
  save: SaveData;
  newBestTime: boolean;
}

interface FloatingText {
  text: Phaser.GameObjects.Text;
  life: number;
}

const ENEMY_LIST: EnemyDef[] = Object.values(ENEMIES);
const TEXT_LIFE = 0.6;

export class GameScene extends Phaser.Scene {
  run!: RunState;
  controls!: InputState;

  private player!: Phaser.Physics.Arcade.Image;
  private enemies!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.GameObjects.Group;
  private ground!: Phaser.GameObjects.TileSprite;
  private auraImage!: Phaser.GameObjects.Image;
  private blades: Phaser.GameObjects.Image[] = [];
  private floatingTexts: FloatingText[] = [];
  private nextTextIndex = 0;
  private lastTextAt = 0;

  private weaponStats: Partial<Record<WeaponId, WeaponStats>> = {};
  private skillStats!: Record<SkillId, SkillStats>;
  private weaponTimers: Partial<Record<WeaponId, number>> = {};
  private skillReadyAt: Record<SkillId, number> = { dash: 0, nova: 0 };

  /** Game time in ms, only advances while the scene is not paused */
  private clock = 0;
  private spawnTimer = 0;
  private invulnUntil = 0;
  private hurtFlashUntil = 0;
  private dashUntil = 0;
  private dashId = 0;
  private lastGhostAt = 0;
  private dashDir = new Phaser.Math.Vector2(1, 0);
  private facing = new Phaser.Math.Vector2(1, 0);
  private bladeAngle = 0;
  private levelUpOpen = false;
  private pendingLevelUps = 0;
  private viewW = 800;
  private viewH = 600;
  private viewDiag = 1000;
  private separationGrid = new Map<number, Enemy[]>();

  constructor() {
    super('Game');
  }

  create(): void {
    // Scene instances are reused on restart(), so reset all state explicitly.
    this.blades = [];
    this.floatingTexts = [];
    this.nextTextIndex = 0;
    this.lastTextAt = 0;
    this.weaponStats = {};
    this.weaponTimers = {};
    this.skillReadyAt = { dash: 0, nova: 0 };
    this.clock = 0;
    this.spawnTimer = 400;
    this.invulnUntil = 0;
    this.hurtFlashUntil = 0;
    this.dashUntil = 0;
    this.dashId = 0;
    this.bladeAngle = 0;
    this.levelUpOpen = false;
    this.pendingLevelUps = 0;

    let controls = this.registry.get('input') as InputState | undefined;
    if (!controls) {
      controls = new InputState();
      this.registry.set('input', controls);
    }
    this.controls = controls;
    this.controls.reset();

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.ground = this.add.tileSprite(0, 0, 64, 64, 'ground').setOrigin(0, 0).setDepth(-10);

    this.player = this.physics.add.image(0, 0, 'player').setDepth(3);
    this.player.body!.setCircle(12, 5, 4);

    this.enemies = this.physics.add.group({ classType: Enemy, maxSize: BALANCE.maxEnemiesHardCap });
    this.projectiles = this.physics.add.group({ classType: Projectile, maxSize: 150 });
    this.pickups = this.add.group({ classType: Pickup, maxSize: BALANCE.maxGems });

    this.auraImage = this.add
      .image(0, 0, 'aura')
      .setDepth(1)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD);

    for (let i = 0; i < 40; i++) {
      const text = this.add
        .text(0, 0, '', {
          fontFamily: FONT,
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(10)
        .setVisible(false);
      this.floatingTexts.push({ text, life: 0 });
    }

    this.physics.add.overlap(this.projectiles, this.enemies, (a, b) =>
      this.onProjectileHit(a as Projectile, b as Enemy),
    );
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.onPlayerTouched(e as Enemy));

    const loadout = createStartLoadout(START_WEAPON);
    const stats = computePlayerStats(loadout);
    this.run = {
      started: this.registry.get('started') === true,
      alive: true,
      time: 0,
      hp: stats.maxHp,
      level: 1,
      xp: 0,
      kills: 0,
      loadout,
      stats,
    };
    this.refreshStats();

    this.cameras.main.startFollow(this.player, false, 1, 1);
    this.onResize();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));

    this.scene.launch('UI');
  }

  // ---------------------------------------------------------------- Public API for the HUD

  startRun(): void {
    this.run.started = true;
    this.registry.set('started', true);
  }

  /** 0 = ready, 1 = just used */
  skillCooldownFraction(id: SkillId): number {
    const remaining = this.skillReadyAt[id] - this.clock;
    return remaining <= 0 ? 0 : remaining / this.skillStats[id].cooldown;
  }

  skillCooldownRemaining(id: SkillId): number {
    return Math.max(0, this.skillReadyAt[id] - this.clock);
  }

  chooseUpgrade(option: UpgradeOption): void {
    if (option.kind === 'heal') {
      this.run.hp = Math.min(this.run.stats.maxHp, this.run.hp + 50);
    } else {
      this.run.loadout = applyUpgrade(this.run.loadout, option);
      this.refreshStats();
    }
    this.pendingLevelUps -= 1;
    if (this.pendingLevelUps > 0) {
      this.events.emit('levelup', rollUpgradeOptions(this.run.loadout, Math.random), this.run.level);
    } else {
      this.levelUpOpen = false;
      this.controls.reset();
      this.scene.resume();
    }
  }

  pauseGame(): boolean {
    if (!this.run.started || !this.run.alive || this.levelUpOpen || this.scene.isPaused()) return false;
    this.controls.reset();
    this.scene.pause();
    return true;
  }

  resumeGame(): void {
    if (this.levelUpOpen || !this.run.alive) return;
    this.controls.reset();
    this.scene.resume();
  }

  restartRun(): void {
    this.scene.restart();
  }

  // ---------------------------------------------------------------- Game loop

  override update(_time: number, deltaMs: number): void {
    if (!this.run.started || !this.run.alive) {
      this.player.setVelocity(0, 0);
      this.updateGround();
      return;
    }
    const dms = Math.min(deltaMs, 50);
    const dt = dms / 1000;
    this.clock += dms;
    this.run.time += dt;

    this.handleSkillInput();
    this.updatePlayer();
    this.updateGround();
    this.spawnEnemies(dms);
    this.updateEnemies();
    this.updateWeapons(dms, dt);
    this.updateProjectiles();
    this.updatePickups(dt);
    this.updateFloatingTexts(dt);

    if (this.run.stats.regen > 0) {
      this.run.hp = Math.min(this.run.stats.maxHp, this.run.hp + this.run.stats.regen * dt);
    }
  }

  private refreshStats(): void {
    const prevMax = this.run.stats.maxHp;
    this.run.stats = computePlayerStats(this.run.loadout);
    if (this.run.stats.maxHp > prevMax) this.run.hp += this.run.stats.maxHp - prevMax;

    this.weaponStats = {};
    for (const id of Object.keys(this.run.loadout.weapons) as WeaponId[]) {
      this.weaponStats[id] = computeWeaponStats(id, this.run.loadout.weapons[id]!, this.run.stats);
      this.weaponTimers[id] ??= 300;
    }
    this.skillStats = {
      dash: computeSkillStats('dash', this.run.loadout.skills.dash, this.run.stats),
      nova: computeSkillStats('nova', this.run.loadout.skills.nova, this.run.stats),
    };
  }

  private onResize(): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);
    const css = viewportSize();
    const rs = width / css.width;
    const zoom = rs * Phaser.Math.Clamp(Math.min(css.width, css.height) / 560, 0.55, 1.6);
    this.cameras.main.setZoom(zoom);
    this.viewW = width / zoom;
    this.viewH = height / zoom;
    this.viewDiag = Math.hypot(this.viewW, this.viewH);
    this.ground.setSize(this.viewW + 256, this.viewH + 256);
  }

  private updateGround(): void {
    const x = Math.floor((this.player.x - this.viewW / 2) / 64) * 64 - 128;
    const y = Math.floor((this.player.y - this.viewH / 2) / 64) * 64 - 128;
    this.ground.setPosition(x, y);
  }

  // ---------------------------------------------------------------- Player & skills

  private handleSkillInput(): void {
    if (this.controls.consume('dash') && this.clock >= this.skillReadyAt.dash) {
      const s = this.skillStats.dash;
      const mx = this.controls.moveX;
      const my = this.controls.moveY;
      if (Math.hypot(mx, my) > 0.15) this.dashDir.set(mx, my).normalize();
      else this.dashDir.copy(this.facing);
      this.dashUntil = this.clock + s.duration;
      this.invulnUntil = Math.max(this.invulnUntil, this.dashUntil + 80);
      this.skillReadyAt.dash = this.clock + s.cooldown;
      this.dashId += 1;
    }
    if (this.controls.consume('nova') && this.clock >= this.skillReadyAt.nova) {
      this.castNova();
    }
  }

  private castNova(): void {
    const s = this.skillStats.nova;
    this.skillReadyAt.nova = this.clock + s.cooldown;
    const { x, y } = this.player;
    for (const e of this.activeEnemies()) {
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) <= s.radius + e.def.radius) {
        e.slowUntil = this.clock + s.duration;
        e.slowFactor = 1 - s.slow;
        const a = Math.atan2(e.y - y, e.x - x);
        this.damageEnemy(e, s.damage, Math.cos(a) * 14, Math.sin(a) * 14);
      }
    }
    const ring = this.add.image(x, y, 'ring').setTint(COLORS.nova).setDepth(5).setScale(0.15);
    this.tweens.add({
      targets: ring,
      scale: (s.radius * 2) / 120,
      alpha: 0,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.cameras.main.shake(90, 0.003);
  }

  private updatePlayer(): void {
    const p = this.player;
    const dashing = this.clock < this.dashUntil;
    if (dashing) {
      p.setVelocity(this.dashDir.x * DASH_SPEED, this.dashDir.y * DASH_SPEED);
      if (this.clock - this.lastGhostAt > 28) {
        this.lastGhostAt = this.clock;
        const ghost = this.add.image(p.x, p.y, 'player').setDepth(2.5).setAlpha(0.45).setTint(0x818cf8);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
      }
      const dmg = this.skillStats.dash.damage;
      if (dmg > 0) {
        for (const e of this.activeEnemies()) {
          if (
            e.lastDashHit !== this.dashId &&
            Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < e.def.radius + 22
          ) {
            e.lastDashHit = this.dashId;
            this.damageEnemy(e, dmg);
          }
        }
      }
    } else {
      const { moveX, moveY } = this.controls;
      const speed = this.run.stats.moveSpeed;
      p.setVelocity(moveX * speed, moveY * speed);
      if (Math.hypot(moveX, moveY) > 0.15) {
        this.facing.set(moveX, moveY).normalize();
        p.setFlipX(moveX < 0);
      }
    }

    if (this.clock < this.hurtFlashUntil) {
      p.setTint(0xff5a6e).setTintMode(Phaser.TintModes.FILL);
    } else {
      p.clearTint();
      p.setTintMode(Phaser.TintModes.MULTIPLY);
    }
    p.setAlpha(dashing ? 0.65 : this.clock < this.invulnUntil ? 0.8 : 1);
  }

  private onPlayerTouched(e: Enemy): void {
    if (!e.active || !this.run.alive || this.clock < this.invulnUntil) return;
    const dmg = damageAfterArmor(e.def.damage, this.run.stats.armor);
    this.run.hp -= dmg;
    this.invulnUntil = this.clock + BALANCE.hurtInvulnMs;
    this.hurtFlashUntil = this.clock + 110;
    this.cameras.main.shake(110, 0.005);
    this.showText(this.player.x, this.player.y - 22, `-${Math.round(dmg)}`, '#ff6b81', true);
    if (this.run.hp <= 0) this.die();
  }

  private die(): void {
    this.run.hp = 0;
    this.run.alive = false;
    this.player.setVelocity(0, 0).setTint(0x555555).setTintMode(Phaser.TintModes.MULTIPLY);
    this.physics.pause();

    const storage = safeStorage();
    const before = loadSave(storage);
    const time = Math.floor(this.run.time);
    const save = recordRun(before, { time, kills: this.run.kills, level: this.run.level });
    writeSave(storage, save);

    const info: GameOverInfo = {
      time,
      level: this.run.level,
      kills: this.run.kills,
      save,
      newBestTime: time > before.bestTime,
    };
    this.controls.reset();
    this.events.emit('gameover', info);
  }

  // ---------------------------------------------------------------- Enemies

  private *activeEnemies(): Generator<Enemy> {
    const list = this.enemies.getChildren() as Enemy[];
    for (let i = 0; i < list.length; i++) {
      if (list[i].active) yield list[i];
    }
  }

  private spawnPoint(): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = this.viewDiag / 2 + 40;
    return { x: this.player.x + Math.cos(angle) * dist, y: this.player.y + Math.sin(angle) * dist };
  }

  private spawnEnemies(dms: number): void {
    this.spawnTimer -= dms;
    if (this.spawnTimer > 0) return;
    const t = this.run.time;
    this.spawnTimer += spawnIntervalMs(t);
    const limit = maxEnemies(t, BALANCE.maxEnemiesHardCap);
    let alive = this.enemies.countActive(true);
    const batch = spawnBatchSize(t);
    for (let i = 0; i < batch && alive < limit; i++) {
      const def = pickEnemy(t, ENEMY_LIST, Math.random);
      const pos = this.spawnPoint();
      const e = this.enemies.get(pos.x, pos.y, def.texture) as Enemy | null;
      if (!e) break;
      e.spawn(def, pos.x, pos.y, enemyHpMultiplier(t));
      alive += 1;
    }
  }

  private updateEnemies(): void {
    const px = this.player.x;
    const py = this.player.y;
    const recycleDist = this.viewDiag * 0.8;
    const grid = this.separationGrid;
    grid.clear();
    const cell = 36;

    for (const e of this.activeEnemies()) {
      const dx = px - e.x;
      const dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;

      // Too far away? Move it to the other side instead of despawning (keeps the horde dense).
      if (d > recycleDist) {
        const pos = this.spawnPoint();
        e.setPosition(pos.x, pos.y);
        continue;
      }

      const slowed = this.clock < e.slowUntil;
      const speed = e.def.speed * e.speedJitter * (slowed ? e.slowFactor : 1);
      e.setVelocity((dx / d) * speed, (dy / d) * speed);
      e.setFlipX(dx < 0);

      const state = this.clock < e.flashUntil ? 1 : slowed ? 2 : 0;
      if (state !== e.tintState) {
        e.tintState = state;
        if (state === 1) e.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        else if (state === 2) e.setTint(0x8fd3ff).setTintMode(Phaser.TintModes.MULTIPLY);
        else e.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      }

      const key = Math.floor(e.x / cell) * 92821 + Math.floor(e.y / cell);
      const bucket = grid.get(key);
      if (bucket) {
        if (bucket.length < 6) bucket.push(e);
      } else grid.set(key, [e]);
    }

    // Simple separation so enemies don't collapse into a single point.
    for (const bucket of grid.values()) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = bucket[i];
          const b = bucket[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = (a.def.radius + b.def.radius) * 0.9;
          const d2 = dx * dx + dy * dy;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 0.01;
            const push = (min - d) * 0.5;
            const nx = d2 > 0 ? dx / d : Math.random() - 0.5;
            const ny = d2 > 0 ? dy / d : Math.random() - 0.5;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }
    }
  }

  private damageEnemy(e: Enemy, amount: number, knockX = 0, knockY = 0): void {
    if (!e.active) return;
    e.hp -= amount;
    e.flashUntil = this.clock + 70;
    e.x += knockX;
    e.y += knockY;
    this.showText(e.x, e.y - e.def.radius - 4, String(Math.round(amount)), '#ffffff');
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    this.run.kills += 1;
    if (Math.random() < BALANCE.healDropChance) this.dropPickup(e.x, e.y, 'heal', BALANCE.healAmount);
    else this.dropPickup(e.x, e.y, 'xp', e.def.xp);
    e.despawn();
  }

  // ---------------------------------------------------------------- Weapons

  private nearestEnemies(count: number, range: number): Enemy[] {
    const px = this.player.x;
    const py = this.player.y;
    const best: { e: Enemy; d: number }[] = [];
    const r2 = range * range;
    for (const e of this.activeEnemies()) {
      const d = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d > r2) continue;
      if (best.length < count) {
        best.push({ e, d });
        best.sort((a, b) => a.d - b.d);
      } else if (d < best[best.length - 1].d) {
        best[best.length - 1] = { e, d };
        best.sort((a, b) => a.d - b.d);
      }
    }
    return best.map((b) => b.e);
  }

  private updateWeapons(dms: number, dt: number): void {
    for (const id of Object.keys(this.weaponStats) as WeaponId[]) {
      const ws = this.weaponStats[id]!;
      switch (id) {
        case 'bolt':
          this.updateBolt(ws, dms);
          break;
        case 'blades':
          this.updateBlades(ws, dt);
          break;
        case 'aura':
          this.updateAura(ws, dms);
          break;
      }
    }
  }

  private updateBolt(ws: WeaponStats, dms: number): void {
    const timer = (this.weaponTimers.bolt ?? 0) - dms;
    if (timer > 0) {
      this.weaponTimers.bolt = timer;
      return;
    }
    const targets = this.nearestEnemies(ws.count, BALANCE.boltRange);
    if (targets.length === 0) {
      this.weaponTimers.bolt = 0;
      return;
    }
    for (let i = 0; i < ws.count; i++) {
      const target = targets[i % targets.length];
      const spread = i >= targets.length ? (i - targets.length + 1) * 0.18 : 0;
      const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x) + spread;
      const p = this.projectiles.get(this.player.x, this.player.y, 'bolt') as Projectile | null;
      if (!p) break;
      p.fire(
        this.player.x,
        this.player.y,
        angle,
        ws.speed,
        ws.damage,
        ws.pierce,
        this.clock,
        BALANCE.boltLifetimeMs,
      );
    }
    this.weaponTimers.bolt = ws.cooldown;
  }

  private onProjectileHit(p: Projectile, e: Enemy): void {
    if (!p.active || !e.active || p.hits.has(e)) return;
    p.hits.add(e);
    const v = p.body!.velocity;
    const len = v.length() || 1;
    this.damageEnemy(e, p.damage, (v.x / len) * 6, (v.y / len) * 6);
    p.pierceLeft -= 1;
    if (p.pierceLeft <= 0) p.despawn();
  }

  private updateProjectiles(): void {
    const list = this.projectiles.getChildren() as Projectile[];
    for (const p of list) {
      if (p.active && this.clock > p.expiresAt) p.despawn();
    }
  }

  private updateBlades(ws: WeaponStats, dt: number): void {
    while (this.blades.length < ws.count) {
      this.blades.push(this.add.image(0, 0, 'blade').setDepth(4));
    }
    const radius = BLADES_BASE_RADIUS * ws.area;
    this.bladeAngle += Phaser.Math.DegToRad(ws.speed) * dt;
    const px = this.player.x;
    const py = this.player.y;
    for (let i = 0; i < this.blades.length; i++) {
      const a = this.bladeAngle + (i / this.blades.length) * Math.PI * 2;
      const blade = this.blades[i];
      blade.setPosition(px + Math.cos(a) * radius, py + Math.sin(a) * radius);
      blade.setRotation(a + Math.PI / 2);
    }
    for (const e of this.activeEnemies()) {
      if (this.clock - e.lastBladeHit < ws.cooldown) continue;
      for (const blade of this.blades) {
        const reach = e.def.radius + 12;
        if (Math.abs(blade.x - e.x) < reach && Math.abs(blade.y - e.y) < reach) {
          e.lastBladeHit = this.clock;
          const a = Math.atan2(e.y - py, e.x - px);
          this.damageEnemy(e, ws.damage, Math.cos(a) * 8, Math.sin(a) * 8);
          break;
        }
      }
    }
  }

  private updateAura(ws: WeaponStats, dms: number): void {
    const radius = AURA_BASE_RADIUS * ws.area;
    const pulse = 1 + Math.sin(this.clock / 180) * 0.03;
    this.auraImage
      .setVisible(true)
      .setPosition(this.player.x, this.player.y)
      .setScale(((radius * 2) / 128) * pulse);

    const timer = (this.weaponTimers.aura ?? 0) - dms;
    if (timer > 0) {
      this.weaponTimers.aura = timer;
      return;
    }
    this.weaponTimers.aura = ws.cooldown;
    const { x, y } = this.player;
    for (const e of this.activeEnemies()) {
      const r = radius + e.def.radius;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 <= r * r) this.damageEnemy(e, ws.damage);
    }
  }

  // ---------------------------------------------------------------- XP & pickups

  private dropPickup(x: number, y: number, kind: 'xp' | 'heal', value: number): void {
    const texture = kind === 'heal' ? 'heart' : value >= 5 ? 'gem-big' : 'gem';
    const p = this.pickups.get(x, y, texture) as Pickup | null;
    if (!p) {
      // Pool is full: add the XP to an existing gem.
      const any = (this.pickups.getChildren() as Pickup[]).find((c) => c.active && c.kind === 'xp');
      if (any && kind === 'xp') any.value += value;
      return;
    }
    p.setTexture(texture).setActive(true).setVisible(true).setDepth(1).setPosition(x, y);
    p.kind = kind;
    p.value = value;
    p.attracted = false;
  }

  private updatePickups(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;
    const magnet = this.run.stats.magnet;
    const list = this.pickups.getChildren() as Pickup[];
    for (const p of list) {
      if (!p.active) continue;
      const dx = px - p.x;
      const dy = py - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 18) {
        this.collect(p);
        continue;
      }
      if (p.attracted || d < magnet) {
        p.attracted = true;
        const speed = 420 + Math.max(0, 300 - d);
        const step = Math.min(d, speed * dt);
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
  }

  private collect(p: Pickup): void {
    p.setActive(false).setVisible(false);
    if (p.kind === 'heal') {
      this.run.hp = Math.min(this.run.stats.maxHp, this.run.hp + p.value);
      this.showText(this.player.x, this.player.y - 24, `+${p.value}`, '#4ade80', true);
      return;
    }
    const r = addXp({ level: this.run.level, xp: this.run.xp }, p.value);
    this.run.level = r.level;
    this.run.xp = r.xp;
    if (r.levelsGained > 0) {
      this.pendingLevelUps += r.levelsGained;
      if (!this.levelUpOpen) this.openLevelUp();
    }
  }

  private openLevelUp(): void {
    this.levelUpOpen = true;
    this.controls.reset();
    this.scene.pause();
    this.events.emit('levelup', rollUpgradeOptions(this.run.loadout, Math.random), this.run.level);
  }

  // ---------------------------------------------------------------- Damage numbers

  private showText(x: number, y: number, value: string, color: string, force = false): void {
    if (!force && this.clock - this.lastTextAt < 25) return;
    this.lastTextAt = this.clock;
    const ft = this.floatingTexts[this.nextTextIndex];
    this.nextTextIndex = (this.nextTextIndex + 1) % this.floatingTexts.length;
    ft.life = TEXT_LIFE;
    ft.text
      .setText(value)
      .setColor(color)
      .setPosition(x + (Math.random() - 0.5) * 10, y)
      .setAlpha(1)
      .setVisible(true);
  }

  private updateFloatingTexts(dt: number): void {
    for (const ft of this.floatingTexts) {
      if (ft.life <= 0) continue;
      ft.life -= dt;
      ft.text.y -= 34 * dt;
      ft.text.setAlpha(Math.max(0, ft.life / TEXT_LIFE));
      if (ft.life <= 0) ft.text.setVisible(false);
    }
  }
}
