'use client';
import { Client, type Room } from '@colyseus/sdk';
import {
  RoomCodeSchema,
  type BattleSnapshot,
  type LobbySnapshot,
  type ManualBattleCommand,
} from '@arena/shared-types';
import { useGame } from './store';
import { battleFeed } from './battle-feed';
let room: Room | null = null;
let client: Client | null = null;
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
  joined.onMessage('error', (error: string) => useGame.getState().set({ error }));
  joined.onDrop(() =>
    useGame.getState().set({
      connection: 'reconnecting',
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
  state.set({ connection: 'connecting', error: '' });
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
export async function restoreRoom() {
  const token = sessionStorage.getItem('arena-reconnect');
  if (!token) return;
  useGame.getState().set({ connection: 'reconnecting', mode: 'online', screen: 'lobby' });
  try {
    attach(await getClient().reconnect(token));
  } catch {
    sessionStorage.removeItem('arena-reconnect');
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
export function sendManualMode(enabled: boolean) {
  room?.send('manual-mode', enabled);
}
export function sendBattleCommand(command: ManualBattleCommand) {
  room?.send('battle-command', command);
}
export function leaveRoom() {
  const previous = room;
  room = null;
  void previous?.leave();
  sessionStorage.removeItem('arena-reconnect');
  battleFeed.clear();
  useGame.getState().set({
    lobby: null,
    connection: 'offline',
    sessionId: '',
    error: '',
    notice: '',
    screen: 'home',
    team: [],
  });
}
