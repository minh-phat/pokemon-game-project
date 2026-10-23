import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = process.cwd();
const result = await build({
  stdin: {
    contents: `
    import Phaser from 'phaser';
    import { createArenaScene } from './apps/frontend/src/game/arena-scene';
    import { battleFeed } from './apps/frontend/src/lib/battle-feed';
    import { useGame } from './apps/frontend/src/lib/store';
    import { initializeBattle } from '@arena/game-core';
    import { DEFAULT_RULES } from '@arena/shared-types';
    const engine = initializeBattle({rules: {...DEFAULT_RULES, teamSize: 1, activeSize: 1}, players: ['a','b'], teams: [['water-slime'],['charmander']]}, 5);
    engine.startBattle();
    const [slime, enemy] = engine.state.fighters;
    slime.invulnerable = enemy.invulnerable = 0;
    slime.x = 470; enemy.x = 650; slime.depth = enemy.depth = 0;
    useGame.getState().set({ mode: 'ai', muted: true });
    battleFeed.latest = engine.state;
    const Scene = createArenaScene('forest', () => {window.ready = true}, e => {throw new Error(e)});
    const game = new Phaser.Game({type: Phaser.CANVAS, width: 1200, height: 760, scene: [Scene], audio: {noAudio: true}});
    window.preview = {
      show(skill, elapsed, enemyView = false) {
        slime.effects = []; slime.cast = null; slime.animation = 'idle'; slime.animationTime = elapsed;
        useGame.getState().set({mode: enemyView ? 'online' : 'ai', sessionId: 'b', lobby: enemyView ? {players: [{id:'a'}, {id:'b'}]} : null});
        if (skill === 'water-veil') slime.effects = [{kind:'invisible',duration: 5-elapsed,strength:1}];
        else if (skill) { slime.cast = {skillId:skill,elapsed, fired:0,hitIds:[],bound:skill==='liquid-wrap',targetId:enemy.id}; slime.animation = skill==='liquid-guard' ? 'guard' : skill==='water-orb' ? 'cast' : 'attack'; }
      },
      inspect() {const scene=game.scene.scenes[0]; const v=scene.actors.get(slime.id); return {alpha: v.sprite.alpha, frame:v.sprite.frame.name, shadow:v.shadow.visible, label:v.label.visible, ring:v.ring.visible, bars:v.bars.commandBuffer.length, textures:scene.textures.get('water-slime').frameTotal, wrap: [...scene.skillVfx.attached.keys()].some(k=>k.startsWith('liquid-wrap'))}; }
    };
  `,
    resolveDir: root,
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
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('http://slime.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/')
      return route.fulfill({ contentType: 'text/html', body: '<body style="margin:0"></body>' });
    try {
      await route.fulfill({ path: resolve('apps/frontend/public', '.' + path) });
    } catch {
      await route.abort();
    }
  });
  await page.goto('http://slime.test/');
  await page.addScriptTag({ content: result.outputFiles[0].text });
  await page.waitForFunction(() => window.ready && window.preview.inspect().textures > 0);
  await mkdir('test-results/water-slime', { recursive: true });
  for (const [skill, elapsed] of [
    ['spring-tackle', 0.22],
    ['water-orb', 0.4],
    ['liquid-guard', 1.2],
    ['liquid-wrap', 1.3],
    ['water-veil', 1],
  ]) {
    await page.evaluate(([s, t]) => window.preview.show(s, t), [skill, elapsed]);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `test-results/water-slime/${skill}.png` });
    const state = await page.evaluate(() => window.preview.inspect());
    console.log(skill, state);
    if (skill === 'liquid-wrap' && !state.wrap) throw new Error('Missing liquid wrap');
    if (skill === 'water-veil' && Math.abs(state.alpha - 0.28) > 0.01)
      throw new Error('Owner cannot see faint slime');
  }
  await page.evaluate(() => window.preview.show('water-veil', 1, true));
  await page.waitForTimeout(100);
  const hidden = await page.evaluate(() => window.preview.inspect());
  if (hidden.alpha !== 0 || hidden.shadow || hidden.label || hidden.ring || hidden.bars)
    throw new Error('Invisible enemy leaked visuals: ' + JSON.stringify(hidden));
  await page.screenshot({ path: 'test-results/water-slime/enemy-invisible.png' });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Water Slime browser checks passed.');
} finally {
  await browser.close();
}
