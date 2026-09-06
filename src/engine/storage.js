/**
 * Local persistence: stars, stickers, per-game difficulty, and the
 * win/loss streaks that drive adaptive difficulty.
 *
 * Nothing leaves the device. Every access is wrapped because localStorage
 * throws outright in some privacy modes rather than returning null.
 */

const KEY = 'minigames.save.v1';

/** @typedef {{stars: Object<string, number>, difficulty: Object<string, number>,
 *  streak: Object<string, number>, plays: Object<string, number>,
 *  stickers: string[], adaptive: boolean, sound: boolean}} SaveData */

/** @returns {SaveData} */
function blank() {
  return {
    stars: {},
    difficulty: {},
    streak: {},
    plays: {},
    stickers: [],
    adaptive: true, // decision 4: on by default
    sound: true,
  };
}

let cache = null;

/** @returns {SaveData} */
export function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...blank(), ...JSON.parse(raw) } : blank();
  } catch {
    cache = blank();
  }
  return cache;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
  } catch {
    /* Private mode or blocked site data: the session still plays fine. */
  }
}

/** Difficulty tier for a game: 0 turtle, 1 rabbit, 2 rocket. Default rabbit. */
export function getDifficulty(gameId) {
  const d = load().difficulty[gameId];
  return typeof d === 'number' ? d : 1;
}

export function setDifficulty(gameId, tier) {
  load().difficulty[gameId] = Math.max(0, Math.min(2, tier));
  save();
}

export function getStars(gameId) {
  return load().stars[gameId] || 0;
}

export function totalStars() {
  const s = load().stars;
  return Object.keys(s).reduce((a, k) => a + s[k], 0);
}

export function isAdaptive() {
  return load().adaptive !== false;
}

export function setAdaptive(on) {
  load().adaptive = !!on;
  save();
}

export function isSoundOn() {
  return load().sound !== false;
}

export function setSound(on) {
  load().sound = !!on;
  save();
}

export function stickers() {
  return load().stickers.slice();
}

/**
 * Record a finished single-player round.
 *
 * Returns the difficulty tier to use next time. Adaptive difficulty nudges
 * after three straight results in the same direction, so a child who is
 * being beaten every round gets an easier opponent without anyone touching
 * a settings screen, and a child who has solved the game moves up.
 *
 * @param {string} gameId
 * @param {{stars:number, won:boolean|null}} result
 * @returns {{tier:number, changed:number}} changed is -1, 0 or +1
 */
export function recordRound(gameId, result) {
  const data = load();
  data.plays[gameId] = (data.plays[gameId] || 0) + 1;
  data.stars[gameId] = Math.max(data.stars[gameId] || 0, result.stars);

  if (result.stars >= 1 && !data.stickers.includes(gameId)) {
    data.stickers.push(gameId);
  }
  if (result.stars >= 3 && !data.stickers.includes(`${gameId}.gold`)) {
    data.stickers.push(`${gameId}.gold`);
  }

  let changed = 0;
  let tier = getDifficulty(gameId);

  if (result.won !== null) {
    const prev = data.streak[gameId] || 0;
    // Streak counts consecutive results: positive wins, negative losses.
    const streak = result.won ? Math.max(0, prev) + 1 : Math.min(0, prev) - 1;
    data.streak[gameId] = streak;

    if (data.adaptive !== false) {
      if (streak >= 3 && tier < 2) {
        tier += 1;
        changed = 1;
        data.streak[gameId] = 0;
      } else if (streak <= -3 && tier > 0) {
        tier -= 1;
        changed = -1;
        data.streak[gameId] = 0;
      }
      data.difficulty[gameId] = tier;
    }
  }

  save();
  return { tier, changed };
}

export function resetAll() {
  cache = blank();
  save();
}
