import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/frontend/public/assets');
mkdirSync(output, { recursive: true });

// Original, deterministic wind Foley: filtered turbulence, a moving resonance,
// and a short pressure swell. Stereo PCM, with silent edges to avoid clicks.
function whoosh(name, duration, seed, brightness) {
  const rate = 44100;
  const frames = Math.round(duration * rate);
  const pcm = new Float64Array(frames * 2);
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 0x100000000) * 2 - 1;
  };
  let low = 0;
  let body = 0;
  let phase = 0;
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const progress = i / (frames - 1);
    const time = i / rate;
    const noise = random();
    const cutoff = brightness * (0.35 + 0.65 * Math.sin(Math.PI * progress));
    low += (1 - Math.exp((-2 * Math.PI * cutoff) / rate)) * (noise - low);
    body += (1 - Math.exp((-2 * Math.PI * 170) / rate)) * (noise - body);
    phase += (2 * Math.PI * (900 - 650 * progress)) / rate;
    const envelope = Math.sin(Math.PI * progress) ** 1.6 * Math.exp(-2.2 * progress);
    const swell = Math.sin(2 * Math.PI * (80 * time - 45 * time * progress));
    const wind = (low - body) * (1 + 0.18 * Math.sin(phase)) + body * 0.4 + swell * 0.045;
    const pan = -0.25 + 0.5 * progress;
    pcm[i * 2] = wind * envelope * Math.sqrt((1 - pan) / 2);
    pcm[i * 2 + 1] = wind * envelope * Math.sqrt((1 + pan) / 2);
    peak = Math.max(peak, Math.abs(pcm[i * 2]), Math.abs(pcm[i * 2 + 1]));
  }
  const wav = Buffer.alloc(44 + frames * 4);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < pcm.length; i++) {
    wav.writeInt16LE(Math.round((pcm[i] / Math.max(peak, 0.001)) * 0.75 * 32767), 44 + i * 2);
  }
  writeFileSync(resolve(output, `${name}.wav`), wav);
  console.log(`${name}.wav: ${duration}s, stereo 44.1 kHz`);
}

whoosh('wind-dash', 0.3, 0x73ba125f, 3600);
whoosh('wind-jump', 0.24, 0x16ac0973, 2400);
