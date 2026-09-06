/**
 * Offline cache.
 *
 * A tablet game collection for children has to work on a plane, in a car and
 * in a waiting room, so the whole app is precached on first load. Everything
 * here is a static file - there is no network traffic at runtime at all.
 */

const CACHE = 'animal-arcade-v1';

const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'src/main.js',
  'src/engine/ai.js',
  'src/engine/animals.js',
  'src/engine/audio.js',
  'src/engine/draw.js',
  'src/engine/game.js',
  'src/engine/input.js',
  'src/engine/layout.js',
  'src/engine/loop.js',
  'src/engine/rng.js',
  'src/engine/storage.js',
  'src/ui/icons.js',
  'src/games/index.js',
  'src/games/snap-safari.js',
  'src/games/colour-splash.js',
  'src/games/memory-zoo.js',
  'src/games/star-maze.js',
  'src/games/bubble-blitz.js',
  'src/games/rope-rumble.js',
  'src/games/treasure-reef.js',
  'src/games/ice-cracker.js',
  'src/games/loop-the-line.js',
  'src/games/penguin-slide.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // A single missing file must not stop the rest being cached.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
      }
      return res;
    }).catch(() => caches.match('index.html'))),
  );
});
