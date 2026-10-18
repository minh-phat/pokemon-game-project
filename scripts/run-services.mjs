import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

if (existsSync('.env')) process.loadEnvFile('.env');

// Next uses PORT for its listening port; FRONTEND_ORIGIN also supplies CORS.
if (!process.env.PORT && process.env.FRONTEND_ORIGIN) {
  const origin = process.env.FRONTEND_ORIGIN.split(',')[0];
  process.env.PORT = new URL(origin).port || (origin.startsWith('https:') ? '443' : '80');
}

const mode = process.argv[2];
if (mode !== 'dev' && mode !== 'start') throw new Error('Expected dev or start');

const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', `${mode}:services`], {
  stdio: 'inherit',
  env: process.env,
});
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
