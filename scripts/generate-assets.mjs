import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve('apps/frontend/public/assets');
mkdirSync(out, { recursive: true });
const write = (name, text) => writeFileSync(resolve(out, name), text);
const svg = (body, w = 160, h = 160) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const ellipse = (x, y, rx, ry, fill, extra = '') =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const eye = (x, y, blink = false) =>
  blink
    ? path(
        `M${x - 5} ${y}q5 5 10 0`,
        'none',
        'stroke="#263c39" stroke-width="3" stroke-linecap="round"',
      )
    : `${ellipse(x, y, 5.8, 8, '#253533')}${ellipse(x + 1.4, y - 2.4, 2, 3, '#fff', 'stroke="none"')}`;
function creature(id, state = 'idle', frame = 0) {
  const phase = (frame / 6) * Math.PI * 2,
    run = state === 'run',
    attack = ['attack', 'cast'].includes(state),
    guard = ['guard', 'crouch'].includes(state),
    faint = state === 'faint';
  const bounce = run ? Math.sin(phase) * 3 : Math.sin(phase) * 1.1;
  const limb = run ? Math.sin(phase) * 23 : attack ? -35 + frame * 10 : Math.sin(phase) * 5;
  const lean =
    state === 'dash'
      ? 20
      : state === 'backstep'
        ? -18
        : state === 'hit'
          ? -13
          : state === 'knockback'
            ? -24
            : state === 'jump'
              ? -8
              : state === 'fall'
                ? 8
                : state === 'victory'
                  ? Math.sin(phase) * 9
                  : 0;
  const blink = frame === 4 && state === 'idle';
  const leftLeg = `transform="rotate(${limb} 65 119)"`,
    rightLeg = `transform="rotate(${-limb} 98 119)"`;
  let body = '';
  if (id === 'pikachu') {
    body += `<g transform="rotate(${Math.sin(phase) * 6} 106 110)">${path('M107 114l18-14-8-11 17-19 17 9-15 19 8 12-29 16z', '#f7c747')}${path('M107 114l8 12 12-6-6-10z', '#bc814b', 'stroke="none"')}</g>`;
    body +=
      ellipse(67, 129, 15, 7, '#e6b33f', leftLeg) + ellipse(101, 129, 15, 7, '#e6b33f', rightLeg);
    body +=
      ellipse(83, 105, 29, 30, '#f7d55b') + ellipse(86, 111, 18, 18, '#ffe58b', 'stroke="none"');
    body += `<g transform="rotate(${-limb} 59 95)">${ellipse(56, 101, 9, 18, '#f9d35a', 'transform="rotate(25 56 101)"')}</g><g transform="rotate(${limb + (attack ? -48 : 0)} 106 96)">${ellipse(109, 102, 9, 18, '#f9d35a', 'transform="rotate(-28 109 102)"')}</g>`;
    body += `<g transform="rotate(${Math.sin(phase) * 3} 80 75)">${path('M59 56Q39 18 49 10Q65 17 72 53', '#f8d454')}${path('M49 10Q42 14 47 28l13-6Q53 11 49 10', '#37433c', 'stroke="none"')}${path('M89 52q4-34 25-41 4 21-11 48', '#f8d454')}${path('M105 16l9-5q3 9-2 22l-11-5z', '#37433c', 'stroke="none"')}${path('M49 61Q60 45 80 48Q110 45 119 71L115 87Q109 102 84 104Q52 104 45 86Z', '#f9d65c')}${path('M51 65Q71 49 96 55', 'none', 'stroke="#fff1ad" stroke-width="5" stroke-linecap="round"')}${eye(67, 75, blink)}${eye(101, 75, blink)}${ellipse(55, 88, 8, 7, '#ec7754', 'stroke="none"')}${ellipse(113, 87, 7, 7, '#ec7754', 'stroke="none"')}${path('M81 82l5 0-3 3z', '#344039', 'stroke="none"')}${path('M74 89q5 6 10 0 5 6 10-1', 'none', 'stroke-width="2"')}</g>`;
  } else if (id === 'charmander') {
    body += `<g transform="rotate(${Math.sin(phase) * 7} 104 112)">${path('M99 120q29 12 35-25 10 31-13 37l-24-3', '#ed965a')}${path('M132 104q-23-13-7-30 3 12 7 8 9-13 5-22 23 25 6 40z', '#ed744b')}${path('M132 98q-10-8-2-20 2 9 7 7 5 9-5 13', '#ffe592', 'stroke="none"')}</g>`;
    body +=
      ellipse(67, 130, 17, 8, '#e5915a', leftLeg) + ellipse(100, 130, 16, 8, '#e5915a', rightLeg);
    body +=
      ellipse(83, 107, 28, 30, '#eea067') + ellipse(84, 112, 18, 24, '#f9d19a', 'stroke="none"');
    body += `<g transform="rotate(${-limb} 58 94)">${ellipse(55, 101, 8, 17, '#efa169', 'transform="rotate(30 55 101)"')}</g><g transform="rotate(${limb + (attack ? -50 : 0)} 105 95)">${ellipse(111, 101, 8, 17, '#efa169', 'transform="rotate(-40 111 101)"')}</g>`;
    body +=
      path('M55 72Q49 38 74 34Q106 29 112 62L119 77Q112 99 85 98Q57 98 55 72', '#f1a66e') +
      path(
        'M64 49q17-12 33-5',
        'none',
        'stroke="#ffd2a2" stroke-width="5" stroke-linecap="round"',
      ) +
      eye(72, 66, blink) +
      eye(101, 65, blink) +
      ellipse(110, 78, 2, 1.4, '#905b42', 'stroke="none"') +
      path('M75 82q13 10 28 0', 'none', 'stroke-width="2.2"');
  } else if (id === 'squirtle') {
    body += `<g transform="rotate(${Math.sin(phase) * 8} 111 115)">${path('M108 115q30 15 30-5-2-14-14-8 13-2 7 9-10 7-20-4', '#82cbd3')}</g>`;
    body +=
      ellipse(93, 102, 33, 33, '#a57a54') +
      ellipse(94, 102, 28, 28, '#bf9566') +
      path('M90 77l15 9 1 21-17 12-17-11-1-20z', '#d2ab77') +
      path(
        'M105 86l12-7M106 107l17 8M89 119l-4 14M71 88l-8-6',
        'none',
        'stroke="#8c684a" stroke-width="2"',
      );
    body +=
      ellipse(62, 128, 15, 9, '#83cbd2', leftLeg) +
      ellipse(101, 130, 15, 9, '#83cbd2', rightLeg) +
      ellipse(78, 107, 24, 27, '#f2db9e') +
      path(
        'M57 101q19 11 42 0M57 114q21 9 42-1M78 84v48',
        'none',
        'stroke="#c9af79" stroke-width="2"',
      );
    body += `<g transform="rotate(${-limb} 54 93)">${ellipse(49, 99, 9, 18, '#85d0d6', 'transform="rotate(30 49 99)"')}</g><g transform="rotate(${limb + (attack ? -45 : 0)} 103 94)">${ellipse(110, 98, 9, 16, '#85d0d6', 'transform="rotate(-35 110 98)"')}</g>`;
    body +=
      ellipse(78, 66, 33, 29, '#88d1d8') +
      path(
        'M56 51q19-14 37-4',
        'none',
        'stroke="#b8edf0" stroke-width="5" stroke-linecap="round"',
      ) +
      eye(65, 65, blink) +
      eye(94, 64, blink) +
      path('M64 79q14 11 27-1', 'none', 'stroke-width="2"') +
      ellipse(53, 77, 6, 3, '#e9b6a1', 'stroke="none"');
  } else {
    body +=
      ellipse(93, 107, 39, 24, '#75b99c') +
      ellipse(116, 125, 13, 12, '#6eaf92', rightLeg) +
      ellipse(83, 126, 12, 11, '#77b99b', leftLeg);
    body += `<g transform="rotate(${Math.sin(phase) * (attack ? 8 : 3)} 99 86)">${path('M77 91Q53 67 72 48q10 1 19 10Q89 30 104 26q18 19 14 35 23-17 27-2-1 34-28 39z', '#5f9666')}${path('M78 87q2-19 24-43-2 29 8 44', '#83b97c', 'stroke="none"')}${path('M110 90q8-18 26-26M78 85q-3-15-6-26', 'none', 'stroke="#416e4c" stroke-width="2"')}</g>`;
    body +=
      ellipse(43, 127, 13, 10, '#82c6a6', leftLeg) + ellipse(72, 129, 13, 10, '#82c6a6', rightLeg);
    body +=
      path('M27 83L25 59l20 9Q60 57 79 69l18-10-3 29q6 35-31 37Q22 127 27 83', '#8bccad') +
      path(
        'M34 82q19-14 41-5',
        'none',
        'stroke="#b6e6c5" stroke-width="5" stroke-linecap="round"',
      ) +
      eye(43, 93, blink) +
      eye(77, 92, blink) +
      path('M46 108q14 8 26-2', 'none', 'stroke-width="2"') +
      path(
        'M52 78l10-4 6 11-11 3zM30 108l9-6 5 10-10 3M84 111l8-6 2 10z',
        '#499c87',
        'stroke="none"',
      );
  }
  const rolling = id === 'squirtle' && ['guard', 'dash', 'backstep'].includes(state);
  if (rolling)
    body =
      ellipse(80, 101, 32, 32, '#a57a54') +
      ellipse(80, 101, 27, 27, '#d2ab77') +
      path('M80 78l19 11v22l-19 13-19-13V89Z', '#b88a59') +
      path(
        'M80 78v-8M99 89l8-4M99 111l8 5M80 124v8M61 111l-8 5M61 89l-8-4',
        'none',
        'stroke="#68543b" stroke-width="2"',
      );
  const transform = rolling
    ? `rotate(${frame * 60} 80 101)`
    : faint
      ? `translate(80 130) rotate(${Math.min(85, frame * 20)}) translate(-80 -130)`
      : guard
        ? `translate(0 38) scale(1 .72)`
        : `translate(0 ${bounce}) rotate(${lean} 80 120)`;
  return `<g stroke="#34463c" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" transform="${transform}">${body}</g>`;
}
const states = [
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
for (const id of ['pikachu', 'charmander', 'squirtle', 'bulbasaur']) {
  write(`${id}.svg`, svg(creature(id)));
  const frames = states
    .flatMap((state, row) =>
      Array.from(
        { length: 6 },
        (_, col) =>
          `<g transform="translate(${col * 160} ${row * 160})">${creature(id, state, col)}</g>`,
      ),
    )
    .join('');
  write(`${id}-sheet.svg`, svg(frames, 960, 2400));
}
let seed = 81;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const tree = (x, y, s, color) =>
  `<g transform="translate(${x} ${y}) scale(${s})">${path('M-20 0q15-130 5-235L-54-291l8-8 38 44L13-350l15 3-15 126Q4-76 43 0Z', color)}${ellipse(0, -320, 110, 74, color)}${ellipse(-70, -280, 77, 53, color)}${ellipse(77, -295, 95, 62, color)}</g>`;
for (const arena of ['forest', 'volcano', 'lake']) {
  const colors =
    arena === 'forest'
      ? ['#192e35', '#5e8577', '#b5c99b', '#344e4c', '#27433d', '#769178', '#b3ba7b']
      : arena === 'volcano'
        ? ['#302c3d', '#8c5b5f', '#f2ba8a', '#614b56', '#463c4b', '#a36c63', '#c48c70']
        : ['#263a58', '#739aa8', '#d7e2c3', '#526d86', '#344f69', '#83a5ac', '#b3c9c3'];
  const sky = `<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${colors[0]}"/><stop offset=".7" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[2]}"/></linearGradient><radialGradient id="glow"><stop stop-color="${colors[2]}" stop-opacity=".5"/><stop offset="1" stop-color="${colors[2]}" stop-opacity="0"/></radialGradient></defs><path d="M0 0h1200v600H0z" fill="url(#sky)"/><circle cx="770" cy="170" r="240" fill="url(#glow)"/><circle cx="770" cy="170" r="48" fill="${colors[2]}" opacity=".5"/>${path('M650 0h65L410 515H180z', colors[2], 'opacity=".045"')}${path('M850 0h20L690 515H610z', colors[2], 'opacity=".08"')}`;
  let far = '',
    near = '';
  if (arena === 'forest') {
    for (let i = 0; i < 15; i++) far += tree(i * 95, 480, 0.7 + rnd() * 0.8, colors[3]);
    for (let i = 0; i < 6; i++)
      near += tree(i < 3 ? i * 82 - 40 : 1050 + (i - 3) * 100, 520, 1.1 + rnd() * 0.55, colors[4]);
    near += path(
      'M0 0h1200v38q-80 80-170 21-80 50-142-10-120 60-202-20-100 80-190 19-140 96-290 22Q72 126 0 81z',
      '#1c3836',
    );
    for (let i = 0; i < 30; i++)
      near += ellipse(
        rnd() * 1200,
        rnd() * 80,
        20 + rnd() * 50,
        10 + rnd() * 30,
        '#315347',
        'opacity=".5" stroke="none"',
      );
  } else if (arena === 'volcano') {
    far += path('M0 465L200 198l140 201L593 100l240 325 178-224 189 248v100H0z', colors[3]);
    far += path('M489 230l104-130 95 130-63-33-20 17-32-19-34 28z', '#db9880', 'opacity=".6"');
    far += path(
      'M593 126l-25 123 41 74-38 113 77-20-22-100-28-76 21-78z',
      '#e99b67',
      'opacity=".5"',
    );
    near += path(
      'M0 319l73-43 52 67 55-16 64 193H0zM1200 254l-57 69-57-28-48 105-95 120h257z',
      colors[4],
    );
  } else {
    far += path('M0 402L180 203l147 188 216-267 183 231 148-117 168 171 158-161v280H0z', colors[3]);
    far += path(
      'M430 253l113-129 104 132-71-30-29 27-31-26zM108 285l72-82 70 88-60-24z',
      '#c7d6da',
      'opacity=".7"',
    );
    far += path('M0 416q300-35 600-2t600 0v106H0z', '#92b5bc');
    for (let i = 0; i < 32; i++)
      far += path(
        `M${rnd() * 1200} ${430 + rnd() * 65}h${30 + rnd() * 120}`,
        'none',
        'stroke="#d3e4d8" opacity=".3" stroke-width="2"',
      );
    near +=
      path('M28 519L64 301l34 126 40-47 39 140zM1046 520l30-170 46 41 32-121 45 251z', '#75b6bd') +
      path('M64 301l5 219h33zM1154 270l-5 250h50z', '#b3dee0', 'opacity=".6"');
  }
  let ground = `<defs><linearGradient id="soil" x2="0" y2="1"><stop stop-color="${colors[5]}"/><stop offset=".15" stop-color="${colors[4]}"/><stop offset="1" stop-color="${colors[0]}"/></linearGradient></defs>${path('M0 507Q200 494 395 507T780 506t420 0v94H0z', 'url(#soil)')}${path('M0 507Q200 494 395 507T780 506t420 0v14Q1000 509 790 521T390 518 0 519z', colors[6])}`;
  for (let i = 0; i < 80; i++) {
    let x = rnd() * 1200,
      y = 510 + rnd() * 85;
    ground += ellipse(
      x,
      y,
      2 + rnd() * 9,
      1 + rnd() * 3,
      colors[rnd() > 0.5 ? 5 : 6],
      'opacity=".3"',
    );
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 1200;
    ground += path(`M${x} 512q-15-22-21-14l18 20-6-34 12 26 12-24-8 29 24-12-19 20`, colors[4]);
  }
  const layers = { sky, far, near, ground };
  for (const [name, body] of Object.entries(layers))
    write(`${arena}-${name}.svg`, svg(body, 1200, 600));
  write(`${arena}.svg`, svg(sky + far + near + ground, 1200, 600));
}
// Small, bundled PCM sounds. No network fetch, microphone, or external samples.
function wav(name, seconds, frequency, ambient = false) {
  const rate = 16000,
    n = Math.floor(seconds * rate),
    data = Buffer.alloc(44 + n * 2);
  data.write('RIFF');
  data.writeUInt32LE(36 + n * 2, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate,
      envelope = ambient ? 0.35 : Math.sin((Math.PI * i) / n) * Math.exp(-t * 9);
    const v = ambient
      ? Math.sin(t * frequency * Math.PI * 2) * 0.25 +
        Math.sin(t * (frequency * 1.5) * Math.PI * 2) * 0.15 +
        (rnd() - 0.5) * 0.04
      : Math.sin(t * (frequency - t * frequency * 0.7) * Math.PI * 2) * 0.7 + (rnd() - 0.5) * 0.12;
    data.writeInt16LE(
      Math.max(-32767, Math.min(32767, Math.round(v * envelope * 16000))),
      44 + i * 2,
    );
  }
  writeFileSync(resolve(out, `${name}.wav`), data);
}
for (const [i, name] of ['normal', 'electric', 'fire', 'water', 'grass'].entries())
  wav(name, 0.26, 180 + i * 130);
wav('forest', 4, 110, true);
wav('volcano', 4, 60, true);
wav('lake', 4, 160, true);
write(
  'favicon.svg',
  svg(
    `<circle cx="80" cy="80" r="68" fill="#f6cf55"/><path d="M20 80h120" stroke="#273e35" stroke-width="12"/><circle cx="80" cy="80" r="22" fill="#f7f4e7" stroke="#273e35" stroke-width="10"/>`,
  ),
);
console.log('Generated 32 local SVG and WAV assets, including 360 character animation frames.');
