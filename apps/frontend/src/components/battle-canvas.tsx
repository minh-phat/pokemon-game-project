'use client';
import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/lib/store';
import { POKEMON } from '@arena/game-data';
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
  const fighters = useGame((state) => state.snapshot?.fighters);
  const [camera, setCamera] = useState({ id: '', zoom: 100 });
  useEffect(() => {
    const listener = (event: Event) =>
      setCamera((event as CustomEvent<{ id: string; zoom: number }>).detail);
    window.addEventListener('arena-camera-status', listener);
    return () => window.removeEventListener('arena-camera-status', listener);
  }, []);
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
          scale: {
            mode: arena === 'ruins' ? Phaser.Scale.RESIZE : Phaser.Scale.ENVELOP,
            autoCenter: arena === 'ruins' ? Phaser.Scale.NO_CENTER : Phaser.Scale.CENTER_BOTH,
          },
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
  return (
    <>
      <div className="battle-canvas" ref={container} data-testid="battle-canvas" />
      <div
        style={{
          position: 'absolute',
          top: 132,
          right: 16,
          zIndex: 30,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          padding: 6,
          borderRadius: 12,
          background: '#142e2eea',
          border: '1px solid #789477',
          maxWidth: 'calc(100% - 24px)',
          flexWrap: 'wrap',
        }}
        aria-label="Camera trận đấu"
      >
        <button
          className="button button-secondary"
          style={{ minWidth: 36, minHeight: 36, padding: '4px 10px' }}
          title="Thu nhỏ"
          aria-label="Thu nhỏ"
          onClick={() => window.dispatchEvent(new CustomEvent('arena-camera', { detail: 'out' }))}
        >
          −
        </button>
        <button
          className="button button-secondary"
          style={{ minWidth: 36, minHeight: 36, padding: '4px 10px' }}
          title="Phóng to"
          aria-label="Phóng to"
          onClick={() => window.dispatchEvent(new CustomEvent('arena-camera', { detail: 'in' }))}
        >
          +
        </button>
        <button
          className="button button-secondary"
          style={{ minWidth: 36, minHeight: 36, padding: '4px 10px' }}
          title="Bấm Pokémon để theo dõi; cuộn chuột để zoom"
          onClick={() =>
            window.dispatchEvent(new CustomEvent('arena-camera', { detail: 'overview' }))
          }
        >
          Toàn sân
        </button>
        <button
          className="button button-secondary"
          style={{ minHeight: 36, padding: '4px 10px' }}
          title="Phủ kín màn hình, giữ nguyên tỉ lệ ảnh"
          onClick={() => window.dispatchEvent(new CustomEvent('arena-camera', { detail: 'cover' }))}
        >
          Lấp đầy
        </button>
        <select
          aria-label="Theo dõi Pokémon"
          value={camera.id}
          style={{ maxWidth: 160, padding: 6 }}
          onChange={(event) =>
            window.dispatchEvent(
              new CustomEvent('arena-camera', {
                detail: event.target.value ? `follow:${event.target.value}` : 'overview',
              }),
            )
          }
        >
          <option value="">Theo dõi Pokémon</option>
          {fighters
            ?.filter((f) => f.active && f.hp > 0)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.team === 0 ? 'Đỏ' : 'Xanh'} · {POKEMON[f.species].name} {f.slot + 1}
              </option>
            ))}
        </select>
        <output aria-label="Mức zoom">{camera.zoom}%</output>
      </div>
    </>
  );
}
