// The rival's brain: it sees the player's card first, then answers from its hand.
// The habits below are deliberately readable — a human should be able to predict them.

import { effectiveValue } from './deck.js';

// Chance the rival wins a winnable trick instead of dumping a cheap card.
const WIN_PROBABILITY = 0.75;
// When the rival decides to dump despite being able to win, this is the chance it
// changes its mind against a weak player card it could beat comfortably.
const SECOND_THOUGHT_PROBABILITY = 0.3;

export function chooseAiCard(hand, playerCard, trumpSuit, rng) {
  const values = new Map(hand.map((c) => [c, effectiveValue(c, trumpSuit)]));
  const target = effectiveValue(playerCard, trumpSuit);

  // Every card in hand, sorted weakest-first.
  const weakestFirst = [...hand].sort((a, b) => values.get(a) - values.get(b));

  // Cards that strictly beat the player's effective value.
  const winners = weakestFirst.filter((c) => values.get(c) > target);

  if (winners.length > 0) {
    // Cheapest winning card; ties on cost prefer a non-trump winner so trumps
    // are saved for later.
    const cheapest = values.get(winners[0]);
    const tied = winners.filter((c) => values.get(c) === cheapest);
    const bestWinner = tied.find((c) => c.suit !== trumpSuit) ?? tied[0];

    // Usually (about 75%) the rival takes the cheap win.
    if (rng.next() < WIN_PROBABILITY) {
      return bestWinner;
    }

    // Otherwise it dumps its weakest card — unless the player's card is weak
    // and the rival holds something much stronger, in which case it sometimes
    // (about 30%) still plays the cheap win after all.
    const playerIsWeak = target <= 5;
    const holdsMuchStronger = values.get(weakestFirst[weakestFirst.length - 1]) >= target + 4;
    if (playerIsWeak && holdsMuchStronger && rng.next() < SECOND_THOUGHT_PROBABILITY) {
      return bestWinner;
    }
    return weakestFirst[0];
  }

  // Nothing can win: dump the weakest non-trump card to keep trumps in hand.
  // If every card is trump, "saving" trumps is pointless — play the weakest.
  const nonTrump = weakestFirst.filter((c) => c.suit !== trumpSuit);
  return nonTrump.length > 0 ? nonTrump[0] : weakestFirst[0];
}
