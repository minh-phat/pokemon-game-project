import { test, expect, type Page } from '@playwright/test';
import { summonQualityOdds, SUMMON_GUARANTEES, type OwnedPet } from '@arena/shared-types';
function collection(attempts = 0, pets: OwnedPet[] = []) {
  return {
    attempts,
    pets,
    cost: 0,
    qualityOdds: summonQualityOdds(attempts),
    guarantees: SUMMON_GUARANTEES.map(({ quality, interval }) => ({
      quality,
      remaining: interval - (attempts % interval),
    })),
  };
}

const player = { id: 'test-summoner', name: 'LunaKaito', email: 'luna@example.com' };
async function mockAccount(page: Page, signedIn = false) {
  let session = signedIn;
  await page.route('**/auth/*', async (route) => {
    const action = new URL(route.request().url()).pathname.split('/').pop();
    if (action === 'pets') {
      await route.fulfill({ json: collection() });
      return;
    }
    if (action === 'login' || action === 'register') session = true;
    if (action === 'logout') session = false;
    await route.fulfill({ json: { user: session ? player : null } });
  });
}

async function expectStageFits(page: Page) {
  const result = await page.locator('.fantasy-home').evaluate((stage) => {
    const buttons = Array.from(stage.querySelectorAll('button')).filter(
      (button) => button.getClientRects().length > 0,
    );
    return {
      fits:
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
      outside: buttons
        .filter((button) => {
          const r = button.getBoundingClientRect();
          return r.x < 0 || r.y < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1;
        })
        .map((button) => button.textContent),
    };
  });
  expect(result).toEqual({ fits: true, outside: [] });
}

test('welcome layout, language persistence, functional entry and unavailable features', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockAccount(page);
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Triệu Hồi Sư', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng Nhập', exact: true })).toBeEnabled();
  // Let the compositor settle after viewport changes before capturing art.
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/summoner-welcome-desktop.png' });
  await page.getByRole('button', { name: 'Cộng Đồng', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Chưa khả dụng');
  await page.getByRole('button', { name: 'Đóng thông báo' }).click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Summoner', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Features', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('private online 1v1');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  for (const [width, height] of [
    [844, 390],
    [667, 375],
    [640, 360],
  ]) {
    await page.setViewportSize({ width, height });
    await expectStageFits(page);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  // Let the compositor settle after viewport changes before capturing art.
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/summoner-welcome-landscape.png' });
  await page.getByRole('button', { name: 'Play Now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'How will you play?' })).toBeVisible();
  await page.getByRole('button', { name: /YOUR PACE/ }).click();
  await expect(page.getByRole('heading', { name: 'Set the stage.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('register, restore lobby, use menus, change language and log out', async ({ page }) => {
  await mockAccount(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng Ký', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên nhà triệu hồi').fill(player.name);
  await dialog.getByLabel('Email', { exact: true }).fill(player.email);
  await dialog.getByLabel('Mật khẩu', { exact: true }).fill('summoner123');
  await dialog.getByLabel('Xác nhận mật khẩu').fill('different123');
  await dialog.getByRole('button', { name: 'Đăng Ký', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('không khớp');
  await dialog.getByLabel('Xác nhận mật khẩu').fill('summoner123');
  const request = page.waitForRequest('**/auth/register');
  await dialog.getByRole('button', { name: 'Đăng Ký', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({
    name: player.name,
    email: player.email,
    password: 'summoner123',
  });
  await expect(page.locator('.player-profile')).toContainText(player.name);
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.player-profile')).toContainText(player.name);
  // Let the compositor settle after viewport changes before capturing art.
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/summoner-lobby-landscape.png' });
  for (const [width, height] of [
    [1672, 941],
    [844, 390],
    [667, 375],
    [640, 360],
  ]) {
    await page.setViewportSize({ width, height });
    await expectStageFits(page);
  }
  await page.setViewportSize({ width: 1672, height: 941 });
  // Let the compositor settle after viewport changes before capturing art.
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/summoner-lobby-desktop.png' });
  for (const name of [
    'Hộp thư',
    'Bạn bè',
    'Vàng',
    'Kim cương',
    'Năng lượng',
    'Sự Kiện',
    'Điểm Danh',
    'Bảng Xếp Hạng',
    'Thành Tựu',
    'Nâng Cấp',
    'Cộng Đồng',
    'Cửa Hàng',
    'Nhiệm Vụ',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Chưa khả dụng');
    await page.getByRole('button', { name: 'Đóng thông báo' }).click();
  }
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: /Pets Discover/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Your Pets' })).toBeVisible();
  await expect(dialog).toContainText('No companions yet');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Team', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your companions.' })).toBeVisible();
  await page.getByRole('button', { name: 'Summoner home' }).click();
  await page.getByRole('button', { name: 'Your account' }).click();
  await dialog.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Log In', exact: true })).toBeVisible();
  await expect(page.locator('.player-profile')).toHaveCount(0);
});

test('login reports server failures and succeeds without inventing a session', async ({ page }) => {
  await mockAccount(page);
  await page.route('**/auth/login', (route) =>
    route.fulfill({ status: 401, json: { message: 'Email hoặc mật khẩu không đúng.' } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email', { exact: true }).fill(player.email);
  await dialog.getByLabel('Mật khẩu', { exact: true }).fill('wrong-password');
  await dialog.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Email hoặc mật khẩu không đúng');
  await expect(page.locator('.player-home')).toHaveCount(0);
  await page.unroute('**/auth/login');
  await dialog.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
  await expect(page.locator('.player-profile')).toContainText(player.name);
});

test('portrait remains usable and offers a dismissible landscape hint', async ({ page }) => {
  await mockAccount(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.player-profile')).toContainText(player.name);
  await expect(page.getByText('Xoay ngang điện thoại')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Đóng gợi ý' }).click();
  await expect(page.locator('.rotate-hint')).toHaveCount(0);
  // Let the compositor settle after viewport changes before capturing art.
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/summoner-lobby-portrait.png' });
  await page.getByRole('button', { name: /Chơi Bắt đầu hành trình/ }).click();
  await expect(page.getByRole('heading', { name: 'Bạn muốn chơi thế nào?' })).toBeVisible();
  await page.getByRole('button', { name: /HÀNH TRÌNH CỦA RIÊNG BẠN/ }).click();
  await expect(page.getByRole('heading', { name: 'Thiết lập trận đấu.' })).toBeVisible();
});

test('play opens a responsive mode popup, locks story mode and preserves both playable routes', async ({
  page,
}) => {
  await mockAccount(page);
  await page.goto('/');
  const play = page.getByRole('button', { name: 'Chơi Ngay', exact: true });
  await play.click();
  const dialog = page.getByRole('dialog', { name: 'Bạn muốn chơi thế nào?' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.fantasy-home')).toBeAttached();
  await expect(dialog.getByRole('button', { name: /Cốt truyện/ })).toBeDisabled();
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [640, 360],
  ]) {
    await page.setViewportSize({ width, height });
    const fits = await dialog.evaluate((element) => {
      const r = element.getBoundingClientRect();
      return (
        r.left >= 0 &&
        r.top >= 0 &&
        r.right <= innerWidth &&
        r.bottom <= innerHeight &&
        element.scrollWidth <= element.clientWidth
      );
    });
    expect(fits).toBe(true);
    await page.screenshot({ path: `test-results/play-mode-${width}x${height}.png` });
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(play).toBeVisible();
  await play.click();
  await dialog.getByRole('button', { name: /Đấu PvP/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Cùng nhau chiến đấu.' })).toBeVisible();
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Đấu với máy/ }).click();
  await expect(page.getByRole('heading', { name: 'Thiết lập trận đấu.' })).toBeVisible();
});

test('AI battle uses the Pokémon chosen for both teams', async ({ page }) => {
  const sheet = page.waitForResponse(
    (response) => response.url().endsWith('/assets/lam-quy-sheet.png') && response.ok(),
  );
  await mockAccount(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Play Now', exact: true }).click();
  await page.getByRole('button', { name: /YOUR PACE/ }).click();
  await page.getByLabel('Pokémon per team').selectOption('1');
  await page.getByRole('button', { name: 'Choose your Pokémon' }).click();
  await page.getByRole('button', { name: 'Add Lam Quy', exact: true }).click();
  await page.getByRole('button', { name: 'Choose AI Pokémon', exact: true }).click();
  await expect(page.getByRole('button', { name: /^AI team ·/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Choose AI Pokémon', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Add Charmander', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Charmander from slot 1' }).click();
  await page.getByRole('button', { name: 'Add Pikachu', exact: true }).click();
  await page.getByRole('button', { name: /^Your team ·/ }).click();
  await expect(page.getByRole('button', { name: 'Remove Lam Quy from slot 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter the arena', exact: true }).click();
  await expect(page.locator('.team-status').first()).toContainText('Lam Quy');
  await expect(page.locator('.enemy-status')).toContainText('Pikachu');
  await expect(page.locator('.enemy-status')).not.toContainText('Charmander');
  await sheet;
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled({
    timeout: 60000,
  });
  await page.screenshot({ path: 'test-results/lam-quy-battle.png' });
});

test('every summon grants a quality pet, milestones are visible and collection survives reload', async ({
  page,
}) => {
  await mockAccount(page, true);
  let attempts = 9;
  const pets: OwnedPet[] = [];
  await page.route('**/auth/pets', (route) => route.fulfill({ json: collection(attempts, pets) }));
  await page.route('**/auth/summon', (route) => {
    attempts++;
    const quality = attempts === 11 ? 'A' : 'C';
    const pet: OwnedPet = {
      id: `pet-${attempts}`,
      species: 'pikachu',
      quality,
      level: 1,
      acquiredAt: new Date().toISOString(),
    };
    pets.push(pet);
    return route.fulfill({ json: { ...collection(attempts, pets), received: pet } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Pets Khám phá/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Chưa có linh thú nào');
  await dialog.getByRole('button', { name: 'Triệu hồi ngay' }).click();
  await expect(dialog.locator('.summon-guarantees').locator('div').first()).toContainText(
    'Còn 2 lượt',
  );
  await dialog.getByRole('button', { name: 'Triệu hồi · 0 vàng' }).click();
  await expect(dialog.locator('.summon-result')).toContainText('Pikachu C');
  await expect(dialog.locator('.summon-result')).toContainText('Cấp 1');
  await expect(dialog).toContainText('Bảo đảm lượt tới!');
  await expect(dialog.locator('.summon-quality-odds > div').first()).toContainText('0%');
  await dialog.getByRole('button', { name: 'Triệu hồi · 0 vàng' }).click();
  await expect(dialog.locator('.summon-result')).toContainText('Pikachu A');
  await dialog.getByRole('button', { name: 'Triệu hồi · 0 vàng' }).click();
  await expect(dialog.locator('.summon-result')).toContainText('Pikachu C');
  await expect(dialog.locator('.summon-result')).toContainText('Cấp 1');
  await page.screenshot({ path: 'test-results/summon-quality-desktop.png' });
  await dialog.getByRole('button', { name: 'Pets (3)' }).click();
  await expect(dialog.locator('.owned-pet')).toHaveCount(3);
  await expect(dialog.locator('.pet-border-C')).toHaveCount(2);
  await expect(dialog.locator('.owned-pet-count')).toHaveCount(0);
  await expect(dialog.locator('.pet-level')).toHaveText(['Cấp 1', 'Cấp 1', 'Cấp 1']);
  await dialog.locator('.pet-border-A').click();
  await expect(dialog.getByRole('region', { name: 'Thông tin pet' })).toBeVisible();
  await expect(dialog.locator('.pet-detail-hero')).toContainText('Cấp 1');
  await expect(dialog.locator('.pet-detail-hero')).toContainText('Phẩm chất A');
  await expect(dialog.locator('.pet-detail-stats')).toContainText('Sinh lực');
  await expect(dialog.locator('.pet-detail-skills article')).not.toHaveCount(0);
  await dialog.getByRole('button', { name: 'Về bộ sưu tập' }).click();
  await expect(dialog.locator('.pet-border-A')).toBeFocused();
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [640, 360],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left >= 0 &&
          r.top >= 0 &&
          r.right <= innerWidth &&
          r.bottom <= innerHeight &&
          el.scrollWidth <= el.clientWidth
        );
      }),
    ).toBe(true);
    await page.screenshot({ path: `test-results/pets-individual-${width}.png` });
    await dialog.locator('.pet-border-A').click();
    await expect(dialog.locator('.pet-detail-hero')).toContainText('Cấp 1');
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/pet-details-${width}.png` });
    await dialog.getByRole('button', { name: 'Về bộ sưu tập' }).click();
  }
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: /Pets Khám phá/ }).click();
  await expect(dialog.locator('.pet-border-C')).toHaveCount(2);
  await expect(dialog.locator('.owned-pet')).toHaveCount(3);
  await expect(dialog.locator('.pet-border-A')).toContainText('Phẩm chất A');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Triệu Hồi', exact: true }).click();
  await expect(dialog.locator('.summon-stats')).toContainText('12');
  await page.route('**/auth/summon', (route) => route.fulfill({ status: 503, json: {} }));
  await dialog.getByRole('button', { name: 'Triệu hồi · 0 vàng' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await expect(dialog.locator('.summon-stats')).toContainText('12');
});
