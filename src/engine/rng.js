/**
 * Seeded pseudo-random number generator.
 *
 * Every round in every game is generated from a seed, so a layout can be
 * reproduced exactly (the daily challenge) and nothing is ever memorisable
 * from one round to the next.
 */

/** @param {string} str @returns {number} */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export class Rng {
  /** @param {number|string} seed */
  constructor(seed) {
    this.seed = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
    this.state = this.seed || 1;
  }

  /** Uniform in [0, 1). */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability p. */
  chance(p) {
    return this.next() < p;
  }

  /** @template T @param {T[]} arr @returns {T} */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Fisher-Yates, in place. @template T @param {T[]} arr @returns {T[]} */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Normally distributed value, Box-Muller. Used for AI reaction times. */
  gaussian(mean = 0, sd = 1) {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

/** The seed shared by every game for today's challenge layout. */
export function dailySeed() {
  const d = new Date();
  return hashSeed(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
}
