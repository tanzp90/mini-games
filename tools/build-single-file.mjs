/**
 * Build a single self-contained HTML file containing the whole arcade.
 *
 * The app normally ships as separate ES modules, which is the right shape
 * for a repo but needs a web server. This flattens it into one file that
 * plays from anywhere - a hosted page, a shared link, an email attachment -
 * by bundling the modules with esbuild and inlining the stylesheet.
 *
 *   node tools/build-single-file.mjs [outfile]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'dist', 'animal-arcade.html');

const tmp = mkdtempSync(join(tmpdir(), 'arcade-'));
const bundlePath = join(tmp, 'bundle.js');

// Run the esbuild launcher from .bin: the file under esbuild/bin is a
// platform binary in some installs, not a script node can execute.
execFileSync(join(root, 'node_modules', '.bin', 'esbuild'), [
  join(root, 'src', 'main.js'),
  '--bundle',
  '--format=esm',
  '--target=es2022',
  `--outfile=${bundlePath}`,
], { stdio: 'inherit' });

const bundle = readFileSync(bundlePath, 'utf8');

// Note: the app registers its service worker only when a manifest link is
// present, and this build emits none, so offline caching switches itself
// off here without the build having to edit generated code.

const css = readFileSync(join(root, 'styles.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// Inline the app icon too, so the standalone file is genuinely
// self-contained: without it every host it lands on logs a favicon 404.
const icon = readFileSync(join(root, 'icon.svg')).toString('base64');

const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
if (!bodyMatch) throw new Error('could not find the body markup in index.html');
const body = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();
if (/<link[^>]+rel="manifest"/.test(body)) {
  throw new Error('the manifest link must stay in <head>, or offline caching will not switch off');
}

const page = `<title>Animal Arcade</title>
<link rel="icon" href="data:image/svg+xml;base64,${icon}">
<style>
${css}
</style>

${body}

<script type="module">
${bundle}
</script>
`;

writeFileSync(out, page);
const kb = (Buffer.byteLength(page) / 1024).toFixed(0);
console.log(`wrote ${out} (${kb} KB)`);
