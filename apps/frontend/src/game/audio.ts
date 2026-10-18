import { useGame } from '@/lib/store';
export class BattleAudio {
  private ambient: HTMLAudioElement;
  private effects = new Set<HTMLAudioElement>();
  private remove: () => void;
  constructor(arena: string) {
    this.ambient = new Audio(`/assets/${arena}.wav`);
    this.ambient.loop = true;
    this.remove = useGame.subscribe(() => this.sync());
    this.sync();
  }
  sync() {
    const { volume, muted, paused } = useGame.getState();
    this.ambient.volume = volume * 0.25;
    if (muted || paused) this.ambient.pause();
    else void this.ambient.play().catch(() => {});
  }
  play(element: string) {
    const { volume, muted } = useGame.getState();
    if (muted || this.effects.size > 6) return;
    const sound = new Audio(`/assets/${element}.wav`);
    sound.volume = volume * 0.4;
    this.effects.add(sound);
    sound.onended = () => this.effects.delete(sound);
    void sound.play().catch(() => this.effects.delete(sound));
  }
  destroy() {
    this.remove();
    this.ambient.pause();
    this.ambient.src = '';
    for (const sound of this.effects) {
      sound.pause();
      sound.src = '';
    }
    this.effects.clear();
  }
}
