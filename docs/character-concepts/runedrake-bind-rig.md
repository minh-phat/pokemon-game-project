# Runedrake: textured constriction rig

The constriction animation uses `apps/frontend/public/assets/runedrake-bind-rig.png` (2172 × 724, RGBA), generated with the built-in imagegen tool from these identity references:

- `apps/frontend/public/assets/runedrake.png`
- `docs/character-concepts/rune-dragon-movement-concept.png`

The image preserves the parchment body, red seals, scarlet ribbon fins, pixel flames, ivory horned skull, and purple smoke tail. It is a new rigging pose based on the reference, not a pixel-identical copy of the original pose.

`apps/frontend/src/game/bind-vfx.ts` bends the body pixels along an arc-length spine. The skull and smoke tail use rigid regions of the same image. Nearest-neighbor sampling retains the pixel texture, and separate front/back canvases allow the body to pass behind the opponent. The entire uncoiled creature feeds into the winding motion. No flat-color body or replacement geometric seals are drawn.

The source centerline and head/tail frame bounds are authored against this specific image; update those coordinates if replacing the rig asset. Dynamic canvas textures are reused during a cast and removed at its end. Paused and reduced-motion poses avoid repainting an unchanged texture.

## Generation prompt

Built-in imagegen, transparent background enabled, the two reference paths above supplied in that order:

> Use case: identity-preserve. Production game animation rig texture, not concept redesign. Reference 1 is the exact Runedrake character to preserve; reference 2 shows the same character in motion. Create ONE fully extended horizontal right-facing Runedrake on a truly transparent canvas. Preserve the exact small-scale crisp PIXEL ART aesthetic, dark pixel outlines, limited palette and stepped pixel clusters of the reference. No smooth vector art, no antialiasing, no painted gradients or blurred glow. Anatomy invariants: long flexible parchment-scroll dragon body with cream/golden upper surface and shaded grey-brown underside; numerous distinct red-orange circular and cross-shaped magical seals printed along the parchment; long flowing scarlet folded ribbon fins running along the spine and sides; multiple small bright orange/yellow pixel flames along those ribbons; ivory angular skeletal dragon head with long snout, pointed layered backward horn plates, red glowing eye, open toothed mouth; three dark smoky purple-brown tendrils at the tail. No legs, arms, wings, or added anatomy. Rigging composition: tail at far LEFT, head facing RIGHT at far RIGHT. ENTIRE creature visible with generous transparent margin, no cropped horns/flames/tail. Body centerline should be nearly perfectly STRAIGHT and horizontal from tail connection to neck at the SAME HEIGHT; no S curve, no loops, no coils. Only flame tongues, dorsal ribbons and tail tendrils curve around this straight central spine. Keep central parchment body a consistent thickness over most of its length. Head joins body naturally at right, tail tapers into smoky tendrils at left. A wide single sprite centered on the canvas, preferably width 1536 height 1024 with creature occupying central horizontal band. This image will be bent programmatically into a coiling snake animation: preserve every distinctive visual feature from the reference while straightening the pose. No text, no labels, no panels, no other subjects, no opponent, no background.

## Validation

`E2E_STANDALONE=1 npx playwright test tests/e2e/skill-vfx.spec.ts` covers Canvas and WebGL, winding, victim sizing, contraction, facing, pause, reduced motion, and disposal of the head, tail, and dynamic body textures.
