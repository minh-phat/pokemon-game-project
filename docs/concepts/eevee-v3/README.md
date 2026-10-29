# Eevee — nature spirit

Generated with the built-in image generation tool using the user's uploaded concept as the character reference. The movement sheet then served as the identity reference for the reactions sheet. Source PNGs preserve generated transparency.

The character has ochre fur, long pointed ears, a cream forehead tuft and mane, dark brown flank stripes, and a large cream-tipped tail. All frames face right; the game mirrors them when facing left.

## Runtime assets

- `apps/frontend/public/assets/eevee-sheet.png`: 960 × 2400, six columns, fifteen rows, 160 × 160 cells.
- `apps/frontend/public/assets/eevee.png`: 320 × 320 transparent portrait.
- Rebuild with `node scripts/build-eevee-assets.mjs` (also included in `npm run assets`).
- `registration.json` records the source bounds and scale for every frame.

Rows follow the existing engine order: idle, run, jump, fall, land, attack, cast, dash, backstep, crouch, guard, hit, knockback, faint, victory. The two source sheets contain 60 authored poses, mapped into 90 runtime cells. Attack, cast, dash, backstep and crouch reuse suitable poses from those sheets because three attempts to generate a separate combat atlas were rejected by the image tool (output moderation, category `other`). They are assembled animation sequences, not independently generated combat cycles. Physics supplies jump altitude; frames use a common foot baseline. Existing skill effects and combat rules continue to apply.

The packer identifies connected silhouettes rather than relying on exact generated grid coordinates, preserves original alpha, and uses a fixed scale within each source sheet. It rejects sources without thirty separated poses.

## Prompts

The exact prompts are recorded in `prompts.json`. The first sheet uses the uploaded reference; the reactions sheet uses the generated movement sheet. Generated animation artwork can have small frame-to-frame shape variations.

Open `preview.html` to play all fifteen animations, pause, or mirror them. This preview loops one-shot actions for inspection; runtime animation rules remain unchanged.
