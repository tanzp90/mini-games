# Animal Arcade

Ten mini games for **one or two players, age five and up**, built for a tablet.

The design brief, the ten concepts and the reasoning behind them are in
[`docs/GAME_CONCEPTS.md`](docs/GAME_CONCEPTS.md).

## Running it

There is no build step. Serve the folder with any static server and open it:

```sh
npx http-server -p 8080 .   # then open http://localhost:8080
```

Opening `index.html` straight off the filesystem will not work, because the
app is made of ES modules and browsers block those over `file://`.

## The games

| Game | Category | Gesture | Two players |
|---|---|---|---|
| Snap Safari | Reaction | tap | duel |
| Memory Zoo | Memory | tap | shared board |
| Ice Cracker | Push your luck | tap | shared board |
| Rope Rumble | Dexterity | fast tap | duel |
| Star Maze Dash | Dexterity | drag | shared board |
| Bubble Blitz | Dexterity | swipe | duel |
| Penguin Slide | Aim & physics | pull back | shared board |
| Colour Splash | Strategy | tap | shared board |
| Treasure Reef | Hidden information | tap | shared board |
| Loop the Line | Puzzle race | trace | duel |

Every game plays solo against an AI with three settings — turtle, rabbit,
rocket — and each ladder maps onto a real algorithmic axis rather than
injected randomness:

| Game | What difficulty actually changes |
|---|---|
| Snap Safari | reaction-time distribution and miss rate |
| Memory Zoo | size and fidelity of the AI's memory |
| Ice Cracker | risk threshold, and whether the odds are tracked at all |
| Rope Rumble | tap rate and cue accuracy |
| Star Maze Dash | pathfinding horizon, movement speed, contest prediction |
| Bubble Blitz | sorting throughput and accuracy |
| Penguin Slide | aiming error and shot selection (Rocket simulates its shots) |
| Colour Splash | search depth (greedy → 3-ply negamax with denial) |
| Treasure Reef | random → parity hunt/target → probability-density heatmap |
| Loop the Line | solve time as a multiple of the puzzle's measured par |

Adaptive difficulty is on by default: three wins in a row steps the opponent
up, three losses steps it down. It can be switched off in settings.

## How it is built

- **No build step, no dependencies, no framework.** Plain ES modules and
  Canvas 2D. `index.html` is the app.
- **Nothing is loaded.** Every animal, tile and menu illustration is drawn
  procedurally on canvas, and every sound is synthesised with WebAudio, so
  there are no image or audio files anywhere.
- **Offline.** A service worker precaches the whole app on first load.
- **Local only.** No network, no accounts, no analytics, no ads, no
  purchases. Stars and stickers live in `localStorage` on the device.

```
index.html          shell markup: picker, setup, play, results, album, settings
styles.css          shell styling; nothing interactive under 64px
sw.js               offline precache
src/main.js         screen routing and the round lifecycle
src/engine/         loop, input, audio, rng, storage, layout, drawing, animals, AI helpers
src/ui/icons.js     menu artwork
src/games/          one module per game, all implementing the same interface
```

Each game implements the interface in `src/engine/game.js`:
`init` via the constructor, then `update(dt)`, `render(ctx)`, `pointer(evt)`
and a single call to `end(result)`. The shell owns the pause button, the time
bar, the results panel, stars and stickers, which is what keeps ten games to
one codebase.

## Verifying changes

`jsconfig.json` turns on editor type checking against the JSDoc annotations.
There is no test runner in the repo; the checks used during development were
a headless browser pass over every game in landscape, portrait and
two-player, and a set of AI-versus-AI runs confirming each difficulty ladder
is monotonic.
