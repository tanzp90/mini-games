/**
 * Duel layout: two players sharing one tablet, sitting across from each
 * other with the tablet flat between them.
 *
 * The divider always runs horizontally, in both orientations. Player 1 owns
 * the bottom half in normal orientation; player 2 owns the top half, rotated
 * 180 degrees so the game is the right way up from where they are sitting.
 * In landscape each half is a wide strip, in portrait each is closer to
 * square, and games lay themselves out from the half's own aspect ratio —
 * which is what makes portrait a genuine layout rather than a letterboxed
 * fallback.
 */

/** @typedef {{x:number, y:number, w:number, h:number, flip:boolean, index:number}} Zone */

/**
 * @param {number} w @param {number} h
 * @returns {[Zone, Zone]} index 0 is player 1 (near), index 1 is player 2 (far)
 */
export function duelZones(w, h) {
  const half = h / 2;
  return [
    { x: 0, y: half, w, h: half, flip: false, index: 0 },
    { x: 0, y: 0, w, h: half, flip: true, index: 1 },
  ];
}

/** A single zone covering the whole canvas, for shared-board games. */
export function fullZone(w, h) {
  return { x: 0, y: 0, w, h, flip: false, index: 0 };
}

/**
 * Run `fn` with the canvas transformed so that (0,0)-(zone.w,zone.h) is the
 * player's own view, whichever way up they are sitting.
 * @param {CanvasRenderingContext2D} g
 * @param {Zone} zone
 * @param {(g: CanvasRenderingContext2D) => void} fn
 */
export function inZone(g, zone, fn) {
  g.save();
  if (zone.flip) {
    g.translate(zone.x + zone.w, zone.y + zone.h);
    g.rotate(Math.PI);
  } else {
    g.translate(zone.x, zone.y);
  }
  g.beginPath();
  g.rect(0, 0, zone.w, zone.h);
  g.clip();
  fn(g);
  g.restore();
}

/**
 * Convert a canvas-space pointer into a zone's local coordinates.
 * @returns {{x:number, y:number}|null} null when the touch is outside the zone
 */
export function toLocal(zone, px, py) {
  if (px < zone.x || px > zone.x + zone.w || py < zone.y || py > zone.y + zone.h) return null;
  if (zone.flip) {
    return { x: zone.x + zone.w - px, y: zone.y + zone.h - py };
  }
  return { x: px - zone.x, y: py - zone.y };
}

/** Which zone does this touch belong to? @returns {Zone|null} */
export function zoneAt(zones, px, py) {
  for (const z of zones) {
    if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) return z;
  }
  return null;
}

/** The dashed line down the middle of a duel board. */
export function drawDivider(g, w, h) {
  g.save();
  g.setLineDash([12, 10]);
  g.strokeStyle = 'rgba(32,49,58,0.22)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, h / 2);
  g.lineTo(w, h / 2);
  g.stroke();
  g.restore();
}

/**
 * A small upright "AI" chip in the corner of a duel board.
 *
 * The far half is drawn rotated, so any label inside it reads upside down to
 * the human sitting at the near edge - useless exactly where it is needed.
 * This goes in screen space instead.
 */
export function drawAiChip(g, w) {
  const bw = 46;
  const bh = 26;
  const x = w - bw - 14;
  const y = 12;
  g.save();
  g.beginPath();
  g.moveTo(x + 13, y);
  g.arcTo(x + bw, y, x + bw, y + bh, 13);
  g.arcTo(x + bw, y + bh, x, y + bh, 13);
  g.arcTo(x, y + bh, x, y, 13);
  g.arcTo(x, y, x + bw, y, 13);
  g.closePath();
  g.fillStyle = 'rgba(32,49,58,0.72)';
  g.fill();
  g.font = '800 15px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.fillText('AI', x + bw / 2, y + bh / 2 + 1);
  g.restore();
}
