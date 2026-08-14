/**
 * Redaktion — the editorial console. Run with: bun run redaktion
 *
 * WHAT IT IS. One self-contained HTML file at `redaktion/index.html`: a **navigator over the
 * language**, with this course painted onto it. Ten grammatical strands across six CEFR levels,
 * a page per structure, per confusion and per external source, the spine and the topic spec, the
 * lexical mirror, and a derived inbox of everything missing. Every node has a route, a permalink
 * and a "what links here"; the search box reaches all of them.
 *
 * WHY IT IS INDEPENDENT OF THE PRODUCT. The site teaches; this reads the repo *as an editorial
 * object* and asks questions no learner ever asks — which topic is missing a probe, which
 * published structure no inventory row covers, which confusion is drilled in exactly one file,
 * which `~` headword has no grammar point behind it. Wiring that into the Astro build would give
 * the learner-facing product a second audience and a second set of reasons to change. So it is a
 * generated instrument like `public/exams/`: `redaktion/` is gitignored, the file is regenerated
 * on demand, it makes zero network requests and it opens from `file://`.
 *
 * EVERY FIGURE IS COMPUTED AT GENERATION TIME, never written by hand — the same rule the Über page
 * is held to. All four coverage measurements are *imported*, not reimplemented
 * (`packages/content/src/grammar-coverage.ts`, `packages/content/src/coverage.ts`, `packages/content/src/structures.ts`,
 * `packages/content/src/grammar-depth.ts`), so this console and `bun scripts/grammar-coverage.ts`,
 * `bun scripts/coverage.ts`, `bun scripts/structures.ts` and `bun scripts/grammar-depth.ts` cannot
 * disagree; anything counted here instead (sets, items, item mix, glosses, edges) is counted from
 * the same files the validator reads, by the same rule it uses. If a number here contradicts a
 * script, this loader is wrong.
 *
 * STRUCTURE. `model.ts` builds one normalised graph; `views/*.ts` render from it; `html.ts` holds
 * the escaping and the link helpers; `page.ts` holds the shell, the styles and the router. Adding
 * a view costs a file, not a second pass over the corpus — which is the whole reason the console
 * was restructured on 2026-08-14 rather than extended again.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSOLE_LEVELS,
  ROOT,
  depth,
  gaps,
  grammar,
  inventory,
  loadNotes,
  readings,
  rel,
  sets,
  sources,
  structures,
  topics,
  units,
  vocab,
  wortliste,
} from './model';
import { esc } from './html';
import { CSS, JS } from './page';
import { renderSprachkarte } from './views/sprachkarte';
import { renderStrang } from './views/strang';
import { renderStruktur } from './views/struktur';
import { renderQuellen } from './views/quellen';
import { renderLuecken } from './views/luecken';
import { renderLexik } from './views/lexik';
import { renderFokus } from './views/fokus';
import { renderUeberblick } from './views/ueberblick';
import { renderLernpfad } from './views/lernpfad';
import { renderDetail } from './views/detail';
import { renderInventar } from './views/inventar';
import { focusIntroducedBy } from '@da/content/focus-tags';
import { GRAMMAR_STRANDS } from '@da/content/grammar-coverage';

const OUT_DIR = join(ROOT, 'redaktion');
const OUT_FILE = join(OUT_DIR, 'index.html');

function gitSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unbekannt';
  }
}

function page(): string {
  const generated = new Date().toISOString();
  const sha = gitSha();
  const gapCount = gaps().length;
  const totals = {
    topics: topics.size,
    sets: sets.size,
    items: [...sets.values()].reduce((n, s) => n + (s.data.items?.length ?? 0), 0),
    readings: readings.size,
    decks: vocab.size,
    entries: [...vocab.values()].reduce((n, v) => n + (v.data.entries?.length ?? 0), 0),
    tags: Object.keys(focusIntroducedBy).length,
    points: inventory.length,
    sourceEntries: sources.reduce(
      (n, s) => n + s.sections.reduce((m, sec) => m + sec.entries.length, 0),
      0,
    ),
  };

  const notes = loadNotes.length
    ? `<p class="note warnnote"><b>${loadNotes.length} Ladehinweis(e):</b><br>${loadNotes.map(esc).join('<br>')}</p>`
    : '';

  const levelLinks = (prefix: string) =>
    `<div class="sublinks">${CONSOLE_LEVELS.map((l) => `<a href="#${prefix}-${l}">${l}</a>`).join('')}</div>`;
  const strandLinks = `<div class="sublinks">${GRAMMAR_STRANDS.map(
    (s) => `<a href="#strang-${s}" title="${esc(s)}">${esc(s.slice(0, 4))}</a>`,
  ).join('')}</div>`;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Redaktion — Deutsch-Atlas</title>
<style>${CSS}</style>
</head>
<body>
<nav id="side">
  <h1>Redaktion</h1>
  <div class="sub">Deutsch-Atlas — Navigator</div>
  <input id="filter" type="search" placeholder="Filter: Titel, id, Tag  (/)" autocomplete="off" spellcheck="false">
  <span id="filter-count"></span>
  <div id="nav">
    <div class="group-label">Sprache</div>
    <a href="#sprachkarte" data-view="sprachkarte">Sprachkarte</a>
    <a href="#strang" data-view="strang">Stränge</a>
    ${strandLinks}
    <a href="#struktur" data-view="struktur">Strukturen</a>
    <a href="#fokus" data-view="fokus">Fokus-Tags</a>
    <div class="group-label">Beleg</div>
    <a href="#quellen" data-view="quellen">Quellen</a>
    <a href="#luecken" data-view="luecken">Lücken${gapCount ? ` (${gapCount})` : ''}</a>
    <div class="group-label">Kurs</div>
    <a href="#ueberblick" data-view="ueberblick">Überblick</a>
    ${levelLinks('ueberblick')}
    <a href="#lernpfad" data-view="lernpfad">Lernpfad</a>
    ${levelLinks('lernpfad')}
    <a href="#detail" data-view="detail">Themen-Detail</a>
    <a href="#inventar" data-view="inventar">Inventar</a>
    <a href="#lexik" data-view="lexik">Lexik</a>
    <div class="group-label">Bestand</div>
    <div class="note" style="margin:0.2rem 0 0">
      ${totals.topics} Themen · ${totals.sets} Sätze · ${totals.items} Items<br>
      ${totals.readings} Lesetexte · ${totals.decks} Decks · ${totals.entries} Vokabeln<br>
      ${totals.tags} Fokus-Tags · ${totals.points} Inventarzeilen<br>
      ${sources.length} Quellen · ${totals.sourceEntries} Normzeilen
    </div>
  </div>
</nav>
<main>
  ${notes}
  ${renderSprachkarte()}
  ${renderStrang()}
  ${renderStruktur()}
  ${renderFokus()}
  ${renderQuellen()}
  ${renderLuecken()}
  ${renderUeberblick()}
  ${renderLernpfad()}
  ${renderDetail()}
  ${renderInventar()}
  ${renderLexik()}
  <footer>
    Generiert ${esc(generated)} aus ${esc(sha)} · <code>bun run redaktion</code> · alle Zahlen zur Generierzeit aus <code>content/</code> und <code>data/</code> berechnet · <code>redaktion/</code> ist gitignored und wird nie committet.
  </footer>
</main>
<script>${JS}</script>
</body>
</html>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
const html = page();
writeFileSync(OUT_FILE, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`✓ ${rel(OUT_FILE)} — ${kb} KB`);
console.log(
  `  ${topics.size} Themen · ${units.length} Einheiten · ${sets.size} Sätze · ${inventory.length} Inventarzeilen · ${sources.length} Quellen`,
);
for (const level of CONSOLE_LEVELS) {
  const g = grammar.get(level);
  const w = wortliste.get(level);
  const d = depth.get(level);
  const s = structures.get(level);
  console.log(
    `  ${level}: ` +
      (g ? `Grammatik ${g.taught}/${g.total} (${g.percent}%)` : 'Grammatik nicht messbar') +
      (d ? ` · Tiefe Median ${d.medianTeaching}/${d.medianProduction}` : '') +
      (s ? (s.anchored ? ` · Norm ${s.claimed.length}/${s.total}` : ' · ohne Norm') : '') +
      (w ? ` · Wortliste ${w.cards + w.grammar}/${w.total} (${w.percent}%)` : ' · keine Wortliste'),
  );
}
console.log(`  ${gaps().length} abgeleitete Lücken`);
if (loadNotes.length) {
  console.warn(`\n${loadNotes.length} Ladehinweis(e) — sie stehen auch im Kopf der Konsole:`);
  for (const note of loadNotes) console.warn(`  ${note}`);
}
