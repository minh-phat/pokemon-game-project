import { test, expect } from '@playwright/test';

for (const { width, height } of [
  { width: 1440, height: 1000 },
  { width: 390, height: 740 },
  { width: 320, height: 740 },
  { width: 844, height: 390 },
  { width: 667, height: 375 },
]) {
  test(`test a Pokémon move, replay, and close at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
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
    // Opening the dialog must not focus a control below the arena and scroll it away.
    await expect(dialog.locator('canvas')).toBeInViewport({ ratio: 1 });
    expect(await dialog.evaluate((element) => element.scrollTop)).toBe(0);
    expect(
      await dialog.locator('.skill-training-body').evaluate((element) => element.scrollTop),
    ).toBe(0);
    if (width > height) {
      await expect(dialog.locator('.skill-training-actions')).toBeInViewport({ ratio: 1 });
      await expect(dialog.getByRole('button', { name: 'Đóng hộp thoại' })).toBeInViewport({
        ratio: 1,
      });
    }
    await expect
      .poll(async () =>
        Number(await dialog.locator('.skill-training-actions strong').textContent()),
      )
      .toBeGreaterThan(0);
    await replay.click();
    await expect(replay).toBeEnabled();
    await expect
      .poll(async () =>
        Number(await dialog.locator('.skill-training-actions strong').textContent()),
      )
      .toBeGreaterThan(0);
    if (width < 768) {
      const actions = dialog.locator('.skill-training-actions');
      await expect(actions).toBeInViewport({ ratio: 1 });
      const replayBox = await replay.boundingBox();
      expect(replayBox!.height).toBeGreaterThanOrEqual(48);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      await dialog.getByText('Điều kiện thử chiêu', { exact: false }).click();
      await expect(actions).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: `test-results/skill-training-${width}.png` });
      await page.setViewportSize({ width: 844, height: 390 });
      await expect(dialog.locator('canvas')).toBeInViewport({ ratio: 1 });
      await expect(actions).toBeInViewport({ ratio: 1 });
      await expect(replay).toBeEnabled();
      await replay.click();
      await expect(replay).toBeEnabled();
      await page.screenshot({ path: `test-results/skill-training-${width}-landscape.png` });
      await dialog.getByRole('button', { name: 'Đóng hộp thoại' }).click();
    } else {
      await page.screenshot({ path: `test-results/skill-training-${width}.png` });
      await page.keyboard.press('Escape');
    }
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.pokemon-detail h2')).toHaveText('Pikachu');
    expect(errors).toEqual([]);
  });
}
