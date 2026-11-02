"""Builds the walkable village from LPC (Liberated Pixel Cup) map art.

Usage: python3 scripts/village/build_village.py <folder with the unzipped LPC packs> [--preview <dir>]

The folder holds the packs as downloaded from OpenGameArt (each zip unpacked, nesting does not matter):
  [LPC] Terrains            terrain-v7.tsx / terrain-v7.png
  [LPC] Roofs (v2)          preview/roofs-preview.tmx with colonial.tsx and roofs.tsx (the example houses)
  [LPC] Windows & Doors v2  windows-doors.png
  [LPC] Medieval Village Decorations  decorations-medieval.png, deco-med.tsx, fence_medieval.tsx/png
  [LPC] Blacksmith          blacksmith-smelter.png
Each pack's CREDITS-*.txt is copied into the credits file below.

Output in public/assets/village/:
  village-tiles.png   the ground tiles the map uses (32 px), nothing else
  village-props.png   buildings and decorations, one frame each (+ animation frames), packed
  village-props.json  the frames (Phaser atlas, JSON hash); each frame may carry `foot` (collision box) and
                      `light` (where it glows) in its custom data
  village.json        the map in Tiled's JSON format: ground layers, and object layers for props,
                      stations (doors and people that open a panel), the gate and the spawn point
  CREDITS-village.txt authors and licences of every pack used
With --preview, also writes village-preview.png (the map as drawn) and village-night.png (a rough night look).

Night grading as for the fight sprites: less colour, a little darker. Things that glow (fires, lanterns,
lit windows) keep their colour. The red brick walls of the example houses are recoloured to old timber and
stone so they fit the dark mood. Needs Pillow.
"""

from __future__ import annotations

import base64
import gzip
import json
import math
import random
import struct
import sys
import xml.etree.ElementTree as ET
import zlib
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

T = 32  # tile size (px)
OUT = Path(__file__).resolve().parents[2] / "public" / "assets" / "village"
SEED = 7

# --------------------------------------------------------------------------------------- sources


def find(root: Path, name: str, inside: str | None = None) -> Path:
    """The one file with this name under root (ignoring macOS metadata), optionally under a folder name."""
    hits = [
        p
        for p in root.rglob(name)
        if "__MACOSX" not in p.parts and (inside is None or any(inside in part for part in p.parts))
    ]
    if not hits:
        sys.exit(f"missing {name}" + (f" (in {inside})" if inside else "") + f" under {root}")
    return sorted(hits)[-1]


def load_rgba(path: Path, trans: str | None = None) -> Image.Image:
    img = Image.open(path).convert("RGBA")
    if trans:
        key = tuple(int(trans[i : i + 2], 16) for i in (0, 2, 4))
        px = img.load()
        for y in range(img.height):
            for x in range(img.width):
                if px[x, y][:3] == key:
                    px[x, y] = (0, 0, 0, 0)
    return img


class Tileset:
    def __init__(self, path: Path, firstgid: int = 1):
        r = ET.parse(path).getroot()
        self.firstgid = firstgid
        self.columns = int(r.get("columns"))
        img = r.find("image")
        self.image = load_rgba(path.parent / img.get("source"), img.get("trans"))
        self.root = r

    def tile(self, local: int) -> Image.Image:
        x, y = (local % self.columns) * T, (local // self.columns) * T
        return self.image.crop((x, y, x + T, y + T))


FLIP_H, FLIP_V, FLIP_D = 0x80000000, 0x40000000, 0x20000000


class TmxMap:
    """Just enough of Tiled's .tmx to render the example houses."""

    def __init__(self, path: Path):
        r = ET.parse(path).getroot()
        self.w = int(r.get("width"))
        self.tilesets = sorted(
            (Tileset(path.parent / ts.get("source"), int(ts.get("firstgid"))) for ts in r.findall("tileset")),
            key=lambda t: t.firstgid,
        )
        self.layers: dict[str, list[int]] = {}
        for layer in r.findall("layer"):
            if layer.get("visible", "1") == "0":
                continue
            data = layer.find("data")
            if data.get("encoding") == "base64":
                raw = base64.b64decode(data.text.strip())
                if data.get("compression") == "zlib":
                    raw = zlib.decompress(raw)
                elif data.get("compression") == "gzip":
                    raw = gzip.decompress(raw)
                gids = list(struct.unpack("<%dI" % (len(raw) // 4), raw))
            else:
                gids = [int(v) for v in data.text.replace("\n", "").split(",") if v.strip()]
            self.layers[layer.get("name")] = gids

    def tile_image(self, gid: int) -> Image.Image:
        raw = gid & ~(FLIP_H | FLIP_V | FLIP_D)
        ts = [t for t in self.tilesets if raw >= t.firstgid][-1]
        img = ts.tile(raw - ts.firstgid)
        if gid & FLIP_D:
            img = img.transpose(Image.TRANSPOSE)
        if gid & FLIP_H:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        if gid & FLIP_V:
            img = img.transpose(Image.FLIP_TOP_BOTTOM)
        return img

    def render(self, box: tuple[int, int, int, int], layers: list[str]) -> Image.Image:
        x0, y0, x1, y1 = box
        out = Image.new("RGBA", ((x1 - x0) * T, (y1 - y0) * T), (0, 0, 0, 0))
        for name in layers:
            gids = self.layers.get(name, [])
            for ty in range(y0, y1):
                for tx in range(x0, x1):
                    gid = gids[ty * self.w + tx] if gids else 0
                    if gid:
                        out.alpha_composite(self.tile_image(gid), ((tx - x0) * T, (ty - y0) * T))
        return out


# --------------------------------------------------------------------------------------- image helpers


def grade(img: Image.Image, saturation: float = 0.8, brightness: float = 0.88) -> Image.Image:
    """Night grading: less colour, a little darker. Alpha stays as it is."""
    a = img.getchannel("A")
    rgb = ImageEnhance.Color(img.convert("RGB")).enhance(saturation)
    rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
    out = rgb.convert("RGBA")
    out.putalpha(a)
    return out


def trim(img: Image.Image) -> Image.Image:
    box = img.getchannel("A").getbbox()
    return img.crop(box) if box else img


def crop(sheet: Image.Image, x0: float, y0: float, x1: float, y1: float, cut: bool = True) -> Image.Image:
    """A part of a sheet, in tile units; trimmed to its pixels unless cut is False."""
    img = sheet.crop((round(x0 * T), round(y0 * T), round(x1 * T), round(y1 * T)))
    return trim(img) if cut else img


def is_brick(r: int, g: int, b: int) -> bool:
    return r > 70 and r > g * 1.25 and r > b * 1.2


def recolor_walls(img: Image.Image, tint: tuple[float, float, float], gain: float) -> Image.Image:
    """Turns the red brick of the example houses into another material, keeping its shading."""
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and is_brick(r, g, b):
                lum = (0.3 * r + 0.59 * g + 0.11 * b) * gain
                px[x, y] = (
                    min(255, int(lum * tint[0])),
                    min(255, int(lum * tint[1])),
                    min(255, int(lum * tint[2])),
                    a,
                )
    return out


def wall_band(img: Image.Image) -> tuple[int, int]:
    """Top and bottom row of the rectangular wall face (rows mostly made of brick)."""
    px = img.load()
    rows = []
    for y in range(img.height):
        brick = sum(1 for x in range(img.width) if px[x, y][3] and is_brick(*px[x, y][:3]))
        rows.append(brick / img.width)
    full = [y for y, f in enumerate(rows) if f > 0.6]
    return (full[0], full[-1]) if full else (img.height // 2, img.height - 8)


def light_window(img: Image.Image, glow: tuple[int, int, int] = (255, 176, 84)) -> Image.Image:
    """Fills the dark panes of a window with warm light from inside, brighter at the bottom."""
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        k = 0.65 + 0.35 * y / max(1, out.height - 1)
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a > 200 and r + g + b < 150:
                px[x, y] = (int(glow[0] * k), int(glow[1] * k), int(glow[2] * k * 0.9), a)
    return out


# --------------------------------------------------------------------------------------- props


@dataclass
class Prop:
    """One frame (or animation) in the props atlas."""

    key: str
    frames: list[Image.Image]
    # Collision box on the ground, relative to the frame's bottom centre: (x, y, w, h) in px, y up from the
    # bottom (so y=0, h=20 is the lowest 20 px). None: walk through it.
    foot: tuple[int, int, int, int] | None = None
    # Where it glows, relative to the bottom centre (x, y up), with a radius in px. None: it does not glow.
    light: tuple[int, int, int] | None = None
    # Frames per second when animated
    fps: int = 0
    # Lit things keep their colours at night
    glows: bool = False


@dataclass
class Sources:
    terrain: Tileset
    houses: TmxMap
    doors: Image.Image
    deco: Image.Image
    smith: Image.Image
    fence: Tileset
    credits: list[Path] = field(default_factory=list)


def load_sources(root: Path) -> Sources:
    terrain = find(root, "terrain-v7.tsx")
    houses = find(root, "roofs-preview.tmx", "roofs-v2")
    doors = find(root, "windows-doors.png")
    deco = find(root, "decorations-medieval.png")
    smith = find(root, "blacksmith-smelter.png")
    fence = find(root, "fence_medieval.tsx")
    return Sources(
        terrain=Tileset(terrain),
        houses=TmxMap(houses),
        doors=load_rgba(doors),
        deco=load_rgba(deco),
        smith=load_rgba(smith),
        fence=Tileset(fence),
        credits=[
            find(root, "CREDITS-terrain.txt"),
            find(root, "CREDITS-roofs.txt", "roofs-v2"),
            find(root, "CREDITS-colonial.txt", "roofs-v2"),
            find(root, "CREDITS-windows-doors.txt"),
            find(root, "CREDITS-decorations-medieval.txt"),
            find(root, "CREDITS-blacksmith.txt"),
        ],
    )


# The example houses in roofs-preview.tmx, by tile box (x0, y0, x1, y1)
HOUSE_BOXES = {
    "hip-wide": (7, 3, 12, 9),
    "hip-tall": (13, 2, 18, 9),
    "hip-gable": (19, 2, 24, 9),
    "hip-small": (25, 3, 29, 9),
    "gable-narrow": (7, 12, 10, 19),
    "gable": (11, 12, 15, 19),
    "gable-tall": (30, 11, 35, 19),
    "cross": (36, 11, 41, 20),
    "plank": (7, 32, 11, 39),
}
HOUSE_LAYERS = ["houses_1", "houses_2", "roof_1", "roof_2"]

# Wall materials: tint on the brick's brightness, and a gain
TIMBER = ((1.0, 0.78, 0.6), 0.62)
STONE = ((0.86, 0.86, 0.9), 0.78)
DARK_STONE = ((0.8, 0.8, 0.88), 0.6)


def px(sheet: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """A part of a sheet by its pixel box, trimmed."""
    return trim(sheet.crop(box))


def window_parts(src: Sources) -> dict[str, Image.Image]:
    d = src.doors
    return {
        "cross": light_window(px(d, (707, 211, 732, 241))),
        "round": light_window(px(d, (545, 255, 576, 289))),
        "pair": light_window(px(d, (616, 205, 664, 248))),
        "narrow": light_window(px(d, (517, 332, 540, 358))),
        "arched": light_window(px(d, (609, 396, 639, 436))),
    }


def door_parts(src: Sources) -> dict[str, Image.Image]:
    d = src.doors
    return {
        "plank": grade(px(d, (144, 768, 176, 816))),
        "round": grade(px(d, (207, 768, 241, 816))),
        "braced": grade(px(d, (463, 768, 497, 817))),
        "iron": grade(px(d, (16, 768, 50, 817))),
        "knocker": grade(px(d, (335, 768, 369, 817))),
    }


def house(
    src: Sources,
    key: str,
    shape: str,
    walls: tuple[tuple[float, float, float], float],
    door: str,
    windows: list[tuple[str, float]],
    sign: Image.Image | None = None,
    sign_at: float = 0.0,
) -> Prop:
    """An example house, recoloured, with a door in the middle and lit windows at the given x (0..1)."""
    img = grade(recolor_walls(src.houses.render(HOUSE_BOXES[shape], HOUSE_LAYERS), *walls))
    top, bottom = wall_band(img)
    w, h = img.size
    dimg = door_parts(src)[door]
    dx = (w - dimg.width) // 2
    img.alpha_composite(dimg, (dx, bottom - dimg.height + 2))
    for kind, at in windows:
        win = window_parts(src)[kind]
        wy = top + max(2, (bottom - top - dimg.height) // 2 - win.height // 4)
        img.alpha_composite(win, (int(at * w - win.width / 2), wy))
    if sign is not None:
        img.alpha_composite(sign, (int(sign_at * w - sign.width / 2), top + 2))
    # The house stands on its whole wall width; the roof hides what is behind it.
    depth = h - top - 6
    return Prop(key, [img], foot=(-w // 2 + 2, 0, w - 4, max(T, depth)), light=(0, h - bottom + 28, 70))


def deco_props(src: Sources) -> list[Prop]:
    d, s = src.deco, src.smith
    props: list[Prop] = []

    def add(key, img, foot=None, light=None, glows=False):
        props.append(Prop(key, [img if glows else grade(img)], foot=foot, light=light, glows=glows))

    def anim(key, frames, fps, foot=None, light=None):
        props.append(Prop(key, frames, foot=foot, light=light, fps=fps, glows=True))

    # The Nest: the undying fire in the middle of the village (5 frames)
    # inside a ring of stones (the rim of a well): ring, flame, then the ring's front rim over the flame
    ring = grade(crop(d, 0, 13, 2, 15))
    rim = ring.crop((0, ring.height - 16, ring.width, ring.height))
    nest_frames = []
    for i in range(5):
        f = Image.new("RGBA", (ring.width, ring.height + 26), (0, 0, 0, 0))
        f.alpha_composite(ring, (0, 26))
        flame = crop(d, 8 + i, 47, 9 + i, 49, cut=False)
        f.alpha_composite(flame, ((ring.width - flame.width) // 2, f.height - flame.height - 9))
        f.alpha_composite(rim, (0, f.height - rim.height))
        nest_frames.append(f)
    anim("nest", nest_frames, 10, foot=(-ring.width // 2 + 4, 0, ring.width - 8, ring.height - 10),
         light=(0, 30, 230))
    # Wall torches (3 frames) and hanging lanterns
    anim("torch", [crop(d, 13 + i, 5, 14 + i, 6, cut=False) for i in range(3)], 10, light=(0, 22, 90))
    anim("lantern", [crop(d, 13 + i, 2, 14 + i, 3, cut=False) for i in range(3)], 5, light=(0, 16, 110))
    pole = crop(d, 11, 0, 12, 2).transpose(Image.FLIP_LEFT_RIGHT)
    lamp_frames = []
    for i in range(3):
        f = Image.new("RGBA", (pole.width + 22, pole.height + 4), (0, 0, 0, 0))
        f.alpha_composite(pole, (22, 4))
        f.alpha_composite(crop(d, 13 + i, 2, 14 + i, 3), (2, 10))
        lamp_frames.append(f)
    anim("lamp", lamp_frames, 5, foot=(4, 0, 10, 8), light=(-8, 44, 120))
    # Herbalist: a cauldron over a small fire
    cauldron = Image.new("RGBA", (T, T + 8), (0, 0, 0, 0))
    cauldron.alpha_composite(crop(d, 10, 49, 11, 50, cut=False), (0, 8))
    cauldron.alpha_composite(crop(d, 11, 49, 12, 50, cut=False), (0, 0))
    add("cauldron", trim(cauldron), foot=(-12, 0, 24, 14), light=(0, 10, 90), glows=True)
    # Smithy: open barn, a forge (4 frames), anvil, firewood
    add("barn", crop(d, 9, 20, 12, 24), foot=(-46, 0, 92, 70))
    anim("forge", [crop(s, 2 * i, 0, 2 * i + 2, 4) for i in range(4)], 6, foot=(-26, 0, 52, 30),
         light=(0, 30, 120))
    add("anvil", crop(s, 8, 13, 9, 14), foot=(-12, 0, 24, 10))
    add("firewood", crop(d, 12, 20, 14, 22), foot=(-26, 0, 52, 22))
    # Market stall
    add("stall", crop(d, 5, 25, 8, 30), foot=(-46, 0, 92, 28))
    # Well, notice board (deeds), signs
    add("well", crop(d, 14, 13, 16, 16), foot=(-26, 0, 52, 30))
    add("board", crop(d, 7, 5, 8, 6), foot=(-14, 0, 28, 8))
    add("signpost", crop(d, 6, 4, 7, 5), foot=(-4, 0, 8, 6))
    # Graveyard
    add("grave-cross", crop(d, 0, 2, 1, 3), foot=(-10, 0, 20, 8))
    add("grave-round", crop(d, 1, 2, 2, 3), foot=(-10, 0, 20, 8))
    add("grave-big", crop(d, 3, 0, 5, 2), foot=(-24, 0, 48, 30))
    add("grave-tall", crop(d, 0, 5, 1, 8), foot=(-12, 0, 24, 12))
    add("statue", crop(d, 2, 9, 3, 11), foot=(-12, 0, 24, 12))
    # Farmyard bits
    add("scarecrow", crop(d, 10, 4, 11, 6), foot=(-4, 0, 8, 6))
    add("hay", crop(d, 3, 21, 5, 23), foot=(-28, 0, 56, 22))
    add("cart", crop(d, 6, 16, 9, 18), foot=(-40, 0, 80, 20))
    add("barrel", crop(d, 2, 22, 3, 23), foot=(-10, 0, 20, 10))
    add("banner", crop(d, 5, 38, 6, 40), foot=(-6, 0, 12, 6))
    return props


def sign(src: Sources, col: int, row: int) -> Image.Image:
    return grade(crop(src.deco, col, row, col + 1, row + 1))


def build_props(src: Sources) -> list[Prop]:
    props = [
        # Your house: the stash and the belt
        house(src, "house-player", "gable", TIMBER, "round", [("round", 0.2), ("round", 0.8)]),
        # The elder's house
        house(src, "house-elder", "cross", STONE, "knocker", [("arched", 0.12), ("arched", 0.88)]),
        # The herbalist's hut, with a potion sign
        house(src, "house-herbs", "plank", TIMBER, "braced", [("cross", 0.8)], sign(src, 10, 0), 0.2),
        # Houses of other villagers
        house(src, "house-a", "hip-small", DARK_STONE, "iron", [("narrow", 0.2)]),
        house(src, "house-b", "hip-wide", TIMBER, "plank", [("pair", 0.78)]),
        house(src, "house-c", "gable-narrow", DARK_STONE, "plank", []),
    ]
    return props + deco_props(src)


# --------------------------------------------------------------------------------------- ground

# Map size in tiles
W, H = 30, 26


class Ground:
    """Terrains laid over each other. Each terrain is a mask on the tile corners; a tile shows the terrain
    on the corners it covers (the tileset's terrain tags say which tile fits which corners)."""

    def __init__(self, terrain: Tileset):
        self.ts = terrain
        names = [t.get("name") for t in terrain.root.iter("terrain")]
        self.index = {n: i for i, n in enumerate(names)}
        # terrain -> corner pattern (TL, TR, BL, BR) -> tile ids
        self.tiles: dict[int, dict[tuple[bool, ...], list[int]]] = {}
        for t in terrain.root.iter("tile"):
            tag = t.get("terrain")
            if not tag:
                continue
            corners = [int(c) if c != "" else -1 for c in tag.split(",")]
            kinds = set(corners) - {-1}
            if len(kinds) != 1:
                continue
            kind = kinds.pop()
            pattern = tuple(c == kind for c in corners)
            self.tiles.setdefault(kind, {}).setdefault(pattern, []).append(int(t.get("id")))
        self.rng = random.Random(SEED)

    def layer(self, name: str, mask: list[list[bool]]) -> list[int]:
        """Tile ids (-1 = none) for a terrain mask of (W+1) x (H+1) corners."""
        kind = self.index[name]
        out = []
        for y in range(H):
            for x in range(W):
                pattern = (mask[y][x], mask[y][x + 1], mask[y + 1][x], mask[y + 1][x + 1])
                if not any(pattern):
                    out.append(-1)
                    continue
                ids = self.tiles[kind][pattern]
                # Full tiles: mostly the plain one, now and then a variant
                out.append(ids[0] if len(ids) == 1 or self.rng.random() < 0.75 else self.rng.choice(ids[1:]))
        return out


def mask_from(test) -> list[list[bool]]:
    return [[bool(test(x, y)) for x in range(W + 1)] for y in range(H + 1)]


def near_path(px_: float, py: float, path: list[tuple[float, float]], r: float) -> bool:
    for (ax, ay), (bx, by) in zip(path, path[1:]):
        dx, dy = bx - ax, by - ay
        k = max(0.0, min(1.0, ((px_ - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
        if math.hypot(px_ - (ax + k * dx), py - (ay + k * dy)) <= r:
            return True
    return False


def noise(x: float, y: float) -> float:
    """Smooth value noise in 0..1, for patches of dead grass."""
    def h(ix: int, iy: int) -> float:
        n = (ix * 374761393 + iy * 668265263 + SEED * 1442695041) & 0xFFFFFFFF
        n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
        return (n & 0xFFFF) / 0xFFFF

    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    top = h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx
    bottom = h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx
    return top * (1 - sy) + bottom * sy


# --------------------------------------------------------------------------------------- fences


class Fence:
    """Fence lines from the fence tileset's Wang sets: each tile picks the piece whose ends match its
    neighbours along the line."""

    def __init__(self, ts: Tileset):
        self.ts = ts
        self.sets: dict[str, dict[tuple[bool, bool, bool, bool], int]] = {}
        for ws in ts.root.iter("wangset"):
            pieces: dict[tuple[bool, bool, bool, bool], int] = {}
            for t in ws.findall("wangtile"):
                wid = int(t.get("wangid"), 16)
                # Nibbles from the lowest: top, top-right, right, bottom-right, bottom, bottom-left, left, top-left
                edges = tuple(((wid >> (4 * i)) & 0xF) == 1 for i in (0, 2, 4, 6))
                pieces.setdefault(edges, int(t.get("tileid")))
            self.sets[ws.get("name")] = pieces

    def tiles(self, style: str, cells: set[tuple[int, int]]) -> dict[tuple[int, int], int]:
        pieces = self.sets[style]
        out = {}
        for x, y in cells:
            want = ((x, y - 1) in cells, (x + 1, y) in cells, (x, y + 1) in cells, (x - 1, y) in cells)
            best = max(pieces, key=lambda e: sum(a == b for a, b in zip(e, want)))
            out[(x, y)] = pieces[best]
        return out


def line(x0: int, y0: int, x1: int, y1: int) -> set[tuple[int, int]]:
    if x0 == x1:
        return {(x0, y) for y in range(min(y0, y1), max(y0, y1) + 1)}
    return {(x, y0) for x in range(min(x0, x1), max(x0, x1) + 1)}


# --------------------------------------------------------------------------------------- layout
# Positions in tiles. Props stand on their bottom centre (x, y).

NEST = (15.0, 13.2)
PLAZA = (15.0, 12.8, 3.3)  # centre and radius of the stone square around the Nest

PROPS: list[tuple[str, float, float]] = [
    ("house-b", 15.0, 7.0),
    ("house-player", 8.0, 9.0),
    ("house-a", 3.5, 8.6),
    ("house-elder", 22.2, 9.6),
    ("house-c", 27.6, 9.2),
    ("nest", *NEST),
    ("well", 10.6, 12.2),
    ("board", 18.6, 10.9),
    ("lamp", 11.2, 15.6),
    ("lamp", 19.2, 15.4),
    ("lamp", 13.3, 21.0),
    ("lamp", 17.0, 24.6),
    ("lamp", 6.2, 10.4),
    ("lamp", 25.0, 11.0),
    # The herbalist's hut and garden corner
    ("house-herbs", 4.4, 16.4),
    ("cauldron", 7.4, 17.0),
    ("scarecrow", 2.4, 19.0),
    ("hay", 7.2, 19.0),
    # The smithy
    ("barn", 25.2, 17.4),
    ("forge", 22.0, 17.2),
    ("anvil", 23.2, 18.3),
    ("firewood", 27.6, 18.2),
    # The trader at the gate
    ("stall", 20.2, 22.4),
    ("barrel", 22.2, 22.6),
    ("cart", 25.4, 22.6),
    ("signpost", 13.0, 23.2),
    # The graveyard
    ("grave-big", 5.0, 23.0),
    ("grave-cross", 2.8, 22.0),
    ("grave-round", 7.6, 21.8),
    ("grave-cross", 3.2, 24.4),
    ("grave-round", 7.2, 24.4),
    ("statue", 9.2, 24.6),
]

# Dirt paths (polylines in tiles) and their half width
PATHS: list[list[tuple[float, float]]] = [
    [(15, 27), (15, 15)],  # from the gate to the square
    [(15, 10), (15, 7.2)],  # house B
    [(12.5, 12.0), (9.4, 10.2), (8.0, 9.2)],  # your house
    [(8.0, 9.4), (3.6, 8.9)],  # house A
    [(17.6, 12.0), (21.0, 10.4), (22.2, 9.8)],  # the elder
    [(22.2, 9.8), (27.6, 9.5)],  # house C
    [(12.2, 13.8), (8.0, 17.2), (4.4, 16.8)],  # the herbalist
    [(17.8, 13.8), (21.6, 18.6), (25.2, 17.8)],  # the smithy
    [(15, 20.5), (19.6, 23.0)],  # the trader
    [(15, 22.6), (10.4, 22.6)],  # the graveyard
]
PATH_WIDTH = 1.05

# Fences: the palisade around the village with the gate at the bottom, and a crooked fence around the graves
GATE = (14, 16)  # gate opening, tile columns x0..x1-1 in the bottom row
PALISADE = (
    line(0, 1, W - 1, 1)
    | line(0, 1, 0, H - 1)
    | line(W - 1, 1, W - 1, H - 1)
    | (line(0, H - 1, W - 1, H - 1) - {(x, H - 1) for x in range(*GATE)})
)
GRAVE_FENCE = line(1, 20, 10, 20) | line(10, 20, 10, 25) - {(10, 22), (10, 23)}

# Stations: (id, x, y, w, h) in tiles, a zone in front of the door or person. Walking into it offers the panel.
STATIONS = [
    ("house", 8.0, 9.6, 1.6, 1.2),
    ("elder", 22.2, 10.2, 1.6, 1.2),
    ("cauldron", 7.4, 17.6, 1.6, 1.2),
    ("armory", 23.2, 18.9, 1.8, 1.2),
    ("merchant", 20.2, 23.0, 2.2, 1.2),
    ("hearth", NEST[0], NEST[1] + 0.7, 2.0, 1.2),
    ("deeds", 18.6, 11.5, 1.4, 1.0),
]
SPAWN = (15.0, 15.0)  # where you wake up: just in front of the Nest
GATE_ZONE = (15.0, 25.6, 2.0, 0.8)


# --------------------------------------------------------------------------------------- export


def pack(images: list[tuple[str, Image.Image]], width: int = 1024) -> tuple[Image.Image, dict]:
    """Shelf packing, tallest first. Returns the sheet and key -> (x, y, w, h)."""
    order = sorted(images, key=lambda kv: (-kv[1].height, -kv[1].width))
    x = y = 0
    row_h = 0
    boxes = {}
    for key, img in order:
        if x + img.width > width:
            x = 0
            y += row_h + 2
            row_h = 0
        boxes[key] = (x, y, img.width, img.height)
        x += img.width + 2
        row_h = max(row_h, img.height)
    height = 1 << (y + row_h - 1).bit_length()
    sheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    lookup = dict(images)
    for key, (bx, by, _, _) in boxes.items():
        sheet.alpha_composite(lookup[key], (bx, by))
    return sheet, boxes


def build(src: Sources, preview: Path | None) -> None:
    props = {p.key: p for p in build_props(src)}

    # Ground layers
    ground = Ground(src.terrain)
    cx, cy, cr = PLAZA
    layers = {
        "ground": ground.layer("Grass_Dark", mask_from(lambda x, y: True)),
        # Lighter patches so the grass is not one flat colour
        "ground-patches": ground.layer("Grass", mask_from(lambda x, y: noise(x / 3.0, y / 3.0) > 0.64)),
        # Dark, dug earth among the graves
        "ground-graves": ground.layer(
            "Dirt_Dark", mask_from(lambda x, y: 2 <= x <= 9 and 21 <= y <= 25 and noise(x / 1.6, y / 1.6) > 0.35)
        ),
        "ground-path": ground.layer(
            "Dirt_Brown", mask_from(lambda x, y: any(near_path(x, y, p, PATH_WIDTH) for p in PATHS))
        ),
        "ground-stone": ground.layer(
            "Gravel_1", mask_from(lambda x, y: math.hypot(x - cx, (y - cy) * 1.1) <= cr)
        ),
    }
    fence = Fence(src.fence)
    fences = {
        **{k: ("palisade", v) for k, v in fence.tiles("Fence 9_Palisades", PALISADE).items()},
        **{k: ("crooked", v) for k, v in fence.tiles("Fence 7_Crooked", GRAVE_FENCE).items()},
    }

    # Ground and fence tiles into one tileset: only what the map uses
    used: dict[tuple[str, int], int] = {}
    tile_imgs: list[Image.Image] = []

    def use(kind: str, tile_id: int) -> int:
        if (kind, tile_id) not in used:
            used[(kind, tile_id)] = len(tile_imgs)
            img = (src.terrain if kind == "terrain" else src.fence).tile(tile_id)
            tile_imgs.append(grade(img))
        return used[(kind, tile_id)] + 1  # Tiled gids start at 1

    tile_layers = {
        name: [use("terrain", t) if t >= 0 else 0 for t in data] for name, data in layers.items()
    }
    fence_data = [0] * (W * H)
    for (x, y), (_, tile_id) in fences.items():
        fence_data[y * W + x] = use("fence", tile_id)
    tile_layers["fences"] = fence_data
    cols = 16
    tiles_sheet = Image.new("RGBA", (cols * T, math.ceil(len(tile_imgs) / cols) * T), (0, 0, 0, 0))
    for i, img in enumerate(tile_imgs):
        tiles_sheet.alpha_composite(img, ((i % cols) * T, (i // cols) * T))

    # Props atlas
    frames = []
    for p in props.values():
        if len(p.frames) == 1:
            frames.append((p.key, p.frames[0]))
        else:
            frames += [(f"{p.key}-{i}", f) for i, f in enumerate(p.frames)]
    props_sheet, boxes = pack(frames)
    atlas = {
        "frames": {
            key: {
                "frame": {"x": x, "y": y, "w": w, "h": h},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
                "sourceSize": {"w": w, "h": h},
            }
            for key, (x, y, w, h) in sorted(boxes.items())
        },
        "meta": {
            "image": "village-props.png",
            "size": {"w": props_sheet.width, "h": props_sheet.height},
            "scale": "1",
            # Our own data per prop: frame count and speed, collision box and light (see Prop)
            "props": {
                p.key: {
                    "frames": len(p.frames),
                    "fps": p.fps,
                    "foot": list(p.foot) if p.foot else None,
                    "light": list(p.light) if p.light else None,
                }
                for p in props.values()
            },
        },
    }

    # The map in Tiled's JSON format
    next_id = 1

    def obj(name: str, kind: str, x: float, y: float, w: float, h: float, point: bool = False) -> dict:
        nonlocal next_id
        o = {"id": next_id, "name": name, "type": kind, "x": round(x, 1), "y": round(y, 1),
             "width": round(w, 1), "height": round(h, 1), "rotation": 0, "visible": True}
        if point:
            o.update(point=True, width=0, height=0)
        next_id += 1
        return o

    prop_objects = []
    for key, x, y in PROPS:
        f = props[key].frames[0]
        prop_objects.append(obj(key, "prop", x * T - f.width / 2, y * T - f.height, f.width, f.height))
    station_objects = [
        obj(sid, "station", (x - w / 2) * T, (y - h / 2) * T, w * T, h * T) for sid, x, y, w, h in STATIONS
    ]
    gx, gy, gw, gh = GATE_ZONE
    marks = [
        obj("gate", "gate", (gx - gw / 2) * T, (gy - gh / 2) * T, gw * T, gh * T),
        obj("spawn", "spawn", SPAWN[0] * T, SPAWN[1] * T, 0, 0, point=True),
    ]
    # Fences block the way: one box per fence tile, along its lower half
    collider_objects = [obj("fence", "collider", x * T, y * T + 12, T, 20) for (x, y) in sorted(fences)]

    layer_list = []
    for i, (name, data) in enumerate(tile_layers.items(), start=1):
        layer_list.append({"id": i, "name": name, "type": "tilelayer", "x": 0, "y": 0, "width": W,
                           "height": H, "opacity": 1, "visible": True, "data": data})
    for name, objects in (("props", prop_objects), ("stations", station_objects), ("marks", marks),
                          ("colliders", collider_objects)):
        layer_list.append({"id": len(layer_list) + 1, "name": name, "type": "objectgroup", "x": 0, "y": 0,
                           "opacity": 1, "visible": True, "draworder": "topdown", "objects": objects})
    tiled = {
        "type": "map", "version": "1.10", "tiledversion": "1.10.2", "orientation": "orthogonal",
        "renderorder": "right-down", "width": W, "height": H, "tilewidth": T, "tileheight": T,
        "infinite": False, "compressionlevel": -1, "nextlayerid": len(layer_list) + 1,
        "nextobjectid": next_id,
        "tilesets": [{
            "firstgid": 1, "name": "village-tiles", "image": "village-tiles.png",
            "imagewidth": tiles_sheet.width, "imageheight": tiles_sheet.height, "tilewidth": T,
            "tileheight": T, "tilecount": len(tile_imgs), "columns": cols, "margin": 0, "spacing": 0,
        }],
        "layers": layer_list,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    tiles_sheet.save(OUT / "village-tiles.png", optimize=True)
    props_sheet.save(OUT / "village-props.png", optimize=True)
    (OUT / "village-props.json").write_text(json.dumps(atlas, indent=1) + "\n")
    (OUT / "village.json").write_text(json.dumps(tiled, separators=(",", ":")) + "\n")
    write_credits(src)
    for name in ("village-tiles.png", "village-props.png", "village-props.json", "village.json"):
        print("wrote", OUT / name, f"({(OUT / name).stat().st_size // 1024} KB)")

    if preview:
        preview.mkdir(parents=True, exist_ok=True)
        parts_sheet(list(props.values()), preview / "village-parts.png")
        day = render_map(tile_layers, tile_imgs, props)
        day.convert("RGB").save(preview / "village-preview.png")
        night(day, props).convert("RGB").save(preview / "village-night.png")
        print("wrote previews to", preview)


def write_credits(src: Sources) -> None:
    head = (
        "Village art for Nightwatch (public/assets/village/), built by scripts/village/build_village.py\n"
        "from the LPC packs below. Changes: tiles and parts cut out and packed, colours graded darker,\n"
        "the brick walls of the example houses recoloured to timber and stone, doors, windows and signs\n"
        "placed on them, windows filled with warm light, a lantern hung on a pole, a camp fire set into the\n"
        "rim of a well.\n"
        "These files are shared under CC-BY-SA 3.0 (every pack used allows that).\n\n"
        "Sources (OpenGameArt):\n"
        "  [LPC] Terrains                      https://opengameart.org/content/lpc-terrains\n"
        "  [LPC] Roofs (v2, with its example houses and [LPC] Colonial Buildings)\n"
        "                                      https://opengameart.org/content/lpc-roofs\n"
        "  [LPC] Windows & Doors (v2)          https://opengameart.org/content/lpc-windows-doors\n"
        "  [LPC] Medieval Village Decorations  https://opengameart.org/node/90157\n"
        "  [LPC] Blacksmith                    https://opengameart.org/content/lpc-blacksmith\n\n"
        "Credits of each pack follow, as the packs require.\n"
    )
    parts = [head]
    for path in src.credits:
        parts.append("\n" + "=" * 100 + f"\n{path.name}\n" + "=" * 100 + "\n" + path.read_text(errors="replace").strip() + "\n")
    (OUT / "CREDITS-village.txt").write_text("".join(parts))


# --------------------------------------------------------------------------------------- previews


def render_map(tile_layers: dict[str, list[int]], tile_imgs: list[Image.Image], props: dict[str, Prop]) -> Image.Image:
    img = Image.new("RGBA", (W * T, H * T), (20, 18, 26, 255))
    for name, data in tile_layers.items():
        if name == "fences":
            continue
        for i, gid in enumerate(data):
            if gid:
                img.alpha_composite(tile_imgs[gid - 1], ((i % W) * T, (i // W) * T))
    # Fences and props sorted by their bottom, like the game will draw them
    things = [(y * T, props[k].frames[0], x * T - props[k].frames[0].width / 2) for k, x, y in PROPS]
    data = tile_layers["fences"]
    for i, gid in enumerate(data):
        if gid:
            things.append(((i // W + 1) * T, tile_imgs[gid - 1], (i % W) * T + T / 2 - T / 2, True))
    for t in sorted(things, key=lambda t: t[0]):
        bottom, f, left = t[0], t[1], t[2]
        top = bottom - f.height
        img.alpha_composite(f, (int(left), int(top)))
    return img


def night(day: Image.Image, props: dict[str, Prop]) -> Image.Image:
    """A rough idea of the village at night: dark, with warm light around fires, lanterns and windows."""
    dark = ImageEnhance.Brightness(day.convert("RGB")).enhance(0.2).convert("RGBA")
    light = Image.new("L", day.size, 0)
    draw = ImageDraw.Draw(light)
    for key, x, y in PROPS:
        p = props[key]
        if not p.light:
            continue
        lx, ly, r = p.light
        cx, cy = x * T + lx, y * T - ly
        for k in range(12, 0, -1):
            rr = r * k / 12
            draw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=int(235 * (1 - k / 12) ** 0.8))
    light = light.filter(ImageFilter.GaussianBlur(14))
    lit = ImageChops.multiply(day.convert("RGB"), Image.new("RGB", day.size, (255, 214, 170))).convert("RGBA")
    return Image.composite(lit, dark, light)


# --------------------------------------------------------------------------------------- debug sheet


def parts_sheet(props: list[Prop], path: Path) -> None:
    pad = 12
    width = 1400
    x = y = pad
    row_h = 0
    placed = []
    for p in props:
        img = p.frames[0]
        if x + img.width > width:
            x = pad
            y += row_h + 22
            row_h = 0
        placed.append((p, x, y))
        x += img.width + pad
        row_h = max(row_h, img.height)
    sheet = Image.new("RGBA", (width, y + row_h + 30), (40, 40, 48, 255))
    draw = ImageDraw.Draw(sheet)
    for p, px_, py in placed:
        sheet.alpha_composite(p.frames[0], (px_, py + 12))
        draw.text((px_, py), p.key, fill=(255, 255, 0))
        if p.foot:
            fx, fy, fw, fh = p.foot
            bx = px_ + p.frames[0].width // 2
            by = py + 12 + p.frames[0].height
            draw.rectangle((bx + fx, by - fy - fh, bx + fx + fw, by - fy), outline=(255, 0, 0))
    sheet.convert("RGB").save(path)


def main() -> None:
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    root = Path(args[0])
    preview = Path(args[args.index("--preview") + 1]) if "--preview" in args else None
    build(load_sources(root), preview)


if __name__ == "__main__":
    main()
