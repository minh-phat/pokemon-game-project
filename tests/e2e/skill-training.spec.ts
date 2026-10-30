import { test, expect } from '@playwright/test';

test('test a Pokémon move on a dummy, replay, and close', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/auth/*', (route) =>
    route.fulfill({
      json: {
        user: { id: 'preview-player', name: 'Summoner', email: 'preview@example.com' },
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Thư Viện', exact: true }).click();
  await page.getByRole('button', { name: 'Test chiêu', exact: true }).nth(1).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Pikachu → Hình nộm');
  await expect(dialog.locator('canvas')).toBeVisible();
  const replay = dialog.getByRole('button', { name: 'Dùng chiêu lại' });
  await expect(replay).toBeEnabled();
  await expect
    .poll(async () => Number(await dialog.locator('.skill-training-actions strong').textContent()))
    .toBeGreaterThan(0);
  await replay.click();
  await expect(replay).toBeEnabled();
  await expect
    .poll(async () => Number(await dialog.locator('.skill-training-actions strong').textContent()))
    .toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/skill-training.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.pokemon-detail h2')).toHaveText('Pikachu');
  expect(errors).toEqual([]);
});
