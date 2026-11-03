import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { BattleAudio } from '../apps/frontend/src/game/audio';
import type { BattleEvent } from '@arena/shared-types';

const settings = vi.hoisted(() => ({
  state: { volume: 0.8, muted: false, paused: false },
  listener: () => {},
  unsubscribe: vi.fn(),
}));
vi.mock('../apps/frontend/src/lib/store', () => ({
  useGame: {
    getState: () => settings.state,
    subscribe: (listener: () => void) => {
      settings.listener = listener;
      return settings.unsubscribe;
    },
  },
}));

class Sound {
  static instances: Sound[] = [];
  loop = false;
  volume = 1;
  onended?: () => void;
  onerror?: () => void;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  constructor(public src: string) {
    Sound.instances.push(this);
  }
}
const cue = (movement?: 'dash' | 'jump'): BattleEvent => ({
  id: 1,
  tick: 1,
  kind: 'dodge',
  fighterId: 'pet',
  text: '',
  x: 0,
  y: 0,
  movement,
});
let audio: BattleAudio;
beforeEach(() => {
  Object.assign(settings.state, { volume: 0.8, muted: false, paused: false });
  Sound.instances = [];
  vi.stubGlobal('Audio', Sound);
  audio = new BattleAudio('forest');
});
afterEach(() => {
  audio.destroy();
  vi.unstubAllGlobals();
});

describe('movement wind audio', () => {
  it('plays dash, backstep and jump cues, including skill/terrain movement', () => {
    audio.playMovement(cue('dash'));
    audio.playMovement(cue('jump'));
    audio.playMovement({ ...cue('dash'), kind: 'movement' });
    expect(Sound.instances.slice(1).map((sound) => sound.src)).toEqual([
      '/assets/wind-dash.wav',
      '/assets/wind-jump.wav',
      '/assets/wind-dash.wav',
    ]);
    for (const sound of Sound.instances.slice(1)) {
      expect(sound.play).toHaveBeenCalledOnce();
      expect(sound.loop).toBe(false);
      expect(sound.volume).toBeCloseTo(0.32);
    }
    audio.playMovement(cue()); // Crouching has no wind.
    audio.playMovement({ ...cue('dash'), kind: 'damage' });
    expect(Sound.instances).toHaveLength(4);
  });

  it('respects mute, zero volume and both battle and world pause', () => {
    settings.state.muted = true;
    audio.playMovement(cue('dash'));
    settings.state.muted = false;
    settings.state.volume = 0;
    audio.playMovement(cue('dash'));
    settings.state.volume = 0.8;
    settings.state.paused = true;
    audio.playMovement(cue('jump'));
    settings.state.paused = false;
    audio.setPaused(true);
    audio.playMovement(cue('dash'));
    expect(Sound.instances).toHaveLength(1);
    audio.setPaused(false);
    audio.playMovement(cue('jump'));
    expect(Sound.instances).toHaveLength(2);
  });

  it('updates active volume and stops effects immediately on mute/pause/destroy', () => {
    audio.playMovement(cue('dash'));
    const sound = Sound.instances.at(-1)!;
    settings.state.volume = 0.25;
    settings.listener();
    expect(sound.volume).toBe(0.1);
    settings.state.muted = true;
    settings.listener();
    expect(sound.pause).toHaveBeenCalledOnce();
    expect(sound.src).toBe('');
    settings.state.muted = false;
    audio.playMovement(cue('jump'));
    const jump = Sound.instances.at(-1)!;
    audio.setPaused(true);
    expect(jump.pause).toHaveBeenCalledOnce();
    audio.setPaused(false);
    audio.playMovement(cue('dash'));
    const dash = Sound.instances.at(-1)!;
    audio.destroy();
    expect(dash.pause).toHaveBeenCalledOnce();
    expect(dash.src).toBe('');
    expect(settings.unsubscribe).toHaveBeenCalled();
  });

  it('limits overlapping effects and releases slots when playback ends or fails', () => {
    for (let i = 0; i < 20; i++) audio.playMovement(cue('dash'));
    expect(Sound.instances).toHaveLength(8); // One ambience and seven effects.
    Sound.instances[1].onended?.();
    Sound.instances[2].onerror?.();
    audio.playMovement(cue('jump'));
    audio.playMovement(cue('jump'));
    expect(Sound.instances).toHaveLength(10);
  });

  it.each([
    ['wind-dash', 0.3],
    ['wind-jump', 0.24],
  ] as const)(
    '%s is audible stereo PCM with click-free edges and no clipping',
    (name, duration) => {
      const wav = readFileSync(`apps/frontend/public/assets/${name}.wav`);
      expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wav.toString('ascii', 8, 16)).toBe('WAVEfmt ');
      expect(wav.readUInt16LE(20)).toBe(1);
      expect(wav.readUInt16LE(22)).toBe(2);
      expect(wav.readUInt32LE(24)).toBe(44100);
      expect(wav.readUInt16LE(34)).toBe(16);
      expect(wav.readUInt32LE(40)).toBe(wav.length - 44);
      expect((wav.length - 44) / (44100 * 4)).toBeCloseTo(duration, 5);
      let peak = 0;
      for (let offset = 44; offset < wav.length; offset += 2)
        peak = Math.max(peak, Math.abs(wav.readInt16LE(offset)));
      expect(peak).toBeGreaterThan(10000);
      expect(peak).toBeLessThan(32767);
      expect(wav.readInt16LE(44)).toBe(0);
      expect(wav.readInt16LE(wav.length - 2)).toBe(0);
    },
  );
});
