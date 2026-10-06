---
name: hiapi-game-assets
description: Make a complete, consistent game asset pack from one game idea through one HiAPI key — key art, character sprites and poses with transparent backgrounds, enemies, items, tilesets and UI icon sheets cut into game-ready PNGs, parallax backgrounds, title logo, background music, narrator voice lines and a trailer — then wire them into a playable prototype. Use for game jams, indie prototypes, pitch decks, modding, "make assets for my game", sprites, tilesets, game music or a game trailer.
---

# HiAPI Game Asset Studio

One game idea → one `plan.json` → every asset, all in one art style, made through HiAPI:

| asset | HiAPI model | notes |
|---|---|---|
| key art, sprites, tiles, icons, backgrounds, logo | `gpt-image-2.5-sunburst` (text-to-image / image-to-image) | `ref` keeps characters on model; `background: transparent` for sprites |
| background cut-out | `851-labs/background-remover` | for images that came back with a background |
| music | `minimax-music-2.6` | `instrumental: true` for loops |
| voice lines | `qwen-audio-3.0-tts-plus` | `instruction` sets the delivery |
| trailer | `seedance-2.0-fast` | animates a generated image (`from`) |

`HIAPI_API_KEY` comes from the environment (or `.env` here). Never print or write it.

## Hard gates
- **Cost first.** Always run `--dry-run` and tell the user the estimate before the first paid run. A typical pack is $1–3; the
  trailer is the largest item (seconds × price). Never loop paid calls to "try again" without saying so.
- **Original work only.** No existing game characters, logos, or a living artist's name in prompts. "In the style of a
  modern indie platformer" is fine; "Nintendo's Mario" is not.
- **No publishing.** Hand over files; the user ships.

## Workflow

### 1. The game in five lines
Agree with the user: genre and camera (side-scroller, top-down, isometric…), the hero, the world, the enemies/items,
and the art style in one sentence (pixel art 16-bit, hand-painted, low-poly…). Write it as `game` and `style` in the plan.

### 2. Write `plan.json` (see `references/plan.md`)
- **Anchor first:** the first image is the key art (16:9). Every character, enemy and background then uses
  `"ref": ["key_art"]`, and every extra pose of a character uses `"ref": ["<that character>"]`. This is what keeps the
  pack consistent — skip it and every sprite comes out a different design.
- Sprites: `"background": "transparent"`, 1:1, "full body, centred, side view facing right".
- Sheets (tiles, icons, items): one image, "evenly spaced on a plain dark background", then slice it (step 4).
- Backgrounds: separate far and near layers for parallax; keep the bottom quarter empty for gameplay.
- Text only where it belongs (the title logo): quote the exact words.

### 3. Run it
```bash
node scripts/run-plan.mjs plan.json --out=assets --dry-run     # free: order, models, estimated cost
node scripts/run-plan.mjs plan.json --out=assets               # makes everything; resumable
node scripts/run-plan.mjs plan.json --out=assets --redo=hero   # remake one asset (and keep the rest)
```
Assets in `assets/manifest.json` are skipped on the next run, so editing one prompt and re-running costs one asset.
Look at every image before moving on; redo what is off-model, has stray text, or a wrong background.

### 4. Make them game-ready
```bash
uv run --with pillow --with numpy --with scipy python scripts/slice.py assets/tiles.png assets/tiles/
uv run --with pillow --with numpy --with scipy python scripts/slice.py assets/title.png assets/title_cut/ --min=200
node scripts/gallery.mjs assets --title="My game"              # review page: every image, sound and the trailer
```
`slice.py` removes the plain background (only where it touches the border, so dark pixels inside a tile stay) and
writes one transparent PNG per piece plus `index.json`. Check the slices: a piece split in two means the gap was too
wide (re-slice with a larger `--min`, or regenerate the sheet with more spacing).

### 5. Prove it plays
Wire the pack into a small playable prototype (one HTML file with a canvas is enough: parallax layers, the hero with
its poses, a few enemies and pickups, HUD icons, the title, the music). `examples/tidekeeper/play.html` is a complete
~120-line example; `record.mjs` there renders it headless into a gameplay clip. Open it and play it before handing over.

### 6. Hand over
The asset folder (with `gallery.html`), the prototype, the real cost from `manifest.json`, and anything that needed
a redo. Generated output links expire after about 7 days; the files are already downloaded.
