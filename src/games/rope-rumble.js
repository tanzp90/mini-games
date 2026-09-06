/**
 * ROPE RUMBLE - real-time dexterity, fast-tap, duel layout.
 *
 * Tug of war, deliberately NOT a tapping-speed contest. Those are won by
 * whoever is bigger, they are unpleasant on a glass screen, and they teach a
 * five-year-old that they lose to their brother every time.
 *
 * Instead each player has two paws and exactly one lights up. Tap the lit
 * one to pull. Tap the wrong one - or tap during the beat where neither is
 * lit - and you stall. It rewards attention rather than strength, so the
 * youngest player at the table can genuinely win, and at 45 seconds it is
 * the shortest round in the collection.
 *
 * AI ladder: tap rate and cue accuracy, capped below machine-perfect on
 * purpose so Rocket stays beatable.
 */

import { MiniGame } from '../engine/game.js';
import { byTier } from '../engine/ai.js';
import { drawAnimal } from '../engine/animals.js';
import { PLAYER, bigButton, fillCircle, fillRR, shade, text } from '../engine/draw.js';
import { drawAiChip, drawDivider, duelZones, inZone, toLocal, zoneAt } from '../engine/layout.js';

const AI = [
  { rate: 3.2, accuracy: 0.7 },
  { rate: 4.5, accuracy: 0.88 },
  { rate: 5.8, accuracy: 0.97 },
];

const PULL = 0.035;
const SLIP = 0.018;
const STALL = 0.45;
/** Roughly one beat in ten is a fake-out with nothing lit at all. */
const DARK_BEAT = 0.11;

export default class RopeRumble extends MiniGame {
  static meta = {
    id: 'rope-rumble',
    title: 'Rope Rumble',
    category: 'Dexterity',
    verb: 'fast tap',
    layout: 'duel',
    seconds: 45,
    tint: '#f2802e',
    mascot: 'bear',
  };

  static icon(g, s) {
    g.fillStyle = '#fdf3e6';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#c9a06a';
    g.lineWidth = s * 0.07;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.12);
    g.lineTo(s * 0.5, s * 0.88);
    g.stroke();
    fillCircle(g, s * 0.5, s * 0.56, s * 0.11, '#f2802e');
    drawAnimal(g, 'bear', s * 0.22, s * 0.78, s * 0.15);
    g.save();
    g.translate(s * 0.78, s * 0.22);
    g.rotate(Math.PI);
    drawAnimal(g, 'panda', 0, 0, s * 0.15);
    g.restore();
  }

  constructor(env) {
    super(env);
    this.zones = duelZones(this.w, this.h);
    /** -1 .. 1, positive means player 1 is winning the pull. */
    this.pos = 0;
    this.lit = [0, 0]; // which paw is lit per player, -1 for none
    this.beat = [0, 0];
    this.stall = [0, 0];
    this.pulse = [0, 0];
    this.taps = [0, 0];
    this.aiSpec = byTier(AI, env.difficulty);
    this.aiTimer = 0;
    this.newBeat(0);
    this.newBeat(1);
  }

  resize(w, h) {
    super.resize(w, h);
    this.zones = duelZones(w, h);
  }

  newBeat(player) {
    this.beat[player] = this.env.rng.range(0.55, 1.0);
    this.lit[player] = this.env.rng.chance(DARK_BEAT) ? -1 : this.env.rng.int(0, 1);
    if (player === 1 && this.env.mode === '1p') {
      this.aiTimer = this.env.rng.range(0.12, 0.3);
    }
  }

  /* ------------------------------- loop ------------------------------- */

  update(dt) {
    if (this.over) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) return this.finish();

    for (let i = 0; i < 2; i++) {
      if (this.stall[i] > 0) this.stall[i] -= dt;
      if (this.pulse[i] > 0) this.pulse[i] -= dt;
      this.beat[i] -= dt;
      if (this.beat[i] <= 0) this.newBeat(i);
    }

    if (this.env.mode === '1p') this.updateAi(dt);

    if (Math.abs(this.pos) >= 1) this.finish();
  }

  updateAi(dt) {
    if (this.stall[1] > 0) return;
    this.aiTimer -= dt;
    if (this.aiTimer > 0) return;
    // A steady tap rate with jitter, so it does not sound metronomic.
    this.aiTimer = (1 / this.aiSpec.rate) * this.env.rng.range(0.8, 1.2);

    const lit = this.lit[1];
    if (this.env.rng.chance(this.aiSpec.accuracy)) {
      // Accurate means it also correctly holds off on a dark beat.
      if (lit >= 0) this.tap(1, lit);
    } else {
      this.tap(1, this.env.rng.int(0, 1));
    }
  }

  /** @param {0|1} player @param {number} paw */
  tap(player, paw) {
    if (this.over || this.stall[player] > 0) return;
    const dir = player === 0 ? 1 : -1;

    if (this.lit[player] === paw) {
      this.pos += PULL * dir;
      this.taps[player] += 1;
      this.pulse[player] = 0.16;
      this.newBeat(player);
      if (player === 0 || this.env.mode === '2p') this.env.sfx.tick();
    } else {
      this.pos -= SLIP * dir;
      this.stall[player] = STALL;
      if (player === 0 || this.env.mode === '2p') this.env.sfx.bad();
    }
    this.pos = Math.max(-1, Math.min(1, this.pos));
  }

  finish() {
    // The score shown is how far the rope travelled each way, in whole steps.
    const scores = [
      Math.max(0, Math.round(this.pos * 20)),
      Math.max(0, Math.round(-this.pos * 20)),
    ];
    this.end({
      scores,
      winner: this.pos === 0 ? null : this.pos > 0 ? 0 : 1,
      stars: this.pos >= 1 ? 3 : this.pos > 0.35 ? 2 : this.pos > 0 ? 1 : 0,
    });
  }

  /* ------------------------------ layout ------------------------------ */

  paws(zone) {
    const r = Math.min(zone.h * 0.3, zone.w * 0.15, 96);
    const gap = r + Math.max(34, zone.w * 0.045);
    const cy = zone.h * 0.58;
    return [
      { cx: zone.w / 2 - gap, cy, r },
      { cx: zone.w / 2 + gap, cy, r },
    ];
  }

  pointer(p) {
    if (p.type !== 'down' || this.over) return;
    const zone = zoneAt(this.zones, p.x, p.y);
    if (!zone) return;
    if (zone.index === 1 && this.env.mode === '1p') return;
    const local = toLocal(zone, p.x, p.y);
    if (!local) return;
    const paws = this.paws(zone);
    for (let i = 0; i < paws.length; i++) {
      const paw = paws[i];
      if (Math.hypot(local.x - paw.cx, local.y - paw.cy) <= paw.r * 1.25) {
        this.tap(zone.index, i);
        return;
      }
    }
  }

  /* ------------------------------ render ------------------------------ */

  render(g) {
    g.fillStyle = '#fdf3e6';
    g.fillRect(0, 0, this.w, this.h);

    this.renderRope(g);
    for (const zone of this.zones) inZone(g, zone, (gg) => this.renderHalf(gg, zone));
    drawDivider(g, this.w, this.h);
    this.renderKnot(g);
    if (this.env.mode === '1p') drawAiChip(g, this.w);
  }

  /** The rope runs down the centre; the knot moves toward whoever is winning. */
  renderRope(g) {
    const x = this.w / 2;
    const top = this.h * 0.08;
    const bottom = this.h * 0.92;

    g.strokeStyle = '#e0cdb0';
    g.lineWidth = 26;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x, bottom);
    g.stroke();

    g.strokeStyle = '#c9a06a';
    g.lineWidth = 5;
    for (let y = top; y < bottom; y += 22) {
      g.beginPath();
      g.moveTo(x - 12, y);
      g.lineTo(x + 12, y + 11);
      g.stroke();
    }

    // Win lines: reach one and the round ends immediately.
    for (const s of [-1, 1]) {
      const y = this.h / 2 + s * this.h * 0.38;
      g.strokeStyle = PLAYER[s > 0 ? 0 : 1].hex;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x - 46, y);
      g.lineTo(x + 46, y);
      g.stroke();
    }
  }

  renderKnot(g) {
    const x = this.w / 2;
    const y = this.h / 2 + this.pos * this.h * 0.38;
    const leader = this.pos === 0 ? null : this.pos > 0 ? 0 : 1;
    fillCircle(g, x, y + 4, 25, 'rgba(32,49,58,0.18)');
    fillCircle(g, x, y, 25, leader === null ? '#f2c14e' : PLAYER[leader].hex);
    fillCircle(g, x, y, 25, 'rgba(255,255,255,0)');
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(x, y, 15, 0, Math.PI * 2);
    g.stroke();
  }

  renderHalf(g, zone) {
    const i = zone.index;
    const paws = this.paws(zone);
    const stalled = this.stall[i] > 0;

    paws.forEach((paw, index) => {
      const isLit = this.lit[i] === index && !stalled;
      let colour = '#d9cfc0';
      if (stalled) colour = '#b7b0a5';
      else if (isLit) colour = PLAYER[i].hex;

      if (isLit) {
        // A halo makes the lit paw unmistakable from across the table.
        fillCircle(g, paw.cx, paw.cy, paw.r * 1.28, `${PLAYER[i].hex}33`);
      }
      const squash = this.pulse[i] > 0 && isLit ? 0.94 : 1;
      g.save();
      g.translate(paw.cx, paw.cy);
      g.scale(squash, squash);
      bigButton(g, 0, 0, paw.r, colour, stalled);
      drawAnimal(g, i === 0 ? 'bear' : 'panda', 0, 0, paw.r * 0.5, { sad: stalled });
      g.restore();
    });

    if (stalled) {
      g.fillStyle = 'rgba(32,49,58,0.1)';
      g.fillRect(0, 0, zone.w, zone.h);
    }

    // Near this player's own edge, not the divider - see Bubble Blitz.
    const hudY = zone.h - 22;
    // The far half's HUD would be drawn upside down to the human sitting
    // at the near edge; the upright AI chip carries that information instead.
    if (this.env.mode === '1p' && zone.index === 1) return;
    text(g, String(this.taps[i]), 22, hudY, 22, { fill: PLAYER[i].dark, align: 'left' });
    text(g, String(Math.ceil(Math.max(0, this.timeLeft))), zone.w - 22, hudY, 20,
      { fill: '#5b7480', align: 'right' });
  }
}
