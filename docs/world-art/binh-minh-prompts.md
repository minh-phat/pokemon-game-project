# Bình Minh — imagegen

Mode: built-in `image_gen`; generated 2026-10-26.

## Building atlas prompt

```
Use case: stylized-concept.
Asset type: production environment sprite atlas for an isometric creature-summoning RPG, city named Bình Minh.
Create ONE transparent PNG, square 1536x1536 canvas, strict 3 by 3 equal grid of 512x512 cells. Nine separate complete isometric buildings, each centered inside its own cell with generous transparent margins (at least 35 pixels), base centered at the same vertical position, no overlap between cells. True transparent background, no grid lines, no text, no labels, no watermark, no ground backdrop outside each building's compact foundation. Consistent 2:1 dimetric game view: verticals vertical, ground axes slope +/- 26.565 degrees. Highly polished hand-painted pixel-art aesthetic compatible with a colorful isometric RPG, crisp detailed readable silhouettes, white ceramic futuristic architecture, teal glass, cyan energy strips, warm gold accents, rooftop gardens. All buildings face down-right. Not photorealistic.
Cells in EXACT row-major order:
1 top-left: futuristic human hospital, white rounded clinic towers, teal glass, a clearly visible cyan medical plus emblem.
2 top-center: summoner academy, elegant campus with two slim towers and a central floating luminous crystal, open book emblem.
3 top-right: summoned-creature veterinary hospital, rounded healing sanctuary, paw emblem, softly glowing mint roof.
4 middle-left: creature battle arena, open oval stadium with clearly visible fighting field, stepped stands, four curved canopy fins.
5 middle-center: futuristic shop and market hall, low glass-front retail pavilion, warm gold shop awnings and teal roof.
6 middle-right: creature museum, beautiful dome and sculptural crescent roof, luminous fossil silhouette behind a glass facade.
7 bottom-left: futuristic residential skyscraper cluster, three slender white and blue glass towers of varied heights with planted terraces.
8 bottom-center: compact landscaped city park on a diamond footprint, curved paths, leafy trees, a fountain and small pond, no building.
9 bottom-right: central summoning portal, majestic vertical glowing cyan ring in a white and gold architectural cradle on an octagonal platform, open ring center, welcoming and magical.
Each asset a distinct standalone object, not a collage scene. No city wall in this atlas. Preserve real transparency between every object.
```

## City concept prompt

```
Use case: stylized-concept.
Asset type: master environment concept art for Bình Minh, the starting city of an open-world creature-summoning RPG.
Create a beautiful wide landscape aerial isometric illustration of the ENTIRE futuristic city, with every perimeter edge visible. The city has a regular octagonal footprint surrounded by a continuous tall translucent cyan ENERGY FORCE-FIELD WALL with subtle hexagonal patterns, supported by sleek white pylons. EXACTLY FOUR monumental gate openings, at North, East, South and West; four broad streets lead from these gates to the central plaza. The other four diagonal faces have no gates. Keep the wall translucent so it does not obscure the city.
At the exact center is a spectacular upright luminous summoning portal on an octagonal white and gold plaza: this is where the player first arrives. A tiny arriving adventurer gives scale. Ring boulevards, wide pedestrian sidewalks, trees, planting beds, streetlights and landscaped parkland connect all districts. Include visually distinct: human hospital with a medical plus; summoned-creature hospital with a paw; summoning academy with floating crystal; open-air creature battle arena; shop and market district; glass-domed creature museum; a lush public park with pond and fountain; many elegant futuristic high-rise residential towers. Spread the districts around the portal, with unobstructed four axial streets. White ceramic curves, blue-teal glass, restrained gold trim, luminous cyan technology, green roofs. Architecture should feel advanced, welcoming and inhabited, not a medieval castle. Outside the energy wall is open-world grassland, woodland and a few distant fantastical wild creatures safely outside the barrier. Warm dawn sunlight, hopeful atmosphere, exceptional game concept-art polish, high detail but legible zoning.
Composition: elevated 2:1 isometric aerial view, generous landscape margin around the entire octagon, balanced readable city plan, portal is the visual focus. Add only the title “BÌNH MINH” in refined understated typography at bottom left. No other text, no HUD, no inset images, no watermark.
```

## Project assets

- `apps/frontend/public/assets/binh-minh/concept.png`: full city concept.
- `apps/frontend/public/assets/binh-minh/buildings-source.png`: original transparent generated atlas.
- `apps/frontend/public/assets/binh-minh/buildings.png`: archived first atlas.
- `apps/frontend/public/assets/binh-minh/buildings-source-v2.png`: repaired source with separated buildings and complete foundations.
- `apps/frontend/public/assets/binh-minh/buildings-v2.png`: current runtime atlas; rebuild with `node scripts/build-city-assets.mjs`. Each foundation is 200 px wide, centered at `[128, 196]` in a 256 px cell. At scale 0.896 this matches a 5.6-tile isometric footprint.

The in-game city uses these generated sprites with depth sorting, terrain, roads, animated portal and force-field geometry. Building interiors and hospital/shop/academy services are not implemented by this environment design.

## Atlas repair prompt (built-in image_gen edit)

```
Use case: precise-object-edit. Repair this production sprite atlas for the futuristic city Bình Minh. Preserve the nine building identities, white ceramic / teal glass / subtle gold visual language and true transparency, but RECOMPOSE THE ENTIRE SHEET with strict separation and correct consistent isometric foundations.
Output square PNG 1536x1536, exact uniform 3x3 grid. Each cell 512x512. EACH OBJECT MUST fit entirely in the middle 340x340 area of its cell with at least 80 pixels of EMPTY TRANSPARENT padding on ALL FOUR SIDES. Buildings must be SMALLER than in the reference so there are WIDE TRANSPARENT GUTTERS. No object, shadow, sparkle, flag, leaf, roof or fragment may enter the gutter. Absolutely no clipping and no neighboring object fragments.
Nine cells row-major: human hospital with cyan plus; summoning academy with floating crystal; creature hospital with paw; open oval battle arena; gold-awning shop; glass dome creature museum; futuristic residential towers; landscaped park with pond fountain paths and trees; upright summoning portal.
All nine share one precise 2:1 DIMETRIC camera: ground diamond edges slope exactly +/-26.565 degrees. Each entire building sits on ONE compact diamond-shaped foundation, whose front corner is centered horizontally. Foundations must be visible and consistent. Buildings vertical and not tilted. Do not stretch them or rotate their perspective differently. Simplify excessively ornate spires a little for clear small-scale game rendering; retain elegant futuristic architecture.
Transparent background; NO labels, NO visible grid, NO borders, NO captions, NO background landscape. True alpha. Padding and clean isolated silhouettes are the highest priority.
```

The continuous road surface, curbs, crossings, stone forecourts and bounded planting beds are native Canvas geometry cached in a single 1536 × 832 ground image. The repaired sprite sheet is aligned to the same plot centers used for collision. Occlusion checks read actual sprite alpha at the trainer's head and torso.
