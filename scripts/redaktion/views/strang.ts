/**
 * View — Strang: one grammatical system, end to end, A1 → B1 and beyond.
 *
 * The view that answers *"show me Kasus from A1 to B1"* — the question the learner's own `helfen`
 * confusion came from, and the one the corpus could not be asked. The spiral was real and it was
 * prose: fifteen inventory rows carried "A1 teaches X, A2 deepens it to Y" inside a free-text
 * `note:`, and `scripts/grammar-coverage.ts` prints a note only when a point is NOT covered — so at
 * 100% every one of those relations was unprintable. They are `deepens:` edges now, and this is
 * where they are drawn.
 *
 * Breadth stands beside depth in every row on purpose. A ✓ and a ✗ answer "is it here"; the four
 * numbers next to them answer "how much of it is there", and the whole reason this console was
 * rebuilt is that the first was being read as if it answered the second.
 */
import {
  GRAMMAR_STRANDS,
  deepenedByPoint,
  depth,
  grammar,
  inventory,
  pointById,
  pointsByStrand,
  productionLevel,
  receptionLevel,
  type GrammarPoint,
} from '../model';
import { esc, pointRef, searchKey, table, tagRef, topicRef } from '../html';
import { STRAND_LABELS } from './sprachkarte';
import { focusIntroducedBy } from '@da/content/focus-tags';

const statusOf = (point: GrammarPoint) =>
  grammar.get(productionLevel(point))?.points.find((p) => p.point.id === point.id);

const MARK = { covered: '✓', late: '~', missing: '✗' } as const;

/** The ladder: a point, then everything that deepens it, indented, recursively. */
function ladder(point: GrammarPoint, seen: Set<string>, level = 0): GrammarPoint[] {
  if (seen.has(point.id)) return [];
  seen.add(point.id);
  const out = [point];
  for (const childId of (deepenedByPoint.get(point.id) ?? []).sort()) {
    const child = pointById.get(childId);
    // Only follow a child that belongs to the SAME strand here — a cross-strand `deepens` edge is
    // real (wechselpraepositionen builds on both a case row and a place row) and is shown on the
    // Struktur page instead, where it does not distort a single system's ladder.
    if (child && child.strand === point.strand) out.push(...ladder(child, seen, level + 1));
  }
  return out;
}

function depthCells(point: GrammarPoint): string[] {
  const d = depth.get(productionLevel(point))?.points.find((p) => p.point.id === point.id);
  if (!d) return ['—', '—', '—', '—'];
  const median = depth.get(productionLevel(point))?.medianTeaching ?? 0;
  const thin = d.teaching > 0 && d.teaching < median;
  return [
    `<span class="${thin ? 'status-missing' : ''}">${d.teaching}</span>`,
    String(d.production),
    d.probe === 0 && d.teaching > 0
      ? `<span class="status-missing" title="geübt, aber nie nach einem Intervall erneut gefragt">0</span>`
      : String(d.probe),
    String(d.checkpoint),
  ];
}

function sourceCell(point: GrammarPoint): string {
  const refs = point.claims ?? [];
  if (!refs.length)
    return `<span class="muted" title="keine Quellenzeile — diese Zeile trägt der Lehrwerksverlauf, nicht eine veröffentlichte Norm">beyond</span>`;
  const byDoc = new Map<string, number>();
  for (const ref of refs) {
    const doc = ref.slice(0, ref.indexOf(':'));
    byDoc.set(doc, (byDoc.get(doc) ?? 0) + 1);
  }
  return [...byDoc.entries()]
    .map(
      ([doc, n]) =>
        `<a class="tagcode" href="#quellen-${esc(doc)}" title="${esc(refs.filter((r) => r.startsWith(doc + ':')).join('\n'))}">${esc(doc)}<span class="karte-count">${n}</span></a>`,
    )
    .join(' ');
}

function strandBlock(strand: string): string {
  const points = pointsByStrand.get(strand as never) ?? [];
  const label = STRAND_LABELS[strand] ?? { de: strand, was: '' };

  // Order: roots first (nothing in this strand deepens them), then their ladders. A point that
  // deepens another is never shown before its base, which is what makes the column read as a path.
  const isChildHere = new Set(
    points.flatMap((p) => (p.deepens ?? []).filter((d) => pointById.get(d)?.strand === strand).map(() => p.id)),
  );
  const seen = new Set<string>();
  const ordered: { point: GrammarPoint; indent: number }[] = [];
  for (const root of points.filter((p) => !isChildHere.has(p.id))) {
    const chain = ladder(root, seen);
    for (const p of chain) {
      const base = (p.deepens ?? []).filter((d) => pointById.get(d)?.strand === strand);
      ordered.push({ point: p, indent: base.length ? 1 : 0 });
    }
  }
  // Anything a cycle or a cross-strand root left out still has to appear.
  for (const p of points) if (!seen.has(p.id)) ordered.push({ point: p, indent: 0 });

  const rows = ordered.map(({ point, indent }) => {
    const s = statusOf(point);
    const mark = s ? MARK[s.status] : '·';
    const early = receptionLevel(point) !== productionLevel(point);
    const owners = [...new Set((point.focus ?? []).map((t) => focusIntroducedBy[t]).filter(Boolean))] as string[];
    return [
      `<span class="status-${s?.status ?? 'none'}">${mark}</span>`,
      `<span class="lvl-pair"><span class="tag lvl-${esc(productionLevel(point))}">${esc(productionLevel(point))}</span>${early ? `<span class="karte-early" title="Norm erwartet Verstehen ab ${esc(receptionLevel(point))}">⌛${esc(receptionLevel(point))}</span>` : ''}</span>`,
      `<div class="${indent ? 'ladder-child' : ''}">${pointRef(point.id)}<div class="muted">${esc(point.de)}</div>${
        (point.deepens ?? []).length
          ? `<div class="rownote">vertieft ${(point.deepens ?? []).map((d) => pointRef(d)).join(' ')}</div>`
          : ''
      }</div>`,
      (point.focus ?? []).map(tagRef).join(' ') ||
        (point.reference_only ? '<span class="tag alt">reference_only</span>' : '<span class="muted">—</span>'),
      owners.length ? owners.map(topicRef).join(' ') : '<span class="muted">—</span>',
      ...depthCells(point),
      sourceCell(point),
    ];
  });

  const covered = ordered.filter(({ point }) => statusOf(point)?.status === 'covered').length;
  return `<div class="level-block" data-group data-search="${searchKey(strand, label.de, label.was, ...points.map((p) => p.id))}">
    <h3 id="strang-${esc(strand)}">${esc(label.de)} <span class="muted">— ${points.length} Strukturen, ${covered} gelehrt</span></h3>
    <p class="note">${esc(label.was)}</p>
    ${
      rows.length
        ? table(
            ['', 'Niveau', 'Struktur (Leiter)', 'Fokus-Tags', 'eingeführt von', 'Items', 'prod.', 'Probe', 'Chkpt', 'Quelle'],
            rows,
            'inv strang',
          )
        : '<p class="muted">keine Zeile in diesem Strang</p>'
    }
  </div>`;
}

export function renderStrang(): string {
  if (!inventory.length)
    return `<section class="view" id="view-strang" hidden><h2>Stränge</h2>
      <p class="note warnnote">Das Grammatik-Inventar konnte nicht gelesen werden.</p></section>`;

  return `<section class="view" id="view-strang" hidden>
    <h2>Stränge</h2>
    <p class="lede">Jedes grammatische System als eine Leiter von A1 nach oben. Eingerückte Zeilen <b>vertiefen</b> die Zeile darüber — die Spirale, die bis 2026-08-14 nur als Prosa in einem <code>note:</code>-Feld existierte und im Bericht genau dann verschwand, wenn der Punkt abgedeckt war.</p>
    <p class="note">Breite (✓ ~ ✗) steht neben Tiefe (Items · produktiv · Probe · Checkpoint), weil die erste als Antwort auf die zweite gelesen wurde. Eine rot gesetzte Item-Zahl liegt unter dem Median ihres Niveaus; eine rote 0 unter „Probe" heißt: geübt, aber nie nach einem Intervall erneut gefragt. <b>Quelle</b> nennt das Dokument, dessen Zeile diese Struktur belegt — <code>beyond</code> heißt, dass keine veröffentlichte Norm sie führt und der Lehrwerksverlauf sie trägt.</p>
    ${GRAMMAR_STRANDS.map(strandBlock).join('')}
  </section>`;
}
