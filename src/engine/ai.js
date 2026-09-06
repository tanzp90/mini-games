/**
 * Shared difficulty machinery.
 *
 * The rule the whole collection is built on: an easy opponent is SLOWER and
 * MORE SHORT-SIGHTED, never randomly broken. A five-year-old reads visible
 * nonsense as "this game is stupid" and stops playing, so Turtle is modelled
 * as long reaction times, a one-move horizon and a leaky memory rather than
 * as noise sprayed over a good move.
 *
 * Every ladder in the games maps onto a real axis: reaction-time
 * distribution, search depth, memory buffer size, aim error, or risk
 * threshold.
 */

export const TURTLE = 0;
export const RABBIT = 1;
export const ROCKET = 2;

export const TIER_NAMES = ['turtle', 'rabbit', 'rocket'];

/**
 * Pick the entry for the current tier out of a three-element table.
 * @template T @param {T[]} table @param {number} tier @returns {T}
 */
export function byTier(table, tier) {
  return table[Math.max(0, Math.min(table.length - 1, tier))];
}

/**
 * Human-plausible reaction time in seconds.
 *
 * The floor matters: without it, Rocket answers in single-digit
 * milliseconds and no child can ever win, which is not a difficulty
 * setting, it is a wall.
 *
 * @param {import('./rng.js').Rng} rng
 * @param {{mean:number, sd:number, floor?:number}} spec milliseconds
 */
export function reactionSeconds(rng, spec) {
  const floor = spec.floor == null ? 330 : spec.floor;
  const ms = Math.max(floor, rng.gaussian(spec.mean, spec.sd));
  return ms / 1000;
}

/**
 * A reaction-game opponent: waits for a cue, then answers after a delay,
 * sometimes missing the cue entirely.
 *
 * Used by Snap Safari and, in a rate-limited form, by Rope Rumble.
 */
export class Reactor {
  /**
   * @param {import('./rng.js').Rng} rng
   * @param {{mean:number, sd:number, floor?:number, missRate:number}} spec
   */
  constructor(rng, spec) {
    this.rng = rng;
    this.spec = spec;
    this.armed = false;
    this.timer = 0;
    this.willAnswer = false;
  }

  /** A cue just appeared. Decide now whether this one gets noticed at all. */
  arm() {
    this.armed = true;
    this.willAnswer = !this.rng.chance(this.spec.missRate);
    this.timer = reactionSeconds(this.rng, this.spec);
  }

  /** The cue went away before the opponent acted. */
  disarm() {
    this.armed = false;
    this.willAnswer = false;
  }

  /** @returns {boolean} true on the single frame the opponent acts. */
  update(dt) {
    if (!this.armed || !this.willAnswer) return false;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.armed = false;
      return true;
    }
    return false;
  }
}

/**
 * Turn-based opponents pause before moving. Without this the AI answers
 * instantly and the board feels like it is playing itself; with it, a child
 * can follow what happened.
 */
export class Thinker {
  /** @param {import('./rng.js').Rng} rng @param {[number,number]} rangeSec */
  constructor(rng, rangeSec = [0.5, 1.1]) {
    this.rng = rng;
    this.range = rangeSec;
    this.timer = 0;
    this.pending = null;
  }

  /** @param {() => void} action run once the pause elapses */
  schedule(action) {
    this.pending = action;
    this.timer = this.rng.range(this.range[0], this.range[1]);
  }

  update(dt) {
    if (!this.pending) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      const fn = this.pending;
      this.pending = null;
      fn();
    }
  }

  get busy() {
    return this.pending !== null;
  }

  cancel() {
    this.pending = null;
  }
}

/**
 * Should this move be a deliberate mistake?
 *
 * Blunders are applied by substituting a *legal, plausible* move, never a
 * self-destructive one — the difference between an opponent who is playing
 * badly and an opponent who looks broken.
 */
export function blunders(rng, rate) {
  return rng.chance(rate);
}

/**
 * Aim error for the physics game: an angle wobble and a power wobble.
 * @param {import('./rng.js').Rng} rng
 * @param {{angleDeg:number, powerPct:number}} spec
 */
export function aimError(rng, spec) {
  return {
    angle: (rng.gaussian(0, spec.angleDeg / 2) * Math.PI) / 180,
    power: 1 + rng.gaussian(0, spec.powerPct / 200),
  };
}

/**
 * A leaky memory, used by Memory Zoo.
 *
 * Turtle does not "forget randomly at recall time" — it genuinely holds
 * fewer cards, and what it does hold it sometimes misplaces. That produces
 * the natural behaviour of a young player rather than an oracle rolling
 * dice against itself.
 */
export class LeakyMemory {
  /**
   * @param {import('./rng.js').Rng} rng
   * @param {{capacity:number, accuracy:number}} spec capacity Infinity = perfect
   */
  constructor(rng, spec) {
    this.rng = rng;
    this.spec = spec;
    /** @type {Array<{key:number, value:string}>} most recent last */
    this.slots = [];
  }

  /** @param {number} key card index @param {string} value what was on it */
  see(key, value) {
    const at = this.slots.findIndex((s) => s.key === key);
    if (at >= 0) this.slots.splice(at, 1);
    this.slots.push({ key, value });
    while (this.slots.length > this.spec.capacity) this.slots.shift();
  }

  /** Everything currently remembered, subject to recall accuracy. */
  recall() {
    /** @type {Object<string, number[]>} value -> card indices */
    const out = {};
    for (const s of this.slots) {
      if (this.spec.accuracy < 1 && !this.rng.chance(this.spec.accuracy)) continue;
      (out[s.value] = out[s.value] || []).push(s.key);
    }
    return out;
  }

  /** Cards known to be gone, so the AI never flips a matched pair. */
  forget(key) {
    const at = this.slots.findIndex((s) => s.key === key);
    if (at >= 0) this.slots.splice(at, 1);
  }
}
