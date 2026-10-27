import { test, expect } from '@playwright/test';
import { createWorld, CITY_GATES } from '@arena/game-data/world';
import { CITY_TOUR } from '../../apps/frontend/src/game/binh-minh-tour';

test.use({ launchOptions: { args: [] } });
test('Bình Minh renders its generated city art and all four accessible gates on desktop and mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof original>
    ) {
      if (
        args[0] instanceof HTMLImageElement &&
        args[0].src.includes('/binh-minh/buildings-v2.png')
      )
        this.canvas.dataset.cityArt = 'true';
      return Reflect.apply(original, this, args);
    } as typeof original;
  });
  await page.route('**/auth/*', (route) => route.fulfill({ json: { user: null } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Chơi Ngay', exact: true }).click();
  await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
  const canvas = page.getByTestId('world-canvas');
  await expect(canvas).toHaveAttribute('data-art-ready', 'true');
  await expect(canvas).toHaveAttribute('data-city-art', 'true');
  await expect(page.locator('.world-location h2')).toHaveText('Thành phố Bình Minh');
  await page.screenshot({ path: 'test-results/binh-minh-desktop.png' });
  const world = createWorld(42);
  for (const gate of CITY_GATES) {
    await page.getByRole('button', { name: 'Mở bản đồ', exact: true }).click();
    await page.getByLabel('Tọa độ X', { exact: true }).fill(String(world.spawn.x + gate.x));
    await page.getByLabel('Tọa độ Y', { exact: true }).fill(String(world.spawn.y + gate.y));
    await page.getByRole('button', { name: 'Dịch chuyển', exact: true }).click();
    await expect(canvas).toHaveAttribute(
      'data-position',
      `${(world.spawn.x + gate.x).toFixed(2)},${(world.spawn.y + gate.y).toFixed(2)}`,
    );
  }
  await page.screenshot({ path: 'test-results/binh-minh-gate.png' });
  await page.getByRole('button', { name: 'Về Bình Minh', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.world-location h2')).toHaveText('Thành phố Bình Minh');
  await page.screenshot({ path: 'test-results/binh-minh-mobile.png' });
  await page.getByRole('button', { name: 'Mở bản đồ', exact: true }).click();
  await page.getByText('Khám phá thành phố Bình Minh', { exact: true }).click();
  const concept = page.getByAltText(
    'Phối cảnh thành phố Bình Minh với bốn cổng và tường lực trường',
  );
  await concept.scrollIntoViewIfNeeded();
  await expect(concept).toBeVisible();
  await expect
    .poll(() => concept.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(1000);
  await page.screenshot({ path: 'test-results/binh-minh-map-mobile.png' });
  expect(errors).toEqual([]);
});

test('city walking journal follows real routes, records visits and works on mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/auth/*', (route) => route.fulfill({ json: { user: null } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Chơi Ngay', exact: true }).click();
  await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
  const canvas = page.getByTestId('world-canvas');
  await expect(canvas).toHaveAttribute('data-art-ready', 'true');
  const world = createWorld(42);
  for (const stop of CITY_TOUR.slice(1)) {
    await page.getByRole('button', { name: /Dạo phố Bình Minh/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog
      .locator('article')
      .filter({ hasText: stop.title[0] })
      .getByRole('button', { name: /Đi bộ đến đây/ })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect
      .poll(
        async () => {
          const [x, y] = (await canvas.getAttribute('data-position'))!.split(',').map(Number);
          return Math.hypot(x - world.spawn.x - stop.x, y - world.spawn.y - stop.y);
        },
        { timeout: 30000 },
      )
      .toBeLessThan(1.5);
    if (stop.id === 'market') await page.screenshot({ path: 'test-results/binh-minh-market.png' });
  }
  await expect(page.getByRole('button', { name: /Dạo phố Bình Minh/ })).toContainText('4/4');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Dạo phố Bình Minh/ }).click();
  await expect(page.getByRole('progressbar', { name: 'Tiến độ dạo phố' })).toHaveAttribute(
    'value',
    '4',
  );
  await page.screenshot({ path: 'test-results/binh-minh-journal-mobile.png' });
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  await page.getByRole('button', { name: 'Về Bình Minh', exact: true }).click();
  await expect(page.getByRole('button', { name: /Dạo phố Bình Minh/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});
