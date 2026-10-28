# Art and sound inventory

Lam Quy replaces Squirtle's active portrait and animation sheet. Its generated
source artwork, animation mapping and prompts are documented in
[`character-concepts/lam-quy/README.md`](character-concepts/lam-quy/README.md).
Run `node scripts/build-lam-quy-assets.mjs` to rebuild the transparent PNG assets.
The persisted species ID remains `squirtle` for compatibility with existing saves.

Pikachu has also been redesigned using authored animation sheets derived from the user's
3D figure reference. Documentation is in [`character-concepts/pikachu/README.md`](character-concepts/pikachu/README.md).
Run `node scripts/build-pikachu-assets.mjs` to rebuild the transparent PNG assets (`pikachu.png` and `pikachu-sheet.png`).

All game assets are local in `apps/frontend/public/assets/`. Nothing depends on a third-party image CDN or remote font. The initial assets total approximately 1.2 MB on disk.

| Asset                   | Count | Source                                          |
| ----------------------- | ----- | ----------------------------------------------- |
| Character portrait SVGs | 4     | Hand-authored paths and shapes in the generator |
| Character sprite sheets | 4     | Six frames for each of 15 animation states      |
| Arena layers            | 12    | Four layers × forest, volcano, lake             |
| Arena composites        | 3     | Menu and arena preview compositions             |
| Skill WAV effects       | 5     | Synthesized PCM, one sound family per element   |
| Ambient WAV loops       | 3     | Synthesized PCM, one per arena                  |
| SVG favicon             | 1     | Custom arena mark                               |

Total: **32 files**. `packages/game-data/src/manifest.ts` declares the battle/portrait/audio assets. Arena definitions declare background and ambience paths. `npm run verify:assets` checks all 32 files and sprite-sheet dimensions. `npm run assets` deterministically regenerates them with Node's standard library.

Each 960 × 2400 SVG sheet contains 90 frames at 160 × 160. States, in row order: idle, run, jump, fall, land, attack, cast, dash, backstep, crouch, guard, hit, knockback, faint, victory. Phaser rasterizes the sheets into textures and plays frame animations. Limbs, ears/tails, poses, body compression, facial blinking, and Squirtle's shell rotation are authored independently by the generator. This provides genuine distinct frame states, although it is substantially simpler than commissioned production animation.

The background layers are sky/light, distant scenery, near scenery, and ground. All share a flat ground line around arena y=520 and safe x=55–1145 boundaries. Rendered particles and parallax provide additional ambient motion. These are intentionally simple, stylized environments; they are not painterly commercial artwork.

Audio is generated from sine waves, envelopes, and seeded noise. Five short skill families and three four-second ambient loops are bundled as 16 kHz mono PCM. Audio begins muted; users can enable it in the header or settings. Browser autoplay restrictions still apply.

The artwork was created for this project; it is not copied from official sprite sheets and is not licensed official Pokémon material. Pokémon names and recognizable character designs remain third-party intellectual property. The source does not convey rights to those characters. Replace the roster with original characters or obtain appropriate rights before a commercial release. Do not describe these prototype assets as final licensed art.
