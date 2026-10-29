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
      const engine=initializeBattle({rules:{...DEFAULT_RULES,teamSize:1,activeSize:1},players:['a','b'],teams:[['charmander'],['pikachu']]},5);
      engine.startBattle();
      const [f,enemy]=engine.state.fighters;
      f.x=470;enemy.x=850;f.depth=enemy.depth=0;f.invulnerable=enemy.invulnerable=0;
      useGame.getState().set({mode:'ai',muted:true,paused:false,reducedMotion:false});
      battleFeed.latest=engine.state;
      const Scene=createArenaScene('forest',()=>{window.ready=true},e=>{throw new Error(e)});
      const game=new Phaser.Game({type:Phaser.CANVAS,width:1200,height:760,fps:{target:60,forceSetTimeOut:true},scene:[Scene],audio:{noAudio:true}});
      window.preview={
        show(animation,skillId=null,elapsed=0){f.animation=animation;f.animationTime=0;f.cast=skillId?{skillId,elapsed,fired:0,hitIds:[]}:null;},
        face(value){f.facing=value;},
        settings(value){useGame.getState().set(value);},
        freezeFrame(frame){useGame.getState().set({paused:true});game.scene.scenes[0].actors.get(f.id).sprite.setFrame(frame);},
        startup(id){return SKILL_BY_ID[id].startup;},
        inspect(){const scene=game.scene.scenes[0];const v=scene.actors.get(f.id);if(!v)return null;return {frame:Number(v.sprite.frame.name),flip:v.sprite.flipX,paused:v.sprite.anims.isPaused,wanted:f.animation,last:v.lastAnimation,active:f.active,frames:scene.textures.get('charmander').frameTotal};}
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
  await mkdir('test-results/charmander', { recursive: true });
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
  // Record every airborne frame at both facings for anatomy review.
  await page.evaluate(() => window.preview.show('jump'));
  await page.waitForFunction(() => window.preview.inspect().last === 'charmander-jump');
  for (const facing of [1, -1]) {
    for (let frame = 12; frame < 24; frame++) {
      await page.evaluate(
        ({ frame, facing }) => {
          window.preview.face(facing);
          window.preview.freezeFrame(frame);
        },
        { frame, facing },
      );
      await page.waitForFunction(
        ({ frame, facing }) => {
          const pose = window.preview.inspect();
          return pose.frame === frame && pose.flip === facing < 0;
        },
        { frame, facing },
      );
      await page.screenshot({ path: `test-results/charmander/airborne-${frame}-${facing}.png` });
    }
  }
  await page.evaluate(() => {
    window.preview.face(1);
    window.preview.settings({ paused: false });
  });
  await page.evaluate(() => window.preview.show('run'));
  await page.waitForFunction(() => {
    const frame = window.preview.inspect().frame;
    return frame >= 6 && frame <= 11;
  });
  const first = await page.evaluate(() => window.preview.inspect().frame);
  await page.waitForFunction((first) => window.preview.inspect().frame !== first, first);
  await page.evaluate(() => window.preview.settings({ paused: true }));
  await page.waitForTimeout(50);
  const paused = await page.evaluate(() => window.preview.inspect().frame);
  await page.waitForTimeout(180);
  if (paused !== (await page.evaluate(() => window.preview.inspect().frame)))
    throw new Error('Pause moved');
  await page.evaluate(() => {
    window.preview.settings({ paused: false });
    window.preview.face(-1);
  });
  await page.waitForTimeout(60);
  if (!(await page.evaluate(() => window.preview.inspect().flip)))
    throw new Error('Facing not mirrored');
  await page.screenshot({ path: 'test-results/charmander/run-left.png' });
  for (const elapsed of [0.35, 1.5, 3.34]) {
    await page.evaluate((t) => {
      window.preview.face(1);
      window.preview.show('cast', 'inferno-stream', t);
    }, elapsed);
    await page.waitForTimeout(50);
    if ((await page.evaluate(() => window.preview.inspect().frame)) !== 39)
      throw new Error('Channel pose ended early');
  }
  await page.screenshot({ path: 'test-results/charmander/fire-channel.png' });
  await page.evaluate(() => window.preview.settings({ reducedMotion: true }));
  await page.waitForTimeout(80);
  const reduced = await page.evaluate(() => window.preview.inspect());
  if (reduced.frame !== 36 || !reduced.paused) throw new Error('Reduced motion still animated');
  if (errors.length) throw new Error(errors.join('\n'));
  // Standalone contact sheet uses exactly the runtime PNG, with review controls.
  await page.unroute('http://fire.test/**');
  await page.goto(
    'file://' + resolve('docs/character-concepts/charmander/fire-stripe-v2/preview.html'),
  );
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 15);
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await page.screenshot({
    path: 'docs/character-concepts/charmander/fire-stripe-v2/preview.png',
    fullPage: true,
  });
  console.log(
    'Charmander browser checks passed: 15 states, run, pause, mirror, channel, reduced motion.',
  );
} finally {
  await browser.close();
}
