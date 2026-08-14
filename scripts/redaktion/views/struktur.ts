/**
 * View — Struktur: one grammar point, everything that touches it.
 *
 * The node page the whole graph converges on. Arriving here from the Sprachkarte, a strand ladder,
 * a source entry, a focus tag or a topic, an editor sees the same five things every time: what the
 * row claims, which published entries back it, how much practice stands behind it, what re-checks
 * it, and where in the prose it is actually explained.
 *
 * The last one is the weakest link and the page says so: an inventory row names a confusion, an
 * article is supposed to give that confusion its own `### ` subsection, and twenty of forty-nine
 * articles have none — so for those the honest answer to "where is this explained" is a whole
 * article rather than a place in one.
 */
import {
  deepenedByPoint,
  depth,
  grammar,
  inventory,
  itemsByTag,
  productionLevel,
  receptionLevel,
  sources,
  topics,
  type GrammarPoint,
} from '../model';
import { backlinks, chip, esc, pointRef, searchKey, strandRef, table, tagRef, topicRef } from '../html';
import { STRAND_LABELS } from './sprachkarte';
import { focusIntroducedBy } from '../../../src/lib/focus-tags';

/** entry ref → the source entry itself, for rendering a citation as its published wording. */
function entryIndex() {
  const out = new Map<string, { sourceId: string; section: string; page?: number; de: string; note?: string; specified?: string }>();
  for (const src of sources)
    for (const section of src.sections)
      for (const entry of section.entries)
        out.set(`${src.source.id}:${entry.key}`, {
          sourceId: src.source.id,
          section: section.de,
          page: section.page,
          de: entry.de,
          note: entry.note,
          specified: entry.specified,
        });
  return out;
}
const ENTRIES = entryIndex();

function renderPoint(point: GrammarPoint): string {
  const prod = productionLevel(point);
  const rec = receptionLevel(point);
  const status = grammar.get(prod)?.points.find((p) => p.point.id === point.id);
  const d = depth.get(prod)?.points.find((p) => p.point.id === point.id);
  const median = depth.get(prod)?.medianTeaching ?? 0;
  const owners = [...new Set((point.focus ?? []).map((t) => focusIntroducedBy[t]).filter(Boolean))] as string[];

  const citations = (point.claims ?? []).map((ref) => {
    const e = ENTRIES.get(ref);
    if (!e) return [`<code class="dangling">${esc(ref)}</code>`, '', ''];
    return [
      `<a class="tagcode" href="#quellen-${esc(e.sourceId)}">${esc(e.sourceId)}</a>`,
      `${esc(e.section)}${e.page ? ` <span class="muted">S. ${e.page}</span>` : ''}`,
      `${esc(e.de)}${e.specified ? `<div class="rownote">in der Quelle nur ${esc(e.specified)}</div>` : ''}${e.note ? `<div class="rownote">${esc(e.note)}</div>` : ''}`,
    ];
  });

  const tagRows = (point.focus ?? []).map((tag) => {
    const t = depth.get(prod)?.tags.find((x) => x.tag === tag);
    const items = itemsByTag.get(tag) ?? [];
    const byRole = new Map<string, number>();
    for (const i of items) byRole.set(i.set.data.role ?? 'practice', (byRole.get(i.set.data.role ?? 'practice') ?? 0) + 1);
    return [
      tagRef(tag),
      focusIntroducedBy[tag] ? topicRef(focusIntroducedBy[tag]!) : '<span class="status-missing">nicht registriert</span>',
      t ? `<span class="${t.teaching > 0 && t.teaching < median ? 'status-missing' : ''}">${t.teaching}</span>` : '0',
      t ? String(t.production) : '0',
      t ? String(t.files) : '0',
      t ? (t.probe === 0 && t.teaching > 0 ? '<span class="status-missing">0</span>' : String(t.probe)) : '0',
      [...byRole.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([r, n]) => `<span class="hist"><span class="hist-k">${esc(r)}</span><span class="hist-v">${n}</span></span>`)
        .join(''),
    ];
  });

  // Where the prose explains it: the `### ` subsections of the owning topics' `## Erklärung`.
  const explainedIn = owners.map((id) => {
    const t = topics.get(id);
    if (!t) return `<div class="teacher">${topicRef(id)} <span class="status-missing">kein Artikel</span></div>`;
    return `<div class="teacher">${topicRef(id)} ${
      t.erklaerungSubsections.length
        ? t.erklaerungSubsections.map((h) => `<span class="chip none">${esc(h)}</span>`).join('')
        : '<span class="status-missing" title="CLAUDE.md verlangt einen ###-Abschnitt je benannter Verwechslung">Erklärung ohne ###-Abschnitte</span>'
    }</div>`;
  });

  const marks = [
    status
      ? chip(
          status.status === 'covered' ? 'ok' : status.status === 'late' ? 'warn' : 'miss',
          status.status === 'covered' ? 'gelehrt' : status.status === 'late' ? `spät (${status.taughtAt})` : 'offen',
          status.unmetTags.length ? `kein practice/drill-Item trägt: ${status.unmetTags.join(', ')}` : '',
        )
      : '',
    point.reference_only ? chip('info', 'reference_only', 'benennt keine Verwechslung — bezahlt mit taught_in') : '',
    (point.claims ?? []).length
      ? chip('ok', `${(point.claims ?? []).length} Quellenzeilen`)
      : chip('none', 'beyond', 'keine veröffentlichte Norm führt diese Zeile — der Lehrwerksverlauf trägt sie'),
    rec !== prod ? chip('info', `Norm: verstehen ab ${rec}`, 'Die Quelle erwartet Verstehen früher, als dieser Kurs produzieren lässt') : '',
    d && d.teaching === 0 ? chip('miss', 'kein Item') : '',
    d && d.teaching > 0 && d.probe === 0 ? chip('warn', 'keine Probe', 'geübt, aber nie nach einem Intervall erneut gefragt') : '',
  ]
    .filter(Boolean)
    .join('');

  return `<article class="topic-card" id="struktur-${esc(point.id)}" data-search="${searchKey(point.id, point.de, point.en, point.strand, ...(point.focus ?? []), ...(point.claims ?? []))}">
    <header class="topic-head">
      <h3>${esc(point.de)}</h3>
      <div class="topic-meta">
        <code class="row-id">${esc(point.id)}</code>
        ${point.strand ? strandRef(point.strand, STRAND_LABELS[point.strand]?.de ?? point.strand) : '<span class="status-missing">ohne Strang</span>'}
        <span class="tag lvl-${esc(prod)}">produzieren ${esc(prod)}</span>
        <span class="tag alt">verstehen ${esc(rec)}</span>
      </div>
      <div class="titles"><div class="lang"><b>en</b> ${esc(point.en)}</div></div>
      <div class="badges">${marks}</div>
      ${point.note ? `<p class="rownote">${esc(point.note)}</p>` : ''}
    </header>

    <h4>Spirale</h4>
    ${backlinks([
      {
        label: 'vertieft',
        links: (point.deepens ?? []).map((d) => pointRef(d)),
        hint: 'Zeilen, über denen diese hier der tiefere Durchgang ist',
      },
      {
        label: 'wird vertieft von',
        links: (deepenedByPoint.get(point.id) ?? []).map((d) => pointRef(d)),
        hint: 'spätere Zeilen, die auf dieser aufbauen',
      },
    ])}

    <h4>Quellenbeleg <span class="muted">${citations.length}</span></h4>
    ${
      citations.length
        ? table(['Dokument', 'Abschnitt', 'Zeile, wie veröffentlicht'], citations, 'inv')
        : '<p class="note">Keine — <b>beyond</b>. Keine der hier hinterlegten Normen führt diese Struktur; sie steht im Kurs, weil der Lehrwerksverlauf und das B1-Ziel sie verlangen. Das ist eine Entscheidung und keine Lücke, aber es soll sichtbar sein.</p>'
    }

    <h4>Fokus-Tags und Tiefe <span class="muted">${tagRows.length}</span></h4>
    ${
      tagRows.length
        ? table(['Tag', 'eingeführt von', 'Items', 'produktiv', 'Dateien', 'Probe', 'nach Rolle'], tagRows, 'inv')
        : '<p class="muted">keine Tags — reference_only</p>'
    }

    <h4>Wo es erklärt wird</h4>
    <div class="edges">${explainedIn.length ? explainedIn.join('') : '<span class="muted">kein Thema führt einen Tag dieser Zeile ein</span>'}</div>
    ${(point.taught_in ?? []).length ? `<div class="edge"><span class="edge-label">taught_in</span>${(point.taught_in ?? []).map(topicRef).join(' ')}</div>` : ''}
  </article>`;
}

export function renderStruktur(): string {
  if (!inventory.length)
    return `<section class="view" id="view-struktur" hidden><h2>Strukturen</h2>
      <p class="note warnnote">Das Grammatik-Inventar konnte nicht gelesen werden.</p></section>`;

  const ordered = [...inventory].sort(
    (a, b) =>
      (a.strand ?? '').localeCompare(b.strand ?? '') || a.id.localeCompare(b.id),
  );
  return `<section class="view" id="view-struktur" hidden>
    <h2>Strukturen</h2>
    <p class="lede">Eine Seite je Inventarzeile: was sie beansprucht, welche veröffentlichten Zeilen sie belegen, wie viel Übung dahintersteht, was sie erneut prüft, und an welcher Stelle im Artikel sie erklärt wird.</p>
    <p class="note">Von hier führt jeder Weg weiter — Strang, Fokus-Tag, Thema, Quelle. Umgekehrt verlinken alle vier hierher, damit eine Struktur von jeder Seite aus dieselbe Adresse hat.</p>
    ${ordered.map(renderPoint).join('')}
  </section>`;
}
