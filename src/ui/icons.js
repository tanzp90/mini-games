/**
 * Menu artwork. Same rule as the games: everything is drawn, nothing is
 * loaded. These are the wordless cues that carry the setup screen for a
 * child who cannot read the labels underneath them.
 */

import { drawAnimal } from '../engine/animals.js';
import { circle, fillCircle, poly, rr, star } from '../engine/draw.js';

/** Prepare a canvas for crisp drawing at its CSS size. */
export function prep(canvas, cssW, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cssW, cssH);
  return g;
}

/** The difficulty turtle: slow, friendly, obviously the gentle option. */
export function drawTurtle(g, cx, cy, r) {
  fillCircle(g, cx + r * 0.82, cy + r * 0.1, r * 0.34, '#7ec98a');
  fillCircle(g, cx + r * 0.92, cy + r * 0.02, r * 0.07, '#2b2b2b');
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + s * r * 0.45, cy + r * 0.62, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
    g.fillStyle = '#7ec98a';
    g.fill();
  }
  g.beginPath();
  g.ellipse(cx, cy, r, r * 0.78, 0, Math.PI, 0);
  g.closePath();
  g.fillStyle = '#4e9b5c';
  g.fill();
  g.save();
  g.beginPath();
  g.ellipse(cx, cy, r, r * 0.78, 0, Math.PI, 0);
  g.clip();
  for (let i = -2; i <= 2; i++) {
    poly(g, cx + i * r * 0.42, cy - r * 0.24, r * 0.22, 6);
    g.fillStyle = '#3d7d49';
    g.fill();
  }
  g.restore();
}

/** The difficulty rocket: fast, and the only non-animal in the set. */
export function drawRocket(g, cx, cy, r) {
  g.save();
  g.translate(cx, cy);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * r * 0.3, r * 0.3);
    g.lineTo(s * r * 0.78, r * 0.86);
    g.lineTo(s * r * 0.3, r * 0.86);
    g.closePath();
    g.fillStyle = '#e8453c';
    g.fill();
  }
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(r * 0.46, -r * 0.1, r * 0.36, r * 0.86);
  g.lineTo(-r * 0.36, r * 0.86);
  g.quadraticCurveTo(-r * 0.46, -r * 0.1, 0, -r);
  g.closePath();
  g.fillStyle = '#f6f2ea';
  g.fill();
  g.strokeStyle = '#c9c0b2';
  g.lineWidth = Math.max(1.5, r * 0.05);
  g.stroke();
  fillCircle(g, 0, -r * 0.16, r * 0.24, '#4aa3c7');
  fillCircle(g, -r * 0.07, -r * 0.23, r * 0.08, 'rgba(255,255,255,.75)');
  g.beginPath();
  g.moveTo(-r * 0.2, r * 0.86);
  g.quadraticCurveTo(0, r * 1.5, r * 0.2, r * 0.86);
  g.closePath();
  g.fillStyle = '#f2a63c';
  g.fill();
  g.restore();
}

/** A rounded speech-bubble style badge behind the player-count art. */
function ground(g, w, h, fill) {
  rr(g, 2, 2, w - 4, h - 4, 18);
  g.fillStyle = fill;
  g.fill();
}

/**
 * Draw one of the named setup-screen illustrations into a prepared context.
 * @param {CanvasRenderingContext2D} g
 * @param {string} name one | two | turtle | rabbit | rocket
 */
export function drawChoiceArt(g, name, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  switch (name) {
    case 'one':
      ground(g, w, h, '#eef6f9');
      drawAnimal(g, 'fox', cx, cy + 2, h * 0.34);
      break;
    case 'two':
      ground(g, w, h, '#fdf1e4');
      drawAnimal(g, 'fox', cx - w * 0.17, cy + 2, h * 0.3);
      drawAnimal(g, 'panda', cx + w * 0.17, cy + 2, h * 0.3);
      break;
    case 'turtle':
      ground(g, w, h, '#eef7ee');
      drawTurtle(g, cx - w * 0.05, cy + h * 0.06, h * 0.3);
      break;
    case 'rabbit':
      ground(g, w, h, '#fdf4f6');
      drawAnimal(g, 'rabbit', cx, cy + h * 0.1, h * 0.29);
      break;
    case 'rocket':
      ground(g, w, h, '#f4eefb');
      drawRocket(g, cx, cy, h * 0.34);
      break;
    default:
      break;
  }
}

/** App mark: three animals peeking over a rounded card. */
export function drawBrand(g, size) {
  const cx = size / 2;
  rr(g, size * 0.06, size * 0.34, size * 0.88, size * 0.58, size * 0.16);
  g.fillStyle = '#f2c14e';
  g.fill();
  g.strokeStyle = '#20313a';
  g.lineWidth = size * 0.05;
  g.stroke();
  drawAnimal(g, 'fox', cx - size * 0.26, size * 0.33, size * 0.15);
  drawAnimal(g, 'panda', cx + size * 0.26, size * 0.33, size * 0.15);
  drawAnimal(g, 'frog', cx, size * 0.26, size * 0.17);
  star(g, cx, size * 0.68, size * 0.15);
  g.fillStyle = '#fff';
  g.fill();
}

/** Winner / draw illustration on the results panel. */
export function drawResultArt(g, w, h, outcome, animalId) {
  g.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h * 0.58;
  const r = h * 0.3;

  if (outcome === 'win') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      star(g, cx + Math.cos(a) * r * 1.9, cy + Math.sin(a) * r * 1.25, h * 0.045);
      g.fillStyle = i % 2 ? '#f2c14e' : '#4aa3c7';
      g.globalAlpha = 0.85;
      g.fill();
    }
    g.globalAlpha = 1;
  }

  drawAnimal(g, animalId, cx, cy, r, { sad: outcome === 'lose', blink: outcome === 'lose' });

  if (outcome === 'win') {
    // A small crown, so the outcome reads without any text at all.
    g.beginPath();
    g.moveTo(cx - r * 0.62, cy - r * 1.06);
    g.lineTo(cx - r * 0.4, cy - r * 1.5);
    g.lineTo(cx - r * 0.12, cy - r * 1.14);
    g.lineTo(cx + r * 0.12, cy - r * 1.6);
    g.lineTo(cx + r * 0.4, cy - r * 1.14);
    g.lineTo(cx + r * 0.62, cy - r * 1.5);
    g.lineTo(cx + r * 0.7, cy - r * 1.0);
    g.lineTo(cx - r * 0.7, cy - r * 1.0);
    g.closePath();
    g.fillStyle = '#f2c14e';
    g.fill();
    g.strokeStyle = '#c99a1e';
    g.lineWidth = Math.max(2, h * 0.012);
    g.stroke();
  }
}

/** Sticker face for the album: the game's own icon inside a rosette. */
export function drawSticker(g, size, gold, drawIcon) {
  const cx = size / 2;
  const petals = 14;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    circle(g, cx + Math.cos(a) * size * 0.4, cx + Math.sin(a) * size * 0.4, size * 0.115);
    g.fillStyle = gold ? '#f2c14e' : '#ffffff';
    g.fill();
    g.strokeStyle = gold ? '#c99a1e' : '#20313a';
    g.lineWidth = size * 0.022;
    g.stroke();
  }
  fillCircle(g, cx, cx, size * 0.4, gold ? '#fff6e0' : '#ffffff');
  circle(g, cx, cx, size * 0.4);
  g.strokeStyle = gold ? '#c99a1e' : '#20313a';
  g.lineWidth = size * 0.03;
  g.stroke();
  g.save();
  g.translate(cx - size * 0.3, cx - size * 0.3);
  g.scale(0.6, 0.6);
  drawIcon(g, size);
  g.restore();
}
