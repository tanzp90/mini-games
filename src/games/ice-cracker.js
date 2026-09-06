/**
 * ICE CRACKER - push your luck, tap, shared board.
 *
 * A raft of ice blocks holds a penguin up. Take turns tapping blocks out.
 * Most are solid; three are cracked. Take one, two or three a turn - more
 * blocks means more points and more risk - and whoever drops the penguin
 * loses the round while the penguin performs a very silly fall.
 *
 * This is the game with near-equal odds for a complete beginner and the
 * highest laughs per minute in the set. It is what you play after losing
 * three rounds of something with an actual skill ceiling.
 *
 * AI ladder: its risk model. Turtle does not track anything, Rabbit works
 * out the odds before each block, and Rocket also shifts its threshold by
 * the score gap - so it gambles when it is behind and plays safe when ahead.
 */

import { MiniGame } from '../engine/game.js';
import { Thinker } from '../engine/ai.js';
import { drawAnimal } from '../engine/animals.js';
import { PLAYER, easeOut, fillCircle, fillRR, text } from '../engine/draw.js';

const COLS = 6;
const ROWS = 5;
const TOTAL = COLS * ROWS;
const CRACKED = 3;
const MAX_PER_TURN = 3;

/** Keep taking while the chance of survival is above this. */
const THRESHOLD = [null, 0.72, 0.72]; // Turtle ignores the odds entirely

export default class IceCracker extends MiniGame {
  static meta = {
    id: 'ice-cracker',
    title: 'Ice Cracker',
    category: 'Push your luck',
    verb: 'tap',
    layout: 'shared',
    seconds: 60,
    tint: '#7fc7e8',
    mascot: 'penguin',
  };

  static icon(g, s) {
    g.fillStyle = '#e4f4fb';
    g.fillRect(0, 0, s, s);
    const cw = s / 4;
    const ch = s / 5;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        if (r === 1 && c === 2) continue;
        fillRR(g, c * cw + 3, s * 0.42 + r * ch + 3, cw - 6, ch - 6, 5, '#bfe6f5');
      }
    }
    drawAnimal(g, 'penguin', s * 0.5, s * 0.24, s * 0.17);
  }

  constructor(env) {
    super(env);
    this.timeLeft = -1;
    this.blocks = new Array(TOTAL).fill(true);
    this.cracked = new Set();
    while (this.cracked.size < CRACKED) this.cracked.add(env.rng.int(0, TOTAL - 1));

    this.scores = [0, 0];
    this.turn = 0;
    this.takenThisTurn = 0;
    this.wobble = 0;
    this.falling = null;
    this.thinker = new Thinker(env.rng, [0.6, 1.1]);
    this.aiPlan = 0;
  }

  get isAiTurn() {
    return this.env.mode === '1p' && this.turn === 1;
  }

  get remaining() {
    return this.blocks.filter(Boolean).length;
  }

  /* ------------------------------- loop ------------------------------- */

  update(dt) {
    if (this.falling) {
      this.falling.t += dt;
      if (this.falling.t > 1.4) this.finishCracked();
      return;
    }
    if (this.over) return;

    // The fewer blocks are left, the more the penguin sways - pure theatre,
    // but it is what makes the last few taps feel dangerous.
    this.wobble += dt * (1.4 + (1 - this.remaining / TOTAL) * 4);

    if (this.isAiTurn && !this.thinker.busy) {
      this.thinker.schedule(() => this.aiTurn());
    }
    this.thinker.update(dt);
  }

  /* ------------------------------- rules ------------------------------ */

  take(index) {
    if (this.over || this.falling || !this.blocks[index]) return;

    this.blocks[index] = false;
    this.takenThisTurn += 1;
    this.scores[this.turn] += 1;

    if (this.cracked.has(index)) {
      this.env.sfx.crack();
      this.falling = { t: 0, by: this.turn, index };
      return;
    }

    this.env.sfx.thunk();
    if (this.remaining === 0) return this.finishEmpty();
    if (this.takenThisTurn >= MAX_PER_TURN) this.endTurn();
  }

  endTurn() {
    this.takenThisTurn = 0;
    this.turn = 1 - this.turn;
    this.thinker.cancel();
  }

  finishCracked() {
    const loser = this.falling.by;
    this.end({
      scores: this.scores,
      winner: /** @type {0|1} */ (1 - loser),
      stars: loser === 0 ? 0 : 3,
    });
  }

  finishEmpty() {
    const [a, b] = this.scores;
    this.end({
      scores: this.scores,
      winner: a === b ? null : a > b ? 0 : 1,
      stars: this.starsFor(a, b, 4),
    });
  }

  /* -------------------------------- AI -------------------------------- */

  aiTurn() {
    if (this.over || this.falling || !this.isAiTurn) return;
    const open = [];
    for (let i = 0; i < TOTAL; i++) if (this.blocks[i]) open.push(i);
    if (!open.length) return;

    this.take(this.env.rng.pick(open));
    if (this.over || this.falling) return;

    if (this.takenThisTurn >= MAX_PER_TURN) return;
    if (this.wantsAnother()) this.thinker.schedule(() => this.aiTurn());
    else this.endTurn();
  }

  wantsAnother() {
    const tier = this.env.difficulty;
    if (tier === 0) {
      // Turtle just decides how greedy it feels; no odds involved.
      return this.env.rng.chance(0.45);
    }
    const left = this.remaining;
    if (left <= 0) return false;
    const safeChance = Math.max(0, (left - CRACKED) / left);

    let threshold = THRESHOLD[tier];
    if (tier === 2) {
      // Rocket gambles when behind and protects a lead when ahead.
      const gap = this.scores[1] - this.scores[0];
      threshold = Math.max(0.5, Math.min(0.88, 0.72 + gap * 0.045));
    }
    return safeChance > threshold;
  }

  /* ------------------------------ layout ------------------------------ */

  geom() {
    const topSpace = Math.min(this.h * 0.3, 190);
    const availW = this.w - 40;
    const availH = this.h - topSpace - 110;
    const cell = Math.floor(Math.min(availW / COLS, availH / ROWS));
    const gw = cell * COLS;
    const gh = cell * ROWS;
    return { cell, ox: (this.w - gw) / 2, oy: topSpace, gw, gh };
  }

  doneButton(G) {
    const w = Math.min(200, this.w * 0.44);
    return { x: this.w / 2 - w / 2, y: G.oy + G.gh + 18, w, h: 68 };
  }

  /* ------------------------------ input ------------------------------- */

  pointer(p) {
    if (p.type !== 'down' || this.over || this.falling || this.isAiTurn) return;
    const G = this.geom();

    if (this.takenThisTurn > 0) {
      const b = this.doneButton(G);
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        this.env.sfx.select();
        this.endTurn();
        return;
      }
    }

    const c = Math.floor((p.x - G.ox) / G.cell);
    const r = Math.floor((p.y - G.oy) / G.cell);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    this.take(r * COLS + c);
  }

  /* ------------------------------ render ------------------------------ */

  render(g) {
    g.fillStyle = '#e4f4fb';
    g.fillRect(0, 0, this.w, this.h);
    const G = this.geom();

    this.renderPenguin(g, G);

    for (let i = 0; i < TOTAL; i++) {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      const x = G.ox + c * G.cell;
      const y = G.oy + r * G.cell;
      if (!this.blocks[i]) {
        // The hole: dark water below the raft.
        fillRR(g, x + 3, y + 3, G.cell - 6, G.cell - 6, G.cell * 0.14, '#8bb6c9');
        continue;
      }
      fillRR(g, x + 3, y + 6, G.cell - 6, G.cell - 6, G.cell * 0.16, '#9ecfe4');
      fillRR(g, x + 3, y + 3, G.cell - 6, G.cell - 6, G.cell * 0.16, '#d9f0fa');
      // Frost highlights, drawn from the index so each block looks its own.
      g.globalAlpha = 0.55;
      fillRR(g, x + G.cell * 0.16, y + G.cell * 0.16, G.cell * 0.3, G.cell * 0.12,
        G.cell * 0.06, '#ffffff');
      g.globalAlpha = 1;
    }

    this.renderHud(g, G);
  }

  renderPenguin(g, G) {
    const cx = this.w / 2;
    const baseY = G.oy - Math.min(this.h * 0.1, 62);
    const r = Math.min(this.w, this.h) * 0.085;

    if (this.falling) {
      const t = Math.min(1, this.falling.t / 1.2);
      const y = baseY + easeOut(t) * (this.h - baseY + r * 2);
      g.save();
      g.translate(cx, y);
      g.rotate(t * 7);
      drawAnimal(g, 'penguin', 0, 0, r, { sad: true });
      g.restore();
      return;
    }

    const sway = Math.sin(this.wobble) * (1 - this.remaining / TOTAL) * r * 0.5;
    drawAnimal(g, 'penguin', cx + sway, baseY, r, { tilt: sway * 0.012 });
  }

  renderHud(g, G) {
    for (const p of [0, 1]) {
      // The top-left corner belongs to the pause button.
      const x = p === 0 ? 84 : this.w - 22;
      const align = p === 0 ? 'left' : 'right';
      const active = p === this.turn && !this.falling && !this.over;
      g.globalAlpha = active ? 1 : 0.45;
      drawAnimal(g, p === 0 ? 'penguin' : 'owl', p === 0 ? x + 18 : x - 18, 30, 18,
        { blink: !active });
      text(g, String(this.scores[p]), p === 0 ? x + 46 : x - 46, 30, 26,
        { fill: PLAYER[p].dark, align });
      g.globalAlpha = 1;
    }

    // How many blocks this player has taken this turn, out of three.
    const pipY = 30;
    for (let i = 0; i < MAX_PER_TURN; i++) {
      fillCircle(g, this.w / 2 - 26 + i * 26, pipY, 9,
        i < this.takenThisTurn ? PLAYER[this.turn].hex : 'rgba(32,49,58,0.14)');
    }

    if (this.takenThisTurn > 0 && !this.isAiTurn && !this.falling && !this.over) {
      const b = this.doneButton(G);
      fillRR(g, b.x, b.y + 4, b.w, b.h, 22, '#2f7a35');
      fillRR(g, b.x, b.y, b.w, b.h, 22, '#5cb85c');
      text(g, '✓  Stop', b.x + b.w / 2, b.y + b.h / 2, 26,
        { fill: '#ffffff', outlineColor: 'rgba(0,0,0,0.18)' });
    }

    if (this.isAiTurn && !this.falling) {
      text(g, 'AI is choosing...', this.w / 2, this.h - 26, 18, { fill: '#5b7480' });
    }
  }
}
