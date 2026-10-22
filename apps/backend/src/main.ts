import 'reflect-metadata';
import { AuthController, authDatabase } from './auth';
import { Controller, Get, Post, Param, Module, NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { ARENAS, ROSTER, POKEMON } from '@arena/game-data';
import { DEFAULT_RULES, SpeciesSchema } from '@arena/shared-types';

@Controller()
class GameController {
  @Get('health') health() {
    return { status: 'ok', service: 'arena-api', version: '1.0.0' };
  }
  @Get('config') config() {
    return {
      rules: DEFAULT_RULES,
      teamSizes: [1, 2, 3, 4],
      durations: [60, 120, 180, 0],
      difficulties: ['easy', 'normal', 'hard'],
      tickRate: 60,
      snapshotRate: 20,
    };
  }
  @Get('pokemon') roster() {
    return ROSTER;
  }
  @Get('pokemon/:id') pokemon(@Param('id') id: string) {
    const result = SpeciesSchema.safeParse(id);
    if (!result.success) throw new NotFoundException('Pokémon not found');
    return POKEMON[result.data];
  }
  @Get('arenas') arenas() {
    return ARENAS;
  }
  @Post('identity') identity() {
    return { playerId: randomUUID(), expiresIn: 86400 };
  }
}
@Module({
  controllers: [GameController, AuthController],
  providers: [{ provide: 'AUTH_DATABASE', useValue: authDatabase }],
})
class AppModule {}
const app = await NestFactory.create(AppModule);
app.enableCors({
  credentials: true,
  origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000').split(','),
});
const authRequests = new Map<string, { count: number; until: number }>();
const requests = new Map<string, { count: number; until: number }>();
app.use((req: Request, res: Response, next: NextFunction) => {
  const key = req.ip ?? 'local',
    now = Date.now();
  let bucket = requests.get(key);
  if (!bucket || now > bucket.until) {
    bucket = { count: 0, until: now + 60000 };
    requests.set(key, bucket);
  }
  if (req.method === 'POST' && ['/auth/login', '/auth/register'].includes(req.path)) {
    let authBucket = authRequests.get(key);
    if (!authBucket || now > authBucket.until) {
      authBucket = { count: 0, until: now + 60000 };
      authRequests.set(key, authBucket);
    }
    if (authRequests.size > 10000)
      for (const [ip, value] of authRequests) if (value.until < now) authRequests.delete(ip);
    if (++authBucket.count > 10)
      return res.status(429).json({ message: 'Bạn thử quá nhiều lần. Vui lòng đợi một phút.' });
  }
  if (++bucket.count > 120)
    return res.status(429).json({ message: 'Please slow down and retry in a minute' });
  if (requests.size > 10000)
    for (const [ip, value] of requests) if (value.until < now) requests.delete(ip);
  next();
});
app.enableShutdownHooks();
const apiPort = Number(process.env.API_PORT ?? 3001);
await app.listen(apiPort, '0.0.0.0');
console.log(`Game API ready at http://localhost:${apiPort}`);
