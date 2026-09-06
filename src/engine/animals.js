/**
 * Procedurally drawn animal faces.
 *
 * Art direction is "friendly animals throughout" (decision 3), but shipping
 * image files would mean an asset pipeline, a cache to invalidate, and a
 * first load that fails on a plane. Every face here is built from circles,
 * arcs and triangles, so the entire cast costs a few kilobytes of code and
 * scales to any tile size without going soft.
 */

import { circle, fillCircle, poly, rr, shade } from './draw.js';

/** @typedef {{id:string, body:string, face:string, ear:string, muzzle:string, accent:string}} Animal */

/** @type {Animal[]} */
export const ANIMALS = [
  { id: 'fox', body: '#f0873a', face: '#fdf1e4', ear: 'pointy', muzzle: 'snout', accent: '#4a2f24' },
  { id: 'bear', body: '#a9743f', face: '#e7c9a5', ear: 'round', muzzle: 'snout', accent: '#3d2a1c' },
  { id: 'panda', body: '#fbfaf7', face: '#fbfaf7', ear: 'round-dark', muzzle: 'patch', accent: '#2b2b2b' },
  { id: 'frog', body: '#5cb85c', face: '#c9e9a8', ear: 'eyes-up', muzzle: 'wide', accent: '#22662b' },
  { id: 'owl', body: '#8a6db1', face: '#efe6fb', ear: 'tuft', muzzle: 'beak', accent: '#f2a63c' },
  { id: 'cat', body: '#9aa7b4', face: '#eef2f6', ear: 'pointy', muzzle: 'whisker', accent: '#3a4753' },
  { id: 'penguin', body: '#3b4756', face: '#fdfdfb', ear: 'none', muzzle: 'beak', accent: '#f2a63c' },
  { id: 'rabbit', body: '#f4e4dc', face: '#fffaf7', ear: 'tall', muzzle: 'snout', accent: '#c98b96' },
  { id: 'pig', body: '#f0a6b4', face: '#ffd9e0', ear: 'pointy', muzzle: 'trotter', accent: '#b95a72' },
  { id: 'lion', body: '#f2c14e', face: '#fde8bb', ear: 'mane', muzzle: 'snout', accent: '#8a5a1e' },
  { id: 'monkey', body: '#a8763f', face: '#f0d0a8', ear: 'side', muzzle: 'wide', accent: '#4a2f1c' },
  { id: 'elephant', body: '#9fb0bd', face: '#cdd8e0', ear: 'big', muzzle: 'trunk', accent: '#48565f' },
];

export const ANIMAL_IDS = ANIMALS.map((a) => a.id);

/** @type {Object<string, Animal>} */
const BY_ID = {};
for (const a of ANIMALS) BY_ID[a.id] = a;

/**
 * Draw an animal face centred on (cx, cy) with head radius r.
 *
 * @param {CanvasRenderingContext2D} g
 * @param {string} id one of ANIMAL_IDS
 * @param {number} cx
 * @param {number} cy
 * @param {number} r head radius
 * @param {{blink?:boolean, happy?:boolean, sad?:boolean, tilt?:number}} [opt]
 */
export function drawAnimal(g, id, cx, cy, r, opt = {}) {
  const a = BY_ID[id] || ANIMALS[0];
  g.save();
  g.translate(cx, cy);
  if (opt.tilt) g.rotate(opt.tilt);

  drawEars(g, a, r);
  drawHead(g, a, r);
  drawFace(g, a, r);
  drawEyes(g, a, r, opt);
  drawMuzzle(g, a, r, opt);

  g.restore();
}

function drawHead(g, a, r) {
  fillCircle(g, 0, 0, r, a.body);
}

function drawEars(g, a, r) {
  const dark = shade(a.body, -0.18);
  switch (a.ear) {
    case 'pointy': {
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * r * 0.42, -r * 0.72);
        g.lineTo(s * r * 0.95, -r * 1.42);
        g.lineTo(s * r * 1.02, -r * 0.5);
        g.closePath();
        g.fillStyle = a.body;
        g.fill();
        g.beginPath();
        g.moveTo(s * r * 0.55, -r * 0.78);
        g.lineTo(s * r * 0.86, -r * 1.2);
        g.lineTo(s * r * 0.88, -r * 0.62);
        g.closePath();
        g.fillStyle = a.accent;
        g.globalAlpha = 0.45;
        g.fill();
        g.globalAlpha = 1;
      }
      break;
    }
    case 'round':
      for (const s of [-1, 1]) fillCircle(g, s * r * 0.78, -r * 0.78, r * 0.36, dark);
      break;
    case 'round-dark':
      for (const s of [-1, 1]) fillCircle(g, s * r * 0.8, -r * 0.76, r * 0.38, a.accent);
      break;
    case 'tall':
      for (const s of [-1, 1]) {
        g.save();
        g.translate(s * r * 0.42, -r * 1.05);
        g.rotate(s * 0.18);
        g.beginPath();
        g.ellipse(0, 0, r * 0.26, r * 0.72, 0, 0, Math.PI * 2);
        g.fillStyle = a.body;
        g.fill();
        g.beginPath();
        g.ellipse(0, r * 0.05, r * 0.13, r * 0.5, 0, 0, Math.PI * 2);
        g.fillStyle = a.accent;
        g.globalAlpha = 0.5;
        g.fill();
        g.globalAlpha = 1;
        g.restore();
      }
      break;
    case 'big':
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(s * r * 0.92, -r * 0.12, r * 0.56, r * 0.72, s * 0.25, 0, Math.PI * 2);
        g.fillStyle = dark;
        g.fill();
      }
      break;
    case 'side':
      for (const s of [-1, 1]) {
        fillCircle(g, s * r * 0.98, -r * 0.05, r * 0.32, dark);
        fillCircle(g, s * r * 0.98, -r * 0.05, r * 0.18, a.face);
      }
      break;
    case 'tuft':
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * r * 0.3, -r * 0.85);
        g.lineTo(s * r * 0.72, -r * 1.32);
        g.lineTo(s * r * 0.8, -r * 0.72);
        g.closePath();
        g.fillStyle = shade(a.body, -0.12);
        g.fill();
      }
      break;
    case 'mane': {
      const petals = 11;
      for (let i = 0; i < petals; i++) {
        const ang = (i / petals) * Math.PI * 2;
        fillCircle(g, Math.cos(ang) * r * 0.98, Math.sin(ang) * r * 0.98, r * 0.36, '#d9922e');
      }
      break;
    }
    case 'eyes-up':
      for (const s of [-1, 1]) fillCircle(g, s * r * 0.55, -r * 0.82, r * 0.36, a.body);
      break;
    default:
      break;
  }
}

/** Face markings: the pale mask, belly or cheek patches that read as "this animal". */
function drawFace(g, a, r) {
  switch (a.id) {
    case 'fox':
      g.beginPath();
      g.moveTo(-r * 0.62, r * 0.02);
      g.quadraticCurveTo(0, -r * 0.35, r * 0.62, r * 0.02);
      g.quadraticCurveTo(r * 0.4, r * 0.92, 0, r * 0.95);
      g.quadraticCurveTo(-r * 0.4, r * 0.92, -r * 0.62, r * 0.02);
      g.closePath();
      g.fillStyle = a.face;
      g.fill();
      break;
    case 'penguin':
      g.beginPath();
      g.ellipse(0, r * 0.16, r * 0.66, r * 0.74, 0, 0, Math.PI * 2);
      g.fillStyle = a.face;
      g.fill();
      break;
    case 'panda':
      for (const s of [-1, 1]) {
        g.save();
        g.translate(s * r * 0.36, -r * 0.1);
        g.rotate(s * 0.35);
        g.beginPath();
        g.ellipse(0, 0, r * 0.3, r * 0.38, 0, 0, Math.PI * 2);
        g.fillStyle = a.accent;
        g.fill();
        g.restore();
      }
      break;
    case 'monkey':
      g.beginPath();
      g.ellipse(0, r * 0.16, r * 0.62, r * 0.66, 0, 0, Math.PI * 2);
      g.fillStyle = a.face;
      g.fill();
      break;
    case 'owl':
      for (const s of [-1, 1]) fillCircle(g, s * r * 0.38, -r * 0.12, r * 0.42, a.face);
      break;
    case 'lion':
    case 'bear':
    case 'rabbit':
    case 'elephant':
      g.beginPath();
      g.ellipse(0, r * 0.3, r * 0.56, r * 0.46, 0, 0, Math.PI * 2);
      g.fillStyle = a.face;
      g.fill();
      break;
    case 'cat':
      g.beginPath();
      g.ellipse(0, r * 0.34, r * 0.5, r * 0.38, 0, 0, Math.PI * 2);
      g.fillStyle = a.face;
      g.fill();
      break;
    case 'frog':
      g.beginPath();
      g.ellipse(0, r * 0.35, r * 0.66, r * 0.42, 0, 0, Math.PI * 2);
      g.fillStyle = a.face;
      g.fill();
      break;
    default:
      break;
  }
}

function drawEyes(g, a, r, opt) {
  const eyeY = a.ear === 'eyes-up' ? -r * 0.82 : -r * 0.12;
  const dx = a.ear === 'eyes-up' ? r * 0.55 : r * 0.36;
  const eyeR = a.id === 'owl' ? r * 0.2 : r * 0.15;

  for (const s of [-1, 1]) {
    const ex = s * dx;
    if (a.ear === 'eyes-up') fillCircle(g, ex, eyeY, r * 0.22, '#ffffff');
    if (opt.blink) {
      g.beginPath();
      g.moveTo(ex - eyeR, eyeY);
      g.lineTo(ex + eyeR, eyeY);
      g.strokeStyle = '#2b2b2b';
      g.lineWidth = Math.max(2, r * 0.09);
      g.lineCap = 'round';
      g.stroke();
    } else {
      fillCircle(g, ex, eyeY, eyeR, '#2b2b2b');
      fillCircle(g, ex + eyeR * 0.34, eyeY - eyeR * 0.34, eyeR * 0.36, '#ffffff');
    }
  }
}

function drawMuzzle(g, a, r, opt) {
  const noseY = r * 0.22;
  switch (a.muzzle) {
    case 'beak':
      g.beginPath();
      g.moveTo(-r * 0.2, noseY - r * 0.04);
      g.lineTo(r * 0.2, noseY - r * 0.04);
      g.lineTo(0, noseY + r * 0.36);
      g.closePath();
      g.fillStyle = a.accent;
      g.fill();
      break;
    case 'trotter':
      g.beginPath();
      g.ellipse(0, noseY + r * 0.12, r * 0.3, r * 0.23, 0, 0, Math.PI * 2);
      g.fillStyle = a.accent;
      g.fill();
      for (const s of [-1, 1]) fillCircle(g, s * r * 0.11, noseY + r * 0.12, r * 0.055, '#7d3a4e');
      break;
    case 'trunk':
      g.beginPath();
      g.moveTo(-r * 0.17, noseY - r * 0.1);
      g.quadraticCurveTo(-r * 0.2, r * 1.15, r * 0.14, r * 1.12);
      g.quadraticCurveTo(r * 0.02, r * 0.9, r * 0.17, noseY - r * 0.1);
      g.closePath();
      g.fillStyle = shade(a.body, -0.1);
      g.fill();
      break;
    case 'wide':
      g.beginPath();
      g.arc(0, r * 0.18, r * 0.44, 0.15 * Math.PI, 0.85 * Math.PI);
      g.strokeStyle = a.accent;
      g.lineWidth = Math.max(2, r * 0.1);
      g.lineCap = 'round';
      g.stroke();
      break;
    case 'whisker':
      fillCircle(g, 0, noseY, r * 0.11, a.accent);
      for (const s of [-1, 1]) {
        for (let i = -1; i <= 1; i++) {
          g.beginPath();
          g.moveTo(s * r * 0.16, noseY + i * r * 0.05);
          g.lineTo(s * r * 0.78, noseY + i * r * 0.19);
          g.strokeStyle = 'rgba(58,71,83,0.55)';
          g.lineWidth = Math.max(1, r * 0.035);
          g.lineCap = 'round';
          g.stroke();
        }
      }
      break;
    case 'patch':
      fillCircle(g, 0, noseY, r * 0.13, a.accent);
      break;
    case 'snout':
    default:
      fillCircle(g, 0, noseY, r * 0.13, a.accent);
      g.beginPath();
      if (opt.sad) {
        g.arc(0, r * 0.62, r * 0.24, 1.15 * Math.PI, 1.85 * Math.PI);
      } else {
        g.arc(0, r * 0.4, r * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
      }
      g.strokeStyle = a.accent;
      g.lineWidth = Math.max(2, r * 0.075);
      g.lineCap = 'round';
      g.stroke();
      break;
  }
}

/**
 * A card-shaped tile with an animal on it. Used by Snap Safari, Memory Zoo
 * and the player badges in the shell.
 */
export function animalCard(g, id, x, y, w, h, opt = {}) {
  const r = Math.min(w, h) * 0.16;
  rr(g, x, y, w, h, r);
  g.fillStyle = opt.bg || '#ffffff';
  g.fill();
  if (opt.rim !== false) {
    rr(g, x + 2, y + 2, w - 4, h - 4, Math.max(0, r - 2));
    g.strokeStyle = opt.rimColor || 'rgba(32,49,58,0.16)';
    g.lineWidth = 3;
    g.stroke();
  }
  drawAnimal(g, id, x + w / 2, y + h / 2, Math.min(w, h) * 0.3, opt);
}

/** The back of a face-down card: a simple, obviously non-informative pattern. */
export function cardBack(g, x, y, w, h, colour = '#4aa3c7') {
  const r = Math.min(w, h) * 0.16;
  rr(g, x, y, w, h, r);
  g.fillStyle = colour;
  g.fill();
  g.save();
  rr(g, x, y, w, h, r);
  g.clip();
  g.globalAlpha = 0.22;
  const step = Math.min(w, h) * 0.34;
  for (let i = -h; i < w + h; i += step) {
    g.beginPath();
    g.moveTo(x + i, y);
    g.lineTo(x + i + h, y + h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = step * 0.3;
    g.stroke();
  }
  g.restore();
  fillCircle(g, x + w / 2, y + h / 2, Math.min(w, h) * 0.17, 'rgba(255,255,255,0.9)');
  poly(g, x + w / 2, y + h / 2, Math.min(w, h) * 0.09, 5);
  g.fillStyle = colour;
  g.fill();
}
