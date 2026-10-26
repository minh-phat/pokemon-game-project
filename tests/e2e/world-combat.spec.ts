import { test, expect } from '@playwright/test';
import { createWorld, tileAt } from '@arena/game-data/world';
import {
  createWorldBattleArena,
  createRoamingWorldBattleArena,
} from '@arena/game-data/world-combat';
import { replayWorldEncounter } from '@arena/game-core';
import { gainExperience, wildBattleExperience } from '@arena/game-data';
import type { OwnedPet, WorldEncounterTicket, WorldBattleReward } from '@arena/shared-types';
test.use({ launchOptions: { args: [] }, actionTimeout: 15000 });

for (const mobile of [false, true]) {
  test(`world companion battle, manual controls, reward retry and contract (${mobile ? 'touch' : 'desktop'})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const world = createWorld(42);
    let pet: OwnedPet = {
      id: 'owned-one',
      species: 'pikachu',
      level: 1,
      quality: 'SS',
      experience: 90,
      acquiredAt: '2026-01-01',
    };
    let ticket: WorldEncounterTicket;
    let result: WorldBattleReward | undefined;
    let failOnce = true;
    let startCount = 0;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(
      (spawn) =>
        localStorage.setItem(
          'arena-open-world-v2',
          JSON.stringify({ version: 2, seed: 42, player: spawn, visited: [], seen: [] }),
        ),
      world.spawn,
    );
    await page.route('**/auth/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/auth/pets')
        return route.fulfill({
          json: { pets: [pet, ...(result?.captured ? [result.captured] : [])] },
        });
      if (path === '/auth/world/start') {
        startCount++;
        const body = route.request().postDataJSON();
        const wild = world.wildlife.find((w) => w.id === body.wildIds[0])!;
        ticket = {
          combatVersion: 5,
          arenaDefinition: createRoamingWorldBattleArena(world, wild),
          id: '00000000-0000-4000-8000-000000000002',
          seed: 777,
          pet: { ...pet },
          wild,
        };
        return route.fulfill({ json: ticket });
      }
      if (path === '/auth/world/finish') {
        if (failOnce) {
          failOnce = false;
          return route.fulfill({ status: 503, json: { message: 'Mất kết nối thử nghiệm' } });
        }
        const body = route.request().postDataJSON();
        const state = replayWorldEncounter(ticket!, body.actions, body.ticks);
        expect(state.result?.winner).toBe(0);
        expect(body.actions.some((action: { type: string }) => action.type === 'mode')).toBe(true);
        if (!result) {
          const experience = wildBattleExperience(ticket!.wild, true);
          pet = { ...pet, ...gainExperience(pet, experience) };
          result = { pet, experience, captured: null };
        }
        if (body.capture)
          result.captured = {
            id: 'captured',
            species: ticket!.wild.species,
            level: ticket!.wild.level,
            quality: ticket!.wild.quality,
            experience: 0,
            acquiredAt: '2026-01-01',
          };
        return route.fulfill({ json: result });
      }
      return route.fulfill({
        json: { user: { id: 'world-trainer', name: 'Trainer', email: 'world@example.com' } },
      });
    });
    await page.goto('/');
    await expect(page.locator('.player-home')).toBeVisible();
    await page.locator('.play-card').click();
    await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
    await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-position', /\d/);
    await page.getByRole('button', { name: 'Triệu hồi Pets' }).click();
    await page.locator('.world-pet-list button').first().click();
    await page.getByRole('button', { name: /Xong ·/ }).click();
    await expect(page.locator('.world-pets-toggle')).toContainText('Đội ra trận');
    await expect(page.locator('.world-discovery')).toContainText('Lv.1 · C');
    if (mobile) {
      const wild = world.wildlife.find(
        (w) => Math.hypot(w.home.x - world.spawn.x, w.home.y - world.spawn.y) < 1,
      )!;
      const viewport = page.viewportSize()!;
      const zoom = Math.max(2, viewport.width / 960, viewport.height / 600);
      const dx = wild.x - world.spawn.x,
        dy = wild.y - world.spawn.y;
      const elevation =
        tileAt(world, wild.x, wild.y)!.level - tileAt(world, world.spawn.x, world.spawn.y)!.level;
      await page.getByTestId('world-canvas').click({
        position: {
          x: viewport.width / 2 + (dx - dy) * 16 * zoom,
          y: viewport.height / 2 + ((dx + dy) * 8 - elevation * 8 - 13) * zoom,
        },
      });
    } else await page.getByRole('button', { name: 'Chọn mục tiêu' }).click();
    await page.getByRole('button', { name: 'Ra trận', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Chiến đấu thế giới mở' });
    await panel.getByRole('button', { name: 'Tự điều khiển', exact: true }).click();
    const controls = page.getByRole('region', { name: 'Manual battle controls' });
    await expect(controls).toBeVisible();
    if (mobile) {
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]) {
        await page.setViewportSize(viewport);
        await expect(controls).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(controls).toHaveCSS('background-image', 'none');
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await expect(page.locator('.world-map')).toBeHidden();
    await expect(page.locator('.world-toolbar')).toBeHidden();
    await expect(page.locator('.world-traversal')).toBeHidden();
    await expect(controls.getByRole('group', { name: 'Defense controls' })).toBeVisible();
    await controls.getByRole('button', { name: 'Guard · −20%', exact: true }).click();
    await expect(
      controls.getByRole('button', { name: 'Release guard', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    const canvas = page.getByTestId('world-canvas');
    if (mobile) {
      const stick = await controls.locator('.manual-stick-area').boundingBox();
      await page.mouse.move(stick!.x + stick!.width / 2, stick!.y + stick!.height / 2);
      await page.mouse.down();
      await page.mouse.move(stick!.x + stick!.width / 2, stick!.y + 1);
    } else await page.keyboard.down('w');
    await expect
      .poll(
        async () => Number((await canvas.getAttribute('data-combat-position'))?.split(',')[1]),
        { timeout: 15000 },
      )
      .toBeLessThan(-1300);
    if (mobile) await page.mouse.up();
    else await page.keyboard.up('w');
    await page.screenshot({
      path: `test-results/world-roaming-${mobile ? 'mobile' : 'desktop'}.png`,
    });
    await panel.getByRole('button', { name: 'Auto', exact: true }).click();
    await expect(page.getByText('Đang tải hiệu ứng chiến đấu…')).toHaveCount(0);
    await page.screenshot({
      path: `test-results/world-battle-${mobile ? 'mobile' : 'desktop'}.png`,
    });
    await expect(panel.getByRole('alert')).toContainText('Mất kết nối thử nghiệm', {
      timeout: 120000,
    });
    if (mobile) {
      await page.reload();
      await expect(page.locator('.player-home')).toBeVisible();
      await page.locator('.play-card').click();
      await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
    } else await panel.getByRole('button', { name: 'Thử lưu lại' }).click();
    await expect(panel).toContainText('+50 EXP');
    await expect(panel).toContainText('Cấp 2');
    await panel.getByRole('button', { name: /Lập khế ước/ }).click();
    await expect(panel).toContainText('Đã lập khế ước!');
    await panel.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await expect(panel).not.toBeVisible();
    await expect(page.locator('.world-map')).toBeVisible();
    await expect(page.locator('.world-toolbar')).toBeVisible();
    await expect(controls).toHaveCount(0);
    await page.locator('.world-pets-toggle').click();
    await expect(page.locator('.world-pet-list button')).toHaveCount(2);
    await expect(page.locator('.world-pet-list')).toContainText('Lv.2 · SS · 40/130 EXP');
    await page.locator('.world-pet-list button').filter({ hasText: 'Lv.1 · C' }).click();
    await page.getByRole('button', { name: /Xong ·/ }).click();
    await expect(page.locator('.world-pets-toggle')).toContainText('Đội ra trận');
    expect(startCount).toBe(1);
    expect(errors).toEqual([]);
  });
}

test('Auto renders arena sprites, charge, projectiles and impacts on the world without manual commands', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const world = createWorld(42);
  const pet: OwnedPet = {
    id: 'auto-pet',
    species: 'pikachu',
    quality: 'C',
    level: 1,
    experience: 0,
    acquiredAt: '',
  };
  await page.addInitScript((spawn) => {
    localStorage.setItem(
      'arena-open-world-v2',
      JSON.stringify({ version: 2, seed: 42, player: spawn, visited: [], seen: [] }),
    );
    const observations = {
      jump: false,
      dash: false,
      skills: [] as string[],
      effects: [] as string[],
      composites: 0,
    };
    (window as unknown as { combatObserved: typeof observations }).combatObserved = observations;
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ) {
      const source = args[0] as HTMLImageElement | HTMLCanvasElement;
      if (
        this.canvas.dataset.testid === 'world-canvas' &&
        source.dataset?.testid === 'world-arena-layer'
      )
        observations.composites++;
      if (this.canvas.dataset.testid === 'world-arena-layer' && args.length === 9) {
        if (Number(args[3]) === 160 && Number(args[4]) === 160) {
          const row = Number(args[2]) / 160;
          if (row === 2 || row === 3) observations.jump = true;
          if (row === 7 || row === 8) observations.dash = true;
        }
        const effect =
          source.dataset?.skillVfx ||
          (source instanceof HTMLImageElement && source.src.includes('electro-ball-art')
            ? 'electro-ball-art'
            : '');
        if (effect && !observations.effects.includes(effect)) observations.effects.push(effect);
      }
      return Reflect.apply(draw, this, args);
    } as typeof draw;
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof fill>
    ) {
      if (
        ['Electro Ball', 'Thunderbolt', 'Volt Tackle', 'Thunder Wave'].includes(args[0]) &&
        !observations.skills.includes(args[0])
      )
        observations.skills.push(args[0]);
      return Reflect.apply(fill, this, args);
    };
  }, world.spawn);
  await page.route('**/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/pets') return route.fulfill({ json: { pets: [pet] } });
    if (path === '/auth/world/start') {
      const wild = world.wildlife.find((w) => w.id === route.request().postDataJSON().wildIds[0])!;
      return route.fulfill({
        json: {
          combatVersion: 3,
          arenaDefinition: createWorldBattleArena(world, wild),
          id: '00000000-0000-4000-8000-000000000003',
          seed: 4,
          pet,
          wild,
        },
      });
    }
    return route.fulfill({
      json: { user: { id: 'auto-trainer', name: 'Trainer', email: 'auto@example.com' } },
    });
  });
  await page.goto('/');
  await expect(page.locator('.player-home')).toBeVisible();
  await page.locator('.play-card').click();
  await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
  await page.getByRole('button', { name: 'Triệu hồi Pets' }).click();
  await page.locator('.world-pet-list button').click();
  await page.getByRole('button', { name: /Xong ·/ }).click();
  await page.getByRole('button', { name: 'Chọn mục tiêu' }).click();
  await page.getByRole('button', { name: 'Ra trận', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Auto', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const value = (
            window as unknown as {
              combatObserved: {
                jump: boolean;
                dash: boolean;
                skills: string[];
                effects: string[];
                composites: number;
              };
            }
          ).combatObserved;
          return value;
        }),
      { timeout: 30000 },
    )
    .toMatchObject({
      jump: true,
      dash: true,
      effects: expect.arrayContaining([
        'skill-vfx-electro-ball',
        'skill-vfx-electro-charge',
        'skill-vfx-electro-impact',
      ]),
      skills: expect.arrayContaining(['Electro Ball']),
    });
  await expect(page.getByTestId('world-combat-action')).toBeVisible();
  const compositeCount = () =>
    page.evaluate(
      () =>
        (window as unknown as { combatObserved: { composites: number } }).combatObserved.composites,
    );
  expect(await compositeCount()).toBeGreaterThan(30);
  await page.getByRole('button', { name: 'Tạm dừng khám phá' }).click();
  const hp = await page.locator('progress[aria-label="Máu thú hoang"]').getAttribute('value');
  await page.waitForTimeout(700);
  await expect(page.locator('progress[aria-label="Máu thú hoang"]')).toHaveAttribute('value', hp!);
  await page.getByRole('button', { name: 'Tiếp tục khám phá' }).click();
  await page.screenshot({ path: 'test-results/world-auto-tactics-mobile.png' });
  await page.getByRole('button', { name: 'Rút lui · không nhận EXP' }).click();
  const stopped = await compositeCount();
  await page.waitForTimeout(250);
  expect(await compositeCount()).toBe(stopped);
  expect(errors).toEqual([]);
});

test('deploys six companions and drag-selects multiple enemies before fighting', async ({
  page,
}) => {
  const world = createWorld(42);
  const pets: OwnedPet[] = Array.from({ length: 6 }, (_, i) => ({
    id: `squad-${i}`,
    species: 'pikachu',
    level: 50,
    quality: 'SS',
    experience: 0,
    acquiredAt: '',
  }));
  let started: { petIds: string[]; wildIds: number[] } | undefined;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(
    (spawn) =>
      localStorage.setItem(
        'arena-open-world-v2',
        JSON.stringify({
          version: 2,
          seed: 42,
          player: spawn,
          visited: [],
          seen: [],
        }),
      ),
    world.spawn,
  );
  await page.route('**/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/pets') return route.fulfill({ json: { pets } });
    if (path === '/auth/world/start') {
      started = route.request().postDataJSON();
      const wilds = started!.wildIds.map((id) => world.wildlife.find((w) => w.id === id)!);
      return route.fulfill({
        json: {
          combatVersion: 4,
          id: '00000000-0000-4000-8000-000000000004',
          seed: 42,
          pet: pets[0],
          pets,
          wild: wilds[0],
          wilds,
          arenaDefinition: createWorldBattleArena(world, wilds[0]),
        },
      });
    }
    return route.fulfill({
      json: { user: { id: 'squad-trainer', name: 'Trainer', email: 'squad@example.com' } },
    });
  });
  await page.goto('/');
  await page.locator('.play-card').click();
  await page.getByRole('button', { name: /THIÊN NHIÊN KHÔNG NGỪNG/ }).click();
  const canvas = page.getByTestId('world-canvas');
  await expect(canvas).toHaveAttribute('data-position', /\d/);
  await page.getByRole('button', { name: 'Triệu hồi Pets' }).click();
  await page.getByRole('button', { name: 'Chọn tất cả', exact: true }).click();
  await expect(page.locator('.world-pet-list button[aria-pressed="true"]')).toHaveCount(6);
  await page.getByRole('button', { name: 'Xong · 6 thú' }).click();
  const before = await canvas.getAttribute('data-position');
  await page.mouse.move(430, 300);
  await page.mouse.down();
  await page.mouse.move(1050, 760, { steps: 12 });
  await page.mouse.up();
  const selection = page.getByRole('complementary', { name: 'Mục tiêu đã chọn' });
  await expect(selection).toBeVisible();
  const count = Number((await selection.locator('strong').innerText()).match(/\d+/)![0]);
  expect(count).toBeGreaterThan(1);
  expect(await canvas.getAttribute('data-position')).toBe(before);
  await page.screenshot({ path: 'test-results/world-squad-selection.png' });
  await page.getByRole('button', { name: 'Ra trận', exact: true }).click();
  await expect.poll(() => started?.petIds.length).toBe(6);
  expect(started!.wildIds).toHaveLength(count);
  await expect(page.locator('.world-rosters')).toContainText(`Đội bạn: 6 · Quái: ${count}`);
  await expect(page.getByText('Đang tải hiệu ứng chiến đấu…')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/world-squad-battle.png' });
  expect(errors).toEqual([]);
});
