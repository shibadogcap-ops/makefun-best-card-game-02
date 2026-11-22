// The screenshot scenes behind ?shot=title|table|win|loss. Each one drives the real game
// forward with a simple scripted policy — middle card for the table, highest for the win,
// lowest for the loss — so the staged frame is what honest play produces at this seed.
// Nothing here draws; it only moves game state, and it returns the screen it ended on.
import { SCREEN } from './game.js';
import { effectiveValue } from './deck.js';

const STEP = 16;

// Hand index of the strongest (or weakest) card by effective value against the trump.
function bestIndex(hand, trumpSuit, strongest) {
  let best = 0;
  let bestValue = effectiveValue(hand[0], trumpSuit);
  for (let i = 1; i < hand.length; i += 1) {
    const v = effectiveValue(hand[i], trumpSuit);
    if ((strongest && v > bestValue) || (!strongest && v < bestValue)) {
      best = i;
      bestValue = v;
    }
  }
  return best;
}

// Advance one scripted match: on each pick play `choose(game)`, then step frames until the
// screen leaves TABLE or `maxSteps` elapse. Returns the step count used.
function runMatch(game, choose, maxSteps) {
  let steps = 0;
  while (game.screen === SCREEN.TABLE && steps < maxSteps) {
    if (game.phase === 'pick' && game.playerHand.length > 0) {
      game.playCard(choose(game));
    }
    game.step(STEP);
    steps += 1;
  }
  return steps;
}

function stageTitle(game) {
  // Fresh game is already on TITLE; step so the idle bob and title float settle.
  for (let i = 0; i < 120; i += 1) game.step(STEP);
  return game.screen;
}

function stageTable(game) {
  game.start();
  // Always play the middle card until four clashes have resolved and it's our pick again.
  for (let i = 0; i < 4000 && game.screen === SCREEN.TABLE; i += 1) {
    if (game.phase === 'pick' && game.playerHand.length > 0) {
      game.playCard(Math.floor((game.playerHand.length - 1) / 2));
    }
    game.step(STEP);
    if (game.clashCount >= 4 && game.phase === 'pick') break;
  }
  if (game.screen === SCREEN.TABLE && game.phase === 'pick' && game.playerHand.length > 0) {
    game.hoverIndex = Math.floor((game.playerHand.length - 1) / 2);
  }
  return game.screen;
}

function stageWin(game) {
  game.start();
  runMatch(game, (g) => bestIndex(g.playerHand, g.trumpSuit, true), 20000);

  // Honest play didn't finish it: force the last clash by dropping the rival to 1 Life,
  // then still win through the real flow — play the strongest card and let damage end it.
  let guard = 0;
  while (game.screen !== SCREEN.WIN && guard < 60000) {
    guard += 1;
    if (game.screen !== SCREEN.TABLE) game.newMatch();
    if (game.phase === 'pick') {
      game.aiLife = 1;
      if (game.playerHand.length > 0) {
        game.playCard(bestIndex(game.playerHand, game.trumpSuit, true));
      }
    }
    game.step(STEP);
  }
  // Let the victory flourish play a moment on the end screen.
  for (let i = 0; i < 30 && game.screen === SCREEN.WIN; i += 1) game.step(STEP);
  return game.screen;
}

function stageLoss(game) {
  game.start();
  runMatch(game, (g) => bestIndex(g.playerHand, g.trumpSuit, false), 20000);

  // Mirror of the win fallback: drop the player to 1 Life, then lose a clash for real.
  let guard = 0;
  while (game.screen !== SCREEN.LOSS && guard < 60000) {
    guard += 1;
    if (game.screen !== SCREEN.TABLE) game.newMatch();
    if (game.phase === 'pick') {
      game.playerLife = 1;
      if (game.playerHand.length > 0) {
        game.playCard(bestIndex(game.playerHand, game.trumpSuit, false));
      }
    }
    game.step(STEP);
  }
  for (let i = 0; i < 30 && game.screen === SCREEN.LOSS; i += 1) game.step(STEP);
  return game.screen;
}

/**
 * Set `game` to the named scene and return the screen it ended on. Any unknown name is the
 * title scene, matching how a typo'd ?shot= should degrade.
 */
export function stageShot(name, game) {
  if (name === 'table') return stageTable(game);
  if (name === 'win') return stageWin(game);
  if (name === 'loss') return stageLoss(game);
  return stageTitle(game);
}
