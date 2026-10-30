import { test, expect } from '@playwright/test';

test('battle canvas fills the viewport on entry and after resizing', async ({ page }) => {
  page.setDefaultTimeout(15000);
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Play Now' }).click();
  await page.getByRole('button', { name: /YOUR PACE/ }).click();
  await page.getByLabel('Pokémon per team', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Choose your Pokémon', exact: true }).click();
  await page.getByRole('button', { name: 'Add Squirtle', exact: true }).click();
  await page.getByRole('button', { name: 'Choose AI Pokémon', exact: true }).click();
  await page.getByRole('button', { name: 'Add Charmander', exact: true }).click();
  await page.getByRole('button', { name: 'Enter the arena', exact: true }).click();
  const canvas = page.getByTestId('battle-canvas').locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/viewport-${viewport.width}.png` });
    await expect
      .poll(async () => {
        const box = await canvas.boundingBox();
        return (
          box && {
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
          }
        );
      })
      .toEqual({ x: 0, y: 0, ...viewport });
  }
});
