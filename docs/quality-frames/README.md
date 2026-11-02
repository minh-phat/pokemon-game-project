# Quality portrait frames

Source: user-provided F–SSS artwork. Background extracted using the built-in image_gen tool; `atlas.png` preserves that output. Individual transparent PNGs live in `apps/frontend/public/assets/quality-frames/` and are fitted without distortion into 420 × 560 canvases.

Prompt: “Use case: background-extraction. Edit the attached nine quality frames into ONE game UI texture atlas with actual transparent alpha, both outside and INSIDE every frame. Preserve original detailed jeweled frame designs, colors, ornaments and exact rank labels F E D / C B A / S SS SSS. Arrange in a precise uniform 3 by 3 grid, each equal square cell containing exactly one complete frame centered and fully contained with a small transparent margin, no overlap between cells. Align each frame's inner portrait opening to the same position and size within its cell; retain elaborate wings and glow on high ranks. Remove ALL dark background including inside the portrait openings. No characters, no extra labels, no checkerboard baked into image. Output a square transparent PNG atlas intended for CSS sprite cropping.”

The generated atlas retained unequal row heights; crops follow its actual frame bounds rather than dividing it into equal cells. Image generation can reinterpret fine details from the reference.

`Portrait` accepts an optional typed `quality` prop and overlays the matching frame. Used for summon results, collection cards/details, formation cards, and match selection. Species-only previews keep their existing presentation. No progression or summon probability changes.
