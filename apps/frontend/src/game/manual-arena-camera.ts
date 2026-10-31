/** Camera coordinates are in arena units; viewport dimensions are in canvas pixels. */
export type CameraView = { x: number; y: number; zoom: number };
type Size = { width: number; height: number };

export function constrainCamera(view: CameraView, viewport: Size, arena: Size): CameraView {
  const minZoom = Math.min(viewport.width / arena.width, viewport.height / arena.height);
  const maxZoom = Math.max(minZoom, viewport.width / 450, viewport.height / 450);
  const zoom = Math.max(minZoom, Math.min(maxZoom, view.zoom));
  const halfWidth = viewport.width / (2 * zoom);
  const halfHeight = viewport.height / (2 * zoom);
  const clamp = (value: number, half: number, extent: number) =>
    half * 2 >= extent ? extent / 2 : Math.max(half, Math.min(extent - half, value));
  return {
    x: clamp(view.x, halfWidth, arena.width),
    y: clamp(view.y, halfHeight, arena.height),
    zoom,
  };
}

/** Zoom around a canvas point, keeping the world under the pointer stationary where possible. */
export function zoomCamera(
  view: CameraView,
  factor: number,
  point: { x: number; y: number },
  viewport: Size,
  arena: Size,
): CameraView {
  const zoom = constrainCamera({ ...view, zoom: view.zoom * factor }, viewport, arena).zoom;
  const dx = point.x - viewport.width / 2;
  const dy = point.y - viewport.height / 2;
  return constrainCamera(
    {
      x: view.x + dx * (1 / view.zoom - 1 / zoom),
      y: view.y + dy * (1 / view.zoom - 1 / zoom),
      zoom,
    },
    viewport,
    arena,
  );
}
