// Tiny DOM helpers. Text is always set via textContent/createTextNode, never innerHTML,
// so data from OpenStreetMap can't inject markup.
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(node) {
  node.replaceChildren();
  return node;
}

export function toast(message, ms = 3200) {
  const node = h('div', { class: 'toast', text: message });
  $('#toasts').append(node);
  setTimeout(() => node.remove(), ms);
}

export function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

export function wireDialogs() {
  for (const d of $$('dialog')) {
    d.addEventListener('click', (e) => {
      // click on backdrop (the dialog element itself) or any [data-close]
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
  }
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export { reduceMotion };

export function vibrate(ms = 20) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

// Dependency-free confetti. Drawn on a popover so it layers above open <dialog>s.
export function confetti() {
  if (reduceMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti';
  canvas.setAttribute('popover', 'manual');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;padding:0;background:transparent;pointer-events:none;overflow:visible';
  document.body.append(canvas);
  try {
    canvas.showPopover();
  } catch {
    /* older browsers: falls back to normal stacking */
  }
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#ea580c', '#f59e0b', '#fb7185', '#34d399', '#60a5fa', '#a78bfa'];
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 4,
    s: 5 + Math.random() * 6,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const start = performance.now();
  (function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.38;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 2800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6);
      ctx.restore();
    }
    if (t < 2800) requestAnimationFrame(frame);
    else canvas.remove();
  })(start);
}
