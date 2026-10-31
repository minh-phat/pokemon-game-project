import { describe, expect, it } from 'vitest';
import { constrainCamera, zoomCamera } from '../apps/frontend/src/game/manual-arena-camera';

const arena = { width: 6000, height: 1200 };
const viewport = { width: 1200, height: 600 };

describe('manual full-roster camera', () => {
  it('starts with the entire battlefield in view and centers the unused dimension', () => {
    expect(constrainCamera({ x: 0, y: 0, zoom: 0 }, viewport, arena)).toEqual({
      x: 3000,
      y: 600,
      zoom: 0.2,
    });
  });
  it('clamps panning at each map edge and limits zoom', () => {
    const topLeft = constrainCamera({ x: -100, y: -100, zoom: 1 }, viewport, arena);
    const bottomRight = constrainCamera({ x: 9000, y: 9000, zoom: 1 }, viewport, arena);
    expect(topLeft).toEqual({ x: 600, y: 300, zoom: 1 });
    expect(bottomRight).toEqual({ x: 5400, y: 900, zoom: 1 });
    expect(constrainCamera({ x: 3000, y: 600, zoom: 100 }, viewport, arena).zoom).toBeCloseTo(
      1200 / 450,
    );
  });
  it('zooms toward the pointer without moving its world position', () => {
    const view = { x: 3000, y: 600, zoom: 1 };
    const point = { x: 800, y: 350 };
    const zoomed = zoomCamera(view, 2, point, viewport, arena);
    expect(zoomed.x + (point.x - viewport.width / 2) / zoomed.zoom).toBeCloseTo(3200);
    expect(zoomed.y + (point.y - viewport.height / 2) / zoomed.zoom).toBeCloseTo(650);
  });
});
