/**
 * BUBBLE BLITZ - real-time dexterity, swipe, duel layout.
 *
 * Coloured, shaped bubbles drift down your half of the board. Flick each one
 * toward the matching bin - left, middle or right. The spawn rate climbs
 * through the round, so the last twenty seconds are the hard ones.
 *
 * A directional flick is far easier for a small hand than precise tapping,
 * and because every colour also carries its own shape, sorting works on
 * shape alone for a player who cannot separate the colours.
 *
 * AI ladder: throughput and accuracy on its own half - how quickly it reacts
 * to a bubble, and how often it picks the right bin.
 */

import { MiniGame } from '../engine/game.js';
import { byTier } from '../engine/ai.js';
import { PALETTE, PLAYER, fillCircle, fillRR, shapeGlyph, text } from '../engine/draw.js';
import { drawAiChip, drawDivider, duelZones, inZone, toLocal, zoneAt } from '../engine/layout.js';

const AI = [
  { reaction: [1.1, 1.8], accuracy: 0.65 },
  { reaction: [0.55, 0.95], accuracy: 0.85 },
  { reaction: [0.3, 0.55], accuracy: 0.97 },
];

const BINS = 3;
const SWIPE_MIN = 26;

export default class BubbleBlitz extends MiniGame {
  static meta = {
    id: 'bubble-blitz',
    title: 'Bubble Blitz',
    category: 'Dexterity',
    verb: 'swipe',
    layout: 'duel',
    seconds: 75,
    tint: '#4aa3c7',
    mascot: 'frog',
  };

  static icon(g, s) {
    g.fillStyle = '#e8f4f8';
    g.fillRect(0, 0, s, s);
    const cols = [0, 3, 1];
    cols.forEach((c, i) => {
      fillRR(g, s * (0.08 + i * 0.3), s * 0.7, s * 0.24, s * 0.22, s * 0.05, PALETTE[c].hex);
    });
    fillCircle(g, s * 0.32, s * 0.28, s * 0.15, PALETTE[3].hex);
    shapeGlyph(g, PALETTE[3].shape, s * 0.32, s * 0.28, s * 0.07, '#fff');
    fillCircle(g, s * 0.7, s * 0.46, s * 0.12, PALETTE[1].hex);
    shapeGlyph(g, PALETTE[1].shape, s * 0.7, s * 0.46, s * 0.055, '#fff');
  }

  constructor(env) {
    super(env);
    this.zones = duelZones(this.w, this.h);
    // Three of the six colours per round, so the bins differ every time.
    this.colours = env.rng.shuffle(PALETTE.map((p) => p.id)).slice(0, BINS);
    this.scores = [0, 0];
    /** @type {Array<Array<object>>} bubbles per half */
    this.bubbles = [[], []];
    this.spawnTimer = [0, 0];
    /** @type {Map<number, {player:number, bubble:object, sx:number, sy:number}>} */
    this.drags = new Map();
    this.aiSpec = byTier(AI, env.difficulty);
    this.flash = [0, 0];
  }

  resize(w, h) {
    super.resize(w, h);
    this.zones = duelZones(w, h);
  }

  /* ------------------------------ helpers ----------------------------- */

  binRects(zone) {
    const h = Math.min(zone.h * 0.2, 90);
    const pad = 10;
    const w = (zone.w - pad * (BINS + 1)) / BINS;
    const out = [];
    for (let i = 0; i < BINS; i++) {
      out.push({ x: pad + i * (w + pad), y: zone.h - h - pad, w, h, colour: this.colours[i] });
    }
    return out;
  }

  spawnInterval() {
    const progress = 1 - this.timeLeft / this.constructor.meta.seconds;
    return 1.5 - progress * 0.95;
  }

  /* ------------------------------- loop ------------------------------- */

  update(dt) {
    if (this.over) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) return this.finish();

    for (let i = 0; i < 2; i++) {
      if (this.flash[i] > 0) this.flash[i] -= dt;
      this.updateHalf(i, dt);
    }
  }

  updateHalf(player, dt) {
    const zone = this.zones[player];
    const bins = this.binRects(zone);
    const list = this.bubbles[player];
    const isAi = this.env.mode === '1p' && player === 1;

    this.spawnTimer[player] -= dt;
    if (this.spawnTimer[player] <= 0) {
      this.spawnTimer[player] = this.spawnInterval() * this.env.rng.range(0.75, 1.25);
      this.spawn(player, zone, isAi);
    }

    const fallSpeed = zone.h * 0.1;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];

      if (b.flying) {
        b.flyT += dt * 3.4;
        if (b.flyT >= 1) list.splice(i, 1);
        continue;
      }

      if (!b.held) b.y += fallSpeed * dt;
      b.wobble += dt * 3;

      if (isAi) {
        b.aiTimer -= dt;
        if (b.aiTimer <= 0) this.sort(player, b, this.aiChoice(b), bins);
      }

      // A bubble that reaches the bin row without being sorted is simply
      // gone: a missed chance, never a punishment.
      if (b.y > bins[0].y - b.r * 0.4 && !b.flying) {
        list.splice(i, 1);
        continue;
      }
    }
  }

  spawn(player, zone, isAi) {
    const colour = this.env.rng.pick(this.colours);
    const r = Math.min(zone.w, zone.h) * 0.075;
    const bubble = {
      colour,
      r: Math.max(22, Math.min(r, 44)),
      x: this.env.rng.range(zone.w * 0.12, zone.w * 0.88),
      y: -r,
      wobble: this.env.rng.range(0, 6),
      held: false,
      flying: null,
      flyT: 0,
      aiTimer: isAi
        ? this.env.rng.range(this.aiSpec.reaction[0], this.aiSpec.reaction[1])
        : 0,
    };
    this.bubbles[player].push(bubble);
  }

  aiChoice(bubble) {
    const right = this.colours.indexOf(bubble.colour);
    if (this.env.rng.chance(this.aiSpec.accuracy)) return right;
    const wrong = [0, 1, 2].filter((i) => i !== right);
    return this.env.rng.pick(wrong);
  }

  /** Send a bubble to a bin and score it. */
  sort(player, bubble, binIndex, bins) {
    if (bubble.flying) return;
    const target = bins[binIndex];
    const correct = this.colours[binIndex] === bubble.colour;
    bubble.flying = { x: target.x + target.w / 2, y: target.y + target.h / 2, correct };
    bubble.flyT = 0;
    bubble.held = false;

    if (correct) {
      this.scores[player] += 1;
      if (player === 0 || this.env.mode === '2p') this.env.sfx.pop();
    } else {
      this.scores[player] = Math.max(0, this.scores[player] - 1);
      this.flash[player] = 0.3;
      if (player === 0 || this.env.mode === '2p') this.env.sfx.bad();
    }
  }

  finish() {
    const [a, b] = this.scores;
    this.end({
      scores: this.scores,
      winner: a === b ? null : a > b ? 0 : 1,
      stars: this.starsFor(a, b, 5),
    });
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
      // Grab the lowest bubble under the finger - the most urgent one.
      let found = null;
      for (const b of this.bubbles[zone.index]) {
        if (b.flying) continue;
        if (Math.hypot(b.x - local.x, b.y - local.y) <= b.r * 1.5) {
          if (!found || b.y > found.y) found = b;
        }
      }
      if (!found) return;
      found.held = true;
      this.drags.set(p.id, { player: zone.index, bubble: found, sx: local.x, sy: local.y });
      return;
    }

    const drag = this.drags.get(p.id);
    if (!drag) return;
    const zone = this.zones[drag.player];
    const local = toLocal(zone, p.x, p.y) || { x: drag.sx, y: drag.sy };

    if (p.type === 'move') {
      drag.bubble.x = local.x;
      drag.bubble.y = local.y;
      return;
    }

    // Release: the flick direction picks the bin.
    this.drags.delete(p.id);
    drag.bubble.held = false;
    const dx = local.x - drag.sx;
    const dy = local.y - drag.sy;
    if (Math.hypot(dx, dy) < SWIPE_MIN) return;

    const bins = this.binRects(zone);
    let index;
    if (Math.abs(dx) > Math.abs(dy)) index = dx < 0 ? 0 : 2;
    else index = dy > 0 ? 1 : this.nearestBin(drag.bubble.x, bins);
    this.sort(drag.player, drag.bubble, index, bins);
  }

  nearestBin(x, bins) {
    let best = 0;
    let bestD = Infinity;
    bins.forEach((b, i) => {
      const d = Math.abs(b.x + b.w / 2 - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /* ------------------------------ render ------------------------------ */

  render(g) {
    g.fillStyle = '#e8f4f8';
    g.fillRect(0, 0, this.w, this.h);
    for (const zone of this.zones) inZone(g, zone, (gg) => this.renderHalf(gg, zone));
    drawDivider(g, this.w, this.h);
    if (this.env.mode === '1p') drawAiChip(g, this.w);
  }

  renderHalf(g, zone) {
    const i = zone.index;
    const bins = this.binRects(zone);

    if (this.flash[i] > 0) {
      g.fillStyle = `rgba(232,69,60,${this.flash[i] * 0.35})`;
      g.fillRect(0, 0, zone.w, zone.h);
    }

    for (const bin of bins) {
      const c = PALETTE[bin.colour];
      fillRR(g, bin.x, bin.y + 5, bin.w, bin.h, 16, c.dark);
      fillRR(g, bin.x, bin.y, bin.w, bin.h, 16, c.hex);
      // The bin's shape is the real label - a pre-reader sorts by shape.
      shapeGlyph(g, c.shape, bin.x + bin.w / 2, bin.y + bin.h / 2,
        Math.min(bin.w, bin.h) * 0.3, 'rgba(255,255,255,0.9)');
    }

    for (const b of this.bubbles[i]) {
      const c = PALETTE[b.colour];
      let { x, y } = b;
      let scale = 1;
      if (b.flying) {
        const t = Math.min(1, b.flyT);
        x = b.x + (b.flying.x - b.x) * t;
        y = b.y + (b.flying.y - b.y) * t;
        scale = 1 - t * 0.85;
        g.globalAlpha = 1 - t * 0.5;
      } else {
        x += Math.sin(b.wobble) * 3;
      }
      const r = b.r * scale;
      fillCircle(g, x, y + r * 0.18, r, 'rgba(32,49,58,0.1)');
      fillCircle(g, x, y, r, c.hex);
      fillCircle(g, x - r * 0.3, y - r * 0.34, r * 0.26, 'rgba(255,255,255,0.5)');
      shapeGlyph(g, c.shape, x, y, r * 0.44, 'rgba(255,255,255,0.92)');
      g.globalAlpha = 1;
      if (b.held) {
        g.beginPath();
        g.arc(x, y, r + 7, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(32,49,58,0.35)';
        g.lineWidth = 3;
        g.stroke();
      }
    }

    // The HUD sits beside the bins, at this player's own edge of the
    // tablet. Putting it at the top of the half would stack both players'
    // numbers on the divider, each unreadable from the other side.
    const hudY = bins[0].y - 20;
    // The far half's HUD would be drawn upside down to the human sitting
    // at the near edge; the upright AI chip carries that information instead.
    if (this.env.mode === '1p' && zone.index === 1) return;
    text(g, String(this.scores[i]), 22, hudY, 26, { fill: PLAYER[i].dark, align: 'left' });
    text(g, String(Math.ceil(Math.max(0, this.timeLeft))), zone.w - 22, hudY, 20,
      { fill: '#5b7480', align: 'right' });
  }
}
