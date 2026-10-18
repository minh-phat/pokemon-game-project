# Verification record

Local verification performed on October 18, 2026, on macOS arm64 with Node v24.12.0.

## Automated coverage

- Vitest: **70 passing tests** across combat, room policy, and asset manifests.
- Browser flows: complete VS AI match through ordinary UI interactions, pause/resume, results and replay navigation; complete online match using two isolated browser contexts, synchronized results, rematch voting; mobile-width navigation, all four roster cards, arena navigation, and settings keyboard dismissal.
- Real transport checks: invalid team rejection, host-only rule validation, unsupported damage-message rejection, same-session reconnect, pause during disconnect, explicit-departure forfeit, room disposal after both clients leave, and actual 30-second grace expiry.
- API checks: health, configuration, roster, individual detail, unknown detail 404, arenas, distinct temporary identity UUIDs.
- Engine tests include all 16 skills, all 16 unlimited 1v1 pairings, 4v4, physical damage and elemental modifiers, guard, collision geometry, projectile invulnerability, jump/landing, boundary/body separation, energy/cooldowns, stun interruption, Leech Seed recovery, faint/replacement, strategic switching, threat prediction, role-specific decisions, deterministic replay/reset, timer and elimination results.

The initial browser suite passed three tests in 2.3 minutes. Additional transport/API tests passed three tests in 46.2 seconds, including the real grace-period wait. The final combined production-mode suite passed all six tests in 1.8 minutes. Full-match tests do not rewrite battle state, shorten match timers below supported values, or advance a hidden debug clock.

## Measured performance

The final headless benchmark ran 20 seeded 4v4 matches, totaling 31,652 simulated ticks in 89.45 ms: **2.83 microseconds per tick** on this host. Average serialized final JSON snapshot size was 18,569 bytes. This measurement excludes Phaser, browser rendering, network I/O, serialization during every tick, and application load.

The renderer requests 60 FPS; this is a target, not a measured cross-device guarantee. The server simulates at 60 Hz and sends snapshots at 20 Hz; HTML HUD updates are capped at 10 Hz. Online movement interpolates over a 50 ms snapshot interval. Actual internet latency, client GPU frame times, multi-room load, and real mobile performance have not been benchmarked.

## Visual review

Desktop home, selection, lobby, active battle, and results screenshots were captured. A 390 × 844 viewport was checked for horizontal overflow, including the battle HUD. Review found a compressed mobile arena-thumbnail strip; it was corrected. The custom creatures render as coherent vector cartoons and actual frame sprites; they remain prototype art. No runtime page errors occurred in the successful browser flows.

Production testing also exposed a result-dialog selector mismatch after adding focus management, invitation-link reload handling, and software-WebGL stalls under two-browser tracing. The selector and reload path were corrected. This sprite/path scene now uses Phaser's Canvas renderer; it does not require WebGL. These observations do not establish performance on every hardware/browser combination.

## Final pass

| Check                               | Result                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `npm run build`                     | Passed: both Node service bundles, Next production build, all TypeScript checks |
| `npm test`                          | Passed: 70 tests in 3 files                                                     |
| `E2E_PRODUCTION=1 npm run test:e2e` | Passed: 6 tests in 1.8 minutes                                                  |
| `npm run format:check`              | Passed                                                                          |
| `npm run verify:assets`             | Passed: all 32 assets and 4 sprite sheets                                       |
| `npm run benchmark`                 | Passed: final figures above                                                     |

The final browser pass included host **and guest invitation-URL reloads**, two-client results and rematch, the mobile battle view, normal UI selection through full results, actual WebSocket reconnection, and actual 30-second grace expiry. Both full-match browser tests reported no page runtime errors. Playwright shut down its owned local servers after the suite.

No public site was deployed. `npm run dev` and `npm start` are the documented local entry points. The build and browser results verify the current local implementation, not production traffic capacity or third-party art licensing.
