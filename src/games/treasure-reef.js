/**
 * TREASURE REEF - strategy with hidden information, tap, shared board.
 *
 * A 6x6 reef and three treasure chests of length 2, 3 and 4. Tap a square on
 * the other reef to dig: splash, or sparkle. Sink all three chests to win.
 *
 * "Tap a square and see what happens" is as learnable as a rule gets, and
 * the splash/sparkle feedback carries the whole game without a word. The
 * hidden information means no two rounds are remotely alike.
 *
 * Placement is a shuffle-and-accept rather than a drag-and-rotate: a
 * five-year-old should not have to fight a layout editor to start playing,
 * and re-rolling until you like the look of it is genuinely the same
 * decision, made in one tap.
 *
 * Nothing is secret during play - both reefs only ever show shots that have
 * already been taken - so there is no pass-the-tablet screen except the one
 * between the two players setting up.
 *
 * AI ladder: search strategy. Random digging, then parity hunt-and-target,
 * then a probability-density heatmap over every placement still consistent
 * with what it has seen.
 */

import { MiniGame } from '../engine/game.js';
import { Thinker } from '../engine/ai.js';
import { drawAnimal } from '../engine/animals.js';
import { PLAYER, fillCircle, fillRR, rr, star as starPath, text } from '../engine/draw.js';

const SIZE = 6;
const CHESTS = [4, 3, 2];

const NONE = 0;
const MISS = 1;
const HIT = 2;

export default class TreasureReef extends MiniGame {
  static meta = {
    id: 'treasure-reef',
    title: 'Treasure Reef',
    category: 'Hidden treasure',
    verb: 'tap',
    layout: 'shared',
    seconds: 120,
    tint: '#2b7fd4',
    mascot: 'penguin',
  };

  static icon(g, s) {
    g.fillStyle = '#dceff8';
    g.fillRect(0, 0, s, s);
    const cell = s / 4;
    g.strokeStyle = 'rgba(43,127,212,0.35)';
    g.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo(i * cell, 0);
      g.lineTo(i * cell, s);
      g.moveTo(0, i * cell);
      g.lineTo(s, i * cell);
      g.stroke();
    }
    fillRR(g, cell * 0.2, cell * 1.2, cell * 2.6, cell * 0.6, cell * 0.18, '#a9743f');
    fillRR(g, cell * 0.2, cell * 1.2, cell * 2.6, cell * 0.24, cell * 0.1, '#f2c14e');
    starPath(g, cell * 3.3, cell * 0.8, cell * 0.3);
    g.fillStyle = '#f2c14e';
    g.fill();
    fillCircle(g, cell * 1.2, cell * 3, cell * 0.16, '#2b7fd4');
  }

  constructor(env) {
    super(env);
    this.timeLeft = -1;
    /** reefs[p] is the reef belonging to player p, dug at by the other. */
    this.reefs = [makeReef(env.rng), makeReef(env.rng)];
    this.shots = [newShots(), newShots()];
    this.turn = 0;
    this.phase = 'place';
    this.placer = 0;
    this.splash = null;
    this.thinker = new Thinker(env.rng, [0.7, 1.3]);
    this.aiTier = env.difficulty;
    this.aiHunt = []; // cells queued after a hit (Turtle and Rabbit)

    if (env.mode === '1p') {
      // Only the human places; the opponent's reef is rolled and hidden.
      this.reefs[1] = makeReef(env.rng);
    }
  }

  get isAiTurn() {
    return this.env.mode === '1p' && this.turn === 1 && this.phase === 'play';
  }

  /* ------------------------------- loop ------------------------------- */

  update(dt) {
    if (this.over) return;
    if (this.splash) {
      this.splash.t += dt * 2.2;
      if (this.splash.t >= 1) this.splash = null;
    }
    if (this.isAiTurn && !this.thinker.busy && !this.splash) {
      this.thinker.schedule(() => this.dig(this.aiPick()));
    }
    this.thinker.update(dt);
  }

  /* ------------------------------ placing ----------------------------- */

  shuffle() {
    this.reefs[this.placer] = makeReef(this.env.rng);
    this.env.sfx.tap();
  }

  confirmPlacement() {
    this.env.sfx.select();
    if (this.env.mode === '2p' && this.placer === 0) {
      this.placer = 1;
      this.phase = 'handover';
    } else {
      this.phase = 'play';
    }
  }

  /* ------------------------------- digging ---------------------------- */

  dig(cell) {
    if (this.over || cell < 0 || this.phase !== 'play') return;
    const target = 1 - this.turn;
    const shots = this.shots[target];
    if (shots[cell] !== NONE) return;

    const isHit = this.reefs[target].occupied[cell] >= 0;
    shots[cell] = isHit ? HIT : MISS;
    this.splash = { cell, hit: isHit, t: 0, target };
    this.env.sfx[isHit ? 'sparkle' : 'splash']();

    if (isHit) {
      if (this.turn === 1 && this.env.mode === '1p') this.queueHunt(cell, shots);
      const chestIndex = this.reefs[target].occupied[cell];
      if (isSunk(this.reefs[target], shots, chestIndex)) {
        this.env.sfx.win();
        if (this.aiHunt.length) this.aiHunt = [];
      }
      if (allSunk(this.reefs[target], shots)) return this.finish();
      return; // a hit earns another dig, which is what keeps a round moving
    }

    this.turn = 1 - this.turn;
  }

  finish() {
    const remaining = [0, 1].map((p) =>
      CHESTS.length - countSunk(this.reefs[p], this.shots[p]));
    // Score is chests still afloat: the winner has some, the loser has none.
    this.end({
      scores: [remaining[0], remaining[1]],
      winner: this.turn,
      stars: this.turn === 0 ? (remaining[0] === 3 ? 3 : remaining[0] === 2 ? 2 : 1) : 0,
    });
  }

  /* -------------------------------- AI -------------------------------- */

  queueHunt(cell, shots) {
    for (const nb of neighbours(cell)) {
      if (shots[nb] === NONE && !this.aiHunt.includes(nb)) this.aiHunt.push(nb);
    }
  }

  aiPick() {
    const shots = this.shots[0];
    const open = [];
    for (let i = 0; i < SIZE * SIZE; i++) if (shots[i] === NONE) open.push(i);
    if (!open.length) return -1;

    if (this.aiTier === 0) {
      // Turtle digs at random, and only sometimes thinks to try next door.
      this.aiHunt = this.aiHunt.filter((c) => shots[c] === NONE);
      if (this.aiHunt.length && this.env.rng.chance(0.5)) {
        return this.aiHunt.shift();
      }
      return this.env.rng.pick(open);
    }

    if (this.aiTier === 1) {
      // Rabbit: work an open hit properly, otherwise sweep on a parity that
      // cannot miss the smallest chest.
      const axis = this.axisCandidates(shots);
      if (axis.length) return this.env.rng.pick(axis);
      this.aiHunt = this.aiHunt.filter((c) => shots[c] === NONE);
      if (this.aiHunt.length) return this.aiHunt.shift();
      const parity = open.filter((c) => ((c % SIZE) + Math.floor(c / SIZE)) % 2 === 0);
      return this.env.rng.pick(parity.length ? parity : open);
    }

    // Rocket: count every placement of every unsunk chest that is still
    // consistent with the shots so far, and dig wherever they pile up.
    const heat = heatmap(shots, this.reefs[0]);
    let best = open[0];
    let bestScore = -1;
    for (const c of open) {
      if (heat[c] > bestScore) {
        bestScore = heat[c];
        best = c;
      }
    }
    return bestScore > 0 ? best : this.env.rng.pick(open);
  }

  /** Hits in a line point at the rest of the chest. */
  axisCandidates(shots) {
    const out = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (shots[i] !== HIT) continue;
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      if (c + 1 < SIZE && shots[i + 1] === HIT) {
        if (c - 1 >= 0 && shots[i - 1] === NONE) out.push(i - 1);
        let end = c + 1;
        while (end + 1 < SIZE && shots[r * SIZE + end + 1] === HIT) end++;
        if (end + 1 < SIZE && shots[r * SIZE + end + 1] === NONE) out.push(r * SIZE + end + 1);
      }
      if (r + 1 < SIZE && shots[i + SIZE] === HIT) {
        if (r - 1 >= 0 && shots[i - SIZE] === NONE) out.push(i - SIZE);
        let end = r + 1;
        while (end + 1 < SIZE && shots[(end + 1) * SIZE + c] === HIT) end++;
        if (end + 1 < SIZE && shots[(end + 1) * SIZE + c] === NONE) out.push((end + 1) * SIZE + c);
      }
    }
    return out;
  }

  /* ------------------------------ layout ------------------------------ */

  geom() {
    const stripH = Math.min(84, this.h * 0.13);
    const avail = Math.min(this.w - 32, this.h - stripH - 90);
    const cell = Math.floor(avail / SIZE);
    const size = cell * SIZE;
    return { cell, size, ox: (this.w - size) / 2, oy: 62, stripH };
  }

  cellAt(px, py, G) {
    const c = Math.floor((px - G.ox) / G.cell);
    const r = Math.floor((py - G.oy) / G.cell);
    if (c < 0 || r < 0 || c >= SIZE || r >= SIZE) return -1;
    return r * SIZE + c;
  }

  buttons(G) {
    const y = G.oy + G.size + 18;
    const w = Math.min(160, this.w * 0.34);
    return {
      shuffle: { x: this.w / 2 - w - 10, y, w, h: 68 },
      accept: { x: this.w / 2 + 10, y, w, h: 68 },
    };
  }

  /* ------------------------------ input ------------------------------- */

  pointer(p) {
    if (p.type !== 'down' || this.over) return;
    const G = this.geom();

    if (this.phase === 'handover') {
      this.phase = 'place';
      this.env.sfx.tap();
      return;
    }

    if (this.phase === 'place') {
      const b = this.buttons(G);
      if (inRect(p, b.shuffle)) return this.shuffle();
      if (inRect(p, b.accept)) return this.confirmPlacement();
      return;
    }

    if (this.isAiTurn || this.splash) return;
    this.dig(this.cellAt(p.x, p.y, G));
  }

  /* ------------------------------ render ------------------------------ */

  render(g) {
    g.fillStyle = '#e5f2f8';
    g.fillRect(0, 0, this.w, this.h);
    const G = this.geom();

    if (this.phase === 'handover') return this.renderHandover(g);
    if (this.phase === 'place') return this.renderPlacing(g, G);
    this.renderPlaying(g, G);
  }

  renderWater(g, G) {
    fillRR(g, G.ox - 8, G.oy - 8, G.size + 16, G.size + 16, 18, '#bfe1f0');
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const x = G.ox + c * G.cell;
        const y = G.oy + r * G.cell;
        fillRR(g, x + 2, y + 2, G.cell - 4, G.cell - 4, G.cell * 0.16,
          (r + c) % 2 ? '#d5ecf6' : '#e6f5fb');
      }
    }
  }

  renderPlacing(g, G) {
    this.renderWater(g, G);
    const reef = this.reefs[this.placer];
    reef.chests.forEach((chest) => {
      const first = chest[0];
      const last = chest[chest.length - 1];
      const x = G.ox + (first % SIZE) * G.cell + 5;
      const y = G.oy + Math.floor(first / SIZE) * G.cell + 5;
      const w = ((last % SIZE) - (first % SIZE) + 1) * G.cell - 10;
      const h = (Math.floor(last / SIZE) - Math.floor(first / SIZE) + 1) * G.cell - 10;
      fillRR(g, x, y, w, h, G.cell * 0.2, '#a9743f');
      fillRR(g, x, y, w, Math.min(h, G.cell * 0.34), G.cell * 0.14, '#f2c14e');
      fillCircle(g, x + w / 2, y + h / 2, G.cell * 0.13, '#f2c14e');
    });

    const who = this.env.mode === '2p' ? `Player ${this.placer + 1}` : 'Your reef';
    text(g, who, this.w / 2, 32, 24, { fill: PLAYER[this.placer].dark });

    const b = this.buttons(G);
    fillRR(g, b.shuffle.x, b.shuffle.y, b.shuffle.w, b.shuffle.h, 20, '#ffffff');
    rr(g, b.shuffle.x, b.shuffle.y, b.shuffle.w, b.shuffle.h, 20);
    g.strokeStyle = '#20313a';
    g.lineWidth = 3;
    g.stroke();
    text(g, '↻', b.shuffle.x + b.shuffle.w / 2, b.shuffle.y + b.shuffle.h / 2, 32,
      { fill: '#20313a' });

    fillRR(g, b.accept.x, b.accept.y, b.accept.w, b.accept.h, 20, '#5cb85c');
    text(g, '✓', b.accept.x + b.accept.w / 2, b.accept.y + b.accept.h / 2, 34,
      { fill: '#ffffff', outlineColor: 'rgba(0,0,0,0.15)' });
  }

  renderHandover(g) {
    g.fillStyle = '#20313a';
    g.fillRect(0, 0, this.w, this.h);
    drawAnimal(g, 'penguin', this.w / 2, this.h * 0.4, Math.min(this.w, this.h) * 0.14);
    text(g, 'Pass the tablet to Player 2', this.w / 2, this.h * 0.62, 24,
      { fill: '#ffffff', outline: false });
    text(g, 'then tap anywhere', this.w / 2, this.h * 0.62 + 34, 17,
      { fill: '#9fb0bd', outline: false });
  }

  renderPlaying(g, G) {
    const target = 1 - this.turn;
    const shots = this.shots[target];
    this.renderWater(g, G);

    for (let i = 0; i < SIZE * SIZE; i++) {
      const x = G.ox + (i % SIZE) * G.cell + G.cell / 2;
      const y = G.oy + Math.floor(i / SIZE) * G.cell + G.cell / 2;
      if (shots[i] === MISS) {
        fillCircle(g, x, y, G.cell * 0.16, '#8fb4c4');
      } else if (shots[i] === HIT) {
        const sunkChest = this.reefs[target].occupied[i];
        const sunk = isSunk(this.reefs[target], shots, sunkChest);
        starPath(g, x, y, G.cell * 0.3);
        g.fillStyle = sunk ? '#f2802e' : '#f2c14e';
        g.fill();
        g.strokeStyle = '#b8760f';
        g.lineWidth = 2;
        g.stroke();
      }
    }

    if (this.splash && this.splash.target === target) {
      const i = this.splash.cell;
      const x = G.ox + (i % SIZE) * G.cell + G.cell / 2;
      const y = G.oy + Math.floor(i / SIZE) * G.cell + G.cell / 2;
      g.globalAlpha = 1 - this.splash.t;
      g.beginPath();
      g.arc(x, y, G.cell * (0.2 + this.splash.t * 0.7), 0, Math.PI * 2);
      g.strokeStyle = this.splash.hit ? '#f2c14e' : '#4aa3c7';
      g.lineWidth = 6;
      g.stroke();
      g.globalAlpha = 1;
    }

    const label = this.isAiTurn ? 'Digging...' : `Player ${this.turn + 1}, dig here`;
    drawAnimal(g, this.turn === 0 ? 'penguin' : 'owl', 96, 32, 20);
    text(g, label, 124, 32, 20, { fill: PLAYER[this.turn].dark, align: 'left' });

    this.renderChestStrip(g, G);
  }

  /** Three chest icons per player: how many are still afloat. */
  renderChestStrip(g, G) {
    const y = this.h - G.stripH;
    for (const p of [0, 1]) {
      const sunk = countSunk(this.reefs[p], this.shots[p]);
      const cx = p === 0 ? 20 : this.w / 2 + 20;
      drawAnimal(g, p === 0 ? 'penguin' : 'owl', cx + 18, y + G.stripH / 2, 18);
      for (let i = 0; i < CHESTS.length; i++) {
        const x = cx + 46 + i * 40;
        const alive = i >= sunk;
        fillRR(g, x, y + G.stripH / 2 - 13, 32, 26, 8, alive ? '#a9743f' : 'rgba(32,49,58,0.13)');
        if (alive) fillRR(g, x, y + G.stripH / 2 - 13, 32, 9, 5, '#f2c14e');
      }
    }
  }
}

/* -------------------------------------------------------------------- *
 * Reef model
 * -------------------------------------------------------------------- */

function newShots() {
  return new Uint8Array(SIZE * SIZE);
}

/** @param {import('../engine/rng.js').Rng} rng */
function makeReef(rng) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const occupied = new Int8Array(SIZE * SIZE).fill(-1);
    const chests = [];
    let ok = true;
    for (let ci = 0; ci < CHESTS.length; ci++) {
      const placed = tryPlace(rng, occupied, CHESTS[ci], ci);
      if (!placed) {
        ok = false;
        break;
      }
      chests.push(placed);
    }
    if (ok) return { occupied, chests };
  }
  // Deterministic fallback: three rows, guaranteed legal.
  const occupied = new Int8Array(SIZE * SIZE).fill(-1);
  const chests = CHESTS.map((len, ci) => {
    const cells = [];
    for (let i = 0; i < len; i++) {
      const idx = ci * 2 * SIZE + i;
      cells.push(idx);
      occupied[idx] = ci;
    }
    return cells;
  });
  return { occupied, chests };
}

function tryPlace(rng, occupied, len, index) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const horizontal = rng.chance(0.5);
    const r = rng.int(0, horizontal ? SIZE - 1 : SIZE - len);
    const c = rng.int(0, horizontal ? SIZE - len : SIZE - 1);
    const cells = [];
    for (let i = 0; i < len; i++) {
      cells.push(horizontal ? r * SIZE + c + i : (r + i) * SIZE + c);
    }
    if (cells.some((i) => occupied[i] >= 0)) continue;
    for (const i of cells) occupied[i] = index;
    return cells;
  }
  return null;
}

function isSunk(reef, shots, chestIndex) {
  if (chestIndex < 0) return false;
  return reef.chests[chestIndex].every((i) => shots[i] === HIT);
}

function countSunk(reef, shots) {
  return reef.chests.filter((_, i) => isSunk(reef, shots, i)).length;
}

function allSunk(reef, shots) {
  return countSunk(reef, shots) === reef.chests.length;
}

function neighbours(cell) {
  const r = Math.floor(cell / SIZE);
  const c = cell % SIZE;
  const out = [];
  if (r > 0) out.push(cell - SIZE);
  if (r < SIZE - 1) out.push(cell + SIZE);
  if (c > 0) out.push(cell - 1);
  if (c < SIZE - 1) out.push(cell + 1);
  return out;
}

function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/**
 * Rocket's heatmap: every legal placement of every chest that is still
 * afloat and still consistent with the shots taken. Cells covered by the
 * most surviving placements are the best places to dig. When there is an
 * unresolved hit on the board, only placements that explain it are counted,
 * which is what turns the heatmap into a finisher rather than a sweeper.
 */
function heatmap(shots, reef) {
  const heat = new Float64Array(SIZE * SIZE);
  const liveHits = [];
  for (let i = 0; i < shots.length; i++) {
    if (shots[i] === HIT && !isSunk(reef, shots, reef.occupied[i])) liveHits.push(i);
  }

  const remaining = CHESTS.filter((_, ci) => !isSunk(reef, shots, ci));

  for (const len of remaining) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        for (const horizontal of [true, false]) {
          if (horizontal && c + len > SIZE) continue;
          if (!horizontal && r + len > SIZE) continue;
          const cells = [];
          for (let i = 0; i < len; i++) {
            cells.push(horizontal ? r * SIZE + c + i : (r + i) * SIZE + c);
          }
          if (cells.some((i) => shots[i] === MISS)) continue;
          // A placement covering a hit that belongs to an already-sunk chest
          // is impossible.
          if (cells.some((i) => shots[i] === HIT && !liveHits.includes(i))) continue;
          const covers = liveHits.length === 0 || cells.some((i) => liveHits.includes(i));
          if (!covers) continue;
          const weight = liveHits.length ? 4 : 1;
          for (const i of cells) if (shots[i] === NONE) heat[i] += weight;
        }
      }
    }
  }
  return heat;
}
