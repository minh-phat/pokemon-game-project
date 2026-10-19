import sharp from 'sharp';
import { resolve } from 'node:path';

const output = resolve('apps/frontend/public/assets');
const gold = '#ffc75f',
  pale = '#fff4c4',
  white = '#fffaf0';
const star = (x, y, r, fill, turn = 0) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5 + turn;
    const radius = i % 2 ? r * 0.43 : r;
    return `${(x + Math.cos(a) * radius).toFixed(1)},${(y + Math.sin(a) * radius).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${points}" fill="${fill}"/>`;
};
const ring = (r, color, opacity = 1, width = 2) =>
  `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
const sparkles = (frame, count = 6) =>
  Array.from({ length: count }, (_, i) => {
    const a = (i * Math.PI * 2) / count + frame * 0.14;
    const r = 15 + (i % 3) * 7;
    return star(
      32 + Math.cos(a) * r,
      32 + Math.sin(a) * r,
      i % 2 ? 2 : 3,
      i % 2 ? gold : pale,
      frame * 0.08,
    );
  }).join('');
function art(id, frame) {
  const t = frame / 11;
  if (id === 'eevee-strike')
    return `<path d="M9 45 Q28 10 55 18" fill="none" stroke="#8b5528" stroke-width="8" opacity="${1 - t}"/><path d="M9 45 Q28 10 55 18" fill="none" stroke="${white}" stroke-width="${Math.max(1, 5 - t * 4)}" opacity="${1 - t * 0.8}"/>${sparkles(frame, 4)}`;
  if (id === 'swift')
    return `<path d="M5 39 L22 35 L14 40 L26 36" fill="none" stroke="${gold}" stroke-width="3" opacity="${1 - t * 0.5}"/>${star(37, 30, 17, gold, frame * 0.24)}${star(37, 30, 10, pale, frame * 0.24)}${star(37, 30, 5, white, frame * 0.24)}${sparkles(frame, 4)}`;
  if (id === 'shadow-step')
    return `<path d="M5 50 Q20 8 54 27" fill="none" stroke="${gold}" stroke-width="5" opacity=".35"/><path d="M8 47 Q21 13 53 27" fill="none" stroke="${pale}" stroke-width="2" opacity=".8"/><path d="M18 40 L23 18 L29 31 L36 17 L43 35 Q48 42 40 47 L18 47 Z" fill="#f3d99a" opacity="${(0.16 + 0.28 * (1 - t)).toFixed(2)}"/>${sparkles(frame, 3)}`;
  if (id === 'counter-pounce')
    return `${ring(8 + t * 19, gold, 1 - t * 0.8, 3)}${frame > 4 ? '<path d="M18 8 L36 48 M31 7 L49 47" stroke="#fffdf1" stroke-width="4"/>' : ''}<path d="M9 51 Q32 42 55 51" fill="none" stroke="#d7bd93" stroke-width="3" opacity="${t}"/>${sparkles(frame, 5)}`;
  if (id === 'starfall-rush')
    return frame < 9
      ? `<path d="M5 49 Q25 10 57 16" fill="none" stroke="#a56023" stroke-width="10" opacity=".4"/><path d="M5 49 Q25 10 57 16" fill="none" stroke="${gold}" stroke-width="6"/><path d="M8 47 Q27 11 54 17" fill="none" stroke="${pale}" stroke-width="2"/>${sparkles(frame, 7)}`
      : `${ring(9 + (frame - 9) * 10, pale, 1 - (frame - 9) * 0.22, 4)}${ring(5 + (frame - 9) * 11, gold, 1 - (frame - 9) * 0.18, 5)}${sparkles(frame, 10)}`;
  if (id === 'starfall-impact')
    return `${ring(8 + t * 22, pale, 1 - t * 0.7, 4)}${ring(5 + t * 28, gold, 1 - t * 0.6, 5)}${sparkles(frame, 10)}`;
  if (id === 'eevee-guard')
    return `${ring(23 + Math.sin(frame * 0.6) * 2, gold, 0.45, 2)}${ring(16, pale, 0.22, 2)}${sparkles(frame, 4)}`;
  return `${ring(19 + Math.sin(frame * 0.5) * 2, gold, 0.5, 2)}${sparkles(frame, 7)}`;
}
for (const id of [
  'eevee-strike',
  'swift',
  'shadow-step',
  'counter-pounce',
  'starfall-rush',
  'starfall-impact',
  'eevee-guard',
  'eevee-adaptive',
]) {
  const frames = [];
  for (let frame = 0; frame < 12; frame++) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges">${art(id, frame)}</svg>`;
    frames.push(
      await sharp(Buffer.from(svg)).resize(128, 128, { kernel: 'nearest' }).png().toBuffer(),
    );
  }
  await sharp({ create: { width: 1536, height: 128, channels: 4, background: '#00000000' } })
    .composite(frames.map((input, i) => ({ input, left: i * 128, top: 0 })))
    .png()
    .toFile(resolve(output, `eevee-vfx-${id}.png`));
}
