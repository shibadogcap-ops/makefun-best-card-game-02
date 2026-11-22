// Drawing only: the duel's state in, pixels out. The 1280x720 playfield is scaled to fit the
// window with uniform scale and letterboxed on the deep indigo margin; once the transform is set,
// every helper works in virtual coordinates. Cards are drawn by drawCard() — parchment face,
// suit-coloured frame, rank corners and a path-drawn suit glyph; or an indigo back with a gold
// lattice and a sun-moon emblem. Screens: TITLE, TABLE, WIN, LOSS.
import { CARD, COLORS, HAND_SIZE, START_LIFE, SUITS, VIEW } from './config.js';
import { SCREEN } from './game.js';

const TAU = Math.PI * 2;
const FONT_DISPLAY = 'Georgia, serif';
const FONT_UI = 'system-ui, sans-serif';
const FLOATER_MS = 900;

const DISPLAY = { title: `700 96px ${FONT_DISPLAY}`, clash: `700 104px ${FONT_DISPLAY}` };

function suitById(id) {
  return SUITS.find((s) => s.id === id) || SUITS[0];
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Deterministic sparkle field for the victory screen: particle i is a pure function of i and
// game.now, so the burst is identical on every visit to the same moment.
function hash(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
  const fontCache = new Map();

  function font(key) {
    if (!fontCache.has(key)) fontCache.set(key, key);
    return fontCache.get(key);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    view.dpr = dpr;
    view.scale = Math.min(w / VIEW.width, h / VIEW.height);
    view.ox = (w - VIEW.width * view.scale) / 2;
    view.oy = (h - VIEW.height * view.scale) / 2;
  }

  // Text helper: font strings are cached so a frame allocates no strings it can avoid.
  function text(str, x, y, size, family, color, align = 'center', baseline = 'alphabetic') {
    ctx.font = font(`${size}px ${family}`);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(str, x, y);
  }

  function roundRectPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fillRoundRect(x, y, w, h, r, color) {
    roundRectPath(x, y, w, h, r);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ---------------------------------------------------------------- suit glyphs
  // Each glyph is drawn centred on (0,0) inside a radius-1-ish box scaled by `r`, in `color`.

  function glyphSun(r, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
      ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, TAU);
    ctx.fill();
  }

  function glyphMoon(r, color) {
    // Crescent as one closed path: the outer circle's left arc joined by the inner circle's
    // left arc. Radii/offset chosen so the two circles intersect above and below centre.
    const ir = r * 0.88;
    const off = r * 0.5;
    const a = (off * off + r * r - ir * ir) / (2 * off);
    const h = Math.sqrt(Math.max(0, r * r - a * a));
    const th = Math.atan2(h, a);
    const phi = Math.atan2(h, a - off);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, th, TAU - th, false);
    ctx.arc(off, 0, ir, -phi, phi, true);
    ctx.closePath();
    ctx.fill();
  }

  function glyphWave(r, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.15;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i += 1) {
      const base = (i - 1) * r * 0.5;
      const phase = i * 0.9;
      ctx.beginPath();
      for (let s = 0; s <= 16; s += 1) {
        const x = -r + (2 * r * s) / 16;
        const y = base + Math.sin((x / r) * Math.PI * 1.4 + phase) * r * 0.18;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function glyphEmber(r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(-r * 0.2, -r * 0.55, -r * 0.72, -r * 0.4, -r * 0.62, r * 0.22);
    ctx.bezierCurveTo(-r * 0.55, r * 0.72, -r * 0.22, r, 0, r);
    ctx.bezierCurveTo(r * 0.22, r, r * 0.55, r * 0.72, r * 0.62, r * 0.22);
    ctx.bezierCurveTo(r * 0.72, -r * 0.4, r * 0.2, -r * 0.55, 0, -r);
    ctx.closePath();
    ctx.fill();
  }

  // Draw a suit glyph centred at (x, y) with radius r. Call inside a translated context.
  function drawSuitGlyph(suitId, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    if (suitId === 'sun') glyphSun(r, color);
    else if (suitId === 'moon') glyphMoon(r, color);
    else if (suitId === 'wave') glyphWave(r, color);
    else glyphEmber(r, color);
    ctx.restore();
  }

  // ------------------------------------------------------------- card drawing
  // drawCard(cx, cy, card, opts): x/y is the card's centre in virtual px. opts:
  //   faceDown — show the back; scale — uniform size multiplier (default 1);
  //   sx — extra horizontal flip factor for the reveal (default 1);
  //   glow — true for the card's suit colour, or a colour string;
  //   dim — fade the whole card toward the felt.
  function drawCard(cx, cy, card, opts = {}) {
    if (!card) return;
    const w = CARD.width;
    const h = CARD.height;
    const s = opts.scale || 1;
    const suit = suitById(card.suit);
    const glowColor = typeof opts.glow === 'string' ? opts.glow : opts.glow ? suit.color : null;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s * (opts.sx ?? 1), s);
    if (opts.dim) ctx.globalAlpha *= 0.55;

    // Drop shadow, then the body. The glow is a coloured outer shadow on the body fill.
    roundRectPath(-w / 2, 7 - h / 2, w, h, CARD.radius);
    ctx.fillStyle = 'rgba(6, 3, 18, 0.45)';
    ctx.fill();

    if (opts.faceDown) {
      roundRectPath(-w / 2, -h / 2, w, h, CARD.radius);
      if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 30;
      }
      ctx.fillStyle = COLORS.cardBack;
      ctx.fill();
      ctx.shadowBlur = 0;
      drawCardBackPattern(w, h);
    } else {
      roundRectPath(-w / 2, -h / 2, w, h, CARD.radius);
      if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 30;
      }
      ctx.fillStyle = COLORS.parchment;
      ctx.fill();
      ctx.shadowBlur = 0;
      // Suit-coloured frame with a fine inner gold rule.
      roundRectPath(-w / 2, -h / 2, w, h, CARD.radius);
      ctx.strokeStyle = suit.color;
      ctx.lineWidth = 5;
      ctx.stroke();
      roundRectPath(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14, CARD.radius - 6);
      ctx.strokeStyle = 'rgba(232, 194, 104, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Rank corners: big numeral plus a small suit glyph beside it, top-left and bottom-right.
      drawRankCorner(suit, String(card.rank), -1);
      drawRankCorner(suit, String(card.rank), 1);

      // Large suit glyph in the middle of the face.
      drawSuitGlyph(card.suit, 0, 10, 30, suit.dark);
    }
    ctx.restore();
  }

  // One rank corner on a card drawn around the origin. dir -1 is top-left, +1 bottom-right;
  // the glyph is placed just past the numeral's measured width so '10' never collides.
  function drawRankCorner(suit, rank, dir) {
    ctx.font = font(`34px ${FONT_UI}`);
    const tw = ctx.measureText(rank).width;
    const pad = 14;
    const baseY = dir < 0 ? -CARD.height / 2 + 46 : CARD.height / 2 - 20;
    const edgeX = dir < 0 ? -CARD.width / 2 + pad : CARD.width / 2 - pad;
    const align = dir < 0 ? 'left' : 'right';
    text(rank, edgeX, baseY, 34, FONT_UI, suit.dark, align);
    const gx = dir < 0 ? edgeX + tw + 12 : edgeX - tw - 12;
    drawSuitGlyph(suit.id, gx, baseY - 14, 10, suit.dark);
  }

  // Indigo back: gold diamond lattice clipped to the rounded card, sun-moon emblem at centre.
  function drawCardBackPattern(w, h) {
    ctx.save();
    roundRectPath(-w / 2, -h / 2, w, h, CARD.radius);
    ctx.clip();
    ctx.strokeStyle = 'rgba(232, 194, 104, 0.4)';
    ctx.lineWidth = 1.5;
    const step = 18;
    for (let d = -h; d < w + h; d += step) {
      ctx.beginPath();
      ctx.moveTo(d, -h / 2);
      ctx.lineTo(d + h, h / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(d + h, -h / 2);
      ctx.lineTo(d, h / 2);
      ctx.stroke();
    }
    ctx.restore();
    // Central sun-moon emblem in gold.
    drawSuitGlyph('sun', -11, -8, 15, COLORS.gold);
    drawSuitGlyph('moon', 13, 10, 14, COLORS.gold);
  }

  // --------------------------------------------------------------- table pieces

  // Felt: radial indigo/violet glow with a faint gold ring inlay marking the table edge.
  function drawFelt(now) {
    const g = ctx.createRadialGradient(640, 400, 60, 640, 400, 620);
    g.addColorStop(0, '#35247a');
    g.addColorStop(0.55, '#241a52');
    g.addColorStop(1, COLORS.feltBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    ctx.strokeStyle = 'rgba(232, 194, 104, 0.16)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(640, 400, 590, 315, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232, 194, 104, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(640, 400, 540, 285, 0, 0, TAU);
    ctx.stroke();
  }

  // A small heart glyph centred at (x, y), roughly s px tall.
  function drawHeart(x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x - s * 0.3, y - s * 0.12, s * 0.34, 0, TAU);
    ctx.arc(x + s * 0.3, y - s * 0.12, s * 0.34, 0, TAU);
    ctx.moveTo(x - s * 0.64, y - s * 0.08);
    ctx.lineTo(x + s * 0.64, y - s * 0.08);
    ctx.lineTo(x, y + s * 0.72);
    ctx.closePath();
    ctx.fill();
  }

  // Life bar: rounded trough, gradient fill, heart glyph and the big remaining number.
  function drawLife(x, y, w, h, life, barFrom, barTo, heartColor, numX) {
    const frac = clamp(life / START_LIFE, 0, 1);
    fillRoundRect(x, y, w, h, h / 2, 'rgba(10, 6, 26, 0.8)');
    if (frac > 0) {
      roundRectPath(x + 3, y + 3, (w - 6) * frac, h - 6, (h - 6) / 2);
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, barFrom);
      g.addColorStop(1, barTo);
      ctx.fillStyle = g;
      ctx.fill();
    }
    drawHeart(x - 20, y + h / 2 - 2, h * 0.95, heartColor);
    text(String(Math.max(0, life)), numX, y + h - 7, h + 8, FONT_UI, COLORS.text, 'center');
  }

  // Name plate: dark rounded tag with a gold rim and centred label.
  function drawPlate(cx, y, w, h, label, size = 24, color = COLORS.gold) {
    fillRoundRect(cx - w / 2, y, w, h, h / 2, 'rgba(16, 10, 38, 0.9)');
    roundRectPath(cx - w / 2, y, w, h, h / 2);
    ctx.strokeStyle = 'rgba(232, 194, 104, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(label, cx, y + h / 2 + size * 0.36, size, FONT_UI, color);
  }

  // Trump disc: dark medallion whose dashed ring and suit glyph slowly rotate with game.now.
  function drawTrumpDisc(game, cx, cy, r) {
    const suit = suitById(game.trumpSuit);
    const angle = game.now * 0.00025;

    ctx.fillStyle = '#1a1245';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.strokeStyle = suit.color;
    ctx.lineWidth = 4;
    ctx.setLineDash([7, 11]);
    ctx.beginPath();
    ctx.arc(0, 0, r - 12, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    drawSuitGlyph(suit.id, 0, -4, r * 0.48, suit.color);
    ctx.restore();

    text('TRUMP', cx, cy + r - 12, 15, FONT_UI, COLORS.gold);
  }

  // Spoils pile: a small stack of backs with the count beside it, only when non-empty.
  function drawSpoils(game, cx, cy) {
    if (!game.spoils || game.spoils.length === 0) return;
    const n = game.spoils.length;
    for (let i = 0; i < Math.min(3, n); i += 1) {
      drawCard(cx + i * 5, cy - i * 5, { suit: 'moon', rank: 1 }, { faceDown: true, scale: 0.42 });
    }
    text(`×${n}`, cx + 46, cy + 8, 26, FONT_UI, COLORS.gold, 'left');
    text('SPOILS', cx + 46, cy - 14, 13, FONT_UI, COLORS.muted, 'left');
  }

  // Deck pile at the left edge with the remaining count underneath.
  function drawDeck(game, cx, cy) {
    for (let i = 0; i < 3; i += 1) {
      drawCard(cx + i * 4, cy - i * 4, { suit: 'wave', rank: 1 }, { faceDown: true, scale: 0.5 });
    }
    text('DECK', cx, cy + 62, 14, FONT_UI, COLORS.muted);
    text(String(game.deck ? game.deck.length : 0), cx, cy + 92, 28, FONT_UI, COLORS.gold);
  }

  // Banner ribbon across the centre of the table; kind picks the text colour.
  const BANNER_COLORS = { info: COLORS.gold, win: '#8fe6b0', lose: '#ff9a86', tie: '#c9b8ff' };
  function drawBanner(game) {
    if (!game.banner || (game.phase !== 'banner' && game.phase !== 'pick')) return;
    const w = 620;
    const h = 46;
    const cx = VIEW.width / 2;
    const cy = 506;
    fillRoundRect(cx - w / 2, cy - h / 2, w, h, h / 2, 'rgba(14, 9, 32, 0.88)');
    roundRectPath(cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.strokeStyle = 'rgba(232, 194, 104, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(game.banner, cx, cy + 9, 24, FONT_UI, BANNER_COLORS[game.bannerKind] || COLORS.gold);
  }

  // A played card sliding into the clash zone. t is the 0..1 play progress; fromX/fromY is
  // where it flies in from. Returns nothing; draws at the lerped position.
  function drawClashCard(game, card, t, fromX, fromY, toX, toY, opts = {}) {
    const e = easeOut(clamp(t, 0, 1));
    const pop = 0.75 + 0.25 * easeOut(clamp(t * 1.6, 0, 1));
    drawCard(
      fromX + (toX - fromX) * e,
      fromY + (toY - fromY) * e,
      card,
      { ...opts, scale: (opts.scale || 1) * pop }
    );
  }

  // --------------------------------------------------------------- TABLE screen

  function drawTable(game) {
    drawFelt(game.now);

    // --- rival zone (top) ---
    drawPlate(640, 18, 340, 46, 'KAEL, THE RIVAL', 24);
    drawLife(475, 86, 300, 30, game.aiLife, '#e0483e', '#f2b33d', '#ff8a75', 812);

    // His five backs in a slight fan.
    const backScale = 0.72;
    const spacing = 96;
    for (let i = 0; i < HAND_SIZE; i += 1) {
      const x = 640 + (i - 2) * spacing;
      ctx.save();
      ctx.translate(x, 190);
      ctx.rotate((i - 2) * 0.07);
      drawCard(0, 0, { suit: 'moon', rank: 1 }, { faceDown: true, scale: backScale });
      ctx.restore();
    }

    // --- centre: trump disc, spoils, clash zone, banner ---
    drawTrumpDisc(game, 640, 312, 52);
    drawSpoils(game, 872, 296);

    const inPick = game.phase === 'pick';
    const pT = game.anim ? game.anim.playerPlayT : 0;
    const aT = game.anim ? game.anim.aiPlayT : 0;

    // The rival's card flips on flipT: signed cos gives the edge-on moment at half.
    let aiSx = 1;
    let aiFaceDown = true;
    if (game.aiCard) {
      aiSx = Math.cos((game.anim ? game.anim.flipT : 0) * Math.PI);
      aiFaceDown = game.aiFaceDown || aiSx >= 0;
    }

    if (game.playerCard) {
      drawClashCard(game, game.playerCard, pT, 640, 640, 466, 428, {
        glow: game.playerCard.suit === game.trumpSuit ? suitById(game.playerCard.suit).color : false,
      });
    }
    if (game.aiCard) {
      drawClashCard(game, game.aiCard, aT, 640, 90, 814, 428, {
        faceDown: aiFaceDown,
        sx: aiSx,
        glow: game.aiCard.suit === game.trumpSuit ? suitById(game.aiCard.suit).color : false,
      });
    }
    if (game.playerCard && game.aiCard) {
      text('VS', 640, 448, 40, FONT_DISPLAY, COLORS.gold);
    }

    drawBanner(game);

    // --- player zone (bottom) ---
    drawPlate(150, 536, 150, 44, 'YOU', 24, COLORS.text);
    drawLife(560, 550, 300, 30, game.playerLife, '#1f9d8a', '#35c4dc', '#5fe3c0', 880);

    // Score plate: captured points and the running clash count.
    fillRoundRect(1000, 536, 230, 44, 12, 'rgba(16, 10, 38, 0.9)');
    roundRectPath(1000, 536, 230, 44, 12);
    ctx.strokeStyle = 'rgba(232, 194, 104, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(`SCORE ${game.playerScore}`, 1115, 556, 15, FONT_UI, COLORS.muted);
    text(`CLASH ${game.clashCount}`, 1115, 576, 15, FONT_UI, COLORS.gold);

    // Player hand: face-up row along the bottom, hover card raised and lit.
    const hand = game.playerHand || [];
    const n = hand.length;
    const hs = 0.8;
    const spacingH = 118;
    for (let i = 0; i < n; i += 1) {
      const hovered = game.hoverIndex === i;
      const x = 640 + (i - (n - 1) / 2) * spacingH;
      let y = 632;
      let scale = hs;
      let glow = false;
      if (hovered) {
        y -= 18;
        scale = hs * 1.06;
        glow = COLORS.gold;
      } else if (inPick && hand[i].suit === game.trumpSuit) {
        glow = suitById(hand[i].suit).color;
      }
      drawCard(x, y, hand[i], {
        scale,
        glow,
        dim: !inPick && !hovered,
      });
    }

    drawDeck(game, 72, 400);

    // Rising, fading combat numbers.
    for (const f of game.floaters || []) {
      const alpha = clamp(1 - f.age / FLOATER_MS, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      text(f.text, f.x * VIEW.width, f.y * VIEW.height, 32, FONT_UI, f.color);
      ctx.restore();
    }
  }

  // --------------------------------------------------------------- TITLE screen

  function drawTitle(game) {
    // Dimmed table scene behind the title.
    drawFelt(game.now);
    ctx.fillStyle = 'rgba(10, 6, 26, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    // Two sample cards angled behind the wordmark.
    const bob = Math.sin(game.now * 0.0012) * 5;
    ctx.save();
    ctx.translate(400, 330 + bob * 0.4);
    ctx.rotate(-0.16);
    drawCard(0, 0, { suit: 'sun', rank: 10 }, { scale: 0.95 });
    ctx.restore();
    ctx.save();
    ctx.translate(880, 345 - bob * 0.4);
    ctx.rotate(0.14);
    drawCard(0, 0, { suit: 'ember', rank: 1 }, { scale: 0.95 });
    ctx.restore();

    // Wordmark: gold gradient letters with a soft shadow, gently floating.
    const y = 236 + bob;
    const grad = ctx.createLinearGradient(0, y - 96, 0, y + 10);
    grad.addColorStop(0, '#f9e7ae');
    grad.addColorStop(0.55, COLORS.gold);
    grad.addColorStop(1, '#8a6a1f');
    ctx.save();
    ctx.font = font(DISPLAY.title);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = grad;
    ctx.fillText('AETHER', 640, y);
    ctx.font = font(DISPLAY.clash);
    ctx.fillText('CLASH', 640, y + 108);
    ctx.restore();

    text('a duel of suits and nerve', 640, y + 152, 30, FONT_DISPLAY, COLORS.muted);

    // Pulsing call to action.
    const pulse = 0.72 + 0.28 * Math.sin(game.now * 0.006);
    ctx.save();
    ctx.globalAlpha = pulse;
    fillRoundRect(480, 452, 320, 62, 31, 'rgba(232, 194, 104, 0.14)');
    roundRectPath(480, 452, 320, 62, 31);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    text('CLICK TO PLAY', 640, 491, 28, FONT_UI, COLORS.gold);

    // How to play panel.
    const px = 330;
    const py = 548;
    const pw = 620;
    const ph = 158;
    fillRoundRect(px, py, pw, ph, 14, 'rgba(16, 10, 38, 0.92)');
    roundRectPath(px, py, pw, ph, 14);
    ctx.strokeStyle = 'rgba(232, 194, 104, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    text('HOW TO PLAY', 640, py + 30, 19, FONT_UI, COLORS.gold);
    const rules = [
      'The trump suit rotates each clash — trump cards gain +3.',
      'Damage equals the rank gap (minimum 1).',
      'Ember wins burn +1 extra; Wave wins mend 1 Life.',
      'Ties feed both cards to the spoils pile.',
      'First duelist to 0 Life falls.',
    ];
    rules.forEach((line, i) => {
      text(line, 640, py + 62 + i * 20, 18, FONT_UI, '#cfc6ee');
    });
  }

  // --------------------------------------------------------------- end screens

  // Gold spark burst for VICTORY: deterministic positions orbiting the title.
  function drawSparks(game) {
    const colors = [...SUITS.map((s) => s.color), COLORS.gold, COLORS.text];
    for (let i = 0; i < 72; i += 1) {
      const speed = 0.4 + hash(i, 1) * 1.4;
      const rad = (80 + hash(i, 2) * 300) * (0.6 + 0.4 * Math.sin(game.now * 0.001 * speed + i));
      const a = hash(i, 3) * TAU + game.now * 0.0004 * speed;
      const x = 640 + Math.cos(a) * rad;
      const y = 240 + Math.sin(a) * rad * 0.55;
      const alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(game.now * 0.006 + i * 1.7));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colors[i % colors.length];
      ctx.translate(x, y);
      ctx.rotate(a + game.now * 0.002);
      const s = 2 + hash(i, 4) * 4;
      ctx.fillRect(-s / 2, -s / 2, s, s * 0.6);
      ctx.restore();
    }
  }

  function drawEnd(game, victory) {
    drawFelt(game.now);
    ctx.fillStyle = 'rgba(10, 6, 26, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const bob = Math.sin(game.now * 0.0015) * 5;
    if (victory) {
      drawSparks(game);
      const grad = ctx.createLinearGradient(0, 140 + bob, 0, 260 + bob);
      grad.addColorStop(0, '#f9e7ae');
      grad.addColorStop(0.55, COLORS.gold);
      grad.addColorStop(1, '#8a6a1f');
      ctx.save();
      ctx.font = font(`700 116px ${FONT_DISPLAY}`);
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(232, 194, 104, 0.45)';
      ctx.shadowBlur = 30;
      ctx.fillStyle = grad;
      ctx.fillText('VICTORY', 640, 250 + bob);
      ctx.restore();
    } else {
      // The rival's winning card shown large; fall back to a face-down card if none is held.
      const trophy = game.aiCard || game.playerCard;
      drawCard(640, 360, trophy || { suit: 'moon', rank: 1 }, {
        faceDown: !trophy,
        scale: 1.15,
        glow: '#8f86b8',
      });
      text('DEFEAT', 640, 150 + bob, 104, FONT_DISPLAY, '#8f86b8');
    }

    text(
      `Spoils ${game.playerScore} — Kael ${game.aiScore} · Life ${Math.max(0, game.playerLife)} left`,
      640,
      victory ? 430 : 580,
      30,
      FONT_UI,
      COLORS.text
    );

    const pulse = 0.7 + 0.3 * Math.sin(game.now * 0.005);
    ctx.save();
    ctx.globalAlpha = pulse;
    text('Click to duel again', 640, victory ? 510 : 640, 26, FONT_UI, COLORS.gold);
    ctx.restore();
  }

  // ------------------------------------------------------------------ frame

  function draw(game) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);

    if (!game) return;
    if (game.screen === SCREEN.TABLE) drawTable(game);
    else if (game.screen === SCREEN.WIN) drawEnd(game, true);
    else if (game.screen === SCREEN.LOSS) drawEnd(game, false);
    else drawTitle(game);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
