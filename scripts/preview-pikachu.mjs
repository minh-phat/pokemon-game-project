import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const result = await build({
  stdin: {
    contents: `
      import Phaser from 'phaser';
      import {createArenaScene} from './apps/frontend/src/game/arena-scene';
      import {battleFeed} from './apps/frontend/src/lib/battle-feed';
      import {useGame} from './apps/frontend/src/lib/store';
      import {initializeBattle} from '@arena/game-core';
      import {DEFAULT_RULES} from '@arena/shared-types';
      import {SKILL_BY_ID} from '@arena/game-data';
      const engine=initializeBattle({rules:{...DEFAULT_RULES,teamSize:1,activeSize:1},players:['a','b'],teams:[['pikachu'],['charmander']]},5);
      engine.startBattle();
      const [f,enemy]=engine.state.fighters;
      f.x=470;enemy.x=850;f.depth=enemy.depth=0;f.invulnerable=enemy.invulnerable=0;
      useGame.getState().set({mode:'ai',muted:true,paused:false,reducedMotion:false});
      battleFeed.latest=engine.state;
      const Scene=createArenaScene('forest',()=>{window.ready=true},e=>{throw new Error(e)});
      const game=new Phaser.Game({type:Phaser.CANVAS,width:1200,height:760,fps:{target:60,forceSetTimeOut:true},scene:[Scene],audio:{noAudio:true}});
      window.preview={
        show(animation,skillId=null,elapsed=0){f.animation=animation;f.animationTime=0;f.cast=skillId?{skillId,elapsed,fired:0,hitIds:[]}:null;},
        face(value){f.facing=value;f.vx=value*100;f.vDepth=0;},
        heading(x,y){f.vx=x;f.vDepth=y;},
        settings(value){useGame.getState().set(value);},
        freezeFrame(frame){useGame.getState().set({paused:true});game.scene.scenes[0].actors.get(f.id).sprite.setFrame(frame);},
        startup(id){return SKILL_BY_ID[id].startup;},
        inspect(){const scene=game.scene.scenes[0];const v=scene.actors.get(f.id);if(!v)return null;return {texture:v.sprite.texture.key,frame:Number(v.sprite.frame.name),flip:v.sprite.flipX,paused:v.sprite.anims.isPaused,wanted:f.animation,last:v.lastAnimation,active:f.active,frames:scene.textures.get('pikachu').frameTotal};}
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
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('http://fire.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/')
      return route.fulfill({ contentType: 'text/html', body: '<body style="margin:0"></body>' });
    try {
      await route.fulfill({ path: resolve('apps/frontend/public', '.' + path) });
    } catch {
      await route.abort();
    }
  });
  await page.goto('http://fire.test/');
  await page.addScriptTag({ content: result.outputFiles[0].text });
  await page.waitForFunction(() => window.ready && window.preview.inspect()?.frames === 91);
  await mkdir('test-results/pikachu', { recursive: true });
  const names = [
    'idle',
    'run',
    'jump',
    'fall',
    'land',
    'attack',
    'cast',
    'dash',
    'backstep',
    'crouch',
    'guard',
    'hit',
    'knockback',
    'faint',
    'victory',
  ];
  for (const [row, name] of names.entries()) {
    await page.evaluate((name) => window.preview.show(name), name);
    await page.waitForFunction(
      (row) => {
        const frame = window.preview.inspect().frame;
        return frame >= row * 6 && frame <= row * 6 + 5;
      },
      row,
      { timeout: 15000 },
    );
    const { frame } = await page.evaluate(() => window.preview.inspect());
    if (frame < row * 6 || frame > row * 6 + 5)
      throw new Error(
        `Wrong row for ${name}: ${JSON.stringify(await page.evaluate(() => window.preview.inspect()))}; errors ${errors.join(' | ')}`,
      );
  }
  for (const [x, y, row, flip] of [
    [100, 0, 1, false],
    [100, 100, 4, false],
    [0, 100, 5, false],
    [-100, 100, 4, true],
    [-100, 0, 1, true],
    [-100, -100, 3, true],
    [0, -100, 2, false],
    [100, -100, 3, false],
  ]) {
    await page.evaluate(
      ({ x, y }) => {
        window.preview.heading(x, y);
        window.preview.show('run');
      },
      { x, y },
    );
    await page.waitForFunction(
      ({ row, flip }) => {
        const p = window.preview.inspect();
        return (
          p.texture === 'pikachu-directions' && Math.floor(p.frame / 6) === row && p.flip === flip
        );
      },
      { row, flip },
    );
  }
  await page.evaluate(() => {
    window.preview.face(1);
    window.preview.show('run');
  });
  await page.waitForTimeout(80);
  const first = await page.evaluate(() => window.preview.inspect().frame);
  await page.waitForFunction((first) => window.preview.inspect().frame !== first, first);
  await page.evaluate(() => window.preview.settings({ paused: true }));
  await page.waitForTimeout(60);
  const paused = await page.evaluate(() => window.preview.inspect().frame);
  await page.waitForTimeout(150);
  if (paused !== (await page.evaluate(() => window.preview.inspect().frame)))
    throw new Error('Pause moved');
  await page.evaluate(() => window.preview.settings({ paused: false, reducedMotion: true }));
  await page.waitForFunction(() => window.preview.inspect().frame === 6);
  await page.screenshot({ path: 'test-results/pikachu/arena.png' });
  if (errors.length) throw new Error(errors.join('\n'));
  await page.unroute('http://fire.test/**');
  await page.goto('file://' + resolve('docs/character-concepts/pikachu/star-tail-v1/preview.html'));
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 15);
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await page.screenshot({
    path: 'docs/character-concepts/pikachu/star-tail-v1/preview.png',
    fullPage: true,
  });
  console.log(
    'Star-tail summon browser checks passed: 15 actions, eight directions, animation playback, pause and reduced motion.',
  );
} finally {
  await browser.close();
}
