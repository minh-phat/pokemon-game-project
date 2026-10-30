# Directional locomotion assets

Generated with the built-in `image_gen` tool using each existing portrait as its identity/style reference. Sources retain generated alpha. `scripts/build-direction-assets.mjs` finds transparent grid seams, registers all poses to a fixed baseline and packages runtime atlases without changing the original combat sheets.

Available: Water Slime, Charmander, Lam Quy (`squirtle`), Eevee and Runedrake. Pikachu and Bulbasaur generation requests were rejected by the image service; they intentionally retain existing art and are not advertised as supporting eight views.

Each runtime atlas has six columns and six rows: original east idle, original east run, north run, northeast run, southeast run, south run. Left-facing directions mirror the corresponding right-facing view. Front/back idle holds the first authored pose with subtle runtime breathing. North/south/diagonal jump and fall hold a lifted running pose; landing adds a brief squash. These are locomotion additions, not separately authored directional attacks. Casts and other combat actions continue to use their existing action sheets.

The dragon's generated front diagonal points left; the packer mirrors that row to register southeast correctly. Its frame width remains 320 pixels. Other species use 160-pixel frames. All frames are 160 pixels high and new poses use a 150-pixel baseline.

Rebuild: `node scripts/build-direction-assets.mjs`. Preview: open `docs/directional-animation-preview.html` in a browser. Source registration bounds are recorded beside each PNG. Runtime PNGs live in `apps/frontend/public/assets/*-directions.png`.

## Prompt

Transparent 2D game sprite sheet, using attached image as character identity/style reference. Preserve same creature, anatomy, colors, markings and art style. EXACTLY 24 separated full-body poses in an evenly spaced SIX COLUMN by FOUR ROW grid with generous transparent gaps. No labels, text, grid, floor or shadows. Fixed slightly elevated orthographic camera.

Each row is a SIX-FRAME looping RUN cycle: contact, down, passing, opposite contact, down, passing, different limb positions, stable body proportions and scale. For limbless creature use six distinct flowing squash and undulation phases.

ROW 1: NORTH, directly AWAY from viewer, rear view, back of head, NO face visible.
ROW 2: NORTHEAST, diagonally AWAY toward screen upper-right, rear three-quarter view.
ROW 3: SOUTHEAST, diagonally TOWARD viewer and screen lower-right, front three-quarter view.
ROW 4: SOUTH, directly TOWARD viewer, front view.

Actual anatomical viewing angles, not rotating a flat image. All six poses in each row face the SAME direction. All full bodies fit inside equal-size cells with margin, no overlapping or touching poses. Transparent alpha background.
