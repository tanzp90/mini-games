/**
 * SNAP SAFARI - reaction, tap, duel layout.
 *
 * Two card slots sit across the middle of the board. Every beat a new animal
 * replaces one of them. When both slots show the same animal, the first
 * player to hit their paw button scores. Hit it when there is no match and
 * you go on a short cooldown.
 *
 * This is the collection's first game for a brand-new player: the whole
 * ruleset is "same animal, hit the paw", which a five-year-old absorbs from
 * one loop of the demo without a word being read.
 *
 * AI ladder: reaction time drawn from a normal distribution, plus the chance
 * of not registering a match at all. The distribution is floored at 330ms so
 * Rocket stays inside human range.
 */

import { MiniGame } from '../engine/game.js';
import { Reactor, byTier } from '../engine/ai.js';
import { ANIMAL_IDS, animalCard, drawAnimal } from '../engine/animals.js';
import { PLAYER, bigButton, easeBack, fillCircle, rr } from '../engine/draw.js';
import { drawAiChip, drawDivider, duelZones, inZone, toLocal, zoneAt } from '../engine/layout.js';

const AI = [
  { mean: 1100, sd: 250, missRate: 0.25 },
  { mean: 650, sd: 150, missRate: 0.08 },
  { mean: 380, sd: 80, missRate: 0.02 },
];

const TARGET_SCORE = 7;
const LOCKOUT = 0.9;

export default class SnapSafari extends MiniGame {
  static meta = {
    id: 'snap-safari',
    title: 'Snap Safari',
    category: 'Reaction',
    verb: 'tap',
    layout: 'duel',
    seconds: 75,
    tint: '#f26a4b',
    mascot: 'fox',
  };

  static icon(g, s) {
    g.save();
    g.translate(s * 0.5, s * 0.5);
    g.rotate(-0.12);
    animalCard(g, 'fox', -s * 0.42, -s * 0.34, s * 0.42, s * 0.54, { bg: '#fff' });
    g.rotate(0.24);
    animalCard(g, 'fox', s * 0.02, -s * 0.34, s * 0.42, s * 0.54, { bg: '#fff' });
    g.restore();
    fillCircle(g, s * 0.5, s * 0.84, s * 0.13, '#f26a4b');
  }

  constructor(env) {
    super(env);
    this.deck = ANIMAL_IDS.slice(0, 8);
    this.slots = [env.rng.pick(this.deck), env.rng.pick(this.deck)];
    this.nextSlot = 0;
    this.scores = [0, 0];
    this.lock = [0, 0];
    this.flash = [0, 0];
    this.beat = 0;
    this.beatLength = 1.35;
    this.dealT = 1; // 0..1 animation of the card that just landed
    this.matchActive = false;
    this.matchAge = 0;

    this.reactor = env.mode === '1p'
      ? new Reactor(env.rng, byTier(AI, env.difficulty))
      : null;

    this.zones = duelZones(this.w, this.h);
    this.pawTouched = [false, false];
  }

  resize(w, h) {
    super.resize(w, h);
    this.zones = duelZones(w, h);
  }

  /* ---------------------------------------------------------------- */

  update(dt) {
    if (this.over) return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) return this.finish();

    for (let i = 0; i < 2; i++) {
      if (this.lock[i] > 0) this.lock[i] -= dt;
      if (this.flash[i] > 0) this.flash[i] -= dt;
    }

    if (this.dealT < 1) this.dealT = Math.min(1, this.dealT + dt * 5);

    // The pace tightens through the round, so the last twenty seconds are
    // the frantic ones.
    const progress = 1 - this.timeLeft / this.constructor.meta.seconds;
    this.beatLength = 1.4 - progress * 0.55;

    this.beat += dt;
    if (this.beat >= this.beatLength) {
      this.beat = 0;
      this.deal();
    }

    if (this.matchActive) this.matchAge += dt;

    if (this.reactor && this.reactor.update(dt)) this.snap(1);
  }

  deal() {
    const rng = this.env.rng;
    // A deliberate match roughly one beat in four keeps the tension up
    // without making the game a coin flip.
    const forceMatch = rng.chance(0.26);
    const other = this.slots[1 - this.nextSlot];
    this.slots[this.nextSlot] = forceMatch ? other : rng.pick(this.deck);
    this.nextSlot = 1 - this.nextSlot;
    this.dealT = 0;
    this.env.sfx.tick();
    this.evaluate();
  }

  evaluate() {
    const isMatch = this.slots[0] === this.slots[1];
    if (isMatch && !this.matchActive) {
      this.matchActive = true;
      this.matchAge = 0;
      if (this.reactor) this.reactor.arm();
    } else if (!isMatch && this.matchActive) {
      this.matchActive = false;
      if (this.reactor) this.reactor.disarm();
    }
  }

  /** @param {0|1} player */
  snap(player) {
    if (this.over || this.lock[player] > 0) return;

    if (this.matchActive) {
      this.scores[player] += 1;
      this.flash[player] = 0.45;
      this.env.sfx.good();
      this.matchActive = false;
      if (this.reactor) this.reactor.disarm();
      // Fresh cards immediately, so the winner of the snap cannot also
      // sit on the next one.
      this.slots = [this.env.rng.pick(this.deck), this.env.rng.pick(this.deck)];
      this.dealT = 0;
      this.beat = 0;
      this.evaluate();
      if (this.scores[player] >= TARGET_SCORE) this.finish();
    } else {
      this.scores[player] = Math.max(0, this.scores[player] - 1);
      this.lock[player] = LOCKOUT;
      this.env.sfx.bad();
    }
  }

  finish() {
    const [a, b] = this.scores;
    this.end({
      scores: this.scores,
      winner: a === b ? null : a > b ? 0 : 1,
      stars: this.starsFor(a, b, 3),
    });
  }

  /* ---------------------------------------------------------------- */

  pointer(p) {
    if (p.type !== 'down' || this.over) return;
    const zone = zoneAt(this.zones, p.x, p.y);
    if (!zone) return;
    if (zone.index === 1 && this.env.mode === '1p') return; // the AI's half
    const local = toLocal(zone, p.x, p.y);
    if (!local) return;

    const paw = this.pawRect(zone);
    const dx = local.x - paw.cx;
    const dy = local.y - paw.cy;
    if (dx * dx + dy * dy <= paw.r * paw.r * 1.3) this.snap(zone.index);
  }

  pawRect(zone) {
    const r = Math.min(zone.h * 0.34, zone.w * 0.16, 92);
    return { cx: zone.w / 2, cy: zone.h - r - Math.min(24, zone.h * 0.08), r };
  }

  /* ---------------------------------------------------------------- */

  render(g) {
    g.fillStyle = '#eaf3f0';
    g.fillRect(0, 0, this.w, this.h);

    for (const zone of this.zones) {
      inZone(g, zone, (gg) => this.renderHalf(gg, zone));
    }
    drawDivider(g, this.w, this.h);
    this.renderCards(g);
    if (this.env.mode === '1p') drawAiChip(g, this.w);
  }

  renderHalf(g, zone) {
    const paw = this.pawRect(zone);
    const i = zone.index;
    const colour = PLAYER[i].hex;

    // Score pips, so the score reads without any number being understood.
    const pipR = Math.min(11, zone.w * 0.014);
    const startX = zone.w / 2 - (TARGET_SCORE - 1) * pipR * 1.6;
    for (let s = 0; s < TARGET_SCORE; s++) {
      const on = s < this.scores[i];
      fillCircle(g, startX + s * pipR * 3.2, paw.cy - paw.r - pipR * 3.4, pipR,
        on ? colour : 'rgba(32,49,58,0.13)');
    }

    const locked = this.lock[i] > 0;
    const flashing = this.flash[i] > 0;
    let btnColour = colour;
    if (locked) btnColour = '#9fb0bd';
    else if (flashing) btnColour = '#5cb85c';

    const bump = flashing ? easeBack(Math.min(1, (0.45 - this.flash[i]) / 0.25)) * 4 : 0;
    bigButton(g, paw.cx, paw.cy - bump, paw.r, btnColour, locked);
    drawAnimal(g, i === 0 ? 'fox' : 'panda', paw.cx, paw.cy - bump, paw.r * 0.56,
      { sad: locked });

    if (locked) {
      // A shrinking ring is the wordless "wait a moment".
      g.beginPath();
      g.arc(paw.cx, paw.cy, paw.r + 10, -Math.PI / 2,
        -Math.PI / 2 + (this.lock[i] / LOCKOUT) * Math.PI * 2);
      g.strokeStyle = 'rgba(242,106,75,0.75)';
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.stroke();
    }

  }

  /** The two shared cards, drawn once across the divider. */
  renderCards(g) {
    const cardH = Math.min(this.h * 0.19, this.w * 0.24, 170);
    const cardW = cardH * 0.78;
    const gap = cardW * 0.24;
    const cy = this.h / 2;
    const x0 = this.w / 2 - cardW - gap / 2;

    for (let i = 0; i < 2; i++) {
      const landing = this.nextSlot !== i; // the slot dealt most recently
      const t = landing ? easeBack(this.dealT) : 1;
      const x = x0 + i * (cardW + gap);
      g.save();
      g.translate(x + cardW / 2, cy);
      g.scale(t, t);
      animalCard(g, this.slots[i], -cardW / 2, -cardH / 2, cardW, cardH, {
        bg: '#ffffff',
        rimColor: this.matchActive ? '#5cb85c' : 'rgba(32,49,58,0.16)',
      });
      g.restore();
    }

    if (this.matchActive) {
      // A pulsing halo around the pair: the only cue that a snap is live.
      const pulse = 1 + Math.sin(this.matchAge * 12) * 0.05;
      g.save();
      g.translate(this.w / 2, cy);
      g.scale(pulse, pulse);
      rr(g, -cardW - gap / 2 - 10, -cardH / 2 - 10,
        cardW * 2 + gap + 20, cardH + 20, 22);
      g.strokeStyle = '#5cb85c';
      g.lineWidth = 6;
      g.stroke();
      g.restore();
    }
  }
}
