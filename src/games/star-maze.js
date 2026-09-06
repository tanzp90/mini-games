/**
 * STAR MAZE DASH - real-time dexterity, drag, shared board.
 *
 * A freshly generated maze, stars scattered through it, and both players
 * moving at the same time on the same maze. Drag your animal with a finger.
 * Most stars when the clock runs out wins.
 *
 * Dragging is the most forgiving gesture a small hand can make: walls stop
 * you gently, nothing kills you, and there is no restart to sit through.
 *
 * AI ladder: how far ahead it can see, and how fast it moves. Rocket runs a
 * breadth-first search from both players and only chases stars it can reach
 * first - it will genuinely cut you off.
 */

import { MiniGame } from '../engine/game.js';
import { byTier } from '../engine/ai.js';
import { drawAnimal } from '../engine/animals.js';
import { PLAYER, fillCircle, star as starPath, text } from '../engine/draw.js';

const N = 1;
const E = 2;
const S = 4;
const W = 8;
const DIRS = [
  { bit: N, dr: -1, dc: 0, opp: S },
  { bit: E, dr: 0, dc: 1, opp: W },
  { bit: S, dr: 1, dc: 0, opp: N },
  { bit: W, dr: 0, dc: -1, opp: E },
];

const AI = [
  { speed: 0.75, mode: 'greedy', wrongTurn: 0.1 },
  { speed: 1.0, mode: 'path', wrongTurn: 0 },
  { speed: 1.15, mode: 'contest', wrongTurn: 0 },
];

const STAR_COUNT = 8;
const BASE_SPEED = 4.2; // cells per second

export default class StarMaze extends MiniGame {
  static meta = {
    id: 'star-maze',
    title: 'Star Maze Dash',
    category: 'Dexterity',
    verb: 'drag',
    layout: 'shared',
    seconds: 60,
    tint: '#f2c14e',
    mascot: 'rabbit',
  };

  static icon(g, s) {
    g.fillStyle = '#eef3f6';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#20313a';
    g.lineWidth = s * 0.075;
    g.lineCap = 'round';
    const seg = [[0.2, 0.15, 0.2, 0.62], [0.2, 0.62, 0.55, 0.62], [0.5, 0.15, 0.5, 0.42],
      [0.5, 0.42, 0.85, 0.42], [0.78, 0.62, 0.78, 0.9], [0.32, 0.85, 0.62, 0.85]];
    for (const [x1, y1, x2, y2] of seg) {
      g.beginPath();
      g.moveTo(x1 * s, y1 * s);
      g.lineTo(x2 * s, y2 * s);
      g.stroke();
    }
    starPath(g, s * 0.76, s * 0.2, s * 0.11);
    g.fillStyle = '#f2c14e';
    g.fill();
    drawAnimal(g, 'rabbit', s * 0.3, s * 0.72, s * 0.13);
  }

  constructor(env) {
    super(env);
    const short = Math.min(this.w, this.h);
    const cellGuess = short / 10;
    this.cols = Math.max(7, Math.min(17, Math.round(this.w / cellGuess)));
    this.rows = Math.max(7, Math.min(17, Math.round(this.h / cellGuess)));
    this.maze = generate(env.rng, this.cols, this.rows);

    this.scores = [0, 0];
    this.players = [
      this.spawn(0, 0),
      this.spawn(this.rows - 1, this.cols - 1),
    ];
    /** @type {Map<number, number>} pointer id -> player index */
    this.grip = new Map();

    /** @type {number[]} cell indices holding a star */
    this.stars = [];
    for (let i = 0; i < STAR_COUNT; i++) this.addStar();

    const spec = byTier(AI, env.difficulty);
    this.aiSpec = spec;
    this.aiRepath = 0;
    this.aiNext = -1;
    this.pop = []; // little collection bursts
  }

  spawn(r, c) {
    return { r, c, x: 0, y: 0, placed: false, tilt: 0 };
  }

  resize(w, h) {
    super.resize(w, h);
    for (const p of this.players) p.placed = false;
  }

  /* ------------------------------ geometry ---------------------------- */

  geom() {
    // The board starts below the pause button and the score row.
    const top = 82;
    const cell = Math.floor(Math.min(this.w / this.cols, (this.h - top - 14) / this.rows));
    const mw = cell * this.cols;
    const mh = cell * this.rows;
    return { cell, ox: (this.w - mw) / 2, oy: top + (this.h - top - 14 - mh) / 2, mw, mh };
  }

  cellCentre(index, G) {
    const r = Math.floor(index / this.cols);
    const c = index % this.cols;
    return { x: G.ox + c * G.cell + G.cell / 2, y: G.oy + r * G.cell + G.cell / 2 };
  }

  ensurePlaced(G) {
    for (const p of this.players) {
      if (!p.placed) {
        const centre = this.cellCentre(p.r * this.cols + p.c, G);
        p.x = centre.x;
        p.y = centre.y;
        p.placed = true;
      }
    }
  }

  addStar() {
    const total = this.cols * this.rows;
    for (let attempt = 0; attempt < 60; attempt++) {
      const i = this.env.rng.int(0, total - 1);
      if (this.stars.includes(i)) continue;
      // Never drop a star straight under somebody's feet.
      const near = this.players.some((p) => Math.abs(Math.floor(i / this.cols) - p.r)
        + Math.abs((i % this.cols) - p.c) < 2);
      if (near) continue;
      this.stars.push(i);
      return;
    }
    this.stars.push(this.env.rng.int(0, total - 1));
  }

  /* ------------------------------- loop ------------------------------- */

  update(dt) {
    if (this.over) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) return this.finish();

    const G = this.geom();
    this.ensurePlaced(G);
    const speed = BASE_SPEED * G.cell;

    for (let i = 0; i < 2; i++) {
      const p = this.players[i];
      const isAi = this.env.mode === '1p' && i === 1;
      const mult = isAi ? this.aiSpec.speed : 1;
      if (isAi) this.steerAi(dt, G);
      if (p.goal) this.move(p, p.goal, speed * mult * dt, G);
      p.r = clampIndex(Math.floor((p.y - G.oy) / G.cell), this.rows);
      p.c = clampIndex(Math.floor((p.x - G.ox) / G.cell), this.cols);
      this.collect(i, G);
    }

    for (const b of this.pop) b.t += dt * 2.4;
    this.pop = this.pop.filter((b) => b.t < 1);
  }

  /** Move toward a point, clamping against walls one axis at a time. */
  move(p, goal, step, G) {
    const dx = goal.x - p.x;
    const dy = goal.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;
    const nx = p.x + (dx / dist) * Math.min(step, dist);
    const ny = p.y + (dy / dist) * Math.min(step, dist);
    p.tilt = Math.max(-0.3, Math.min(0.3, (nx - p.x) * 0.08));
    p.x = this.clampAxis(p, nx, p.y, G, true);
    p.y = this.clampAxis(p, p.x, ny, G, false);
  }

  clampAxis(p, nx, ny, G, horizontal) {
    const rad = G.cell * 0.3;
    const col = clampIndex(Math.floor((p.x - G.ox) / G.cell), this.cols);
    const row = clampIndex(Math.floor((p.y - G.oy) / G.cell), this.rows);
    const wall = this.maze[row * this.cols + col];

    if (horizontal) {
      const left = G.ox + col * G.cell;
      if (nx > p.x && wall & E) return Math.min(nx, left + G.cell - rad);
      if (nx < p.x && wall & W) return Math.max(nx, left + rad);
      return Math.max(G.ox + rad, Math.min(nx, G.ox + G.mw - rad));
    }
    const top = G.oy + row * G.cell;
    if (ny > p.y && wall & S) return Math.min(ny, top + G.cell - rad);
    if (ny < p.y && wall & N) return Math.max(ny, top + rad);
    return Math.max(G.oy + rad, Math.min(ny, G.oy + G.mh - rad));
  }

  collect(i, G) {
    const p = this.players[i];
    for (let s = 0; s < this.stars.length; s++) {
      const centre = this.cellCentre(this.stars[s], G);
      if (Math.hypot(centre.x - p.x, centre.y - p.y) < G.cell * 0.44) {
        this.stars.splice(s, 1);
        this.scores[i] += 1;
        this.pop.push({ x: centre.x, y: centre.y, t: 0, player: i });
        this.env.sfx.good();
        this.addStar();
        if (this.aiNext >= 0) this.aiRepath = 0;
        return;
      }
    }
  }

  finish() {
    const [a, b] = this.scores;
    this.end({
      scores: this.scores,
      winner: a === b ? null : a > b ? 0 : 1,
      stars: this.starsFor(a, b, 4),
    });
  }

  /* -------------------------------- AI -------------------------------- */

  steerAi(dt, G) {
    const ai = this.players[1];
    this.aiRepath -= dt;
    if (this.aiRepath <= 0) {
      this.aiRepath = 0.28;
      this.aiNext = this.chooseNextCell(ai);
    }
    if (this.aiNext >= 0) {
      ai.goal = this.cellCentre(this.aiNext, G);
    } else {
      ai.goal = null;
    }
  }

  /** @returns {number} the cell index to walk into next, or -1 */
  chooseNextCell(ai) {
    if (!this.stars.length) return -1;
    const from = ai.r * this.cols + ai.c;
    const { dist, parent } = bfs(this.maze, this.cols, this.rows, from);

    let target = -1;
    if (this.aiSpec.mode === 'greedy') {
      // Turtle judges by straight-line distance, so it walks into dead ends
      // the way a young player does.
      let best = Infinity;
      for (const s of this.stars) {
        const d = Math.hypot(Math.floor(s / this.cols) - ai.r, (s % this.cols) - ai.c);
        if (d < best) {
          best = d;
          target = s;
        }
      }
    } else if (this.aiSpec.mode === 'contest') {
      const human = this.players[0];
      const theirs = bfs(this.maze, this.cols, this.rows,
        human.r * this.cols + human.c).dist;
      let best = Infinity;
      let fallback = Infinity;
      let fallbackCell = -1;
      for (const s of this.stars) {
        const mine = dist[s];
        if (mine === Infinity) continue;
        if (mine < fallback) {
          fallback = mine;
          fallbackCell = s;
        }
        if (mine < theirs[s] && mine < best) {
          best = mine;
          target = s;
        }
      }
      if (target < 0) target = fallbackCell;
    } else {
      let best = Infinity;
      for (const s of this.stars) {
        if (dist[s] < best) {
          best = dist[s];
          target = s;
        }
      }
    }

    if (target < 0 || dist[target] === Infinity) return -1;

    // Walk the parent chain back to the cell adjacent to the AI.
    let node = target;
    while (parent[node] !== from && parent[node] !== -1) node = parent[node];
    if (parent[node] === -1) return -1;

    if (this.aiSpec.wrongTurn > 0 && this.env.rng.chance(this.aiSpec.wrongTurn)) {
      const options = openNeighbours(this.maze, this.cols, this.rows, from);
      if (options.length > 1) return this.env.rng.pick(options);
    }
    return node;
  }

  /* ------------------------------ input ------------------------------- */

  pointer(p) {
    const G = this.geom();
    this.ensurePlaced(G);

    if (p.type === 'down') {
      const candidates = this.env.mode === '2p' ? [0, 1] : [0];
      let best = -1;
      let bestD = Infinity;
      for (const i of candidates) {
        if ([...this.grip.values()].includes(i)) continue;
        const d = Math.hypot(this.players[i].x - p.x, this.players[i].y - p.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best < 0) return;
      this.grip.set(p.id, best);
      this.players[best].goal = { x: p.x, y: p.y };
    } else if (p.type === 'move') {
      const i = this.grip.get(p.id);
      if (i != null) this.players[i].goal = { x: p.x, y: p.y };
    } else {
      const i = this.grip.get(p.id);
      if (i != null) {
        this.players[i].goal = null;
        this.grip.delete(p.id);
      }
    }
  }

  /* ------------------------------ render ------------------------------ */

  render(g) {
    const G = this.geom();
    this.ensurePlaced(G);

    g.fillStyle = '#f4efe3';
    g.fillRect(0, 0, this.w, this.h);
    g.fillStyle = '#ffffff';
    g.fillRect(G.ox, G.oy, G.mw, G.mh);

    // Walls
    g.strokeStyle = '#41616f';
    g.lineWidth = Math.max(4, G.cell * 0.13);
    g.lineCap = 'round';
    g.beginPath();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const wall = this.maze[r * this.cols + c];
        const x = G.ox + c * G.cell;
        const y = G.oy + r * G.cell;
        if (wall & N) { g.moveTo(x, y); g.lineTo(x + G.cell, y); }
        if (wall & W) { g.moveTo(x, y); g.lineTo(x, y + G.cell); }
        if (r === this.rows - 1 && wall & S) { g.moveTo(x, y + G.cell); g.lineTo(x + G.cell, y + G.cell); }
        if (c === this.cols - 1 && wall & E) { g.moveTo(x + G.cell, y); g.lineTo(x + G.cell, y + G.cell); }
      }
    }
    g.stroke();

    // Stars
    const bob = Math.sin(Date.now() / 300) * G.cell * 0.05;
    for (const s of this.stars) {
      const centre = this.cellCentre(s, G);
      starPath(g, centre.x, centre.y + bob, G.cell * 0.26);
      g.fillStyle = '#f2c14e';
      g.fill();
      g.strokeStyle = '#c99a1e';
      g.lineWidth = 2;
      g.stroke();
    }

    for (const b of this.pop) {
      g.globalAlpha = 1 - b.t;
      fillCircle(g, b.x, b.y - b.t * 30, G.cell * 0.3 * (1 + b.t), PLAYER[b.player].hex);
      g.globalAlpha = 1;
    }

    this.players.forEach((p, i) => {
      fillCircle(g, p.x, p.y + G.cell * 0.22, G.cell * 0.26, 'rgba(32,49,58,0.15)');
      drawAnimal(g, i === 0 ? 'rabbit' : 'fox', p.x, p.y, G.cell * 0.28, { tilt: p.tilt });
    });

    this.renderScores(g, G);
  }

  renderScores(g, G) {
    for (const i of [0, 1]) {
      const x = i === 0 ? 78 : this.w - 16;
      const align = i === 0 ? 'left' : 'right';
      // Sit the badges low enough that tall ears are not clipped by the
      // top edge of the canvas.
      drawAnimal(g, i === 0 ? 'rabbit' : 'fox', i === 0 ? x + 16 : x - 16, 30, 14);
      text(g, `${this.scores[i]}`, i === 0 ? x + 40 : x - 40, 30, 26,
        { fill: PLAYER[i].dark, align });
    }
    text(g, String(Math.ceil(Math.max(0, this.timeLeft))), this.w / 2, 30, 24,
      { fill: this.timeLeft <= 10 ? '#c8402a' : '#5b7480' });
  }
}

/* -------------------------------------------------------------------- *
 * Maze generation and search
 * -------------------------------------------------------------------- */

/**
 * Recursive-backtracker maze, then a handful of walls knocked out so the
 * maze has loops. A perfect maze is a tree, and a tree makes a poor race:
 * whoever is behind can never take a different route.
 */
function generate(rng, cols, rows) {
  const cells = new Uint8Array(cols * rows).fill(N | E | S | W);
  const seen = new Uint8Array(cols * rows);
  const stack = [0];
  seen[0] = 1;

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const r = Math.floor(cur / cols);
    const c = cur % cols;
    const options = [];
    for (const d of DIRS) {
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const idx = nr * cols + nc;
      if (!seen[idx]) options.push({ d, idx });
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const { d, idx } = rng.pick(options);
    cells[cur] &= ~d.bit;
    cells[idx] &= ~d.opp;
    seen[idx] = 1;
    stack.push(idx);
  }

  const extra = Math.floor(cols * rows * 0.12);
  for (let i = 0; i < extra; i++) {
    const r = rng.int(1, rows - 2);
    const c = rng.int(1, cols - 2);
    const d = rng.pick(DIRS);
    const nr = r + d.dr;
    const nc = c + d.dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
    cells[r * cols + c] &= ~d.bit;
    cells[nr * cols + nc] &= ~d.opp;
  }
  return cells;
}

function openNeighbours(maze, cols, rows, index) {
  const r = Math.floor(index / cols);
  const c = index % cols;
  const out = [];
  for (const d of DIRS) {
    if (maze[index] & d.bit) continue;
    const nr = r + d.dr;
    const nc = c + d.dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
    out.push(nr * cols + nc);
  }
  return out;
}

/** Breadth-first search over the maze graph. */
function bfs(maze, cols, rows, from) {
  const total = cols * rows;
  const dist = new Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const queue = [from];
  dist[from] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const nb of openNeighbours(maze, cols, rows, cur)) {
      if (dist[nb] === Infinity) {
        dist[nb] = dist[cur] + 1;
        parent[nb] = cur;
        queue.push(nb);
      }
    }
  }
  return { dist, parent };
}

function clampIndex(v, max) {
  return v < 0 ? 0 : v >= max ? max - 1 : v;
}
