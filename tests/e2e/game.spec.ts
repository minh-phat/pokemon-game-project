import { test, expect, type Page } from '@playwright/test';
async function rules(page: Page) {
  await page.getByLabel('Pokémon per team', { exact: true }).selectOption('1');
  await page.getByLabel('Battle duration', { exact: true }).selectOption('60');
  await page.getByRole('button', { name: 'Choose your Pokémon', exact: true }).click();
}
test('VS AI: selection, pause, animated combat, results, and play again', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  expect((await request.get('http://localhost:3001/health')).ok()).toBe(true);
  const roster = await (await request.get('http://localhost:3001/pokemon')).json();
  expect(roster).toHaveLength(6);
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Summoner', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Play Now' }).click();
  await page.getByRole('button', { name: /YOUR PACE/ }).click();
  await rules(page);
  for (const name of ['Pikachu', 'Charmander', 'Lam Quy', 'Bulbasaur'])
    await expect(page.getByRole('button', { name: `Inspect ${name}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add Pikachu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enter the arena', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/selection-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Enter the arena', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const paused = await page.getByTestId('match-timer').textContent();
  const stamina = page.getByRole('progressbar', { name: 'Pikachu stamina', exact: true }).first();
  await expect(stamina).toBeVisible();
  await expect(stamina).toHaveAttribute('aria-valuemax', '100');
  const pausedStamina = await stamina.getAttribute('aria-valuenow');
  await page.waitForTimeout(1200);
  expect(await page.getByTestId('match-timer').textContent()).toBe(paused);
  await expect(stamina).toHaveAttribute('aria-valuenow', pausedStamina!);
  await page.getByRole('button', { name: 'Resume battle', exact: true }).click();
  await page.waitForTimeout(4500);
  await page.screenshot({ path: 'test-results/battle-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/battle-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByTestId('battle-result')).toBeVisible({ timeout: 80000 });
  await expect(page.getByRole('dialog')).toContainText(/won the arena|timer ended|Both teams/);
  await page.screenshot({ path: 'test-results/result-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your companions.' })).toBeVisible();
  expect(errors).toEqual([]);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('Runedrake can be selected and rendered in battle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const sheet = page.waitForResponse(
    (response) => response.url().endsWith('/assets/runedrake-sheet.png') && response.ok(),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Play Now' }).click();
  await page.getByRole('button', { name: /YOUR PACE/ }).click();
  await rules(page);
  await page.getByRole('button', { name: 'Inspect Runedrake' }).click();
  await expect(page.getByRole('heading', { name: 'Runedrake', exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Add Runedrake' }).click();
  await page.getByRole('button', { name: 'Choose AI Pokémon' }).click();
  await page.getByRole('button', { name: 'Add Pikachu', exact: true }).click();
  await page.getByRole('button', { name: 'Enter the arena' }).click();
  await sheet;
  // Cold-start texture generation can block the browser while the scene boots.
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled({
    timeout: 60000,
  });
  expect(errors).toEqual([]);
});

test('online: two trainers complete an authoritative match and vote for rematch', async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const host = await a.newPage(),
    guest = await b.newPage();
  const errors: string[] = [];
  host.on('pageerror', (e) => errors.push(e.message));
  guest.on('pageerror', (e) => errors.push(e.message));
  await host.goto('/');
  await host.getByRole('button', { name: 'EN', exact: true }).click();
  await host.getByRole('button', { name: 'Play Now' }).click();
  await host.getByRole('button', { name: /BETTER WITH A FRIEND/ }).click();
  await host.getByLabel('Your trainer name').fill('Alice');
  await host.getByRole('button', { name: 'Create a private room' }).click();
  await rules(host);
  await host.getByRole('button', { name: 'Add Charmander', exact: true }).click();
  await host.getByRole('button', { name: 'Confirm team', exact: true }).click();
  await expect(host.getByTestId('room-code')).toBeVisible();
  const code = (await host.getByTestId('room-code').textContent())!;
  await guest.goto(`/?room=${code}`);
  await guest.getByRole('button', { name: 'EN', exact: true }).click();
  await guest.getByLabel('Your trainer name').fill('Bob');
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(guest.getByTestId('room-code')).toHaveText(code);
  await expect(guest.getByRole('button', { name: 'Edit match rules' })).toHaveCount(0);
  await guest.getByRole('button', { name: 'Choose your Pokémon', exact: true }).click();
  await guest.getByRole('button', { name: 'Add Lam Quy', exact: true }).click();
  await guest.getByRole('button', { name: 'Confirm team', exact: true }).click();
  await expect(host.getByRole('heading', { name: 'Bob' })).toBeVisible();
  await host.reload();
  await expect(host.getByTestId('room-code')).toHaveText(code);
  await expect(host.getByRole('heading', { name: 'Bob' })).toBeVisible();
  await guest.reload();
  await expect(guest.getByTestId('room-code')).toHaveText(code);
  await expect(guest.getByRole('button', { name: 'Edit your team', exact: true })).toBeVisible();
  await host.screenshot({ path: 'test-results/lobby-desktop.png', fullPage: true });
  await host.getByRole('button', { name: 'Ready for battle', exact: true }).click();
  await guest.getByRole('button', { name: 'Ready for battle', exact: true }).click();
  await expect(host.locator('canvas')).toHaveCount(1);
  await expect(guest.locator('canvas')).toHaveCount(1);
  await expect(host.getByTestId('battle-result')).toBeVisible({ timeout: 85000 });
  await expect(guest.getByTestId('battle-result')).toBeVisible();
  const results = [
    await host.getByTestId('battle-result').textContent(),
    await guest.getByTestId('battle-result').textContent(),
  ];
  expect(
    results.includes('Victory is yours!') || results.every((x) => x === 'A worthy draw.'),
  ).toBe(true);
  expect(await host.getByTestId('match-timer').textContent()).toEqual(
    await guest.getByTestId('match-timer').textContent(),
  );
  await host.getByRole('button', { name: 'Request rematch' }).click();
  await guest.getByRole('button', { name: 'Request rematch' }).click();
  await expect(host.getByTestId('room-code')).toBeVisible();
  await expect(guest.getByTestId('room-code')).toBeVisible();
  expect(errors).toEqual([]);
  await a.close();
  await b.close();
});
test('mobile navigation, roster, arenas, and accessible settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Collect Pets/ }).click();
  await page.getByRole('button', { name: 'Inspect Bulbasaur', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bulbasaur', exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('switch', { name: /Reduce motion/ }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Arenas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Crystal Lake', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('manual mode: select Pokémon, guard, dodge, cast, and return to auto', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Play Now' }).click();
  await page.getByRole('button', { name: /YOUR PACE/ }).click();
  await page.getByLabel('Pokémon per team', { exact: true }).selectOption('2');
  await page.getByLabel('Active at once', { exact: true }).selectOption('2');
  await page.getByLabel('Battle duration', { exact: true }).selectOption('60');
  await page.getByRole('button', { name: 'Choose your Pokémon', exact: true }).click();
  await page.getByRole('button', { name: 'Add Pikachu', exact: true }).click();
  await page.getByRole('button', { name: 'Add Charmander', exact: true }).click();
  await page.getByRole('button', { name: 'Enter the arena', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Manual mode' })).toBeEnabled({ timeout: 30000 });
  const frame = page.locator('.arena-frame');
  const controls = frame.getByRole('region', { name: 'Manual battle controls' });
  await expect(controls).toBeVisible();
  const arenaBounds = await frame.boundingBox();
  expect(arenaBounds!.x).toBe(0);
  expect(arenaBounds!.y).toBe(0);
  expect(arenaBounds!.width).toBe(1440);
  expect(arenaBounds!.height).toBeGreaterThanOrEqual(1000);
  await expect(frame.getByRole('button', { name: 'Manual mode' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(controls.getByRole('heading')).toHaveCount(0);
  expect(
    await controls.evaluate((element) => Number(getComputedStyle(element).opacity)),
  ).toBeLessThan(1);
  const desktopFrame = await frame.boundingBox();
  const desktopControls = await controls.boundingBox();
  expect(desktopControls!.height).toBeLessThan(100);
  expect(desktopControls!.y).toBeGreaterThanOrEqual(desktopFrame!.y);
  expect(desktopControls!.y + desktopControls!.height).toBeLessThanOrEqual(
    desktopFrame!.y + desktopFrame!.height + 1,
  );
  const picker = page.getByRole('group', { name: 'Choose active Pokémon' });
  await expect(picker.getByRole('button')).toHaveCount(2);
  const pikachu = picker.getByRole('button', { name: /Pikachu/ });
  const charmander = picker.getByRole('button', { name: /Charmander/ });
  await expect(pikachu).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control');
  await expect(charmander).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control+c');
  await expect(charmander).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control');
  await expect(pikachu).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('button', { name: /Charmander/ }).click();
  await expect(page.getByRole('button', { name: /Flamethrower/ })).toBeVisible();
  await picker.getByRole('button', { name: /Pikachu/ }).click();
  await expect(page.getByRole('button', { name: 'Guard · −20%' })).toBeEnabled({ timeout: 5000 });
  await page.keyboard.press('g');
  await expect(page.getByRole('button', { name: 'Release guard' })).toBeVisible();
  await page.keyboard.press('g');
  await expect(page.getByRole('button', { name: 'Guard · −20%' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dash · 15' })).toBeEnabled();
  await page.keyboard.press('Shift+w');
  await expect(page.getByRole('button', { name: 'Dash · 15' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Jump · 15' })).toBeEnabled({ timeout: 5000 });
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Jump · 15' })).toBeDisabled();
  await picker.getByRole('button', { name: /Charmander/ }).click();
  await expect(page.getByRole('button', { name: 'Dash · 15' })).toBeEnabled({ timeout: 5000 });
  const scrollBeforeArrow = await page.evaluate(() => scrollY);
  await page.keyboard.press('Shift+ArrowRight');
  expect(await page.evaluate(() => scrollY)).toBe(scrollBeforeArrow);
  await expect(page.getByRole('button', { name: 'Dash · 15' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Crouch · 15' })).toBeEnabled({ timeout: 5000 });
  await page.keyboard.press('c');
  await expect(page.getByRole('button', { name: 'Crouch · 15' })).toBeDisabled();
  await picker.getByRole('button', { name: /Pikachu/ }).click();
  await expect(page.getByRole('button', { name: 'Quick Attack 0 EN' })).toBeEnabled({
    timeout: 5000,
  });
  await page.keyboard.press('1');
  await expect(page.getByRole('button', { name: /Quick Attack.*s$/ })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Movement controls' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCanvas = await frame.locator('canvas').boundingBox();
  const mobileControls = await controls.boundingBox();
  expect(mobileControls!.y).toBeGreaterThanOrEqual(mobileCanvas!.y);
  expect(mobileControls!.y + mobileControls!.height).toBeLessThanOrEqual(
    mobileCanvas!.y + mobileCanvas!.height + 1,
  );
  await page.getByRole('button', { name: 'Manual mode' }).click();
  await expect(page.getByRole('region', { name: 'Manual battle controls' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
