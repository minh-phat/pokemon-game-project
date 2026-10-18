import { test, expect } from '@playwright/test';
import { Client, type Room } from '@colyseus/sdk';
import { DEFAULT_RULES, type LobbySnapshot, type BattleSnapshot } from '@arena/shared-types';
function watch(room: Room) {
  const feed: { lobby: LobbySnapshot | null; battle: BattleSnapshot | null; errors: string[] } = {
    lobby: null,
    battle: null,
    errors: [],
  };
  room.onMessage('lobby', (v: LobbySnapshot) => (feed.lobby = v));
  room.onMessage('battle', (v: BattleSnapshot) => (feed.battle = v));
  room.onMessage('error', (v: string) => feed.errors.push(v));
  room.send('sync');
  return feed;
}
async function pair() {
  const client = new Client('http://localhost:2567');
  const a = await client.create('arena', {
    name: 'Alice',
    rules: { ...DEFAULT_RULES, teamSize: 1, duration: 60 },
  });
  const first = watch(a);
  const b = await client.joinById(a.roomId, { name: 'Bob' });
  const second = watch(b);
  await expect.poll(() => first.lobby?.players.length).toBe(2);
  return { client, a, b, first, second };
}
test('real room transport validates messages, reconnects the same player, and disposes empty rooms', async () => {
  const { client, a, b, first, second } = await pair();
  const code = a.roomId;
  b.send('rules', DEFAULT_RULES);
  await expect.poll(() => second.errors.at(-1)).toMatch(/Only the host/);
  a.send('team', ['mew']);
  await expect.poll(() => first.errors.length).toBe(1);
  a.send('damage', { amount: 999, target: 'b' });
  await expect.poll(() => first.errors.at(-1)).toMatch(/Unsupported/);
  a.send('team', ['pikachu']);
  b.send('team', ['squirtle']);
  a.send('ready', true);
  b.send('ready', true);
  await expect.poll(() => second.battle?.phase).toBe('battle');
  const token = a.reconnectionToken,
    id = a.sessionId;
  a.reconnection.enabled = false;
  a.connection.close(4010);
  await expect.poll(() => second.lobby?.players[0].connected).toBe(false);
  const tick = second.battle!.tick;
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(second.battle!.tick).toBe(tick);
  const rejoined = await client.reconnect(token);
  expect(rejoined.sessionId).toBe(id);
  const resumed = watch(rejoined);
  await expect.poll(() => resumed.lobby?.players[0].connected).toBe(true);
  await expect.poll(() => second.battle!.tick).toBeGreaterThan(tick);
  await b.leave();
  await expect.poll(() => resumed.battle?.result?.reason).toBe('disconnect');
  expect(resumed.battle!.result!.winner).toBe(0);
  await rejoined.leave();
  await expect(async () => {
    await expect(client.joinById(code, { name: 'Late trainer' })).rejects.toThrow();
  }).toPass({ timeout: 5000 });
});
test('expired reconnection grace produces a server-authoritative forfeit', async () => {
  const { a, b, second } = await pair();
  a.send('team', ['bulbasaur']);
  b.send('team', ['charmander']);
  a.send('ready', true);
  b.send('ready', true);
  await expect.poll(() => second.battle?.phase).toBe('battle');
  a.reconnection.enabled = false;
  a.connection.close(4010);
  await expect.poll(() => second.lobby?.players[0].connected).toBe(false);
  await expect.poll(() => second.battle?.result?.reason, { timeout: 36000 }).toBe('disconnect');
  expect(second.battle!.result!.winner).toBe(1);
  await b.leave();
});
test('API publishes configuration, detailed roster, arenas, and temporary identities', async ({
  request,
}) => {
  const cfg = await (await request.get('http://localhost:3001/config')).json();
  expect(cfg.tickRate).toBe(60);
  const detail = await (await request.get('http://localhost:3001/pokemon/bulbasaur')).json();
  expect(detail.skills).toHaveLength(4);
  expect(detail.skills[3].id).toBe('solar-beam');
  expect((await request.get('http://localhost:3001/pokemon/missing')).status()).toBe(404);
  expect(await (await request.get('http://localhost:3001/arenas')).json()).toHaveLength(3);
  const a = await (await request.post('http://localhost:3001/identity')).json(),
    b = await (await request.post('http://localhost:3001/identity')).json();
  expect(a.playerId).not.toBe(b.playerId);
});
