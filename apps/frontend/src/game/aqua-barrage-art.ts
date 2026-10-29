// Transparent animation frames; pressure rings are drawn at world scale by SkillVfx.
export function aquaBarrageArt(c: CanvasRenderingContext2D, id: string, frame: number) {
  const tau = Math.PI * 2;
  const phase = (frame / 12) * tau;
  c.lineCap = 'round';
  if (id === 'aqua-barrage') {
    for (const [radius, color] of [
      [19, '#087fbe55'],
      [14, '#18b5e4bb'],
      [9, '#69e2f4dd'],
      [3, '#e6ffffee'],
    ] as const) {
      c.fillStyle = color;
      c.beginPath();
      for (const side of [-1, 1]) {
        for (let i = 0; i <= 64; i++) {
          const x = side < 0 ? i * 2 : 128 - i * 2;
          const ripple =
            Math.sin(x * 0.13 - phase + side) * 2.1 + Math.sin(x * 0.31 - phase * 2) * 0.9;
          const y = 64 + side * (radius + ripple) * (0.65 + 0.35 * Math.sin((x / 128) * Math.PI));
          if (side === -1 && i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
      }
      c.closePath();
      c.fill();
    }
    for (let i = 0; i < 9; i++) {
      c.strokeStyle = i % 3 ? '#c3faffaa' : '#ffffffee';
      c.lineWidth = i % 3 ? 0.9 : 1.4;
      c.beginPath();
      for (let x = 0; x <= 128; x += 2) {
        const y = 64 + (i - 4) * 3 + Math.sin(x * 0.09 - phase + i * 1.7) * 3;
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
    return;
  }
  if (id === 'aqua-barrage-steam') {
    for (let i = 0; i < 7; i++) {
      const t = (frame / 12 + i / 7) % 1;
      const x = 64 + Math.sin(i * 2.3 + t * 3) * (8 + t * 20);
      const y = 105 - t * 85;
      const r = 7 + t * 16;
      const mist = c.createRadialGradient(x, y, 0, x, y, r);
      mist.addColorStop(0, `rgba(225,244,250,${(1 - t) * 0.42})`);
      mist.addColorStop(1, 'rgba(225,244,250,0)');
      c.fillStyle = mist;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return;
  }
  const charge = id === 'aqua-barrage-charge';
  const glow = c.createRadialGradient(64, 64, 2, 64, 64, 50);
  glow.addColorStop(0, '#e9ffffcc');
  glow.addColorStop(0.3, '#44d8ff88');
  glow.addColorStop(1, '#008edf00');
  c.fillStyle = glow;
  c.fillRect(8, 8, 112, 112);
  if (charge) {
    const orb = c.createRadialGradient(60, 59, 1, 64, 64, 19);
    orb.addColorStop(0, '#f0ffff');
    orb.addColorStop(0.4, '#9aeeff');
    orb.addColorStop(1, '#129accaa');
    c.fillStyle = orb;
    c.beginPath();
    c.arc(64, 64, 18 + Math.sin(phase) * 2, 0, tau);
    c.fill();
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = i % 2 ? '#d8ffffdd' : '#4dcfffe0';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(64, 64, 26 + i * 7, 20 + i * 6, phase + i, 0, Math.PI * 1.35);
      c.stroke();
    }
  }
  for (let i = 0; i < (charge ? 9 : 19); i++) {
    const t = (frame / 12 + i * 0.137) % 1;
    // Impact opens into a fan around the forward face of the jet.
    const a = charge ? i * 2.4 + phase : -Math.PI * 0.8 + (i / 18) * Math.PI * 1.6;
    const radius = charge ? 49 - t * 20 : 10 + t * 43;
    const x = 64 + Math.cos(a) * radius * (charge ? 1 : 0.7);
    const y = 64 + Math.sin(a) * radius;
    c.globalAlpha = charge ? 0.9 : 1 - t * 0.8;
    c.strokeStyle = '#a4f3ff';
    c.lineWidth = 1.5 + (1 - t) * 1.5;
    c.beginPath();
    c.moveTo(64 + (x - 64) * 0.5, 64 + (y - 64) * 0.5);
    c.quadraticCurveTo(x - 8, y, x, y + (charge ? 0 : t * t * 7));
    c.stroke();
    c.fillStyle = i % 3 ? '#70dfff' : '#eaffff';
    c.beginPath();
    c.ellipse(x, y, 2, 3.4, a - Math.PI / 2, 0, tau);
    c.fill();
  }
  c.globalAlpha = 1;
}
