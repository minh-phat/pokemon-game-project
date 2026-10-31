'use client';
import { Client, type Room } from '@colyseus/sdk';
import {
  RoomCodeSchema,
  type BattleSnapshot,
  type LobbySnapshot,
  type ManualBattleCommand,
  type MatchSelectionSnapshot,
} from '@arena/shared-types';
import { useGame } from './store';
import { battleFeed } from './battle-feed';
let room: Room | null = null;
let client: Client | null = null;
let searchGeneration = 0;
const getClient = () =>
  (client ??= new Client(process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? 'http://localhost:2567'));
function attach(joined: Room) {
  room = joined;
  room.reconnection.minUptime = 0;
  sessionStorage.setItem('arena-reconnect', joined.reconnectionToken);
  const refresh = () => {
    sessionStorage.setItem('arena-reconnect', joined.reconnectionToken);
    useGame.getState().set({ connection: 'connected', notice: '', error: '' });
    joined.send('sync');
  };
  useGame.getState().set({
    sessionId: joined.sessionId,
    connection: 'connected',
    screen: 'lobby',
    error: '',
    roomCode: joined.roomId,
    mode: 'online',
  });
  let lastLobby = '';
  joined.onMessage('lobby', (lobby: LobbySnapshot) => {
    const signature = JSON.stringify(lobby);
    if (signature === lastLobby) return;
    lastLobby = signature;
    const current = useGame.getState();
    const phaseChanged = current.lobby?.phase !== lobby.phase;
    const rulesChanged =
      current.lobby && JSON.stringify(current.lobby.rules) !== JSON.stringify(lobby.rules);
    const me = lobby.players.find((p) => p.id === joined.sessionId);
    current.set({
      lobby,
      rules: lobby.rules,
      ...(rulesChanged
        ? { team: [], notice: 'The host updated the rules. Choose your team again.' }
        : {}),
      ...(phaseChanged && lobby.phase === 'lobby' ? { screen: 'lobby', team: me?.team ?? [] } : {}),
      ...(lobby.phase === 'countdown' || lobby.phase === 'battle' || lobby.phase === 'finished'
        ? { screen: 'battle' }
        : {}),
    });
    if (phaseChanged && lobby.phase === 'lobby') battleFeed.clear();
  });
  joined.onMessage('battle', (snapshot: BattleSnapshot) => battleFeed.push(snapshot));
  joined.onMessage('match-selection', (selection: MatchSelectionSnapshot) => {
    const current = useGame.getState().matchSelection;
    useGame.getState().set({
      matchSelection: {
        ...selection,
        ...(current && current.revision > selection.revision
          ? { selected: current.selected, revision: current.revision }
          : {}),
        deadline: Date.now() + Math.max(0, selection.deadline - selection.serverNow),
      },
    });
  });
  joined.onMessage('error', (error: string) => useGame.getState().set({ error }));
  joined.onDrop(() =>
    useGame.getState().set({
      connection: 'reconnecting',
      matchSelection: null,
      notice: 'Connection lost. Reconnecting for up to 30 seconds…',
    }),
  );
  joined.onReconnect(refresh);
  joined.onLeave(() => {
    if (room === joined) {
      room = null;
      sessionStorage.removeItem('arena-reconnect');
      useGame.getState().set({
        connection: 'lost',
        error: 'This room is no longer available. Return home to start a new match.',
      });
    }
  });
  joined.onError((_code, message) =>
    useGame.getState().set({ error: message ?? 'Room connection error' }),
  );
  joined.send('sync');
  return joined;
}
export async function connectRoom(kind: 'create' | 'join') {
  const state = useGame.getState();
  sessionStorage.removeItem('arena-matchmade');
  state.set({ connection: 'connecting', error: '', matchmade: false });
  try {
    const joined =
      kind === 'create'
        ? await getClient().create('arena', { name: state.name, rules: state.rules })
        : await getClient().joinById(RoomCodeSchema.parse(state.roomCode.trim()), {
            name: state.name,
          });
    attach(joined);
    if (kind === 'create' && state.team.length === state.rules.teamSize)
      joined.send('team', state.team);
  } catch (error) {
    state.set({
      connection: 'offline',
      error:
        error instanceof Error
          ? error.message
          : 'Unable to connect. Make sure the game server is running.',
    });
  }
}
export async function findMatch(mode: 'casual' | 'ranked', size: 3 | 6 | 'all') {
  const generation = ++searchGeneration;
  useGame.getState().set({
    connection: 'connecting',
    error: '',
    lobby: null,
    matchSelection: null,
    mode: 'online',
    matchmade: true,
    screen: 'lobby',
  });
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/match-ticket`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Arena-Request': '1' },
        signal: AbortSignal.timeout(12000),
      },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Không thể bắt đầu tìm trận.');
    if (generation !== searchGeneration) return;
    const joined = await getClient().joinOrCreate('matchmaking', { token: data.token, mode, size });
    if (generation !== searchGeneration) {
      void joined.leave();
      return;
    }
    sessionStorage.setItem('arena-matchmade', '1');
    attach(joined);
  } catch (error) {
    if (generation !== searchGeneration) return;
    useGame.getState().set({
      connection: 'lost',
      error: error instanceof Error ? error.message : 'Không thể tìm trận.',
    });
  }
}
export async function restoreRoom() {
  const token = sessionStorage.getItem('arena-reconnect');
  if (!token) return;
  useGame.getState().set({
    connection: 'reconnecting',
    mode: 'online',
    screen: 'lobby',
    matchmade: sessionStorage.getItem('arena-matchmade') === '1',
  });
  try {
    attach(await getClient().reconnect(token));
  } catch {
    sessionStorage.removeItem('arena-reconnect');
    sessionStorage.removeItem('arena-matchmade');
    useGame.getState().set({
      connection: 'lost',
      error: 'The reconnection window expired. Please create or join a new room.',
    });
  }
}
export function sendRoom(type: 'rules' | 'team' | 'ready' | 'rematch', value: unknown) {
  if (room) room.send(type, value);
  else useGame.getState().set({ error: 'No active room. Create or join a room first.' });
}
export function selectMatchPets(ids: string[]) {
  room?.send('match-select', ids);
}
export function readyMatchPets() {
  room?.send('match-ready');
}
export function sendManualMode(enabled: boolean) {
  room?.send('manual-mode', enabled);
}
export function selectManualFighter(fighterId: string) {
  const game = useGame.getState();
  const team =
    game.mode === 'online'
      ? (game.lobby?.players.findIndex((p) => p.id === game.sessionId) ?? -1)
      : 0;
  const fighter = battleFeed.latest?.fighters.find((f) => f.id === fighterId);
  if (!fighter || fighter.team !== team || !fighter.active || fighter.hp <= 0) return;
  if (game.mode === 'online') {
    if (!room) return;
    room.send('select-fighter', fighterId);
  } else if (!battleFeed.engine?.selectControlledFighter('you', fighterId)) return;
  game.set({ selectedFighterId: fighterId });
}
export function sendBattleCommand(command: ManualBattleCommand) {
  room?.send('battle-command', command);
}
export function leaveRoom() {
  searchGeneration++;
  const previous = room;
  room = null;
  void previous?.leave();
  sessionStorage.removeItem('arena-reconnect');
  sessionStorage.removeItem('arena-matchmade');
  battleFeed.clear();
  useGame.getState().set({
    lobby: null,
    connection: 'offline',
    sessionId: '',
    error: '',
    notice: '',
    screen: 'home',
    team: [],
    matchmade: false,
    matchSelection: null,
  });
}
