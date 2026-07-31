#!/usr/bin/env python3
"""Generates assets/apple-touch-icon.png from the same geometry as
assets/favicon.svg, so the two stay in step.

Run:  python3 build/make-icons.py
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

BG = "#101014"
BLUE = "#3987e5"
ORANGE = "#d95926"

# (x, y, width, height, colour) on the favicon's 64x64 grid.
# Must match assets/favicon.svg — build/verify.js checks that they agree.
CHIPS = [
    (10, 14, 25, 17, BLUE),
    (39, 14, 15, 17, ORANGE),
    (10, 35, 15, 17, ORANGE),
    (29, 35, 25, 17, BLUE),
]
GRID = 64
CHIP_RADIUS = 5

# iOS applies its own rounded mask, so the background is drawn full-bleed.
SIZE = 180
SUPERSAMPLE = 4


def build(size: int) -> Image.Image:
    big = size * SUPERSAMPLE
    scale = big / GRID
    img = Image.new("RGB", (big, big), BG)
    draw = ImageDraw.Draw(img)
    for x, y, w, h, colour in CHIPS:
        draw.rounded_rectangle(
            [x * scale, y * scale, (x + w) * scale, (y + h) * scale],
            radius=CHIP_RADIUS * scale,
            fill=colour,
        )
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    out = os.path.join(ROOT, "assets", "apple-touch-icon.png")
    build(SIZE).save(out, "PNG", optimize=True)
    print(f"Wrote {os.path.relpath(out, ROOT)} — {SIZE}x{SIZE}, {os.path.getsize(out)} bytes")


if __name__ == "__main__":
    main()
