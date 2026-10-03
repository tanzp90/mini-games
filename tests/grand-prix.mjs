/**
 * Mini Grand Prix: drive the menus, then let the steering helper race one
 * lap of every track with nobody touching the screen. Fails on any runtime
 * error, or if the car does not reach the flag.
 *
 * The game is one file with no modules, so no server is needed:
 *   node tests/grand-prix.mjs
 *
 * SHOTS=/some/dir also saves a screenshot of each screen.
 * CHROMIUM_PATH works as in tests/smoke.mjs.
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_ = process.env.GP_URL || pathToFileURL(join(root, 'grand-prix', 'index.html')).href;
const SHOTS = process.env.SHOTS;
const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

const problems = [];
const browser = await chromium.launch(launchOptions);

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

async function run(label, viewport, track, car) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${label}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${label} console: ${m.text()}`); });
  await page.goto(URL_);
  await page.waitForTimeout(400);
  await shot(page, `${label}-1-title`);

  await page.click('#b-play');
  await page.click(`#car-row .car-tile:nth-child(${car + 1})`);
  await page.waitForTimeout(300);
  await shot(page, `${label}-2-cars`);

  await page.click('#b-car-next');
  await page.click(`#track-row .track-card:nth-child(${track + 1})`);
  await page.click('#seg-laps button[data-v="1"]');
  await page.waitForTimeout(300);
  await shot(page, `${label}-3-tracks`);

  await page.click('#b-race');
  await shot(page, `${label}-4-howto`);
  await page.click('#b-howto-go');
  await page.waitForTimeout(2600);
  await shot(page, `${label}-5-lights`);
  await page.waitForTimeout(3500);
  await shot(page, `${label}-6-race`);

  // Tap the right half briefly to prove steering reaches the car.
  const before = await page.evaluate(() => miniGP.G.player.h);
  const box = { x: viewport.width * 0.85, y: viewport.height * 0.8 };
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.waitForTimeout(500);
  const pressed = await page.evaluate(() => document.querySelector('#sb-right').classList.contains('on'));
  await page.mouse.up();
  const after = await page.evaluate(() => miniGP.G.player.h);
  if (!pressed || after - before < 0.2) problems.push(`${label}: steering right did not turn the car (${before.toFixed(2)} -> ${after.toFixed(2)})`);
  await page.waitForTimeout(6000);
  await shot(page, `${label}-7-corner`);

  // Hands off: the helper should bring the car home.
  try {
    await page.waitForSelector('#s-results:not([hidden])', { timeout: 120000 });
  } catch {
    const st = await page.evaluate(() => ({ mode: miniGP.G.mode, lap: miniGP.G.player.lap, prog: Math.round(miniGP.G.player.prog), L: miniGP.G.T.L }));
    problems.push(`${label}: no finish within 2 minutes ${JSON.stringify(st)}`);
  }
  await page.waitForTimeout(600);
  await shot(page, `${label}-8-results`);
  const res = await page.evaluate(() => miniGP.G.result);
  console.log(`${label}: ${res ? `P${res.pos} in ${res.time.toFixed(1)}s, ${res.pts} pts` : 'did not finish'}`);
  await ctx.close();
}

await run('park-landscape', { width: 1180, height: 820 }, 0, 0);
await run('city-portrait', { width: 820, height: 1180 }, 1, 2);
await run('snow-landscape', { width: 1024, height: 768 }, 2, 4);
await browser.close();

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('grand prix: all good');
