import * as Phaser from 'phaser';
import { VILLAGERS } from '../config/quests';
import { STATIONS, VILLAGE, type StationId } from '../config/village';
import type { InputState } from '../input/InputState';
import { embersOf, embersText } from '../logic/merchant';
import { questsOnArrival } from '../logic/quests';
import { loadSave, safeStorage, writeSave, type SaveData } from '../logic/save';
import { readStick } from '../logic/stick';
import {
  describeArrival,
  hasNews,
  openVillagePanel,
  type Arrival,
  type VillagePanel,
} from '../panels/villagePanels';
import { safeArea, viewportSize, type SafeArea } from '../ui/display';
import { COLORS, css, FONT } from '../ui/theme';
import type { VillageScene, WalkTarget } from './VillageScene';

interface HudData {
  arrival?: Arrival;
}

/**
 * On top of the walkable village: the shortcut bar (tap a place and the watchman walks there), the button
 * for the place you stand at, the touch stick, the note about what came home, and the village panels.
 * Runs unzoomed, so the panels look as in the menu village.
 */
export class VillageHudScene extends Phaser.Scene {
  private world!: VillageScene;
  private controls!: InputState;
  private save!: SaveData;
  private arrival: Arrival | undefined;
  private arrivalUntil = 0;
  private u = 1;
  private sa: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  private objects: Phaser.GameObjects.GameObject[] = [];
  private panel: VillagePanel | null = null;
  private openId: StationId | null = null;
  private here: StationId | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key> | null = null;
  private stickPointerId: number | null = null;
  private stickOrigin = new Phaser.Math.Vector2();
  private stickPos = new Phaser.Math.Vector2();
  private stickGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('VillageHud');
  }

  init(data: HudData): void {
    this.arrival = data?.arrival;
  }

  create(): void {
    this.world = this.scene.get('Village') as VillageScene;
    this.controls = this.world.controls;
    this.save = loadSave(safeStorage());
    // Coming home (also after falling) is when the elder first has something to say.
    if (this.arrival) {
      const quests = questsOnArrival(this.save.quests);
      if (quests !== this.save.quests) {
        this.save = { ...this.save, quests };
        writeSave(safeStorage(), this.save);
      }
      this.arrivalUntil = this.time.now + VILLAGE.arrivalNoteSec * 1000;
      this.time.delayedCall(VILLAGE.arrivalNoteSec * 1000, () => this.build());
    }
    this.objects = [];
    this.panel = null;
    this.openId = null;
    this.here = this.world.stationHere();
    this.stickPointerId = null;
    this.stickGfx = this.add.graphics().setDepth(20);

    const onStation = (id: StationId | null) => {
      this.here = id;
      this.build();
    };
    const onArrived = (id: StationId) => this.open(id);
    this.world.events.on('station', onStation);
    this.world.events.on('arrived', onArrived);

    this.setupInput();
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.build, this);
      this.world.events.off('station', onStation);
      this.world.events.off('arrived', onArrived);
      this.panel?.destroy();
      this.panel = null;
      this.controls.setMove(0, 0);
    });
  }

  // ---------------------------------------------------------------- panels

  private open(id: StationId): void {
    if (id === 'house') {
      this.world.enterHouse();
      return;
    }
    this.openId = id;
    this.world.setFrozen(true);
    this.stickPointerId = null;
    this.build();
  }

  private close(): void {
    this.openId = null;
    this.world.setFrozen(false);
    this.build();
  }

  private commit(save: SaveData): void {
    this.save = save;
    writeSave(safeStorage(), save);
    this.build();
  }

  // ---------------------------------------------------------------- input

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
      const use = () => {
        if (this.openId === null && this.here) this.open(this.here);
      };
      kb.on('keydown-E', use);
      kb.on('keydown-SPACE', use);
      kb.on('keydown-ENTER', use);
      kb.on('keydown-ESC', () => this.openId !== null && this.close());
    }
    // The touch stick: anywhere on the village that is not a button.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || this.openId !== null || this.stickPointerId !== null) return;
      this.stickPointerId = p.id;
      this.stickOrigin.set(p.x, p.y);
      this.stickPos.set(p.x, p.y);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id === this.stickPointerId) this.stickPos.set(p.x, p.y);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id === this.stickPointerId) this.stickPointerId = null;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  private stickRadius(): number {
    return 56 * this.u;
  }

  override update(): void {
    const g = this.stickGfx;
    g.clear();
    if (this.openId !== null) {
      this.controls.setMove(0, 0);
      return;
    }
    if (this.stickPointerId !== null) {
      const r = this.stickRadius();
      const s = readStick(this.stickOrigin.x, this.stickOrigin.y, this.stickPos.x, this.stickPos.y, r);
      this.stickOrigin.set(s.originX, s.originY);
      this.controls.setMove(s.x, s.y);
      g.fillStyle(0xffffff, 0.08).fillCircle(s.originX, s.originY, r);
      g.lineStyle(2 * this.u, 0xffffff, 0.3).strokeCircle(s.originX, s.originY, r);
      g.fillStyle(0xffffff, 0.35).fillCircle(s.originX + s.x * r, s.originY + s.y * r, 22 * this.u);
      return;
    }
    const k = this.keys;
    if (!k) {
      this.controls.setMove(0, 0);
      return;
    }
    const x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    this.controls.setMove(x, y);
  }

  // ---------------------------------------------------------------- layout

  private build(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    const { width: W, height: H } = this.scale;
    this.cameras.main.setSize(W, H);
    const cssSize = viewportSize();
    const rs = W / cssSize.width;
    this.u = rs * Phaser.Math.Clamp(Math.min(cssSize.width, cssSize.height) / 400, 0.85, 1.25);
    const sa = safeArea();
    this.sa = { top: sa.top * rs, right: sa.right * rs, bottom: sa.bottom * rs, left: sa.left * rs };
    const u = this.u;
    const left = this.sa.left + 14 * u;
    const right = W - this.sa.right - 14 * u;

    this.panel?.destroy();
    this.panel = null;
    if (this.openId !== null && this.openId !== 'house') {
      this.panel = openVillagePanel(this, { width: W, height: H, u, sa: this.sa }, this.openId, {
        save: this.save,
        commit: (save) => this.commit(save),
        close: () => this.close(),
      });
      return;
    }

    // Header: where you are and your embers, on a soft dark band so it reads over the village.
    const top = this.sa.top + 12 * u;
    const band = this.track(this.add.graphics());
    band.fillStyle(0x0b0a10, 0.55).fillRect(0, 0, W, top + 50 * u);
    this.text(left, top, 'VILLAGE', 22, { fontStyle: 'bold', color: css(COLORS.accent) });
    this.text(left, top + 28 * u, embersText(embersOf(this.save.stash)), 12, {
      color: '#fdba74',
      fontStyle: 'bold',
    });

    // What came home, for a few seconds
    const noteTop = top + 50 * u;
    if (this.arrival && this.time.now < this.arrivalUntil) {
      const news = hasNews(this.save, 'elder') ? ` ${VILLAGERS.elder.name} wants to speak with you.` : '';
      const t = this.text(left + 10 * u, noteTop + 10 * u, describeArrival(this.arrival) + news, 13, {
        color: this.arrival.reason === 'fallen' ? '#fda4af' : '#bbf7d0',
        wordWrap: { width: right - left - 20 * u },
      });
      const g = this.track(this.add.graphics());
      g.fillStyle(COLORS.panel, 0.9).fillRoundedRect(left, noteTop, right - left, t.height + 20 * u, 10 * u);
      t.setDepth(1);
    }

    // Shortcut bar at the bottom: every place, and the way out
    const items: { id: WalkTarget; label: string; news: boolean }[] = [
      ...STATIONS.map((s) => ({
        id: s.id as WalkTarget,
        label: s.short,
        news: s.id === 'elder' && hasNews(this.save, 'elder'),
      })),
      { id: 'gate', label: 'Set out', news: false },
    ];
    const wide = W > H * 1.3;
    const perRow = wide ? items.length : 4;
    const rows = Math.ceil(items.length / perRow);
    const gap = 6 * u;
    const chipH = 38 * u;
    const barW = Math.min(right - left, wide ? 900 * u : 520 * u);
    const barX = (W - barW) / 2;
    const chipW = (barW - gap * (perRow - 1)) / perRow;
    const barTop = H - this.sa.bottom - 12 * u - rows * chipH - (rows - 1) * gap;
    const walking = this.world.walkingTo();
    items.forEach((item, i) => {
      const cx = barX + (i % perRow) * (chipW + gap);
      const cy = barTop + Math.floor(i / perRow) * (chipH + gap);
      const primary = item.id === 'gate';
      const active = walking === item.id || (item.id !== 'gate' && this.here === item.id);
      const g = this.track(this.add.graphics());
      g.fillStyle(primary ? COLORS.accent : COLORS.panel, primary ? 0.95 : 0.88).fillRoundedRect(
        cx,
        cy,
        chipW,
        chipH,
        9 * u,
      );
      g.lineStyle(
        1.5 * u,
        active ? 0xffffff : primary ? COLORS.accent : COLORS.panelEdge,
        active ? 0.9 : 0.8,
      );
      g.strokeRoundedRect(cx, cy, chipW, chipH, 9 * u);
      this.text(cx + chipW / 2, cy + chipH / 2, item.label, 13, {
        fontStyle: 'bold',
        color: primary ? '#1c1917' : '#ffffff',
      }).setOrigin(0.5);
      if (item.news) {
        g.fillStyle(COLORS.accent, 1).fillCircle(cx + chipW - 8 * u, cy + 8 * u, 7 * u);
        this.text(cx + chipW - 8 * u, cy + 8 * u, '!', 11, { fontStyle: 'bold', color: '#1c1917' }).setOrigin(
          0.5,
        );
      }
      this.tapZone(cx, cy, chipW, chipH, () => {
        this.world.walkTo(item.id);
        this.build();
      });
    });

    // The place you stand at: one big button to use it
    if (this.here) {
      const def = STATIONS.find((s) => s.id === this.here)!;
      const bw = Math.min(260 * u, right - left);
      const bh = 50 * u;
      const by = barTop - 14 * u - bh;
      const bx = W / 2 - bw / 2;
      const g = this.track(this.add.graphics());
      g.fillStyle(COLORS.accent, 0.96).fillRoundedRect(bx, by, bw, bh, 12 * u);
      this.text(W / 2, by + bh / 2, def.action, 17, { fontStyle: 'bold', color: '#1c1917' }).setOrigin(0.5);
      this.tapZone(bx, by, bw, bh, () => this.open(def.id));
    }
  }

  // ---------------------------------------------------------------- helpers

  private tapZone(x: number, y: number, w: number, h: number, onTap: () => void): void {
    const zone = this.track(
      this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true }),
    );
    zone.on('pointerup', onTap);
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objects.push(o);
    return o;
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    opts: Phaser.Types.GameObjects.Text.TextStyle = {},
  ) {
    return this.track(
      this.add.text(x, y, value, {
        fontFamily: FONT,
        fontSize: `${Math.round(size * this.u)}px`,
        color: '#ffffff',
        ...opts,
      }),
    );
  }
}
