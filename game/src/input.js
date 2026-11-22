// Pointer and keyboard input for AETHER CLASH. attachInput(canvas, game, audio, toVirtual)
// wires the DOM events straight into the game object: hovering a hand card raises it,
// clicking or pressing a number plays it, and the title/end screens restart on any advance.
// `toVirtual(clientX, clientY)` maps client pixels into the 1280x720 playfield, so this file
// never needs to know how the canvas is scaled.
import { SCREEN } from './game.js';

// The player's hand as drawTable() lays it out: five cards at scale 0.8 (about 90x125 px
// each) spaced 118 px apart, centred on x=640 with card centres at y=632. A hovered card
// rises 18 px and grows slightly, so the hit band covers both poses. Defined once here.
const HAND_HIT = { centerX: 640, spacing: 118, top: 570, bottom: 700, halfWidth: 59 };

// Index of the hand card under virtual point (x, y), or -1.
function cardAt(hand, x, y) {
  const n = hand.length;
  for (let i = 0; i < n; i += 1) {
    const cx = HAND_HIT.centerX + (i - (n - 1) / 2) * HAND_HIT.spacing;
    if (Math.abs(x - cx) <= HAND_HIT.halfWidth && y >= HAND_HIT.top && y <= HAND_HIT.bottom) return i;
  }
  return -1;
}

export function attachInput(canvas, game, audio, toVirtual) {
  const status = document.getElementById('status');
  let lastBanner = null;

  // Mirror the clash banner into the hidden live region so screen readers hear it change.
  function syncStatus() {
    if (!status) return;
    const banner = game.banner || '';
    if (banner !== lastBanner) {
      lastBanner = banner;
      status.textContent = banner;
    }
  }
  const statusTimer = setInterval(syncStatus, 250);

  function inPick() {
    return game.screen === SCREEN.TABLE && game.phase === 'pick';
  }

  // Hover only matters while choosing; anything else clears the highlight.
  canvas.addEventListener('pointermove', (event) => {
    if (!inPick()) {
      game.hoverIndex = null;
      return;
    }
    const p = toVirtual(event.clientX, event.clientY);
    const i = cardAt(game.playerHand, p.x, p.y);
    game.hoverIndex = i >= 0 ? i : null;
  });
  canvas.addEventListener('pointerleave', () => {
    game.hoverIndex = null;
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (game.screen === SCREEN.TITLE || game.screen === SCREEN.WIN || game.screen === SCREEN.LOSS) {
      game.start();
      audio.click();
      return;
    }
    if (!inPick()) return;
    const p = toVirtual(event.clientX, event.clientY);
    const i = cardAt(game.playerHand, p.x, p.y);
    if (i >= 0) {
      game.playCard(i);
      audio.play();
    }
  });

  window.addEventListener('keydown', (event) => {
    // Number keys pick a hand card (1 is the leftmost).
    const digit = /^Digit([1-5])$/.exec(event.code) || /^Numpad([1-5])$/.exec(event.code);
    if (digit) {
      if (inPick() && !event.repeat) {
        const i = Number(digit[1]) - 1;
        if (i < game.playerHand.length) {
          game.playCard(i);
          audio.play();
        }
      }
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyR') {
      if ((game.screen === SCREEN.WIN || game.screen === SCREEN.LOSS) && !event.repeat) {
        game.start();
        audio.click();
      }
      return;
    }
    if (event.code === 'Enter' || event.code === 'Space') {
      if ((game.screen === SCREEN.TITLE || game.screen === SCREEN.WIN || game.screen === SCREEN.LOSS) && !event.repeat) {
        game.start();
        audio.click();
      }
      event.preventDefault();
    }
    // 'H' is deliberately unbound.
  });

  syncStatus();
  return () => clearInterval(statusTimer);
}
