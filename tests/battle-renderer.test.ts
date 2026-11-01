import { afterEach, describe, expect, it, vi } from 'vitest';
import { battleRenderer } from '../apps/frontend/src/game/battle-renderer';

const phaser = { CANVAS: 1, WEBGL: 2 };
afterEach(() => vi.unstubAllGlobals());

function browser(renderer: string | null) {
  const loseContext = vi.fn();
  const context =
    renderer === null
      ? null
      : {
          getExtension: (name: string) =>
            name === 'WEBGL_debug_renderer_info'
              ? { UNMASKED_RENDERER_WEBGL: 123 }
              : { loseContext },
          getParameter: () => renderer,
        };
  const canvas = { getContext: vi.fn(() => context) };
  const createElement = vi.fn(() => canvas);
  vi.stubGlobal('document', { createElement });
  return { canvas, createElement, loseContext };
}

describe('crowded battle renderer selection', () => {
  it('uses hardware WebGL and reuses the probed canvas', () => {
    const { canvas } = browser('ANGLE (Apple, Apple M1, Metal)');
    expect(battleRenderer(phaser, true)).toEqual({ type: phaser.WEBGL, canvas });
    expect(canvas.getContext).toHaveBeenCalledWith(
      'webgl',
      expect.objectContaining({
        failIfMajorPerformanceCaveat: true,
        preserveDrawingBuffer: false,
        antialias: false,
      }),
    );
  });

  it.each(['SwiftShader Device', 'llvmpipe', 'Software Rasterizer'])(
    'rejects %s and releases its context',
    (renderer) => {
      const { loseContext } = browser(renderer);
      expect(battleRenderer(phaser, true)).toEqual({ type: phaser.CANVAS });
      expect(loseContext).toHaveBeenCalledOnce();
    },
  );

  it('falls back when WebGL is unavailable or throws', () => {
    const { canvas } = browser(null);
    expect(battleRenderer(phaser, true)).toEqual({ type: phaser.CANVAS });
    canvas.getContext.mockImplementation(() => {
      throw new Error('Blocked');
    });
    expect(battleRenderer(phaser, true)).toEqual({ type: phaser.CANVAS });
  });

  it('does not probe WebGL for ordinary battles', () => {
    const { createElement } = browser(null);
    expect(battleRenderer(phaser, false)).toEqual({ type: phaser.CANVAS });
    expect(createElement).not.toHaveBeenCalled();
  });
});
