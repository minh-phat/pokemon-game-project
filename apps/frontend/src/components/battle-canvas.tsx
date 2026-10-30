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
    let resizeObserver: ResizeObserver | undefined;
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
          width: container.current.clientWidth,
          height: container.current.clientHeight,
          backgroundColor: '#28443c',
          scene: Scene,
          // Frame against the actual viewport, including narrow screens.
          scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.NO_CENTER,
          },
          render: { antialias: true, pixelArt: false },
          audio: { noAudio: true },
          banner: false,
          fps: { target: 60, forceSetTimeOut: false },
        });
        resizeObserver = new ResizeObserver(([entry]) => {
          if (disposed || !game || !entry) return;
          const width = Math.round(entry.contentRect.width);
          const height = Math.round(entry.contentRect.height);
          if (width > 0 && height > 0) game.scale.resize(width, height);
        });
        resizeObserver.observe(container.current);
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
      resizeObserver?.disconnect();
      game?.destroy(true);
    };
  }, [arena]);
  return <div className="battle-canvas" ref={container} data-testid="battle-canvas" />;
}
