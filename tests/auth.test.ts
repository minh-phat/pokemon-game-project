import 'reflect-metadata';
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  AuthController,
  authDatabase,
  credentials,
  hashPassword,
  verifyPassword,
} from '../apps/backend/src/auth';
import type { Request, Response } from 'express';

afterEach(() => vi.restoreAllMocks());
describe('account validation and passwords', () => {
  it('normalizes email and validates registration fields', () => {
    expect(
      credentials({ email: ' Trainer@Example.com ', password: 'secret123', name: ' Ash ' }, true),
    ).toEqual({ email: 'trainer@example.com', password: 'secret123', name: 'Ash' });
    for (const input of [
      null,
      {},
      { email: { $ne: null }, password: 'secret123' },
      { email: 'bad', password: 'secret123' },
      { email: 'a@b.com', password: 'short' },
      { email: 'a@b.com', password: 'secret123', name: 'A' },
    ])
      expect(() => credentials(input, true)).toThrow();
  });
  it('salts hashes and rejects wrong passwords and malformed hashes', async () => {
    const first = await hashPassword('secret123');
    expect(first).not.toBe(await hashPassword('secret123'));
    expect(await verifyPassword('secret123', first)).toBe(true);
    expect(await verifyPassword('wrongpass', first)).toBe(false);
    expect(await verifyPassword('secret123', 'invalid')).toBe(false);
  });
  it('allows anonymous session checks without MongoDB', async () => {
    const db = vi.spyOn(authDatabase, 'db');
    const res = { setHeader: vi.fn() } as unknown as Response;
    expect(await new AuthController().me({ headers: {} } as Request, res)).toEqual({ user: null });
    expect(db).not.toHaveBeenCalled();
  });
  it('rejects forged cross-origin login before database access', async () => {
    const db = vi.spyOn(authDatabase, 'db');
    await expect(
      new AuthController().login(
        {},
        {
          headers: { origin: 'https://evil.example', 'x-arena-request': '1' },
        } as unknown as Request,
        {} as Response,
      ),
    ).rejects.toThrow('Yêu cầu không hợp lệ');
    expect(db).not.toHaveBeenCalled();
  });
  it('rejects expired sessions even before MongoDB TTL cleanup', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    vi.spyOn(authDatabase, 'db').mockResolvedValue({ collection: () => ({ findOne }) } as never);
    const res = { setHeader: vi.fn(), clearCookie: vi.fn() } as unknown as Response;
    expect(
      await new AuthController().me(
        { headers: { cookie: `arena_session=${'a'.repeat(64)}` } } as Request,
        res,
      ),
    ).toEqual({ user: null });
    expect(findOne.mock.calls[0][0].expiresAt.$gt).toBeInstanceOf(Date);
    expect(res.clearCookie).toHaveBeenCalled();
  });
});
