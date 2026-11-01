import * as Phaser from 'phaser';
import { VILLAGERS } from '../config/quests';
import { GATE_ENTRY, STATIONS, VILLAGE, type StationId } from '../config/village';
import type { InputState } from '../input/InputState';
import { embersOf, embersText } from '../logic/merchant';
import { questsOnArrival } from '../logic/quests';
import { loadSave, safeStorage, writeSave, type SaveData } from '../logic/save';
import { loadSettings, writeSettings } from '../logic/settings';
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
 * On top of the walkable village: the menu of places at the top right (tap one and the watchman walks there), the button
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
  /** The menu with all places is unfolded */
  private menuOpen = false;
  private here: StationId | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key> | null = null;
  private stickPointerId: number | null = null;
  private stickOrigin = new Phaser.Math.Vector2();
  private stickPos = new Phaser.Math.Vector2();
  private stickGfx!: Phaser.GameObjects.Graphics;
  /** The arrow at the screen edge towards a place with news that is out of view */
  private arrowGfx!: Phaser.GameObjects.Graphics;
  private arrowMark!: Phaser.GameObjects.Text;
  private arrowZone!: Phaser.GameObjects.Zone;
  /** The hint on the menu of places was seen once */
  private tipSeen = true;

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
    this.menuOpen = false;
    this.here = this.world.stationHere();
    this.stickPointerId = null;
    this.stickGfx = this.add.graphics().setDepth(20);
    this.tipSeen = loadSettings(safeStorage()).villageTipSeen;
    this.arrowGfx = this.add.graphics().setDepth(5);
    this.arrowMark = this.add
      .text(0, 0, '!', { fontFamily: FONT, fontStyle: 'bold', color: '#1c1917' })
      .setOrigin(0.5)
      .setDepth(5)
      .setVisible(false);
    this.arrowZone = this.add.zone(0, 0, 1, 1).setInteractive({ useHandCursor: true }).setDepth(5);
    this.arrowZone.on('pointerup', () => {
      this.world.walkTo('elder');
      this.build();
    });

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
    this.menuOpen = false;
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
      kb.on('keydown-ESC', () => {
        if (this.openId !== null) this.close();
        else if (this.menuOpen) {
          this.menuOpen = false;
          this.build();
        }
      });
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
    this.updateArrow();
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

  /** When the elder has news and stands out of view, an arrow at the screen edge points his way. */
  private updateArrow(): void {
    const g = this.arrowGfx;
    g.clear();
    const sign = this.world.signOf('elder');
    const cam = this.world.cameras.main;
    const show = !!sign && hasNews(this.save, 'elder') && this.openId === null && !this.menuOpen;
    const view = cam.worldView;
    const margin = 10;
    const inView =
      !!sign &&
      sign.x > view.x + margin &&
      sign.x < view.right - margin &&
      sign.y > view.y + margin &&
      sign.y < view.bottom - margin;
    if (!show || inView) {
      this.arrowMark.setVisible(false);
      this.arrowZone.setPosition(-100, -100);
      return;
    }
    const u = this.u;
    const { width: W, height: H } = this.scale;
    const sx = (sign!.x - view.x) * cam.zoom;
    const sy = (sign!.y - view.y) * cam.zoom;
    const cx = W / 2;
    const cy = H / 2;
    const dx = sx - cx;
    const dy = sy - cy;
    // Onto the edge of a rectangle inside the screen (below the header)
    const inset = 34 * u;
    const top = this.sa.top + 80 * u;
    const halfW = W / 2 - inset - this.sa.left;
    const halfUp = cy - top;
    const halfDown = H / 2 - inset - this.sa.bottom;
    const k = Math.min(
      Math.abs(dx) > 0 ? halfW / Math.abs(dx) : Infinity,
      dy < 0 ? halfUp / -dy : dy > 0 ? halfDown / dy : Infinity,
    );
    const ax = cx + dx * k;
    const ay = cy + dy * k;
    const angle = Math.atan2(dy, dx);
    const r = 16 * u;
    g.fillStyle(COLORS.accent, 0.95).fillCircle(ax, ay, r);
    const tip = r + 9 * u;
    const side = 8 * u;
    g.fillTriangle(
      ax + Math.cos(angle) * tip,
      ay + Math.sin(angle) * tip,
      ax + Math.cos(angle) * r + Math.cos(angle + Math.PI / 2) * side,
      ay + Math.sin(angle) * r + Math.sin(angle + Math.PI / 2) * side,
      ax + Math.cos(angle) * r + Math.cos(angle - Math.PI / 2) * side,
      ay + Math.sin(angle) * r + Math.sin(angle - Math.PI / 2) * side,
    );
    this.arrowMark
      .setFontSize(Math.round(16 * u))
      .setPosition(ax, ay)
      .setVisible(true);
    this.arrowZone.setPosition(ax, ay).setSize(r * 2.6, r * 2.6);
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

    // The places, folded into a menu at the top right (open, it lists them; tap one to walk there)
    const news = hasNews(this.save, 'elder');
    this.world.setNews('elder', news);
    const bs = 40 * u;
    const bx = right - bs;
    const by = top;
    const burger = this.track(this.add.graphics());
    burger.fillStyle(COLORS.panel, this.menuOpen ? 1 : 0.88).fillRoundedRect(bx, by, bs, bs, 9 * u);
    burger
      .lineStyle(1.5 * u, this.menuOpen ? 0xffffff : COLORS.panelEdge, 0.9)
      .strokeRoundedRect(bx, by, bs, bs, 9 * u);
    burger.fillStyle(0xffffff, 0.95);
    for (let i = -1; i <= 1; i++)
      burger.fillRoundedRect(bx + 11 * u, by + bs / 2 + i * 8 * u - 1.5 * u, bs - 22 * u, 3 * u, 1.5 * u);
    if (news && !this.menuOpen) this.badge(bx + bs - 3 * u, by + 3 * u);
    this.tapZone(bx, by, bs, bs, () => {
      this.menuOpen = !this.menuOpen;
      if (this.menuOpen && !this.tipSeen) {
        this.tipSeen = true;
        writeSettings(safeStorage(), { ...loadSettings(safeStorage()), villageTipSeen: true });
      }
      this.build();
    });

    // The first time: a hint where to find the places
    // (It waits until the note about what came home is gone, so they do not overlap.)
    const noteShown = !!this.arrival && this.time.now < this.arrivalUntil;
    if (!this.tipSeen && !this.menuOpen && !noteShown) {
      const t = this.text(0, 0, 'Find your way around here', 13, { fontStyle: 'bold', color: '#1c1917' });
      const tw = t.width + 24 * u;
      const th = t.height + 14 * u;
      const tx = bx + bs - tw;
      const ty = by + bs + 12 * u;
      const g = this.track(this.add.graphics());
      g.fillStyle(COLORS.accent, 0.96).fillRoundedRect(tx, ty, tw, th, 10 * u);
      g.fillTriangle(bx + bs / 2 - 7 * u, ty, bx + bs / 2 + 7 * u, ty, bx + bs / 2, ty - 8 * u);
      t.setPosition(tx + 12 * u, ty + 7 * u).setDepth(1);
    }

    if (this.menuOpen) {
      // A tap anywhere else folds it again.
      const away = this.track(
        this.add
          .zone(W / 2, H / 2, W, H)
          .setInteractive()
          .setDepth(2),
      );
      away.on('pointerup', () => {
        this.menuOpen = false;
        this.build();
      });
      const items: { id: WalkTarget; label: string; info: string; icon: string; news: boolean }[] = [
        ...STATIONS.map((st) => ({
          id: st.id as WalkTarget,
          label: st.short,
          info: st.info,
          icon: st.icon,
          news: st.id === 'elder' && news,
        })),
        { id: 'gate', label: GATE_ENTRY.short, info: GATE_ENTRY.info, icon: GATE_ENTRY.icon, news: false },
      ];
      const gap = 4 * u;
      const pad = 8 * u;
      const my = by + bs + 8 * u;
      // One column; two side by side where the screen is too low for one (landscape phones).
      const room = H - this.sa.bottom - 12 * u - my - pad * 2;
      const rowH = 46 * u;
      const cols = items.length * (rowH + gap) > room && W > H ? 2 : 1;
      const rows = Math.ceil(items.length / cols);
      const colW = Math.min(250 * u, (right - left - pad * 2 - gap) / cols);
      const mw = pad * 2 + cols * colW + (cols - 1) * gap;
      const mx = right - mw;
      const mh = pad * 2 + rows * rowH + (rows - 1) * gap;
      const g = this.track(this.add.graphics().setDepth(3));
      g.fillStyle(COLORS.panel, 0.97).fillRoundedRect(mx, my, mw, mh, 12 * u);
      g.lineStyle(1.5 * u, COLORS.panelEdge, 1).strokeRoundedRect(mx, my, mw, mh, 12 * u);
      const walking = this.world.walkingTo();
      items.forEach((item, i) => {
        const ix = mx + pad + Math.floor(i / rows) * (colW + gap);
        const iy = my + pad + (i % rows) * (rowH + gap);
        const iw = colW;
        const primary = item.id === 'gate';
        const active = walking === item.id || (item.id !== 'gate' && this.here === item.id);
        if (primary || active) {
          g.fillStyle(primary ? COLORS.accent : 0xffffff, primary ? 0.95 : 0.1).fillRoundedRect(
            ix,
            iy,
            iw,
            rowH,
            8 * u,
          );
        }
        const iconSize = 30 * u;
        this.track(
          this.add
            .image(ix + 8 * u + iconSize / 2, iy + rowH / 2, item.icon)
            .setDisplaySize(iconSize, iconSize)
            .setDepth(4),
        );
        const tx = ix + 16 * u + iconSize;
        this.text(tx, iy + rowH / 2 - 8 * u, item.label, 14, {
          fontStyle: 'bold',
          color: primary ? '#1c1917' : '#ffffff',
        })
          .setOrigin(0, 0.5)
          .setDepth(4);
        this.text(tx, iy + rowH / 2 + 9 * u, item.info, 11, {
          color: primary ? '#44403c' : '#a1a1aa',
        })
          .setOrigin(0, 0.5)
          .setDepth(4);
        if (item.news) this.badge(ix + iw - 14 * u, iy + rowH / 2, 4);
        this.tapZone(
          ix,
          iy,
          iw,
          rowH,
          () => {
            this.menuOpen = false;
            this.world.walkTo(item.id);
            this.build();
          },
          4,
        );
      });
    }

    // The place you stand at: one big button to use it
    if (this.here) {
      const def = STATIONS.find((st) => st.id === this.here)!;
      const bw = Math.min(260 * u, right - left);
      const bh = 50 * u;
      const ay = H - this.sa.bottom - 24 * u - bh;
      const ax = W / 2 - bw / 2;
      const g = this.track(this.add.graphics());
      g.fillStyle(COLORS.accent, 0.96).fillRoundedRect(ax, ay, bw, bh, 12 * u);
      this.text(W / 2, ay + bh / 2, def.action, 17, { fontStyle: 'bold', color: '#1c1917' }).setOrigin(0.5);
      this.tapZone(ax, ay, bw, bh, () => this.open(def.id));
    }
  }

  /** The small "!" of a villager with news */
  private badge(x: number, y: number, depth = 1): void {
    const g = this.track(this.add.graphics().setDepth(depth));
    g.fillStyle(COLORS.accent, 1).fillCircle(x, y, 7 * this.u);
    this.text(x, y, '!', 11, { fontStyle: 'bold', color: '#1c1917' }).setOrigin(0.5).setDepth(depth);
  }

  // ---------------------------------------------------------------- helpers

  private tapZone(x: number, y: number, w: number, h: number, onTap: () => void, depth = 1): void {
    const zone = this.track(
      this.add
        .zone(x + w / 2, y + h / 2, w, h)
        .setInteractive({ useHandCursor: true })
        .setDepth(depth),
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
