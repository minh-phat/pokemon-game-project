import type * as Phaser from 'phaser';

/** Keep software WebGL on the Canvas path, but let crowded arenas use a real GPU. */
export function battleRenderer(
  phaser: Pick<typeof Phaser, 'CANVAS' | 'WEBGL'>,
  fullRoster: boolean,
): Pick<Phaser.Types.Core.GameConfig, 'type' | 'canvas'> {
  if (!fullRoster) return { type: phaser.CANVAS };
  const canvas = document.createElement('canvas');
  try {
    const context = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'high-performance',
    });
    if (context) {
      const info = context.getExtension('WEBGL_debug_renderer_info');
      const renderer = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
      // Some browsers expose software contexts despite the performance-caveat flag.
      if (!/swiftshader|llvmpipe|softpipe|software/i.test(renderer))
        // Phaser requests the same context from this canvas during boot.
        return { type: phaser.WEBGL, canvas };
      context.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // Context creation can be blocked by browser settings or resource limits.
  }
  return { type: phaser.CANVAS };
}
