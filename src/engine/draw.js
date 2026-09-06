/**
 * Canvas drawing helpers shared by every game.
 *
 * The palette here is the whole collection's colour language. Rule 04 of
 * the design brief is that colour is never the only signal, so each of the
 * six play colours is permanently married to a shape. A child who cannot
 * distinguish red from green can still play every game in the set by shape
 * alone, and younger players find the shapes easier regardless.
 */

export const PALETTE = [
  { id: 0, name: 'red', hex: '#e8453c', dark: '#b32e27', shape: 'circle' },
  { id: 1, name: 'blue', hex: '#2b7fd4', dark: '#1c5896', shape: 'square' },
  { id: 2, name: 'yellow', hex: '#f2c12e', dark: '#bd9110', shape: 'triangle' },
  { id: 3, name: 'green', hex: '#34a853', dark: '#22773a', shape: 'star' },
  { id: 4, name: 'purple', hex: '#8a4fd1', dark: '#603397', shape: 'diamond' },
  { id: 5, name: 'orange', hex: '#f2802e', dark: '#bd5c14', shape: 'hex' },
];

/** Player identity colours, used for scores, glows and turn indicators. */
export const PLAYER = [
  { hex: '#f26a4b', dark: '#c04326', name: 'coral' },
  { hex: '#4aa3c7', dark: '#2b7292', name: 'teal' },
];

export const INK = '#20313a';
export const INK_SOFT = '#5b7480';
export const PAPER = '#fdfaf4';

/** Rounded rectangle path. */
export function rr(g, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

export function fillRR(g, x, y, w, h, r, fill) {
  rr(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
}

export function circle(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.closePath();
}

export function fillCircle(g, x, y, r, fill) {
  circle(g, x, y, r);
  g.fillStyle = fill;
  g.fill();
}

/** Regular polygon, first vertex pointing up. */
export function poly(g, x, y, r, sides, rot = 0) {
  g.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI * 2) / sides;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

export function star(g, x, y, r, points = 5) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/**
 * Draw the shape that identifies a palette colour.
 * @param {CanvasRenderingContext2D} g
 * @param {string} shape one of PALETTE[].shape
 */
export function shapeGlyph(g, shape, x, y, r, fill) {
  g.fillStyle = fill;
  switch (shape) {
    case 'circle': circle(g, x, y, r); break;
    case 'square': rr(g, x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7, r * 0.22); break;
    case 'triangle': poly(g, x, y + r * 0.12, r * 1.1, 3); break;
    case 'star': star(g, x, y, r * 1.12); break;
    case 'diamond': poly(g, x, y, r * 1.15, 4); break;
    case 'hex': poly(g, x, y, r * 1.05, 6, Math.PI / 6); break;
    default: circle(g, x, y, r);
  }
  g.fill();
}

/** A chunky play tile: colour fill, darker rim, and its shape stamped on top. */
export function paletteTile(g, colourId, x, y, w, h, opts = {}) {
  const c = PALETTE[colourId];
  const r = opts.radius == null ? Math.min(w, h) * 0.22 : opts.radius;
  fillRR(g, x, y, w, h, r, c.hex);
  if (opts.rim !== false) {
    rr(g, x + 1.5, y + 1.5, w - 3, h - 3, Math.max(0, r - 1.5));
    g.strokeStyle = c.dark;
    g.lineWidth = 3;
    g.stroke();
  }
  if (opts.glyph !== false) {
    g.globalAlpha = opts.glyphAlpha == null ? 0.42 : opts.glyphAlpha;
    shapeGlyph(g, c.shape, x + w / 2, y + h / 2, Math.min(w, h) * 0.26, '#ffffff');
    g.globalAlpha = 1;
  }
}

/**
 * Text with an automatic contrast outline, so a label stays readable
 * whatever colour it lands on.
 */
export function text(g, str, x, y, size, opts = {}) {
  g.save();
  g.font = `${opts.weight || 800} ${size}px ${opts.font || 'Baloo2, Nunito, system-ui, sans-serif'}`;
  g.textAlign = opts.align || 'center';
  g.textBaseline = opts.baseline || 'middle';
  if (opts.outline !== false) {
    g.lineWidth = size * (opts.outlineWidth || 0.18);
    g.lineJoin = 'round';
    g.strokeStyle = opts.outlineColor || 'rgba(255,255,255,0.85)';
    g.strokeText(str, x, y);
  }
  g.fillStyle = opts.fill || INK;
  g.fillText(str, x, y);
  g.restore();
}

/** Soft drop shadow around whatever the next fill draws. */
export function shadow(g, blur = 12, y = 4, colour = 'rgba(32,49,58,0.18)') {
  g.shadowColor = colour;
  g.shadowBlur = blur;
  g.shadowOffsetY = y;
}

export function noShadow(g) {
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
}

/** A big, obviously-pressable round button. Minimum 88px diameter in use. */
export function bigButton(g, x, y, r, colour, pressed = false) {
  const off = pressed ? 2 : 6;
  fillCircle(g, x, y + off, r, shade(colour, -0.35));
  fillCircle(g, x, y, r, colour);
  circle(g, x, y - r * 0.28, r * 0.72);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fill();
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const to = amt < 0 ? 0 : 255;
  const t = Math.abs(amt);
  const r = Math.round(((n >> 16) & 255) * (1 - t) + to * t);
  const gg = Math.round(((n >> 8) & 255) * (1 - t) + to * t);
  const b = Math.round((n & 255) * (1 - t) + to * t);
  return `#${((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1)}`;
}

/** Linear interpolation helpers used all over the games. */
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** Smooth 0..1 easing for pops, flips and slides. */
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** Overshoot ease — what makes a card flip or a tile land feel bouncy. */
export function easeBack(t) {
  const c = 1.70158;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}
