<div align="center">

# HiAPI Game Asset Studio

**Describe your game. Get the whole asset pack — in one style — and a playable prototype.**

Sprites · tilesets · UI icons · parallax backgrounds · title logo · music · voice lines · trailer<br>
one plan file, one [HiAPI](https://www.hiapi.ai/en) key, any coding agent (Claude Code, Codex, Cursor…)

English · [简体中文](README.zh-CN.md) · AI agent? Read [llms-install.md](llms-install.md)

<img src="assets/readme/gameplay.gif" width="640" alt="Tidekeeper, a playable prototype built from the generated pack">

<sub>Tidekeeper — every sprite, tile, icon, background, the music and the logo above came out of one <a href="examples/tidekeeper/plan.json">plan.json</a>. Made in minutes for $2.34.</sub>

</div>

## What one prompt made

<img src="assets/readme/pack.jpg" width="100%" alt="The Tidekeeper asset pack">

| | |
|---|---|
| <img src="assets/readme/trailer.gif" width="420" alt="trailer"> | **14 assets, 3 models, 1 key** <br>• key art, hero + jump pose, enemy, pickup — the cat stays the same cat in every image<br>• 6×3 tileset and 6 UI icons, sliced into transparent PNGs<br>• far + near parallax layers, title logo<br>• two chiptune music loops, a narrated intro line<br>• an 8-second trailer animated from the key art<br><br>▶ [play.html](examples/tidekeeper/play.html) (clone and open it) · 🎵 [All assets](examples/tidekeeper/assets/) |

## Install

```bash
npx -y github:HiAPIAI/hiapi-game-asset-studio-skill -y
export HIAPI_API_KEY=your_key        # https://www.hiapi.ai/en/dashboard/api-keys
```

Then ask your agent:

- "Make assets for a cozy pixel-art platformer about a cat who keeps a lighthouse, and a playable prototype."
- "Top-down roguelike, hand-painted style: hero, 4 enemies, a dungeon tileset, item icons, boss music."
- "I have this character sketch — make it a sprite with idle and jump poses, same design." (pass your image as a `file` asset)

## How it stays consistent

Every image is chained to an anchor: the key art is generated first, then each character, enemy and background is
made **from** it (image-to-image), and each extra pose is made from that character. A shared style line is appended to
every prompt. That is what keeps a pack looking like one game instead of twenty different ones.

## Under the hood

| step | model on HiAPI |
|---|---|
| images, sprites, sheets | GPT Image 2.5 (text-to-image, image-to-image, transparent backgrounds) |
| cut-outs | background remover |
| music | MiniMax Music 2.6 |
| voice | Qwen Audio TTS |
| trailer | Seedance 2.0 Fast |

`run-plan.mjs` runs the whole plan in dependency order, in parallel, with a free `--dry-run` cost estimate, and resumes
where it stopped. `slice.py` cuts sheets into game-ready PNGs. `gallery.mjs` builds a review page of the pack.

## License

MIT. Generated assets are yours to use under HiAPI's and each model provider's terms.
