# plan.json

```json
{
  "game": "one paragraph: genre, camera, hero, world, enemies, goal",
  "style": "one sentence appended to every image prompt: medium, palette, rendering rules, 'no text unless asked'",
  "assets": [
    { "id": "key_art", "type": "image", "aspect_ratio": "16:9", "prompt": "..." },
    { "id": "hero", "type": "image", "ref": ["key_art"], "background": "transparent", "prompt": "..." },
    { "id": "hero_cut", "type": "cutout", "from": "hero" },
    { "id": "my_sketch", "type": "file", "path": "sketch.png" },
    { "id": "bgm", "type": "music", "instrumental": true, "prompt": "..." },
    { "id": "line1", "type": "voice", "text": "...", "voice": "longanlingxin", "instruction": "...", "lang": "zh" },
    { "id": "trailer", "type": "video", "from": "key_art", "duration": 8, "resolution": "720p", "prompt": "..." }
  ]
}
```

| field | types | values |
|---|---|---|
| `aspect_ratio` | image | auto 1:1 3:2 2:3 4:3 3:4 16:9 9:16 21:9 27:16 16:27 9:8 8:9 |
| `resolution` | image | 1K (default) 2K 4K — transparent backgrounds need 1K |
| `background` | image | transparent opaque auto |
| `ref` | image | ids of earlier images or files, sent as reference images |
| `from` | cutout, video | id of an earlier image (cutout needs a generated one) |
| `model` | image | `gpt-image-2.5-sunburst` (default) or `gpt-image-2.5-flare` |
| `voice` | voice | `longanlingxin` (default), `longanlufeng` |
| `duration` | video | 4–15 s; `resolution` 480p or 720p; `audio` true/false |

List prices used by `--dry-run` (check https://www.hiapi.ai/en/pricing): image $0.05 (1K) / $0.08 (2K) / $0.12 (4K),
background removal $0.002, music $0.21 per track, voice $0.04 per 1,000 characters, video $0.084/s (480p) or $0.177/s (720p).

## Prompting for consistency
- Say "the same character as the reference image" and list what must not change (colours, outfit, proportions).
- One subject per sprite; state the facing direction and "full body, centred".
- For sheets, give the grid ("a 6×3 grid of separate square tiles with even spacing") and a plain background colour.
- For loops, ask for "seamless loop"; for a title theme, "short".
