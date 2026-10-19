import { test, expect } from '@playwright/test';
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
    await page.setContent('<html><body style="margin:0;background:#172d30"></body></html>');
    await page.addScriptTag({
      content: await readFile(join(output, 'skill-vfx-preview.global.js'), 'utf8'),
    });
    const inspect = () => page.evaluate(() => (window as any).vfxPreview.inspect());
    await expect.poll(async () => (await inspect())?.sprites).toBe(24);
    expect((await inspect()).frames).toEqual(Array(18).fill(12));
    await expect.poll(async () => (await inspect()).particles).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/skill-vfx-preview.png' });
    await page.evaluate(() => {
      (window as any).vfxPreview.controls.angle = Math.PI / 2;
    });
    await expect.poll(async () => (await inspect()).streamRotation).toBeGreaterThan(1.4);
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
    expect(errors).toEqual([]);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
