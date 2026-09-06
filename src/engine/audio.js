/**
 * Every sound in the collection is synthesised at runtime with WebAudio.
 * There are no audio files, which is what keeps the whole app small enough
 * to cache offline on first load.
 *
 * Sound carries real meaning here because the youngest player cannot read:
 * a rising interval always means "that worked", a falling one always means
 * "try again", and neither is ever harsh.
 */

import { isSoundOn } from './storage.js';

/** @type {AudioContext|null} */
let ac = null;
/** @type {GainNode|null} */
let master = null;

/** iOS and Android both require a user gesture before audio will start. */
export function unlock() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  try {
    ac = new Ctor();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
  } catch {
    ac = null;
  }
}

function ready() {
  return ac && master && isSoundOn();
}

/**
 * One synthesised note.
 * @param {number} freq
 * @param {number} dur seconds
 * @param {{type?:OscillatorType, gain?:number, delay?:number, slideTo?:number}} [opt]
 */
function note(freq, dur, opt = {}) {
  if (!ready()) return;
  const t0 = ac.currentTime + (opt.delay || 0);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = opt.type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opt.slideTo) osc.frequency.exponentialRampToValueAtTime(opt.slideTo, t0 + dur);

  const peak = opt.gain == null ? 0.25 : opt.gain;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Filtered noise burst — splashes, cracks, slides. */
function noise(dur, opt = {}) {
  if (!ready()) return;
  const t0 = ac.currentTime + (opt.delay || 0);
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / frames);

  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = opt.filter || 'bandpass';
  filter.frequency.setValueAtTime(opt.freq || 1200, t0);
  if (opt.sweepTo) filter.frequency.exponentialRampToValueAtTime(opt.sweepTo, t0 + dur);
  filter.Q.value = opt.q == null ? 1 : opt.q;

  const g = ac.createGain();
  g.gain.value = opt.gain == null ? 0.3 : opt.gain;

  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export const sfx = {
  /** Any button or tile touch. Deliberately soft — it fires constantly. */
  tap: () => note(660, 0.07, { type: 'triangle', gain: 0.16 }),
  /** Confirming a menu choice. */
  select: () => {
    note(C5, 0.09, { type: 'triangle', gain: 0.2 });
    note(G5, 0.12, { type: 'triangle', gain: 0.18, delay: 0.06 });
  },
  /** Correct match, correct sort, star collected. */
  good: () => {
    note(E5, 0.1, { type: 'sine', gain: 0.24 });
    note(G5, 0.14, { type: 'sine', gain: 0.22, delay: 0.07 });
  },
  /** Wrong move. A gentle falling third, never a buzzer. */
  bad: () => {
    note(392, 0.14, { type: 'sine', gain: 0.2 });
    note(311, 0.2, { type: 'sine', gain: 0.18, delay: 0.09 });
  },
  /** A disc, block or penguin landing. */
  thunk: () => {
    note(150, 0.12, { type: 'sine', gain: 0.3, slideTo: 70 });
    noise(0.06, { freq: 400, gain: 0.12 });
  },
  pop: () => note(880, 0.08, { type: 'sine', gain: 0.22, slideTo: 1600 }),
  whoosh: () => noise(0.22, { filter: 'lowpass', freq: 2400, sweepTo: 300, gain: 0.16 }),
  slide: () => noise(0.5, { filter: 'lowpass', freq: 900, sweepTo: 200, gain: 0.1 }),
  splash: () => noise(0.3, { filter: 'lowpass', freq: 1800, sweepTo: 250, gain: 0.22 }),
  sparkle: () => {
    [C6, 1318.5, 1568].forEach((f, i) =>
      note(f, 0.16, { type: 'triangle', gain: 0.16, delay: i * 0.05 }));
  },
  crack: () => {
    noise(0.16, { filter: 'highpass', freq: 2000, gain: 0.3 });
    note(200, 0.1, { type: 'square', gain: 0.1, slideTo: 90 });
  },
  tick: () => note(1200, 0.03, { type: 'square', gain: 0.08 }),
  /** End of round. Both are pleasant; only one is triumphant. */
  win: () => {
    [C5, E5, G5, C6].forEach((f, i) =>
      note(f, 0.32, { type: 'triangle', gain: 0.24, delay: i * 0.1 }));
  },
  lose: () => {
    [G5, E5, C5].forEach((f, i) =>
      note(f, 0.28, { type: 'sine', gain: 0.2, delay: i * 0.11 }));
  },
  draw: () => {
    note(E5, 0.3, { type: 'triangle', gain: 0.22 });
    note(E5, 0.3, { type: 'triangle', gain: 0.2, delay: 0.16 });
  },
};
