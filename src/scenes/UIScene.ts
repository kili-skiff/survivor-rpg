import * as Phaser from 'phaser';
import { LIGHT } from '../config/balance';
import { PASSIVES } from '../config/passives';
import { HERBS } from '../config/herbs';
import { POTION_IDS, POTIONS } from '../config/potions';
import { SKILLS } from '../config/skills';
import type { HerbId, PassiveId, PotionId, SkillId, WeaponId } from '../config/types';
import { WEAPONS } from '../config/weapons';
import type { InputState } from '../input/InputState';
import { describeEarned } from '../logic/deeds';
import type { Announcement } from '../logic/director';
import { formatTime, xpToNext } from '../logic/progression';
import { safeStorage } from '../logic/save';
import { GOALS } from '../config/goals';
import { goalCounter, goalLabel } from '../logic/goals';
import { loadSettings, otherSide, writeSettings, type Settings } from '../logic/settings';
import { RARITIES } from '../config/rarity';
import { describeUpgrade, type UpgradeOption } from '../logic/upgrades';
import { DevPanel } from '../dev/DevPanel'; // DEV:
import { isDevMode } from '../dev/devMode'; // DEV:
import { safeArea, viewportSize, type SafeArea } from '../ui/display';
import { COLORS, css, FONT } from '../ui/theme';
import type { GameScene, RunEndInfo } from './GameScene';
import type { ChestReward } from '../logic/chest';

interface PotionButton {
  id: PotionId;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
  x: number;
  y: number;
  r: number;
}

/** Warnings of a coming surge are red, so they stand out from the friendly hints */
const SURGE_COLOR = 0xff6a6a;

type OverlayKind = 'none' | 'levelup' | 'pause' | 'runend' | 'chest';

/** Every upgrade icon, for the spinning reels of a treasure chest */
const REEL_TEXTURES = [
  ...Object.values(WEAPONS).map((w) => w.texture),
  ...Object.values(PASSIVES).map((p) => p.texture),
  ...Object.values(SKILLS).map((s) => s.texture),
];

interface SkillButton {
  id: SkillId;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  cd: Phaser.GameObjects.Text;
  x: number;
  y: number;
  r: number;
}

/**
 * HUD, touch controls, keyboard and all menus.
 * Runs in parallel on top of the GameScene and is never paused.
 */
export class UIScene extends Phaser.Scene {
  private gs!: GameScene;
  private controls!: InputState;
  private hud!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  /** The goal's symbol, left of its counter */
  private goalIcon!: Phaser.GameObjects.Image;
  /** Font size of the goal's counter (px); changes between numbers and words */
  private counterSize = 0;
  private segmentText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private herbText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private pauseBtn!: Phaser.GameObjects.Text;
  private devPanel: DevPanel | null = null; // DEV:
  private skillButtons: SkillButton[] = [];
  private potionButtons: PotionButton[] = [];
  private loadoutIcons: Phaser.GameObjects.GameObject[] = [];
  /** DEV: left edge of the dev panel, and where the icon rows end (set by the layout) */
  private devPanelLeft = 0;
  private loadoutSignature = '';

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private isTouch = false;
  private settings!: Settings;

  private stickPointerId: number | null = null;
  private stickOrigin = new Phaser.Math.Vector2();
  private stickPos = new Phaser.Math.Vector2();

  private overlay: Phaser.GameObjects.GameObject[] = [];
  private overlayKind: OverlayKind = 'none';
  private overlayOpenedAt = 0;
  private levelUpOptions: UpgradeOption[] = [];
  private levelUpLevel = 1;
  private runEndInfo?: RunEndInfo;
  private chestReward?: ChestReward;
  /** Reels of the open chest that have stopped */
  private chestRevealed = 0;
  /** The chest is shown closed first; tapping it opens it and starts the reels. */
  private chestStage: 'closed' | 'opening' | 'reels' = 'closed';
  /** Opens the closed chest on screen (set while it is shown). */
  private openShownChest?: () => void;
  private chestEvents: Phaser.Time.TimerEvent[] = [];
  /** Rows taken by the hints below the timer, so two hints do not overlap */
  private readonly hintSlots = new Set<number>();
  private pressedCard = -1;

  /** UI scale (accounts for pixel density and screen size) */
  private u = 1;
  private sa: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

  constructor() {
    super('UI');
  }

  create(): void {
    this.gs = this.scene.get('Game') as GameScene;
    this.controls = this.registry.get('input') as InputState;
    this.isTouch = this.sys.game.device.input.touch;
    this.settings = loadSettings(safeStorage());
    this.hintSlots.clear();
    this.skillButtons = [];
    this.potionButtons = [];
    this.loadoutIcons = [];
    this.loadoutSignature = '';
    this.overlay = [];
    this.overlayKind = 'none';
    this.stickPointerId = null;

    this.input.addPointer(2);
    this.input.mouse?.disableContextMenu();

    this.hud = this.add.graphics().setDepth(0);
    const textStyle = (size: number, bold = true): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.timerText = this.add.text(0, 0, '00:00', textStyle(22)).setOrigin(0.5, 0);
    this.goalIcon = this.add.image(0, 0, GOALS.icons[this.gs.run.segment.goal.kind]).setOrigin(1, 0.5);
    this.segmentText = this.add.text(0, 0, '', textStyle(11, false)).setOrigin(0.5, 0);
    this.levelText = this.add.text(0, 0, 'Level 1', textStyle(14));
    this.hpText = this.add.text(0, 0, '', textStyle(10)).setOrigin(0.5, 0.5).setDepth(1);
    this.killsText = this.add.text(0, 0, '', textStyle(14)).setOrigin(1, 0);
    this.herbText = this.add.text(0, 0, '', { ...textStyle(13), color: '#bbf7d0' }).setOrigin(1, 0);
    this.goldText = this.add.text(0, 0, '', { ...textStyle(13), color: '#fde047' }).setOrigin(1, 0);
    this.pauseBtn = this.add
      .text(0, 0, 'II', { ...textStyle(18), backgroundColor: '#00000066', padding: { x: 12, y: 6 } })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => this.togglePause());
    // DEV: foldable dev panel: buttons, frame rate, enemy count, kills per minute.
    this.devPanel = isDevMode()
      ? new DevPanel(
          this,
          this.u,
          [
            { label: () => 'clear area', run: () => this.gs.devClearArea() },
            {
              label: () => (this.gs.devGodMode() ? 'god mode on' : 'god mode off'),
              active: () => this.gs.devGodMode(),
              short: 'god mode',
              run: () => this.gs.devToggleGodMode(),
            },
            { label: () => 'spawn elite', run: () => this.gs.devSpawnElite() },
            { label: () => 'level up', run: () => this.gs.devLevelUp() },
            { label: () => 'wild build', run: () => this.gs.devWildBuild() },
            {
              label: () => (this.gs.devInvincible() ? 'invincible on' : 'invincible off'),
              active: () => this.gs.devInvincible(),
              short: 'invincible',
              run: () => this.gs.devToggleInvincible(),
            },
          ],
          () => this.gs.devStats(),
        )
      : null;

    this.createSkillButton('dash', this.isTouch ? 'Dash' : 'Dash · Space');
    this.createSkillButton('nova', this.isTouch ? 'Nova' : 'Nova · E');
    // One button per kind of potion packed in the belt.
    POTION_IDS.filter((id) => this.gs.potionCount(id) > 0).forEach((id, i) =>
      this.createPotionButton(id, this.isTouch ? POTIONS[id].short : `${POTIONS[id].short} · ${i + 1}`),
    );

    this.setupKeyboard();
    this.setupJoystick();

    this.layout();
    this.scale.on('resize', this.onResize, this);
    this.gs.events.on('levelup', this.onLevelUp, this);
    this.gs.events.on('chest', this.onChest, this);
    this.gs.events.on('runend', this.onRunEnd, this);
    this.gs.events.on('herbbloom', this.onHerbBloom, this);
    this.gs.events.on('chestdrop', this.onChestDrop, this);
    this.gs.events.on('surge', this.onSurge, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.gs.events.off('levelup', this.onLevelUp, this);
      this.gs.events.off('chest', this.onChest, this);
      this.gs.events.off('runend', this.onRunEnd, this);
      this.gs.events.off('herbbloom', this.onHerbBloom, this);
      this.gs.events.off('chestdrop', this.onChestDrop, this);
      this.gs.events.off('surge', this.onSurge, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    });

    this.showSegmentBanner();
  }

  override update(): void {
    this.updateMovement();
    this.drawHud();
    this.devPanel?.setVisible(this.overlayKind === 'none'); // DEV: hidden while a menu is open
    this.devPanel?.update(); // DEV:
  }

  // ---------------------------------------------------------------- Input

  private setupKeyboard(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-SPACE', () => this.onConfirmKey('dash'));
    kb.on('keydown-Q', () => this.overlayKind === 'none' && this.controls.press('dash'));
    kb.on('keydown-E', () => this.overlayKind === 'none' && this.controls.press('nova'));
    kb.on('keydown-ENTER', () => this.onConfirmKey(null));
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-ONE', () => this.onNumberKey(0));
    kb.on('keydown-TWO', () => this.onNumberKey(1));
    kb.on('keydown-THREE', () => this.onNumberKey(2));
  }

  private onConfirmKey(action: 'dash' | null): void {
    if (this.overlayKind === 'none') {
      if (action) this.controls.press(action);
    } else if (this.overlayKind === 'pause') this.togglePause();
    else if (this.overlayKind === 'chest') this.onChestConfirm();
    else if (this.overlayKind === 'runend' && this.time.now - this.overlayOpenedAt > 600)
      this.gs.returnToMap();
  }

  private setupJoystick(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || this.overlayKind !== 'none' || this.stickPointerId !== null) return;
      this.stickPointerId = pointer.id;
      this.stickOrigin.set(pointer.x, pointer.y);
      this.stickPos.set(pointer.x, pointer.y);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.stickPointerId) this.stickPos.set(pointer.x, pointer.y);
    });
    const release = (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.stickPointerId) this.stickPointerId = null;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  private stickRadius(): number {
    return 56 * this.u;
  }

  private updateMovement(): void {
    if (this.overlayKind !== 'none') {
      this.controls.setMove(0, 0);
      return;
    }
    if (this.stickPointerId !== null) {
      const r = this.stickRadius();
      const dx = this.stickPos.x - this.stickOrigin.x;
      const dy = this.stickPos.y - this.stickOrigin.y;
      const len = Math.hypot(dx, dy);
      // The base follows when the thumb pulls far out (feels better on phones).
      if (len > r * 1.4) {
        this.stickOrigin.x = this.stickPos.x - (dx / len) * r * 1.4;
        this.stickOrigin.y = this.stickPos.y - (dy / len) * r * 1.4;
      }
      const dead = 0.12;
      const mag = Math.min(len / r, 1);
      if (mag < dead) this.controls.setMove(0, 0);
      else this.controls.setMove((dx / len) * mag, (dy / len) * mag);
      return;
    }
    if (!this.keys) {
      this.controls.setMove(0, 0);
      return;
    }
    const k = this.keys;
    const x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    this.controls.setMove(x, y);
  }

  private createPotionButton(id: PotionId, label: string): void {
    const icon = this.add.image(0, 0, 'potion').setTint(POTIONS[id].color);
    // A generous round hit area: the flask itself is small.
    icon.setInteractive({
      hitArea: new Phaser.Geom.Circle(13, 15, 22),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
    });
    icon.on('pointerdown', () => this.drinkPotion(id));
    const style = {
      fontFamily: FONT,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    };
    const labelText = this.add.text(0, 0, label, { ...style, fontSize: '11px' }).setOrigin(0.5, 0);
    const count = this.add
      .text(0, 0, '', { ...style, fontSize: '12px' })
      .setOrigin(0.5)
      .setDepth(2);
    this.potionButtons.push({ id, icon, label: labelText, count, x: 0, y: 0, r: 24 });
  }

  private drinkPotion(id: PotionId): void {
    if (this.overlayKind === 'none') this.controls.press(`drink:${id}`);
  }

  /** Number keys pick a level-up card in the menu and drink potions during the fight. */
  private onNumberKey(index: number): void {
    if (this.overlayKind === 'levelup') this.chooseCard(index);
    else {
      const button = this.potionButtons[index];
      if (button) this.drinkPotion(button.id);
    }
  }

  private createSkillButton(id: SkillId, label: string): void {
    const icon = this.add.image(0, 0, SKILLS[id].texture);
    icon.setInteractive({
      hitArea: new Phaser.Geom.Circle(22, 22, 26),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
    });
    icon.on('pointerdown', () => {
      if (this.overlayKind === 'none') this.controls.press(id);
    });
    const style = {
      fontFamily: FONT,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    };
    const labelText = this.add.text(0, 0, label, { ...style, fontSize: '12px' }).setOrigin(0.5, 0);
    const cd = this.add
      .text(0, 0, '', { ...style, fontSize: '18px' })
      .setOrigin(0.5)
      .setDepth(2);
    this.skillButtons.push({ id, icon, label: labelText, cd, x: 0, y: 0, r: 30 });
  }

  // ---------------------------------------------------------------- Layout

  private onResize(): void {
    this.layout();
    // Rebuild open menus so they fit the new size.
    const kind = this.overlayKind;
    if (kind === 'levelup') this.showLevelUp();
    else if (kind === 'pause') this.showPause();
    else if (kind === 'chest') this.showChest();
    else if (kind === 'runend' && this.runEndInfo) this.showRunEnd(this.runEndInfo);
  }

  private layout(): void {
    const { width: W, height: H } = this.scale;
    this.cameras.resize(W, H);
    const cssSize = viewportSize();
    const rs = W / cssSize.width;
    this.u = rs * Phaser.Math.Clamp(Math.min(cssSize.width, cssSize.height) / 400, 0.85, 1.25);
    const sa = safeArea();
    this.sa = { top: sa.top * rs, right: sa.right * rs, bottom: sa.bottom * rs, left: sa.left * rs };
    const u = this.u;
    const m = 12 * u;
    const top = this.sa.top + 10 * u;
    const left = this.sa.left + m;
    const right = W - this.sa.right - m;

    this.counterSize = 0; // set again by the next update, for the new size
    this.timerText.setPosition(W / 2, top + 4 * u);
    this.segmentText.setFontSize(Math.round(11 * u)).setPosition(W / 2, top + 32 * u);
    this.levelText.setFontSize(Math.round(14 * u)).setPosition(left, top + 24 * u);
    this.hpText.setFontSize(Math.round(10 * u)).setPosition(left + 75 * u, top + 12 * u);
    this.pauseBtn
      .setFontSize(Math.round(16 * u))
      .setPadding(Math.round(12 * u), Math.round(6 * u))
      .setPosition(right, top);
    this.devPanelLeft = left; // DEV: the panel sits below the icon rows on the left
    this.loadoutSignature = ''; // the icon rows follow the new size
    this.updateLoadoutIcons();
    this.killsText
      .setFontSize(Math.round(14 * u))
      .setPosition(right - this.pauseBtn.width - 10 * u, top + 6 * u);

    // Skill buttons stand in a column at the screen edge the player chose, so the thumb
    // reaches all of them without stretching across the screen. Dash, used most, sits lowest.
    const bottom = H - this.sa.bottom - m;
    const dash = this.skillButtons[0];
    const nova = this.skillButtons[1];
    dash.r = 38 * u;
    nova.r = 32 * u;
    const columnX = this.settings.skillSide === 'left' ? left + dash.r + 4 * u : right - dash.r - 4 * u;
    const labelSpace = 22 * u;
    dash.x = columnX;
    dash.y = bottom - dash.r - labelSpace;
    nova.x = columnX;
    nova.y = dash.y - dash.r - labelSpace - 6 * u - nova.r;
    for (const b of this.skillButtons) {
      b.icon.setPosition(b.x, b.y).setDisplaySize(b.r * 2, b.r * 2);
      b.label.setFontSize(Math.round(11 * u)).setPosition(b.x, b.y + b.r + 4 * u);
      b.cd.setFontSize(Math.round(18 * u)).setPosition(b.x, b.y);
    }

    // Potions stand in a second, smaller column just inside the skills, lowest first.
    const potionR = 24 * u;
    const inward = this.settings.skillSide === 'left' ? 1 : -1;
    const potionX = columnX + inward * (dash.r + 16 * u + potionR);
    const potionLabel = 18 * u;
    this.potionButtons.forEach((p, i) => {
      p.r = potionR;
      p.x = potionX;
      p.y = bottom - potionLabel - potionR - i * (potionR * 2 + potionLabel + 8 * u);
      p.icon.setPosition(p.x, p.y).setDisplaySize(potionR * 1.1, potionR * 1.27);
      p.label.setFontSize(Math.round(11 * u)).setPosition(p.x, p.y + potionR + 3 * u);
      p.count.setFontSize(Math.round(13 * u)).setPosition(p.x + potionR * 0.85, p.y - potionR * 0.85);
    });
    this.loadoutSignature = '';
  }

  // ---------------------------------------------------------------- HUD drawing

  private drawHud(): void {
    const run = this.gs.run;
    const g = this.hud;
    const { width: W } = this.scale;
    const u = this.u;
    const m = 12 * u;
    const top = this.sa.top + 10 * u;
    const left = this.sa.left + m;
    g.clear();

    // XP bar at the very top
    const xpFrac = Phaser.Math.Clamp(run.xp / xpToNext(run.level), 0, 1);
    const xpH = 6 * u;
    g.fillStyle(COLORS.xpBack).fillRect(0, this.sa.top, W, xpH);
    g.fillStyle(COLORS.xp).fillRect(0, this.sa.top, W * xpFrac, xpH);

    // Health bar
    const hpW = 150 * u;
    const hpH = 12 * u;
    const hpY = top + 6 * u;
    const hpFrac = Phaser.Math.Clamp(run.hp / run.stats.maxHp, 0, 1);
    g.fillStyle(0x000000, 0.5).fillRoundedRect(left - 2 * u, hpY - 2 * u, hpW + 4 * u, hpH + 4 * u, 5 * u);
    g.fillStyle(COLORS.hpBack).fillRoundedRect(left, hpY, hpW, hpH, 4 * u);
    if (hpFrac > 0)
      g.fillStyle(COLORS.hp).fillRoundedRect(left, hpY, Math.max(hpW * hpFrac, 8 * u), hpH, 4 * u);

    this.hpText.setText(`${Math.ceil(run.hp)}/${run.stats.maxHp}`);
    this.levelText.setText(`Level ${run.level}`);
    // The goal's counter: the time left, or the kills so far.
    const counter = goalCounter(
      run.segment.goal,
      { time: run.time, kills: run.kills, lit: run.lit },
      run.segment.warningSec,
    );
    // The light goal shows words ("Find the watchfire"), set smaller than a number, so they fit next to
    // the health bar.
    const counterSize = Math.round((run.segment.goal.kind === 'light' ? 15 : 22) * this.u);
    if (counterSize !== this.counterSize) {
      this.counterSize = counterSize;
      this.timerText.setFontSize(counterSize);
    }
    this.timerText.setText(counter.text).setColor(counter.warning ? css(COLORS.accent) : '#ffffff');
    const iconSize = 20 * this.u;
    this.goalIcon
      .setDisplaySize(iconSize, iconSize)
      .setPosition(
        this.timerText.x - this.timerText.width / 2 - 6 * this.u,
        this.timerText.y + this.timerText.height / 2,
      );
    this.segmentText.setText(run.segment.name);
    this.killsText.setText(`☠ ${run.kills}`);
    // Gold (once there is some) and herbs stack below the kills on the right.
    let rightY = this.killsText.y + this.killsText.height + 4 * u;
    this.goldText
      .setFontSize(Math.round(13 * u))
      .setText(run.gold > 0 ? `${run.gold} gold` : '')
      .setPosition(this.killsText.x, rightY);
    if (run.gold > 0) rightY += this.goldText.height + 2 * u;
    this.herbText.setText(run.herbsTotal > 0 ? 'Herbs' : '').setPosition(this.killsText.x, rightY);
    this.drawHerbSlots(g);

    this.drawEdgeArrows(g);

    // Skill buttons with cooldown
    for (const b of this.skillButtons) {
      const frac = this.gs.skillCooldownFraction(b.id);
      g.fillStyle(0x000000, 0.35).fillCircle(b.x, b.y + 3 * u, b.r + 4 * u);
      if (frac > 0) {
        g.fillStyle(0x000000, 0.6);
        g.slice(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false).fillPath();
        b.cd.setText((this.gs.skillCooldownRemaining(b.id) / 1000).toFixed(1));
        b.icon.setAlpha(0.75);
      } else {
        g.lineStyle(3 * u, COLORS.accent, 0.9).strokeCircle(b.x, b.y, b.r + 2 * u);
        b.cd.setText('');
        b.icon.setAlpha(1);
      }
    }

    // Potion buttons: a ring in the potion colour shows how long its buff still runs.
    for (const p of this.potionButtons) {
      const count = this.gs.potionCount(p.id);
      const color = POTIONS[p.id].color;
      g.fillStyle(0x000000, 0.45).fillCircle(p.x, p.y, p.r);
      g.lineStyle(2 * u, color, count > 0 ? 0.8 : 0.3).strokeCircle(p.x, p.y, p.r);
      const buff = this.gs.potionBuffFraction(p.id);
      if (buff > 0) {
        g.lineStyle(4 * u, color, 1);
        g.beginPath();
        g.arc(p.x, p.y, p.r + 4 * u, -Math.PI / 2, -Math.PI / 2 + buff * Math.PI * 2, false);
        g.strokePath();
      }
      p.icon.setAlpha(count > 0 ? 1 : 0.3);
      p.label.setAlpha(count > 0 ? 1 : 0.5);
      p.count.setText(`×${count}`).setColor(count > 0 ? '#ffffff' : '#71717a');
    }

    // Joystick
    if (this.stickPointerId !== null && this.overlayKind === 'none') {
      const r = this.stickRadius();
      g.fillStyle(0xffffff, 0.08).fillCircle(this.stickOrigin.x, this.stickOrigin.y, r);
      g.lineStyle(2 * u, 0xffffff, 0.3).strokeCircle(this.stickOrigin.x, this.stickOrigin.y, r);
      const dx = this.stickPos.x - this.stickOrigin.x;
      const dy = this.stickPos.y - this.stickOrigin.y;
      const len = Math.hypot(dx, dy);
      const k = len > r ? r / len : 1;
      g.fillStyle(0xffffff, 0.45).fillCircle(
        this.stickOrigin.x + dx * k,
        this.stickOrigin.y + dy * k,
        24 * u,
      );
    }

    this.updateLoadoutIcons();
  }

  /**
   * One dot per herb next to the "Herbs" label: filled when gathered, glowing when bloomed and
   * waiting, hollow when still to come.
   */
  private drawHerbSlots(g: Phaser.GameObjects.Graphics): void {
    const slots = this.gs.herbSlots();
    if (slots.length === 0) return;
    const u = this.u;
    const r = 4.5 * u;
    const gap = 4 * u;
    const y = this.herbText.y + this.herbText.height + r + 4 * u;
    const right = this.herbText.x;
    const pulse = 0.6 + Math.sin(this.time.now / 160) * 0.4;
    slots.forEach((slot, i) => {
      const x = right - r - (slots.length - 1 - i) * (r * 2 + gap);
      if (slot === 'gathered') g.fillStyle(0x4ade80, 1).fillCircle(x, y, r);
      else if (slot === 'bloomed') {
        g.fillStyle(0xbbf7d0, pulse).fillCircle(x, y, r);
        g.lineStyle(1.5 * u, 0xffffff, pulse).strokeCircle(x, y, r + 1.5 * u);
      } else g.lineStyle(1.5 * u, 0xffffff, 0.45).strokeCircle(x, y, r - 0.5 * u);
    });
  }

  /**
   * Arrows at the screen edge: to nearby herbs that are off screen, and to every treasure chest
   * off screen (bigger, golden and gently pulsing, so a chest that fell in the dark is not lost).
   */
  private drawEdgeArrows(g: Phaser.GameObjects.Graphics): void {
    if (this.overlayKind !== 'none') return;
    const u = this.u;
    for (const ind of this.gs.herbIndicators()) {
      // Fresh blooms pulse and are a bit bigger so they catch the eye.
      const pulse =
        ind.freshness > 0 ? 1 + 0.35 * ind.freshness * (0.5 + 0.5 * Math.sin(this.time.now / 90)) : 1;
      const size = (ind.rare ? 13 : 10) * u * pulse;
      const alpha = ind.freshness > 0 ? 1 : Phaser.Math.Clamp(1.1 - ind.distance / 500, 0.45, 1);
      this.drawEdgeArrow(g, ind.angle, size, ind.color, alpha);
    }
    const fire = this.gs.fireIndicator();
    if (fire) {
      // The goal of the fight: big and steady, so it is always easy to find.
      const size = 16 * u * (1 + 0.12 * (0.5 + 0.5 * Math.sin(this.time.now / 220)));
      this.drawEdgeArrow(g, fire.angle, size, fire.color, 1, true);
    }
    for (const ind of this.gs.chestIndicators()) {
      const size = 14 * u * (1 + 0.15 * (0.5 + 0.5 * Math.sin(this.time.now / 160)));
      this.drawEdgeArrow(g, ind.angle, size, ind.color, 1, true);
    }
  }

  private drawEdgeArrow(
    g: Phaser.GameObjects.Graphics,
    angle: number,
    size: number,
    color: number,
    alpha: number,
    outline = false,
  ): void {
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const cx = W / 2;
    const cy = H / 2;
    const left = this.sa.left + 26 * u;
    const right = W - this.sa.right - 26 * u;
    const top = this.sa.top + 110 * u;
    const bottom = H - this.sa.bottom - 30 * u;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    // Walk along the direction until the inset screen rectangle is hit.
    const tx = dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity;
    const ty = dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity;
    const t = Math.min(tx, ty);
    const x = cx + dx * t;
    const y = cy + dy * t;
    // A long, slim arrow so the direction is unambiguous.
    const tip = { x: x + dx * size * 1.2, y: y + dy * size * 1.2 };
    const back = { x: x - dx * size * 0.7, y: y - dy * size * 0.7 };
    const side = { x: -dy * size * 0.6, y: dx * size * 0.6 };
    g.fillStyle(0x000000, 0.5 * alpha).fillCircle(x, y, size * 1.15);
    if (outline) g.lineStyle(2 * u, color, 0.9).strokeCircle(x, y, size * 1.15);
    g.fillStyle(color, alpha).fillTriangle(
      tip.x,
      tip.y,
      back.x + side.x,
      back.y + side.y,
      back.x - side.x,
      back.y - side.y,
    );
  }

  private updateLoadoutIcons(): void {
    const { weapons, passives } = this.gs.run.loadout;
    const signature = JSON.stringify([weapons, passives]);
    if (signature === this.loadoutSignature) return;
    this.loadoutSignature = signature;
    for (const o of this.loadoutIcons) o.destroy();
    this.loadoutIcons = [];

    const u = this.u;
    const size = 26 * u;
    const gap = 4 * u;
    const startX = this.sa.left + 12 * u;
    const startY = this.sa.top + 10 * u + 46 * u;
    // Without a limit on items the row gets long: it wraps before it reaches the timer in the middle.
    const perRow = Math.max(4, Math.floor((this.scale.width / 2 - 36 * u - startX + gap) / (size + gap)));
    let col = 0;
    let row = 0;
    const add = (texture: string, level: number) => {
      if (col >= perRow) {
        col = 0;
        row += 1;
      }
      const x = startX + col * (size + gap);
      const y = startY + row * (size + gap);
      const img = this.add.image(x, y, texture).setOrigin(0, 0).setDisplaySize(size, size);
      const lv = this.add
        .text(x + size, y + size, String(level), {
          fontFamily: FONT,
          fontStyle: 'bold',
          fontSize: `${Math.round(10 * u)}px`,
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(1, 1);
      this.loadoutIcons.push(img, lv);
      col += 1;
    };
    for (const id of Object.keys(weapons) as WeaponId[]) add(WEAPONS[id].texture, weapons[id]!);
    // Items start on a row of their own.
    if (col > 0) {
      col = perRow;
    }
    for (const id of Object.keys(passives) as PassiveId[]) add(PASSIVES[id].texture, passives[id]!);
    const bottom = startY + (row + 1) * (size + gap);
    this.devPanel?.layout(this.devPanelLeft, bottom + 4 * u, u); // DEV: below the icon rows
  }

  // ---------------------------------------------------------------- Menus

  // ---------------------------------------------------------------- Treasure chest

  private onChest(reward: ChestReward): void {
    this.chestReward = reward;
    this.chestRevealed = 0;
    this.chestStage = 'closed';
    this.showChest();
  }

  /**
   * The chest's reels spin through upgrade icons and stop one after another on what it holds;
   * then the gold appears and "Take" applies everything. Tapping while they spin stops them all.
   */
  private showChest(): void {
    if (!this.chestReward) return;
    // A redraw (e.g. on resize) during the opening skips straight to the reels.
    if (this.chestStage === 'opening') this.chestStage = 'reels';
    if (this.chestStage === 'closed') this.showClosedChest();
    else this.showChestReels();
  }

  /** The closed chest wobbles in the middle of the screen until it is tapped. */
  private showClosedChest(): void {
    this.beginOverlay('chest', 0.72);
    for (const e of this.chestEvents) e.remove();
    this.chestEvents = [];
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const wide = W > H * 1.3;
    const size = Math.min(wide ? 150 * u : 180 * u, H * 0.42, W * 0.6);
    const cy = H * (wide ? 0.48 : 0.45);

    const titleY = Math.max(this.sa.top + (wide ? 72 : 70) * u, H * (wide ? 0.12 : 0.2));
    this.text(W / 2, titleY, 'Treasure Chest!', wide ? 28 : 32, {
      fontStyle: 'bold',
      color: css(COLORS.accent),
      stroke: '#000',
      strokeThickness: 5,
    });

    const glow = this.add
      .image(W / 2, cy, 'light')
      .setDisplaySize(size * 1.6, size * 1.6)
      .setTint(0xfbbf24)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(51);
    const chest = this.add
      .image(W / 2, cy, 'chest-big')
      .setDisplaySize(size, size)
      .setDepth(52);
    const base = chest.scale;
    this.tweens.add({ targets: glow, alpha: 0.6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // Every now and then the chest jiggles, as if something were inside.
    this.tweens.add({
      targets: chest,
      angle: { from: -6, to: 6 },
      duration: 70,
      yoyo: true,
      repeat: 3,
      repeatDelay: 0,
      loopDelay: 900,
      loop: -1,
      onLoop: () => chest.setAngle(0),
    });
    const hint = this.text(
      W / 2,
      Math.min(cy + size * 0.65 + 20 * u, H - this.sa.bottom - 30 * u),
      this.isTouch ? 'Tap to open' : 'Click or press Enter to open',
      16,
      { fontStyle: 'bold', color: '#e4e4e7', stroke: '#000', strokeThickness: 4 },
    );
    this.tweens.add({ targets: hint, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    this.overlay.push(glow, chest);

    const zone = this.add
      .zone(W / 2, H / 2, W, H)
      .setDepth(50.5)
      .setInteractive();
    this.openShownChest = () => this.openChest(chest, glow, hint, base);
    zone.on('pointerup', () => this.openShownChest?.());
    this.overlay.push(zone);
  }

  /** Lid flies open with a flash of light, then the reels screen follows. */
  private openChest(
    chest: Phaser.GameObjects.Image,
    glow: Phaser.GameObjects.Image,
    hint: Phaser.GameObjects.Text,
    base: number,
  ): void {
    if (this.chestStage !== 'closed' || this.overlayKind !== 'chest') return;
    if (this.time.now - this.overlayOpenedAt < 300) return;
    this.chestStage = 'opening';
    this.openShownChest = undefined;
    this.tweens.killTweensOf([chest, glow, hint]);
    hint.setVisible(false);
    chest.setAngle(0);
    // Squash, then pop open.
    this.tweens.add({
      targets: chest,
      scaleX: base * 1.12,
      scaleY: base * 0.86,
      duration: 140,
      ease: 'Quad.out',
      onComplete: () => {
        if (this.chestStage !== 'opening') return;
        chest.setTexture('chest-big-open').setScale(base * 0.92, base * 1.15);
        this.tweens.add({ targets: chest, scaleX: base, scaleY: base, duration: 220, ease: 'Back.out' });
        this.tweens.add({
          targets: glow,
          alpha: 1,
          displayWidth: glow.displayWidth * 1.35,
          displayHeight: glow.displayHeight * 1.35,
          duration: 450,
          ease: 'Quad.out',
        });
        this.burstCoins(chest.x, chest.y - chest.displayHeight * 0.15, chest.displayWidth);
        this.chestEvents.push(
          this.time.delayedCall(750, () => {
            if (this.chestStage !== 'opening' || this.overlayKind !== 'chest') return;
            this.chestStage = 'reels';
            this.overlayOpenedAt = this.time.now;
            this.showChestReels();
          }),
        );
      },
    });
  }

  /** A handful of coins jump out of the opened chest. */
  private burstCoins(x: number, y: number, spread: number): void {
    for (let i = 0; i < 14; i++) {
      const coin = this.add
        .image(x + (Math.random() - 0.5) * spread * 0.4, y, 'coin')
        .setDepth(53)
        .setScale(this.u * (1.6 + Math.random() * 0.8));
      this.overlay.push(coin);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const dist = spread * (0.5 + Math.random() * 0.6);
      this.tweens.add({
        targets: coin,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        angle: (Math.random() - 0.5) * 360,
        duration: 600 + Math.random() * 250,
        ease: 'Quad.out',
      });
    }
  }

  private showChestReels(): void {
    const reward = this.chestReward;
    if (!reward) return;
    this.beginOverlay('chest', 0.72);
    for (const e of this.chestEvents) e.remove();
    this.chestEvents = [];
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const wide = W > H * 1.3;

    const titleY = Math.max(this.sa.top + (wide ? 72 : 70) * u, H * (wide ? 0.12 : 0.2));
    this.text(W / 2, titleY, 'Treasure Chest!', wide ? 28 : 32, {
      fontStyle: 'bold',
      color: css(COLORS.accent),
      stroke: '#000',
      strokeThickness: 5,
    });

    const n = reward.upgrades.length;
    const gap = 10 * u;
    const size = Math.min(
      wide ? 92 * u : 86 * u,
      (W - this.sa.left - this.sa.right - 32 * u - gap * (n - 1)) / Math.max(1, n),
    );
    const rowY = titleY + (wide ? 36 : 70) * u;
    const startX = W / 2 - (n * size + (n - 1) * gap) / 2;
    const reels: {
      icon: Phaser.GameObjects.Image;
      label: Phaser.GameObjects.Text;
      frame: Phaser.GameObjects.Graphics;
      x: number;
    }[] = [];
    reward.upgrades.forEach((option, i) => {
      const x = startX + i * (size + gap);
      const frame = this.add.graphics().setDepth(51);
      frame.fillStyle(COLORS.panel, 0.98).fillRoundedRect(x, rowY, size, size, 12 * u);
      frame.lineStyle(2 * u, COLORS.panelEdge, 1).strokeRoundedRect(x, rowY, size, size, 12 * u);
      const icon = this.add
        .image(x + size / 2, rowY + size / 2, REEL_TEXTURES[i % REEL_TEXTURES.length])
        .setDisplaySize(size * 0.62, size * 0.62)
        .setDepth(52);
      const card = describeUpgrade(option);
      const label = this.text(
        x + size / 2,
        rowY + size + 8 * u,
        `${card.title}\n${card.badge}`,
        n >= 5 && !wide ? 9 : 11,
        {
          fontStyle: 'bold',
          color: '#e4e4e7',
          wordWrap: { width: size + gap },
        },
      )
        .setOrigin(0.5, 0)
        .setVisible(false);
      this.overlay.push(frame, icon);
      reels.push({ icon, label, frame, x });
    });

    const reveal = (i: number) => {
      const reel = reels[i];
      const card = describeUpgrade(reward.upgrades[i]);
      reel.icon.setTexture(card.texture).setDisplaySize(size * 0.62, size * 0.62);
      reel.label.setVisible(true);
      reel.frame
        .lineStyle(3 * u, RARITIES[card.rarity].color, 1)
        .strokeRoundedRect(reel.x, rowY, size, size, 12 * u);
      reel.label.setColor(css(RARITIES[card.rarity].color));
      this.tweens.add({ targets: reel.icon, scale: reel.icon.scale * 1.25, duration: 120, yoyo: true });
    };
    for (let i = 0; i < this.chestRevealed; i++) reveal(i);

    const afterY = rowY + size + (wide ? 44 : 64) * u;
    const finish = () => {
      if (this.overlayKind !== 'chest') return;
      this.chestRevealed = n;
      for (const e of this.chestEvents) e.remove();
      this.chestEvents = [];
      this.text(W / 2, afterY, `+${reward.gold} gold`, 20, {
        fontStyle: 'bold',
        color: '#fde047',
        stroke: '#000',
        strokeThickness: 4,
      });
      const buttonY = Math.min(afterY + 56 * u, H - this.sa.bottom - 34 * u);
      this.button(W / 2, buttonY, this.isTouch ? 'Take' : 'Take (Enter)', () => this.onChestConfirm());
    };

    if (this.chestRevealed >= n) {
      finish();
      return;
    }
    // Spin: every reel not yet stopped flips through random icons.
    this.chestEvents.push(
      this.time.addEvent({
        delay: 70,
        loop: true,
        callback: () => {
          for (let i = this.chestRevealed; i < n; i++) {
            reels[i].icon
              .setTexture(REEL_TEXTURES[Math.floor(Math.random() * REEL_TEXTURES.length)])
              .setDisplaySize(size * 0.62, size * 0.62);
          }
        },
      }),
    );
    for (let i = this.chestRevealed; i < n; i++) {
      const index = i;
      this.chestEvents.push(
        this.time.delayedCall(700 + (i - this.chestRevealed) * 450, () => {
          this.chestRevealed = index + 1;
          reveal(index);
          if (index === n - 1) finish();
        }),
      );
    }
    // Tap while spinning: stop all reels at once.
    const skip = this.add
      .zone(W / 2, H / 2, W, H)
      .setDepth(50.5)
      .setInteractive();
    skip.on('pointerup', () => {
      if (this.chestRevealed >= n) return;
      for (let i = this.chestRevealed; i < n; i++) reveal(i);
      skip.disableInteractive();
      finish();
    });
    this.overlay.push(skip);
  }

  /** Takes the chest once all reels have stopped. */
  private onChestConfirm(): void {
    const reward = this.chestReward;
    if (!reward) return;
    if (this.chestStage === 'closed') {
      this.openShownChest?.();
      return;
    }
    if (this.chestStage !== 'reels' || this.chestRevealed < reward.upgrades.length) return;
    if (this.time.now - this.overlayOpenedAt < 400) return;
    for (const e of this.chestEvents) e.remove();
    this.chestEvents = [];
    this.chestReward = undefined;
    this.clearOverlay();
    this.gs.takeChest(reward);
  }

  private clearOverlay(): void {
    for (const o of this.overlay) o.destroy();
    this.overlay = [];
    this.overlayKind = 'none';
    this.pressedCard = -1;
  }

  private beginOverlay(kind: OverlayKind, dim = 0.65): void {
    const keepTime = this.overlayKind === kind;
    this.clearOverlay();
    this.overlayKind = kind;
    if (!keepTime) this.overlayOpenedAt = this.time.now;
    this.stickPointerId = null;
    const { width: W, height: H } = this.scale;
    const shade = this.add.rectangle(0, 0, W, H, 0x000000, dim).setOrigin(0, 0).setDepth(50).setInteractive();
    this.overlay.push(shade);
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
  ) {
    const t = this.add
      .text(x, y, value, {
        fontFamily: FONT,
        fontSize: `${Math.round(size * this.u)}px`,
        color: '#ffffff',
        align: 'center',
        ...opts,
      })
      .setOrigin(0.5)
      .setDepth(52);
    this.overlay.push(t);
    return t;
  }

  /**
   * A button of an overlay. A press has to start on the button itself, so a finger that is still
   * on the stick and lifts over the button does not trigger it. With `holdMs` the button fires only
   * after being held that long (a fill shows the progress); for buttons that are costly to hit by accident.
   */
  private button(x: number, y: number, label: string, onClick: () => void, primary = true, holdMs = 0): void {
    const u = this.u;
    const w = 210 * u;
    const h = 50 * u;
    const g = this.add.graphics().setDepth(51);
    let hover = false;
    let hold = 0;
    const draw = () => {
      if (!g.active) return;
      g.clear();
      g.fillStyle(primary ? COLORS.accent : COLORS.panel, hover ? 1 : 0.92).fillRoundedRect(
        x - w / 2,
        y - h / 2,
        w,
        h,
        12 * u,
      );
      if (hold > 0) {
        // Hold progress: a lighter bar that fills from the left.
        g.fillStyle(0xffffff, 0.28).fillRoundedRect(x - w / 2, y - h / 2, w * hold, h, 12 * u);
      }
      g.lineStyle(2 * u, primary ? 0xffffff : COLORS.panelEdge, primary ? 0.5 : 1).strokeRoundedRect(
        x - w / 2,
        y - h / 2,
        w,
        h,
        12 * u,
      );
    };
    draw();
    this.text(x, y, label, 17, { fontStyle: 'bold', color: primary ? '#1c1917' : '#ffffff' });
    const zone = this.add.zone(x, y, w, h).setDepth(53).setInteractive({ useHandCursor: true });
    let pressed = false;
    let holdTween: Phaser.Tweens.Tween | undefined;
    const cancelHold = () => {
      pressed = false;
      holdTween?.stop();
      holdTween = undefined;
      hold = 0;
      draw();
    };
    zone.on('pointerover', () => {
      hover = true;
      draw();
    });
    zone.on('pointerout', () => {
      hover = false;
      cancelHold();
    });
    zone.on('pointerdown', () => {
      if (this.time.now - this.overlayOpenedAt <= 250) return;
      pressed = true;
      if (holdMs <= 0) return;
      holdTween = this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: holdMs,
        onUpdate: (tween) => {
          hold = tween.getValue() ?? 0;
          draw();
        },
        onComplete: () => {
          holdTween = undefined;
          pressed = false;
          onClick();
        },
      });
    });
    zone.on('pointerup', () => {
      if (holdMs > 0) {
        cancelHold();
        return;
      }
      if (pressed) onClick();
      pressed = false;
    });
    this.overlay.push(g, zone);
  }

  /** A short hint below the timer when a herb blooms nearby. */
  private onHerbBloom(herb: HerbId): void {
    const def = HERBS[herb];
    this.showHint(`${def.rare ? 'A rare ' : 'A '}${def.name} is blooming nearby`, def.color);
  }

  /** A short hint below the timer when an enemy leaves a treasure chest. */
  private onChestDrop(): void {
    this.showHint('A treasure chest dropped!', LIGHT.chestColor);
  }

  /** The spawn director announces a wave, a ring or a wall a few seconds before it hits. */
  private onSurge(a: Announcement): void {
    this.showHint(a.text, SURGE_COLOR);
  }

  /** Fades a line in below the timer for a moment; a second hint goes below the first. */
  private showHint(message: string, color: number): void {
    const u = this.u;
    const lineH = 18 * u;
    let slot = 0;
    while (this.hintSlots.has(slot)) slot++;
    this.hintSlots.add(slot);
    const hint = this.add
      .text(this.scale.width / 2, this.sa.top + 62 * u + slot * lineH, message, {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * u)}px`,
        fontStyle: 'bold',
        color: css(color),
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(40)
      .setAlpha(0);
    this.tweens.add({
      targets: hint,
      alpha: 1,
      duration: 250,
      yoyo: true,
      hold: 2200,
      onComplete: () => {
        this.hintSlots.delete(slot);
        hint.destroy();
      },
    });
  }

  /** Shows the area name and goal for a moment when a fight starts. */
  private showSegmentBanner(): void {
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const seg = this.gs.run.segment;
    const style = { fontFamily: FONT, color: '#ffffff', stroke: '#000000', align: 'center' as const };
    const title = this.add
      .text(W / 2, H * 0.3, seg.name, {
        ...style,
        fontSize: `${Math.round(26 * u)}px`,
        fontStyle: 'bold',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(40);
    const goal = this.add
      .text(W / 2, H * 0.3 + 34 * u, goalLabel(seg.goal), {
        ...style,
        fontSize: `${Math.round(16 * u)}px`,
        color: css(COLORS.accent),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: [title, goal],
      alpha: 0,
      delay: 2200,
      duration: 600,
      onComplete: () => {
        title.destroy();
        goal.destroy();
      },
    });
  }

  private onLevelUp(options: UpgradeOption[], level: number): void {
    this.levelUpOptions = options;
    this.levelUpLevel = level;
    this.showLevelUp();
  }

  private showLevelUp(): void {
    this.beginOverlay('levelup', 0.6);
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const options = this.levelUpOptions;
    const landscape = W > H * 1.15;

    const titleY = this.sa.top + (landscape ? 46 : 64) * u;
    this.text(W / 2, titleY, `Level ${this.levelUpLevel}!`, 30, {
      fontStyle: 'bold',
      color: css(COLORS.accent),
      stroke: '#000',
      strokeThickness: 5,
    });
    this.text(W / 2, titleY + 32 * u, 'Choose an upgrade', 14, { color: '#d4d4d8' });

    const gap = 12 * u;
    const startY = titleY + 62 * u;
    const availH = H - startY - this.sa.bottom - 16 * u;
    let cardW: number;
    let cardH: number;
    if (landscape) {
      cardW = Math.min(230 * u, (W - this.sa.left - this.sa.right - gap * 4) / 3);
      cardH = Math.min(200 * u, availH);
    } else {
      cardW = Math.min(W - this.sa.left - this.sa.right - 32 * u, 420 * u);
      cardH = Math.min(96 * u, (availH - gap * 2) / 3);
    }

    options.forEach((option, i) => {
      let x: number;
      let y: number;
      if (landscape) {
        const total = cardW * options.length + gap * (options.length - 1);
        x = W / 2 - total / 2 + i * (cardW + gap);
        y = startY;
      } else {
        const block = cardH * options.length + gap * (options.length - 1);
        x = W / 2 - cardW / 2;
        y = startY + Math.max(0, (availH - block) / 3) + i * (cardH + gap);
      }
      this.createCard(option, i, x, y, cardW, cardH, landscape);
    });
  }

  private createCard(
    option: UpgradeOption,
    index: number,
    x: number,
    y: number,
    w: number,
    h: number,
    vertical: boolean,
  ): void {
    const u = this.u;
    const card = describeUpgrade(option);
    const g = this.add.graphics().setDepth(51);
    const rarity = RARITIES[card.rarity];
    const edge = rarity.color;
    // Rarer cards get a thicker frame; legendary ones also a faint glow inside it.
    const width = card.rarity === 'common' ? 2 : card.rarity === 'magic' ? 3 : 4;
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(hover ? 0x2e2642 : COLORS.panel, 0.97).fillRoundedRect(x, y, w, h, 14 * u);
      if (card.rarity !== 'common') {
        g.fillStyle(edge, hover ? 0.2 : 0.12).fillRoundedRect(x, y, w, h, 14 * u);
      }
      g.lineStyle((hover ? width + 1 : width) * u, hover ? 0xffffff : edge, 1).strokeRoundedRect(
        x,
        y,
        w,
        h,
        14 * u,
      );
    };
    // Common cards carry no rarity word; the others name theirs.
    const badge = card.rarity === 'common' ? card.badge : `${rarity.label} · ${card.badge}`;
    draw(false);
    this.overlay.push(g);

    const keyHint = this.isTouch ? '' : `[${index + 1}] `;
    const iconSize = Math.min(48 * u, h - 24 * u);
    if (vertical) {
      const icon = this.add
        .image(x + w / 2, y + 18 * u + iconSize / 2, card.texture)
        .setDisplaySize(iconSize, iconSize)
        .setDepth(52);
      this.overlay.push(icon);
      const ty = y + 26 * u + iconSize;
      this.text(x + w / 2, ty, keyHint + badge, 10, {
        color: css(edge),
        fontStyle: 'bold',
      }).setOrigin(0.5, 0);
      this.text(x + w / 2, ty + 16 * u, card.title, 17, { fontStyle: 'bold' }).setOrigin(0.5, 0);
      this.text(x + w / 2, ty + 42 * u, card.text, 13, {
        color: '#d4d4d8',
        wordWrap: { width: w - 24 * u },
      }).setOrigin(0.5, 0);
    } else {
      const icon = this.add
        .image(x + 14 * u + iconSize / 2, y + h / 2, card.texture)
        .setDisplaySize(iconSize, iconSize)
        .setDepth(52);
      this.overlay.push(icon);
      const tx = x + 28 * u + iconSize;
      const textW = w - (tx - x) - 12 * u;
      this.text(tx, y + 10 * u, keyHint + badge, 10, {
        color: css(edge),
        fontStyle: 'bold',
        align: 'left',
      }).setOrigin(0, 0);
      this.text(tx, y + 24 * u, card.title, 16, { fontStyle: 'bold', align: 'left' }).setOrigin(0, 0);
      this.text(tx, y + 46 * u, card.text, 12, {
        color: '#d4d4d8',
        align: 'left',
        wordWrap: { width: textW },
      }).setOrigin(0, 0);
    }

    const zone = this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setDepth(53)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', () => {
      this.pressedCard = index;
    });
    zone.on('pointerup', () => {
      if (this.pressedCard === index) this.chooseCard(index);
    });
    this.overlay.push(zone);
  }

  private chooseCard(index: number): void {
    // Short lockout so a moving thumb doesn't pick a card by accident.
    if (this.time.now - this.overlayOpenedAt < 350) return;
    const option = this.levelUpOptions[index];
    if (!option) return;
    this.clearOverlay();
    this.gs.chooseUpgrade(option);
  }

  private togglePause(): void {
    if (this.overlayKind === 'pause') {
      this.clearOverlay();
      this.gs.resumeGame();
    } else if (this.overlayKind === 'none' && this.gs.pauseGame()) {
      this.showPause();
    }
  }

  private onHidden(): void {
    if (this.overlayKind === 'none' && this.gs.pauseGame()) this.showPause();
  }

  private showPause(): void {
    this.beginOverlay('pause', 0.6);
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const side = this.settings.skillSide === 'left' ? 'left' : 'right';
    const light = this.settings.lighting ? 'on' : 'off';
    const resume = () => this.togglePause();
    const skills = () => this.toggleSkillSide();
    const lighting = () => this.toggleLighting();
    const giveUp = () => this.gs.giveUp();
    const hint = 'Giving up ends the expedition, like falling.';
    if (W > H * 1.3) {
      // Landscape: game actions on the left, settings on the right.
      const y = Math.max(H * 0.45, this.sa.top + 110 * u);
      this.text(W / 2, y - 70 * u, 'Paused', 30, { fontStyle: 'bold' });
      const lx = W / 2 - 115 * u;
      const rx = W / 2 + 115 * u;
      this.button(lx, y, 'Resume', resume);
      this.button(lx, y + 64 * u, 'Give up', giveUp, false);
      this.button(rx, y, `Skills: ${side} side`, skills, false);
      this.button(rx, y + 64 * u, `Night light: ${light}`, lighting, false);
      this.text(W / 2, y + 106 * u, hint, 12, { color: '#a1a1aa' });
      return;
    }
    const y = Math.max(H * 0.38, this.sa.top + 120 * u);
    this.text(W / 2, y - 76 * u, 'Paused', 34, { fontStyle: 'bold' });
    this.button(W / 2, y, 'Resume', resume);
    this.button(W / 2, y + 64 * u, `Skills: ${side} side`, skills, false);
    this.button(W / 2, y + 128 * u, `Night light: ${light}`, lighting, false);
    this.button(W / 2, y + 192 * u, 'Give up', giveUp, false);
    this.text(W / 2, y + 234 * u, hint, 12, { color: '#a1a1aa' });
  }

  /** Moves the skill buttons to the other screen edge and remembers the choice on this device. */
  /** Night lighting on or off, remembered on this device. */
  private toggleLighting(): void {
    this.settings = { ...this.settings, lighting: !this.settings.lighting };
    writeSettings(safeStorage(), this.settings);
    this.gs.setLighting(this.settings.lighting);
    this.showPause();
  }

  private toggleSkillSide(): void {
    this.settings = { ...this.settings, skillSide: otherSide(this.settings.skillSide) };
    writeSettings(safeStorage(), this.settings);
    this.layout();
    this.showPause();
  }

  private onRunEnd(info: RunEndInfo): void {
    this.runEndInfo = info;
    this.showRunEnd(info);
  }

  /** One line about what the fight means for the expedition. */
  private describeConsequence(info: RunEndInfo): string {
    const r = info.report;
    if (!r) return '';
    if (r.outcome === 'fallen') {
      const lost = r.lootLost ? Object.values(r.lootLost).reduce((a, b) => a + b, 0) : 0;
      return `Expedition lost. You wake up in the village${lost > 0 ? ` and lost ${lost} ${lost === 1 ? 'item' : 'items'}` : ''}.`;
    }
    if (r.litWatchfire) return 'Watchfire lit: the land around it is revealed.';
    if (r.rested) return 'Camp reached: fully healed, waypoint unlocked.';
    return 'Your expedition continues.';
  }

  private showRunEnd(info: RunEndInfo): void {
    this.beginOverlay('runend', 0.7);
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const cleared = info.outcome === 'cleared';
    // Landscape has little height: stats go on one line there.
    const wide = W > H * 1.3;
    // Everything is stacked from the title downwards so nothing overlaps.
    let y = Math.max(this.sa.top + (wide ? 72 : 70) * u, H * (wide ? 0.1 : 0.18));
    this.text(W / 2, y, cleared ? 'Area Cleared' : 'You Fell', wide ? 32 : 38, {
      fontStyle: 'bold',
      color: cleared ? css(COLORS.accent) : '#fb7185',
      stroke: '#000',
      strokeThickness: 6,
    });
    y += (wide ? 36 : 44) * u;
    const subtitle = cleared ? info.segment.name : info.newBestTime ? 'New best time!' : '';
    if (subtitle) {
      this.text(W / 2, y, subtitle, 16, {
        color: cleared ? '#e5e7eb' : css(COLORS.accent),
        fontStyle: 'bold',
      });
      y += 26 * u;
    }
    const consequence = this.describeConsequence(info);
    if (consequence) {
      const t = this.text(W / 2, y, consequence, 14, {
        color: cleared ? '#c4b5fd' : '#fda4af',
        wordWrap: { width: W - 48 * u },
      }).setOrigin(0.5, 0);
      y += t.height + 14 * u;
    } else {
      y += 10 * u;
    }
    // Deeds earned by this fight: permanent bonuses, so they get their own gold line.
    const deeds = info.report?.deeds ?? [];
    if (deeds.length > 0) {
      const t = this.text(W / 2, y - 6 * u, describeEarned(deeds), 14, {
        fontStyle: 'bold',
        color: css(COLORS.accent),
        align: 'center',
        wordWrap: { width: W - 48 * u },
      }).setOrigin(0.5, 0);
      y += t.height + 8 * u;
    }
    const questGold = info.report?.questGold ?? 0;
    if (questGold > 0) {
      const t = this.text(
        W / 2,
        y - 6 * u,
        `Quest complete: Light the Watchfires. Reward: ${questGold} gold`,
        14,
        {
          fontStyle: 'bold',
          color: '#fde047',
          align: 'center',
          wordWrap: { width: W - 48 * u },
        },
      ).setOrigin(0.5, 0);
      y += t.height + 8 * u;
    }
    const stats = [
      info.segment.goal.kind === 'survive'
        ? `Time  ${formatTime(info.time)} / ${formatTime(info.segment.goal.durationSec)}`
        : `Time  ${formatTime(info.time)}`,
      `Level  ${info.level}`,
      `Kills  ${info.kills}`,
      ...(info.herbsTotal > 0 ? [`Herbs  ${info.herbsGathered} / ${info.herbsTotal}`] : []),
      ...(info.gold > 0 ? [`Gold  ${info.gold}`] : []),
    ];
    const block = this.text(W / 2, y, stats.join(wide ? '   ·   ' : '\n'), wide ? 17 : 20, {
      lineSpacing: 10 * u,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    y += block.height + 10 * u;
    const summary = this.text(
      W / 2,
      y,
      `Areas cleared ${info.save.segmentsCleared} · Runs ${info.save.runs}`,
      13,
      {
        color: '#a1a1aa',
      },
    ).setOrigin(0.5, 0);
    y += summary.height;
    const mapLabel = this.isTouch ? 'Back to map' : 'Back to map (Enter)';
    if (!this.gs.canReturnHome()) {
      const buttonY = Math.min(Math.max(y + 50 * u, H * 0.72), H - this.sa.bottom - 34 * u);
      this.button(W / 2, buttonY, mapLabel, () => this.gs.returnToMap());
      return;
    }
    // Won on an expedition: move on, or go home with all the loot.
    const homeLabel = 'Hold to go home';
    const homeHoldMs = 600;
    if (wide) {
      const buttonY = Math.min(Math.max(y + 46 * u, H * 0.72), H - this.sa.bottom - 34 * u);
      this.button(W / 2 - 115 * u, buttonY, mapLabel, () => this.gs.returnToMap());
      this.button(
        W / 2 + 115 * u,
        buttonY,
        homeLabel,
        () => this.gs.returnHomeFromFight(),
        false,
        homeHoldMs,
      );
    } else {
      const gap = 62 * u;
      const buttonY = Math.min(Math.max(y + 50 * u, H * 0.68), H - this.sa.bottom - 34 * u - gap);
      this.button(W / 2, buttonY, mapLabel, () => this.gs.returnToMap());
      this.button(W / 2, buttonY + gap, homeLabel, () => this.gs.returnHomeFromFight(), false, homeHoldMs);
    }
  }
}
