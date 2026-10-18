# Implementation plan

The repository was empty at inspection. Build a local npm-workspace application using Node 22.12 or newer. No hosted deployment or database is required.

1. Establish workspaces, typed contracts, menu shell, and validation.
2. Add reusable vector art, frame animations, and three layered arenas.
3. Implement fixed-step movement, collision, event-timed skills, AI, and complete offline battles.
4. Add a Nest API and Colyseus authoritative rooms with lobby validation, ready checks, countdown, reconnect, and rematch.
5. Verify engine rules, room lifecycle, and complete browser matches; document measured results and limitations.

Each slice is checked with type checks, targeted tests, and production builds as it becomes runnable. Shared data contains all balance values. The engine depends only on data, AI, and contracts; persistence adapters never enter the simulation.

## Completion

All five implementation slices are complete. Final verification: 70 Vitest checks, six production-mode Playwright flows, type checks, all three application builds, formatting, and 32 local assets passed. The renderer uses Phaser Canvas following observed software-WebGL stalls during browser testing. Remaining art, balance, device coverage, and deployment limitations are documented in the README and verification record.
