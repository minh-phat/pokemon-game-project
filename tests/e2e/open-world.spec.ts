import { test, expect, type Page } from '@playwright/test';
import { createWorld } from '../../apps/frontend/src/game/open-world-world';
test.use({ launchOptions: { args: [] } });

async function enterWorld(page: Page) {
  await page.route('**/auth/*', (route) => route.fulfill({ json: { user: null } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Chơi Ngay', exact: true }).click();
  await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-position', /\d/);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-art-ready', 'true');
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-world-size', '8192');
}

test.describe('sharp open world rendering', () => {
  test.use({ deviceScaleFactor: 2 });

  test('uses Retina resolution and original sprite frames after resizing', async ({ page }) => {
    await page.addInitScript(() => {
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (
        this: CanvasRenderingContext2D,
        ...args: unknown[]
      ) {
        const [source, , , sourceWidth, sourceHeight] = args;
        if (
          this.canvas.dataset.testid === 'world-canvas' &&
          source instanceof HTMLCanvasElement &&
          source.width === 960 &&
          source.height === 320 &&
          args.length === 9 &&
          sourceWidth === 160 &&
          sourceHeight === 160
        )
          this.canvas.dataset.fullResolutionSprite = 'true';
        return Reflect.apply(drawImage, this, args);
      } as typeof drawImage;
    });
    await enterWorld(page);
    const surface = page.getByTestId('world-canvas');
    await expect(surface).toHaveAttribute('data-full-resolution-sprite', 'true');
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          surface.evaluate((canvas: HTMLCanvasElement) => ({
            width: canvas.width,
            height: canvas.height,
          })),
        )
        .toEqual({ width: viewport.width * 2, height: viewport.height * 2 });
    }
    await page.screenshot({ path: 'test-results/open-world-sharp-retina.png' });
  });
});

test('continent map travels kilometers, keeps streaming bounded and restores old journals', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'arena-open-world-v1',
      JSON.stringify({
        version: 1,
        seed: 42,
        player: { x: 80.5, y: 90.5 },
        seen: ['pikachu'],
        visited: ['meadow'],
      }),
    ),
  );
  await enterWorld(page);
  const canvas = page.getByTestId('world-canvas');
  const origin = (await canvas.getAttribute('data-position'))!.split(',').map(Number);
  await page.getByRole('button', { name: /Nhật ký/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Pikachu');
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  let farthestDistance = 0;
  for (const name of ['Đỉnh tuyết trắng', 'Miệng núi lửa', 'Bờ cát vàng', 'Rừng thì thầm']) {
    await page.getByRole('button', { name: 'Mở bản đồ', exact: true }).click();
    await expect(page.locator('.world-map-scale')).toContainText('268.4 km²');
    if (name === 'Đỉnh tuyết trắng')
      await page.screenshot({ path: 'test-results/open-world-continent.png' });
    await page.getByRole('button', { name: `Dịch chuyển đến ${name}` }).click();
    await expect(page.locator('.world-location h2')).toHaveText(name);
    expect(Number(await canvas.getAttribute('data-terrain-chunks'))).toBeLessThanOrEqual(64);
    const current = (await canvas.getAttribute('data-position'))!.split(',').map(Number);
    farthestDistance = Math.max(
      farthestDistance,
      Math.hypot(current[0] - origin[0], current[1] - origin[1]),
    );
  }
  expect(farthestDistance * 2).toBeGreaterThan(1000);
  const destination = (await canvas.getAttribute('data-position'))!.split(',').map(Number);
  expect(Math.hypot(destination[0] - origin[0], destination[1] - origin[1])).toBeGreaterThan(30);
  await page.getByRole('button', { name: 'Về menu chơi' }).click();
  expect(await page.evaluate(() => Boolean(localStorage.getItem('arena-open-world-v1')))).toBe(
    true,
  );
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('arena-open-world-v2')!));
  expect(save.version).toBe(2);
  expect(save.seen).toContain('pikachu');
});

test('open world movement, pause, map, journal, save restoration and regeneration', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    if (!localStorage.getItem('arena-open-world-v2'))
      localStorage.setItem(
        'arena-open-world-v2',
        JSON.stringify({
          version: 2,
          seed: 42,
          player: { x: 4000.5, y: 4700.5 },
          seen: [],
          visited: [],
        }),
      );
  });
  await enterWorld(page);
  const canvas = page.getByTestId('world-canvas');
  const initial = await canvas.getAttribute('data-position');
  await canvas.focus();
  await page.keyboard.down('d');
  await expect(canvas).not.toHaveAttribute('data-position', initial!);
  await page.keyboard.up('d');
  await expect(canvas).not.toHaveAttribute('data-position', initial!);
  await page.getByRole('button', { name: 'Tạm dừng khám phá' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const paused = await canvas.getAttribute('data-position');
  await page.keyboard.down('d');
  await page.waitForTimeout(400);
  await page.keyboard.up('d');
  await expect(canvas).toHaveAttribute('data-position', paused!);
  await page.getByRole('button', { name: 'Tiếp tục khám phá' }).click();
  await page.getByRole('button', { name: 'Mở bản đồ', exact: true }).click();
  await expect(page.locator('.world-map.expanded')).toBeVisible();
  await page.getByRole('button', { name: 'Thu nhỏ bản đồ' }).click();
  await page.getByRole('button', { name: /Nhật ký/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Nhật ký thám hiểm');
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  await page.screenshot({ path: 'test-results/open-world-desktop.png' });
  const seed = await canvas.getAttribute('data-seed');
  const position = await canvas.getAttribute('data-position');
  await page.getByRole('button', { name: 'Về menu chơi' }).click();
  await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
  await expect(canvas).toHaveAttribute('data-seed', seed!);
  await expect(canvas).toHaveAttribute('data-position', position!);
  await page.getByRole('button', { name: 'Tạm dừng khám phá' }).click();
  await page.getByLabel('Mã thế giới').fill('90210');
  await page.getByRole('button', { name: 'Tạo thế giới mới' }).click();
  await expect(canvas).toHaveAttribute('data-seed', '90210');
  await page.reload();
  await page.getByRole('button', { name: 'Chơi Ngay', exact: true }).click();
  await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
  await expect(canvas).toHaveAttribute('data-seed', '90210');
  expect(errors).toEqual([]);
});

test('touch movement, release, and game HUD fit portrait and landscape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterWorld(page);
  const canvas = page.getByTestId('world-canvas');
  const initial = await canvas.getAttribute('data-position');
  const joystick = page.getByRole('group', { name: 'Cần điều khiển di chuyển' });
  const box = (await joystick.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 + 28, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(750);
  await page.mouse.up();
  await expect(canvas).not.toHaveAttribute('data-position', initial!);
  await page.waitForTimeout(350);
  const stopped = await canvas.getAttribute('data-position');
  await page.waitForTimeout(400);
  await expect(canvas).toHaveAttribute('data-position', stopped!);
  for (const [width, height] of [
    [390, 844],
    [844, 390],
    [640, 360],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.locator('.open-world').evaluate((el) =>
        Array.from(el.querySelectorAll('button'))
          .filter((b) => b.getClientRects().length > 0)
          .every((b) => {
            const r = b.getBoundingClientRect();
            return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
          }),
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/open-world-${width}x${height}.png` });
    await page.getByRole('button', { name: 'Mở bản đồ', exact: true }).click();
    const mapBox = (await page.locator('.world-map.expanded').boundingBox())!;
    expect(mapBox.y).toBeGreaterThanOrEqual(0);
    expect(mapBox.y + mapBox.height).toBeLessThanOrEqual(height);
    await page.getByRole('button', { name: 'Dịch chuyển đến Biển ngọc lam' }).click();
    await expect(page.locator('.world-location h2')).toHaveText('Biển ngọc lam');
  }
});

test('snow, volcano and coast render without errors with bounded caches', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const world = createWorld(42);
  await enterWorld(page);
  for (const [biome, elevation] of [
    ['snow', 0.75],
    ['volcano', 0.65],
    ['ocean', 0.18],
  ] as const) {
    const tile = world.landmarks.find((l) => l.biome === biome)!;
    await page.getByRole('button', { name: 'Về menu chơi' }).click();
    await page.evaluate(
      ({ seed, x, y }) =>
        localStorage.setItem(
          'arena-open-world-v2',
          JSON.stringify({
            version: 2,
            seed,
            player: { x, y },
            seen: [],
            visited: [],
          }),
        ),
      { seed: world.seed, x: tile.x, y: tile.y },
    );
    await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
    await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-position', /\d/);
    await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-art-ready', 'true');
    const timing = await page.evaluate(async () => {
      const samples: number[] = [];
      await new Promise<void>((resolve) => {
        let previous = performance.now();
        const frame = (now: number) => {
          samples.push(now - previous);
          previous = now;
          if (samples.length < 90) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      samples.sort((a, b) => a - b);
      return { median: Math.round(samples[45]), p95: Math.round(samples[85]) };
    });
    console.log(
      `${biome} frame timing: ${JSON.stringify(timing)} ms; canvas draw: ${await page.getByTestId('world-canvas').getAttribute('data-render-ms')} ms`,
    );
    await page.screenshot({ path: `test-results/open-world-${biome}.png` });
    await page.getByRole('button', { name: 'Tạm dừng khám phá' }).click();
    const diagnostics = await page.locator('.world-performance').innerText();
    expect(diagnostics).toMatch(/\d+ FPS/);
    expect(Number(diagnostics.match(/(\d+) Pokémon/)?.[1])).toBeLessThanOrEqual(80);
    expect(Number(diagnostics.match(/(\d+)\/48/)?.[1])).toBeLessThanOrEqual(48);
    console.log(`${biome}: ${diagnostics.replaceAll('\n', ' ')}`);
    await page.getByRole('button', { name: 'Tiếp tục khám phá' }).click();
  }
  await page.getByRole('button', { name: 'Tạm dừng khám phá' }).click();
  const pausedTiming = await page.evaluate(async () => {
    const samples: number[] = [];
    await new Promise<void>((resolve) => {
      let previous = performance.now();
      const frame = (now: number) => {
        samples.push(now - previous);
        previous = now;
        if (samples.length < 90) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    samples.sort((a, b) => a - b);
    return { median: Math.round(samples[45]), p95: Math.round(samples[85]) };
  });
  console.log(`Paused browser baseline: ${JSON.stringify(pausedTiming)} ms`);
  expect(errors).toEqual([]);
});
