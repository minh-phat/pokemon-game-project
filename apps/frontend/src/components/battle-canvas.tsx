'use client';
import { useEffect, useRef } from 'react';
import type { MatchRules } from '@arena/shared-types';
export function BattleCanvas({
  arena,
  onReady,
  onError,
}: {
  arena: MatchRules['arena'];
  onReady: () => void;
  onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  useEffect(() => {
    let disposed = false;
    let game: import('phaser').Game | undefined;
    void Promise.all([import('phaser'), import('@/game/arena-scene')])
      .then(([Phaser, { createArenaScene }]) => {
        if (disposed || !container.current) return;
        const Scene = createArenaScene(
          arena,
          () => callbacks.current.onReady(),
          (message) => callbacks.current.onError(message),
        );
        game = new Phaser.Game({
          // This scene uses sprites and 2D paths only. Canvas avoids GPU readback
          // stalls on software-rendered browsers while preserving every effect.
          type: Phaser.CANVAS,
          parent: container.current,
          width: 1200,
          height: 760,
          backgroundColor: '#28443c',
          scene: Scene,
          // Cover the viewport on narrow screens while keeping the arena's aspect ratio.
          scale: { mode: Phaser.Scale.ENVELOP, autoCenter: Phaser.Scale.CENTER_BOTH },
          render: { antialias: true, pixelArt: false },
          audio: { noAudio: true },
          banner: false,
          fps: { target: 60, forceSetTimeOut: false },
        });
        game.canvas.setAttribute(
          'aria-label',
          'Animated Pokémon battle arena. In manual mode, select an active Pokémon using the controls in this arena.',
        );
        game.canvas.setAttribute('role', 'img');
      })
      .catch((error) =>
        callbacks.current.onError(
          error instanceof Error ? error.message : 'Unable to load the arena',
        ),
      );
    return () => {
      disposed = true;
      game?.destroy(true);
    };
  }, [arena]);
  return <div className="battle-canvas" ref={container} data-testid="battle-canvas" />;
}
