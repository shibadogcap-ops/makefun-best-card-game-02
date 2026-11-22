// AETHER CLASH game state: the duel's rules and flow with no drawing and no DOM.
// createGame(seed) returns a plain object the renderer and input layers read and
// drive; step() advances the clock in milliseconds. One job only — who plays what,
// what the clash does, when the match ends.

import { HAND_SIZE, START_LIFE, SUITS, TIMING } from './config.js';
import { createRng } from './random.js';
import { cardName, effectiveValue, shuffledDeck } from './deck.js';
import { chooseAiCard } from './ai.js';

// Screen ids the renderer switches on.
export const SCREEN = { TITLE: 'title', TABLE: 'table', WIN: 'win', LOSS: 'loss' };

// Floater lifetime: damage/heal numbers rise and fade for 900 ms, then are dropped.
const FLOATER_MS = 900;
// Short beat after the AI's flip lands before the clash resolves.
const RESOLVE_PAUSE_MS = 180;

function suitName(suitId) {
  const suit = SUITS.find((s) => s.id === suitId);
  return suit ? suit.name : suitId;
}

export function createGame(seed) {
  const rng = createRng(seed);

  const game = {
    screen: SCREEN.TITLE,
    deck: [],
    playerHand: [],
    aiHand: [],
    playerLife: START_LIFE,
    aiLife: START_LIFE,
    playerScore: 0,
    aiScore: 0,
    trumpSuit: SUITS[0].id,
    spoils: [],
    playerCard: null,
    aiCard: null,
    aiFaceDown: false,
    phase: 'pick',
    banner: '',
    bannerKind: 'info',
    floaters: [],
    clashCount: 0,
    winner: null,
    hoverIndex: null,
    anim: { playerPlayT: 0, aiPlayT: 0, flipT: 0 },
    now: 0,
    // Private timing fields (prefixed so the renderer knows not to draw them).
    _revealMs: 0,
    _pauseMs: 0,
    _bannerMs: 0,
  };

  function drawInto(hand) {
    while (hand.length < HAND_SIZE && game.deck.length > 0) {
      hand.push(game.deck.pop());
    }
  }

  // Deal a fresh round: new lives and scores, a new shuffled deck, a new trump,
  // five cards each, back to the pick phase.
  function newMatch() {
    game.playerLife = START_LIFE;
    game.aiLife = START_LIFE;
    game.playerScore = 0;
    game.aiScore = 0;
    game.spoils = [];
    game.clashCount = 0;
    game.winner = null;
    game.playerCard = null;
    game.aiCard = null;
    game.aiFaceDown = false;
    game.phase = 'pick';
    game.deck = shuffledDeck(rng);
    game.trumpSuit = rng.pick(SUITS).id;
    game.playerHand = [];
    game.aiHand = [];
    drawInto(game.playerHand);
    drawInto(game.aiHand);
    game.banner = `Choose your card — trump is ${suitName(game.trumpSuit)}`;
    game.bannerKind = 'info';
    game.floaters = [];
    game.anim.playerPlayT = 0;
    game.anim.aiPlayT = 0;
    game.anim.flipT = 0;
    game._revealMs = 0;
    game._pauseMs = 0;
    game._bannerMs = 0;
    game.screen = SCREEN.TABLE;
  }

  function start() {
    newMatch();
  }

  // Move the chosen card out of the player's hand into the clash slot; the rival
  // answers immediately and its card starts face down.
  function playCard(index) {
    if (game.screen !== SCREEN.TABLE || game.phase !== 'pick') return;
    const card = game.playerHand[index];
    if (!card) return;
    game.playerHand.splice(index, 1);
    game.playerCard = card;
    const aiCard = chooseAiCard(game.aiHand, card, game.trumpSuit, rng);
    game.aiHand.splice(game.aiHand.indexOf(aiCard), 1);
    game.aiCard = aiCard;
    game.aiFaceDown = true;
    game.phase = 'reveal';
    game.anim.playerPlayT = 0;
    game.anim.aiPlayT = 0;
    game.anim.flipT = 0;
    game._revealMs = 0;
    game._pauseMs = 0;
  }

  function addFloater(x, y, text, color) {
    game.floaters.push({ x, y, text, color, age: 0 });
  }

  // Resolve one clash once the reveal has played out.
  function resolveClash() {
    const p = game.playerCard;
    const a = game.aiCard;
    game.clashCount += 1;

    const pValue = effectiveValue(p, game.trumpSuit);
    const aValue = effectiveValue(a, game.trumpSuit);

    if (pValue === aValue) {
      game.spoils.push(p, a);
      game.banner = 'A tie — the spoils grow';
      game.bannerKind = 'tie';
    } else {
      const playerWins = pValue > aValue;
      const winnerCard = playerWins ? p : a;
      const loserCard = playerWins ? a : p;
      const spoils = game.spoils.splice(0);
      const captured = [p, a, ...spoils];
      const rankSum = captured.reduce((sum, c) => sum + c.rank, 0);
      if (playerWins) game.playerScore += rankSum;
      else game.aiScore += rankSum;

      let damage = Math.max(1, winnerCard.rank - loserCard.rank);
      let note = '';
      if (winnerCard.suit === 'ember') {
        damage += 1;
        note = ' Ember burn +1.';
      }
      const loser = playerWins ? 'ai' : 'player';
      if (playerWins) game.aiLife -= damage;
      else game.playerLife -= damage;

      let healNote = '';
      if (winnerCard.suit === 'wave') {
        const healed = playerWins ? 'player' : 'ai';
        if (healed === 'player') game.playerLife = Math.min(START_LIFE, game.playerLife + 1);
        else game.aiLife = Math.min(START_LIFE, game.aiLife + 1);
        healNote = ' Wave heals 1.';
      }

      game.banner = `${cardName(winnerCard)} wins for ${damage} damage.${note}${healNote}`;
      game.bannerKind = playerWins ? 'win' : 'lose';

      // Damage floaters drift over each duelist's side of the table.
      addFloater(playerWins ? 0.72 : 0.28, 0.62, `-${damage}`, '#f2604c');
      if (winnerCard.suit === 'wave') {
        addFloater(playerWins ? 0.72 : 0.28, 0.72, '+1', '#35c4dc');
      }
    }

    game.phase = 'banner';
    game._bannerMs = 0;
  }

  // After the banner: clear the clash, top both hands up, rotate the trump, and
  // check whether the match is over.
  function finishClash() {
    game.playerCard = null;
    game.aiCard = null;
    drawInto(game.playerHand);
    drawInto(game.aiHand);

    const nextIndex = (SUITS.findIndex((s) => s.id === game.trumpSuit) + 1) % SUITS.length;
    game.trumpSuit = SUITS[nextIndex].id;

    if (game.playerLife <= 0 || game.aiLife <= 0) {
      game.winner = game.playerLife <= 0 ? 'ai' : 'player';
      game.screen = game.winner === 'player' ? SCREEN.WIN : SCREEN.LOSS;
      game.phase = 'pick';
      return;
    }

    if (game.deck.length === 0 && (game.playerHand.length === 0 || game.aiHand.length === 0)) {
      if (game.playerLife !== game.aiLife) {
        game.winner = game.playerLife > game.aiLife ? 'player' : 'ai';
      } else if (game.playerScore !== game.aiScore) {
        game.winner = game.playerScore > game.aiScore ? 'player' : 'ai';
      } else {
        game.winner = 'ai';
      }
      game.screen = game.winner === 'player' ? SCREEN.WIN : SCREEN.LOSS;
      game.phase = 'pick';
      return;
    }

    game.phase = 'pick';
    game.banner = `Choose your card — trump is ${suitName(game.trumpSuit)}`;
    game.bannerKind = 'info';
  }

  // Advance the duel by dtMs milliseconds: reveal flip, pause, clash resolution,
  // banner hold, and floater aging. Clock fields are kept in ms for the renderer.
  function step(dtMs) {
    game.now += dtMs;

    for (const f of game.floaters) {
      f.age += dtMs;
      f.y -= dtMs * 0.00004;
    }
    game.floaters = game.floaters.filter((f) => f.age < FLOATER_MS);

    if (game.screen !== SCREEN.TABLE) return;

    if (game.phase === 'reveal') {
      game.anim.playerPlayT = Math.min(1, game.anim.playerPlayT + dtMs / TIMING.REVEAL_MS);
      game.anim.aiPlayT = Math.min(1, game.anim.aiPlayT + dtMs / TIMING.REVEAL_MS);
      game.anim.flipT = Math.min(1, game.anim.flipT + dtMs / TIMING.REVEAL_MS);
      if (game.anim.flipT >= 0.5) game.aiFaceDown = false;
      game._revealMs += dtMs;
      if (game._revealMs >= TIMING.REVEAL_MS) {
        if (game._pauseMs === 0) game._pauseMs = RESOLVE_PAUSE_MS;
        else {
          game._pauseMs -= dtMs;
          if (game._pauseMs <= 0) {
            game._pauseMs = 0;
            resolveClash();
          }
        }
      }
    } else if (game.phase === 'banner') {
      game._bannerMs += dtMs;
      if (game._bannerMs >= TIMING.BANNER_MS) finishClash();
    }
  }

  game.newMatch = newMatch;
  game.start = start;
  game.playCard = playCard;
  game.step = step;

  return game;
}
