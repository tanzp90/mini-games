/**
 * Fixed-timestep game loop.
 *
 * Physics and AI timers advance in fixed 1/120 s steps so that a penguin
 * slid on a 60 Hz tablet behaves identically to one slid on a 120 Hz iPad,
 * while rendering still happens once per animation frame.
 */

const STEP = 1 / 120;
const MAX_FRAME = 0.25; // after a tab switch, never simulate a huge catch-up

export class Loop {
  /**
   * @param {(dt:number) => void} update
   * @param {() => void} render
   */
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.acc = 0;
    this.last = 0;
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  _frame(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this._frame);

    let elapsed = (now - this.last) / 1000;
    this.last = now;
    if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;

    this.acc += elapsed;
    while (this.acc >= STEP) {
      this.update(STEP);
      this.acc -= STEP;
    }
    this.render();
  }
}
