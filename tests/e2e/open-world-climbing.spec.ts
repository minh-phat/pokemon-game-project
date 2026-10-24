import { test, expect, type Page } from '@playwright/test';
import { createWorld, tileAt, traversable } from '../../apps/frontend/src/game/open-world-world';

test.use({ launchOptions: { args: [] } });
const world = createWorld(42);
function ledge() {
  for (let y = Math.floor(world.spawn.y) - 32; y < world.spawn.y + 32; y++)
    for (let x = Math.floor(world.spawn.x) - 32; x < world.spawn.x + 32; x++) {
      const a = tileAt(world, x, y)!,
        b = tileAt(world, x + 1, y)!;
      if (
        !a.water &&
        !b.water &&
        b.level - a.level >= 3 &&
        b.level - a.level <= 6 &&
        traversable(world, x + 0.5, y + 0.5) &&
        traversable(world, x + 1.5, y + 0.5)
      )
        return { x: x + 0.78, y: y + 0.5, from: a.level, to: b.level };
    }
  throw new Error('No natural climbable ledge');
}
const edge = ledge();
async function enter(page: Page) {
  await page.addInitScript(
    ({ x, y }) =>
      localStorage.setItem(
        'arena-open-world-v2',
        JSON.stringify({
          version: 2,
          seed: 42,
          player: { x, y },
          seen: [],
          visited: [],
        }),
      ),
    edge,
  );
  await page.route('**/auth/*', (r) => r.fulfill({ json: { user: null } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Chơi Ngay', exact: true }).click();
  await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-art-ready', 'true');
}

test('river valleys and snowy ridges expose height and preserve travel after climbing', async ({
  page,
}) => {
  await enter(page);
  for (const [name, file] of [
    ['Dòng nước bạc', 'valley'],
    ['Đỉnh tuyết trắng', 'mountain'],
  ] as const) {
    await page.getByRole('button', { name: 'Mở bản đồ', exact: true }).click();
    await page.getByRole('button', { name: `Dịch chuyển đến ${name}` }).click();
    await expect(page.locator('.world-location h2')).toHaveText(name);
    await expect(page.getByTestId('world-elevation')).toContainText(/\d+ m/);
    if (file === 'valley') {
      await expect(page.getByTestId('world-elevation')).toContainText('Thung lũng');
      await expect(page.getByRole('button', { name: 'Nhảy', exact: true })).toBeDisabled();
    } else await expect(page.getByRole('button', { name: 'Nhảy', exact: true })).toBeEnabled();
    await page.screenshot({ path: `test-results/open-world-${file}-v3.png` });
  }
});

test('Space jumps, pause freezes flight, and E climbs an actual generated cliff', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enter(page);
  const canvas = page.getByTestId('world-canvas');
  await canvas.focus();
  await page.keyboard.press('Space');
  await expect(canvas).toHaveAttribute('data-action', 'jump');
  expect(Number(await canvas.getAttribute('data-elevation'))).toBeGreaterThan(edge.from);
  await page.screenshot({ path: 'test-results/open-world-jump.png' });
  await page.getByRole('button', { name: 'Tạm dừng khám phá' }).click();
  const frozen = await canvas.getAttribute('data-elevation');
  await page.waitForTimeout(350);
  await expect(canvas).toHaveAttribute('data-elevation', frozen!);
  await page.getByRole('button', { name: 'Tiếp tục khám phá' }).click();
  await expect(canvas).toHaveAttribute('data-action', 'walk');
  await expect(canvas).toHaveAttribute('data-elevation', edge.from.toFixed(2));
  await canvas.focus();
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  await expect(canvas).toHaveAttribute('data-action', 'blocked');
  expect(Math.floor(Number((await canvas.getAttribute('data-position'))!.split(',')[0]))).toBe(
    Math.floor(edge.x),
  );
  await page.keyboard.down('e');
  await expect(canvas).toHaveAttribute('data-action', 'climb');
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  await page.keyboard.up('e');
  await page.screenshot({ path: 'test-results/open-world-climb.png' });
  await expect(canvas).toHaveAttribute('data-action', 'walk');
  await expect(canvas).toHaveAttribute('data-ground-level', String(edge.to));
  await expect(canvas).toHaveAttribute('data-elevation', edge.to.toFixed(2));
  expect(Math.floor(Number((await canvas.getAttribute('data-position'))!.split(',')[0]))).toBe(
    Math.floor(edge.x) + 1,
  );
  await page.getByRole('button', { name: 'Về trại', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-ground-level', String(world.campLevel));
  expect(errors).toEqual([]);
});

test('touch jump and held climb work with simultaneous joystick input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const canvas = page.getByTestId('world-canvas');
  await page.getByRole('button', { name: 'Nhảy', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-action', 'jump');
  await expect(canvas).toHaveAttribute('data-action', 'walk');
  const climb = page.getByRole('button', { name: 'Giữ để leo' });
  const climbBox = (await climb.boundingBox())!;
  const stick = page.getByRole('group', { name: 'Cần điều khiển di chuyển' });
  const box = (await stick.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const finger = { id: 1, x: climbBox.x + climbBox.width / 2, y: climbBox.y + climbBox.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [finger, { id: 2, x: box.x + box.width / 2 + 23, y: box.y + box.height / 2 + 23 }],
  });
  await expect(canvas).toHaveAttribute('data-action', 'climb');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect(climb).toHaveAttribute('aria-pressed', 'false');
  await expect(canvas).toHaveAttribute('data-action', 'walk');
  await expect(canvas).toHaveAttribute('data-ground-level', String(edge.to));
  await page.screenshot({ path: 'test-results/open-world-climb-mobile.png' });
});
