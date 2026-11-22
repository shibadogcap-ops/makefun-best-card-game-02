// AETHER CLASH entry (Node 22, standard library only): the game is this directory's game/ folder,
// plain static files a desktop browser loads offline (game/index.html and its ES modules under
// game/src/, no library and no network request) — an original card duel where two players clash
// over the aether. This program hands it in: it copies game/ and screenshots/ from beside this
// file to the output directory (/output in the grader) and writes dossier.json there, the
// summary the judge reads, built with the vendored make.fun library (buildDossier). The four
// screenshots in screenshots/ are 1-title.jpg (title screen), 2-table.jpg (mid-duel table),
// 3-win.jpg (victory) and 4-loss.jpg (defeat); the first by name is the cover.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080 to play.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
