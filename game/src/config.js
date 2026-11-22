// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

/** Virtual playfield size in logical pixels; the canvas letterboxes to fit the window. */
export const VIEW = { width: 1280, height: 720 };

/** The four suits that can hold the rotating trump, with their display name and colours. */
export const SUITS = [
  { id: 'sun', name: 'Sun', color: '#f2b33d', dark: '#7a5510' },
  { id: 'moon', name: 'Moon', color: '#a685ff', dark: '#4d348f' },
  { id: 'wave', name: 'Wave', color: '#35c4dc', dark: '#14606e' },
  { id: 'ember', name: 'Ember', color: '#f2604c', dark: '#7e2a1e' },
];

/** Card ranks run from RANK_MIN to RANK_MAX inclusive. */
export const RANK_MIN = 1;
export const RANK_MAX = 10;

/** Cards dealt to each duelist at the start of every round. */
export const HAND_SIZE = 5;

/** Life points each duelist starts with; the duel ends when one reaches 0. */
export const START_LIFE = 20;

/** Extra strength a card gains when its suit is the round's trump. */
export const TRUMP_BONUS = 3;

/** Card face dimensions in logical pixels, and the corner radius of the rounded rect. */
export const CARD = { width: 112, height: 156, radius: 12 };

/** Palette: table felt gradient stops, ink and parchment face, card back, gold accent, text. */
export const COLORS = {
  feltTop: '#241a4d',
  feltBottom: '#17102e',
  ink: '#120c26',
  parchment: '#f7f1e3',
  cardBack: '#2c2260',
  cardBackPattern: '#e8c268',
  gold: '#e8c268',
  text: '#f2ecdf',
  muted: '#9d94c0',
};

/** Animation durations in milliseconds: the rival's reveal flip, and the clash banner. */
export const TIMING = {
  FLIP_MS: 420,
  REVEAL_MS: 650,
  BANNER_MS: 1250,
};
