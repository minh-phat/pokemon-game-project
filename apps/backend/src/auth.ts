import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ServiceUnavailableException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { MongoClient, MongoServerError, ObjectId } from 'mongodb';
import type { Request, Response } from 'express';

import type { SummonResult } from '@arena/shared-types';
import { startWorldBattle, finishWorldBattle, withWorldLock } from './world';
import {
  createPetIndexes,
  migrateLegacyPets,
  loadPetCollection,
  summonPet,
  type PetOwner,
} from './pets';

const scrypt = promisify(scryptCallback);
const COOKIE = 'arena_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
interface User extends PetOwner {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
}
interface Session {
  tokenHash: string;
  userId: ObjectId;
  expiresAt: Date;
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex || !/^[a-f0-9]{128}$/.test(hex)) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(key, Buffer.from(hex, 'hex'));
}
export function credentials(body: unknown, registering = false) {
  const input = body as Record<string, unknown> | null;
  if (!input || typeof input.email !== 'string' || typeof input.password !== 'string')
    throw new BadRequestException('Vui lòng nhập email và mật khẩu.');
  const email = input.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new BadRequestException('Email không hợp lệ.');
  if (input.password.length < 8 || input.password.length > 128)
    throw new BadRequestException('Mật khẩu phải có từ 8 đến 128 ký tự.');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (registering && (name.length < 2 || name.length > 30))
    throw new BadRequestException('Tên huấn luyện viên phải có từ 2 đến 30 ký tự.');
  return { email, password: input.password, name };
}
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const publicUser = (user: User) => ({
  id: user._id.toHexString(),
  email: user.email,
  name: user.name,
});
export class AuthDatabase {
  private client?: MongoClient;
  private pending?: Promise<ReturnType<MongoClient['db']>>;
  async db() {
    if (!process.env.MONGODB_URI)
      throw new ServiceUnavailableException('Chức năng tài khoản chưa được cấu hình MongoDB.');
    if (!this.pending) {
      const client = (this.client = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      }));
      this.pending = (async () => {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'pokemon_arena');
        await createPetIndexes(db);
        await db.collection('worldEncounters').createIndex({ ownerId: 1, status: 1 });
        await db.collection<User>('users').createIndex({ email: 1 }, { unique: true });
        await db.collection<Session>('sessions').createIndex({ tokenHash: 1 }, { unique: true });
        await db
          .collection<Session>('sessions')
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        return db;
      })();
    }
    try {
      return await this.pending;
    } catch {
      this.pending = undefined;
      await this.client?.close();
      throw new ServiceUnavailableException('Không thể kết nối MongoDB. Vui lòng thử lại sau.');
    }
  }
  async onApplicationShutdown() {
    await this.client?.close();
  }
}
export const authDatabase = new AuthDatabase();

@Controller('auth')
export class AuthController {
  private checkOrigin(req: Request) {
    const allowed = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000')
      .split(',')
      .map((value) => value.trim());
    if (
      req.headers['x-arena-request'] !== '1' ||
      (req.headers.origin && !allowed.includes(req.headers.origin))
    )
      throw new ForbiddenException('Yêu cầu không hợp lệ.');
  }
  private token(req: Request) {
    const value = req.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
  }
  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/auth',
    };
  }
  private async session(user: User, res: Response) {
    const db = await authDatabase.db();
    const token = randomBytes(32).toString('hex');
    await db.collection<Session>('sessions').insertOne({
      tokenHash: digest(token),
      userId: user._id,
      expiresAt: new Date(Date.now() + SESSION_MS),
    });
    res.cookie(COOKIE, token, { ...this.cookieOptions(), maxAge: SESSION_MS });
    res.setHeader('Cache-Control', 'no-store');
    return { user: publicUser(user) };
  }
  @Post('register') async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    const { email, name, password } = credentials(body, true);
    const db = await authDatabase.db();
    const user: User = {
      _id: new ObjectId(),
      email,
      name,
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
    };
    try {
      await db.collection<User>('users').insertOne(user);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000)
        throw new ConflictException('Email đã được đăng ký.');
      throw error;
    }
    return this.session(user, res);
  }
  @Post('login') async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    const { email, password } = credentials(body);
    const db = await authDatabase.db();
    const user = await db.collection<User>('users').findOne({ email });
    // Perform the same expensive hash operation even when the email does not exist.
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`,
    );
    if (!user || !valid) throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    return this.session(user, res);
  }
  @Get('me') async me(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const token = this.token(req);
    if (!token) return { user: null };
    const db = await authDatabase.db();
    const session = await db
      .collection<Session>('sessions')
      .findOne({ tokenHash: digest(token), expiresAt: { $gt: new Date() } });
    const user = session
      ? await db.collection<User>('users').findOne({ _id: session.userId })
      : null;
    if (!user) res.clearCookie(COOKIE, this.cookieOptions());
    return { user: user ? publicUser(user) : null };
  }
  private async owner(req: Request) {
    const token = this.token(req);
    if (!token) throw new UnauthorizedException('Vui lòng đăng nhập.');
    const db = await authDatabase.db();
    const session = await db.collection<Session>('sessions').findOne({
      tokenHash: digest(token),
      expiresAt: { $gt: new Date() },
    });
    if (!session) throw new UnauthorizedException('Phiên đăng nhập đã hết hạn.');
    const user = await db.collection<User>('users').findOne({ _id: session.userId });
    if (!user) throw new UnauthorizedException('Vui lòng đăng nhập.');
    return { db, user };
  }
  @Get('pets') async pets(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const { db, user } = await this.owner(req);
    await migrateLegacyPets(db, user);
    return loadPetCollection(db, user);
  }
  @Post('summon') async summon(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SummonResult> {
    this.checkOrigin(req);
    res.setHeader('Cache-Control', 'no-store');
    const { db, user } = await this.owner(req);
    await migrateLegacyPets(db, user);
    return summonPet(db, user);
  }
  @Post('logout') async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.checkOrigin(req);
    const token = this.token(req);
    if (token)
      await (await authDatabase.db())
        .collection<Session>('sessions')
        .deleteOne({ tokenHash: digest(token) });
    res.clearCookie(COOKIE, this.cookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    return { user: null };
  }

  @Post('world/start') async worldStart(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    res.setHeader('Cache-Control', 'no-store');
    const { db, user } = await this.owner(req);
    await migrateLegacyPets(db, user);
    return withWorldLock(user._id, () => startWorldBattle(db, user._id, body));
  }
  @Post('world/finish') async worldFinish(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    res.setHeader('Cache-Control', 'no-store');
    const { db, user } = await this.owner(req);
    return withWorldLock(user._id, () => finishWorldBattle(db, user._id, body));
  }
}
