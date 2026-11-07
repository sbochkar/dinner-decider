import { reduceMotion } from './ui.js';

const COLORS = ['#ea580c', '#f59e0b', '#e11d48', '#0d9488', '#7c3aed', '#2563eb', '#65a30d', '#db2777'];

export class Wheel {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.items = [];
    this.angle = 0; // clockwise rotation in radians
    this.spinning = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const size = 400;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    this.size = size;
    this.ctx.scale(dpr, dpr);
  }

  setItems(labels) {
    this.items = labels;
    this.draw();
  }

  draw() {
    const { ctx, size, items } = this;
    const c = size / 2;
    ctx.clearRect(0, 0, size, size);
    if (!items.length) return;
    const seg = (Math.PI * 2) / items.length;

    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(this.angle);
    items.forEach((label, i) => {
      const a0 = -Math.PI / 2 + i * seg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, c, a0, a0 + seg);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      const fontPx = items.length > 10 ? 13 : 15;
      ctx.font = `700 ${fontPx}px system-ui, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 3;
      ctx.fillText(fit(ctx, label, c * 0.62), c - 16, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  // Animates so that item `index` ends under the pointer at the top.
  spin(index) {
    if (this.spinning || !this.items.length) return Promise.resolve();
    const seg = (Math.PI * 2) / this.items.length;
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const base = -((index + 0.5) * seg) + jitter;
    const current = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let delta = (((base - current) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    delta += Math.PI * 2 * (5 + Math.floor(Math.random() * 3));

    const from = this.angle;
    if (reduceMotion()) {
      this.angle = from + delta;
      this.draw();
      return Promise.resolve();
    }
    const duration = 4200;
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    this.spinning = true;
    return new Promise((resolve) => {
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        this.angle = from + delta * ease(t);
        this.draw();
        if (t < 1) requestAnimationFrame(tick);
        else {
          this.spinning = false;
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }
}

function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}
