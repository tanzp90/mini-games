/**
 * LOOP THE LINE - puzzle race, trace, duel layout.
 *
 * Connect each animal to its matching home by tracing a path with one
 * finger. Paths cannot cross. Both players get the same freshly generated
 * puzzle side by side, and playing solo the opponent's half fills in beside
 * you at a measured pace, so the race is something you can see rather than
 * a number you are told about afterwards.
 *
 * Tracing is the most natural gesture there is on a touchscreen, progress is
 * always visible, and every move is reversible - back up over your own line
 * and it rubs out behind your finger.
 *
 * Puzzles are generated, not authored: the grid is tiled by random
 * self-avoiding walks, so each walk becomes one animal-to-home pair and the
 * supply is endless. Because the generator starts from a filled grid, every
 * puzzle it emits is guaranteed solvable.
 *
 * AI ladder: solve time as a multiple of the puzzle's own par.
 */

import { MiniGame } from '../engine/game.js';
import { byTier } from '../engine/ai.js';
import { drawAnimal, ANIMAL_IDS } from '../engine/animals.js';
import { PALETTE, PLAYER, fillCircle, fillRR, text } from '../engine/draw.js';
import { drawAiChip, drawDivider, duelZones, inZone, toLocal, zoneAt } from '../engine/layout.js';

const GRID = 5;
const CELLS = GRID * GRID;
/** Seconds of par per cell, before the tier multiplier. */
const PAR_PER_CELL = 0.5;
const AI_PACE = [2.5, 1.3, 0.85];

export default class LoopTheLine extends MiniGame {
  static meta = {
    id: 'loop-the-line',
    title: 'Loop the Line',
    category: 'Puzzle race',
    verb: 'trace',
    layout: 'duel',
    seconds: 90,
    tint: '#a33268',
    mascot: 'cat',
  };

  static icon(g, s) {
    g.fillStyle = '#fdeef4';
    g.fillRect(0, 0, s, s);
    const cell = s / 4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = cell * 0.42;
    g.strokeStyle = PALETTE[0].hex;
    g.beginPath();
    g.moveTo(cell * 0.5, cell * 0.5);
    g.lineTo(cell * 0.5, cell * 2.5);
    g.lineTo(cell * 2.5, cell * 2.5);
    g.stroke();
    g.strokeStyle = PALETTE[3].hex;
    g.beginPath();
    g.moveTo(cell * 1.5, cell * 0.5);
    g.lineTo(cell * 3.5, cell * 0.5);
    g.lineTo(cell * 3.5, cell * 3.5);
    g.stroke();
    fillCircle(g, cell * 0.5, cell * 0.5, cell * 0.28, PALETTE[0].dark);
    fillCircle(g, cell * 2.5, cell * 2.5, cell * 0.28, PALETTE[0].dark);
    fillCircle(g, cell * 1.5, cell * 0.5, cell * 0.28, PALETTE[3].dark);
    fillCircle(g, cell * 3.5, cell * 3.5, cell * 0.28, PALETTE[3].dark);
  }

  constructor(env) {
    super(env);
    this.zones = duelZones(this.w, this.h);
    this.puzzle = generatePuzzle(env.rng);
    this.animals = env.rng.shuffle(ANIMAL_IDS.slice()).slice(0, this.puzzle.paths.length);

    /** Drawn state per player: colour index -> array of cell indices. */
    this.drawn = [new Map(), new Map()];
    /** @type {Map<number, {player:number, colour:number}>} */
    this.drags = new Map();

    this.par = CELLS * PAR_PER_CELL;
    this.aiStep = (this.par * byTier(AI_PACE, env.difficulty)) / CELLS;
    this.aiTimer = this.aiStep;
    this.aiPathIndex = 0;
    this.aiCellIndex = 0;
  }

  resize(w, h) {
    super.resize(w, h);
    this.zones = duelZones(w, h);
  }

  /* ------------------------------- loop ------------------------------- */

  update(dt) {
    if (this.over) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) return this.finish();

    if (this.env.mode === '1p') this.updateAi(dt);

    for (const p of [0, 1]) {
      if (this.solvedCount(p) === this.puzzle.paths.length) return this.finish();
    }
  }

  /** The opponent lays one more cell of its solution every aiStep seconds. */
  updateAi(dt) {
    if (this.aiPathIndex >= this.puzzle.paths.length) return;
    this.aiTimer -= dt;
    if (this.aiTimer > 0) return;
    this.aiTimer = this.aiStep;

    const path = this.puzzle.paths[this.aiPathIndex];
    this.aiCellIndex += 1;
    const drawn = path.slice(0, this.aiCellIndex + 1);
    this.drawn[1].set(this.aiPathIndex, drawn);

    if (this.aiCellIndex >= path.length - 1) {
      this.env.sfx.tick();
      this.aiPathIndex += 1;
      this.aiCellIndex = 0;
    }
  }

  solvedCount(player) {
    let n = 0;
    for (let c = 0; c < this.puzzle.paths.length; c++) {
      if (this.isSolved(player, c)) n++;
    }
    return n;
  }

  isSolved(player, colour) {
    const drawn = this.drawn[player].get(colour);
    if (!drawn || drawn.length < 2) return false;
    const ends = this.puzzle.terminals[colour];
    const first = drawn[0];
    const last = drawn[drawn.length - 1];
    return (first === ends[0] && last === ends[1]) || (first === ends[1] && last === ends[0]);
  }

  finish() {
    const scores = [this.solvedCount(0), this.solvedCount(1)];
    const total = this.puzzle.paths.length;
    this.end({
      scores,
      winner: scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1,
      stars: scores[0] === total ? 3 : scores[0] > scores[1] ? 2 : scores[0] > 0 ? 1 : 0,
    });
  }

  /* ------------------------------ geometry ---------------------------- */

  geom(zone) {
    const pad = 14;
    const size = Math.min(zone.w - pad * 2, zone.h - pad * 2 - 26);
    const cell = size / GRID;
    return {
      cell,
      ox: (zone.w - cell * GRID) / 2,
      oy: 26 + (zone.h - 26 - cell * GRID) / 2,
    };
  }

  cellAt(local, G) {
    const c = Math.floor((local.x - G.ox) / G.cell);
    const r = Math.floor((local.y - G.oy) / G.cell);
    if (c < 0 || r < 0 || c >= GRID || r >= GRID) return -1;
    return r * GRID + c;
  }

  centre(index, G) {
    return {
      x: G.ox + (index % GRID) * G.cell + G.cell / 2,
      y: G.oy + Math.floor(index / GRID) * G.cell + G.cell / 2,
    };
  }

  /* ------------------------------ drawing ----------------------------- */

  /** Which colour, if any, currently occupies this cell for this player. */
  occupantOf(player, cell) {
    for (const [colour, path] of this.drawn[player]) {
      const at = path.indexOf(cell);
      if (at >= 0) return { colour, at };
    }
    return null;
  }

  terminalColour(cell) {
    for (let c = 0; c < this.puzzle.terminals.length; c++) {
      if (this.puzzle.terminals[c].includes(cell)) return c;
    }
    return -1;
  }

  beginTrace(player, cell) {
    const term = this.terminalColour(cell);
    if (term >= 0) {
      // Starting from a terminal always begins that colour afresh.
      this.drawn[player].set(term, [cell]);
      this.env.sfx.tap();
      return term;
    }
    const occ = this.occupantOf(player, cell);
    if (occ) {
      // Grabbing the middle of your own line rubs out everything after it.
      const path = this.drawn[player].get(occ.colour);
      this.drawn[player].set(occ.colour, path.slice(0, occ.at + 1));
      return occ.colour;
    }
    return -1;
  }

  extendTrace(player, colour, cell) {
    const path = this.drawn[player].get(colour);
    if (!path || !path.length) return;
    const head = path[path.length - 1];
    if (cell === head) return;
    if (!adjacent(cell, head)) return;

    // Backing up over your own line erases it behind your finger.
    if (path.length >= 2 && cell === path[path.length - 2]) {
      path.pop();
      return;
    }
    if (path.includes(cell)) return;

    const term = this.terminalColour(cell);
    if (term >= 0 && term !== colour) return; // another animal's home: blocked
    if (term === colour && !this.puzzle.terminals[colour].includes(path[0])) return;

    const occ = this.occupantOf(player, cell);
    if (occ && occ.colour !== colour) {
      // Cross another line and it gives way from that point on.
      const other = this.drawn[player].get(occ.colour);
      this.drawn[player].set(occ.colour, other.slice(0, occ.at));
    }

    path.push(cell);
    if (this.isSolved(player, colour)) this.env.sfx.good();
    else this.env.sfx.tick();
  }

  /* ------------------------------ input ------------------------------- */

  pointer(p) {
    if (this.over) return;

    if (p.type === 'down') {
      const zone = zoneAt(this.zones, p.x, p.y);
      if (!zone) return;
      if (zone.index === 1 && this.env.mode === '1p') return;
      const local = toLocal(zone, p.x, p.y);
      if (!local) return;
      const cell = this.cellAt(local, this.geom(zone));
      if (cell < 0) return;
      const colour = this.beginTrace(zone.index, cell);
      if (colour >= 0) this.drags.set(p.id, { player: zone.index, colour });
      return;
    }

    const drag = this.drags.get(p.id);
    if (!drag) return;
    if (p.type === 'up') {
      this.drags.delete(p.id);
      return;
    }
    const zone = this.zones[drag.player];
    const local = toLocal(zone, p.x, p.y);
    if (!local) return;
    const cell = this.cellAt(local, this.geom(zone));
    if (cell >= 0) this.extendTrace(drag.player, drag.colour, cell);
  }

  /* ------------------------------ render ------------------------------ */

  render(g) {
    g.fillStyle = '#fdeef4';
    g.fillRect(0, 0, this.w, this.h);
    for (const zone of this.zones) inZone(g, zone, (gg) => this.renderHalf(gg, zone));
    drawDivider(g, this.w, this.h);
    if (this.env.mode === '1p') drawAiChip(g, this.w);
  }

  renderHalf(g, zone) {
    const G = this.geom(zone);
    const player = zone.index;
    const ghost = this.env.mode === '1p' && player === 1;

    // Board
    fillRR(g, G.ox - 6, G.oy - 6, G.cell * GRID + 12, G.cell * GRID + 12, 16, '#ffffff');
    g.strokeStyle = 'rgba(32,49,58,0.1)';
    g.lineWidth = 1.5;
    for (let i = 1; i < GRID; i++) {
      g.beginPath();
      g.moveTo(G.ox + i * G.cell, G.oy);
      g.lineTo(G.ox + i * G.cell, G.oy + G.cell * GRID);
      g.moveTo(G.ox, G.oy + i * G.cell);
      g.lineTo(G.ox + G.cell * GRID, G.oy + i * G.cell);
      g.stroke();
    }

    // Lines
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = G.cell * 0.42;
    for (const [colour, path] of this.drawn[player]) {
      if (path.length < 2) continue;
      g.globalAlpha = ghost ? 0.5 : 1;
      g.strokeStyle = PALETTE[colour % PALETTE.length].hex;
      g.beginPath();
      path.forEach((cell, i) => {
        const c = this.centre(cell, G);
        if (i === 0) g.moveTo(c.x, c.y);
        else g.lineTo(c.x, c.y);
      });
      g.stroke();
      g.globalAlpha = 1;
    }

    // Terminals: an animal at one end, its little home at the other.
    this.puzzle.terminals.forEach((ends, colour) => {
      const pal = PALETTE[colour % PALETTE.length];
      const solved = this.isSolved(player, colour);
      const animal = this.animals[colour % this.animals.length];
      ends.forEach((cell, endIndex) => {
        const c = this.centre(cell, G);
        fillCircle(g, c.x, c.y, G.cell * 0.36, pal.hex);
        if (endIndex === 0) {
          drawAnimal(g, animal, c.x, c.y, G.cell * 0.26);
        } else {
          // The same animal, tucked inside its house. Pairs are matched by
          // animal rather than by colour, so the puzzle is still solvable by
          // a player who cannot separate two of the six colours.
          drawHome(g, c.x, c.y, G.cell * 0.3, pal.dark);
          drawAnimal(g, animal, c.x, c.y + G.cell * 0.05, G.cell * 0.15);
        }
        if (solved) {
          g.beginPath();
          g.arc(c.x, c.y, G.cell * 0.4, 0, Math.PI * 2);
          g.strokeStyle = pal.dark;
          g.lineWidth = 3;
          g.stroke();
        }
      });
    });

    // At this player's own edge, not the divider: two HUDs stacked on the
    // middle line are unreadable from both sides at once.
    const hudY = zone.h - 18;
    // The far half's HUD would be drawn upside down to the human sitting
    // at the near edge; the upright AI chip carries that information instead.
    if (this.env.mode === '1p' && zone.index === 1) return;
    const done = this.solvedCount(player);
    text(g, `${done}/${this.puzzle.paths.length}`, 20, hudY, 20,
      { fill: PLAYER[player].dark, align: 'left' });
    text(g, String(Math.ceil(Math.max(0, this.timeLeft))), zone.w - 20, hudY, 18,
      { fill: '#5b7480', align: 'right' });
  }
}

/* -------------------------------------------------------------------- *
 * Puzzle generation
 * -------------------------------------------------------------------- */

function adjacent(a, b) {
  const ar = Math.floor(a / GRID);
  const ac = a % GRID;
  const br = Math.floor(b / GRID);
  const bc = b % GRID;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

function neighbours(cell) {
  const r = Math.floor(cell / GRID);
  const c = cell % GRID;
  const out = [];
  if (r > 0) out.push(cell - GRID);
  if (r < GRID - 1) out.push(cell + GRID);
  if (c > 0) out.push(cell - 1);
  if (c < GRID - 1) out.push(cell + 1);
  return out;
}

/**
 * Tile the grid with self-avoiding walks. Each walk becomes one pair, and
 * because the walks between them cover every cell, the puzzle is solvable
 * by construction - the generator hands us the solution for free, which is
 * also what the opponent traces.
 *
 * @param {import('../engine/rng.js').Rng} rng
 * @returns {{paths:number[][], terminals:number[][]}}
 */
function generatePuzzle(rng) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const owner = new Int8Array(CELLS).fill(-1);
    const paths = [];

    while (true) {
      const empties = [];
      for (let i = 0; i < CELLS; i++) if (owner[i] === -1) empties.push(i);
      if (!empties.length) break;

      const start = rng.pick(empties);
      const path = [start];
      owner[start] = paths.length;
      const maxLen = rng.int(3, 8);
      let cur = start;
      while (path.length < maxLen) {
        const options = neighbours(cur).filter((i) => owner[i] === -1);
        if (!options.length) break;
        cur = rng.pick(options);
        owner[cur] = paths.length;
        path.push(cur);
      }
      paths.push(path);
      if (paths.length > 12) break;
    }

    // A one-cell path is not a pair. Graft each onto a neighbouring path
    // whose end it touches; if that cannot be done, throw the board away.
    let repaired = true;
    for (let guard = 0; guard < 12; guard++) {
      const singles = paths.filter((p) => p.length === 1);
      if (!singles.length) break;
      repaired = false;
      for (const single of singles) {
        const cell = single[0];
        const host = paths.find((p) => p.length > 1
          && (adjacent(p[0], cell) || adjacent(p[p.length - 1], cell)));
        if (!host) continue;
        if (adjacent(host[0], cell)) host.unshift(cell);
        else host.push(cell);
        paths.splice(paths.indexOf(single), 1);
        repaired = true;
      }
      if (!repaired) break;
    }

    if (paths.some((p) => p.length < 2)) continue;
    if (paths.length < 3 || paths.length > PALETTE.length) continue;

    return {
      paths,
      terminals: paths.map((p) => [p[0], p[p.length - 1]]),
    };
  }

  // Fallback: five straight rows. Dull, but always valid and always solvable.
  const paths = [];
  for (let r = 0; r < GRID; r++) {
    const row = [];
    for (let c = 0; c < GRID; c++) row.push(r * GRID + c);
    paths.push(row);
  }
  return { paths: paths.slice(0, 5), terminals: paths.slice(0, 5).map((p) => [p[0], p[p.length - 1]]) };
}

/** A little house, so one end of every pair reads as "home". */
function drawHome(g, x, y, r, colour) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y - r * 0.05);
  g.lineTo(x + r * 0.66, y - r * 0.05);
  g.lineTo(x + r * 0.66, y + r * 0.8);
  g.lineTo(x - r * 0.66, y + r * 0.8);
  g.lineTo(x - r * 0.66, y - r * 0.05);
  g.lineTo(x - r, y - r * 0.05);
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  g.strokeStyle = colour;
  g.lineWidth = Math.max(2, r * 0.16);
  g.lineJoin = 'round';
  g.stroke();
}
