# Tablet Mini-Games — Concept Proposal

**Status:** Approved. All five decisions settled — see section 5. Implementation in progress.
**Audience:** 1–2 players, age 5+ (assume the 5-year-old cannot read).
**Platform:** Tablet-first web app (touch only), portrait + landscape, offline-capable.

---

## 1. Design rules that apply to all 10 games

These are the constraints every game is held to. They matter more than any individual concept.

| Rule | What it means concretely |
|---|---|
| **No reading required** | Every instruction is an icon, a colour, a sound, or a 3-second looping animated demo shown on the game's start screen. Text is decoration for adults, never load-bearing. |
| **One input verb per game** | Each game uses exactly one of: tap, drag, swipe, trace, or fast-tap. A child learns the whole game in one gesture. |
| **5-second learn** | The demo loop shows the entire ruleset. If it can't, the game is cut. |
| **Big targets** | Minimum touch target 64 CSS px, 88 px for primary actions. Nothing within 24 px of a screen edge (palm rejection + iPad gesture zones). |
| **Short rounds** | 60–150 seconds. Long enough to matter, short enough to say "one more". |
| **No losing screen** | Rounds end on a result, then straight to a big Play Again button. No "Game Over", no shaming, no red X sounds. |
| **Colour is never the only signal** | Every colour is paired with a shape (circle / square / triangle / star). Colour-blind safe and easier for young players. |
| **Pause anywhere** | Single always-present pause button; nothing is lost. |
| **60 fps floor** | Target device: iPad 7th gen / mid-range Android tablet. |

### Two-player = one tablet, two ways

- **Duel layout** (real-time games): landscape, screen split down the middle, the far player's UI rotated 180° so both sit across the tablet. Independent touch zones, no turn-taking.
- **Shared board** (turn-based games): one board, tablet flat between players, a coloured glow around the edge shows whose turn it is. An animated arrow points at the active player's side.

### Single player = the same game vs. AI

Every game is playable solo against an AI opponent that occupies the second player's slot. **No solo-only game modes** — this keeps the game count at 10 real games rather than 20 half-games, and means a child never has to relearn anything when a sibling joins.

### The three difficulty settings

Chosen with three icons, no words: 🐢 **Turtle** / 🐰 **Rabbit** / 🚀 **Rocket**. Remembered per-game.

The core principle: **easy AI is slower and more short-sighted, never randomly broken.** An AI that plays obvious nonsense reads as "the game is stupid" to a 5-year-old and kills replay value. So difficulty is modelled as:

- **Reaction games** → reaction-time distribution (never faster than a plausible human floor, ~330 ms).
- **Strategy games** → search depth and horizon.
- **Memory games** → size and fidelity of the AI's memory buffer.
- **Dexterity games** → speed multiplier and error rate.

Plus one global option, **Auto (adaptive)**: after 3 straight wins the AI nudges up one notch's worth of parameters; after 3 straight losses, down. Off by default, recommended on for mixed-age households.

### Replayability engine (shared across all 10)

1. **Procedural setup** — every round generates a new board, maze, puzzle, or card layout from a seed. No memorised solutions.
2. **Three-star scoring** per round, per game, so there's a target above simply winning.
3. **Sticker album meta-layer** — winning rounds earns stickers for a shared album. Purely cosmetic, no currency, no purchases, no ads.
4. **Daily seed** — one shared "today's challenge" layout across all games, so returning tomorrow is materially different.

---

## 2. The 10 games

Balance across categories: 3 real-time dexterity, 4 turn-based strategy, 1 memory, 1 push-your-luck, 1 puzzle race.

---

### 1. Snap Safari — *reaction*
**Verb:** tap · **2P layout:** duel · **Round:** ~75 s

Animal cards flip up in the centre one at a time. When two cards showing the **same animal** are face-up, the first player to slam their big paw button scores. Tap when there's no match and you lose a point's worth of ground.

- **Replay:** deck shuffled every round; match frequency and flip speed ramp within a round.
- **Age-5 fit:** pure pattern recognition, the single most accessible mechanic in the set. This is the "first game" for a new player.
- **AI:** reaction time drawn from a normal distribution + a false-positive rate.
  - 🐢 μ=1100 ms, σ=250, misses ~25% of matches entirely
  - 🐰 μ=650 ms, σ=150, misses ~8%
  - 🚀 μ=380 ms, σ=80, misses ~2% (floor clamped at 330 ms — a fast 8-year-old can still beat it)

---

### 2. Colour Splash — *strategy*
**Verb:** tap · **2P layout:** shared board · **Round:** ~90 s

An 11x11 grid of coloured, shaped tiles. You own the bottom-left corner, your opponent the top-right. On your turn, tap one of six colours from the palette bar: your whole territory flips to that colour and swallows every touching tile that already was it. You cannot take the colour your opponent is currently wearing. First past half the board wins.

- **Replay:** the grid is generated fresh each round, and the endgame is different every time because territory shape — not size — decides who can still grow.
- **Age-5 fit:** the entire decision is "which of these six colours", presented as six big buttons. A child who simply picks the colour that grabs the most tiles plays a respectable game, and the flood animation is its own reward.
- **AI:**
  - Turtle: picks at random among colours that gain at least one tile
  - Rabbit: greedy maximum gain, tie-broken toward the longer frontier
  - Rocket: 3-ply search on (my tiles - their tiles), preferring colours that also deny the opponent their best reply

---

### 3. Penguin Slide — *aim and physics*
**Verb:** drag (pull back, release) · **2P layout:** shared board · **Round:** ~90 s

An icy lane seen from above with target rings at the far end. Pull your penguin back and let go — it slides, spins and bumps. Penguins knock each other out of the rings. After four slides each, whoever sits closest to the centre takes the end; best of three ends wins the round.

- **Replay:** every end is a new physical arrangement, and the last slide of an end is a genuine dilemma — go for the centre, or knock theirs out?
- **Age-5 fit:** pull back and let go is the same motion as rolling a ball across a floor. No timing, no precision, and a lucky slide genuinely wins. The only game in the set built on physics.
- **AI:** aiming error plus shot selection.
  - Turtle: ±18° angle, ±25% power, always aims at the centre and never plays a takeout
  - Rabbit: ±7° angle, ±10% power, plays the obvious takeout when losing the end
  - Rocket: ±2.5° angle, ±4% power, simulates candidate shots to choose between drawing, takeout and guarding

---

### 4. Memory Zoo — *memory*
**Verb:** tap · **2P layout:** shared board · **Round:** ~100 s

Classic pairs. Grid size scales with player age setting: 12, 16, or 20 cards. Matched pairs fly off to a little zoo enclosure that fills up along the bottom edge.

- **Replay:** fresh shuffle every round; card art rotates through themed decks (safari, ocean, space, dinosaurs) unlocked by stickers.
- **Age-5 fit:** the one game where a young child can genuinely and regularly beat an adult. Important for the emotional economy of the set.
- **AI:** difficulty = size and fidelity of its memory buffer, plus a human-feeling "thinking" pause before each flip.
  - 🐢 remembers the last 2 cards seen, 40% recall accuracy
  - 🐰 remembers 6 cards, 80% accuracy
  - 🚀 perfect recall of everything revealed

---

### 5. Star Maze Dash — *real-time dexterity*
**Verb:** drag · **2P layout:** shared board (both players on the same maze, simultaneously) · **Round:** ~60 s

A procedurally generated maze with stars scattered through it. Drag your animal with a finger. Both players move at once on the same maze, racing for the same stars. Most stars when the timer hits zero wins.

- **Replay:** new maze every round, seeded generator with tunable branchiness.
- **Age-5 fit:** dragging is the most forgiving gesture there is; walls stop you gently rather than punishing you, and there is no death or restart.
- **AI:** pathfinding horizon + movement speed.
  - 🐢 0.75× speed, greedy toward nearest star, 10% wrong turn at each junction
  - 🐰 1.0× speed, clean A* to nearest star
  - 🚀 1.15× speed, A* with contest prediction — it targets stars it can reach before you, and will cut you off

---

### 6. Bubble Blitz — *real-time dexterity*
**Verb:** swipe · **2P layout:** duel · **Round:** ~75 s

Coloured, shaped bubbles drift down your half of the screen. Swipe each one toward the matching bin on the left, right, or bottom. Speed ramps up. Wrong bin = the bubble pops sadly and you lose tempo.

- **Replay:** spawn pattern is procedural; the ramp curve makes each round's endgame frantic in a different way.
- **Age-5 fit:** three-way sorting with dual colour+shape coding; a directional flick is easier than precise tapping for small hands.
- **AI:** throughput and accuracy on its own half.
  - 🐢 slow reactions, 65% correct sorts
  - 🐰 85% correct
  - 🚀 97% correct and keeps pace through the full speed ramp

---

### 7. Rope Rumble — *real-time dexterity*
**Verb:** fast-tap · **2P layout:** duel · **Round:** ~45 s

Tug-of-war, but **not** a tapping-speed contest — those are won by whoever is bigger, and they're hard on tablets. Instead, two big buttons per side light up in sequence; you must tap **the lit one**. Correct taps pull the rope, wrong taps stall you.

- **Replay:** the cue sequence is randomised, with occasional double-lights and fake-outs.
- **Age-5 fit:** it rewards attention rather than strength, so a 5-year-old can genuinely beat a 10-year-old. Shortest round in the set — the perfect "one more go".
- **AI:** tap rate + cue accuracy.
  - 🐢 3.2 taps/s, 70% cue accuracy
  - 🐰 4.5 taps/s, 88%
  - 🚀 5.8 taps/s, 97% (deliberately capped below machine-perfect so Rocket is beatable)

---

### 8. Treasure Reef — *strategy, hidden information*
**Verb:** tap · **2P layout:** shared board (pass-and-play with a hand-over screen) · **Round:** ~120 s

Miniature battleship. 6×6 reef, three treasure chests of length 2, 3 and 4, placed by dragging them onto your grid. Tap a square on the opponent's reef to dig. Splash or sparkle.

- **Replay:** hidden information means every round is genuinely new; ship placement alone is a strategy layer.
- **Age-5 fit:** "tap a square, see what happens" is trivially learnable. The sparkle/splash feedback carries all the meaning.
- **AI:** search strategy — the clearest ladder of the ten.
  - 🐢 uniformly random digs, only 50% likely to follow up next to a hit
  - 🐰 hunt/target: parity-based search, then systematically works out a chest's axis after a hit
  - 🚀 probability-density heatmap over all remaining valid placements

---

### 9. Ice Cracker — *push-your-luck*
**Verb:** tap · **2P layout:** shared board · **Round:** ~60 s

A grid of ice blocks holds a penguin. Take turns tapping blocks out. Most blocks are safe; whoever drops the penguin loses the round — and the penguin does a very silly fall. Optionally, players choose to take 1, 2 or 3 blocks per turn for bonus points, which is where the push-your-luck tension lives.

- **Replay:** the fragile blocks are randomised each round, so there is no learnable safe pattern.
- **Age-5 fit:** the only game in the set where a complete beginner has near-equal odds. Very high laugh-per-minute. This is the one to play when someone has just lost three rounds of Drop Four.
- **AI:** risk model.
  - 🐢 taps at random with no odds tracking
  - 🐰 tracks remaining-safe-block odds and takes the safest count
  - 🚀 odds tracking plus optimal risk threshold based on the current score gap (it gambles when behind)

---

### 10. Loop the Line — *puzzle race*
**Verb:** trace · **2P layout:** duel (same puzzle, side by side) · **Round:** ~90 s

Each animal must be connected to its matching home by tracing a path with one finger. Paths can't cross. Fill the grid to finish. Solo, you race an AI whose progress shows as a translucent ghost line on your board.

- **Replay:** puzzles are generated, not authored — an infinite supply, each rated by a solver for a par time.
- **Age-5 fit:** trace-with-one-finger is the most natural gesture on a tablet, and partial progress is always visible and reversible.
- **AI:** solve time relative to the puzzle's measured par, revealed as a visible ghost so the child can see the race.
  - 🐢 2.5× par time
  - 🐰 1.3× par
  - 🚀 0.85× par

---

## 3. Why these ten together

| # | Game | Category | Verb | 2P layout | Beatable by a 5-year-old? |
|---|---|---|---|---|---|
| 1 | Snap Safari | Reaction | tap | duel | Sometimes |
| 2 | Colour Splash | Strategy | tap | shared | Sometimes |
| 3 | Penguin Slide | Aim & physics | drag | shared | **Often** |
| 4 | Memory Zoo | Memory | tap | shared | **Often** |
| 5 | Star Maze Dash | Dexterity | drag | shared | Sometimes |
| 6 | Bubble Blitz | Dexterity | swipe | duel | Sometimes |
| 7 | Rope Rumble | Dexterity | fast-tap | duel | **Often** |
| 8 | Treasure Reef | Strategy (hidden info) | tap | pass-and-play | Sometimes |
| 9 | Ice Cracker | Push-your-luck | tap | shared | **Often** |
| 10 | Loop the Line | Puzzle | trace | duel | Sometimes |

Deliberate properties of the set:

- **Every input verb is covered** — tap, drag, swipe, trace, fast-tap — so the collection feels varied rather than like ten reskins.
- **Four games are winnable by the youngest player through luck or attention rather than skill** (Memory Zoo, Penguin Slide, Rope Rumble, Ice Cracker). In a mixed-age household this is what stops the tablet being abandoned after ten minutes.
- **Three games have a real skill ceiling** (Colour Splash, Treasure Reef, Penguin Slide) so a parent or older child stays engaged.
- **Every game has a legitimate three-tier AI ladder**, not a fake one — each ladder maps onto a real algorithmic axis (search depth, memory size, reaction distribution, risk model).

---

## 4. Proposed technical shape

- **Static web app**, plain ES modules + Canvas 2D. **No build step, no dependencies, no framework** — `index.html` is the app. JSDoc annotations plus a `jsconfig.json` give editor-level type checking without introducing a compile stage that could break between a change and a child playing the game.
- **PWA**, installable to the home screen, fully offline after first load. Critical for tablets handed to kids on planes and in cars.
- **Shared `engine/` module**: fixed-timestep game loop, pointer/multi-touch input abstraction, audio, save/profile persistence (localStorage), seeded RNG, difficulty helpers, and the shared UI shell (picker, pause, results, sticker album).
- **Each game is one module** implementing a common `MiniGame` interface (`init(seed, mode, difficulty)`, `update(dt)`, `render(ctx)`, `onPointer(evt)`, `getResult()`). This is what makes ten games tractable rather than ten codebases.
- **No network, no accounts, no analytics, no ads, no purchases.** All state is local. This is the right default for a children's product and it removes an entire category of compliance work (COPPA/GDPR-K).
- **All art is drawn procedurally on canvas and all sound is synthesised with WebAudio.** No image or audio files anywhere, so the whole collection is a few hundred kilobytes and works offline from first load.
- **Build order:** engine + shell first, then Colour Splash (validates turn-based play and search-based AI), then Snap Safari (validates real time and the duel layout), then the remaining eight against those two templates.

---

## 5. Decisions — settled

| # | Question | Decision |
|---|---|---|
| 1 | Which of the ten are in? | Eight approved as proposed. **Drop Four and Box It In replaced** by **Colour Splash** and **Penguin Slide** — both classic-derived board games traded for games a five-year-old can actually win. |
| 2 | Scope | **All ten**, built after the replacement. |
| 3 | Art direction | **Friendly animals throughout**, drawn procedurally on canvas. |
| 4 | Adaptive difficulty | **On by default.** Three straight wins steps the AI up, three straight losses steps it down, within the chosen tier's neighbourhood. Can be switched off in settings. |
| 5 | Portrait support | **Portrait fallbacks for all four duel games.** In portrait the split runs horizontally — the top half's interface rotated 180° — instead of vertically. |

### Consequences of the swap

Replacing the two "rarely winnable by the five-year-old" games moves the set's centre of gravity toward the youngest player without losing depth for adults:

- Games a five-year-old wins **often**: 3 → **4** (Memory Zoo, Rope Rumble, Ice Cracker, Penguin Slide)
- Games rated **rarely**: 2 → **0**
- Genuine skill ceiling preserved by Colour Splash's 3-ply search, Treasure Reef's probability heatmap, and Penguin Slide's shot simulation.
- The set now covers six categories: reaction, strategy, aim & physics, memory, push-your-luck and puzzle.


---

## 6. As built — where the implementation differs from this document

The proposal above is what was approved; these are the points where building
it changed the answer. Everything else shipped as described.

| Area | Proposed | As built | Why |
|---|---|---|---|
| **Duel split** | Vertical divider in landscape, horizontal in portrait | **Horizontal divider in both orientations**, far half rotated 180° | Two children sharing a tablet sit across from each other and each wants the half nearest them. That is a horizontal divider whichever way the tablet is turned. One code path, and each half simply lays itself out from its own aspect ratio — wide strips in landscape, near-square in portrait — so portrait is a genuine layout rather than a letterboxed fallback. |
| **Loop the Line opponent** | A translucent ghost line on your own board | The opponent solves **its own half**, beside yours | The duel layout already gives each player a half. Watching the other board fill up is the same race made clearer, and it means solo and two-player are the same screen. |
| **Treasure Reef placement** | Drag each chest onto your grid, tap to rotate | **Shuffle and accept**: one button re-rolls the layout, one accepts it | A five-year-old should not have to fight a layout editor before the game starts. Re-rolling until you like the look of it is the same decision made in one tap. |
| **Memory Zoo board size** | Scales with an age setting | Scales with the **difficulty tier** (12 / 16 / 20 cards solo, 16 in two-player) | One fewer setting to explain, and it means Rocket is a harder board as well as a sharper opponent. |
| **Rope Rumble cues** | Occasional double-lights and fake-outs | A **dark beat**: roughly one beat in ten lights nothing, and tapping then stalls you | Double-lights need two fingers, which is exactly the strength contest the game exists to avoid. A dark beat tests the same attention with one finger. |
| **Star Maze stars** | A fixed scatter | Stars **replenish** as they are collected | A fixed scatter empties out and the last twenty seconds of the round go dead. |
| **Technical shape** | TypeScript + Vite | **Plain ES modules, no build step, no dependencies** | It guarantees the app runs from any static host and cannot fail to build between a change and a child playing the game. The cost is editor-only type checking through JSDoc and `jsconfig.json` rather than a compiler gate; for a codebase this size that trade came out in favour of never having a broken build. |

### Verification

- **Smoke** — all ten games opened in landscape, portrait and two-player, poked at random, checked for runtime errors. 30 configurations, clean.
- **End-to-end** — a round played to its own conclusion, results reported, stars persisted, adaptive difficulty stepped up and down and stayed put when switched off, pause/resume/quit.
- **Difficulty ladders** — measured rather than asserted:

  | Game | Turtle | Rabbit | Rocket |
  |---|---|---|---|
  | Colour Splash (win rate for the stronger tier) | — | 94% vs Turtle | 77% vs Rabbit, 96% vs Turtle |
  | Treasure Reef (mean digs to clear a 36-square board) | 29.2 | 21.9 | 18.1 |
  | Memory Zoo (mean flips per pair found) | 9.89 | 4.14 | 3.90 |
