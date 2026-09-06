/**
 * The collection.
 *
 * Order matters: the picker reads top-left to bottom-right, and a new player
 * should meet the most immediately graspable games first. Snap Safari needs
 * no explanation at all; Treasure Reef and Loop the Line reward a bit of
 * patience, so they sit further down.
 */

import SnapSafari from './snap-safari.js';
import ColourSplash from './colour-splash.js';
import PenguinSlide from './penguin-slide.js';
import MemoryZoo from './memory-zoo.js';
import StarMaze from './star-maze.js';
import BubbleBlitz from './bubble-blitz.js';
import RopeRumble from './rope-rumble.js';
import TreasureReef from './treasure-reef.js';
import IceCracker from './ice-cracker.js';
import LoopTheLine from './loop-the-line.js';

export const GAMES = [
  SnapSafari,
  MemoryZoo,
  IceCracker,
  RopeRumble,
  StarMaze,
  BubbleBlitz,
  PenguinSlide,
  ColourSplash,
  TreasureReef,
  LoopTheLine,
];

/** @param {string} id @returns {typeof import('../engine/game.js').MiniGame|null} */
export function byId(id) {
  return GAMES.find((g) => g.meta.id === id) || null;
}
