import { test, expect } from '@playwright/test';
import { SKILL_BY_ID } from '@arena/game-data';
import { build } from 'tsup';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('all skill sprites animate, emit particles, pause, reduce motion, and clean up', async ({
  page,
}) => {
  const output = await mkdtemp(join(tmpdir(), 'arena-vfx-'));
  try {
    await build({
      entry: ['tests/fixtures/skill-vfx-preview.ts'],
      outDir: output,
      format: ['iife'],
      platform: 'browser',
      noExternal: [/./],
      silent: true,
      minify: true,
      config: false,
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1100, height: 1100 });
    await page.setContent('<html><body style="margin:0;background:#172d30"></body></html>');
    const glyphImage = await readFile('apps/frontend/public/assets/runedrake-ember-glyph.png');
    const bindBodyImage = await readFile('apps/frontend/public/assets/runedrake-bind-body.png');
    const bindHeadImage = await readFile('apps/frontend/public/assets/runedrake-bind-head.png');
    const victimImage = await readFile('apps/frontend/public/assets/charmander.svg');
    await page.evaluate(
      (assets) => {
        (window as any).emberGlyphAsset = assets.glyph;
        (window as any).bindBodyAsset = assets.body;
        (window as any).bindHeadAsset = assets.head;
        (window as any).bindVictimAsset = assets.victim;
      },
      {
        glyph: `data:image/png;base64,${glyphImage.toString('base64')}`,
        body: `data:image/png;base64,${bindBodyImage.toString('base64')}`,
        head: `data:image/png;base64,${bindHeadImage.toString('base64')}`,
        victim: `data:image/svg+xml;base64,${victimImage.toString('base64')}`,
      },
    );
    await page.addScriptTag({
      content: await readFile(join(output, 'skill-vfx-preview.global.js'), 'utf8'),
    });
    const inspect = () => page.evaluate(() => (window as any).vfxPreview.inspect());
    await page.waitForTimeout(500);
    await expect
      .poll(async () => (await inspect())?.sprites, { timeout: 10000 })
      .toBeGreaterThan(20);
    expect((await inspect()).frames).toEqual(
      Object.values(SKILL_BY_ID)
        .filter((skill) => skill.id !== 'tail-whip')
        .map((skill) => (skill.id === 'ember-glyph' ? 1 : 12)),
    );
    expect((await inspect()).puddles).toBe(1);
    expect((await inspect()).bindCoils).toBe(1);
    expect((await inspect()).bindLayers).toEqual([9, 14]);
    const earlyBodyPoints = (await inspect()).bindBodyPoints;
    await page.screenshot({ path: 'test-results/skill-vfx-wrap-preview.png' });
    const earlyHeadX = (await inspect()).bindHeadX;
    const earlyHeadY = (await inspect()).bindHeadY;
    await page.evaluate(() => {
      (window as any).vfxPreview.controls.bindElapsed = 0.84;
    });
    await expect.poll(async () => (await inspect()).bindHeadX).not.toBe(earlyHeadX);
    expect((await inspect()).bindBodyPoints).toBeGreaterThan(earlyBodyPoints);
    const smallCoilWidth = (await inspect()).bindCoilWidth;
    await page.evaluate(() => {
      (window as any).vfxPreview.controls.boundSpecies = 'runedrake';
    });
    await expect.poll(async () => (await inspect()).bindCoilWidth).toBeGreaterThan(smallCoilWidth);
    await page.evaluate(() => {
      (window as any).vfxPreview.controls.boundSpecies = 'charmander';
      (window as any).vfxPreview.controls.bindElapsed = 1.54;
    });
    await expect.poll(async () => (await inspect()).bindBodyPoints).toBeGreaterThan(240);
    expect((await inspect()).bindHeadY).toBeLessThan(earlyHeadY);
    await page.screenshot({
      path: 'test-results/skill-vfx-coiled-preview.png',
      clip: { x: 410, y: 485, width: 210, height: 170 },
    });
    const rightHeadX = (await inspect()).bindHeadX;
    await page.evaluate(() => {
      (window as any).vfxPreview.controls.bindFacing = -1;
    });
    await expect.poll(async () => (await inspect()).bindHeadX).toBeCloseTo(1020 - rightHeadX);
    await page.screenshot({
      path: 'test-results/skill-vfx-coiled-left-preview.png',
      clip: { x: 410, y: 485, width: 210, height: 170 },
    });
    await page.evaluate(() => {
      (window as any).vfxPreview.controls.bindFacing = 1;
    });
    const looseCoilWidth = (await inspect()).bindCoilWidth;
    await page.evaluate(() => {
      (window as any).vfxPreview.controls.bindElapsed = 3.04;
    });
    await expect.poll(async () => (await inspect()).bindCoilWidth).toBeLessThan(looseCoilWidth);
    expect((await inspect()).sludgeBombs).toBe(1);
    expect((await inspect()).sludgeTrails).toBe(2);
    await expect.poll(async () => (await inspect()).particles).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/skill-vfx-preview.png' });
    await page.evaluate(() => {
      (window as any).vfxPreview.controls.angle = Math.PI / 2;
    });
    await expect.poll(async () => (await inspect()).streamRotation).toBeGreaterThan(1.4);
    await page.evaluate(() => {
      (window as any).vfxPreview.controls.showLaser = true;
      (window as any).vfxPreview.controls.angle = 0;
    });
    await expect.poll(async () => (await inspect()).laserCores).toBe(2);
    expect((await inspect()).laserClashes).toBe(1);
    expect((await inspect()).laserMouths).toBe(1);
    await page.screenshot({ path: 'test-results/dragon-laser-preview.png' });
    await page.evaluate(() => {
      (window as any).vfxPreview.controls.paused = true;
    });
    await page.waitForTimeout(100);
    const paused = await inspect();
    await page.waitForTimeout(150);
    expect(await inspect()).toEqual(paused);
    await page.evaluate(() => {
      Object.assign((window as any).vfxPreview.controls, { paused: false, reduced: true });
    });
    await expect.poll(async () => (await inspect()).particles).toBe(0);
    await page.evaluate(() => {
      (window as any).vfxPreview.controls.clear = true;
    });
    await expect.poll(async () => (await inspect()).sprites).toBe(0);
    expect((await inspect()).bindCoils).toBe(0);
    expect((await inspect()).bindLayers).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
