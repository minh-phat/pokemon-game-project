# Pokémon Arena

A runnable, account-free 2D Pokémon arena game. Build a team of Pikachu, Charmander, Squirtle, and Bulbasaur, then watch their AI fight or switch to manual controls during the match. Play locally against AI or invite a second browser into a private online room.

This is an unofficial fan project with custom, bundled vector artwork and synthesized audio. The graphics are a consistent prototype art set, not licensed official Pokémon artwork or finished commercial animation.

## Quick start

Use **Node.js 22.12+** (Node 24 recommended) and npm 10+.

```bash
npm ci
npm run dev
```

Open **http://localhost:3000**. The single command starts all three services:

| Service  | URL                   | Purpose                                             |
| -------- | --------------------- | --------------------------------------------------- |
| Next.js  | http://localhost:3000 | Menus, team selection, Phaser arena, HUD            |
| NestJS   | http://localhost:3001 | Roster, configuration, arenas, temporary identities |
| Colyseus | http://localhost:2567 | Authoritative online rooms and battles              |

No database, account, API key, or asset download is required after dependency installation. Assets are already included. Stop the services with Ctrl+C.

For a production-mode local run:

```bash
npm run build
npm start
```

## Play

**VS AI:** choose VS AI, configure rules, inspect the four fighters, add a complete team, and enter the arena. A three-second countdown precedes automatic combat. Pause and resume are available offline. Results offer another match or a return home.

**Online:** choose Online 1v1, enter a trainer name, create a private room, configure rules, and confirm a team. Share the invitation link/code with a second browser or browser profile. The guest selects their own team. Both players click **Ready for battle**. Both teams run on the server's AI. Two rematch votes reopen the lobby after the result.

**Rules:** 1–4 Pokémon per roster, 1–4 active fighters subject to roster size, 60/120/180 seconds or unlimited, three arenas, optional duplicates, optional elemental multipliers, and optional strategic reserve switching. Offline opponents have Easy/Normal/Hard reaction and decision modifiers. Online AI uses the same Normal tuning on both sides when they are in auto mode. Either trainer can switch to manual mode during a battle, select an active Pokémon, guard, dodge, jump, crouch, and use its four skills while AI keeps moving it and using its basic attack. Keyboard shortcuts for the selected Pokémon are Shift+WASD or Shift+arrow keys (directional dash, including diagonals), Shift alone (dash facing forward), Space (jump), C (crouch), G (toggle guard), and 1–4 (skills).

When a fighter faints, a reserve always enters if available. Strategic switching additionally permits a weakened fighter to retreat into reserve; it does not directly heal them. Elimination wins immediately. At the time limit, compare the sum of each surviving fighter's HP/maxHP, including reserves; surviving count breaks ties, then a draw. Thus a high-base-HP species has no automatic advantage in timer scoring.

An unexpected online disconnection pauses simulation for up to **30 seconds**. The SDK retries, and a same-tab reload can restore the session using a token in sessionStorage. Grace expiry or explicit departure during combat forfeits. A server restart loses all in-memory rooms.

## Implemented

- Home, mode selection, rule configuration, illustrated Pokédex/team builder, lobby, loading/countdown, live battle, results, and settings.
- Four configured species, 16 working abilities, distinct combat preferences, 15 animation states per species, and 360 generated sprite frames.
- Acceleration, gravity, jumping, body collision, dash/backstep, crouch/slide, Squirtle shell rolling, attack lunges, swept projectile collision, melee windows, knockback, stun, slows, shield, burn, and Leech Seed recovery.
- Utility decisions and finite states with reaction delays, imperfect projectile prediction, boundary checks, target selection, defensive actions, and seeded randomness.
- Health, energy, cooldowns, reserve status, timer, floating damage, skill labels, an event feed, elemental VFX, ambient particles, optional audio, and reduced-motion settings.
- Server-validated rules/teams/readiness, host authority, private invitation rooms, countdown, authoritative damage and results, 20 Hz snapshots, interpolation, reconnection, forfeit, expiry, and rematch.
- Responsive menus and arena, keyboard focus states, labelled controls, settings focus trapping, textual battle details, and persistent device preferences.

## Project structure

```text
apps/
  frontend/          Next.js App Router, Zustand, Tailwind/shadcn primitives, Phaser
    src/components/ Separate screens, HUD, selection, and UI primitives
    src/game/       Phaser scene and audio lifecycle
    src/lib/        Store, snapshot feed, and Colyseus client
    public/assets/  32 bundled SVG/WAV assets
  backend/           NestJS read API and temporary identity endpoint
  game-server/       Colyseus transport and independently testable room policy
packages/
  game-core/         Fixed-step combat, physics, collisions, skills, results
  game-ai/           Pure utility/FSM decisions and threat prediction
  game-data/         Species, moves, balance, arenas, animation/asset manifests
  shared-types/      TypeScript contracts and Zod validation
tests/               Engine/policy tests and browser/transport integration tests
scripts/             Reproducible asset generation, verification, benchmark
docs/                Architecture, verification, art notes, development plan
```

## Commands and testing

```bash
npm run typecheck       # All application and shared TypeScript
npm test                # Vitest combat and room-policy tests
npm run build           # Type checks, two Node bundles, Next production build
npm run test:e2e         # Real VS AI / two-browser online / room-lifecycle tests
npm run verify:assets   # Check every manifest asset and sprite sheet
npm run benchmark       # Headless 4v4 simulation benchmark
npm run format:check    # Prettier source/documentation check
```

Playwright starts and stops its own servers unless they are already running. Tests use ordinary UI interactions for full matches, without injecting battle state. On macOS the default browser is installed Google Chrome. Elsewhere, install Playwright Chromium first:

```bash
npx playwright install chromium
# If Chromium is desired on macOS too:
PLAYWRIGHT_CHANNEL=chromium npm run test:e2e
```

Test the built services instead of development servers with:

```bash
npm run build
E2E_PRODUCTION=1 npm run test:e2e
```

Failure traces and screenshots are written under `test-results/`, with an HTML report in `playwright-report/`. See [verification notes](docs/VERIFICATION.md) for actual results and measured performance, [architecture](docs/ARCHITECTURE.md) for design/API details, and [asset notes](docs/ASSETS.md) for artwork limitations.

Regenerate the checked-in art and synthesized sounds with `npm run assets`. This uses Node alone. The custom shadcn-style Button and Radix Dialog source lives in `src/components/ui`; the theme and tokens live in `globals.css` with Tailwind 4's PostCSS integration.

## Configuration and LAN play

Defaults work without environment files. `.env.example` lists supported variables. `npm run dev` and `npm start` load the root `.env` when present. The first port in `FRONTEND_ORIGIN` sets the Next.js listening port; `API_PORT` and `GAME_PORT` set the other services' ports. Shell environment variables take precedence. Next also reads frontend overrides from `apps/frontend/.env.local`. Restart the services after changing `.env`.

For another device on your LAN, replace `192.168.1.20` with the server computer's reachable address:

```bash
# Put these in apps/frontend/.env.local, then restart Next:
NEXT_PUBLIC_API_URL=http://192.168.1.20:3001
NEXT_PUBLIC_GAME_SERVER_URL=http://192.168.1.20:2567

# In the shell that launches npm run dev:
export FRONTEND_ORIGIN=http://192.168.1.20:3000,http://localhost:3000
npm run dev
```

The frontend currently imports immutable game data from the shared workspace, so offline selection works even if the API is unavailable; the API publishes the same data for future clients. Temporary identities are available via the API; multiplayer uses Colyseus session IDs and reconnection tokens. `NEXT_PUBLIC_API_URL` documents the API address for future API-backed clients and is not required by offline play. Private room invitation links use the current frontend origin. Other devices cannot use `localhost` links. Public deployment requires separate Node hosting with HTTPS/WSS, proxy configuration, and an explicit origin allowlist.

## Limitations and next improvements

- Art and synthesized audio are authored placeholders of a consistent quality, not production-licensed Pokémon assets. Names/designs remain Pokémon IP. A commercial release needs appropriate rights or an original creature roster.
- Balancing is an initial pass. There are no competitive rankings, permanent progression, public matchmaking, authentication, or persistence.
- Online uses full MessagePack snapshots at 20 Hz rather than delta-compressed schema patches. State stays in one process. Rate limits are process-local; internet-scale abuse/load hardening is not complete.
- Desktop Chrome and a mobile-sized Chrome viewport were exercised. Real mobile devices, Safari/Firefox, GPU diversity, screen-reader behavior, and high-latency networks need a wider test matrix. No universal 60 FPS or internet-latency guarantee is claimed.
- Audio starts muted, respects autoplay restrictions, and uses short synthesized loops. Unlimited matches have no artificial timeout; the tested roster combinations all resolve, but future balance changes can introduce stalemates.
- Settings and reconnection survive on the current device; offline matches do not survive reloads. Server restarts intentionally clear rooms.

Recommended next work: commission/licence final art and audio, run a broad balance and accessibility playtest, profile on real mobile hardware, optimize snapshot traffic, then add persistence behind a match-result repository and multi-process room coordination if deployment requires it.
