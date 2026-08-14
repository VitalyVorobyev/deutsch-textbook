/**
 * View — Lücken: the gap inbox.
 *
 * Every other view answers a question about something that exists. This one answers the question
 * nothing in the repo could ask: *what is missing*. Each class below was invisible for the same
 * structural reason — no single artifact can see it. A topic file cannot know its Erklärung has no
 * subsections *relative to a rule in CLAUDE.md*; an inventory row cannot know that no probe ever
 * re-asks it; a Wortliste `~` cannot know that no grammar point stands behind the structure it is
 * standing in for. Only a graph over all of them can, and until 2026-08-14 there was no graph.
 *
 * It is an inbox and not a scoreboard. Nothing here is a failure by itself: a `beyond` row is a
 * decision, a thin tag may be a small confusion, and an unanchored level is a book nobody has
 * bought. What the list refuses is the third state — a gap that is neither closed nor decided nor
 * written down.
 */
import { GAP_LABELS, gaps, type Gap } from '../model';
import { esc, path, searchKey, table } from '../html';

const ORDER: Gap['kind'][] = [
  'unanchored-level',
  'unclaimed-structure',
  'untaught-point',
  'no-probe',
  'no-erklaerung-subsections',
  'single-file-tag',
  'thin-tag',
];

export function renderLuecken(): string {
  const all = gaps();
  const byKind = new Map<Gap['kind'], Gap[]>();
  for (const gap of all) byKind.set(gap.kind, [...(byKind.get(gap.kind) ?? []), gap]);

  const blocks = ORDER.filter((kind) => byKind.has(kind))
    .map((kind) => {
      const rows = byKind.get(kind)!;
      const label = GAP_LABELS[kind];
      return `<div class="level-block" data-group data-search="${searchKey(kind, label.de, ...rows.map((r) => r.what))}">
        <h3 id="luecken-${esc(kind)}">${esc(label.de)} <span class="muted">— ${rows.length}</span></h3>
        <p class="note">${esc(label.why)}</p>
        ${table(
          ['Niveau', 'was', 'wo', 'Hinweis'],
          rows.map((g) => [
            g.level ? `<span class="tag lvl-${esc(g.level)}">${esc(g.level)}</span>` : '<span class="muted">—</span>',
            g.route ? `<a class="topic-link" href="${esc(g.route)}">${esc(g.what)}</a>` : esc(g.what),
            g.where.includes('/') && g.where.includes('.') ? path(g.where) : `<code>${esc(g.where)}</code>`,
            g.detail ? `<span class="muted">${esc(g.detail)}</span>` : '',
          ]),
          'inv',
        )}
      </div>`;
    })
    .join('');

  const summary = ORDER.filter((k) => byKind.has(k))
    .map(
      (k) =>
        `<a class="kpi" href="#luecken-${esc(k)}"><b>${byKind.get(k)!.length}</b><span>${esc(GAP_LABELS[k].de)}</span></a>`,
    )
    .join('');

  return `<section class="view" id="view-luecken" hidden>
    <h2>Lücken</h2>
    <p class="lede">Was fehlt — abgeleitet, nie von Hand gepflegt. Jede Klasse hier ist eine Frage, die kein einzelnes Artefakt über sich selbst beantworten kann, und das ist der Grund, warum sie alle unsichtbar waren.</p>
    <div class="kpis">${summary}</div>
    <p class="note">Kein Eintrag ist für sich genommen ein Fehler. Eine <code>beyond</code>-Zeile ist eine Entscheidung, ein dünner Tag kann eine kleine Verwechslung sein, ein Niveau ohne Quelle ist ein ungekauftes Buch. Was diese Liste ausschließt, ist der dritte Zustand: eine Lücke, die weder geschlossen noch entschieden noch aufgeschrieben ist.</p>
    ${blocks || '<p class="note">Keine abgeleiteten Lücken — was angesichts der Klassen oben unwahrscheinlich genug ist, um den Lader zu prüfen.</p>'}
  </section>`;
}
