import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// A fixed, crowded snapshot isolates rendering from networking and simulation.
// Usage: node scripts/benchmark-battle-render.mjs [auto|canvas|webgl] [even fighter count]
const renderer = process.argv[2] ?? 'auto';
if (!['auto', 'canvas', 'webgl'].includes(renderer))
  throw new Error('Expected auto, canvas or webgl');
const fighters = Number(process.argv[3] ?? 100);
if (!Number.isInteger(fighters) || fighters < 2 || fighters > 1000 || fighters % 2)
  throw new Error('Expected an even fighter count between 2 and 1000');
const bundle = await build({
  stdin: {
    contents: `
      import Phaser from 'phaser';
      import { createArenaScene } from './apps/frontend/src/game/arena-scene';
      import { battleRenderer } from './apps/frontend/src/game/battle-renderer';
      import { battleFeed } from './apps/frontend/src/lib/battle-feed';
      import { useGame } from './apps/frontend/src/lib/store';
      import { initializeBattle } from '@arena/game-core';
      import { FULL_ROSTER_ARENA, SKILL_BY_ID } from '@arena/game-data';
      import { DEFAULT_RULES, speciesIds } from '@arena/shared-types';
      const team = Array.from({length: ${fighters / 2}}, (_, i) => speciesIds[i % speciesIds.length]);
      const engine = initializeBattle({
        rules: {...DEFAULT_RULES, teamSize: 1, activeSize: 1, duplicates: true, switching: false, duration: 0},
        players: ['a', 'b'], teams: [team, team], fullRoster: true,
        arenaDefinition: FULL_ROSTER_ARENA, aiTeams: [0, 1],
      }, 42);
      engine.startBattle();
      for (const [i, f] of engine.state.fighters.entries()) {
        f.active = true; f.x = 2820 + (i % 10) * 40; f.depth = -40 + Math.floor((i % 100) / 10) * 18;
        f.animation = 'idle'; f.invulnerable = 0;
        if (i % 3 === 0) f.effects = [{kind: 'burn', duration: 100, strength: 1}];
        if (f.species === 'squirtle') {
          f.cast = {skillId: 'hydro-crossfire', elapsed: SKILL_BY_ID['hydro-crossfire'].startup + .6, fired: 1, hitIds: []};
        }
      }
      useGame.getState().set({mode: 'ai', muted: true});
      battleFeed.latest = engine.state;
      const Scene = createArenaScene('forest', () => {window.ready = true}, message => {throw new Error(message)}, undefined, undefined, true);
      const game = new Phaser.Game({
        ...${renderer === 'auto' ? 'battleRenderer(Phaser, true)' : `{type: Phaser.${renderer === 'webgl' ? 'WEBGL' : 'CANVAS'}}`}, width: 1440, height: 900,
        scene: Scene, audio: {noAudio: true}, banner: false,
        render: {antialias: true, pixelArt: false}, fps: {target: 60},
      });
      window.measure = async (zoom) => {
        const scene = game.scene.scenes[0];
        scene.manualCamera = {x: 3000, y: 600, zoom};
        await new Promise(resolve => setTimeout(resolve, 700));
        const frames = [], updates = [], renders = [];
        const originalUpdate = scene.sys.sceneUpdate;
        scene.sys.sceneUpdate = function(...args) {const start = performance.now(); originalUpdate.apply(this, args); updates.push(performance.now() - start)};
        const originalRender = game.renderer.render;
        game.renderer.render = function(...args) {const start = performance.now(); originalRender.apply(this, args); renders.push(performance.now() - start)};
        let last = performance.now();
        const start = last;
        await new Promise(resolve => {
          const sample = now => {frames.push(now - last); last = now; if(now - start < 4000) requestAnimationFrame(sample); else resolve()};
          requestAnimationFrame(sample);
        });
        scene.sys.sceneUpdate = originalUpdate; game.renderer.render = originalRender;
        const summary = values => {
          values.sort((a,b)=>a-b);
          return {mean: +(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2), p95: +values[Math.floor(values.length*.95)].toFixed(2)};
        };
        return {renderer: game.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas', zoom: scene.cameras.main.zoom, frames: frames.length, frameMs: summary(frames), updateMs: summary(updates), renderMs: summary(renders), actors: scene.actors.size, effects: scene.skillVfx.attached.size};
      };
      window.checkBars = async () => {
        const scene = game.scene.scenes[0];
        const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const f = engine.state.fighters[0];
        const actor = scene.actors.get(f.id);
        const hp = f.hp;
        f.hp = hp / 2;
        f.energy = 0;
        f.stamina = 0;
        await settle();
        if (Math.abs(actor.rosterBars.hp.scaleX - .5) > .001 || actor.rosterBars.energy.scaleX !== 0 || actor.rosterBars.stamina.scaleX !== 0 || actor.rosterBars.stamina.frame.name !== 'tired') throw new Error('Incorrect status bar values');
        scene.manualCamera = {x: 600, y: 600, zoom: 3.2};
        await settle();
        if (actor.sprite.visible || actor.rosterBars.background.visible || actor.rosterBars.hp.visible) throw new Error('Offscreen actor still visible');
        scene.manualCamera = {x: 3000, y: 600, zoom: 3.2};
        await settle();
        if (!actor.sprite.visible || !actor.rosterBars.hp.visible) throw new Error('Actor did not return after panning');
        f.hp = 0;
        await settle();
        if (actor.rosterBars.background.visible || actor.rosterBars.hp.visible) throw new Error('Fainted actor kept bars');
        return 'status values, culling, reentry and fainting passed';
      };
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  alias: { '@': resolve('apps/frontend/src') },
  define: { 'process.env.NODE_ENV': '"test"' },
  logLevel: 'silent',
});
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'darwin' ? 'chrome' : undefined),
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('http://battle.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/')
      return route.fulfill({ contentType: 'text/html', body: '<body style="margin:0"></body>' });
    await route.fulfill({ path: resolve('apps/frontend/public', '.' + path) });
  });
  await page.goto('http://battle.test/');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.waitForFunction(() => window.ready, undefined, { timeout: 60000 });
  const results = [];
  for (const zoom of [0.24, 3.2]) {
    results.push(await page.evaluate((zoom) => window.measure(zoom), zoom));
  }
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: `test-results/battle-render-${renderer}.png` });
  const checks = await page.evaluate(() => window.checkBars());
  if (errors.length) throw new Error(errors.join('\n'));
  const report = JSON.stringify({ renderer, fighters, checks, results }, null, 2);
  await writeFile(`test-results/battle-render-${renderer}.json`, report);
  console.log(report);
} finally {
  await browser.close();
}
