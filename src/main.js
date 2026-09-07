/**
 * Animal Arcade shell: picker, setup, round lifecycle, results, album.
 *
 * The shell owns everything that is the same in all ten games - the pause
 * button, the time bar, the results panel, stars and stickers - so a game
 * module only has to draw itself and answer a finger.
 */

import { GAMES, byId } from './games/index.js';
import { Input } from './engine/input.js';
import { Loop } from './engine/loop.js';
import { Rng, dailySeed } from './engine/rng.js';
import { sfx, unlock } from './engine/audio.js';
import * as save from './engine/storage.js';
import { drawBrand, drawChoiceArt, drawResultArt, drawSticker, prep } from './ui/icons.js';

const $ = (id) => document.getElementById(id);

const screens = {};
for (const el of document.querySelectorAll('[data-screen]')) screens[el.dataset.screen] = el;

/** Screens that sit on top of the play screen rather than replacing it. */
const OVERLAYS = new Set(['pause', 'result']);

let current = 'home';

function show(name) {
  for (const key of Object.keys(screens)) {
    if (OVERLAYS.has(key)) {
      screens[key].hidden = key !== name;
    } else if (name === 'pause' || name === 'result') {
      // Keep the board visible behind an overlay.
      screens[key].hidden = key !== 'play';
    } else {
      screens[key].hidden = key !== name;
    }
  }
  current = name;
  updateRotateHint();
}

/* ------------------------------------------------------------------ *
 * Round state
 * ------------------------------------------------------------------ */

/** @type {import('./engine/game.js').MiniGame|null} */
let game = null;
let loop = null;
let input = null;
let ctx = null;
let selectedId = null;
let mode = '1p';
let difficulty = 1;
let lastResult = null;

const stage = /** @type {HTMLCanvasElement} */ ($('stage'));

function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

function sizeStage() {
  const rect = screens.play.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  stage.width = Math.round(w * dpr);
  stage.height = Math.round(h * dpr);
  ctx = stage.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

function startRound(seed) {
  const Game = byId(selectedId);
  if (!Game) return;

  teardown();
  show('play');

  const { w, h } = sizeStage();
  const env = {
    w,
    h,
    rng: new Rng(seed == null ? Math.floor(Math.random() * 0xffffffff) : seed),
    mode,
    difficulty,
    portrait: isPortrait(),
    sfx,
    finish: onFinish,
  };
  game = new Game(env);
  game.seed = env.rng.seed;

  input = new Input(stage, (p) => {
    if (current === 'play' && game) game.pointer(p);
  });

  loop = new Loop(
    (dt) => {
      if (game && !game.over) game.update(dt);
      updateTimebar();
    },
    () => {
      if (!game || !ctx) return;
      ctx.save();
      game.render(ctx);
      ctx.restore();
    },
  );
  loop.start();
  updateTimebar();
}

function teardown() {
  if (loop) loop.stop();
  if (input) input.destroy();
  if (game) game.destroy();
  loop = null;
  input = null;
  game = null;
}

function updateTimebar() {
  const bar = $('timebar');
  if (!game || game.timeLeft < 0) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const total = game.constructor.meta.seconds || 1;
  const frac = Math.max(0, Math.min(1, game.timeLeft / total));
  $('timebar-fill').style.width = `${frac * 100}%`;
  bar.classList.toggle('low', game.timeLeft <= 10);
}

/* ------------------------------------------------------------------ *
 * Results
 * ------------------------------------------------------------------ */

/** @param {import('./engine/game.js').RoundResult} result */
function onFinish(result) {
  lastResult = result;
  if (loop) loop.stop();

  const won = mode === '1p' ? (result.winner === null ? null : result.winner === 0) : null;
  const record = save.recordRound(selectedId, { stars: result.stars, won });
  if (mode === '1p') difficulty = record.tier;

  const outcome = result.winner === null ? 'draw' : result.winner === 0 ? 'win' : 'lose';
  if (outcome === 'win') sfx.win();
  else if (outcome === 'lose') sfx.lose();
  else sfx.draw();

  const meta = byId(selectedId).meta;
  $('result-title').textContent =
    mode === '2p'
      ? outcome === 'draw' ? "It's a tie!" : `Player ${result.winner + 1} wins!`
      : outcome === 'win' ? 'You win!' : outcome === 'draw' ? "It's a tie!" : 'So close!';

  $('result-score').textContent = `${result.scores[0]} — ${result.scores[1]}`;

  const starEls = [0, 1, 2]
    .map((i) => `<i class="${i < result.stars ? 'on' : ''}"></i>`)
    .join('');
  $('result-stars').innerHTML = starEls;

  let note = '';
  if (mode === '1p' && record.changed > 0) note = 'Three wins in a row — the next one is tougher.';
  else if (mode === '1p' && record.changed < 0) note = 'The next opponent will go a bit easier.';
  else if (result.stars === 3) note = 'Gold sticker earned!';
  $('result-note').textContent = note;

  const g = prep($('result-art'), 320, 178);
  drawResultArt(g, 320, 178, outcome, meta.mascot || 'fox');

  refreshHome();
  show('result');
}

/* ------------------------------------------------------------------ *
 * Picker
 * ------------------------------------------------------------------ */

function buildPicker() {
  const wrap = $('picker');
  wrap.innerHTML = '';
  for (const Game of GAMES) {
    const meta = Game.meta;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    btn.dataset.game = meta.id;
    btn.innerHTML =
      `<canvas width="132" height="132"></canvas>` +
      `<span class="tile-name">${meta.title}</span>` +
      `<span class="tile-stars">${[0, 1, 2].map(() => '<i></i>').join('')}</span>`;
    btn.addEventListener('click', () => {
      unlock();
      sfx.select();
      openSetup(meta.id);
    });
    wrap.appendChild(btn);

    const g = prep(btn.querySelector('canvas'), 132, 132);
    Game.icon(g, 132);
  }
  refreshHome();
}

function refreshHome() {
  $('star-total').textContent = String(save.totalStars());
  for (const tile of document.querySelectorAll('.tile')) {
    const stars = save.getStars(tile.dataset.game);
    tile.querySelectorAll('.tile-stars i').forEach((el, i) => {
      el.classList.toggle('on', i < stars);
    });
  }
}

/* ------------------------------------------------------------------ *
 * Setup
 * ------------------------------------------------------------------ */

function openSetup(id) {
  selectedId = id;
  const Game = byId(id);
  const meta = Game.meta;
  difficulty = save.getDifficulty(id);

  $('setup-title').textContent = meta.title;
  $('setup-verb').textContent = `${meta.category} · ${meta.verb}`;
  Game.icon(prep($('setup-mark'), 96, 96), 96);

  setMode(mode);
  setDifficulty(difficulty);
  show('setup');
}

function setMode(m) {
  mode = m;
  for (const b of document.querySelectorAll('#mode-row .choice')) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === m));
  }
  $('difficulty-block').hidden = m !== '1p';
}

function setDifficulty(d) {
  difficulty = d;
  for (const b of document.querySelectorAll('#diff-row .choice')) {
    b.setAttribute('aria-pressed', String(Number(b.dataset.diff) === d));
  }
  if (selectedId) save.setDifficulty(selectedId, d);
}

/* ------------------------------------------------------------------ *
 * Album
 * ------------------------------------------------------------------ */

function openAlbum() {
  const owned = new Set(save.stickers());
  const grid = $('album-grid');
  grid.innerHTML = '';
  for (const Game of GAMES) {
    const meta = Game.meta;
    for (const gold of [false, true]) {
      const key = gold ? `${meta.id}.gold` : meta.id;
      const earned = owned.has(key);
      const cell = document.createElement('div');
      cell.className = `sticker${earned ? ' earned' : ''}${gold ? ' gold' : ''}`;
      cell.innerHTML = `<canvas width="78" height="78"></canvas><span>${meta.title}${gold ? ' ★' : ''}</span>`;
      grid.appendChild(cell);
      const g = prep(cell.querySelector('canvas'), 78, 78);
      drawSticker(g, 78, gold, (gg, s) => Game.icon(gg, s));
    }
  }
  show('album');
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

function openSettings() {
  $('opt-sound').checked = save.isSoundOn();
  $('opt-adaptive').checked = save.isAdaptive();
  show('settings');
}

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

function updateRotateHint() {
  const hint = $('rotate-hint');
  const Game = selectedId ? byId(selectedId) : null;
  hint.hidden = !(
    current === 'setup' &&
    mode === '2p' &&
    Game &&
    Game.meta.layout === 'duel' &&
    isPortrait()
  );
}

function bind() {
  $('setup-back').addEventListener('click', () => { sfx.tap(); show('home'); });
  $('album-back').addEventListener('click', () => { sfx.tap(); show('home'); });
  $('settings-back').addEventListener('click', () => { sfx.tap(); show('home'); });
  $('btn-album').addEventListener('click', () => { unlock(); sfx.tap(); openAlbum(); });
  $('btn-settings').addEventListener('click', () => { unlock(); sfx.tap(); openSettings(); });

  for (const b of document.querySelectorAll('#mode-row .choice')) {
    b.addEventListener('click', () => { sfx.tap(); setMode(b.dataset.mode); updateRotateHint(); });
  }
  for (const b of document.querySelectorAll('#diff-row .choice')) {
    b.addEventListener('click', () => { sfx.tap(); setDifficulty(Number(b.dataset.diff)); });
  }

  $('btn-play').addEventListener('click', () => { unlock(); sfx.select(); startRound(); });

  $('btn-pause').addEventListener('click', () => {
    if (!game) return;
    sfx.tap();
    if (loop) loop.stop();
    show('pause');
  });
  $('btn-resume').addEventListener('click', () => {
    sfx.tap();
    show('play');
    if (loop) loop.start();
  });
  $('btn-restart').addEventListener('click', () => { sfx.select(); startRound(); });
  $('btn-quit').addEventListener('click', () => { sfx.tap(); teardown(); show('home'); });

  $('btn-again').addEventListener('click', () => { sfx.select(); startRound(); });
  $('btn-home').addEventListener('click', () => { sfx.tap(); teardown(); show('home'); });

  $('opt-sound').addEventListener('change', (e) => {
    save.setSound(e.target.checked);
    if (e.target.checked) { unlock(); sfx.good(); }
  });
  $('opt-adaptive').addEventListener('change', (e) => save.setAdaptive(e.target.checked));
  $('opt-reset').addEventListener('click', () => {
    if (confirm('Erase every star and sticker on this tablet?')) {
      save.resetAll();
      refreshHome();
      sfx.bad();
    }
  });

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // Pausing when the tablet is put down avoids a round quietly running out.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && current === 'play' && game && !game.over) {
      if (loop) loop.stop();
      show('pause');
    }
  });
}

let resizeTimer = 0;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    updateRotateHint();
    if (!game || current === 'home') return;
    const { w, h } = sizeStage();
    game.env.portrait = isPortrait();
    game.resize(w, h);
  }, 80);
}

function boot() {
  drawBrand(prep($('brand-mark'), 60, 60), 60);
  for (const c of document.querySelectorAll('.choice-art')) {
    drawChoiceArt(prep(c, 96, 70), c.dataset.art, 96, 70);
  }
  buildPicker();
  bind();
  show('home');

  // The single-file build (tools/build-single-file.mjs) inlines everything
  // into one page and ships no manifest or sw.js, so the presence of the
  // manifest link is what distinguishes the installable multi-file
  // deployment from it. Registering a service worker that is not there
  // would only produce a 404.
  const installable = document.querySelector('link[rel="manifest"]');
  if (installable && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* Offline caching is a bonus; the app runs without it. */
      });
    });
  }
}

// Exposed so the daily-challenge entry point can seed every game alike.
window.__dailySeed = dailySeed;

boot();
