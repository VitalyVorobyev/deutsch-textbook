/**
 * View — Sprachkarte: ten grammatical strands across every CEFR level the schema knows, with this
 * course painted onto it.
 *
 * This is the landing view, and the choice of spine is the argument. Every other view here starts
 * from the corpus and asks what is in it; this one starts from the LANGUAGE and asks how much of
 * it the course has reached. That is why the B2 column exists while the course reaches B1: a level
 * with no manifest cannot notice its own gaps, and A2 spent months calling itself complete at 67%
 * of its standard for exactly that reason. An empty column is a statement.
 *
 * The columns are `LEVELS` from `packages/schema/src/index.ts` — A1…B2 — and not a hand-written A1…C2. The
 * schema is where "which levels exist here" is decided, and a second list would be free to drift
 * from it; when C1 becomes a level this course models, this view grows a column without an edit.
 *
 * Cell states, and each is a different fact:
 *   ✓ taught      — a practice/drill item carries every tag the row names
 *   ~ spät        — taught, but by material one level away from where the row places it
 *   ✗ offen       — the row exists and nothing teaches it
 *   ⌛ rezeptiv    — the standard expects comprehension here; this course produces it later
 */
import {
  CEFR_COLUMNS,
  GRAMMAR_STRANDS,
  grammar,
  pointsByStrand,
  productionLevel,
  receptionLevel,
  structures,
  depth,
  inventory,
  type GrammarPoint,
} from '../model';
import { esc, searchKey, strandRef } from '../html';

const STRAND_LABELS: Record<string, { de: string; was: string }> = {
  satzklammer: {
    de: 'Satzklammer',
    was: 'Wo das Verb steht: Position 2, das Ende, und was dazwischen in welcher Reihenfolge liegt.',
  },
  satzverbindung: {
    de: 'Satzverbindung',
    was: 'Welcher Konnektor — und was er mit der Wortstellung macht.',
  },
  kasus: {
    de: 'Kasus',
    was: 'Welche Form, und wer sie verlangt: die Rolle im Satz, das Verb, die Präposition.',
  },
  nominalgruppe: {
    de: 'Nominalgruppe',
    was: 'Artikelwörter, Adjektivendungen, Vergleich, nominalisierte Adjektive.',
  },
  verbformen: {
    de: 'Verbformen',
    was: 'Tempus, Modus, Genus verbi, Präfixe — die Formen des Verbs selbst.',
  },
  verbvalenz: {
    de: 'Verbvalenz',
    was: 'Was ein Verb verlangt: Kasus, Präposition, Reflexivpronomen, festes Nomen.',
  },
  zeit: { de: 'Zeit', was: 'Zeitangaben als System: wann, seit wann, bis wann, wie lange.' },
  raum: { de: 'Raum', was: 'Wo, wohin, woher — welche Präposition der Ort selbst wählt.' },
  negation: { de: 'Negation', was: 'nicht und kein: welches Wort, und an welcher Stelle.' },
  'register-pragmatik': {
    de: 'Register & Pragmatik',
    was: 'du/Sie, Höflichkeit, Vorliebe — richtig gebaut und trotzdem falsch gesagt.',
  },
};

type CellState = 'covered' | 'late' | 'missing' | 'reception' | 'empty';

function cellFor(point: GrammarPoint): CellState {
  const level = productionLevel(point);
  const result = grammar.get(level)?.points.find((p) => p.point.id === point.id);
  if (!result) return 'empty';
  return result.status;
}

const MARK: Record<CellState, string> = {
  covered: '✓',
  late: '~',
  missing: '✗',
  reception: '⌛',
  empty: '·',
};

export function renderSprachkarte(): string {
  if (!inventory.length)
    return `<section class="view" id="view-sprachkarte">
      <h2>Sprachkarte</h2>
      <p class="note warnnote">Das Grammatik-Inventar konnte nicht gelesen werden — siehe die Ladehinweise oben.</p>
    </section>`;

  // A row per strand, a cell per CEFR level. A point sits in the column of its PRODUCTION level —
  // where this course asks the learner to build it — and carries a second marker when the standard
  // expects comprehension earlier, which is the thing one `standard_level` could never say.
  const rows = GRAMMAR_STRANDS.map((strand) => {
    const points = pointsByStrand.get(strand) ?? [];
    const cells = CEFR_COLUMNS.map((level) => {
      const here = points.filter((p) => productionLevel(p) === level);
      if (!here.length)
        return `<td class="karte-cell empty"><span class="muted">—</span></td>`;
      const chips = here
        .map((p) => {
          const state = cellFor(p);
          const early = receptionLevel(p) !== productionLevel(p);
          const d = depth.get(level)?.points.find((x) => x.point.id === p.id);
          const title =
            `${p.de}\n${p.en}` +
            (early ? `\nNorm erwartet Verstehen ab ${receptionLevel(p)}` : '') +
            (d ? `\n${d.teaching} Übungsitems, ${d.production} produktiv, ${d.probe} Probe-Items` : '');
          return `<a class="karte-chip st-${state}" href="#struktur-${esc(p.id)}" title="${esc(title)}" data-search="${searchKey(p.id, p.de, p.en, strand)}">
            <span class="karte-mark">${MARK[state]}</span>${esc(p.id)}${early ? `<span class="karte-early" title="Norm erwartet Verstehen ab ${esc(receptionLevel(p))}">⌛${esc(receptionLevel(p))}</span>` : ''}</a>`;
        })
        .join('');
      return `<td class="karte-cell">${chips}</td>`;
    }).join('');
    const label = STRAND_LABELS[strand] ?? { de: strand, was: '' };
    return `<tr data-search="${searchKey(strand, label.de, label.was)}">
      <th class="karte-strand" id="karte-${esc(strand)}">
        ${strandRef(strand, label.de)}
        <span class="karte-count">${points.length}</span>
        <span class="karte-was">${esc(label.was)}</span>
      </th>${cells}</tr>`;
  }).join('');

  const header = CEFR_COLUMNS.map((level) => {
    const g = grammar.get(level);
    const s = structures.get(level);
    const d = depth.get(level);
    const sub = g
      ? `${g.taught}/${g.total}`
      : inventory.some((p) => productionLevel(p) === level)
        ? 'nicht gemessen'
        : 'leer';
    const anchorNote = s?.anchored
      ? `${s.claimed.length}/${s.total} Quellenzeilen`
      : g
        ? 'ohne externe Quelle'
        : '';
    return `<th class="karte-head">
      <span class="karte-level">${esc(level)}</span>
      <span class="karte-sub">${esc(sub)}</span>
      <span class="karte-sub muted">${esc(anchorNote)}</span>
      ${d ? `<span class="karte-sub muted">Median ${d.medianTeaching} Items</span>` : ''}
    </th>`;
  }).join('');

  const future = CEFR_COLUMNS.filter((l) => !inventory.some((p) => productionLevel(p) === l));

  return `<section class="view" id="view-sprachkarte">
    <h2>Sprachkarte</h2>
    <p class="lede">Zehn grammatische Systeme über ${CEFR_COLUMNS.length} Niveaus — die Sprache als Raster, mit dem Kurs darauf gezeichnet. Jede Zelle steht für eine Inventarzeile auf dem Niveau, auf dem <b>dieser Kurs sie produzieren lässt</b>; <span class="karte-early">⌛</span> markiert die Zeilen, deren Norm das Verstehen früher erwartet.</p>
    <p class="note">Zeichen: <span class="st-covered karte-mark">✓</span> gelehrt · <span class="st-late karte-mark">~</span> ein Niveau versetzt gelehrt · <span class="st-missing karte-mark">✗</span> Zeile ohne Unterricht. ${future.length === 1 ? `Die Spalte <b>${esc(future[0]!)}</b> ist` : `Die Spalten ${future.map((l) => `<b>${esc(l)}</b>`).join(', ')} sind`} absichtlich leer: ein Niveau ohne Inventar kann seine eigenen Lücken nicht bemerken — genau der Zustand, in dem A2 monatelang „vollständig" hieß und bei 67% seiner Norm stand.</p>
    <div class="scroll"><table class="karte"><thead><tr><th class="karte-strand-head">Strang</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">Jede Zahl stammt aus denselben Modulen wie <code>bun scripts/grammar-coverage.ts</code>, <code>bun scripts/structures.ts</code> und <code>bun scripts/grammar-depth.ts</code>. Breite und Tiefe sind zwei Zahlen und ersetzen einander nicht: eine Spalte kann 100% melden und im Median vier Übungsitems je Verwechslung haben.</p>
  </section>`;
}

export { STRAND_LABELS };
