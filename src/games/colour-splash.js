/**
 * COLOUR SPLASH - strategy, tap, shared board.
 *
 * You own the bottom-left corner, your opponent the top-right. Tap one of
 * six colours and your whole territory flips to it, swallowing every
 * touching tile that was already that colour. You may not take the colour
 * your opponent is currently wearing. First past half the board wins.
 *
 * This replaced a connect-four clone because the decision here is "which of
 * these six", presented as six large buttons - a child who simply picks the
 * colour that grabs the most tiles plays a respectable game, while the real
 * strategy (denying the opponent a colour, shaping a frontier rather than
 * chasing area) is there for anyone who wants it.
 *
 * AI ladder: search depth. Turtle plays any colour that gains something,
 * Rabbit is greedy, Rocket runs a 3-ply negamax that will take a smaller
 * gain to deny you a bigger one.
 */

import { MiniGame } from '../engine/game.js';
import { Thinker, byTier } from '../engine/ai.js';
import { PALETTE, PLAYER, fillRR, paletteTile, rr, shapeGlyph, text } from '../engine/draw.js';
import { drawAnimal } from '../engine/animals.js';

const N = 11;
const COLOURS = 6;

/** Search depth per tier. Depth 1 is "gain the most right now". */
const DEPTH = [1, 1, 3];

export default class ColourSplash extends MiniGame {
  static meta = {
    id: 'colour-splash',
    title: 'Colour Splash',
    category: 'Strategy',
    verb: 'tap',
    layout: 'shared',
    seconds: 90,
    tint: '#8a6db1',
    mascot: 'frog',
  };

  static icon(g, s) {
    const cell = s / 5;
    const map = [
      [0, 0, 3, 3, 1],
      [0, 3, 3, 1, 1],
      [3, 3, 4, 1, 2],
      [3, 4, 4, 2, 2],
      [4, 4, 2, 2, 5],
    ];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        paletteTile(g, map[r][c], c * cell + 2, r * cell + 2, cell - 4, cell - 4,
          { radius: cell * 0.2, glyphAlpha: 0.3 });
      }
    }
  }

  constructor(env) {
    super(env);
    this.timeLeft = -1; // turn-based: a clock would only rush a five-year-old
    this.state = newBoard(env.rng);
    this.turn = 0;
    this.anim = 0;
    /** @type {Set<number>} cells that just changed hands, for the flood animation */
    this.splash = new Set();
    this.thinker = new Thinker(env.rng, [0.6, 1.2]);
    this.aiDepth = byTier(DEPTH, env.difficulty);
    this.aiTier = env.difficulty;
  }

  get isAiTurn() {
    return this.env.mode === '1p' && this.turn === 1;
  }

  /* ------------------------------- loop ------------------------------- */

  update(dt) {
    if (this.over) return;
    if (this.anim > 0) this.anim = Math.max(0, this.anim - dt * 2.6);

    if (this.isAiTurn && !this.thinker.busy && this.anim === 0) {
      this.thinker.schedule(() => {
        const c = chooseColour(this.state, 1, this.aiTier, this.aiDepth, this.env.rng);
        if (c >= 0) this.play(c);
      });
    }
    this.thinker.update(dt);
  }

  play(colour) {
    if (this.over || this.anim > 0) return;
    if (!legalColours(this.state, this.turn).includes(colour)) return;

    const before = new Set(ownedCells(this.state, this.turn));
    applyMove(this.state, this.turn, colour);
    this.splash = new Set(ownedCells(this.state, this.turn).filter((i) => !before.has(i)));
    this.anim = 1;
    this.env.sfx[this.splash.size > 0 ? 'pop' : 'tap']();

    const counts = tileCounts(this.state);
    const half = (N * N) / 2;
    if (counts[0] > half || counts[1] > half || counts[0] + counts[1] === N * N) {
      return this.finish(counts);
    }
    this.turn = 1 - this.turn;
  }

  finish(counts) {
    this.end({
      scores: counts,
      winner: counts[0] === counts[1] ? null : counts[0] > counts[1] ? 0 : 1,
      stars: this.starsFor(counts[0], counts[1], 18),
    });
  }

  /* ------------------------------ input ------------------------------- */

  pointer(p) {
    if (p.type !== 'down' || this.over || this.isAiTurn || this.anim > 0) return;
    const L = this.layout();

    for (const bar of L.bars) {
      if (bar.player !== this.turn) continue;
      // The far player's bar is drawn rotated, so mirror the touch through
      // the bar's centre before testing it against the button rectangles.
      const px = bar.flip ? this.w - p.x : p.x;
      const py = bar.flip ? 2 * (bar.y + bar.h / 2) - p.y : p.y;
      for (let c = 0; c < COLOURS; c++) {
        const b = bar.buttons[c];
        if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
          if (legalColours(this.state, this.turn).includes(c)) this.play(c);
          else this.env.sfx.bad();
          return;
        }
      }
    }
  }

  /* ------------------------------ layout ------------------------------ */

  layout() {
    const twoBars = this.env.mode === '2p';
    const barH = Math.min(96, this.h * 0.13);
    const topPad = twoBars ? barH : Math.min(56, this.h * 0.08);
    const boardMax = Math.min(this.w - 24, this.h - topPad - barH - 24);
    const cell = Math.floor(boardMax / N);
    const size = cell * N;
    const bx = (this.w - size) / 2;
    const by = topPad + (this.h - topPad - barH - size) / 2;

    const bars = [makeBar(this.w, this.h - barH, barH, 0, false)];
    if (twoBars) bars.push(makeBar(this.w, 0, barH, 1, true));

    return { cell, size, bx, by, barH, bars };
  }

  /* ------------------------------ render ------------------------------ */

  render(g) {
    g.fillStyle = '#f7f3ea';
    g.fillRect(0, 0, this.w, this.h);
    const L = this.layout();
    const { cell, bx, by } = L;
    const eased = 1 - this.anim;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const i = r * N + c;
        const x = bx + c * cell;
        const y = by + r * cell;
        const growing = this.splash.has(i);
        const s = growing ? 0.55 + 0.45 * eased : 1;
        const pad = (cell * (1 - s)) / 2 + 1;
        paletteTile(g, this.state.col[i], x + pad, y + pad, cell - pad * 2, cell - pad * 2, {
          radius: cell * 0.18,
          glyphAlpha: this.state.own[i] < 0 ? 0.34 : 0.5,
        });
        if (this.state.own[i] >= 0) {
          rr(g, x + 1.5, y + 1.5, cell - 3, cell - 3, cell * 0.18);
          g.strokeStyle = PLAYER[this.state.own[i]].dark;
          g.globalAlpha = 0.85;
          g.lineWidth = 2.5;
          g.stroke();
          g.globalAlpha = 1;
        }
      }
    }

    // Home corners, so each player can always see which side is theirs.
    for (const player of [0, 1]) {
      const idx = cornerOf(player);
      const cx = bx + (idx % N) * cell + cell / 2;
      const cy = by + Math.floor(idx / N) * cell + cell / 2;
      drawAnimal(g, player === 0 ? 'frog' : 'owl', cx, cy, cell * 0.36);
    }

    const counts = tileCounts(this.state);
    this.renderProgress(g, L, counts);
    for (const bar of L.bars) this.renderBar(g, bar, counts);
  }

  /** A single bar showing who owns how much of the board. */
  renderProgress(g, L, counts) {
    const total = N * N;
    const w = L.size;
    const x = L.bx;
    const y = L.by - 16;
    const h = 10;
    fillRR(g, x, y, w, h, h / 2, 'rgba(32,49,58,0.1)');
    const f0 = (counts[0] / total) * w;
    const f1 = (counts[1] / total) * w;
    fillRR(g, x, y, f0, h, h / 2, PLAYER[0].hex);
    fillRR(g, x + w - f1, y, f1, h, h / 2, PLAYER[1].hex);
    g.beginPath();
    g.moveTo(x + w / 2, y - 4);
    g.lineTo(x + w / 2, y + h + 4);
    g.strokeStyle = 'rgba(32,49,58,0.4)';
    g.lineWidth = 2;
    g.stroke();
  }

  renderBar(g, bar, counts) {
    g.save();
    if (bar.flip) {
      // Rotate the bar 180 degrees about its own centre so it reads the
      // right way up from the far side of the tablet.
      const cx = this.w / 2;
      const cy = bar.y + bar.h / 2;
      g.translate(cx, cy);
      g.rotate(Math.PI);
      g.translate(-cx, -cy);
    }
    const active = bar.player === this.turn && !this.over;
    const legal = legalColours(this.state, bar.player);

    if (active) {
      fillRR(g, 8, bar.y + 4, this.w - 16, bar.h - 8, 20,
        bar.player === 0 ? 'rgba(242,106,75,0.14)' : 'rgba(74,163,199,0.14)');
    }

    for (let c = 0; c < COLOURS; c++) {
      const b = bar.buttons[c];
      const ok = legal.includes(c);
      g.globalAlpha = ok ? 1 : 0.26;
      const lift = active && ok ? 3 : 0;
      fillRR(g, b.x, b.y - lift + 4, b.w, b.h, b.w * 0.28, PALETTE[c].dark);
      fillRR(g, b.x, b.y - lift, b.w, b.h, b.w * 0.28, PALETTE[c].hex);
      shapeGlyph(g, PALETTE[c].shape, b.x + b.w / 2, b.y + b.h / 2 - lift, b.w * 0.26, '#ffffff');
      g.globalAlpha = 1;
    }

    // Whose turn, said with an animal rather than a word.
    const badge = bar.h * 0.34;
    drawAnimal(g, bar.player === 0 ? 'frog' : 'owl', badge + 8, bar.y + bar.h / 2, badge,
      { blink: !active });
    text(g, String(counts[bar.player]), badge * 2.4 + 8, bar.y + bar.h / 2, bar.h * 0.34,
      { fill: PLAYER[bar.player].dark, align: 'left' });

    if (active) {
      g.beginPath();
      const ax = this.w - 30;
      const ay = bar.y + bar.h / 2;
      const t = Math.sin(Date.now() / 220) * 4;
      g.moveTo(ax - 14, ay - 12 + t);
      g.lineTo(ax + 4, ay + t);
      g.lineTo(ax - 14, ay + 12 + t);
      g.closePath();
      g.fillStyle = PLAYER[bar.player].hex;
      g.fill();
    }
    g.restore();
  }
}

/* -------------------------------------------------------------------- *
 * Board model - kept as plain typed arrays so the AI can copy a position
 * cheaply and search it without allocating objects per node.
 * -------------------------------------------------------------------- */

/** @typedef {{col: Uint8Array, own: Int8Array}} State */

function cornerOf(player) {
  return player === 0 ? (N - 1) * N : N - 1; // p1 bottom-left, p2 top-right
}

/** @param {import('../engine/rng.js').Rng} rng @returns {State} */
function newBoard(rng) {
  const col = new Uint8Array(N * N);
  for (let i = 0; i < col.length; i++) col[i] = rng.int(0, COLOURS - 1);
  const own = new Int8Array(N * N).fill(-1);

  // The two home corners must start on different colours, or the first
  // player's opening move is decided for them.
  const c0 = cornerOf(0);
  const c1 = cornerOf(1);
  while (col[c0] === col[c1]) col[c1] = rng.int(0, COLOURS - 1);
  own[c0] = 0;
  own[c1] = 1;
  return { col, own };
}

/** @param {State} s */
function clone(s) {
  return { col: s.col.slice(), own: s.own.slice() };
}

function ownedCells(s, player) {
  const out = [];
  for (let i = 0; i < s.own.length; i++) if (s.own[i] === player) out.push(i);
  return out;
}

function tileCounts(s) {
  let a = 0;
  let b = 0;
  for (let i = 0; i < s.own.length; i++) {
    if (s.own[i] === 0) a++;
    else if (s.own[i] === 1) b++;
  }
  return [a, b];
}

function currentColour(s, player) {
  return s.col[cornerOf(player)];
}

function legalColours(s, player) {
  const mine = currentColour(s, player);
  const theirs = currentColour(s, 1 - player);
  const out = [];
  for (let c = 0; c < COLOURS; c++) if (c !== mine && c !== theirs) out.push(c);
  return out;
}

/** Repaint the player's territory and absorb everything touching it. */
function applyMove(s, player, colour) {
  const stack = [];
  for (let i = 0; i < s.own.length; i++) {
    if (s.own[i] === player) {
      s.col[i] = colour;
      stack.push(i);
    }
  }
  while (stack.length) {
    const i = stack.pop();
    const r = Math.floor(i / N);
    const c = i % N;
    if (c > 0) grab(s, i - 1, player, colour, stack);
    if (c < N - 1) grab(s, i + 1, player, colour, stack);
    if (r > 0) grab(s, i - N, player, colour, stack);
    if (r < N - 1) grab(s, i + N, player, colour, stack);
  }
}

function grab(s, j, player, colour, stack) {
  if (s.own[j] === -1 && s.col[j] === colour) {
    s.own[j] = player;
    stack.push(j);
  }
}

/* ------------------------------- the AI ------------------------------- */

/**
 * @param {State} s
 * @param {number} player
 * @param {number} tier 0 turtle, 1 rabbit, 2 rocket
 * @param {number} depth
 * @param {import('../engine/rng.js').Rng} rng
 */
function chooseColour(s, player, tier, depth, rng) {
  const legal = legalColours(s, player);
  if (!legal.length) return -1;

  if (tier === 0) {
    // Turtle plays a colour that gains something, but does not care which -
    // short-sighted rather than nonsensical.
    const gaining = legal.filter((c) => gainOf(s, player, c) > 0);
    return rng.pick(gaining.length ? gaining : legal);
  }

  if (tier === 1) {
    let best = legal[0];
    let bestGain = -1;
    for (const c of legal) {
      const gain = gainOf(s, player, c);
      if (gain > bestGain) {
        bestGain = gain;
        best = c;
      }
    }
    return best;
  }

  // Rocket: negamax on (my tiles - their tiles). It will accept a smaller
  // immediate gain when that denies the opponent a bigger one.
  let best = legal[0];
  let bestScore = -Infinity;
  for (const c of legal) {
    const next = clone(s);
    applyMove(next, player, c);
    const score = -negamax(next, 1 - player, depth - 1);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function gainOf(s, player, colour) {
  const before = tileCounts(s)[player];
  const next = clone(s);
  applyMove(next, player, colour);
  return tileCounts(next)[player] - before;
}

function negamax(s, player, depth) {
  const counts = tileCounts(s);
  if (depth <= 0 || counts[0] + counts[1] === N * N) {
    return counts[player] - counts[1 - player];
  }
  let best = -Infinity;
  for (const c of legalColours(s, player)) {
    const next = clone(s);
    applyMove(next, player, c);
    best = Math.max(best, -negamax(next, 1 - player, depth - 1));
  }
  return best === -Infinity ? counts[player] - counts[1 - player] : best;
}

/* ------------------------------- helpers ------------------------------ */

/**
 * Exposed for the strength tests, which play the three tiers against each
 * other to confirm the ladder is real rather than cosmetic.
 */
export const __internals = { newBoard, clone, applyMove, tileCounts, legalColours, chooseColour };

function makeBar(w, y, h, player, flip) {
  const pad = 10;
  // Reserved on the local right for the whose-turn arrow. The far player's
  // bar is drawn mirrored, so its local right is the screen's top-left
  // corner - where the pause button lives - and it needs more room.
  const arrowLane = flip ? 86 : 42;
  const usable = w - pad * 2 - arrowLane - h * 1.6; // badge and score on the left
  const bw = Math.min(76, (usable - 5 * pad) / COLOURS);
  const bh = Math.min(bw, h - 16);
  const startX = w - pad - arrowLane - COLOURS * bw - (COLOURS - 1) * pad * 0.6;
  const buttons = [];
  for (let c = 0; c < COLOURS; c++) {
    buttons.push({
      x: startX + c * (bw + pad * 0.6),
      y: y + (h - bh) / 2,
      w: bw,
      h: bh,
    });
  }
  return { y, h, player, flip, buttons };
}
