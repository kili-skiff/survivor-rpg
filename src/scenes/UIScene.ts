import * as Phaser from 'phaser';
import { PASSIVES } from '../config/passives';
import { HERBS } from '../config/herbs';
import { POTION_IDS, POTIONS } from '../config/potions';
import { SKILLS } from '../config/skills';
import type { HerbId, PassiveId, PotionId, SkillId, WeaponId } from '../config/types';
import { WEAPONS } from '../config/weapons';
import type { InputState } from '../input/InputState';
import { formatTime, xpToNext } from '../logic/progression';
import { safeStorage } from '../logic/save';
import { isSegmentWarning, segmentRemaining } from '../logic/segment';
import { loadSettings, otherSide, writeSettings, type Settings } from '../logic/settings';
import { describeUpgrade, type UpgradeOption } from '../logic/upgrades';
import { safeArea, viewportSize, type SafeArea } from '../ui/display';
import { COLORS, css, FONT } from '../ui/theme';
import type { GameScene, RunEndInfo } from './GameScene';

interface PotionButton {
  id: PotionId;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
  x: number;
  y: number;
  r: number;
}

type OverlayKind = 'none' | 'levelup' | 'pause' | 'runend';

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
  private segmentText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private herbText!: Phaser.GameObjects.Text;
  private pauseBtn!: Phaser.GameObjects.Text;
  private skillButtons: SkillButton[] = [];
  private potionButtons: PotionButton[] = [];
  private loadoutIcons: Phaser.GameObjects.GameObject[] = [];
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
    this.segmentText = this.add.text(0, 0, '', textStyle(11, false)).setOrigin(0.5, 0);
    this.levelText = this.add.text(0, 0, 'Level 1', textStyle(14));
    this.hpText = this.add.text(0, 0, '', textStyle(10)).setOrigin(0.5, 0.5).setDepth(1);
    this.killsText = this.add.text(0, 0, '', textStyle(14)).setOrigin(1, 0);
    this.herbText = this.add.text(0, 0, '', { ...textStyle(13), color: '#bbf7d0' }).setOrigin(1, 0);
    this.pauseBtn = this.add
      .text(0, 0, 'II', { ...textStyle(18), backgroundColor: '#00000066', padding: { x: 12, y: 6 } })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => this.togglePause());

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
    this.gs.events.on('runend', this.onRunEnd, this);
    this.gs.events.on('herbbloom', this.onHerbBloom, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.gs.events.off('levelup', this.onLevelUp, this);
      this.gs.events.off('runend', this.onRunEnd, this);
      this.gs.events.off('herbbloom', this.onHerbBloom, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    });

    this.showSegmentBanner();
  }

  override update(): void {
    this.updateMovement();
    this.drawHud();
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

    this.timerText.setFontSize(Math.round(22 * u)).setPosition(W / 2, top + 4 * u);
    this.segmentText.setFontSize(Math.round(11 * u)).setPosition(W / 2, top + 32 * u);
    this.levelText.setFontSize(Math.round(14 * u)).setPosition(left, top + 24 * u);
    this.hpText.setFontSize(Math.round(10 * u)).setPosition(left + 75 * u, top + 12 * u);
    this.pauseBtn
      .setFontSize(Math.round(16 * u))
      .setPadding(Math.round(12 * u), Math.round(6 * u))
      .setPosition(right, top);
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
    // The timer counts down to the end of the segment.
    this.timerText
      .setText(formatTime(Math.ceil(segmentRemaining(run.segment, run.time))))
      .setColor(isSegmentWarning(run.segment, run.time) ? css(COLORS.accent) : '#ffffff');
    this.segmentText.setText(run.segment.name);
    this.killsText.setText(`☠ ${run.kills}`);
    this.herbText
      .setText(run.herbsTotal > 0 ? 'Herbs' : '')
      .setPosition(this.killsText.x, this.killsText.y + this.killsText.height + 4 * u);
    this.drawHerbSlots(g);

    this.drawHerbArrows(g);

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

  /** Arrows at the screen edge pointing to nearby herbs that are off screen. */
  private drawHerbArrows(g: Phaser.GameObjects.Graphics): void {
    if (this.overlayKind !== 'none') return;
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const cx = W / 2;
    const cy = H / 2;
    const left = this.sa.left + 26 * u;
    const right = W - this.sa.right - 26 * u;
    const top = this.sa.top + 110 * u;
    const bottom = H - this.sa.bottom - 30 * u;
    for (const ind of this.gs.herbIndicators()) {
      const dx = Math.cos(ind.angle);
      const dy = Math.sin(ind.angle);
      // Walk along the direction until the inset screen rectangle is hit.
      const tx = dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity;
      const ty = dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity;
      const t = Math.min(tx, ty);
      const x = cx + dx * t;
      const y = cy + dy * t;
      // Fresh blooms pulse and are a bit bigger so they catch the eye.
      const pulse =
        ind.freshness > 0 ? 1 + 0.35 * ind.freshness * (0.5 + 0.5 * Math.sin(this.time.now / 90)) : 1;
      const size = (ind.rare ? 13 : 10) * u * pulse;
      const alpha = ind.freshness > 0 ? 1 : Phaser.Math.Clamp(1.1 - ind.distance / 500, 0.45, 1);
      // A long, slim arrow so the direction is unambiguous.
      const tip = { x: x + dx * size * 1.2, y: y + dy * size * 1.2 };
      const back = { x: x - dx * size * 0.7, y: y - dy * size * 0.7 };
      const side = { x: -dy * size * 0.6, y: dx * size * 0.6 };
      g.fillStyle(0x000000, 0.5 * alpha).fillCircle(x, y, size * 1.15);
      g.fillStyle(ind.color, alpha).fillTriangle(
        tip.x,
        tip.y,
        back.x + side.x,
        back.y + side.y,
        back.x - side.x,
        back.y - side.y,
      );
    }
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
    let x = this.sa.left + 12 * u;
    const y = this.sa.top + 10 * u + 46 * u;
    const add = (texture: string, level: number) => {
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
      x += size + gap;
    };
    for (const id of Object.keys(weapons) as WeaponId[]) add(WEAPONS[id].texture, weapons[id]!);
    x += gap * 2;
    for (const id of Object.keys(passives) as PassiveId[]) add(PASSIVES[id].texture, passives[id]!);
  }

  // ---------------------------------------------------------------- Menus

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

  private button(x: number, y: number, label: string, onClick: () => void, primary = true): void {
    const u = this.u;
    const w = 210 * u;
    const h = 50 * u;
    const g = this.add.graphics().setDepth(51);
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(primary ? COLORS.accent : COLORS.panel, hover ? 1 : 0.92).fillRoundedRect(
        x - w / 2,
        y - h / 2,
        w,
        h,
        12 * u,
      );
      g.lineStyle(2 * u, primary ? 0xffffff : COLORS.panelEdge, primary ? 0.5 : 1).strokeRoundedRect(
        x - w / 2,
        y - h / 2,
        w,
        h,
        12 * u,
      );
    };
    draw(false);
    this.text(x, y, label, 17, { fontStyle: 'bold', color: primary ? '#1c1917' : '#ffffff' });
    const zone = this.add.zone(x, y, w, h).setDepth(53).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerup', () => {
      if (this.time.now - this.overlayOpenedAt > 250) onClick();
    });
    this.overlay.push(g, zone);
  }

  /** A short hint below the timer when a herb blooms nearby. */
  private onHerbBloom(herb: HerbId): void {
    const def = HERBS[herb];
    const u = this.u;
    const hint = this.add
      .text(
        this.scale.width / 2,
        this.sa.top + 62 * u,
        `${def.rare ? 'A rare ' : 'A '}${def.name} is blooming nearby`,
        {
          fontFamily: FONT,
          fontSize: `${Math.round(13 * u)}px`,
          fontStyle: 'bold',
          color: css(def.color),
          stroke: '#000000',
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5, 0)
      .setDepth(40)
      .setAlpha(0);
    this.tweens.add({
      targets: hint,
      alpha: 1,
      duration: 250,
      yoyo: true,
      hold: 2200,
      onComplete: () => hint.destroy(),
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
      .text(W / 2, H * 0.3 + 34 * u, `Survive ${formatTime(seg.durationSec)}`, {
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
    const edge = card.isNew ? COLORS.accent : COLORS.panelEdge;
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(hover ? 0x2e2642 : COLORS.panel, 0.97).fillRoundedRect(x, y, w, h, 14 * u);
      g.lineStyle((hover ? 3 : 2) * u, hover ? 0xffffff : edge, 1).strokeRoundedRect(x, y, w, h, 14 * u);
    };
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
      this.text(x + w / 2, ty, keyHint + card.badge, 10, {
        color: css(edge === COLORS.accent ? COLORS.accent : 0xa78bfa),
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
      this.text(tx, y + 10 * u, keyHint + card.badge, 10, {
        color: css(edge === COLORS.accent ? COLORS.accent : 0xa78bfa),
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
    const y = Math.max(H * 0.42, this.sa.top + 120 * u);
    this.text(W / 2, y - 76 * u, 'Paused', 34, { fontStyle: 'bold' });
    this.button(W / 2, y, 'Resume', () => this.togglePause());
    const side = this.settings.skillSide === 'left' ? 'left' : 'right';
    this.button(W / 2, y + 64 * u, `Skills: ${side} side`, () => this.toggleSkillSide(), false);
    this.button(W / 2, y + 128 * u, 'Give up', () => this.gs.giveUp(), false);
    this.text(W / 2, y + 170 * u, 'Giving up ends the expedition, like falling.', 12, {
      color: '#a1a1aa',
    });
  }

  /** Moves the skill buttons to the other screen edge and remembers the choice on this device. */
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
    let y = Math.max(this.sa.top + (wide ? 44 : 70) * u, H * (wide ? 0.1 : 0.18));
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
    const stats = [
      `Time  ${formatTime(info.time)} / ${formatTime(info.segment.durationSec)}`,
      `Level  ${info.level}`,
      `Kills  ${info.kills}`,
      ...(info.herbsTotal > 0 ? [`Herbs  ${info.herbsGathered} / ${info.herbsTotal}`] : []),
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
    const buttonY = Math.min(Math.max(y + 50 * u, H * 0.72), H - this.sa.bottom - 34 * u);
    this.button(W / 2, buttonY, this.isTouch ? 'Back to map' : 'Back to map (Enter)', () =>
      this.gs.returnToMap(),
    );
  }
}
