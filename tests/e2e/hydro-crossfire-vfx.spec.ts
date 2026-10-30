import { test, expect } from '@playwright/test';
import { build } from 'tsup';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

for (const renderer of ['canvas', 'webgl']) {
  test(`Hydro Crossfire charge, flow, release and impact lifecycle (${renderer})`, async ({
    page,
  }) => {
    const output = await mkdtemp(join(tmpdir(), 'hydro-vfx-'));
    try {
      await build({
        entry: ['tests/fixtures/hydro-crossfire-preview.ts'],
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
      await page.setViewportSize({ width: 720, height: 640 });
      await page.setContent('<body style="margin:0;background:#29453e">');
      await page.evaluate((value) => {
        (window as any).hydroRenderer = value;
      }, renderer);
      await page.evaluate(
        (data) => {
          (window as any).hydroOrbData = data;
        },
        `data:image/png;base64,${(await readFile('apps/frontend/public/assets/aqua-barrage-orb.png')).toString('base64')}`,
      );
      await page.addScriptTag({
        content: await readFile(join(output, 'hydro-crossfire-preview.global.js'), 'utf8'),
      });
      const inspect = () => page.evaluate(() => (window as any).hydroPreview?.inspect());
      await expect.poll(async () => (await inspect())?.streams).toBe(1);
      for (const elapsed of [0.15, 0.32, 0.7, 1.55, 3.3, 3.45]) {
        await page.evaluate((value) => {
          (window as any).hydroPreview.controls.elapsed = value;
        }, elapsed);
        if (elapsed === 1.55)
          await expect.poll(async () => (await inspect()).orbs).toBeGreaterThan(40);
        await page.waitForTimeout(70);
        await page.screenshot({ path: `test-results/hydro-${renderer}-${elapsed}.png` });
      }
      await page.evaluate(() => {
        const preview = (window as any).hydroPreview;
        preview.controls.elapsed = 1.55;
        preview.controls.paused = true;
        preview.hit();
      });
      await expect.poll(async () => (await inspect()).impacts).toBe(1);
      await expect.poll(async () => (await inspect()).orbs).toBeGreaterThan(40);
      const paused = await inspect();
      await page.waitForTimeout(120);
      expect(await inspect()).toEqual(paused);
      await page.screenshot({ path: `test-results/hydro-${renderer}-impact.png` });
      await page.evaluate(() => {
        Object.assign((window as any).hydroPreview.controls, { paused: false, reduced: true });
      });
      await expect.poll(async () => (await inspect()).impacts).toBe(0);
      expect((await inspect()).particles).toBe(0);
      await page.screenshot({ path: `test-results/hydro-${renderer}-reduced.png` });
      await page.evaluate(() => {
        (window as any).hydroPreview.controls.clear = true;
      });
      await expect.poll(async () => (await inspect()).streams).toBe(0);
      expect((await inspect()).orbs).toBe(0);
      await page.evaluate(() => (window as any).hydroPreview.destroy());
      expect(errors).toEqual([]);
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });
}
