// A small seeded random number generator (mulberry32): the same seed gives the same
// sequence of values, which keeps the game replayable and the screenshot scenes stable.

export function createRng(seed) {
  let a = seed | 0;

  // Float in [0, 1), one step of mulberry32.
  function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Integer in [0, n).
  function int(n) {
    return Math.floor(next() * n);
  }

  function pick(array) {
    return array[int(array.length)];
  }

  // Fisher-Yates shuffle, in place.
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  return { next, int, pick, shuffle };
}

// Backwards-compatible helper for code that expects a bare random() function.
export function createRandom(seed) {
  const rng = createRng(seed);
  return rng.next;
}
