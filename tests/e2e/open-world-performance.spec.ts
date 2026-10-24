import { test, expect, type Page } from '@playwright/test';

async function enterWorld(page: Page) {
  await page.route('**/auth/*', (route) => route.fulfill({ json: { user: null } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Chơi Ngay', exact: true }).click();
  await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-position', /\d/);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-art-ready', 'true');
}

// The shared config forces SwiftShader for battle VFX. Also sample this Canvas scene
// with Chrome's normal graphics selection, matching a regular game session.
test.use({ launchOptions: { args: [] } });
test('records open world frame timing', async ({ page }, testInfo) => {
  await enterWorld(page);
  const timing = await page.evaluate(async () => {
    const samples: number[] = [];
    await new Promise<void>((resolve) => {
      let previous = performance.now();
      const frame = (now: number) => {
        samples.push(now - previous);
        previous = now;
        if (samples.length < 120) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    const steady = samples.slice(30).sort((a, b) => a - b);
    return {
      medianFrameMs: Math.round(steady[45]),
      p95FrameMs: Math.round(steady[85]),
      canvasDrawMs: Number(
        document.querySelector<HTMLCanvasElement>('[data-testid="world-canvas"]')?.dataset.renderMs,
      ),
    };
  });
  console.log('Normal Chrome graphics:', timing);
  await testInfo.attach('world-frame-timing', {
    body: JSON.stringify(timing, null, 2),
    contentType: 'application/json',
  });
  expect(Number.isFinite(timing.canvasDrawMs)).toBe(true);
});

test('streams terrain while moving across chunk boundaries', async ({ page }, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'arena-open-world-v2',
      JSON.stringify({
        version: 2,
        seed: 42,
        player: { x: 124.5, y: 128.5 },
        seen: [],
        visited: [],
      }),
    ),
  );
  await enterWorld(page);
  const canvas = page.getByTestId('world-canvas');
  const origin = (await canvas.getAttribute('data-position'))!.split(',').map(Number);
  await canvas.focus();
  await page.keyboard.down('Shift');
  await page.keyboard.down('d');
  const timing = await page.evaluate(async () => {
    const samples: number[] = [];
    await new Promise<void>((resolve) => {
      let previous = performance.now();
      const frame = (now: number) => {
        samples.push(now - previous);
        previous = now;
        if (samples.length < 360) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    samples.sort((a, b) => a - b);
    return { medianFrameMs: Math.round(samples[180]), p95FrameMs: Math.round(samples[342]) };
  });
  await page.keyboard.up('d');
  await page.keyboard.up('Shift');
  const destination = (await canvas.getAttribute('data-position'))!.split(',').map(Number);
  expect(Math.hypot(destination[0] - origin[0], destination[1] - origin[1])).toBeGreaterThan(10);
  expect(Math.floor(destination[0] / 32)).not.toBe(Math.floor(origin[0] / 32));
  expect(Number(await canvas.getAttribute('data-terrain-chunks'))).toBeLessThanOrEqual(64);
  console.log('Moving across streamed chunks:', timing);
  await testInfo.attach('world-moving-frame-timing', {
    body: JSON.stringify(timing, null, 2),
    contentType: 'application/json',
  });
});
