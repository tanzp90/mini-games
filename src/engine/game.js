/**
 * The contract every one of the ten games implements.
 *
 * Keeping this interface small is what makes ten games one codebase rather
 * than ten codebases: the shell owns the round timer, the pause button, the
 * scoreboard chrome and the results screen, and a game only has to know how
 * to draw itself and respond to a finger.
 */

/**
 * @typedef {Object} GameEnv
 * @property {number} w canvas width in CSS pixels
 * @property {number} h canvas height in CSS pixels
 * @property {import('./rng.js').Rng} rng seeded for this round
 * @property {'1p'|'2p'} mode
 * @property {number} difficulty 0 turtle, 1 rabbit, 2 rocket (ignored in 2p)
 * @property {boolean} portrait true when the split must run horizontally
 * @property {typeof import('./audio.js').sfx} sfx
 * @property {(r: RoundResult) => void} finish call once when the round ends
 */

/**
 * @typedef {Object} RoundResult
 * @property {number[]} scores [player1, player2]
 * @property {0|1|null} winner null for a draw
 * @property {number} stars 0-3, player 1's own performance
 */

export class MiniGame {
  /**
   * Static description used by the picker and the setup screen.
   * @type {{id:string, title:string, category:string, verb:string,
   *         layout:'duel'|'shared', seconds:number, tint:string}}
   */
  static meta = {
    id: 'base',
    title: 'Base',
    category: '',
    verb: 'tap',
    layout: 'shared',
    seconds: 90,
    tint: '#4aa3c7',
  };

  /** @param {GameEnv} env */
  constructor(env) {
    this.env = env;
    this.w = env.w;
    this.h = env.h;
    this.over = false;
    /** Seconds left, when the game is on a clock. -1 means untimed. */
    this.timeLeft = this.constructor.meta.seconds;
  }

  /** The canvas changed size or the tablet rotated. */
  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  /** Advance the simulation by a fixed step. */
  update(_dt) {}

  /** @param {CanvasRenderingContext2D} _g */
  render(_g) {}

  /** @param {import('./input.js').Ptr} _p */
  pointer(_p) {}

  /** Release anything the game allocated. */
  destroy() {}

  /**
   * End the round exactly once.
   * @param {RoundResult} result
   */
  end(result) {
    if (this.over) return;
    this.over = true;
    this.env.finish(result);
  }

  /**
   * Star rating shared by the score-based games: one star for finishing,
   * two for winning, three for winning well.
   */
  starsFor(mine, theirs, wellMargin = 3) {
    if (mine > theirs + wellMargin) return 3;
    if (mine > theirs) return 2;
    if (mine === theirs) return 1;
    return mine > 0 ? 1 : 0;
  }
}
