"""Builds the fight sprites from LPC (Liberated Pixel Cup) layers.

Usage: python3 scripts/lpc/build_sprites.py <path to Universal-LPC-Spritesheet-Character-Generator>

Each character is a stack of LPC layers (body, head, clothes), recoloured to fit the dark mood.
Output: public/assets/sprites/<name>.png, frames of 64x64 px:
  rows 0-3: walk cycle facing up, left, down, right (9 frames each)
  row 4:    falling down (6 frames), used when the character dies
plus public/assets/sprites/LPC-CREDITS.csv: authors, licences and sources of every layer used,
taken from the generator's CREDITS.csv. Sources and licences: see CREDITS.md. Needs Pillow.
"""

import csv
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance

FRAME = 64
WALK_COLS = 9
HURT_COLS = 6
OUT = Path(__file__).resolve().parents[2] / "public" / "assets" / "sprites"


def tint(img: Image.Image, color: tuple[int, int, int], strength: float = 1.0) -> Image.Image:
    """Multiplies the layer with a colour (keeps shading), blended by `strength`."""
    r, g, b, a = img.split()
    rgb = Image.merge("RGB", (r, g, b))
    mult = Image.new("RGB", img.size, color)
    tinted = ImageChops.multiply(rgb, mult)
    mixed = Image.blend(rgb, tinted, strength)
    return Image.merge("RGBA", (*mixed.split(), a))


def grade(img: Image.Image, saturation: float, brightness: float) -> Image.Image:
    """Night grading: less colour, a little darker. Alpha stays as it is."""
    a = img.getchannel("A")
    rgb = img.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(saturation)
    rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
    out = rgb.convert("RGBA")
    out.putalpha(a)
    return out


class Layer:
    def __init__(self, walk: str, hurt: str, color=None, strength: float = 1.0):
        self.walk = walk
        self.hurt = hurt
        self.color = color
        self.strength = strength


def load(root: Path, rel: str, color, strength) -> Image.Image:
    img = Image.open(root / "spritesheets" / rel).convert("RGBA")
    return tint(img, color, strength) if color else img


# A last tint over the finished sheet (after the night grading), for characters that must stand out
# from the others at a glance. name -> (colour, strength).
FINISH = {
    # Pale violet bones: clearly not the grey-brown zombie, and not red (warning) or blue (slowed).
    "ghoul": ((165, 120, 235), 0.6),
}


def build(root: Path, name: str, layers: list[Layer], saturation: float, brightness: float) -> None:
    sheet = Image.new("RGBA", (FRAME * WALK_COLS, FRAME * 5), (0, 0, 0, 0))
    walk = Image.new("RGBA", (FRAME * WALK_COLS, FRAME * 4), (0, 0, 0, 0))
    hurt = Image.new("RGBA", (FRAME * HURT_COLS, FRAME), (0, 0, 0, 0))
    for layer in layers:
        w = load(root, layer.walk, layer.color, layer.strength).crop((0, 0, FRAME * WALK_COLS, FRAME * 4))
        h = load(root, layer.hurt, layer.color, layer.strength).crop((0, 0, FRAME * HURT_COLS, FRAME))
        walk.alpha_composite(w)
        hurt.alpha_composite(h)
    sheet.alpha_composite(walk, (0, 0))
    sheet.alpha_composite(hurt, (0, FRAME * 4))
    OUT.mkdir(parents=True, exist_ok=True)
    out = grade(sheet, saturation, brightness)
    if name in FINISH:
        out = tint(out, *FINISH[name])
    out.save(OUT / f"{name}.png", optimize=True)
    print("wrote", OUT / f"{name}.png")


def part(path: str, color=None, strength: float = 1.0) -> Layer:
    """A layer whose walk and hurt sheets sit side by side: <path>/walk.png and <path>/hurt.png."""
    return Layer(f"{path}/walk.png", f"{path}/hurt.png", color, strength)


CHARACTERS = {
    # The watchman: dark hood and tattered cloak over leather armour.
    "player": (
        [
            part("cape/tattered/bg", (70, 74, 92)),
            part("body/bodies/male"),
            part("legs/pants/male", (90, 70, 55)),
            part("feet/boots/basic/male", (120, 100, 85)),
            part("torso/armour/leather/male", (150, 130, 115)),
            part("cape/tattered/fg", (70, 74, 92)),
            part("head/heads/human/male"),
            part("hat/cloth/hood/adult", (60, 62, 78)),
        ],
        0.75,
        0.95,
    ),
    "zombie": (
        [
            Layer("body/bodies/zombie/walk/zombie.png", "body/bodies/zombie/hurt/zombie.png"),
            part("head/heads/zombie/adult"),
            part("legs/pants/male", (85, 80, 70)),
        ],
        0.6,
        0.85,
    ),
    # Ghouls are fast, lanky and bony.
    "ghoul": (
        [
            part("body/bodies/skeleton"),
            part("head/heads/skeleton/adult"),
        ],
        0.45,
        0.8,
    ),
    "brute": (
        [
            part("body/bodies/muscular", (150, 175, 140)),
            part("legs/pants/muscular", (80, 60, 50)),
            part("head/heads/troll/adult"),
        ],
        0.6,
        0.85,
    ),
}


def write_credits(root: Path) -> None:
    """Copies the generator's credit rows for every layer file used."""
    used = sorted({f for layers, _, _ in CHARACTERS.values() for l in layers for f in (l.walk, l.hurt)})
    with open(root / "CREDITS.csv", newline="", encoding="utf-8") as f:
        rows = {r["filename"].strip(): r for r in csv.DictReader(f)}

    def credit(name: str):
        # Variants such as body/bodies/zombie/walk/zombie.png are credited as body/bodies/zombie/walk.png.
        return rows.get(name) or rows.get(str(Path(name).parent) + ".png")

    missing = [f for f in used if not credit(f)]
    if missing:
        sys.exit(f"no credits found for: {missing}")
    with open(OUT / "LPC-CREDITS.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["file", "notes", "authors", "licenses", "urls"])
        for name in used:
            r = credit(name)
            writer.writerow([name, r["notes"].strip(), r["authors"].strip(), r["licenses"].strip(), r["urls"].strip()])
    print("wrote", OUT / "LPC-CREDITS.csv")


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    root = Path(sys.argv[1])
    for name, (layers, sat, bright) in CHARACTERS.items():
        build(root, name, layers, sat, bright)
    write_credits(root)


if __name__ == "__main__":
    main()
