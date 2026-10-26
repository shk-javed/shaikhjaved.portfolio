#!/usr/bin/env python3
"""Build the SHK JAVED pangolin sprite strips + manifest for the "Talk to Me" twin.

Dev-time only (needs Pillow; uses `cwebp` when it is on PATH, otherwise Pillow's WebP encoder).
The source sheet stays outside the repo and is passed as an argument:

    python3 tools/build_twin_sprites.py /path/to/spritesheet-extended.png [--out twin/sprites] [--quality 75]

Input contract: ChatGPT pet sprite sheet v2, 1536x2288 RGBA, 8 columns x 11 rows, 192x208 cells.
Output: one lossy WebP strip per used row (native 192x208 cells), poster.webp (idle frame 0)
and manifest.json with per-row ground line / scale corrections and frame timings.
Dropping in a newer sheet = rerun this script; ground lines are re-measured automatically,
scale corrections come from SCALE_OVERRIDES (tuned by eye; re-check after a new sheet).
"""
import argparse
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

CELL_W, CELL_H = 192, 208
COLS, ROWS = 8, 11

# row index -> (strip name, frame count, frame durations ms, default loop)
# Timings follow the pet's own preview GIFs. run-left drops the 220 ms end-hold (it travels).
ROW_SPEC = [
    (0, "idle", 6, [280, 110, 110, 140, 140, 320], True),
    # row 1 (running-right) is not shipped: darker palette drift + smaller; mirrored run-left is used.
    (2, "run-left", 8, [120] * 8, True),
    (3, "wave", 4, [140, 140, 140, 280], 2),
    (4, "jump", 5, [140, 140, 140, 140, 280], False),
    (5, "failed", 8, [140] * 7 + [240], False),
    (6, "waiting", 6, [150] * 5 + [260], True),
    (7, "working", 6, [120] * 5 + [220], True),
    (8, "review", 6, [150] * 5 + [280], True),
    (9, "look-a", 8, None, None),
    (10, "look-b", 8, None, None),
]

# Visually tuned size corrections relative to idle (rendered comparison, Oct 2026 sheet).
SCALE_OVERRIDES = {
    "idle": 1.0, "run-left": 0.98, "wave": 1.12, "jump": 1.12, "failed": 1.0,
    "waiting": 1.0, "working": 0.97, "review": 1.0, "look": 1.22,
}

# Reduced-motion still frame per state (column index in its strip).
STILLS = {"idle": 0, "run-left": 0, "wave": 2, "jump": 0, "failed": 3,
          "waiting": 3, "working": 3, "review": 0}

ALPHA_SNAP = 245  # body pixels are ~98% opaque in the source; snap them to fully opaque


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def clean(im):
    r, g, b, a = im.split()
    a = a.point(lambda v: 255 if v >= ALPHA_SNAP else v)
    mask = a.point(lambda v: 255 if v == 0 else 0)
    black = Image.new("L", im.size, 0)
    r = Image.composite(black, r, mask)
    g = Image.composite(black, g, mask)
    b = Image.composite(black, b, mask)
    return Image.merge("RGBA", (r, g, b, a))


def ground_and_area(cell):
    """Lowest solid pixel row (alpha > 128) and solid-pixel count."""
    solid = cell.getchannel("A").point(lambda v: 255 if v > 128 else 0)
    bb = solid.getbbox()
    if not bb:
        return None, 0
    return bb[3], solid.histogram()[255]


# Lossy alpha at q60: indistinguishable from q85 at 2x zoom on mist/ink (body alpha is snapped
# to 255, only the 1-3 px edge ramp is affected) and saves ~14% per strip.
ALPHA_Q = 60


def encode(img, dest, quality):
    if shutil.which("cwebp"):
        with tempfile.TemporaryDirectory() as td:
            src = os.path.join(td, "in.png")
            img.save(src)
            subprocess.run(["cwebp", "-quiet", "-q", str(quality), "-alpha_q", str(ALPHA_Q), "-m", "6",
                            "-sharp_yuv", "-metadata", "none", src, "-o", dest], check=True)
    else:
        img.save(dest, "WEBP", quality=quality, method=6, alpha_quality=ALPHA_Q)
    return os.path.getsize(dest)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheet", help="path to the v2 sprite sheet PNG/WebP (kept outside the repo)")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "twin", "sprites"))
    ap.add_argument("--quality", type=int, default=75)
    args = ap.parse_args()

    sheet = Image.open(args.sheet)
    if sheet.size != (CELL_W * COLS, CELL_H * ROWS):
        sys.exit("expected a v2 sheet of %dx%d, got %dx%d" % (CELL_W * COLS, CELL_H * ROWS, *sheet.size))
    sheet = clean(sheet.convert("RGBA"))
    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)

    measured = {}
    files = {}
    for row, name, n, _, _ in ROW_SPEC:
        strip = sheet.crop((0, row * CELL_H, n * CELL_W, row * CELL_H + CELL_H))
        grounds, areas = [], []
        for c in range(n):
            g, a = ground_and_area(strip.crop((c * CELL_W, 0, c * CELL_W + CELL_W, CELL_H)))
            if g is None:
                sys.exit("empty frame: row %d col %d" % (row, c))
            grounds.append(g)
            areas.append(a)
        measured[name] = {"ground": max(grounds), "area0": areas[0]}
        files[name] = encode(strip, os.path.join(out, name + ".webp"), args.quality)
    files["poster"] = encode(sheet.crop((0, 0, CELL_W, CELL_H)), os.path.join(out, "poster.webp"), args.quality)

    ref_ground = measured["idle"]["ground"]
    ref_area = measured["idle"]["area0"]

    def scale_for(key, name):
        auto = math.sqrt(ref_area / float(measured[name]["area0"]))
        return round(SCALE_OVERRIDES.get(key, min(1.25, max(0.9, auto))), 3), round(auto, 3)

    states = {}
    for row, name, n, durations, loop in ROW_SPEC:
        if name.startswith("look"):
            continue
        scale, auto = scale_for(name, name)
        states[name] = {
            "file": name + ".webp", "row": row, "frames": n, "durations": durations, "loop": loop,
            "ground": measured[name]["ground"], "scale": scale, "measuredScale": auto,
            "still": STILLS[name], "bytes": files[name],
        }
    look_ground = max(measured["look-a"]["ground"], measured["look-b"]["ground"])
    look_scale, look_auto = scale_for("look", "look-a")

    manifest = {
        "schema": "twin-sprites/1",
        "character": "SHK JAVED",
        "source": {"sha256": sha256(args.sheet), "width": CELL_W * COLS, "height": CELL_H * ROWS, "version": 2},
        "cell": {"w": CELL_W, "h": CELL_H},
        "display": {"w": CELL_W // 2, "h": CELL_H // 2},
        "refGround": ref_ground,
        "poster": {"file": "poster.webp", "bytes": files["poster"]},
        "facing": "left",
        "states": states,
        "aliases": {"waving": "wave", "jumping": "jump", "running": "working", "thinking": "working"},
        "mirrors": {"run-right": "run-left"},
        "look": {
            "files": ["look-a.webp", "look-b.webp"], "framesPerFile": 8, "step": 22.5,
            "zero": "up", "direction": "clockwise", "neutral": 270, "inbetweenMs": 60,
            "avoid": {"180": 202.5},
            "ground": look_ground, "scale": look_scale, "measuredScale": look_auto,
            "bytes": [files["look-a"], files["look-b"]],
        },
        "idleHoldMs": [2000, 5000],
        "walkFrameMs": 120,
        "budget": {
            "entrance": ["poster", "idle", "wave"],
            "open": ["working", "look", "jump", "review"],
            "lazy": ["waiting", "failed", "run-left"],
        },
    }
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
        f.write("\n")

    total = sum(files.values())
    for k in sorted(files):
        print("%-9s %7d B" % (k, files[k]))
    print("total     %7d B  (refGround %d, look ground %d)" % (total, ref_ground, look_ground))


if __name__ == "__main__":
    main()
