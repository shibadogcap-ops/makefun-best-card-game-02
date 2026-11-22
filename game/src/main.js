// Boot and the one loop for AETHER CLASH: the renderer paints the 1280x720 playfield
// letterboxed into the window, input drives the game object, and step() advances the duel
// by real milliseconds (clamped so a hidden tab doesn't fast-forward a clash).
//
// ?seed=N fixes the shuffle. ?shot=title|table|win|loss stages that scene instead of a live
// game: it is drawn once, then only the idle animation keeps running (never gameplay).
import { VIEW } from './config.js';
import { createGame, SCREEN } from './game.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { attachInput } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261122;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
canvas.setAttribute(
  'aria-label',
  'Aether Clash: a card duel where you and the rival duelist Kael each pick a card each round, the rotating trump suit decides the clash, and the first duelist to 0 Life loses'
);

// Cap the backing-store density at 2x so large windows stay cheap to paint.
try {
  const realDpr = window.devicePixelRatio || 1;
  Object.defineProperty(window, 'devicePixelRatio', {
    get: () => Math.min(realDpr, 2),
    configurable: true,
  });
} catch {
  // If the property can't be redefined the renderer just uses the real ratio.
}

const renderer = createRenderer(canvas);
const audio = createAudio();
const game = createGame(seed);

// Client pixels -> virtual 1280x720, the same letterbox mapping the renderer applies.
function toVirtual(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || window.innerWidth;
  const h = rect.height || window.innerHeight;
  const scale = Math.min(w / VIEW.width, h / VIEW.height);
  const ox = (w - VIEW.width * scale) / 2;
  const oy = (h - VIEW.height * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

function runShot(name) {
  stageShot(name, game);
  renderer.draw(game);
  let frames = 0;
  function frame() {
    requestAnimationFrame(frame);
    // Idle motion only: title/end screens keep floating and sparkling; a staged table
    // scene is frozen exactly as stageShot left it.
    if (game.screen !== SCREEN.TABLE) game.step(16);
    renderer.draw(game);
    frames += 1;
    if (frames === 2) window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

function runGame() {
  attachInput(canvas, game, audio, toVirtual);
  if (status) status.textContent = game.banner || '';

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(now - last, 50);
    last = now;
    game.step(dt);
    renderer.draw(game);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
