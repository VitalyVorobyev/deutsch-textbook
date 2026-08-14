/**
 * View — Lexik: the Sprachkarte's mirror on the vocabulary side, plus the one cross-link that
 * existed nowhere.
 *
 * The lexical instrument has always been the stronger of the two — `data/goethe-<level>-wortliste.txt`
 * is checkable page by page against a published PDF, which is exactly what the grammar side lacked
 * until 2026-08-14. What it could not do is talk to the grammar side.
 *
 * A leading `~` in a manifest means *the curriculum teaches this word as grammar, so it needs no
 * flashcard*. The validator checks that the word occurs in the taught surface — and nothing checks
 * that a grammar point exists behind it. So `und`, `oder` and `aber` carried a `~` at A1 while the
 * grammar inventory had no coordination row at any level: two instruments disagreeing about what
 * A1 contains, with nothing able to see the disagreement. The `~`-Belege table below is that check.
 */
import {
  CONSOLE_LEVELS,
  inventory,
  vocab,
  wortliste,
  type Level,
} from '../model';
import { esc, pct, pointRef, searchKey, table } from '../html';

/**
 * A very small keyword index from a grammar point to the function words it plausibly stands
 * behind. Deliberately a HEURISTIC and labelled as one in the view: it exists to surface the
 * `und/oder/aber` class of disagreement, not to certify that a `~` is paid for. A wrong "yes" here
 * would be worse than the silence it replaces, so the column says "sieht aus wie" and links to the
 * candidate rather than asserting a match.
 */
function candidatePoints(word: string): string[] {
  const w = word.toLowerCase();
  const out: string[] = [];
  for (const point of inventory) {
    const hay = `${point.de} ${point.en} ${(point.focus ?? []).join(' ')}`.toLowerCase();
    // Whole-word match against the row's own German text — the row names its words explicitly
    // (`aus, bei, mit, nach, seit, von, zu`), so a boundary match is precise enough to be useful
    // and blunt enough not to pretend to be more.
    if (new RegExp(`(^|[^a-zäöüß])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zäöüß]|$)`).test(hay))
      out.push(point.id);
  }
  return out;
}

function levelBlock(level: Level): string {
  const w = wortliste.get(level);
  if (!w)
    return `<div class="level-block" data-group><h3 id="lexik-${esc(level)}">${esc(level)}</h3>
      <p class="note">Kein <code>data/goethe-${esc(level.toLowerCase())}-wortliste.txt</code> — dieses Niveau hat keine Abdeckungszahl und darf keine behaupten.</p></div>`;

  const sectionRows = w.sections.map((s) => [
    esc(s.name),
    String(s.covered.length + s.grammar.length + s.missing.length),
    String(s.covered.length),
    s.grammar.length ? String(s.grammar.length) : '<span class="muted">0</span>',
    s.missing.length ? `<span class="status-missing">${s.missing.length}</span>` : '0',
    s.unearned.length ? `<span class="status-missing">${s.unearned.length}</span>` : '<span class="muted">—</span>',
  ]);

  // The cross-link. Every `~` word of this level, and whether any grammar row plausibly stands
  // behind it.
  const tildeWords = w.sections.flatMap((s) => [...s.grammar, ...s.unearned]).sort();
  const tildeRows = tildeWords.map((word) => {
    const candidates = candidatePoints(word);
    return [
      `<code>${esc(word)}</code>`,
      candidates.length
        ? candidates.slice(0, 4).map((id) => pointRef(id)).join(' ') +
          (candidates.length > 4 ? ` <span class="muted">+${candidates.length - 4}</span>` : '')
        : '<span class="status-missing">keine Inventarzeile nennt dieses Wort</span>',
      w.unearned.includes(word) ? '<span class="status-missing">unbelegtes ~</span>' : '',
    ];
  });
  const unmatched = tildeRows.filter((r) => r[1]!.includes('status-missing')).length;

  return `<div class="level-block" data-group data-search="${searchKey(level, ...tildeWords)}">
    <h3 id="lexik-${esc(level)}">${esc(level)} <span class="muted">— ${w.cards + w.grammar}/${w.total} (${pct(w.percent)})</span></h3>
    <div class="metric">
      <div class="bar"><span class="bar-cards" style="width:${(100 * w.cards) / w.total}%"></span><span class="bar-grammar" style="width:${(100 * w.grammar) / w.total}%"></span></div>
      <div class="metric-sub">${w.cards} als Karten · ${w.grammar} als Grammatik (<code>~</code>) · ${w.missing} fehlen${w.unearned.length ? ` · <span class="status-missing">${w.unearned.length} unbelegte <code>~</code></span>` : ''}</div>
    </div>
    <details><summary>Abschnitte des Manifests</summary>
      ${table(['Abschnitt', 'gesamt', 'Karten', '~ Grammatik', 'fehlen', 'unbelegt'], sectionRows, 'compact')}
    </details>
    <h4><code>~</code>-Belege <span class="muted">${tildeWords.length} Wörter, ${unmatched} ohne passende Inventarzeile</span></h4>
    <p class="note">Ein <code>~</code> behauptet: <i>der Lehrplan lehrt dieses Wort als Grammatik, eine Karte braucht es nicht.</i> Der Validator prüft, dass das Wort in der gelehrten Oberfläche vorkommt — nicht, dass eine Grammatikzeile dahintersteht. Genau so trugen <code>und</code>, <code>oder</code> und <code>aber</code> auf A1 ein <code>~</code>, während das Inventar auf keinem Niveau eine Zeile für die Satzverbindung hatte. <b>Die Zuordnung unten ist eine Heuristik</b> (Wortgrenzen-Treffer im deutschen Text der Zeile) und beweist nichts; sie zeigt nur, wo nichts einmal <i>aussieht</i> wie ein Beleg.</p>
    ${table(['Wort', 'sieht aus wie', ''], tildeRows, 'compact')}
  </div>`;
}

export function renderLexik(): string {
  const decks = [...vocab.values()];
  const byLevel = new Map<string, number>();
  for (const d of decks) byLevel.set(d.data.level, (byLevel.get(d.data.level) ?? 0) + (d.data.entries?.length ?? 0));

  return `<section class="view" id="view-lexik" hidden>
    <h2>Lexik</h2>
    <p class="lede">Das Gegenstück zur Sprachkarte auf der Wortschatzseite — und die Verbindung zwischen beiden, die es bisher nirgends gab: welche Grammatikzeile hinter einem <code>~</code>-Wort steht.</p>
    <p class="note">${decks.length} Decks · ${[...byLevel.entries()].sort().map(([l, n]) => `${esc(l)}: ${n} Einträge`).join(' · ')}. Zahlen aus demselben Modul wie <code>bun scripts/coverage.ts</code>.</p>
    ${CONSOLE_LEVELS.map(levelBlock).join('')}
  </section>`;
}
