// The deck of AETHER CLASH: every suit holds RANK_MIN..RANK_MAX cards.

import { SUITS, RANK_MIN, RANK_MAX, TRUMP_BONUS } from './config.js';

// All 40 cards, in a fixed order: suit by suit, rank ascending.
export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = RANK_MIN; rank <= RANK_MAX; rank++) {
      deck.push({ suit: suit.id, rank });
    }
  }
  return deck;
}

// A freshly shuffled deck, using the caller's rng so a seed reproduces the deal.
export function shuffledDeck(rng) {
  return rng.shuffle(buildDeck());
}

// Display name like "Sun 7" — the suit's name comes from config, not the id.
export function cardName(card) {
  const suit = SUITS.find((s) => s.id === card.suit);
  return `${suit ? suit.name : card.suit} ${card.rank}`;
}

// Strength in a round: trump cards get TRUMP_BONUS on top of their face rank.
export function effectiveValue(card, trumpSuit) {
  return card.rank + (card.suit === trumpSuit ? TRUMP_BONUS : 0);
}
