import * as Phaser from 'phaser';
import { BALANCE, BOONS, ELITE, LIGHT } from '../config/balance';
import { ENEMIES } from '../config/enemies';
import { PASSIVES } from '../config/passives';
import { POTION_IDS, POTIONS } from '../config/potions';
import { DEFAULT_SEGMENT } from '../config/segments';
import type {
  BoonId,
  PassiveId,
  PlayerStats,
  PotionId,
  SegmentDef,
  SkillId,
  SkillStats,
  WeaponId,
  WeaponStats,
} from '../config/types';
import { WEAPONS } from '../config/weapons';
import type { Enemy } from '../entities/Enemy';
import type { Pickup } from '../entities/Pickup';
import { InputState } from '../input/InputState';
import { addXp } from '../logic/progression';
import { addLoot, lootGained } from '../logic/expedition';
import { deedBonus } from '../logic/deeds';
import { GOLD, GOLD_KEY } from '../config/merchant';
import { goldPerDrop, lanternLightsAll, lanternMultiplier } from '../logic/merchant';
import { dropsChest, rollChest, type ChestReward } from '../logic/chest';
import type { ExpeditionBuild } from '../logic/expedition';
import { GROUND_TEXTURES, GROUND_TILE } from '../config/ground';
import { parseHexKey } from '../logic/hex';
import { planHerbBlooms } from '../logic/herbs';
import { applyBuffs, damageTakenMultiplier } from '../logic/potions';
import { currentBuild, finishFight, returnHome, type FightReport } from '../logic/journey';
import { loadSave, recordRun, safeStorage, writeSave, type SaveData } from '../logic/save';
import { loadSettings } from '../logic/settings';
import type { RunOutcome } from '../logic/segment';
import { foundPlacement, isGoalDone } from '../logic/goals';
import {
  computePlayerStats,
  computeSkillStats,
  computeWeaponStats,
  createStartLoadout,
  damageAfterArmor,
  skillMaxLevel,
  weaponMaxLevel,
  weaponSteps,
  type Loadout,
} from '../logic/stats';
import { applyModifierStats, isModifierLevel, modifiersOf, rollModifierOptions } from '../logic/modifiers';
import { applyUpgrade, rollRareOptions, rollUpgradeOptions, type UpgradeOption } from '../logic/upgrades';
import { REWARDS } from '../config/rewards';
import { situationalDamage } from '../logic/hitEffects';
import { seasonWorld, segmentForHex } from '../logic/worldgen';
import type { CombatContext } from '../systems/CombatContext';
import type { VillageSceneData } from './VillageScene';
import { DamageNumbers } from '../systems/DamageNumbers';
import { HerbSystem, type EdgeIndicator, type HerbIndicator, type HerbSlot } from '../systems/HerbSystem';
import { EnemySystem } from '../systems/EnemySystem';
import { PickupSystem } from '../systems/PickupSystem';
import { PlayerController } from '../systems/PlayerController';
import { PlayerHealthBar } from '../systems/PlayerHealthBar';
import { PotionSystem } from '../systems/PotionSystem';
import { visionRange } from '../logic/vision';
import { LanternSystem } from '../systems/LanternSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { WatchfireSystem } from '../systems/WatchfireSystem';
import { devSwapMainWeapon, godModeStats } from '../dev/devLogic'; // DEV:
import { isDevMode } from '../dev/devMode'; // DEV:
import type { DevFightStats } from '../dev/DevPanel'; // DEV:
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
  /** Gold picked up in this fight */
  gold: number;
  /** Herbs gathered in this fight */
  herbsGathered: number;
  herbsTotal: number;
  /** How far the watchfire is lit, 0..1 (goal "find the light"; 0 otherwise) */
  lit: number;
  /** Whether the watchfire has been found (goal "find the light") */
  found: boolean;
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
  gold: number;
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
  private healthBar!: PlayerHealthBar;
  private enemies!: EnemySystem;
  private pickups!: PickupSystem;
  private numbers!: DamageNumbers;
  private herbs!: HerbSystem;
  private potions!: PotionSystem;
  /** Ring of this fight's hex (1 for fights outside the map) */
  private ring = 1;
  /** Lantern tiers bought from the merchant: a bigger light, for good */
  private lanternLevel = 0;
  /** Permanent bonuses from deeds, added to the player stats */
  private deedBonus: Partial<PlayerStats> = {};
  private lantern!: LanternSystem;
  private lighting!: LightingSystem;
  private ground!: Phaser.GameObjects.TileSprite;

  private weapons = new Map<WeaponId, Weapon>();
  private weaponStats: Partial<Record<WeaponId, WeaponStats>> = {};
  private skillStats!: Record<SkillId, SkillStats>;
  private skillReadyAt: Record<SkillId, number> = { dash: 0, nova: 0 };

  /** Game time in ms, only advances while the scene is not paused */
  private clock = 0;
  private levelUpOpen = false;
  private chestOpen = false;
  /** Chests picked up while a menu was open; they open one after another */
  private pendingChests: ChestReward[] = [];
  private pendingLevelUps = 0;
  /** Revives left (Second Wind) */
  private secondWinds = 0;
  /** Game time (ms) until which Ember Surge lasts */
  private surgeUntil = 0;
  private viewW = 800;
  private viewH = 600;
  private hexKey: string | null = null;
  private endInfo: RunEndInfo | null = null;
  /** The cold watchfire of a "find the light" fight, or null */
  private watchfire: WatchfireSystem | null = null;
  /** Seconds the player has moved through the dark looking for the watchfire */
  private searched = 0;
  /** The hex's reward was given (or its menu opened) once the goal was reached */
  private rewardGiven = false;
  /** A reward menu is open; when it closes, the fight ends */
  private endAfterMenu = false;
  /** DEV: "clear area" was pressed; the fight counts as won */
  private devCleared = false;

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
    this.chestOpen = false;
    this.pendingChests = [];
    this.pendingLevelUps = 0;
    this.secondWinds = 0;
    this.surgeUntil = 0;
    this.endInfo = null;
    this.devCleared = false;
    this.rewardGiven = false;
    this.endAfterMenu = false;
    this.watchfire = null;

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
    this.healthBar = new PlayerHealthBar(this);
    this.enemies = new EnemySystem(
      this,
      this.player,
      now,
      this.numbers,
      (e) => this.onEnemyKilled(e),
      (e) => this.onPlayerTouched(e, true),
      (a) => this.events.emit('surge', a),
    );
    this.enemies.devNoDamage = this.devInvincible(); // DEV: invincible mode
    this.pickups = new PickupSystem(this, this.player, (p) => this.onPickup(p));
    this.ctx = {
      scene: this,
      player: this.player,
      enemies: this.enemies,
      now,
      visionRange: () =>
        visionRange(this.run.stats.light, lanternLightsAll(this.lanternLevel) || this.devFullLight()), // DEV: full light
      hasModifier: (id) => this.run.loadout.modifiers?.includes(id) ?? false,
    };

    this.physics.add.overlap(this.player.sprite, this.enemies.group, (_p, e) =>
      this.onPlayerTouched(e as Enemy),
    );

    // The save comes first: the hex's goal depends on how many expeditions are finished.
    const saved = loadSave(safeStorage());
    const hexInfo = this.hexKey ? seasonWorld().hexes.get(this.hexKey) : undefined;
    const fireLit = this.hexKey !== null && saved.world.litWatchfires.includes(this.hexKey);
    const segment = hexInfo ? segmentForHex(hexInfo, saved.world.expeditions, fireLit) : DEFAULT_SEGMENT;
    this.ring = hexInfo?.ring ?? 1;
    this.enemies.setRing(this.ring);
    // Each biome has its own ground tile; without one, the grey placeholder is tinted instead.
    const groundTile = segment.biome ? GROUND_TEXTURES[segment.biome] : undefined;
    if (groundTile && this.textures.exists(groundTile.key)) {
      this.ground.setTexture(groundTile.key).clearTint();
    } else {
      this.ground.setTexture('ground').setTint(segment.groundTint);
    }

    // On an expedition the character keeps its build from the previous hex.
    const build = this.hexKey ? currentBuild(saved) : null;
    this.lanternLevel = saved.lanternLevel;
    this.deedBonus = deedBonus(saved.deeds);
    this.potions = new PotionSystem(saved.belt, now);
    // A fresh expedition starts with the main weapon chosen in the armory.
    const loadout = build?.loadout ?? createStartLoadout(saved.mainWeapon);
    const stats = computePlayerStats(loadout, this.deedBonus);
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
      gold: 0,
      herbsGathered: 0,
      herbsTotal: 0,
      lit: 0,
      found: false,
      loadout,
      stats,
    };
    this.refreshStats();

    // Find the light: the cold watchfire is hidden until the player has searched the dark long enough.
    this.searched = 0;
    if (segment.goal.kind === 'light') this.watchfire = new WatchfireSystem(this, this.player);

    // Fresh herbs every time a hex is entered. They bloom one by one at random moments;
    // nothing grows back during the fight.
    const blooms = segment.herbs
      ? planHerbBlooms(
          segment.herbs.biome,
          segment.herbs.ring,
          segment.durationSec,
          Math.random,
          segment.reward === 'herbs' ? REWARDS.herbsMul : 1,
        )
      : [];
    this.herbs = new HerbSystem(this, blooms, this.player, this.numbers, (herb) =>
      this.events.emit('herbbloom', herb),
    );
    this.run.herbsTotal = this.herbs.totalCount;
    // Night: darkness with the player's light, torches around and faintly glowing herbs.
    this.lantern = new LanternSystem(this, this.player, this.lanternLevel);
    this.lighting = new LightingSystem(
      this,
      this.lantern,
      () => [
        ...[this.lantern.light(this.time.now)].filter((l) => l !== null),
        ...this.herbs.lights(),
        ...[this.watchfire?.light() ?? null].filter((l) => l !== null),
        ...this.pickups.chests().map((c) => ({ ...c, radius: LIGHT.chestRadius, color: LIGHT.chestColor })),
      ],
      () => this.enemies.group.getChildren() as Enemy[],
      () => this.pickups.gems(),
      Math.floor(Math.random() * 2 ** 31),
    );
    const settings = loadSettings(safeStorage());
    this.lighting.setEnabled(settings.lighting);
    this.healthBar.setEnabled(settings.healthBar);
    this.lighting.setRadiusScale(this.run.stats.light);
    this.lighting.setLightsAll(lanternLightsAll(this.lanternLevel) || this.devFullLight()); // DEV: full light

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

  /** The small health bar under the player on or off (from the pause menu). */
  setHealthBar(on: boolean): void {
    this.healthBar.setEnabled(on);
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
    } else if (option.kind === 'boon') {
      this.applyBoon(option.id);
    } else {
      this.run.loadout = applyUpgrade(this.run.loadout, option);
      this.refreshStats();
    }
    this.pendingLevelUps -= 1;
    if (this.pendingLevelUps > 0) {
      this.emitLevelUp();
    } else {
      this.levelUpOpen = false;
      const chest = this.pendingChests.shift();
      if (chest) {
        this.openChest(chest);
        return;
      }
      if (this.endIfRewardDone()) return;
      this.controls.reset();
      this.scene.resume();
    }
  }

  /** Takes what the chest held (after its roll was shown) and goes on with the fight. */
  takeChest(reward: ChestReward): void {
    if (!this.chestOpen) return;
    this.run.gold += reward.gold;
    for (const option of reward.upgrades) this.run.loadout = applyUpgrade(this.run.loadout, option);
    if (reward.upgrades.length > 0) this.refreshStats();
    this.chestOpen = false;
    const next = this.pendingChests.shift();
    if (next) {
      this.openChest(next);
      return;
    }
    if (this.endIfRewardDone()) return;
    this.controls.reset();
    this.scene.resume();
  }

  pauseGame(): boolean {
    if (!this.run.started || !this.run.alive || this.levelUpOpen || this.chestOpen || this.scene.isPaused())
      return false;
    this.controls.reset();
    this.scene.pause();
    return true;
  }

  resumeGame(): void {
    if (this.levelUpOpen || this.chestOpen || !this.run.alive) return;
    this.controls.reset();
    this.scene.resume();
  }

  /** Edge arrows for nearby herbs that are off screen. */
  herbIndicators(): HerbIndicator[] {
    return this.run.alive ? this.herbs.indicators(this.viewW, this.viewH) : [];
  }

  /** Edge arrows for treasure chests off screen, however far away. */
  chestIndicators(): EdgeIndicator[] {
    if (!this.run.alive) return [];
    const { x: px, y: py } = this.player;
    const out: EdgeIndicator[] = [];
    for (const c of this.pickups.chests()) {
      const dx = c.x - px;
      const dy = c.y - py;
      const outX = Math.max(0, Math.abs(dx) - (this.viewW / 2 - 20));
      const outY = Math.max(0, Math.abs(dy) - (this.viewH / 2 - 20));
      const distance = Math.hypot(outX, outY);
      if (distance > 0) out.push({ angle: Math.atan2(dy, dx), distance, color: LIGHT.chestColor });
    }
    return out;
  }

  /**
   * Searching counts only while the player moves. Once they have searched long enough, the fire shows up
   * just outside the view in the direction they walk, so it feels like spotting it.
   */
  private searchForFire(dt: number): void {
    const goal = this.run.segment.goal;
    if (!this.watchfire || this.watchfire.found || goal.kind !== 'light') return;
    const { moveX, moveY } = this.controls;
    if (Math.hypot(moveX, moveY) <= 0.1) return;
    this.searched += dt;
    if (this.searched < goal.searchSec) return;
    const at = foundPlacement(Math.atan2(moveY, moveX), Math.random, this.viewW / 2, this.viewH / 2);
    this.watchfire.place(this.player.x + at.x, this.player.y + at.y);
    this.events.emit('firefound');
  }

  /** Edge arrow to the cold watchfire while it is off screen (goal "find the light"). */
  fireIndicator(): EdgeIndicator | null {
    return this.run.alive && this.watchfire ? this.watchfire.indicator(this.viewW, this.viewH) : null;
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
  // DEV: god mode (no damage, much stronger), kept for the session in the registry.
  devGodMode(): boolean {
    return isDevMode() && this.registry.get('devGod') === true;
  }

  // DEV: switches god mode and applies it right away. It replaces invincible mode.
  devToggleGodMode(): void {
    const on = !this.devGodMode();
    this.registry.set('devGod', on);
    if (on) {
      this.registry.set('devInvincible', false);
      this.enemies.devNoDamage = false;
    }
    this.refreshStats();
    this.run.hp = this.run.stats.maxHp;
  }

  // DEV: invincible mode: you take no damage and deal none, and the whole screen is lit. For watching
  // a horde in peace (nothing dies). Kept for the session in the registry; it replaces god mode.
  devInvincible(): boolean {
    return isDevMode() && this.registry.get('devInvincible') === true;
  }

  // DEV: switches invincible mode and applies it right away.
  devToggleInvincible(): void {
    const on = !this.devInvincible();
    this.registry.set('devInvincible', on);
    if (on) this.registry.set('devGod', false);
    this.enemies.devNoDamage = on;
    this.refreshStats();
    this.run.hp = this.run.stats.maxHp;
  }

  // DEV: whole screen lit, in god mode and in invincible mode.
  private devFullLight(): boolean {
    return this.devGodMode() || this.devInvincible();
  }

  // DEV: numbers for the dev panel (the game clock stops while paused).
  devStats(): DevFightStats {
    return {
      enemies: this.enemies.group.countActive(true),
      kills: this.run.kills,
      nowMs: this.clock,
      director: this.enemies.directorState,
    };
  }

  // DEV: spawns an elite at the edge of the view.
  devSpawnElite(): void {
    if (this.run.alive) this.enemies.devSpawnElite(ENEMIES.zombie, this.run.time);
  }

  // DEV: opens a level-up menu right away (stacks like normal level-ups).
  devLevelUp(): void {
    if (!this.run.alive) return;
    this.pendingLevelUps += 1;
    if (!this.levelUpOpen) this.openLevelUp();
  }

  // DEV: every weapon and item at its highest level, to test absurd builds.
  devWildBuild(): void {
    if (!this.run.alive) return;
    const loadout = this.run.loadout;
    const weapons: Loadout['weapons'] = { ...loadout.weapons };
    for (const id of Object.keys(WEAPONS) as WeaponId[]) weapons[id] = weaponMaxLevel(id);
    const passives: Loadout['passives'] = {};
    for (const id of Object.keys(PASSIVES) as PassiveId[]) passives[id] = PASSIVES[id].maxLevel;
    this.run.loadout = {
      weapons,
      passives,
      skills: { dash: skillMaxLevel('dash'), nova: skillMaxLevel('nova') },
    };
    this.refreshStats();
    this.run.hp = this.run.stats.maxHp;
  }

  // DEV: applies an upgrade picked from the dev list right away (no level-up needed).
  devApplyUpgrade(option: UpgradeOption): void {
    if (!this.run.alive) return;
    if (option.kind === 'boon') this.applyBoon(option.id);
    else if (option.kind === 'heal') this.heal(FULL_LOADOUT_HEAL);
    else {
      this.run.loadout = applyUpgrade(this.run.loadout, option);
      this.refreshStats();
    }
  }

  // DEV: swaps the main weapon for the next one at level 1, to compare them in the same fight.
  devSwapMainWeapon(): void {
    if (!this.run.alive) return;
    this.run.loadout = devSwapMainWeapon(this.run.loadout);
    for (const [id, weapon] of this.weapons) {
      if (this.run.loadout.weapons[id]) continue;
      weapon.clear?.();
      this.weapons.delete(id);
    }
    this.refreshStats();
  }

  // DEV: wins the fight at once (on the next frame), whatever its goal.
  devClearArea(): void {
    if (this.run.alive) this.devCleared = true;
  }

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
      this.lantern.update(Math.min(deltaMs, 50) / 1000);
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
    this.healthBar.update(this.player.x, this.player.y, this.run.hp / this.run.stats.maxHp);
    this.updateGround();
    this.lantern.update(dt);
    this.lighting.update(this.time.now);
    this.enemies.mods.damageMul = situationalDamage({
      moving: Math.hypot(this.controls.moveX, this.controls.moveY) > 0.1,
      momentum: this.run.stats.momentum,
      hpShare: this.run.hp / this.run.stats.maxHp,
      desperation: this.run.stats.desperation,
      surge: this.clock < this.surgeUntil ? BOONS.surgeBonus : 0,
    });
    this.enemies.spawn(dms, this.run.time + this.run.segment.difficultyOffsetSec, this.run.time);
    this.enemies.update();
    for (const [id, weapon] of this.weapons) weapon.update(this.weaponStats[id]!, dms, dt);
    this.pickups.update(dt, this.run.stats.magnet);
    this.herbs.update(dt, this.run.time, this.viewW, this.viewH);
    if (this.watchfire) {
      this.searchForFire(dt);
      this.watchfire.update(dt);
      this.run.lit = this.watchfire.progress;
      this.run.found = this.watchfire.found;
    }
    this.run.herbsGathered = this.herbs.gatheredCount;
    this.numbers.update(dt);

    if (this.run.stats.regen > 0) this.heal(this.run.stats.regen * dt);
    const goalState = {
      time: this.run.time,
      kills: this.run.kills,
      lit: this.run.lit,
      found: this.run.found,
    };
    if (isGoalDone(this.run.segment.goal, goalState) || this.devCleared) this.reachGoal(); // DEV: clear area
  }

  /** Recomputes all stats after the loadout changed and creates newly acquired weapons. */
  private refreshStats(): void {
    const prevMax = this.run.stats.maxHp;
    this.run.stats = applyBuffs(computePlayerStats(this.run.loadout, this.deedBonus), this.potions.active);
    this.run.stats.light *= lanternMultiplier(this.lanternLevel);
    if (this.devGodMode()) this.run.stats = godModeStats(this.run.stats); // DEV:
    this.lighting?.setRadiusScale(this.run.stats.light);
    this.lighting?.setLightsAll(lanternLightsAll(this.lanternLevel) || this.devFullLight()); // DEV: full light
    if (this.run.stats.maxHp > prevMax) this.run.hp += this.run.stats.maxHp - prevMax;

    const st = this.run.stats;
    this.enemies.mods.crit = st.crit;
    this.enemies.mods.critMul = st.critMul;
    this.enemies.mods.execute = st.execute;
    this.enemies.mods.eliteMul = st.eliteMul;
    this.enemies.hpMul = 1 + st.curse;

    this.weaponStats = {};
    for (const id of Object.keys(this.run.loadout.weapons) as WeaponId[]) {
      this.weaponStats[id] = applyModifierStats(
        computeWeaponStats(
          id,
          this.run.loadout.weapons[id]!,
          this.run.stats,
          weaponSteps(this.run.loadout, id),
        ),
        modifiersOf(this.run.loadout, id),
      );
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

  /** One-time cards (config/boons.ts): they act at once and are not part of the build. */
  private applyBoon(id: BoonId): void {
    const { x, y } = this.player;
    switch (id) {
      case 'cache': {
        const gold = goldPerDrop(this.ring) * BOONS.cacheDrops;
        this.run.gold += gold;
        this.numbers.show(x, y - 26, `+${gold} gold`, '#fde047', true);
        break;
      }
      case 'gemstorm':
        this.pickups.attractGems();
        break;
      case 'feast':
        this.heal(this.run.stats.maxHp);
        break;
      case 'novaburst':
        this.shockwave();
        break;
      case 'judgement':
        for (const e of this.enemies.active()) {
          if (e.airborne || Math.hypot(e.x - x, e.y - y) > BOONS.judgementRadius) continue;
          this.enemies.damage(e, e.elite ? e.hp * BOONS.judgementElite : e.hp, 0, 0, '#fde047');
        }
        this.cameras.main.flash(180, 255, 240, 180);
        break;
      case 'secondwind':
        this.secondWinds += 1;
        break;
      case 'embers':
        this.surgeUntil = this.clock + BOONS.surgeMs;
        break;
    }
  }

  /** A blast around the player that hurts and throws back everything near (Shockwave, Second Wind). */
  private shockwave(): void {
    const { x, y } = this.player;
    const damage = BOONS.shockDamage * this.run.stats.might;
    const fx = { knockback: BOONS.shockPush, percent: BOONS.shockPercent };
    for (const e of this.enemies.active()) {
      if (Math.hypot(e.x - x, e.y - y) <= BOONS.shockRadius + e.def.radius) {
        this.enemies.hit(e, damage, fx, x, y);
      }
    }
    const ring = this.add.image(x, y, 'ring').setTint(COLORS.accent).setDepth(5).setScale(0.15);
    this.tweens.add({
      targets: ring,
      scale: (BOONS.shockRadius * 2) / 120,
      alpha: 0,
      duration: 450,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.cameras.main.shake(160, 0.006);
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
    this.enemies.viewW = this.viewW;
    this.enemies.viewH = this.viewH;
    this.ground.setSize(this.viewW + GROUND_TILE * 2, this.viewH + GROUND_TILE * 2);
    this.lighting.resize(this.viewW, this.viewH);
  }

  /** Keeps the tiled ground under the camera, snapped to the tile grid. */
  private updateGround(): void {
    const x = Math.floor((this.player.x - this.viewW / 2) / GROUND_TILE) * GROUND_TILE - GROUND_TILE;
    const y = Math.floor((this.player.y - this.viewH / 2) / GROUND_TILE) * GROUND_TILE - GROUND_TILE;
    this.ground.setPosition(x, y);
  }

  // ---------------------------------------------------------------- Events from the systems

  /** `landing`: the hit of a leap that came down on the player; otherwise plain touching. */
  private onPlayerTouched(e: Enemy, landing = false): void {
    if (
      !e.active ||
      (e.airborne && !landing) ||
      !this.run.alive ||
      this.devGodMode() ||
      this.devInvincible() ||
      !this.player.tryTakeHit()
    )
      return; // DEV: god mode, invincible
    if (Math.random() < this.run.stats.dodge) {
      this.numbers.show(this.player.x, this.player.y - 22, 'dodge', '#93c5fd', true);
      return;
    }
    this.herbs.interrupt();
    const thorns = this.run.stats.thorns;
    if (thorns > 0) this.enemies.damage(e, thorns, 0, 0, '#a3e635');
    const dmg = damageAfterArmor(e.damage, this.run.stats.armor) * damageTakenMultiplier(this.potions.active);
    this.run.hp -= dmg;
    this.numbers.show(this.player.x, this.player.y - 22, `-${Math.round(dmg)}`, '#ff6b81', true);
    if (this.run.hp <= 0 && this.secondWinds > 0) {
      this.secondWinds -= 1;
      this.run.hp = this.run.stats.maxHp * BOONS.windHeal;
      this.player.protect(BOONS.windProtectMs);
      this.shockwave();
      this.numbers.show(this.player.x, this.player.y - 34, 'second wind!', '#fde047', true);
      return;
    }
    if (this.run.hp <= 0) {
      this.run.hp = 0;
      this.player.showDefeated();
      this.lantern.snuff();
      this.endRun('fallen');
    }
  }

  private onEnemyKilled(e: Enemy): void {
    this.run.kills += 1;
    if (Math.random() < BALANCE.healDropChance) this.pickups.drop(e.x, e.y, 'heal', BALANCE.healAmount);
    else this.pickups.drop(e.x, e.y, 'xp', e.def.xp * (e.elite ? ELITE.xp : 1) * this.run.stats.xpGain);
    if (this.run.stats.bloodthirst > 0) this.heal(this.run.stats.bloodthirst);
    // Any enemy may leave a treasure chest (elites much more often) or a little gold.
    if (dropsChest(e.elite, Math.random, this.run.stats.fortune)) {
      this.pickups.drop(e.x, e.y + 10, 'chest', 0);
      this.events.emit('chestdrop');
    }
    const goldMul = this.run.segment.reward === 'gold' ? REWARDS.goldDropMul : 1;
    if (Math.random() < GOLD.dropChance * goldMul)
      this.pickups.drop(e.x + 8, e.y - 6, 'gold', goldPerDrop(this.ring));
  }

  private onPickup(p: Pickup): void {
    if (p.kind === 'chest') {
      const reward = rollChest(this.run.loadout, this.ring, Math.random);
      // A level-up menu comes first; the chest opens right after it.
      if (this.levelUpOpen) this.pendingChests.push(reward);
      else this.openChest(reward);
      return;
    }
    if (p.kind === 'gold') {
      this.run.gold += p.value;
      this.numbers.show(this.player.x, this.player.y - 26, `+${p.value} gold`, '#fde047', true);
      return;
    }
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

  private openChest(reward: ChestReward): void {
    this.chestOpen = true;
    this.controls.reset();
    this.scene.pause();
    this.events.emit('chest', reward);
  }

  private openLevelUp(): void {
    this.levelUpOpen = true;
    this.controls.reset();
    this.scene.pause();
    this.emitLevelUp();
  }

  /**
   * Shows the menu for the next pending level. At modifier levels (config/modifiers.ts) it offers
   * modifiers of the main weapon instead of the usual cards, while there are any left.
   */
  private emitLevelUp(): void {
    const level = this.run.level - this.pendingLevelUps + 1;
    if (isModifierLevel(level)) {
      const mods = rollModifierOptions(this.run.loadout, Math.random);
      if (mods.length > 0) {
        const options: UpgradeOption[] = mods.map((id) => ({ kind: 'modifier', id }));
        this.events.emit('levelup', options, level, 'Weapon modifier');
        return;
      }
    }
    this.events.emit('levelup', rollUpgradeOptions(this.run.loadout, Math.random), level);
  }

  /**
   * The goal is reached: first the hex's reward (config/rewards.ts), then the fight ends. A chest or a rare
   * card opens its menu first; the fight ends when it is closed.
   */
  private reachGoal(): void {
    if (this.levelUpOpen || this.chestOpen) return; // a menu that is open comes first
    if (this.rewardGiven) {
      this.endRun('cleared');
      return;
    }
    this.rewardGiven = true;
    const { x, y } = this.player;
    switch (this.run.segment.reward) {
      case 'chest':
        this.endAfterMenu = true;
        this.openChest(rollChest(this.run.loadout, this.ring, Math.random));
        return;
      case 'card':
        this.endAfterMenu = true;
        this.levelUpOpen = true;
        this.pendingLevelUps += 1;
        this.controls.reset();
        this.scene.pause();
        this.events.emit(
          'levelup',
          rollRareOptions(this.run.loadout, Math.random, REWARDS.cardChoices),
          this.run.level,
          'Reward: a rare card',
        );
        return;
      case 'heal':
        this.run.hp = this.run.stats.maxHp;
        this.numbers.show(x, y - 26, 'full health', '#4ade80', true);
        break;
      case 'gold': {
        const gold = goldPerDrop(this.ring) * REWARDS.goldBonusDrops;
        this.run.gold += gold;
        this.numbers.show(x, y - 26, `+${gold} gold`, '#fde047', true);
        break;
      }
      default:
        break;
    }
    this.endRun('cleared');
  }

  /** After the reward's menu: the fight ends instead of going on. Returns true when it did. */
  private endIfRewardDone(): boolean {
    if (!this.endAfterMenu) return false;
    this.endAfterMenu = false;
    this.controls.reset();
    this.scene.resume();
    this.endRun('cleared');
    return true;
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
        this.run.gold > 0 ? addLoot(this.herbs.loot, { [GOLD_KEY]: this.run.gold }) : this.herbs.loot,
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
      gold: this.run.gold,
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
