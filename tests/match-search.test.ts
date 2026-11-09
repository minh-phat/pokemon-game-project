import { beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({
  join: vi.fn(),
  handlers: new Map<string, (value?: unknown) => void>(),
  leave: vi.fn(),
}));
vi.mock('@colyseus/sdk', () => ({
  Client: class {
    joinOrCreate = transport.join;
  },
}));
vi.mock('../apps/frontend/src/lib/battle-feed', () => ({ battleFeed: { clear: vi.fn() } }));
import { useGame } from '../apps/frontend/src/lib/store';
import { cancelMatchSearch, findMatch, leaveRoom } from '../apps/frontend/src/lib/network';

beforeEach(() => {
  vi.stubGlobal('sessionStorage', { setItem: vi.fn(), removeItem: vi.fn() });
  leaveRoom();
  transport.handlers.clear();
  transport.join.mockReset().mockResolvedValue({
    sessionId: 'player',
    roomId: 'queue',
    reconnectionToken: 'token',
    reconnection: {},
    send: vi.fn(),
    leave: transport.leave,
    onMessage: (type: string, handler: (value?: unknown) => void) =>
      transport.handlers.set(type, handler),
    onDrop: vi.fn(),
    onReconnect: vi.fn(),
    onLeave: vi.fn(),
    onError: vi.fn(),
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'ticket' }) }),
  );
});

describe('background match search', () => {
  it('stays home, keeps navigation available and opens the lobby when matched', async () => {
    await findMatch('casual', 3);
    expect(useGame.getState().screen).toBe('home');
    expect(useGame.getState().matchSearchStartedAt).toEqual(expect.any(Number));
    useGame.getState().go('codex');
    expect(useGame.getState().matchSearchStartedAt).not.toBeNull();
    transport.handlers.get('lobby')!({
      phase: 'lobby',
      rules: useGame.getState().rules,
      players: [],
    });
    expect(useGame.getState().screen).toBe('match-selection');
    expect(useGame.getState().mode).toBe('online');
    expect(useGame.getState().matchSearchStartedAt).toBeNull();
  });
  it('prevents duplicate searches and cancels without changing the current page', async () => {
    await findMatch('ranked', 6);
    await findMatch('casual', 3);
    expect(transport.join).toHaveBeenCalledTimes(1);
    useGame.getState().go('codex');
    cancelMatchSearch();
    expect(useGame.getState().screen).toBe('codex');
    expect(useGame.getState().matchSearchStartedAt).toBeNull();
    expect(transport.leave).toHaveBeenCalled();
  });
  it('discards a pending search after cancellation', async () => {
    let resolve!: (value: unknown) => void;
    transport.join.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = findMatch('casual', 3);
    await vi.waitFor(() => expect(transport.join).toHaveBeenCalled());
    cancelMatchSearch();
    const leave = vi.fn();
    resolve({ leave });
    await pending;
    expect(leave).toHaveBeenCalled();
    expect(useGame.getState().matchSearchStartedAt).toBeNull();
  });
});
