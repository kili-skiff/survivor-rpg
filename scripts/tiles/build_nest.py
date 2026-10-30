"""Draws the Nest (a fire bowl with a flame) onto the village tile of the world map tileset.

The village tile of the original tileset (The Clover Patch, CC BY 4.0, see CREDITS.md) is kept
untouched in `scripts/tiles/originals/village.png`. This script starts from that backup, replaces
the stone well in the middle of the plaza with a fire bowl and puts the result into the village
frame (row 1, column 0) of `public/assets/tiles/hex-tiles.png`.

Run from the repository root (needs Pillow):  python3 scripts/tiles/build_nest.py
Running it again always gives the same result, because it starts from the backup.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SHEET = ROOT / "public/assets/tiles/hex-tiles.png"
BACKUP = ROOT / "scripts/tiles/originals/village.png"
FRAME_W, FRAME_H = 32, 48
VILLAGE_ROW, VILLAGE_COL = 1, 0

# Dirt colours of the plaza (taken from the tile) and the stones of the old well.
DIRT = [(0xAF, 0x52, 0x11), (0x91, 0x45, 0x04)]
STONES = {(0xA0, 0xB3, 0xAB), (0x87, 0x9A, 0x92), (0x29, 0x27, 0x21)}
WELL = (15, 18, 29, 33)  # x0, x1, y0, y1 (inclusive)

COLORS = {
    "r": (0x29, 0x27, 0x21),  # outline
    "e": (0x3A, 0x3F, 0x42),  # dark iron
    "d": (0x47, 0x52, 0x59),  # iron
    "f": (0x87, 0x9A, 0x92),  # light iron
    "g": (0xA0, 0xB3, 0xAB),  # rim highlight
    "O": (0xDC, 0x4A, 0x0B),  # flame edge
    "J": (0xF6, 0x8C, 0x02),  # flame
    "K": (0xF1, 0xB8, 0x1A),  # flame, bright
    "W": (0xFB, 0xE7, 0xA2),  # flame core
    "s": (0xFF, 0xE0, 0x8A),  # spark
    "w": (0xC8, 0x62, 0x12),  # firelit dirt
}

# x offset of the first column, then rows from the top (y = 24 ...). '.' leaves the pixel alone.
ORIGIN_X, ORIGIN_Y = 11, 24
NEST = [
    "......s......",  # 24
    "......O......",  # 25
    ".....OJ...s..",  # 26
    ".....OJO.....",  # 27
    "....OJKJO....",  # 28
    "....OJKJO....",  # 29
    "...OJKWKJO...",  # 30
    "...OJKWKJO...",  # 31
    "..rgggggggr..",  # 32  rim
    "...rfdddfr...",  # 33  bowl
    ".....rer.....",  # 34  stem
    "....reeer....",  # 35  base
    "...wwwwwww...",  # 36  firelit dirt
]


def main() -> None:
    tile = Image.open(BACKUP).convert("RGBA")
    px = tile.load()

    # Take the well out of the plaza: repaint its stones with dirt.
    x0, x1, y0, y1 = WELL
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if px[x, y][:3] in STONES:
                px[x, y] = (*DIRT[(x + y) % 2], 255)

    # The fire bowl and its flame.
    for dy, row in enumerate(NEST):
        for dx, ch in enumerate(row):
            if ch != ".":
                px[ORIGIN_X + dx, ORIGIN_Y + dy] = (*COLORS[ch], 255)

    sheet = Image.open(SHEET).convert("RGBA")
    sheet.paste(tile, (VILLAGE_COL * FRAME_W, VILLAGE_ROW * FRAME_H))
    sheet.save(SHEET, optimize=True)
    print(f"village tile written to {SHEET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
