import { Server, Room, type Client } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import express from 'express';
import { DEFAULT_RULES, JoinSchema } from '@arena/shared-types';
import { BattleSession } from './session';

class ArenaRoom extends Room {
  maxClients = 2;
  maxMessagesPerSecond = 30;
  session!: BattleSession;
  private steps = 0;
  private accumulator = 0;
  onCreate(options: Record<string, unknown>) {
    this.session = new BattleSession(
      this.roomId,
      options.rules ?? DEFAULT_RULES,
      randomInt(1, 2147483647),
    );
    this.setPrivate(true);
    const operation = (type: string, fn: (client: Client, value: unknown) => void) =>
      this.onMessage(type, (client, value: unknown) => {
        try {
          this.session.rateLimit(client.sessionId);
          fn(client, value);
          this.publish();
        } catch (error) {
          client.send('error', error instanceof Error ? error.message : 'Invalid operation');
        }
      });
    operation('rules', (c, v) => this.session.rules(c.sessionId, v));
    operation('team', (c, v) => this.session.select(c.sessionId, v));
    operation('ready', (c, v) => this.session.ready(c.sessionId, v));
    operation('manual-mode', (c, v) => this.session.manualMode(c.sessionId, v));
    operation('battle-command', (c, v) => this.session.command(c.sessionId, v));
    operation('rematch', (c, v) => {
      if (v !== true) throw new Error('Invalid rematch request');
      this.session.rematch(c.sessionId);
    });
    operation('sync', () => {});
    this.onMessage('*', (c) => c.send('error', 'Unsupported room message'));
    this.setSimulationInterval((deltaMs) => {
      this.accumulator += Math.min(deltaMs / 1000, 0.25);
      let publish = false;
      while (this.accumulator >= 1 / 60) {
        this.accumulator -= 1 / 60;
        this.session.tick(1 / 60);
        if (++this.steps % 3 === 0) publish = true;
      }
      if (publish) this.publish();
    }, 1000 / 60);
    this.clock.setInterval(() => {
      if (this.session.expired()) void this.disconnect();
    }, 30000);
    // A hard lifetime bounds memory even if a client sends periodic keepalives.
    this.clock.setTimeout(() => void this.disconnect(), 2 * 60 * 60 * 1000);
  }
  onJoin(client: Client, options: unknown) {
    const parsed = JoinSchema.parse(options);
    this.session.join(client.sessionId, parsed.name);
    this.publish();
  }
  async onDrop(client: Client) {
    this.session.disconnected(client.sessionId);
    this.publish();
    try {
      await this.allowReconnection(client, 30);
    } catch {
      this.session.leave(client.sessionId);
      this.publish();
    }
  }
  onReconnect(client: Client) {
    this.session.reconnected(client.sessionId);
    this.publish();
  }
  onLeave(client: Client) {
    this.session.leave(client.sessionId);
    this.publish();
  }
  private publish() {
    this.broadcast('lobby', this.session.snapshot());
    if (this.session.engine) this.broadcast('battle', this.session.engine.getBattleSnapshot());
  }
}
const app = express();
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'arena-rooms' }));
const buckets = new Map<string, { count: number; expires: number }>();
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const ip = req.ip ?? 'local',
    now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || bucket.expires < now) {
    bucket = { count: 0, expires: now + 60000 };
    buckets.set(ip, bucket);
  }
  if (++bucket.count > 30)
    return res.status(429).json({ error: 'Too many room requests; retry in a minute.' });
  next();
});
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.expires < now) buckets.delete(key);
}, 60000);
cleanup.unref();
const httpServer = createServer(app);
const origins = (
  process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000'
).split(',');
const server = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    verifyClient: (info, done) =>
      done(!info.origin || origins.includes(info.origin), 403, 'Origin not allowed'),
  }),
  greet: false,
});
server.define('arena', ArenaRoom);
await server.listen(Number(process.env.GAME_PORT ?? 2567), '0.0.0.0');
console.log('Authoritative game rooms ready at ws://localhost:2567');
