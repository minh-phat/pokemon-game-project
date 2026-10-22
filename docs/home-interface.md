# Summoner home interface

The welcome screen and authenticated player lobby are implemented in `apps/frontend/src/components/home.tsx`, with scoped styling in `apps/frontend/src/app/home.css`.

- Vietnamese is the default. VI/EN is persisted with the existing device preferences. New home screens, authentication, settings, and setup menus have both languages. Game-data descriptions and the existing in-battle UI retain their original copy.
- `/auth/me` restores the actual server session. Successful registration or login opens the player lobby. Logout returns to the welcome screen. Session data is not persisted in local storage.
- Play opens AI/online mode selection. Pets and Library open the codex. Team opens the existing team builder. Explore opens arena selection. Settings opens actual audio, motion, event-feed, and language controls.
- Events, check-in, rankings, achievements, summoning, upgrades, inventory, shop, quests, friends, mailbox, and community show a localized unavailable notification.
- Currency, energy, and level show `—` until backed by real player progression data. Event banners say “Coming soon”.
- The viewport fills landscape mobile screens, respects safe-area insets, and offers a dismissible rotation hint in portrait. The PWA manifest requests landscape orientation; regular browser tabs remain usable in either orientation.

## Art

Created with the built-in `image_gen` tool, then encoded to WebP with Sharp. These are new illustrations based on the supplied references, not exact copies of those screenshots. Text, navigation, borders, and buttons are real HTML/CSS.

Assets saved in `apps/frontend/public/assets/home/`:

- `landing.webp`: welcome illustration.
- `lobby.webp`: player lobby illustration.
- `menu-icons.webp`: transparent 4×4 icon atlas; row-major cell mapping lives in `emblemCells`.

### Landing prompt

Create a production web game background illustration, landscape 16:9 at high resolution. Match the two user reference screenshots' sumptuous detailed pixel-art JRPG fantasy aesthetic: luminous royal blue moonlit floating castle kingdom, cascading cyan waterfalls, floating islands, stone gothic arches and hanging royal blue gold embroidered banners, warm golden lanterns, ivy and sparkling blue crystals. NO TEXT, NO LETTERS, NO UI, NO BUTTONS, NO FRAMES. This is the landing screen background: upper central area around 45%-65% x and 12%-50% y is uncluttered deep blue sky for HTML title overlay. A handsome cute chibi young summoner boy with tousled dark brown hair, royal navy cloak with intricate gold trim and cyan crystal staff stands toward lower LEFT at x27% y63%, full body occupying height 45%. Four cute magical pets surround him: white lavender winged fox floating at x12% y49%, pink cream fire fox at x18% y75%, little green leaf slime at x34% y77%, black baby dragon with bright blue wings at x44% y70%. They stand on radiant blue summoning circle on stone terrace at bottom left. Far right features magnificent distant moonlit castle and waterfalls. Rich intricate pixel illustration, crisp pixel edges, sophisticated blue gold palette, enchanting warm lights, exactly same feeling and composition as first user screenshot. Leave bottom 17% for overlay cards. No typography or UI anywhere.

### Lobby prompt

Use case: stylized-concept. Asset type: full screen 16:9 landscape background illustration for fantasy RPG player lobby. Match the SECOND screenshot supplied by the user: exceptionally detailed pixel art, rich royal blue and warm golden lighting, chibi anime fantasy game. NO UI, NO LETTERS, NO TEXT, NO BUTTONS. Inside majestic open stone gothic summoner tower, blue gold banners, many candles and lanterns, books and magical artifacts. Through broad arch in middle see huge luminous moon, royal blue night sky, magnificent floating castle and cascading cyan waterfalls. Full body chibi brown haired young summoner boy seen from BACK, wearing deep blue gold embroidered cape and holding luminous crystal staff, positioned x36% y58%, standing on big glowing cyan rune summoning circle at x36% y77%. Black adorable baby dragon with cyan blue wings to his left x20% y70%; white lavender winged fox floating x25% y44%; cream pink fire fox x48% y71%; green leaf slime x58% y73%. Main scene and pets all fit in left 66% of image; right 33% contains dim ornate stone tower interior with ivy and books intended to be covered by menu cards. Top 12% and bottom 15% should allow menu overlays. Make characters large enough to read on mobile. Crisp small pixels, gorgeous polished retro JRPG art, blue crystal lighting and golden candlelight. No UI anywhere.

### Icon atlas prompt

Use case: stylized-concept. Production UI icon atlas for pixel art fantasy summoner RPG. EXACT square image, 4 columns by 4 rows grid, 16 equal size square cells, each icon precisely centered in its cell, generous transparent padding so icons do not touch cell boundaries. Fully transparent background. NO text, NO labels, NO numbers, NO dividers, NO UI frames. Gorgeous crisp chunky detailed pixel art with dark outlines and gold highlights like classic JRPG menus. Every icon fills 75 percent of its cell. Row 1 left to right: 1 gold coin with star engraving, 2 luminous cyan diamond gem, 3 golden lightning bolt, 4 ornate royal golden crown with red jewel. Row 2 left to right: 1 parchment calendar with red top and green checkmark, 2 golden trophy cup, 3 open cream parchment spellbook with brown leather cover, 4 crossed silver swords over round brown and gold heraldic shield. Row 3 left to right: 1 brown leather fantasy adventurer backpack satchel with gold buckle, 2 wooden medieval shop stall with red awning and gold coins, 3 parchment quest scroll with wax seal, 4 swirling luminous blue magical portal. Row 4 left to right: 1 three ivory silhouettes of people representing team, 2 golden arrow pointing upward, 3 ivory speech bubble with three dark dots, 4 cream envelope with gold trim. Icons must be isolated transparent cutouts on exact regular 4 by 4 grid, no text or other elements. Same consistent pixel art style across all 16 icons. Square aspect ratio.

## Verification

`tests/e2e/home.spec.ts` covers language persistence, responsive bounds (640×360, 667×375, 844×390, desktop and portrait), unavailable notifications, mode selection, signup validation, login failure/success, session restoration, player navigation, settings, and logout. Account responses are mocked in these browser tests, so they do not create users or validate a live MongoDB deployment.

For an already running frontend, use `E2E_BASE_URL=http://localhost:4000 E2E_STANDALONE=1 npx playwright test tests/e2e/home.spec.ts`. Otherwise use the normal Playwright configuration to launch services.
