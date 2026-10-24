import * as Phaser from 'phaser';
import { PASSIVES } from '../config/passives';
import { SKILLS } from '../config/skills';
import type { PassiveId, SkillId, WeaponId } from '../config/types';
import { WEAPONS } from '../config/weapons';
import type { InputState } from '../input/InputState';
import { formatTime, xpToNext } from '../logic/progression';
import { loadSave, safeStorage } from '../logic/save';
import { describeUpgrade, type UpgradeOption } from '../logic/upgrades';
import { safeArea, viewportSize, type SafeArea } from '../ui/display';
import { COLORS, css, FONT } from '../ui/theme';
import type { GameOverInfo, GameScene } from './GameScene';

type OverlayKind = 'none' | 'start' | 'levelup' | 'pause' | 'gameover';

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
  private levelText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private pauseBtn!: Phaser.GameObjects.Text;
  private skillButtons: SkillButton[] = [];
  private loadoutIcons: Phaser.GameObjects.GameObject[] = [];
  private loadoutSignature = '';

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private isTouch = false;

  private stickPointerId: number | null = null;
  private stickOrigin = new Phaser.Math.Vector2();
  private stickPos = new Phaser.Math.Vector2();

  private overlay: Phaser.GameObjects.GameObject[] = [];
  private overlayKind: OverlayKind = 'none';
  private overlayOpenedAt = 0;
  private levelUpOptions: UpgradeOption[] = [];
  private levelUpLevel = 1;
  private gameOverInfo?: GameOverInfo;
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
    this.skillButtons = [];
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
    this.levelText = this.add.text(0, 0, 'Stufe 1', textStyle(14));
    this.hpText = this.add.text(0, 0, '', textStyle(10)).setOrigin(0.5, 0.5).setDepth(1);
    this.killsText = this.add.text(0, 0, '', textStyle(14)).setOrigin(1, 0);
    this.pauseBtn = this.add
      .text(0, 0, 'II', { ...textStyle(18), backgroundColor: '#00000066', padding: { x: 12, y: 6 } })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => this.togglePause());

    this.createSkillButton('dash', this.isTouch ? 'Sprung' : 'Sprung · Leertaste');
    this.createSkillButton('nova', this.isTouch ? 'Frost' : 'Frost · E');

    this.setupKeyboard();
    this.setupJoystick();

    this.layout();
    this.scale.on('resize', this.onResize, this);
    this.gs.events.on('levelup', this.onLevelUp, this);
    this.gs.events.on('gameover', this.onGameOver, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.gs.events.off('levelup', this.onLevelUp, this);
      this.gs.events.off('gameover', this.onGameOver, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    });

    if (!this.gs.run.started) this.showStart();
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
    kb.on('keydown-ONE', () => this.pickCardByKey(0));
    kb.on('keydown-TWO', () => this.pickCardByKey(1));
    kb.on('keydown-THREE', () => this.pickCardByKey(2));
  }

  private onConfirmKey(action: 'dash' | null): void {
    if (this.overlayKind === 'none') {
      if (action) this.controls.press(action);
    } else if (this.overlayKind === 'start') this.startRun();
    else if (this.overlayKind === 'pause') this.togglePause();
    else if (this.overlayKind === 'gameover' && this.time.now - this.overlayOpenedAt > 600)
      this.gs.restartRun();
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
    if (kind === 'start') this.showStart();
    else if (kind === 'levelup') this.showLevelUp();
    else if (kind === 'pause') this.showPause();
    else if (kind === 'gameover' && this.gameOverInfo) this.showGameOver(this.gameOverInfo);
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
    this.levelText.setFontSize(Math.round(14 * u)).setPosition(left, top + 24 * u);
    this.hpText.setFontSize(Math.round(10 * u)).setPosition(left + 75 * u, top + 12 * u);
    this.pauseBtn
      .setFontSize(Math.round(16 * u))
      .setPadding(Math.round(12 * u), Math.round(6 * u))
      .setPosition(right, top);
    this.killsText
      .setFontSize(Math.round(14 * u))
      .setPosition(right - this.pauseBtn.width - 10 * u, top + 6 * u);

    const bottom = H - this.sa.bottom - m;
    const dash = this.skillButtons[0];
    const nova = this.skillButtons[1];
    dash.r = 38 * u;
    dash.x = right - dash.r - 4 * u;
    dash.y = bottom - dash.r - 18 * u;
    nova.r = 32 * u;
    nova.x = dash.x - dash.r - nova.r - 22 * u;
    nova.y = dash.y + 6 * u;
    for (const b of this.skillButtons) {
      b.icon.setPosition(b.x, b.y).setDisplaySize(b.r * 2, b.r * 2);
      b.label.setFontSize(Math.round(11 * u)).setPosition(b.x, b.y + b.r + 4 * u);
      b.cd.setFontSize(Math.round(18 * u)).setPosition(b.x, b.y);
    }
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
    this.levelText.setText(`Stufe ${run.level}`);
    this.timerText.setText(formatTime(run.time));
    this.killsText.setText(`☠ ${run.kills}`);

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

  private showStart(): void {
    this.beginOverlay('start', 0.55);
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const save = loadSave(safeStorage());
    this.text(W / 2, H * 0.24, 'NACHTWACHE', 40, {
      fontStyle: 'bold',
      color: css(COLORS.accent),
      stroke: '#000',
      strokeThickness: 6,
    });
    this.text(W / 2, H * 0.24 + 40 * u, 'Survivor-RPG · Prototyp', 15, { color: '#c4b5fd' });

    const help = this.isTouch
      ? 'Linker Daumen: irgendwo hinziehen zum Laufen\nRechts: Sprung und Frostnova\nAngriffe passieren automatisch'
      : 'WASD / Pfeiltasten: laufen\nLeertaste oder Q: Sprung · E: Frostnova\nAngriffe passieren automatisch · P: Pause';
    this.text(W / 2, H * 0.5, help, 15, { lineSpacing: 6 * u, color: '#e5e7eb' });

    if (save.runs > 0) {
      this.text(
        W / 2,
        H * 0.5 + 62 * u,
        `Bestzeit ${formatTime(save.bestTime)} · ${save.bestKills} Kills · Stufe ${save.bestLevel}`,
        13,
        {
          color: '#a1a1aa',
        },
      );
    }
    this.button(W / 2, H * 0.74, 'Spielen', () => this.startRun());
  }

  private startRun(): void {
    this.clearOverlay();
    this.gs.startRun();
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
    this.text(W / 2, titleY, `Stufe ${this.levelUpLevel}!`, 30, {
      fontStyle: 'bold',
      color: css(COLORS.accent),
      stroke: '#000',
      strokeThickness: 5,
    });
    this.text(W / 2, titleY + 32 * u, 'Wähle eine Verbesserung', 14, { color: '#d4d4d8' });

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

  private pickCardByKey(index: number): void {
    if (this.overlayKind === 'levelup') this.chooseCard(index);
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
    this.text(W / 2, H * 0.3, 'Pausiert', 34, { fontStyle: 'bold' });
    this.button(W / 2, H * 0.5, 'Weiter', () => this.togglePause());
    this.button(W / 2, H * 0.5 + 64 * u, 'Neu starten', () => this.gs.restartRun(), false);
  }

  private onGameOver(info: GameOverInfo): void {
    this.gameOverInfo = info;
    this.showGameOver(info);
  }

  private showGameOver(info: GameOverInfo): void {
    this.beginOverlay('gameover', 0.7);
    const { width: W, height: H } = this.scale;
    const u = this.u;
    this.text(W / 2, H * 0.22, 'Gefallen', 38, {
      fontStyle: 'bold',
      color: '#fb7185',
      stroke: '#000',
      strokeThickness: 6,
    });
    if (info.newBestTime)
      this.text(W / 2, H * 0.22 + 40 * u, 'Neue Bestzeit!', 16, {
        color: css(COLORS.accent),
        fontStyle: 'bold',
      });
    const lines = [
      `Überlebt  ${formatTime(info.time)}`,
      `Stufe  ${info.level}`,
      `Besiegt  ${info.kills}`,
    ].join('\n');
    this.text(W / 2, H * 0.44, lines, 20, { lineSpacing: 10 * u, fontStyle: 'bold' });
    this.text(
      W / 2,
      H * 0.44 + 70 * u,
      `Bestzeit ${formatTime(info.save.bestTime)} · Runs ${info.save.runs}`,
      13,
      { color: '#a1a1aa' },
    );
    this.button(W / 2, H * 0.72, this.isTouch ? 'Nochmal' : 'Nochmal (Enter)', () => this.gs.restartRun());
  }
}
