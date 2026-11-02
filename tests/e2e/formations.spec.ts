import { test, expect } from '@playwright/test';
import { getMessageBytes, Protocol } from '@colyseus/core';
import { decode } from '@colyseus/schema';
import { unpack } from '@colyseus/msgpackr';
import { DEFAULT_RULES, type OwnedPet } from '@arena/shared-types';
import { MatchSelection } from '../../apps/game-server/src/match-selection';
import { BattleSession } from '../../apps/game-server/src/session';

for (const size of [3, 6, 'all'] as const) {
  test(`choose saved or new formations during the 30 seconds after matching: ${size}`, async ({
    page,
  }) => {
    if (size === 'all') await page.setViewportSize({ width: 390, height: 844 });
    const roster: OwnedPet[] = Array.from({ length: 7 }, (_, i) => ({
      id: `pet-${i}`,
      species: 'pikachu',
      level: i + 1,
      quality: 'C',
      experience: 0,
      acquiredAt: '2026-01-01T00:00:00Z',
    }));
    const savedIds = roster.slice(0, size === 'all' ? 2 : size).map((pet) => pet.id);
    const saved = { [`duel-${size}`]: savedIds };
    await page.addInitScript((formations) => {
      localStorage.setItem(
        'arena-preferences',
        JSON.stringify({ state: { formations: { 'formation-player': formations } }, version: 0 }),
      );
    }, saved);
    await page.route('**/auth/*', (route) =>
      route.fulfill({
        json: route.request().url().endsWith('/match-ticket')
          ? { token: 'test-ticket' }
          : { user: { id: 'formation-player', name: 'Summoner', email: 'player@example.com' } },
      }),
    );
    let formation: string[] = [];
    await page.route('**/matchmake/joinOrCreate/matchmaking', async (route) => {
      formation = route.request().postDataJSON().formation;
      await route.fulfill({
        json: {
          name: 'matchmaking',
          roomId: 'test-room',
          processId: 'test-process',
          sessionId: 'player',
        },
      });
    });
    const session = new BattleSession(
      'test-room',
      { ...DEFAULT_RULES, teamSize: size === 'all' ? 1 : size, duplicates: true },
      1,
      size === 'all',
    );
    session.prepareMatched([
      { id: 'player', name: 'Summoner' },
      { id: 'opponent', name: 'Opponent' },
    ]);
    let selection: MatchSelection | undefined;
    let sendSelection: (() => void) | undefined;
    await page.routeWebSocket(/\/test-process\/test-room\?/, (socket) => {
      sendSelection = () => {
        if (!selection) return;
        socket.send(getMessageBytes.raw(Protocol.ROOM_DATA, 'lobby', session.snapshot()));
        socket.send(
          getMessageBytes.raw(Protocol.ROOM_DATA, 'match-selection', selection.snapshot('player')),
        );
      };
      socket.onMessage((message) => {
        const bytes = new Uint8Array(Buffer.from(message));
        if (bytes[0] !== Protocol.ROOM_DATA) return;
        const it = { offset: 1 };
        const type = decode.string(bytes, it);
        const value = bytes.length > it.offset ? unpack(bytes, { start: it.offset }) : undefined;
        if (selection) {
          if (type === 'match-source') selection.selectSource('player', value, Date.now());
          if (type === 'match-select') selection.select('player', value, Date.now());
          if (type === 'match-ready') selection.ready('player', Date.now());
        }
        sendSelection?.();
      });
      socket.send(getMessageBytes[Protocol.JOIN_ROOM]('test-token', 'none'));
    });
    // Normalize the SDK's optional Node headers argument for Playwright's WebSocket interceptor.
    await page.addInitScript(() => {
      const NativeWebSocket = window.WebSocket;
      window.WebSocket = class extends NativeWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, typeof protocols === 'string' || Array.isArray(protocols) ? protocols : []);
        }
      };
    });
    await page.goto('/');
    await page.getByRole('button', { name: /^Đấu Trường/ }).click();
    const arena = page.getByRole('dialog', { name: 'Đấu trường', exact: true });
    await expect(arena.getByRole('button', { name: 'Chọn từ đội hình', exact: true })).toHaveCount(
      0,
    );
    await expect(arena.getByRole('button', { name: 'Chọn mới', exact: true })).toHaveCount(0);
    await arena
      .getByRole('button', { name: size === 'all' ? 'Toàn bộ' : `${size} thú`, exact: true })
      .click();
    await arena.getByRole('button', { name: 'Tìm trận', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đang tìm trận' })).toBeVisible();
    await expect.poll(() => formation).toEqual(savedIds);
    await expect.poll(() => Boolean(sendSelection)).toBe(true);
    selection = new MatchSelection(
      size,
      [
        { id: 'player', pets: roster, formation },
        { id: 'opponent', pets: roster },
      ],
      Date.now(),
    );
    sendSelection!();
    const screen = page.locator('.match-selection');
    await expect(screen.getByRole('heading', { name: 'Chọn đội hình ra trận' })).toBeVisible();
    await expect(page.locator('.match-search-popup')).toHaveCount(0);
    await expect(screen.getByRole('timer')).toContainText(/(29|30)s/);
    await expect(
      screen.getByRole('button', { name: 'Chọn từ đội hình', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.locator('.formation-order li')).toHaveCount(savedIds.length);
    await expect(
      screen.getByRole('button', { name: 'Xác nhận đội hình', exact: true }),
    ).toBeEnabled();
    await screen.getByRole('button', { name: 'Chọn mới', exact: true }).click();
    await expect(screen.locator('.formation-order li')).toHaveCount(0);
    const ids = Array.from({ length: size === 'all' ? 2 : size }, (_, i) => `pet-${6 - i}`);
    for (const id of ids) {
      await screen
        .locator('.match-selection-grid > button')
        .filter({ has: page.getByText(`Lv.${Number(id.split('-')[1]) + 1} · C`, { exact: true }) })
        .click();
    }
    await expect.poll(() => selection!.snapshot('player').selected).toEqual(ids);
    await screen.getByRole('button', { name: 'Xuống Pikachu', exact: true }).first().click();
    const reordered = [ids[1], ids[0], ...ids.slice(2)];
    await expect.poll(() => selection!.snapshot('player').selected).toEqual(reordered);
    await screen.getByRole('button', { name: 'Chọn từ đội hình', exact: true }).click();
    await expect.poll(() => selection!.snapshot('player').selected).toEqual(savedIds);
    await screen.getByRole('button', { name: 'Xác nhận đội hình', exact: true }).click();
    await expect(screen.getByRole('button', { name: 'Đã sẵn sàng', exact: true })).toBeDisabled();
    expect(selection!.snapshot('player').ready).toBe(true);
    expect(selection!.complete(Date.now())).toBe(false);
    const stored = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arena-preferences')!).state.formations['formation-player'],
    );
    expect(stored).toEqual(saved);
  });
}

for (const width of [1440, 390]) {
  test(`formations select, reorder, persist and keep separate presets at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/auth/*', (route) =>
      route.fulfill({
        json: route.request().url().endsWith('/pets')
          ? {
              pets: Array.from({ length: 7 }, (_, i) => ({
                id: `pet-${i}`,
                species: 'pikachu',
                level: i + 1,
                quality: 'C',
                experience: 0,
                acquiredAt: '2026-01-01T00:00:00Z',
              })),
            }
          : { user: { id: 'formation-player', name: 'Summoner', email: 'player@example.com' } },
      }),
    );
    const open = async () => {
      await page.getByRole('button', { name: 'Đội Hình', exact: true }).click();
      await expect(page.locator('.formation-pets > button')).toHaveCount(7);
    };
    await page.goto('/');
    await open();
    const dialog = page.getByRole('dialog');
    const cards = dialog.locator('.formation-pets > button');
    const save = dialog.getByRole('button', { name: 'Lưu đội hình', exact: true });
    await cards.nth(0).click();
    await expect(save).toBeDisabled();
    await cards.nth(1).click();
    await cards.nth(2).click();
    await expect(cards.nth(3)).toBeDisabled();
    await dialog.getByRole('button', { name: 'Xuống Pikachu', exact: true }).first().click();
    await expect(dialog.locator('.formation-order li').first()).toHaveAttribute(
      'data-formation-id',
      'pet-1',
    );
    if (width === 1440) {
      await dialog
        .locator('.formation-order li')
        .first()
        .dragTo(dialog.locator('.formation-order li').last());
      await expect(dialog.locator('.formation-order li').last()).toHaveAttribute(
        'data-formation-id',
        'pet-1',
      );
    }
    await dialog.getByRole('button', { name: '6 vs 6', exact: true }).click();
    await expect(dialog.locator('.formation-order li')).toHaveCount(0);
    for (let i = 0; i < 6; i++) await cards.nth(i).click();
    await dialog.getByRole('button', { name: 'Toàn trận', exact: true }).click();
    await cards.nth(6).click();
    await cards.nth(0).click();
    await dialog.getByRole('button', { name: 'Chiến thuật', exact: true }).click();
    await expect(dialog.locator('.formation-order li')).toHaveCount(0);
    await cards.nth(4).click();
    await save.click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await open();
    await expect(dialog.locator('.formation-order li')).toHaveCount(3);
    await dialog.getByRole('button', { name: 'Toàn trận', exact: true }).click();
    await expect(dialog.locator('.formation-order li').first()).toHaveAttribute(
      'data-formation-id',
      'pet-6',
    );
    await expect(dialog.locator('.formation-order li')).toHaveCount(2);
    await dialog.getByRole('button', { name: 'Bỏ chọn tất cả', exact: true }).click();
    await save.click();
    const stored = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arena-preferences')!).state.formations['formation-player'],
    );
    expect(stored['duel-all']).toEqual([]);
    expect(stored['duel-3']).toHaveLength(3);
    expect(stored['duel-6']).toHaveLength(6);
    expect(stored['tactics-all']).toEqual(['pet-4']);
  });
}
