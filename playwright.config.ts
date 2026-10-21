import { defineConfig } from '@playwright/test';
const command = (workspace: string) =>
  `npm run ${process.env.E2E_PRODUCTION ? 'start' : 'dev'} -w @arena/${workspace}`;
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 150000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    channel:
      process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'darwin' ? 'chrome' : undefined),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: process.env.E2E_STANDALONE
    ? []
    : [
        {
          command: command('frontend'),
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
        {
          command: command('backend'),
          url: 'http://localhost:3001/health',
          reuseExistingServer: !process.env.CI,
          timeout: 30000,
        },
        {
          command: command('game-server'),
          url: 'http://localhost:2567/health',
          reuseExistingServer: !process.env.CI,
          timeout: 30000,
        },
      ],
});
