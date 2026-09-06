/**
 * Difficulty-ladder test.
 *
 * The central design claim of this collection is that Turtle, Rabbit and
 * Rocket differ along a real algorithmic axis rather than by injected
 * randomness. This drives the AI logic directly - no canvas involved - and
 * measures whether the ladders actually come out monotonic.
 *
 *   node tests/ai-strength.mjs
 */
import { Rng } from '../src/engine/rng.js';
import { __internals as CS } from '../src/games/colour-splash.js';
import TreasureReef from '../src/games/treasure-reef.js';
import MemoryZoo from '../src/games/memory-zoo.js';

const noop = new Proxy({}, { get: () => () => {} });
const env = (seed, difficulty, mode = '1p') => ({
  w: 900, h: 700, rng: new Rng(seed), mode, difficulty,
  portrait: false, sfx: noop, finish: () => {},
});

/* ---------------- Colour Splash: tier vs tier match-ups ---------------- */

function splashMatch(seed, tierA, tierB) {
  const rng = new Rng(seed);
  const s = CS.newBoard(rng);
  const depth = [1, 1, 3];
  for (let move = 0; move < 120; move++) {
    for (const [player, tier] of [[0, tierA], [1, tierB]]) {
      const counts = CS.tileCounts(s);
      if (counts[0] + counts[1] === 121 || counts[0] > 60.5 || counts[1] > 60.5) {
        return counts[0] === counts[1] ? -1 : counts[0] > counts[1] ? 0 : 1;
      }
      const c = CS.chooseColour(s, player, tier, depth[tier], rng);
      if (c < 0) continue;
      CS.applyMove(s, player, c);
    }
  }
  const counts = CS.tileCounts(s);
  return counts[0] === counts[1] ? -1 : counts[0] > counts[1] ? 0 : 1;
}

console.log('Colour Splash — 200 games per pairing, higher tier plays as player 0');
for (const [hi, lo, name] of [[1, 0, 'Rabbit vs Turtle'], [2, 1, 'Rocket vs Rabbit'], [2, 0, 'Rocket vs Turtle']]) {
  let wins = 0;
  for (let i = 0; i < 200; i++) if (splashMatch(1000 + i, hi, lo) === 0) wins++;
  console.log(`  ${name.padEnd(20)} ${(wins / 2).toFixed(1)}% win rate for the stronger tier`);
}

/* -------- Treasure Reef: digs needed to sink all three chests --------- */

console.log('\nTreasure Reef — mean digs to sink all 3 chests (36 squares, lower is stronger)');
for (const tier of [0, 1, 2]) {
  let total = 0;
  const runs = 150;
  for (let i = 0; i < runs; i++) {
    const g = new TreasureReef(env(2000 + i, tier));
    g.phase = 'play';
    g.turn = 1;
    let digs = 0;
    while (!g.over && digs < 36) {
      g.turn = 1;
      const cell = g.aiPick();
      if (cell < 0) break;
      g.dig(cell);
      digs++;
    }
    total += digs;
  }
  console.log(`  ${['Turtle', 'Rabbit', 'Rocket'][tier].padEnd(8)} ${(total / runs).toFixed(1)} digs`);
}

/* --------------- Memory Zoo: pairs the AI finds unaided --------------- */

console.log('\nMemory Zoo — AI-only play, mean flips per pair found (lower is stronger)');
for (const tier of [0, 1, 2]) {
  let flips = 0;
  let pairs = 0;
  const runs = 120;
  for (let i = 0; i < runs; i++) {
    const g = new MemoryZoo(env(3000 + i, tier));
    const originalFlip = g.flip.bind(g);
    g.flip = (idx) => { flips++; originalFlip(idx); };
    let guard = 0;
    while (!g.over && guard++ < 600) {
      // Clear a pending miss BEFORE claiming the turn, so every flip in
      // this harness is attributed to the AI.
      if (g.hideTimer > 0) g.resolveMiss();
      g.turn = 1;
      g.aiMove();
      g.thinker.update(99);
      if (g.picked.length === 2) g.hideTimer = 0.001;
    }
    pairs += g.pairs[1].length;
  }
  console.log(`  ${['Turtle', 'Rabbit', 'Rocket'][tier].padEnd(8)} ${(flips / Math.max(1, pairs)).toFixed(2)} flips per pair  (${pairs} pairs over ${runs} boards)`);
}
