import { test, expect } from '@playwright/test';
test('citadel loads eight fighters and renders a responsive arena on desktop and mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Play Now' }).click();
  await page.getByRole('button', { name: /YOUR PACE/ }).click();
  await page.getByLabel('Pokémon per team', { exact: true }).selectOption('4');
  await page.getByLabel('Active at once', { exact: true }).selectOption('4');
  const picker = page.getByRole('button', { name: /Waterfall Citadel/ });
  await expect(picker.locator('img')).toHaveAttribute('src', '/assets/ruins-map.png');
  await picker.click();
  await page.getByRole('button', { name: 'Choose your Pokémon', exact: true }).click();
  for (const name of ['Pikachu', 'Charmander', 'Squirtle', 'Bulbasaur'])
    await page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Choose AI Pokémon', exact: true }).click();
  for (const name of ['Pikachu', 'Charmander', 'Squirtle', 'Bulbasaur'])
    await page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
  const mapLoaded = page.waitForResponse(
    (response) => response.url().endsWith('/assets/ruins-map.png') && response.ok(),
  );
  await page.getByRole('button', { name: 'Enter the arena', exact: true }).click();
  await mapLoaded;
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('.fighter-status')).toHaveCount(8);
  await expect(page.getByRole('progressbar')).toHaveCount(8);
  await page.screenshot({ path: 'test-results/ruins-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('canvas')).toBeVisible();
  await expect
    .poll(async () =>
      page.locator('canvas').evaluate((canvas) => {
        const box = canvas.getBoundingClientRect();
        const parent = canvas.parentElement!.getBoundingClientRect();
        return (
          box.width > 0 &&
          Math.abs(box.width - parent.width) < 2 &&
          Math.abs(box.height - parent.height) < 2
        );
      }),
    )
    .toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/ruins-mobile.png' });
  expect(errors).toEqual([]);
});
