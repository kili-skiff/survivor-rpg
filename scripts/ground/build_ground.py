"""Generates the fight ground textures, one seamless tile per biome.

Usage: python3 scripts/ground/build_ground.py

Original pixel art made for this game (no third-party art): mottled base colours from tileable noise,
plus sparse details per biome (tufts, leaves, puddles, cracks, stones). Every detail wraps around the
tile edges, so the tile repeats without seams. Output: public/assets/ground/<biome>.png (256x256).
Replace these files (and keep the names) to give the ground other art later. Needs Pillow and numpy.
"""

import random
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 256
OUT = Path(__file__).resolve().parents[2] / "public" / "assets" / "ground"


def hexc(s: str) -> tuple[int, int, int]:
    return int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16)


class Tile:
    """A seamless pixel canvas: every drawing call wraps around the edges."""

    def __init__(self, palette: list[str], seed: int):
        self.rng = random.Random(seed)
        self.np_rng = np.random.default_rng(seed)
        self.palette = [hexc(c) for c in palette]
        self.px = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
        self._mottle()

    def _noise(self, cells: int) -> np.ndarray:
        """Tileable value noise: a wrapping grid of random values, smoothly interpolated."""
        grid = self.np_rng.random((cells, cells))
        t = np.arange(SIZE) * cells / SIZE
        i0 = np.floor(t).astype(int) % cells
        i1 = (i0 + 1) % cells
        f = t - np.floor(t)
        f = f * f * (3 - 2 * f)
        rows = grid[i0][:, :] * (1 - f)[:, None] + grid[i1][:, :] * f[:, None]
        out = rows[:, i0] * (1 - f)[None, :] + rows[:, i1] * f[None, :]
        return out

    def _mottle(self) -> None:
        """Base colour: soft patches from tileable noise, dithered into the palette (no hard blobs)."""
        n = 0.3 * self._noise(4) + 0.4 * self._noise(8) + 0.3 * self._noise(16)
        n = (n - n.min()) / (n.max() - n.min())
        levels = len(self.palette)
        bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
        threshold = np.tile(bayer, (SIZE // 4, SIZE // 4))
        idx = np.clip(np.floor(n * (levels - 1) + threshold).astype(int), 0, levels - 1)
        speckle = self.np_rng.random((SIZE, SIZE))
        idx = np.clip(idx + (speckle > 0.96) - (speckle < 0.04), 0, levels - 1)
        self.px = np.array(self.palette, dtype=np.uint8)[idx]

    # -- wrapping drawing helpers
    def dot(self, x: int, y: int, color: str, alpha: float = 1.0) -> None:
        c = np.array(hexc(color), dtype=float)
        p = self.px[y % SIZE, x % SIZE].astype(float)
        self.px[y % SIZE, x % SIZE] = (p * (1 - alpha) + c * alpha).astype(np.uint8)

    def line(self, x0: int, y0: int, x1: int, y1: int, color: str, alpha: float = 1.0) -> None:
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for s in range(steps + 1):
            self.dot(round(x0 + (x1 - x0) * s / steps), round(y0 + (y1 - y0) * s / steps), color, alpha)

    def blob(self, cx: int, cy: int, rx: float, ry: float, color: str, alpha: float = 1.0) -> None:
        for y in range(int(-ry) - 1, int(ry) + 2):
            for x in range(int(-rx) - 1, int(rx) + 2):
                if (x / max(rx, 0.5)) ** 2 + (y / max(ry, 0.5)) ** 2 <= 1:
                    self.dot(cx + x, cy + y, color, alpha)

    def scatter(self, count: int, draw) -> None:
        for _ in range(count):
            draw(self.rng.randrange(SIZE), self.rng.randrange(SIZE))

    def save(self, name: str) -> None:
        OUT.mkdir(parents=True, exist_ok=True)
        Image.fromarray(self.px, "RGB").save(OUT / f"{name}.png", optimize=True)
        print("wrote", OUT / f"{name}.png")


# ---------------------------------------------------------------- biomes


def meadow() -> Tile:
    t = Tile(["#252e1f", "#2b3723", "#31402a", "#394a31"], 11)
    r = t.rng

    def tuft(x: int, y: int) -> None:
        for dx, h in ((-2, 3), (0, 5), (2, 3)):
            t.line(x + dx, y, x + dx + r.choice((-1, 0, 1)), y - h, "#4f6540")
        t.dot(x, y + 1, "#1b2316", 0.7)

    def flower(x: int, y: int) -> None:
        t.dot(x, y, "#a9b6dc")
        t.dot(x + 1, y, "#8f9cc4")
        t.dot(x, y + 1, "#47573a")

    t.scatter(150, tuft)
    t.scatter(18, flower)
    t.scatter(30, lambda x, y: t.blob(x, y, 3, 1.5, "#1d2518", 0.45))
    return t


def forest() -> Tile:
    t = Tile(["#1c231a", "#222a1e", "#283222", "#2e3a27"], 23)
    r = t.rng

    def leaf(x: int, y: int) -> None:
        color = r.choice(("#4a3524", "#5a3f26", "#3a2a1c", "#51412a"))
        t.blob(x, y, r.choice((2, 3)), 1, color)
        t.dot(x - 1, y, "#6b4c2c", 0.5)

    def twig(x: int, y: int) -> None:
        dx, dy = r.choice((-6, 6)), r.randrange(-3, 4)
        t.line(x, y, x + dx, y + dy, "#3b2c20")
        t.line(x + dx // 2, y + dy // 2, x + dx // 2 + 2, y + dy // 2 - 3, "#3b2c20")

    def moss(x: int, y: int) -> None:
        t.blob(x, y, r.randrange(5, 10), r.randrange(3, 6), "#2f4a2c", 0.55)

    t.scatter(26, moss)
    t.scatter(170, leaf)
    t.scatter(34, twig)
    t.scatter(30, lambda x, y: t.blob(x, y, 4, 2, "#161b14", 0.4))
    return t


def swamp() -> Tile:
    t = Tile(["#1b2825", "#202f2c", "#263833", "#2c403b"], 37)
    r = t.rng

    def puddle(x: int, y: int) -> None:
        rx, ry = r.randrange(8, 17), r.randrange(4, 8)
        t.blob(x, y, rx + 1.5, ry + 1.5, "#2a2a22", 0.8)  # muddy rim
        t.blob(x, y, rx, ry, "#14302f")
        t.blob(x - rx // 4, y - ry // 3, rx * 0.5, ry * 0.3, "#2f5a56", 0.55)  # glint
        t.dot(x - rx // 3, y - ry // 2, "#6a9a94", 0.7)

    def reed(x: int, y: int) -> None:
        for dx in (-2, 0, 2):
            t.line(x + dx, y, x + dx + r.choice((-1, 1)), y - r.randrange(5, 9), "#4a5b3a")
        t.dot(x, y - 9, "#6b5236")

    def mud(x: int, y: int) -> None:
        t.blob(x, y, r.randrange(4, 9), r.randrange(2, 4), "#2a2a22", 0.6)

    t.scatter(46, mud)
    t.scatter(11, puddle)
    t.scatter(44, reed)
    return t


def graveyard() -> Tile:
    t = Tile(["#242030", "#2a2536", "#302b3d", "#383247"], 53)
    r = t.rng

    def crack(x: int, y: int) -> None:
        cx, cy = x, y
        for _ in range(r.randrange(5, 11)):
            nx, ny = cx + r.choice((-2, -1, 1, 2)), cy + r.choice((-1, 0, 1, 2))
            t.line(cx, cy, nx, ny, "#14111b")
            cx, cy = nx, ny

    def stone(x: int, y: int) -> None:
        w, h = r.randrange(2, 5), r.randrange(1, 3)
        t.blob(x + 1, y + 1, w, h, "#171420", 0.6)  # shadow
        t.blob(x, y, w, h, "#4b4758")
        t.dot(x - 1, y - 1, "#68637a")

    def bone(x: int, y: int) -> None:
        if r.random() < 0.5:
            t.line(x, y, x + 5, y + r.choice((-1, 0, 1)), "#a8a395")
            t.dot(x, y - 1, "#a8a395")
            t.dot(x, y + 1, "#a8a395")
        else:
            t.blob(x, y, 2, 2, "#a8a395")
            t.dot(x - 1, y, "#2a2536")
            t.dot(x + 1, y, "#2a2536")

    def dead_grass(x: int, y: int) -> None:
        for dx in (-1, 1):
            t.line(x + dx, y, x + dx * 2, y - r.randrange(3, 6), "#4a4630")

    t.scatter(26, crack)
    t.scatter(60, stone)
    t.scatter(4, bone)
    t.scatter(90, dead_grass)
    return t


def hills() -> Tile:
    t = Tile(["#2b2722", "#322d26", "#39332b", "#423b31"], 71)
    r = t.rng

    def pebble(x: int, y: int) -> None:
        w, h = r.randrange(2, 5), r.randrange(1, 4)
        t.blob(x + 1, y + 1, w, h, "#1d1914", 0.7)
        t.blob(x, y, w, h, "#5a5247")
        t.blob(x - 1, y - 1, max(w - 2, 1), max(h - 1, 1), "#756b5c", 0.8)

    def dry(x: int, y: int) -> None:
        for dx in (-2, 0, 2):
            t.line(x + dx, y, x + dx + r.choice((-1, 0, 1)), y - r.randrange(3, 7), "#6b5d3a")

    def crack(x: int, y: int) -> None:
        cx, cy = x, y
        for _ in range(r.randrange(6, 13)):
            nx, ny = cx + r.choice((1, 2, 3)), cy + r.choice((-1, 0, 1))
            t.line(cx, cy, nx, ny, "#1e1a15")
            cx, cy = nx, ny

    t.scatter(90, pebble)
    t.scatter(70, dry)
    t.scatter(20, crack)
    t.scatter(24, lambda x, y: t.blob(x, y, 6, 2.5, "#1f1b16", 0.35))
    return t


BIOMES = {"meadow": meadow, "forest": forest, "swamp": swamp, "graveyard": graveyard, "hills": hills}

if __name__ == "__main__":
    for name, make in BIOMES.items():
        make().save(name)
