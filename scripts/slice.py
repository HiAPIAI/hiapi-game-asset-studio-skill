"""slice.py: cut a sheet (tiles, icons, items on a plain background) into one transparent PNG per piece.
Usage: uv run --with pillow --with numpy --with scipy python scripts/slice.py sheet.png out_dir [--min=24] [--pad=2] [--tol=38]
The background colour is read from the sheet's border; every connected blob that differs from it becomes a piece,
numbered left-to-right, top-to-bottom (r0c0, r0c1, ...). Also writes out_dir/index.json with each piece's box."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
if len(args) < 2: sys.exit(__doc__)
src, out = Path(args[0]), Path(args[1]); out.mkdir(parents=True, exist_ok=True)
MIN, PAD, TOL = int(opt.get('min', 24)), int(opt.get('pad', 2)), float(opt.get('tol', 38))
im = Image.open(src).convert('RGBA'); a = np.asarray(im).astype(np.int16)
border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])[:, :3]
bg = np.median(border, axis=0)
# background = pixels close to the border colour AND connected to the border, so dark areas inside a piece stay opaque
from scipy import ndimage
near = (np.abs(a[:, :, :3] - bg).sum(axis=2) <= TOL) | (a[:, :, 3] <= 16)
lab_bg, _ = ndimage.label(near)
edge = set(np.unique(np.concatenate([lab_bg[0], lab_bg[-1], lab_bg[:, 0], lab_bg[:, -1]]))) - {0}
fg = ~np.isin(lab_bg, list(edge))
# pieces = connected foreground blobs (a few px of slack so thin gaps don't split one piece)
lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=2))
H, W = fg.shape
boxes = [(sl[1].start, sl[0].start, sl[1].stop - 1, sl[0].stop - 1) for sl in ndimage.find_objects(lab)]
boxes = [b for b in boxes if b[2] - b[0] >= MIN and b[3] - b[1] >= MIN]
# order into rows: pieces whose vertical centres are within half a median height share a row
mh = np.median([b[3] - b[1] for b in boxes]) if boxes else 1
boxes.sort(key=lambda b: (b[1] + b[3]) / 2); rows = []
for b in boxes:
    if rows and abs((b[1] + b[3]) / 2 - np.mean([(c[1] + c[3]) / 2 for c in rows[-1]])) < mh / 2: rows[-1].append(b)
    else: rows.append([b])
index = []
alpha = np.where(fg, a[:, :, 3], 0).astype(np.uint8)
rgba = np.dstack([a[:, :, :3].astype(np.uint8), alpha])
for r, row in enumerate(rows):
    for c, (x0, y0, x1, y1) in enumerate(sorted(row)):
        x0, y0, x1, y1 = max(0, x0 - PAD), max(0, y0 - PAD), min(W, x1 + PAD + 1), min(H, y1 + PAD + 1)
        name = f'r{r}c{c}.png'; Image.fromarray(rgba[y0:y1, x0:x1]).save(out / name)
        index.append({'file': name, 'row': r, 'col': c, 'box': [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]})
(out / 'index.json').write_text(json.dumps(index, indent=1))
print(f'{len(index)} pieces in {len(rows)} rows → {out}/')
