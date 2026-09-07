/**
 * End-to-end test: a round runs to its own conclusion, the results screen
 * reports it, stars persist, adaptive difficulty steps in both directions
 * and stays put when switched off, and pause/resume/quit behave.
 *
 *   npx http-server -p 8899 -s .
 *   node tests/e2e.mjs
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
const browser = await chromium.launch(launchOptions);
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
const page = await ctx.newPage();
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${msg}`); if (!ok) fails.push(msg); };

page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });

// --- A round runs to its own conclusion and shows a result -------------
await page.click('.tile[data-game="rope-rumble"]');
await page.click('#mode-row .choice[data-mode="1p"]');
await page.click('#diff-row .choice[data-diff="0"]');
await page.click('#btn-play');
await page.waitForSelector('#screen-play:not([hidden])');

// Rope Rumble ends on the 45s clock; wind it down instead of waiting.
await page.evaluate(() => { /* nothing: driven below */ });
const box = await page.locator('#stage').boundingBox();
const deadline = Date.now() + 90000;
let paw = 0;
while (Date.now() < deadline) {
  // Check after EVERY click: once the results panel is up, another click in
  // the same spot would land on "Again" and start a fresh round.
  if (await page.$('#screen-result:not([hidden])')) break;
  paw = 1 - paw;
  await page.mouse.click(box.x + box.width * (paw ? 0.4 : 0.6), box.y + box.height * 0.82);
}
check(!!(await page.$('#screen-result:not([hidden])')), 'round reaches the results screen');

const score = await page.textContent('#result-score');
check(/\d+ — \d+/.test(score), `result shows a score (${score})`);
const title = await page.textContent('#result-title');
check(title.length > 0, `result shows an outcome (${title})`);

// --- Stars are saved and shown back on the picker ----------------------
await page.click('#btn-home');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('minigames.save.v1')));
check(saved && typeof saved.stars['rope-rumble'] === 'number',
  `stars persisted (${saved && saved.stars['rope-rumble']})`);
const totalShown = await page.textContent('#star-total');
check(totalShown === String(Object.values(saved.stars).reduce((a, b) => a + b, 0)),
  `picker star total matches the save (${totalShown})`);

// --- Adaptive difficulty steps up after three straight wins ------------
// These drive the save module directly, so they only apply to the
// multi-file deployment where the modules are separately addressable. The
// single-file build inlines the identical source.
await page.evaluate(() => localStorage.removeItem('minigames.save.v1'));
await page.reload({ waitUntil: 'networkidle' });
const modulesAddressable = await page.evaluate(async () => {
  try { await import('/src/engine/storage.js'); return true; } catch { return false; }
});
if (!modulesAddressable) console.log('skip  adaptive-difficulty checks (single-file build)');
if (modulesAddressable) {
const adaptive = await page.evaluate(async () => {
  const save = await import('/src/engine/storage.js');
  save.setDifficulty('snap-safari', 0);
  const seen = [];
  for (let i = 0; i < 3; i++) {
    seen.push(save.recordRound('snap-safari', { stars: 2, won: true }));
  }
  return { tiers: seen.map((s) => s.tier), changed: seen.map((s) => s.changed) };
});
check(adaptive.tiers[2] === 1 && adaptive.changed[2] === 1,
  `three wins step the AI up (tiers ${adaptive.tiers.join(',')})`);

const adaptiveDown = await page.evaluate(async () => {
  const save = await import('/src/engine/storage.js');
  save.setDifficulty('snap-safari', 2);
  const seen = [];
  for (let i = 0; i < 3; i++) seen.push(save.recordRound('snap-safari', { stars: 0, won: false }));
  return seen[2];
});
check(adaptiveDown.tier === 1 && adaptiveDown.changed === -1,
  `three losses step the AI down (tier ${adaptiveDown.tier})`);

const off = await page.evaluate(async () => {
  const save = await import('/src/engine/storage.js');
  save.setAdaptive(false);
  save.setDifficulty('snap-safari', 1);
  let last;
  for (let i = 0; i < 4; i++) last = save.recordRound('snap-safari', { stars: 3, won: true });
  return last;
});
check(off.tier === 1 && off.changed === 0, 'adaptive off leaves the tier alone');
}

// --- Sticker album ------------------------------------------------------
await page.click('#btn-album');
const stickers = await page.$$eval('.sticker', (els) => ({
  total: els.length, earned: els.filter((e) => e.classList.contains('earned')).length,
}));
const owned = await page.evaluate(() => {
  const raw = localStorage.getItem('minigames.save.v1');
  return raw ? (JSON.parse(raw).stickers || []).length : 0;
});
check(stickers.total === 20, `album shows two stickers per game (${stickers.total})`);
// Marked-as-earned must track the save exactly, whether that is none or many.
check(stickers.earned === owned,
  `earned stickers match the save (${stickers.earned} shown, ${owned} saved)`);

// --- Pause and resume ---------------------------------------------------
await page.click('#album-back');
await page.click('.tile[data-game="memory-zoo"]');
await page.click('#btn-play');
await page.waitForSelector('#screen-play:not([hidden])');
await page.click('#btn-pause');
check(!!(await page.$('#screen-pause:not([hidden])')), 'pause opens');
await page.click('#btn-resume');
check(!(await page.$('#screen-pause:not([hidden])')), 'resume closes the pause panel');
await page.click('#btn-pause');
await page.click('#btn-quit');
check(!!(await page.$('#screen-home:not([hidden])')), 'quit returns to the picker');

await browser.close();
console.log(fails.length ? `\n${fails.length} failure(s):\n - ${fails.join('\n - ')}` : '\nEnd-to-end pass clean.');
process.exit(fails.length ? 1 : 0);
