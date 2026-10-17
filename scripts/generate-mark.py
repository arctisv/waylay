"""Writes Waylay's mark: ten square tiles on a circle, growing from a
pinprick at the top to the largest just before it, each turned to face the
center. Run `python3 scripts/generate-mark.py && npm run icons` after
changing it. Outputs the static mark, its mask layers, the favicon and the
animated version used for hovers and the activity spinner."""

import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CX, CY = 90, 91
RADIUS = 64
COUNT = 10
SMALLEST, LARGEST = 8, 28


def tiles():
    for index in range(COUNT):
        angle = -90 + index * 360 / COUNT
        size = SMALLEST + (LARGEST - SMALLEST) * index / (COUNT - 1)
        x = CX + RADIUS * math.cos(math.radians(angle))
        y = CY + RADIUS * math.sin(math.radians(angle))
        yield index, angle, size, x, y


def tile(angle, size, x, y, extra=""):
    half = size / 2
    return (
        f'<rect{extra} x="{x - half:.2f}" y="{y - half:.2f}" width="{size:.2f}" '
        f'height="{size:.2f}" transform="rotate({angle + 90:.1f} {x:.2f} {y:.2f})"/>'
    )


HEAD = '<svg width="180" height="182" viewBox="0 0 180 182" fill="none" xmlns="http://www.w3.org/2000/svg">\n'
static = "".join(f"  {tile(a, s, x, y)}\n" for _, a, s, x, y in tiles())

(ROOT / "public/brand/ring-outer.svg").write_text(HEAD + '<g fill="black">\n' + static + "</g>\n</svg>\n")
# The mark turns as one piece, so the second mask layer stays empty.
(ROOT / "public/brand/ring-inner.svg").write_text(HEAD + "</svg>\n")
(ROOT / "public/brand/mark.svg").write_text(HEAD + '<g fill="black">\n' + static + "</g>\n</svg>\n")
(ROOT / "app/icon.svg").write_text(
    HEAD
    + "<style>g{fill:#000}@media (prefers-color-scheme: dark){g{fill:#fff}}</style>\n<g>\n"
    + static
    + "</g>\n</svg>\n"
)

# Animated: each tile does a quarter turn and steps outward, in a cascade
# around the ring, then the mark rests. A quarter turn lands a square on
# itself, so the loop is seamless.
rules = "\n".join(
    f"    .t{index} {{ animation-delay: {index * 0.045:.3f}s; }}" for index, *_ in tiles()
)
animated_tiles = "".join(
    f'  {tile(a, s, x, y, f' class="t t{i}" style="--dx:{math.cos(math.radians(a)) * 7:.2f}px;--dy:{math.sin(math.radians(a)) * 7:.2f}px"')}\n'
    for i, a, s, x, y in tiles()
)
animated = f'''<svg width="240" height="242" viewBox="-30 -30 240 242" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    /* ~2.4s cycle: a quick cascade around the ring, then a beat of rest. */
    .t {{
      transform-box: fill-box;
      transform-origin: center;
      animation: turn 2.4s cubic-bezier(0.55, 0, 0.3, 1) infinite;
    }}
    @keyframes turn {{
      0% {{ translate: 0 0; rotate: 0deg; scale: 1; }}
      30% {{ translate: var(--dx) var(--dy); rotate: 45deg; scale: 1.18; }}
      60%, 100% {{ translate: 0 0; rotate: 90deg; scale: 1; }}
    }}
{rules}
  </style>
  <g fill="black">
{animated_tiles}  </g>
</svg>
'''
(ROOT / "public/brand/mark-animate.svg").write_text(animated)
print("wrote the mark")
