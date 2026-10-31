import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`combat handbook: matchups, calculator and layout ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.route('**/auth/*', (route) =>
      route.fulfill({
        json: { user: { id: 'handbook-player', name: 'Summoner', email: 'player@example.com' } },
      }),
    );
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const entry = page.locator('.player-bottom-nav').getByRole('button', {
      name: 'Cơ chế chiến đấu',
      exact: true,
    });
    await expect(entry).toBeVisible();
    const bounds = await entry.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await entry.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.handbook-matchups')).toContainText('Cỏ×1.4');
    await dialog.getByRole('button', { name: '← Khi phòng thủ', exact: true }).click();
    await expect(dialog.locator('.handbook-matchups')).toContainText('Nước×1.4');
    await dialog.getByText('Bảng khắc hệ đầy đủ', { exact: true }).click();
    await expect(dialog.locator('tbody tr')).toHaveCount(6);
    await dialog.getByRole('button', { name: 'Cách tính sát thương', exact: true }).click();
    await expect(dialog).toContainText('89.6 → 90 HP');
    await dialog.getByRole('button', { name: 'Thử sát thương', exact: true }).click();
    const result = dialog.getByRole('status');
    await expect(result).toContainText('93 HP');
    await dialog.getByLabel('Hệ số kỹ năng (% ATK)', { exact: true }).fill('120');
    await dialog
      .getByRole('combobox', { name: 'Giảm sát thương mạnh nhất', exact: true })
      .selectOption('0.2');
    await expect(result).toContainText('90 HP');
    await dialog.getByLabel('Bật khắc hệ', { exact: true }).uncheck();
    await expect(result).toContainText('64 HP');
    await dialog.getByLabel('Đòn cường hóa sau né của Eevee · ×1.15', { exact: true }).check();
    await expect(result).toContainText('74 HP');
    await dialog.getByLabel('Tấn công (ATK)', { exact: true }).fill('0');
    await expect(result.locator('strong')).toHaveText('0 HP');
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    const box = await dialog.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.screenshot({ path: `test-results/handbook-${viewport.width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.getByRole('button', { name: 'Combat Handbook', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Type matchups');
    await page.getByRole('button', { name: 'Close dialog' }).click();
  });
}

test('guests can open the handbook before playing', async ({ page }) => {
  await page.route('**/auth/*', (route) => route.fulfill({ json: { user: null } }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Cơ chế chiến đấu', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
