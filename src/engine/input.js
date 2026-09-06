/**
 * Pointer handling for the game canvas.
 *
 * Multi-touch matters here: in the duel layout both players have their
 * fingers down at the same time, so every pointer is tracked by id rather
 * than assuming a single cursor.
 */

/** @typedef {{type:'down'|'move'|'up', id:number, x:number, y:number}} Ptr */

export class Input {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(p: Ptr) => void} handler receives coordinates in CSS pixels
   */
  constructor(canvas, handler) {
    this.canvas = canvas;
    this.handler = handler;
    /** @type {Map<number, {x:number,y:number}>} */
    this.active = new Map();

    this._down = (e) => this._emit(e, 'down');
    this._move = (e) => this._emit(e, 'move');
    this._up = (e) => this._emit(e, 'up');

    canvas.addEventListener('pointerdown', this._down, { passive: false });
    canvas.addEventListener('pointermove', this._move, { passive: false });
    canvas.addEventListener('pointerup', this._up, { passive: false });
    canvas.addEventListener('pointercancel', this._up, { passive: false });
    // Stop the browser claiming the gesture as a scroll or a page zoom.
    canvas.addEventListener('touchstart', prevent, { passive: false });
    canvas.addEventListener('touchmove', prevent, { passive: false });
    canvas.addEventListener('contextmenu', prevent);
  }

  /** @param {PointerEvent} e */
  _emit(e, type) {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    if (type === 'down') {
      this.active.set(e.pointerId, { x, y });
      // Keep receiving moves even when the finger leaves the element.
      if (this.canvas.setPointerCapture) {
        try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
    } else if (type === 'move') {
      if (!this.active.has(e.pointerId)) return; // hover, not a drag
      this.active.set(e.pointerId, { x, y });
    } else {
      if (!this.active.has(e.pointerId)) return;
      this.active.delete(e.pointerId);
    }

    this.handler({ type, id: e.pointerId, x, y });
  }

  destroy() {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._down);
    c.removeEventListener('pointermove', this._move);
    c.removeEventListener('pointerup', this._up);
    c.removeEventListener('pointercancel', this._up);
    c.removeEventListener('touchstart', prevent);
    c.removeEventListener('touchmove', prevent);
    c.removeEventListener('contextmenu', prevent);
    this.active.clear();
  }
}

function prevent(e) {
  e.preventDefault();
}

/** Is (px,py) inside the rect? Rects are {x,y,w,h} in CSS pixels. */
export function hit(rect, px, py) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

/** Is (px,py) within r of (cx,cy)? */
export function hitCircle(cx, cy, r, px, py) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}
