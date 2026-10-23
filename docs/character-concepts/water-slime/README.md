# Water Slime

Created with the built-in image_gen tool using the user's reference image (not the API/CLI fallback).

## Assets

- Source skill atlas: `skills-source.png`
- Source movement atlas: `motion-source.png`
- Runtime: `apps/frontend/public/assets/water-slime.png`, `water-slime-sheet.png`, `water-slime-wrap.png`.
- Rebuild: `node scripts/build-water-slime-assets.mjs` (packages original generated poses with stable baselines and preserved alpha).
- Browser preview/check: `node scripts/preview-water-slime.mjs`; screenshots go to `test-results/water-slime/`.

The runtime sheet contains 15 states × 6 frames. Continuous squash/stretch supplements authored poses. Casting frames follow simulation time. Water wrapping pins all movement axes for three seconds, ends when the caster is interrupted, and allows damage. Guard reduces damage by 65% for three seconds. Veil fades over 0.5 seconds, conceals for 4.5 seconds, and remains 28% visible to its owner. It does not grant invulnerability. Enemy AI, manual target selection and homing cannot acquire concealed targets; untargeted attacks can still hit. This follows the existing shared-snapshot multiplayer architecture; it is presentation/gameplay concealment, not network-level secrecy from modified clients.

## Skill atlas prompt

Use case: stylized-concept. Asset type: pixel-art game animation sprite atlas. Use the user attached image as character reference: cute translucent cyan Water Slime, curled wave tuft, dark blue oval eyes, smiling mouth, pale cyan star inside belly. Generate a transparent PNG atlas, precisely 6 columns by 5 rows, equal square cells, no gaps, each sprite centered with consistent ground baseline and generous transparent padding. All 30 cells depict the SAME character facing right in three-quarter view. Row 1: six successive idle breathing/bobbing poses. Row 2: six successive spring body tackle poses: normal, compressed squat, tightly compressed accordion spring folds, stretched forward launch, impact squash, recover. Row 3: six successive water spit poses: inhale, cheeks swell, mouth opens, small cyan water orb emerging at mouth right, follow through, recover. Row 4: six successive defense poses: tuft retracts, body rounds, smooth round water ball, soft impact dent, elastic rebound, round guard. Row 5: six successive liquid engulf poses: leaning forward, elongated liquid dash, opening hollow water dome, large hollow watery bubble membrane (no victim), contracting bubble, reforming slime. Crisp detailed pixel art matching reference cyan palette, highlights and expressive face. No text, no labels, no background, no shadows outside character. True alpha transparency. All sprites entirely within their cells.

## Movement atlas prompt

Use case: stylized-concept. Generate a transparent pixel-art sprite atlas of the SAME cyan Water Slime as the previous generated atlas and user reference. Keep curled wave tuft, oval dark eyes, pink mouth, pale star in belly, translucent aqua body and cyan outline. EXACT regular 6 columns x 5 rows of equal cells. Each character stays well inside its own cell with at least 15% empty padding all sides. Side three-quarter view facing right. Six consecutive animation frames per row: Row 1 hopping locomotion loop, elastic squash and stretch with stable body size. Row 2 jump then apex then falling then soft landing then return to neutral. Row 3 being hit and knocked back, wobbling with squeezed shut eyes then recovering. Row 4 fainting progressively down into a puddle (no death gore). Row 5 happy victory bouncing loop. No text, no grid lines, no background, actual alpha transparency. Consistent detailed pixel art, identical character across all 30 frames.

## Liquid wrap overlay prompt

Use case: stylized-concept. Asset type: transparent game VFX sprite. Reference previous Water Slime atlas for pixel style and cyan watery texture only. Generate ONE complete round oval translucent water membrane, like the Water Slime expanded into an enclosing watery bubble surrounding an opponent. No opponent inside; empty transparent center allows game to render a victim behind it. Thick wavy cyan blue liquid rim, glossy white highlights, pale turquoise inner translucency, a few tiny suspended droplets within rim. Front three-quarter view, slightly wider base, full rounded top. Entire shape centered and fully visible with 20% transparent margin on all four sides. No face, no text, no star, no scenery, no floor, no cast shadow. Pixel art with crisp cyan edges matching the slime. Actual alpha transparent background and mostly transparent interior.
