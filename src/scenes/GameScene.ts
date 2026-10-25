import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { POTION_IDS, POTIONS } from '../config/potions';
import { DEFAULT_SEGMENT } from '../config/segments';
import type {
  PlayerStats,
  PotionId,
  SegmentDef,
  SkillId,
  SkillStats,
  WeaponId,
  WeaponStats,
} from '../config/types';
import { START_WEAPON } from '../config/weapons';
import type { Enemy } from '../entities/Enemy';
import type { Pickup } from '../entities/Pickup';
import { InputState } from '../input/InputState';
import { addXp } from '../logic/progression';
import { lootGained } from '../logic/expedition';
import type { ExpeditionBuild } from '../logic/expedition';
import { parseHexKey } from '../logic/hex';
import { planHerbBlooms } from '../logic/herbs';
import { applyBuffs, damageTakenMultiplier } from '../logic/potions';
import { currentBuild, finishFight, returnHome, type FightReport } from '../logic/journey';
import { loadSave, recordRun, safeStorage, writeSave, type SaveData } from '../logic/save';
import { loadSettings } from '../logic/settings';
import { isSegmentCleared, type RunOutcome } from '../logic/segment';
import {
  computePlayerStats,
  computeSkillStats,
  computeWeaponStats,
  createStartLoadout,
  damageAfterArmor,
  type Loadout,
} from '../logic/stats';
import { applyUpgrade, rollUpgradeOptions, type UpgradeOption } from '../logic/upgrades';
import { seasonWorld, segmentForHex } from '../logic/worldgen';
import type { CombatContext } from '../systems/CombatContext';
import type { VillageSceneData } from './VillageScene';
import { DamageNumbers } from '../systems/DamageNumbers';
import { HerbSystem, type HerbIndicator, type HerbSlot } from '../systems/HerbSystem';
import { EnemySystem } from '../systems/EnemySystem';
import { PickupSystem } from '../systems/PickupSystem';
import { PlayerController } from '../systems/PlayerController';
import { PotionSystem } from '../systems/PotionSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { castFrostNova } from '../systems/skills/frostNova';
import { createWeapon, type Weapon } from '../systems/weapons';
import { viewportSize } from '../ui/display';
import { COLORS, css } from '../ui/theme';

/** Everything the HUD needs to know about the current run. */
/** Data passed when starting the Game scene. */
export interface GameSceneData {
  /** Hex on the world map this fight takes place in. Without it a default segment is used. */
  hexKey?: string;
}

export interface RunState {
  started: boolean;
  /** True while the segment is being played (not cleared, not fallen) */
  alive: boolean;
  segment: SegmentDef;
  outcome: RunOutcome | null;
  time: number;
  hp: number;
  level: number;
  xp: number;
  kills: number;
  /** Herbs gathered in this fight */
  herbsGathered: number;
  herbsTotal: number;
  loadout: Loadout;
  stats: PlayerStats;
}

export interface RunEndInfo {
  outcome: RunOutcome;
  hexKey: string | null;
  segment: SegmentDef;
  time: number;
  level: number;
  kills: number;
  herbsGathered: number;
  herbsTotal: number;
  save: SaveData;
  /** Expedition consequences; null for fights outside the world map */
  report: FightReport | null;
  newBestTime: boolean;
}

/** HP restored by the fallback upgrade when everything is maxed */
const FULL_LOADOUT_HEAL = 50;

/**
 * Runs one game: owns the run state and the systems, and wires them together.
 * The actual behaviour lives in src/systems/.
 */
export class GameScene extends Phaser.Scene {
  run!: RunState;
  controls!: InputState;

  private ctx!: CombatContext;
  private player!: PlayerController;
  private enemies!: EnemySystem;
  private pickups!: PickupSystem;
  private numbers!: DamageNumbers;
  private herbs!: HerbSystem;
  private potions!: PotionSystem;
  private lighting!: LightingSystem;
  private ground!: Phaser.GameObjects.TileSprite;

  private weapons = new Map<WeaponId, Weapon>();
  private weaponStats: Partial<Record<WeaponId, WeaponStats>> = {};
  private skillStats!: Record<SkillId, SkillStats>;
  private skillReadyAt: Record<SkillId, number> = { dash: 0, nova: 0 };

  /** Game time in ms, only advances while the scene is not paused */
  private clock = 0;
  private levelUpOpen = false;
  private pendingLevelUps = 0;
  private viewW = 800;
  private viewH = 600;
  private hexKey: string | null = null;
  private endInfo: RunEndInfo | null = null;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    this.hexKey = data?.hexKey ?? null;
  }

  create(): void {
    // Scene instances are reused on restart(); systems are rebuilt, plain fields reset here.
    this.weapons = new Map();
    this.weaponStats = {};
    this.skillReadyAt = { dash: 0, nova: 0 };
    this.clock = 0;
    this.levelUpOpen = false;
    this.pendingLevelUps = 0;
    this.endInfo = null;

    let controls = this.registry.get('input') as InputState | undefined;
    if (!controls) {
      controls = new InputState();
      this.registry.set('input', controls);
    }
    this.controls = controls;
    this.controls.reset();

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.ground = this.add.tileSprite(0, 0, 64, 64, 'ground').setOrigin(0, 0).setDepth(-10);

    const now = () => this.clock;
    this.numbers = new DamageNumbers(this, now);
    this.player = new PlayerController(this, now);
    this.enemies = new EnemySystem(this, this.player, now, this.numbers, (e) => this.onEnemyKilled(e));
    this.pickups = new PickupSystem(this, this.player, (p) => this.onPickup(p));
    this.ctx = { scene: this, player: this.player, enemies: this.enemies, now };

    this.physics.add.overlap(this.player.sprite, this.enemies.group, (_p, e) =>
      this.onPlayerTouched(e as Enemy),
    );

    const hexInfo = this.hexKey ? seasonWorld().hexes.get(this.hexKey) : undefined;
    const segment = hexInfo ? segmentForHex(hexInfo) : DEFAULT_SEGMENT;
    this.ground.setTint(segment.groundTint);

    // On an expedition the character keeps its build from the previous hex.
    const saved = loadSave(safeStorage());
    const build = this.hexKey ? currentBuild(saved) : null;
    this.potions = new PotionSystem(saved.belt, now);
    const loadout = build?.loadout ?? createStartLoadout(START_WEAPON);
    const stats = computePlayerStats(loadout);
    this.run = {
      started: true,
      alive: true,
      segment,
      outcome: null,
      time: 0,
      hp: Math.min(build?.hp ?? stats.maxHp, stats.maxHp),
      level: build?.level ?? 1,
      xp: build?.xp ?? 0,
      kills: 0,
      herbsGathered: 0,
      herbsTotal: 0,
      loadout,
      stats,
    };
    this.refreshStats();

    // Fresh herbs every time a hex is entered. They bloom one by one at random moments;
    // nothing grows back during the fight.
    const blooms = segment.herbs
      ? planHerbBlooms(segment.herbs.biome, segment.herbs.ring, segment.durationSec, Math.random)
      : [];
    this.herbs = new HerbSystem(this, blooms, this.player, this.numbers, (herb) =>
      this.events.emit('herbbloom', herb),
    );
    this.run.herbsTotal = this.herbs.totalCount;
    // Night: darkness with the player's light, torches around and faintly glowing herbs.
    this.lighting = new LightingSystem(
      this,
      this.player,
      () => this.herbs.lights(),
      () => this.enemies.group.getChildren() as Enemy[],
      Math.floor(Math.random() * 2 ** 31),
    );
    this.lighting.setEnabled(loadSettings(safeStorage()).lighting);

    this.cameras.main.startFollow(this.player.sprite, false, 1, 1);
    this.onResize();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));

    this.scene.launch('UI');
  }

  // ---------------------------------------------------------------- Public API for the HUD

  /** 0 = ready, 1 = just used */
  skillCooldownFraction(id: SkillId): number {
    const remaining = this.skillReadyAt[id] - this.clock;
    return remaining <= 0 ? 0 : remaining / this.skillStats[id].cooldown;
  }

  skillCooldownRemaining(id: SkillId): number {
    return Math.max(0, this.skillReadyAt[id] - this.clock);
  }

  /** Night lighting on or off (from the pause menu). */
  setLighting(on: boolean): void {
    this.lighting.setEnabled(on);
  }

  /** Potions of this kind left in the belt. */
  potionCount(id: PotionId): number {
    return this.potions.count(id);
  }

  /** 1 = buff just started, 0 = not active. */
  potionBuffFraction(id: PotionId): number {
    return this.potions.buffFraction(id);
  }

  chooseUpgrade(option: UpgradeOption): void {
    if (option.kind === 'heal') {
      this.heal(FULL_LOADOUT_HEAL);
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

  /** Edge arrows for nearby herbs that are off screen. */
  herbIndicators(): HerbIndicator[] {
    return this.run.alive ? this.herbs.indicators(this.viewW, this.viewH) : [];
  }

  /** Gathered, bloomed and upcoming herbs of this fight, for the HUD. */
  herbSlots(): HerbSlot[] {
    return this.herbs.slots();
  }

  /** Herbs gathered in this fight, by id. */
  gatheredHerbs(): Record<string, number> {
    return this.herbs.loot;
  }

  /** Giving up counts like falling: the expedition ends. */
  giveUp(): void {
    if (!this.run.alive) return;
    this.scene.resume();
    this.endRun('fallen');
  }

  /** Returns to the world map after the result screen. */
  /** True when the fight was won on an expedition, so the result screen can offer to go home. */
  canReturnHome(): boolean {
    return this.endInfo?.report?.outcome === 'cleared';
  }

  /** After a won fight: end the expedition right away and bring all loot home. */
  returnHomeFromFight(): void {
    if (!this.canReturnHome()) return;
    const storage = safeStorage();
    const before = loadSave(storage);
    const home = returnHome(before);
    writeSave(storage, home);
    this.scene.stop('UI');
    const data: VillageSceneData = {
      arrival: { reason: 'returned', kept: lootGained(before.stash, home.stash), lost: {} },
    };
    this.scene.start('Village', data);
  }

  returnToMap(): void {
    this.scene.stop('UI');
    const report = this.endInfo?.report;
    if (report && report.outcome === 'fallen') {
      // Falling ends the expedition: you wake up in the village.
      const data: VillageSceneData = {
        arrival: { reason: 'fallen', kept: report.lootKept ?? {}, lost: report.lootLost ?? {} },
      };
      this.scene.start('Village', data);
      return;
    }
    this.scene.start('WorldMap');
  }

  // ---------------------------------------------------------------- Game loop

  override update(_time: number, deltaMs: number): void {
    if (!this.run.started || !this.run.alive) {
      this.player.stop();
      this.updateGround();
      this.lighting.update(this.time.now);
      return;
    }
    const dms = Math.min(deltaMs, 50);
    const dt = dms / 1000;
    this.clock += dms;
    this.run.time += dt;

    this.handleSkillInput();
    this.handlePotionInput();
    if (this.potions.update()) this.refreshStats();
    this.player.update(this.controls.moveX, this.controls.moveY, this.run.stats.moveSpeed, this.enemies);
    this.updateGround();
    this.lighting.update(this.time.now);
    this.enemies.spawn(dms, this.run.time + this.run.segment.difficultyOffsetSec);
    this.enemies.update();
    for (const [id, weapon] of this.weapons) weapon.update(this.weaponStats[id]!, dms, dt);
    this.pickups.update(dt, this.run.stats.magnet);
    this.herbs.update(dt, this.run.time, this.viewW, this.viewH);
    this.run.herbsGathered = this.herbs.gatheredCount;
    this.numbers.update(dt);

    if (this.run.stats.regen > 0) this.heal(this.run.stats.regen * dt);
    if (isSegmentCleared(this.run.segment, this.run.time)) this.endRun('cleared');
  }

  /** Recomputes all stats after the loadout changed and creates newly acquired weapons. */
  private refreshStats(): void {
    const prevMax = this.run.stats.maxHp;
    this.run.stats = applyBuffs(computePlayerStats(this.run.loadout), this.potions.active);
    if (this.run.stats.maxHp > prevMax) this.run.hp += this.run.stats.maxHp - prevMax;

    this.weaponStats = {};
    for (const id of Object.keys(this.run.loadout.weapons) as WeaponId[]) {
      this.weaponStats[id] = computeWeaponStats(id, this.run.loadout.weapons[id]!, this.run.stats);
      if (!this.weapons.has(id)) this.weapons.set(id, createWeapon(id, this.ctx));
    }
    this.skillStats = {
      dash: computeSkillStats('dash', this.run.loadout.skills.dash, this.run.stats),
      nova: computeSkillStats('nova', this.run.loadout.skills.nova, this.run.stats),
    };
  }

  private handleSkillInput(): void {
    const { controls } = this;
    if (controls.consume('dash') && this.clock >= this.skillReadyAt.dash) {
      this.player.startDash(this.skillStats.dash, controls.moveX, controls.moveY);
      this.skillReadyAt.dash = this.clock + this.skillStats.dash.cooldown;
    }
    if (controls.consume('nova') && this.clock >= this.skillReadyAt.nova) {
      castFrostNova(this.ctx, this.skillStats.nova);
      this.skillReadyAt.nova = this.clock + this.skillStats.nova.cooldown;
    }
  }

  private handlePotionInput(): void {
    for (const id of POTION_IDS) {
      if (!this.controls.consume(`drink:${id}`)) continue;
      const result = this.potions.drink(id, this.run.hp, this.run.stats.maxHp);
      if (!result) continue;
      if (result.heal > 0) {
        this.heal(result.heal);
        this.numbers.show(this.player.x, this.player.y - 24, `+${result.heal}`, '#4ade80', true);
      }
      if (result.buffStarted) {
        this.refreshStats();
        this.numbers.show(this.player.x, this.player.y - 30, POTIONS[id].short, css(POTIONS[id].color), true);
      }
    }
  }

  private heal(amount: number): void {
    this.run.hp = Math.min(this.run.stats.maxHp, this.run.hp + amount);
  }

  // ---------------------------------------------------------------- Camera & ground

  private onResize(): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);
    const css = viewportSize();
    const rs = width / css.width;
    const zoom = rs * Phaser.Math.Clamp(Math.min(css.width, css.height) / 560, 0.55, 1.6);
    this.cameras.main.setZoom(zoom);
    this.viewW = width / zoom;
    this.viewH = height / zoom;
    this.enemies.viewDiag = Math.hypot(this.viewW, this.viewH);
    this.ground.setSize(this.viewW + 256, this.viewH + 256);
    this.lighting.resize(this.viewW, this.viewH);
  }

  /** Keeps the tiled ground under the camera, snapped to the tile grid. */
  private updateGround(): void {
    const x = Math.floor((this.player.x - this.viewW / 2) / 64) * 64 - 128;
    const y = Math.floor((this.player.y - this.viewH / 2) / 64) * 64 - 128;
    this.ground.setPosition(x, y);
  }

  // ---------------------------------------------------------------- Events from the systems

  private onPlayerTouched(e: Enemy): void {
    if (!e.active || !this.run.alive || !this.player.tryTakeHit()) return;
    this.herbs.interrupt();
    const dmg =
      damageAfterArmor(e.def.damage, this.run.stats.armor) * damageTakenMultiplier(this.potions.active);
    this.run.hp -= dmg;
    this.numbers.show(this.player.x, this.player.y - 22, `-${Math.round(dmg)}`, '#ff6b81', true);
    if (this.run.hp <= 0) {
      this.run.hp = 0;
      this.player.showDefeated();
      this.endRun('fallen');
    }
  }

  private onEnemyKilled(e: Enemy): void {
    this.run.kills += 1;
    if (Math.random() < BALANCE.healDropChance) this.pickups.drop(e.x, e.y, 'heal', BALANCE.healAmount);
    else this.pickups.drop(e.x, e.y, 'xp', e.def.xp);
  }

  private onPickup(p: Pickup): void {
    if (p.kind === 'heal') {
      this.heal(p.value);
      this.numbers.show(this.player.x, this.player.y - 24, `+${p.value}`, '#4ade80', true);
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

  /** Ends the segment, either cleared or fallen, and reports the result to the HUD. */
  private endRun(outcome: RunOutcome): void {
    if (!this.run.alive) return;
    this.run.alive = false;
    this.run.outcome = outcome;
    this.player.stop();
    this.physics.pause();

    const storage = safeStorage();
    const before = loadSave(storage);
    const time = Math.floor(this.run.time);
    const save = recordRun(before, {
      time,
      kills: this.run.kills,
      level: this.run.level,
      cleared: outcome === 'cleared',
    });
    let finalSave: SaveData = save;
    let report: FightReport | null = null;
    if (this.hexKey) {
      const build: ExpeditionBuild = {
        level: this.run.level,
        xp: this.run.xp,
        hp: Math.max(1, this.run.hp),
        loadout: this.run.loadout,
      };
      const result = finishFight(
        save,
        seasonWorld(),
        parseHexKey(this.hexKey),
        outcome,
        build,
        this.herbs.loot,
      );
      finalSave = result.save;
      report = result.report;
    }
    // Potions not drunk stay in the belt, whatever the outcome.
    finalSave = { ...finalSave, belt: this.potions.remaining };
    writeSave(storage, finalSave);

    const info: RunEndInfo = {
      outcome,
      hexKey: this.hexKey,
      segment: this.run.segment,
      time,
      level: this.run.level,
      kills: this.run.kills,
      herbsGathered: this.herbs.gatheredCount,
      herbsTotal: this.herbs.totalCount,
      save: finalSave,
      report,
      newBestTime: time > before.bestTime,
    };
    this.endInfo = info;
    this.controls.reset();
    this.events.emit('runend', info);
  }
}
