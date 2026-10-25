import {
  DEFAULT_RULES,
  type WorldEncounterTicket,
  type WorldBattleAction,
} from '@arena/shared-types';
import { ARENAS } from '@arena/game-data';
import { terrainHeight, terrainWalkable, terrainReachable } from './terrain';
import { BattleEngine } from './index';

export function createWorldEncounter(ticket: WorldEncounterTicket) {
  if (ticket.combatVersion === 3 && !ticket.arenaDefinition?.surface)
    throw new Error('Missing world battle terrain');
  const engine = new BattleEngine(
    {
      arenaDefinition:
        ticket.combatVersion === 3
          ? ticket.arenaDefinition
          : { ...ARENAS[0], obstacles: undefined },
      rules: {
        ...DEFAULT_RULES,
        teamSize: 1,
        activeSize: 1,
        duration: 120,
        switching: false,
        difficulty: ticket.combatVersion ? 'hard' : 'normal',
      },
      aiTeams: [0, 1],
      players: ['trainer', 'wild'],
      teams: [[ticket.pet.species], [ticket.wild.species]],
      progressions: [[ticket.pet], [ticket.wild]],
      captureTeam: 1,
    },
    ticket.seed,
  );
  engine.startBattle();
  engine.state.fighters[0].x = 450;
  engine.state.fighters[1].x = 650;
  const arena = engine.config.arenaDefinition;
  if (arena) {
    const wild = engine.state.fighters[1];
    for (const f of [...engine.state.fighters].reverse()) {
      // Find a legal spawn on the actual map without clearing props or flattening it.
      const preferred = { x: f.x, depth: f.depth };
      let found = false;
      for (let radius = 0; radius <= 512 && !found; radius += 16) {
        for (let i = 0; i < (radius ? 16 : 1); i++) {
          const p = {
            x: preferred.x + Math.cos((i * Math.PI) / 8) * radius,
            depth: preferred.depth + Math.sin((i * Math.PI) / 8) * radius,
          };
          if (terrainWalkable(arena, p, 4) && (f === wild || terrainReachable(arena, wild, p, 4))) {
            f.x = p.x;
            f.depth = p.depth;
            f.y = f.groundHeight = terrainHeight(arena, p);
            found = true;
            break;
          }
        }
      }
      if (!found) throw new Error('No reachable encounter spawn');
    }
  }
  return engine;
}
export function applyWorldAction(engine: BattleEngine, action: WorldBattleAction) {
  if (action.type === 'mode') return engine.setManualMode('trainer', action.manual);
  return engine.command('trainer', action.command);
}
/** Replay only legal inputs. HP, XP, quality and victory never come from the client. */
export function replayWorldEncounter(
  ticket: WorldEncounterTicket,
  actions: WorldBattleAction[],
  ticks: number,
) {
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 7200 || actions.length > 3600)
    throw new Error('Invalid battle length');
  if (actions.some((a, i) => a.tick >= ticks || (i > 0 && a.tick < actions[i - 1].tick)))
    throw new Error('Invalid action order');
  const engine = createWorldEncounter(ticket);
  let index = 0;
  for (let tick = 0; tick < ticks; tick++) {
    if (engine.state.phase !== 'battle') throw new Error('Battle already ended');
    while (actions[index]?.tick === tick) applyWorldAction(engine, actions[index++]);
    engine.updateBattle(1 / 60);
  }
  if (engine.state.phase !== 'finished') throw new Error('Battle is not finished');
  return engine.state;
}
