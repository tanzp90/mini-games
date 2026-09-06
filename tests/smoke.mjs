/**
 * Smoke test: open every game in landscape, portrait and two-player, poke at
 * the board at random, and fail on any runtime error.
 *
 * Thirty configurations in all. Run a static server on port 8899 first:
 *   npx http-server -p 8899 -s .
 *   node tests/smoke.mjs
 */
import { chromium } from 'playwright';

/**
 * Launch options.
 *
 * Playwright normally finds its own browser download. Some sandboxes ship a
 * preinstalled Chromium whose build number does not match the pinned
 * Playwright version, so CHROMIUM_PATH lets the caller point at it directly:
 *
 *   CHROMIUM_PATH=/path/to/chrome node tests/smoke.mjs
 */
const launchOptions = process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH }
  : {};


const BASE = process.env.BASE || 'http://127.0.0.1:8899';
const GAMES = ['snap-safari','memory-zoo','ice-cracker','rope-rumble','star-maze',
  'bubble-blitz','penguin-slide','colour-splash','treasure-reef','loop-the-line'];

const problems = [];
const browser = await chromium.launch(launchOptions);

/** Play one game for a while, poking at the canvas, and collect any errors. */
async function run(gameId, mode, difficulty, viewport) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${gameId}/${mode}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${gameId}/${mode} console: ${m.text()}`);
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click(`.tile[data-game="${gameId}"]`);
  await page.click(`#mode-row .choice[data-mode="${mode}"]`);
  if (mode === '1p') await page.click(`#diff-row .choice[data-diff="${difficulty}"]`);
  await page.click('#btn-play');
  await page.waitForSelector('#screen-play:not([hidden])');

  const box = await page.locator('#stage').boundingBox();
  // Random pokes and drags all over the board, in both halves.
  for (let i = 0; i < 45; i++) {
    const x = box.x + box.width * (0.08 + Math.random() * 0.84);
    const y = box.y + box.height * (0.08 + Math.random() * 0.84);
    if (i % 4 === 3) {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + (Math.random() - 0.5) * 220, y + (Math.random() - 0.5) * 220, { steps: 6 });
      await page.mouse.up();
    } else {
      await page.mouse.click(x, y);
    }
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(600);

  const state = await page.evaluate(() => ({
    screens: [...document.querySelectorAll('[data-screen]')]
      .filter((s) => !s.hidden).map((s) => s.dataset.screen),
  }));

  await ctx.close();
  return { errors, state };
}

for (const gameId of GAMES) {
  for (const [mode, diff, vp, label] of [
    ['1p', 0, { width: 1180, height: 820 }, 'landscape turtle'],
    ['1p', 2, { width: 820, height: 1180 }, 'portrait rocket'],
    ['2p', 1, { width: 1180, height: 820 }, 'landscape two-player'],
  ]) {
    const { errors, state } = await run(gameId, mode, diff, vp);
    const tag = `${gameId} ${label}`;
    if (errors.length) {
      problems.push(...errors.slice(0, 3));
      console.log(`FAIL  ${tag}  -> ${errors[0]}`);
    } else {
      console.log(`ok    ${tag}  [${state.screens.join(',')}]`);
    }
  }
}

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll games ran clean.');
process.exit(problems.length ? 1 : 0);
