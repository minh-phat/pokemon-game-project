import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (existsSync('.env')) process.loadEnvFile('.env');

for (const args of [
  ['run', 'typecheck'],
  ['run', 'build', '-w', '@arena/backend'],
  ['run', 'build', '-w', '@arena/game-server'],
  ['run', 'build', '-w', '@arena/frontend'],
]) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.signal) process.kill(process.pid, result.signal);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
