import {
  DEFAULT_RULES,
  type WorldEncounterTicket,
  type WorldBattleAction,
} from '@arena/shared-types';
import { ARENAS } from '@arena/game-data';
import { terrainHeight, terrainWalkable, terrainReachable } from './terrain';
import { BattleEngine } from './index';

export function createWorldEncounter(ticket: WorldEncounterTicket) {
  const pets = ticket.pets ?? [ticket.pet];
  const wilds = ticket.wilds ?? [ticket.wild];
  const squads = ticket.combatVersion === 4 || ticket.combatVersion === 5;
  const terrain = ticket.combatVersion === 3 || squads;
  if (terrain && !ticket.arenaDefinition?.surface) throw new Error('Missing world battle terrain');
  if (ticket.combatVersion === 5 && !ticket.arenaDefinition?.worldTerrain)
    throw new Error('Missing roaming world terrain');
  const engine = new BattleEngine(
    {
      worldEncounter: squads,
      arenaDefinition: terrain ? ticket.arenaDefinition : { ...ARENAS[0], obstacles: undefined },
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
      teams: [pets.map((p) => p.species), wilds.map((p) => p.species)],
      progressions: [pets, wilds],
      captureTeam: 1,
    },
    ticket.seed,
  );
  engine.startBattle();
  for (const f of engine.state.fighters) {
    f.x = f.team === 0 ? 450 : 650;
    if (squads) f.depth = ((f.slot % 7) - 3) * 24;
  }
  const arena = engine.config.arenaDefinition;
  if (arena) {
    const wild = engine.state.fighters.find((f) => f.team === 1)!;
    const ordered = squads
      ? [wild, ...engine.state.fighters.filter((f) => f !== wild)]
      : [...engine.state.fighters].reverse();
    for (const f of ordered) {
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
  if (action.type === 'control') return engine.selectControlledFighter('trainer', action.fighterId);
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
