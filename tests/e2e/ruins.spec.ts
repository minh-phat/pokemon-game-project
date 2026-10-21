import { test, expect } from '@playwright/test';
test('citadel loads eight fighters and exposes camera controls on desktop and mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Let’s battle' }).click();
  await page.getByRole('button', { name: /YOUR PACE/ }).click();
  await page.getByLabel('Pokémon per team', { exact: true }).selectOption('4');
  await page.getByLabel('Active at once', { exact: true }).selectOption('4');
  const picker = page.getByRole('button', { name: /Waterfall Citadel/ });
  await expect(picker.locator('img')).toHaveAttribute('src', '/assets/ruins-map.png');
  await picker.click();
  await page.getByRole('button', { name: 'Choose your Pokémon', exact: true }).click();
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
  await expect(page.getByLabel('Mức zoom')).toHaveText('100%');
  await page.getByLabel('Theo dõi Pokémon').selectOption('0-0');
  await expect(page.getByLabel('Mức zoom')).toHaveText('100%');
  await expect(page.getByLabel('Theo dõi Pokémon')).toHaveValue('0-0');
  await page.getByRole('button', { name: 'Phóng to', exact: true }).click();
  await expect(page.getByLabel('Mức zoom')).toHaveText('120%');
  await page.getByRole('button', { name: 'Thu nhỏ', exact: true }).click();
  await page.getByRole('button', { name: 'Toàn sân', exact: true }).click();
  await expect(page.getByLabel('Mức zoom')).toHaveText('60%');
  await expect(page.getByLabel('Theo dõi Pokémon')).toHaveValue('');
  await page.getByRole('button', { name: 'Lấp đầy', exact: true }).click();
  await expect(page.getByLabel('Mức zoom')).toHaveText('100%');
  await page.screenshot({ path: 'test-results/ruins-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Toàn sân', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByLabel('Mức zoom')).toHaveText('84%');
  await expect
    .poll(async () =>
      page.locator('canvas').evaluate((canvas) => {
        const box = canvas.getBoundingClientRect();
        return Math.abs(box.width - innerWidth) < 2 && Math.abs(box.height - innerHeight) < 2;
      }),
    )
    .toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/ruins-mobile.png' });
  expect(errors).toEqual([]);
});
