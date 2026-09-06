/**
 * PENGUIN SLIDE - aim and physics, drag, shared board.
 *
 * Target rings sit in the middle of an icy sheet. The players sit opposite
 * each other and slide penguins in from their own end: pull back, let go.
 * Penguins bump each other out of the rings. Four slides each per end,
 * whoever ends up closest scores, best of three ends.
 *
 * Pull back and let go is the same motion as rolling a ball across a floor,
 * which is why this replaced a dots-and-boxes clone: there is no timing, no
 * precision, and a lucky slide genuinely wins. It is also the only game in
 * the collection built on physics rather than rules.
 *
 * AI ladder: aiming error plus shot selection. Turtle always aims at the
 * middle and misses by a lot; Rabbit will knock you out when it is losing
 * the end; Rocket simulates its candidate shots through the same physics
 * the players get and picks whichever actually scores best.
 */

import { MiniGame } from '../engine/game.js';
import { aimError, byTier } from '../engine/ai.js';
import { drawAnimal } from '../engine/animals.js';
import { PLAYER, circle, fillCircle, text } from '../engine/draw.js';

const AI = [
  { angleDeg: 18, powerPct: 25, plan: 'centre' },
  { angleDeg: 7, powerPct: 10, plan: 'takeout' },
  { angleDeg: 2.5, powerPct: 4, plan: 'simulate' },
];

const SLIDES_PER_END = 4;
const ENDS = 3;
const DAMPING = 0.35; // velocity retained per second
const STOP = 7; // px/s below which a penguin is considered parked
const WALL_BOUNCE = 0.55;
const STEP = 1 / 120;

export default class PenguinSlide extends MiniGame {
  static meta = {
    id: 'penguin-slide',
    title: 'Penguin Slide',
    category: 'Aim & physics',
    verb: 'pull back',
    layout: 'shared',
    seconds: 90,
    tint: '#4aa3c7',
    mascot: 'penguin',
  };

  static icon(g, s) {
    g.fillStyle = '#eaf6fb';
    g.fillRect(0, 0, s, s);
    const rings = [0.42, 0.28, 0.14];
    const cols = ['#cfe8f2', '#9ed4e8', '#f26a4b'];
    rings.forEach((rr2, i) => fillCircle(g, s * 0.5, s * 0.44, s * rr2, cols[i]));
    drawAnimal(g, 'penguin', s * 0.5, s * 0.44, s * 0.11);
    drawAnimal(g, 'owl', s * 0.76, s * 0.74, s * 0.1);
    g.strokeStyle = 'rgba(32,49,58,0.35)';
    g.setLineDash([4, 4]);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(s * 0.2, s * 0.9);
    g.lineTo(s * 0.46, s * 0.52);
    g.stroke();
    g.setLineDash([]);
  }

  constructor(env) {
    super(env);
    this.timeLeft = -1;
    /** @type {Array<{x:number,y:number,vx:number,vy:number,player:number}>} */
    this.bodies = [];
    this.scores = [0, 0];
    this.end_ = 0;
    this.slide = 0; // 0..SLIDES_PER_END*2-1 within the end
    this.turn = 0;
    this.phase = 'aim'; // aim | moving | between
    this.drag = null;
    this.betweenTimer = 0;
    this.lastEndScore = null;
    this.aiSpec = byTier(AI, env.difficulty);
    this.aiDelay = 0;
  }

  /* ------------------------------ geometry ---------------------------- */

  arena() {
    const pad = 16;
    const top = 84; // clear of the pause button and the score row
    const bottom = 44;
    return {
      x: pad,
      y: top,
      w: this.w - pad * 2,
      h: this.h - top - bottom,
      get cx() { return this.x + this.w / 2; },
      get cy() { return this.y + this.h / 2; },
    };
  }

  radius() {
    const a = this.arena();
    return Math.max(16, Math.min(a.w, a.h) * 0.055);
  }

  launchPoint(player) {
    const a = this.arena();
    const r = this.radius();
    return {
      x: a.cx,
      y: player === 0 ? a.y + a.h - r - 6 : a.y + r + 6,
    };
  }

  maxSpeed() {
    return this.arena().h * 1.1;
  }

  get isAiTurn() {
    return this.env.mode === '1p' && this.turn === 1;
  }

  /* ------------------------------- loop ------------------------------- */

  update(dt) {
    if (this.over) return;

    if (this.phase === 'between') {
      this.betweenTimer -= dt;
      if (this.betweenTimer <= 0) this.startEnd();
      return;
    }

    if (this.phase === 'moving') {
      stepPhysics(this.bodies, dt, this.arena(), this.radius());
      if (this.bodies.every((b) => b.vx === 0 && b.vy === 0)) this.afterSlide();
      return;
    }

    if (this.isAiTurn) {
      this.aiDelay -= dt;
      if (this.aiDelay <= 0) this.aiShoot();
    }
  }

  afterSlide() {
    this.phase = 'aim';
    this.slide += 1;
    if (this.slide >= SLIDES_PER_END * 2) return this.scoreEnd();
    this.turn = 1 - this.turn;
    this.aiDelay = this.env.rng.range(0.6, 1.1);
  }

  scoreEnd() {
    const result = endScore(this.bodies, this.arena());
    this.lastEndScore = result;
    if (result.player >= 0) this.scores[result.player] += result.points;
    this.env.sfx[result.player === 0 ? 'win' : 'thunk']();

    this.end_ += 1;
    if (this.end_ >= ENDS) return this.finish();
    this.phase = 'between';
    this.betweenTimer = 2.2;
  }

  startEnd() {
    this.bodies = [];
    this.slide = 0;
    // The player who lost the previous end leads the next one.
    this.turn = this.lastEndScore && this.lastEndScore.player === 0 ? 1 : 0;
    this.phase = 'aim';
    this.aiDelay = 1;
  }

  finish() {
    const [a, b] = this.scores;
    this.end({
      scores: this.scores,
      winner: a === b ? null : a > b ? 0 : 1,
      stars: this.starsFor(a, b, 3),
    });
  }

  /* ------------------------------ shooting ---------------------------- */

  /** @param {number} vx @param {number} vy */
  launch(vx, vy) {
    const p = this.launchPoint(this.turn);
    this.bodies.push({ x: p.x, y: p.y, vx, vy, player: this.turn });
    this.phase = 'moving';
    this.env.sfx.slide();
  }

  /** Convert an aim point and a 0..1 power into a launch velocity. */
  velocityToward(target, power, wobble) {
    const from = this.launchPoint(this.turn);
    let angle = Math.atan2(target.y - from.y, target.x - from.x);
    let p = power;
    if (wobble) {
      angle += wobble.angle;
      p *= wobble.power;
    }
    p = Math.max(0.12, Math.min(1, p));
    const speed = this.maxSpeed() * p;
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
  }

  /** Power needed to park a penguin on a given point, ignoring collisions. */
  powerFor(target) {
    const from = this.launchPoint(this.turn);
    const dist = Math.hypot(target.x - from.x, target.y - from.y);
    // Total travel of a shot is v0 / -ln(DAMPING); invert that.
    const v0 = dist * -Math.log(DAMPING);
    return v0 / this.maxSpeed();
  }

  aiShoot() {
    const a = this.arena();
    const centre = { x: a.cx, y: a.cy };
    const wobble = aimError(this.env.rng, this.aiSpec);
    let aim = centre;
    let power = this.powerFor(centre);

    if (this.aiSpec.plan === 'takeout') {
      // Only bother if the human actually owns the button right now.
      const mine = nearest(this.bodies, 1, a);
      const theirs = nearest(this.bodies, 0, a);
      if (theirs && (!mine || theirs.dist < mine.dist)) {
        aim = { x: theirs.body.x, y: theirs.body.y };
        power = Math.min(1, this.powerFor(aim) * 1.5); // drive through it
      }
    } else if (this.aiSpec.plan === 'simulate') {
      const best = this.bestSimulatedShot(centre);
      aim = best.aim;
      power = best.power;
    }

    const v = this.velocityToward(aim, power, wobble);
    this.launch(v.vx, v.vy);
  }

  /**
   * Rocket's shot selection: run each candidate through the same physics the
   * players get and keep whichever leaves the end in the best shape.
   */
  bestSimulatedShot(centre) {
    const a = this.arena();
    const r = this.radius();
    const candidates = [{ aim: centre, power: this.powerFor(centre) }];

    for (const body of this.bodies) {
      const aim = { x: body.x, y: body.y };
      candidates.push({ aim, power: Math.min(1, this.powerFor(aim) * 1.5) });
      candidates.push({ aim, power: Math.min(1, this.powerFor(aim) * 1.15) });
    }
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const aim = { x: a.cx + Math.cos(ang) * r * 1.6, y: a.cy + Math.sin(ang) * r * 1.6 };
      candidates.push({ aim, power: this.powerFor(aim) });
    }

    let best = candidates[0];
    let bestValue = -Infinity;
    for (const c of candidates) {
      const v = this.velocityToward(c.aim, c.power, null);
      const from = this.launchPoint(this.turn);
      const sim = this.bodies.map((b) => ({ ...b }));
      sim.push({ x: from.x, y: from.y, vx: v.vx, vy: v.vy, player: this.turn });
      settle(sim, a, r);
      const value = evaluate(sim, a, this.turn);
      if (value > bestValue) {
        bestValue = value;
        best = c;
      }
    }
    return best;
  }

  /* ------------------------------ input ------------------------------- */

  pointer(p) {
    if (this.over || this.phase !== 'aim' || this.isAiTurn) return;
    const from = this.launchPoint(this.turn);

    if (p.type === 'down') {
      this.drag = { sx: p.x, sy: p.y, x: p.x, y: p.y };
      return;
    }
    if (!this.drag) return;

    if (p.type === 'move') {
      this.drag.x = p.x;
      this.drag.y = p.y;
      return;
    }

    // Release: the slingshot fires opposite the pull.
    const dx = this.drag.sx - this.drag.x;
    const dy = this.drag.sy - this.drag.y;
    const len = Math.hypot(dx, dy);
    this.drag = null;
    if (len < 18) return; // a tap, not a pull

    const reach = Math.min(this.w, this.h) * 0.3;
    const power = Math.min(1, len / reach);
    const v = this.velocityToward({ x: from.x + dx, y: from.y + dy }, power, null);
    this.launch(v.vx, v.vy);
  }

  /* ------------------------------ render ------------------------------ */

  render(g) {
    const a = this.arena();
    const r = this.radius();

    g.fillStyle = '#dceef5';
    g.fillRect(0, 0, this.w, this.h);
    g.fillStyle = '#f2fafd';
    g.fillRect(a.x, a.y, a.w, a.h);
    g.strokeStyle = '#a9cfdd';
    g.lineWidth = 3;
    g.strokeRect(a.x, a.y, a.w, a.h);

    // Target rings
    // Small enough that there is a real approach to judge, rather than
    // rings that already fill the sheet.
    const maxR = Math.min(a.w, a.h) * 0.3;
    const rings = [
      { f: 1, c: '#cfe8f2' },
      { f: 0.66, c: '#9ed4e8' },
      { f: 0.33, c: '#f7b7a6' },
      { f: 0.12, c: '#f26a4b' },
    ];
    for (const ring of rings) fillCircle(g, a.cx, a.cy, maxR * ring.f, ring.c);

    // Launch marks at each end
    for (const player of [0, 1]) {
      const lp = this.launchPoint(player);
      circle(g, lp.x, lp.y, r * 1.15);
      g.strokeStyle = `${PLAYER[player].hex}66`;
      g.setLineDash([6, 6]);
      g.lineWidth = 3;
      g.stroke();
      g.setLineDash([]);
    }

    for (const b of this.bodies) {
      fillCircle(g, b.x, b.y + r * 0.2, r, 'rgba(32,49,58,0.13)');
      fillCircle(g, b.x, b.y, r, PLAYER[b.player].hex);
      drawAnimal(g, b.player === 0 ? 'penguin' : 'owl', b.x, b.y, r * 0.78);
    }

    if (this.phase === 'aim' && !this.isAiTurn) this.renderAim(g, r);
    if (this.phase === 'aim' && this.isAiTurn) {
      text(g, 'AI is lining up...', this.w / 2, this.h - 22, 18, { fill: '#5b7480' });
    }
    if (this.phase === 'between') this.renderEndBanner(g);

    this.renderHud(g);
  }

  renderAim(g, r) {
    const from = this.launchPoint(this.turn);
    const pending = this.bodies.length < SLIDES_PER_END * 2;
    if (!pending) return;

    fillCircle(g, from.x, from.y, r, `${PLAYER[this.turn].hex}cc`);
    drawAnimal(g, this.turn === 0 ? 'penguin' : 'owl', from.x, from.y, r * 0.78);

    if (!this.drag) return;
    const dx = this.drag.sx - this.drag.x;
    const dy = this.drag.sy - this.drag.y;
    const len = Math.hypot(dx, dy);
    if (len < 8) return;
    const reach = Math.min(this.w, this.h) * 0.3;
    const power = Math.min(1, len / reach);

    // The guide shows where it is heading and, by its length, how hard.
    g.save();
    g.strokeStyle = PLAYER[this.turn].hex;
    g.setLineDash([10, 8]);
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(from.x + (dx / len) * reach * power * 1.6,
      from.y + (dy / len) * reach * power * 1.6);
    g.stroke();
    g.restore();

    // Power pips beside the launch spot.
    for (let i = 0; i < 5; i++) {
      fillCircle(g, from.x - 44 + i * 22, from.y + (this.turn === 0 ? -r - 22 : r + 22), 6,
        power * 5 > i ? PLAYER[this.turn].hex : 'rgba(32,49,58,0.15)');
    }
  }

  renderEndBanner(g) {
    const res = this.lastEndScore;
    g.fillStyle = 'rgba(32,49,58,0.75)';
    g.fillRect(0, this.h / 2 - 60, this.w, 120);
    const line = res && res.player >= 0
      ? `Player ${res.player + 1} scores ${res.points}`
      : 'Nobody scores';
    text(g, line, this.w / 2, this.h / 2 - 12, 28, { fill: '#ffffff', outline: false });
    text(g, `End ${this.end_ + 1} of ${ENDS} next`, this.w / 2, this.h / 2 + 24, 18,
      { fill: '#9fb0bd', outline: false });
  }

  renderHud(g) {
    for (const p of [0, 1]) {
      const x = p === 0 ? 82 : this.w - 20;
      const align = p === 0 ? 'left' : 'right';
      drawAnimal(g, p === 0 ? 'penguin' : 'owl', p === 0 ? x + 16 : x - 16, 26, 16);
      text(g, String(this.scores[p]), p === 0 ? x + 42 : x - 42, 26, 24,
        { fill: PLAYER[p].dark, align });
    }
    // Slides left in this end, as stones rather than a number.
    const left = SLIDES_PER_END * 2 - this.slide;
    for (let i = 0; i < left; i++) {
      fillCircle(g, this.w / 2 - (left - 1) * 8 + i * 16, 26, 6, 'rgba(32,49,58,0.28)');
    }
    text(g, `End ${Math.min(ENDS, this.end_ + 1)}/${ENDS}`, this.w / 2, this.h - 22, 16,
      { fill: '#5b7480' });
  }
}

/* -------------------------------------------------------------------- *
 * Physics - deliberately separate from rendering so the AI can run the
 * exact same simulation forward when choosing a shot.
 * -------------------------------------------------------------------- */

function stepPhysics(bodies, dt, arena, r) {
  const decay = DAMPING ** dt;
  for (const b of bodies) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= decay;
    b.vy *= decay;

    if (b.x < arena.x + r) { b.x = arena.x + r; b.vx = Math.abs(b.vx) * WALL_BOUNCE; }
    if (b.x > arena.x + arena.w - r) { b.x = arena.x + arena.w - r; b.vx = -Math.abs(b.vx) * WALL_BOUNCE; }
    if (b.y < arena.y + r) { b.y = arena.y + r; b.vy = Math.abs(b.vy) * WALL_BOUNCE; }
    if (b.y > arena.y + arena.h - r) { b.y = arena.y + arena.h - r; b.vy = -Math.abs(b.vy) * WALL_BOUNCE; }

    if (Math.hypot(b.vx, b.vy) < STOP) { b.vx = 0; b.vy = 0; }
  }

  // Equal-mass elastic collisions, resolved pairwise.
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      if (dist === 0) { dx = 0.01; dy = 0; dist = 0.01; }
      if (dist >= r * 2) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = r * 2 - dist;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;

      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel > 0) continue; // already separating
      const impulse = rel * 0.94; // a touch of energy lost to the ice
      a.vx += impulse * nx;
      a.vy += impulse * ny;
      b.vx -= impulse * nx;
      b.vy -= impulse * ny;
    }
  }
}

/** Run a simulation forward until nothing is moving. */
function settle(bodies, arena, r) {
  for (let i = 0; i < 900; i++) {
    stepPhysics(bodies, STEP, arena, r);
    if (bodies.every((b) => b.vx === 0 && b.vy === 0)) return;
  }
}

function nearest(bodies, player, arena) {
  let best = null;
  for (const b of bodies) {
    if (b.player !== player) continue;
    const dist = Math.hypot(b.x - arena.cx, b.y - arena.cy);
    if (!best || dist < best.dist) best = { body: b, dist };
  }
  return best;
}

/**
 * Curling scoring: whoever owns the closest penguin scores one point for
 * every penguin of theirs that is closer than the opponent's best.
 */
function endScore(bodies, arena) {
  const a = nearest(bodies, 0, arena);
  const b = nearest(bodies, 1, arena);
  if (!a && !b) return { player: -1, points: 0 };
  if (!b) return { player: 0, points: bodies.filter((x) => x.player === 0).length };
  if (!a) return { player: 1, points: bodies.filter((x) => x.player === 1).length };

  const winner = a.dist < b.dist ? 0 : 1;
  const limit = winner === 0 ? b.dist : a.dist;
  const points = bodies.filter((x) => x.player === winner
    && Math.hypot(x.x - arena.cx, x.y - arena.cy) < limit).length;
  return { player: winner, points };
}

/** Signed value of a settled position from one player's point of view. */
function evaluate(bodies, arena, player) {
  const res = endScore(bodies, arena);
  const sign = res.player === player ? 1 : -1;
  const mine = nearest(bodies, player, arena);
  // Break ties on raw closeness, so a shot that improves position without
  // changing the count is still preferred.
  const closeness = mine ? -mine.dist / Math.max(arena.w, arena.h) : -2;
  return res.player < 0 ? closeness : sign * res.points * 10 + closeness;
}
