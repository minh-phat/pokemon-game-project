import { test, expect } from '@playwright/test';

test('library previews level and quality for every pet and handles invalid levels', async ({
  page,
}) => {
  await page.route('**/auth/*', (route) =>
    route.fulfill({
      json: {
        user: { id: 'preview-player', name: 'Summoner', email: 'preview@example.com' },
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Thư Viện', exact: true }).click({ timeout: 15000 });
  const detail = page.locator('.pokemon-detail');
  const level = detail.getByLabel('Cấp độ', { exact: true });
  const quality = detail.getByLabel('Phẩm chất', { exact: true });
  await expect(detail.getByRole('heading', { name: 'Pikachu', exact: true })).toBeVisible();
  await expect(level).toHaveValue('1');
  await expect(quality).toHaveValue('C');
  await level.fill('10');
  await quality.selectOption('A');
  await expect(detail.getByRole('status')).toHaveText('Pikachu · Cấp độ 10 · Phẩm chất A');
  await expect(detail.locator('.stat b')).toHaveText(['333', '49', '27', '321,3', '401,7', '136']);
  await expect(detail.locator('.combat-power-panel > strong')).toHaveText('1.572');
  await detail
    .locator('.pet-progression')
    .screenshot({ path: 'test-results/library-progression.png' });
  await expect(
    page
      .locator('.roster-card')
      .filter({ has: page.getByRole('heading', { name: 'Pikachu', exact: true }) })
      .locator('.combat-power-badge'),
  ).toContainText('1.572');
  await level.fill('101');
  await expect(level).toHaveAttribute('aria-invalid', 'true');
  await expect(detail.getByRole('alert')).toBeVisible();
  await expect(detail.getByRole('status')).toContainText('Cấp độ 10');
  await level.fill('');
  await expect(level).toHaveAttribute('aria-invalid', 'true');
  await detail.getByRole('button', { name: 'Thử cấp 10' }).click();
  await expect(level).toHaveAttribute('aria-invalid', 'false');
  const cards = page.locator('.roster-inspect');
  for (let i = 0; i < (await cards.count()); i++) {
    await cards.nth(i).click();
    await expect(detail.getByRole('status')).toContainText('Cấp độ 10 · Phẩm chất A');
    await expect(detail.locator('.stat-growth')).toHaveCount(6);
  }
  await detail.getByRole('button', { name: 'Về chỉ số gốc' }).click();
  await expect(level).toHaveValue('1');
  await expect(quality).toHaveValue('C');
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(level).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
