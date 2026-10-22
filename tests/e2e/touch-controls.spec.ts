import { expect, test } from '@playwright/test';

test.use({ hasTouch: true });

test('touch controls stay round, reachable and separated on phones and tablets', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Play Now' }).click();
  await page.getByRole('button', { name: /YOUR PACE/ }).click();
  await page.getByLabel('Pokémon per team', { exact: true }).selectOption('4');
  await page.getByLabel('Active at once', { exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Choose your Pokémon', exact: true }).click();
  for (const name of ['Bulbasaur', 'Eevee', 'Pikachu', 'Charmander'])
    await page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Enter the arena', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled({
    timeout: 60000,
  });
  // Freeze the simulation and hide the overlay to inspect the controls underneath.
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.addStyleTag({ content: '.arena-overlay { visibility: hidden; }' });
  await expect(page.locator('.manual-skills button')).toHaveCount(5);

  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [844, 390],
    [768, 1024],
    [1024, 768],
    [1366, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    // Allow Phaser's resize observer and the compositor to settle before capturing the viewport.
    await page.waitForTimeout(250);
    const layout = await page.locator('.manual-controls').evaluate((controls) => {
      const buttons = Array.from(controls.querySelectorAll('button'));
      const boxes = buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          radius: getComputedStyle(button).borderRadius,
        };
      });
      const stick = controls.querySelector('.manual-stick-area')!.getBoundingClientRect();
      return {
        boxes,
        stick: { x: stick.x, y: stick.y, width: stick.width, height: stick.height },
        scrolls: controls.scrollHeight > controls.clientHeight,
        background: getComputedStyle(controls).backgroundColor,
      };
    });
    expect(layout.scrolls).toBe(false);
    expect(layout.background).toBe('rgba(0, 0, 0, 0)');
    for (const box of layout.boxes) {
      expect(box.radius).toBe('50%');
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.width).toBe(box.height);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    const boxes = [...layout.boxes, layout.stick];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        expect(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
        ).toBe(true);
      }
    await page.screenshot({ path: `test-results/touch-controls-${width}x${height}.png` });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  const dash = page.getByRole('button', { name: 'Dash · 15', exact: true });
  await expect(dash).toBeEnabled();
  const stick = (await page.locator('.manual-stick-area').boundingBox())!;
  const dodge = (await dash.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const left = { x: stick.x + stick.width * 0.75, y: stick.y + stick.height / 2, id: 1 };
  const right = { x: dodge.x + dodge.width / 2, y: dodge.y + dodge.height / 2, id: 2 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left] });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [left, right],
  });
  const stamina = page
    .locator('.team-status')
    .first()
    .getByRole('progressbar', { name: 'Bulbasaur stamina' });
  await expect
    .poll(async () => Number(await stamina.getAttribute('aria-valuenow')))
    .toBeLessThan(95);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.manual-stick-knob')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 0)',
  );
  await page.screenshot({ path: 'test-results/touch-controls-playing.png' });
});
