import { Room, type Client } from '@colyseus/core';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { DEFAULT_RULES, PlayerNameSchema, type OwnedPet } from '@arena/shared-types';
import { BattleSession } from './session';
import { MatchmakingQueue, type MatchMode, type MatchSize } from './matchmaking';
import { MatchSelection } from './match-selection';
import { generateBotTeam } from './bot-team';

interface Identity {
  userId: ObjectId;
  name: string;
  points: number;
  pets: OwnedPet[];
  mode: MatchMode;
  size: MatchSize;
}
interface Fight {
  id: string;
  session: BattleSession;
  users: Map<string, Identity>;
  ranked: boolean;
  saved: boolean;
  saving: boolean;
  retryAt: number;
  selection: MatchSelection | null;
  bot: boolean;
}
let dbPromise: Promise<Db> | undefined;
const activeUsers = new Set<string>();
async function database() {
  if (!process.env.MONGODB_URI) throw new Error('MongoDB is not configured');
  if (!dbPromise) {
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    dbPromise = client
      .connect()
      .then(() => client.db(process.env.MONGODB_DB_NAME || 'pokemon_arena'));
    dbPromise.catch(() => {
      dbPromise = undefined;
      void client.close();
    });
  }
  return dbPromise;
}

/** A shared queue; each fight is simulated independently and messages go only to its players. */
export class MatchRoom extends Room {
  maxClients = 1000;
  maxMessagesPerSecond = 30;
  private queue = new MatchmakingQueue();
  private identities = new Map<string, Identity>();
  private fights = new Map<string, Fight>();
  private steps = 0;
  private accumulator = 0;
  async onAuth(_client: Client, options: Record<string, unknown>) {
    if (
      typeof options.token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(options.token) ||
      (options.mode !== 'casual' && options.mode !== 'ranked') ||
      (options.size !== 3 && options.size !== 6)
    )
      throw new Error('Invalid matchmaking request');
    const db = await database();
    const ticket = await db
      .collection<{ tokenHash: string; userId: ObjectId; expiresAt: Date }>('matchTickets')
      .findOneAndDelete({
        tokenHash: createHash('sha256').update(options.token).digest('hex'),
        expiresAt: { $gt: new Date() },
      });
    if (!ticket) throw new Error('Match ticket expired');
    const user = await db
      .collection<{ _id: ObjectId; name: string; rankPoints?: number }>('users')
      .findOne({ _id: ticket.userId });
    if (!user) throw new Error('Account not found');
    const documents = await db
      .collection<{
        _id: string;
        ownerId: ObjectId;
        species: OwnedPet['species'];
        quality: OwnedPet['quality'];
        level: number;
        experience?: number;
        createdAt: Date;
      }>('pets')
      .find({ ownerId: user._id })
      .toArray();
    const pets: OwnedPet[] = documents.map((p) => ({
      id: p._id,
      species: p.species,
      quality: p.quality,
      level: p.level,
      experience: p.experience ?? 0,
      acquiredAt: p.createdAt.toISOString(),
    }));
    if (pets.length < options.size)
      throw new Error(`Bạn cần ít nhất ${options.size} thú triệu hồi.`);
    return {
      userId: user._id,
      name: PlayerNameSchema.safeParse(user.name).success ? user.name : 'Trainer',
      points: user.rankPoints ?? 0,
      pets,
      mode: options.mode,
      size: options.size,
    } satisfies Identity;
  }
  onCreate() {
    this.onMessage('match-select', (client, value) => this.choose(client, value, false));
    this.onMessage('match-ready', (client) => this.choose(client, null, true));
    this.onMessage('battle-command', (client, value) =>
      this.operation(client, (s) => {
        if (s.allowMovement(client.sessionId)) s.command(client.sessionId, value);
      }),
    );
    this.onMessage('manual-mode', (client, value) =>
      this.operation(client, (s) => s.manualMode(client.sessionId, value)),
    );
    this.onMessage('select-fighter', (client, value) =>
      this.operation(client, (s) => s.selectFighter(client.sessionId, value)),
    );
    this.onMessage('sync', (client) => {
      const fight = this.fights.get(client.sessionId);
      if (fight) this.publish(fight, true);
    });
    this.setSimulationInterval((ms) => {
      for (const match of this.queue.poll(Date.now())) {
        const [a, b] = match.players;
        const one = this.identities.get(a.playerId);
        const two = b && this.identities.get(b.playerId);
        if (!one || (b && !two)) continue;
        const session = new BattleSession(
          randomUUID(),
          {
            ...DEFAULT_RULES,
            teamSize: a.size,
            activeSize: 1,
            arena: match.arena,
            duplicates: true,
          },
          randomInt(1, 2147483647),
        );
        const botId = `bot-${randomUUID()}`;
        session.prepareMatched(
          [
            { id: a.playerId, name: one.name },
            { id: b?.playerId ?? botId, name: two?.name ?? 'Máy luyện tập' },
          ],
          !b,
        );
        const selection = new MatchSelection(
          a.size,
          [
            { id: a.playerId, pets: one.pets },
            { id: b?.playerId ?? botId, pets: two?.pets ?? a.pets, bot: !b },
          ],
          Date.now(),
        );
        const users = new Map([
          [a.playerId, one],
          ...(b && two ? [[b.playerId, two] as [string, Identity]] : []),
        ]);
        const fight: Fight = {
          id: randomUUID(),
          session,
          users,
          ranked: a.mode === 'ranked',
          saved: false,
          saving: false,
          retryAt: 0,
          selection,
          bot: !b,
        };
        for (const id of users.keys()) this.fights.set(id, fight);
        this.publish(fight, true);
      }
      this.accumulator += Math.min(ms / 1000, 0.25);
      while (this.accumulator >= 1 / 60) {
        this.accumulator -= 1 / 60;
        for (const fight of new Set(this.fights.values())) {
          const was = fight.session.lobby.phase;
          if (
            fight.selection?.complete(Date.now()) &&
            fight.session.lobby.players.every((p) => p.connected)
          )
            this.finishSelection(fight);
          fight.session.tick(1 / 60);
          if (fight.session.lobby.phase === 'finished') void this.saveResult(fight);
          if (this.steps % 3 === 0 || was !== fight.session.lobby.phase) this.publish(fight);
        }
        this.steps++;
      }
    }, 1000 / 60);
  }
  onJoin(client: Client, _options: unknown, identity: Identity) {
    const id = identity.userId.toHexString();
    if (activeUsers.has(id)) throw new Error('Bạn đang tìm hoặc đang trong một trận khác.');
    this.queue.enqueue({
      playerId: client.sessionId,
      mode: identity.mode,
      size: identity.size,
      points: identity.points,
      pets: identity.pets,
      startedAt: Date.now(),
    });
    activeUsers.add(id);
    this.identities.set(client.sessionId, identity);
  }
  async onDrop(client: Client) {
    const fight = this.fights.get(client.sessionId);
    if (!fight) {
      this.remove(client);
      return;
    }
    fight.session.disconnected(client.sessionId);
    this.publish(fight);
    try {
      await this.allowReconnection(client, 30);
    } catch {
      this.remove(client);
    }
  }
  onReconnect(client: Client) {
    const fight = this.fights.get(client.sessionId);
    if (fight) {
      fight.session.reconnected(client.sessionId);
      this.publish(fight, true);
    }
  }
  onLeave(client: Client) {
    this.remove(client);
  }
  private remove(client: Client) {
    this.queue.cancel(client.sessionId);
    const fight = this.fights.get(client.sessionId);
    if (fight) {
      if (fight.selection) {
        const connections = fight.session.lobby.players.map((player) => player.connected);
        for (const player of fight.session.lobby.players) player.connected = true;
        this.finishSelection(fight);
        fight.session.lobby.players.forEach((player, index) => {
          player.connected = connections[index];
        });
      }
      if (fight.session.lobby.phase === 'countdown') {
        const connections = fight.session.lobby.players.map((player) => player.connected);
        for (const player of fight.session.lobby.players) player.connected = true;
        fight.session.lobby.countdown = 0;
        fight.session.tick(0);
        fight.session.lobby.players.forEach((player, index) => {
          player.connected = connections[index];
        });
      }
      fight.session.leave(client.sessionId);
      if (fight.session.lobby.phase === 'finished') void this.saveResult(fight);
      this.publish(fight);
      this.fights.delete(client.sessionId);
    }
    const identity = this.identities.get(client.sessionId);
    if (identity && (!fight || !fight.ranked || fight.saved))
      activeUsers.delete(identity.userId.toHexString());
    this.identities.delete(client.sessionId);
  }
  private operation(client: Client, action: (s: BattleSession) => void) {
    try {
      const fight = this.fights.get(client.sessionId);
      if (!fight) throw new Error('Match not ready');
      action(fight.session);
    } catch (error) {
      client.send('error', error instanceof Error ? error.message : 'Invalid operation');
    }
  }
  private finishSelection(fight: Fight) {
    if (!fight.selection) return;
    const teams = fight.selection.teams();
    if (fight.bot) teams[1] = generateBotTeam(teams[0]);
    fight.session.startPreparedMatched(teams);
    fight.selection = null;
  }
  private choose(client: Client, value: unknown, ready: boolean) {
    try {
      const fight = this.fights.get(client.sessionId);
      if (!fight?.selection) throw new Error('Đã kết thúc chọn đội hình.');
      fight.session.rateLimit(client.sessionId);
      if (ready) fight.selection.ready(client.sessionId, Date.now());
      else fight.selection.select(client.sessionId, value, Date.now());
      this.publish(fight, true);
    } catch (error) {
      client.send('error', error instanceof Error ? error.message : 'Đội hình không hợp lệ.');
    }
  }
  private publish(fight: Fight, includeSelection = false) {
    for (const client of this.clients)
      if (fight.users.has(client.sessionId)) {
        client.send('lobby', fight.session.snapshot());
        if (includeSelection && fight.selection)
          client.send('match-selection', fight.selection.snapshot(client.sessionId));
        if (fight.session.engine) client.send('battle', fight.session.engine.getBattleSnapshot());
      }
  }
  private async saveResult(fight: Fight) {
    if (
      !fight.ranked ||
      fight.saved ||
      fight.saving ||
      Date.now() < fight.retryAt ||
      !fight.session.engine?.state.result
    )
      return;
    fight.saving = true;
    try {
      const db = await database();
      const winner = fight.session.engine.state.result.winner;
      for (const [id, user] of fight.users) {
        const team = fight.session.lobby.players.findIndex((p) => p.id === id);
        const delta = winner === 'draw' ? 0 : winner === team ? 25 : -15;
        await db
          .collection('users')
          .updateOne({ _id: user.userId, appliedRankMatches: { $ne: fight.id } } as never, [
            {
              $set: {
                rankPoints: { $max: [0, { $add: [{ $ifNull: ['$rankPoints', 0] }, delta] }] },
                appliedRankMatches: {
                  $concatArrays: [{ $ifNull: ['$appliedRankMatches', []] }, [fight.id]],
                },
              },
            },
          ]);
      }
      fight.saved = true;
      for (const [id, user] of fight.users) {
        if (!this.identities.has(id)) activeUsers.delete(user.userId.toHexString());
      }
    } catch (error) {
      console.error('Unable to save ranked result', error);
      fight.retryAt = Date.now() + 5000;
      const retry = setTimeout(() => void this.saveResult(fight), 5000);
      retry.unref();
    } finally {
      fight.saving = false;
    }
  }
}
