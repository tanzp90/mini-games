/**
 * MEMORY ZOO - memory, tap, shared board.
 *
 * Pairs. Matched animals fly into that player's zoo enclosure along the edge
 * of the board. Match and you go again.
 *
 * This is the one game in the collection where a five-year-old genuinely and
 * regularly beats an adult, which matters more to whether the tablet keeps
 * getting picked up than any amount of strategic depth elsewhere.
 *
 * AI ladder: the size and fidelity of its memory. Turtle really does only
 * hold the last two cards it saw - it is not an oracle rolling dice against
 * itself - so it behaves like a young player rather than a cheating one.
 */

import { MiniGame } from '../engine/game.js';
import { LeakyMemory, Thinker, byTier } from '../engine/ai.js';
import { ANIMAL_IDS, animalCard, cardBack, drawAnimal } from '../engine/animals.js';
import { PLAYER, easeInOut, fillRR, text } from '../engine/draw.js';

/** capacity = how many cards it holds; accuracy = how often it trusts one. */
const AI = [
  { capacity: 2, accuracy: 0.4 },
  { capacity: 6, accuracy: 0.8 },
  { capacity: Infinity, accuracy: 1 },
];

/** Board size grows with the tier, so Rocket is also a bigger board. */
const CARD_COUNT = [12, 16, 20];

const HIDE_DELAY = 1.15;

export default class MemoryZoo extends MiniGame {
  static meta = {
    id: 'memory-zoo',
    title: 'Memory Zoo',
    category: 'Memory',
    verb: 'tap',
    layout: 'shared',
    seconds: 100,
    tint: '#5cb85c',
    mascot: 'panda',
  };

  static icon(g, s) {
    const w = s * 0.4;
    const h = s * 0.46;
    cardBack(g, s * 0.06, s * 0.08, w, h, '#4aa3c7');
    animalCard(g, 'panda', s * 0.54, s * 0.08, w, h, { bg: '#fff' });
    animalCard(g, 'owl', s * 0.06, s * 0.48, w, h, { bg: '#fff' });
    cardBack(g, s * 0.54, s * 0.48, w, h, '#4aa3c7');
  }

  constructor(env) {
    super(env);
    this.timeLeft = -1;

    const count = env.mode === '2p' ? 16 : byTier(CARD_COUNT, env.difficulty);
    const kinds = env.rng.shuffle(ANIMAL_IDS.slice()).slice(0, count / 2);
    const deck = env.rng.shuffle([...kinds, ...kinds]);

    this.cards = deck.map((animal) => ({ animal, up: false, matched: false, t: 0 }));
    this.picked = [];
    this.hideTimer = 0;
    this.turn = 0;
    this.pairs = [[], []]; // matched animals per player, for the enclosures

    this.thinker = new Thinker(env.rng, [0.55, 1.0]);
    this.memory = env.mode === '1p'
      ? new LeakyMemory(env.rng, byTier(AI, env.difficulty))
      : null;
  }

  get isAiTurn() {
    return this.env.mode === '1p' && this.turn === 1;
  }

  /* ------------------------------- loop ------------------------------- */

  update(dt) {
    if (this.over) return;

    for (const c of this.cards) {
      const goal = c.up || c.matched ? 1 : 0;
      c.t += Math.sign(goal - c.t) * Math.min(Math.abs(goal - c.t), dt * 6);
    }

    if (this.hideTimer > 0) {
      this.hideTimer -= dt;
      if (this.hideTimer <= 0) this.resolveMiss();
      return;
    }

    if (this.isAiTurn && !this.thinker.busy && this.picked.length < 2) {
      this.thinker.schedule(() => this.aiMove());
    }
    this.thinker.update(dt);
  }

  /* ------------------------------- rules ------------------------------ */

  flip(index) {
    const card = this.cards[index];
    if (!card || card.up || card.matched || this.picked.length >= 2) return;

    card.up = true;
    this.picked.push(index);
    this.env.sfx.tap();
    if (this.memory) this.memory.see(index, card.animal);

    if (this.picked.length === 2) {
      const [a, b] = this.picked;
      if (this.cards[a].animal === this.cards[b].animal) {
        this.cards[a].matched = true;
        this.cards[b].matched = true;
        this.pairs[this.turn].push(this.cards[a].animal);
        if (this.memory) {
          this.memory.forget(a);
          this.memory.forget(b);
        }
        this.picked = [];
        this.env.sfx.good();
        if (this.cards.every((c) => c.matched)) this.finish();
        // Matching means another go - so the turn does not change here.
      } else {
        this.hideTimer = HIDE_DELAY;
      }
    }
  }

  resolveMiss() {
    // Clear the timer here rather than relying on the caller having already
    // run it down: the invariant is "no pair is pending", and it should hold
    // however this is reached.
    this.hideTimer = 0;
    for (const i of this.picked) this.cards[i].up = false;
    this.picked = [];
    this.turn = 1 - this.turn;
    this.thinker.cancel();
  }

  finish() {
    const scores = [this.pairs[0].length, this.pairs[1].length];
    this.end({
      scores,
      winner: scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1,
      stars: this.starsFor(scores[0], scores[1], 2),
    });
  }

  /* -------------------------------- AI -------------------------------- */

  aiMove() {
    if (this.over || this.hideTimer > 0) return;
    const known = this.memory.recall();
    const hidden = [];
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      if (!c.matched && !c.up) hidden.push(i);
    }
    if (!hidden.length) return;

    if (this.picked.length === 0) {
      // A remembered pair is taken immediately.
      for (const animal of Object.keys(known)) {
        const spots = known[animal].filter((i) => hidden.includes(i));
        if (spots.length >= 2) {
          this.flip(spots[0]);
          this.thinker.schedule(() => this.flip(spots[1]));
          return;
        }
      }
      this.flip(this.env.rng.pick(hidden));
      this.thinker.schedule(() => this.aiMove());
      return;
    }

    // One card is already face up: look for its partner, otherwise explore.
    const first = this.picked[0];
    const want = this.cards[first].animal;
    const partner = (known[want] || []).find((i) => i !== first && hidden.includes(i));
    this.flip(partner != null ? partner : this.env.rng.pick(hidden));
  }

  /* ------------------------------ layout ------------------------------ */

  layout() {
    const count = this.cards.length;
    const trayH = Math.min(64, this.h * 0.09);
    const availW = this.w - 24;
    const availH = this.h - trayH * 2 - 24;

    // Try every column count and keep whichever fills the space best.
    let best = { cols: 4, rows: Math.ceil(count / 4), cw: 0, ch: 0 };
    for (let cols = 2; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      if (rows * cols > count + cols - 1) continue;
      const cw = availW / cols;
      const ch = availH / rows;
      const size = Math.min(cw / 0.76, ch); // cards are taller than wide
      if (size > best.ch) best = { cols, rows, cw, ch: size };
    }

    const ch = Math.min(best.ch * 0.92, 180);
    const cw = ch * 0.76;
    const gridW = best.cols * cw + (best.cols - 1) * cw * 0.12;
    const gridH = best.rows * ch + (best.rows - 1) * ch * 0.12;
    return {
      cols: best.cols,
      rows: best.rows,
      cw,
      ch,
      gapX: cw * 0.12,
      gapY: ch * 0.12,
      x: (this.w - gridW) / 2,
      y: trayH + (this.h - trayH * 2 - gridH) / 2,
      trayH,
    };
  }

  cardRect(i, L) {
    const r = Math.floor(i / L.cols);
    const c = i % L.cols;
    return {
      x: L.x + c * (L.cw + L.gapX),
      y: L.y + r * (L.ch + L.gapY),
      w: L.cw,
      h: L.ch,
    };
  }

  /* ------------------------------ input ------------------------------- */

  pointer(p) {
    if (p.type !== 'down' || this.over || this.isAiTurn || this.hideTimer > 0) return;
    const L = this.layout();
    for (let i = 0; i < this.cards.length; i++) {
      const r = this.cardRect(i, L);
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        this.flip(i);
        return;
      }
    }
  }

  /* ------------------------------ render ------------------------------ */

  render(g) {
    g.fillStyle = '#f2f7ef';
    g.fillRect(0, 0, this.w, this.h);

    const L = this.layout();

    // A coloured glow around the whole board is the turn indicator: it works
    // from either side of the tablet and needs no reading.
    const glow = PLAYER[this.turn].hex;
    g.strokeStyle = glow;
    g.globalAlpha = 0.55 + Math.sin(Date.now() / 400) * 0.2;
    g.lineWidth = 10;
    g.strokeRect(5, 5, this.w - 10, this.h - 10);
    g.globalAlpha = 1;

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const r = this.cardRect(i, L);
      const t = easeInOut(card.t);
      // A horizontal squash through the middle reads as a flip without
      // needing any 3D.
      const scaleX = Math.abs(1 - t * 2);
      g.save();
      g.translate(r.x + r.w / 2, r.y + r.h / 2);
      if (card.matched) {
        g.globalAlpha = 0.45;
        g.scale(0.9, 0.9);
      }
      g.scale(Math.max(0.02, scaleX), 1);
      if (t < 0.5) cardBack(g, -r.w / 2, -r.h / 2, r.w, r.h, '#4aa3c7');
      else animalCard(g, card.animal, -r.w / 2, -r.h / 2, r.w, r.h, { bg: '#ffffff' });
      g.restore();
    }

    this.renderTray(g, 0, this.h - L.trayH, L.trayH);
    this.renderTray(g, 1, 0, L.trayH);
  }

  /** A player's zoo enclosure: every pair they have won, lined up. */
  renderTray(g, player, y, h) {
    const mine = this.pairs[player];
    fillRR(g, 8, y + 6, this.w - 16, h - 12, (h - 12) / 2,
      player === this.turn ? 'rgba(32,49,58,0.09)' : 'rgba(32,49,58,0.04)');

    const badge = h * 0.32;
    const cx = player === 0 ? badge + 18 : this.w - badge - 18;
    drawAnimal(g, player === 0 ? 'panda' : 'owl', cx, y + h / 2, badge,
      { blink: player !== this.turn });
    if (this.env.mode === '1p' && player === 1) {
      text(g, 'AI', cx - badge - 12, y + h / 2, 15,
        { fill: PLAYER[1].dark, align: 'right' });
    }

    const dir = player === 0 ? 1 : -1;
    const startX = player === 0 ? badge * 2 + 22 : this.w - badge * 2 - 22;
    // The far tray fills leftward and must stop short of the pause button.
    const runway = player === 0 ? this.w - startX - 20 : startX - 88;
    const step = Math.max(10, Math.min(h * 0.68, runway / Math.max(6, mine.length)));
    mine.forEach((animal, i) => {
      drawAnimal(g, animal, startX + dir * i * step, y + h / 2, step * 0.42);
    });
  }
}
