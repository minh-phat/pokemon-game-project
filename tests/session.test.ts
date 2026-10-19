import { describe, expect, it } from 'vitest';
import { BattleSession } from '../apps/game-server/src/session';
import { DEFAULT_RULES } from '@arena/shared-types';
const readySession = () => {
  const s = new BattleSession('abcdef', { ...DEFAULT_RULES, teamSize: 1, duration: 60 }, 7);
  s.join('a', 'Alice');
  s.join('b', 'Bob');
  s.select('a', ['pikachu']);
  s.select('b', ['squirtle']);
  s.ready('a', true);
  s.ready('b', true);
  return s;
};
describe('authoritative room policy', () => {
  it('allows two players and validates identities', () => {
    const s = new BattleSession('abcdef');
    expect(() => s.join('x', '<script>')).toThrow();
    s.join('a', 'Alice');
    s.join('b', 'Bob');
    expect(() => s.join('c', 'Eve')).toThrow();
    expect(s.lobby.hostId).toBe('a');
  });
  it('only lets the host change valid rules while in lobby', () => {
    const s = new BattleSession('abcdef');
    s.join('a', 'Alice');
    s.join('b', 'Bob');
    expect(() => s.rules('b', DEFAULT_RULES)).toThrow(/host/);
    expect(() => s.rules('a', { ...DEFAULT_RULES, activeSize: 4 })).toThrow();
    s.rules('a', { ...DEFAULT_RULES, duration: 60 });
    expect(s.lobby.rules.duration).toBe(60);
  });
  it('requires complete teams and explicit boolean ready messages', () => {
    const s = new BattleSession('abcdef');
    s.join('a', 'Alice');
    expect(() => s.ready('a', true)).toThrow();
    expect(() => s.ready('a', 'true')).toThrow();
    expect(() => s.select('a', ['pikachu', 'pikachu'])).toThrow();
    expect(() => s.select('unknown', ['pikachu', 'squirtle'])).toThrow();
  });
  it('clears readiness and teams when the host changes rules', () => {
    const s = new BattleSession('abcdef');
    s.join('a', 'Alice');
    s.select('a', ['pikachu', 'squirtle']);
    s.ready('a', true);
    s.rules('a', { ...DEFAULT_RULES, teamSize: 1 });
    expect(s.lobby.players[0]).toMatchObject({ ready: false, team: [] });
  });
  it('starts after countdown and refuses late rule or team changes', () => {
    const s = readySession();
    expect(s.lobby.phase).toBe('countdown');
    expect(() => s.rules('a', DEFAULT_RULES)).toThrow();
    expect(() => s.select('b', ['pikachu'])).toThrow();
    for (let i = 0; i < 182; i++) s.tick(1 / 60);
    expect(s.lobby.phase).toBe('battle');
    expect(s.engine?.state.fighters).toHaveLength(2);
  });
  it('freezes during a disconnect and resumes the same state on reconnect', () => {
    const s = readySession();
    for (let i = 0; i < 200; i++) s.tick(1 / 60);
    const tick = s.engine!.state.tick;
    s.disconnected('a');
    for (let i = 0; i < 180; i++) s.tick(1 / 60);
    expect(s.engine!.state.tick).toBe(tick);
    s.reconnected('a');
    s.tick(1 / 60);
    expect(s.engine!.state.tick).toBe(tick + 1);
  });
  it('forfeits a departed fighter after the grace period callback', () => {
    const s = readySession();
    for (let i = 0; i < 200; i++) s.tick(1 / 60);
    s.disconnected('a');
    s.leave('a');
    expect(s.engine!.state.result).toMatchObject({ winner: 1, reason: 'disconnect' });
    expect(s.lobby.phase).toBe('finished');
  });
  it('transfers lobby ownership and clears a departed ready check', () => {
    const s = readySession();
    s.leave('a');
    expect(s.lobby).toMatchObject({ phase: 'lobby', hostId: 'b' });
    expect(s.lobby.players[0].ready).toBe(false);
  });
  it('requires both rematch votes and resets the match', () => {
    const s = readySession();
    for (let i = 0; i < 65 * 60; i++) s.tick(1 / 60);
    expect(s.lobby.phase).toBe('finished');
    s.rematch('a');
    expect(s.lobby.phase).toBe('finished');
    s.rematch('b');
    expect(s.lobby.phase).toBe('lobby');
    expect(s.engine).toBeNull();
    expect(s.lobby.players.every((p) => !p.ready && !p.rematch)).toBe(true);
  });
  it('rate limits messages, replenishes budgets, and expires inactive rooms', () => {
    const s = new BattleSession('abcdef');
    for (let i = 0; i < 20; i++) s.rateLimit('a', 1000);
    expect(() => s.rateLimit('a', 1000)).toThrow(/Too many/);
    expect(() => s.rateLimit('a', 2000)).not.toThrow();
    for (let i = 0; i < 40; i++) expect(s.allowMovement('a', 1000 + i * 100)).toBe(true);
    expect(() => s.rateLimit('a', 2000)).not.toThrow();
    for (let i = 0; i < 30; i++) s.allowMovement('b', 1000);
    expect(s.allowMovement('b', 1000)).toBe(false);
    s.lastActivity = 1000;
    expect(s.expired(600999)).toBe(false);
    expect(s.expired(601001)).toBe(true);
  });
});
