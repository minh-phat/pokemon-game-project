'use client';
import { useEffect, useRef, useState } from 'react';
import type { SheetInfo } from './admin-api';

export type StageBackground = 'checker' | 'night' | 'meadow' | 'lava';

/** Load (and cache-bust) a sheet image; returns null until decoded. */
export function useSheetImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => active && setImage(img);
    img.onerror = () => active && setImage(null);
    img.src = url;
    return () => {
      active = false;
    };
  }, [url]);
  return image;
}

type Cell = Pick<SheetInfo, 'frameWidth' | 'frameHeight' | 'columns'>;

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  cell: Cell,
  frame: number,
  dx: number,
  dy: number,
  scale: number,
) {
  const column = frame % cell.columns;
  const row = Math.floor(frame / cell.columns);
  ctx.drawImage(
    image,
    column * cell.frameWidth,
    row * cell.frameHeight,
    cell.frameWidth,
    cell.frameHeight,
    dx,
    dy,
    cell.frameWidth * scale,
    cell.frameHeight * scale,
  );
}

export function downloadFrameAsPng(
  image: CanvasImageSource,
  cell: Cell,
  frame: number,
  filename: string,
) {
  const canvas = document.createElement('canvas');
  canvas.width = cell.frameWidth;
  canvas.height = cell.frameHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  drawFrame(ctx, image, cell, frame, 0, 0, 1);
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

export function downloadRangeAsPng(
  image: CanvasImageSource,
  cell: Cell,
  startFrame: number,
  endFrame: number,
  filename: string,
) {
  const count = Math.max(1, endFrame - startFrame + 1);
  const canvas = document.createElement('canvas');
  canvas.width = cell.frameWidth * count;
  canvas.height = cell.frameHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < count; i++) {
    drawFrame(ctx, image, cell, startFrame + i, i * cell.frameWidth, 0, 1);
  }
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: StageBackground,
  scale: number,
) {
  if (background === 'checker') {
    const size = 8 * Math.max(1, Math.round(scale));
    for (let y = 0; y < height; y += size)
      for (let x = 0; x < width; x += size) {
        ctx.fillStyle = ((x + y) / size) % 2 ? '#2a2f3d' : '#222633';
        ctx.fillRect(x, y, size, size);
      }
    return;
  }
  const palettes: Record<Exclude<StageBackground, 'checker'>, [string, string, string]> = {
    night: ['#1b1f3b', '#2c2350', '#141626'],
    meadow: ['#9fd3e6', '#cbe9d2', '#6f9e5c'],
    lava: ['#3a1622', '#6b2a24', '#2a1414'],
  };
  const [top, mid, ground] = palettes[background];
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.8, mid);
  gradient.addColorStop(0.8, ground);
  gradient.addColorStop(1, ground);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export type PlayerProps = {
  image: HTMLImageElement | null;
  sheet: Cell;
  frames: number[];
  fps: number;
  /** -1 loops forever, otherwise plays repeat + 1 times then holds. */
  repeat: number;
  loopPreview: boolean;
  playing: boolean;
  speed: number;
  scale: number;
  flip: boolean;
  onion: boolean;
  guides: boolean;
  background: StageBackground;
  cursor: number;
  onCursor: (cursor: number) => void;
  onEnded?: () => void;
};

/** Large preview stage: plays a list of sheet frames at the given FPS. */
export function SpritePlayer(props: PlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const { image, sheet, frames, scale, flip, onion, guides, background, cursor } = props;
  const width = Math.round(sheet.frameWidth * scale);
  const height = Math.round(sheet.frameHeight * scale);

  // Advance the cursor on a rAF clock only while playing.
  useEffect(() => {
    if (!props.playing || frames.length === 0) return;
    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let plays = 0;
    const tick = (now: number) => {
      const p = latest.current;
      accumulator += ((now - last) / 1000) * p.fps * p.speed;
      last = now;
      let next = p.cursor;
      let ended = false;
      while (accumulator >= 1) {
        accumulator -= 1;
        if (next + 1 < p.frames.length) next++;
        else if (p.loopPreview || p.repeat === -1 || plays < p.repeat) {
          plays++;
          next = 0;
        } else {
          ended = true;
          break;
        }
      }
      if (next !== p.cursor) p.onCursor(next);
      if (ended) {
        p.onEnded?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.playing, frames.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    paintBackground(ctx, width, height, background, scale);
    if (guides) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(width / 2 + 0.5, 0);
      ctx.lineTo(width / 2 + 0.5, height);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 196, 92, 0.55)';
      const baseline = Math.round(149 * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, baseline);
      ctx.lineTo(width, baseline);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!image || frames.length === 0) return;
    ctx.save();
    if (flip) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    const index = Math.min(cursor, frames.length - 1);
    if (onion && frames.length > 1) {
      ctx.globalAlpha = 0.28;
      drawFrame(
        ctx,
        image,
        sheet,
        frames[(index - 1 + frames.length) % frames.length],
        0,
        0,
        scale,
      );
      ctx.globalAlpha = 1;
    }
    drawFrame(ctx, image, sheet, frames[index], 0, 0, scale);
    ctx.restore();
  }, [image, sheet, frames, cursor, scale, flip, onion, guides, background, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="studio-stage-canvas"
      width={width}
      height={height}
      aria-label="Khung xem trước animation"
    />
  );
}

/** Small looping thumbnail used in lists. */
export function SpriteThumb({
  image,
  sheet,
  frames,
  fps,
  size = 64,
  active = true,
}: {
  image: HTMLImageElement | null;
  sheet: Cell;
  frames: number[];
  fps: number;
  size?: number;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = size / sheet.frameHeight;
  const width = Math.round(sheet.frameWidth * scale);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !image || frames.length === 0) return;
    let raf = 0;
    const start = performance.now();
    let shown = -1;
    const draw = (now: number) => {
      const index = active ? Math.floor(((now - start) / 1000) * fps) % frames.length : 0;
      if (index !== shown) {
        shown = index;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, width, size);
        drawFrame(ctx, image, sheet, frames[index], 0, 0, scale);
      }
      if (active) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [image, sheet, frames, fps, width, size, scale, active]);
  return <canvas ref={canvasRef} width={width} height={size} className="studio-thumb" />;
}

/** Static single-frame canvas used in the timeline strip. */
export function FrameCell({
  image,
  sheet,
  frame,
  size = 72,
}: {
  image: HTMLImageElement | null;
  sheet: Cell;
  frame: number;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = size / sheet.frameHeight;
  const width = Math.round(sheet.frameWidth * scale);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, size);
    if (image) drawFrame(ctx, image, sheet, frame, 0, 0, scale);
  }, [image, sheet, frame, width, size, scale]);
  return <canvas ref={canvasRef} width={width} height={size} />;
}
