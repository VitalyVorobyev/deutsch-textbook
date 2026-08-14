/**
 * View — Quellen: every external standard, what it authorises, and which of its entries no row
 * claims.
 *
 * The denominator's denominator, rendered. `bun scripts/structures.ts` computes it; this shows it
 * beside the document that says it, with the page number, so a disputed row can be checked against
 * the PDF in one step instead of being argued from memory.
 *
 * The absent sources matter as much as the present ones and get their own block: B1 has no anchor
 * at all until its Prüfungsziele is bought, Goethe delegates B2 to *Profile deutsch*, and states
 * that no C1 inventory exists. Writing that down is the difference between "we have not measured
 * B1" and "B1 is fine".
 */
import {
  claimsByEntry,
  sources,
  structures,
  CONSOLE_LEVELS,
  pointById,
  productionLevel,
  type Level,
} from '../model';
import { esc, pointRef, searchKey, table } from '../html';

/** What is known to exist and is not here. Facts, each with the evidence that established it. */
const MISSING_SOURCES: { level: string; what: string; why: string; how: string }[] = [
  {
    level: 'A2',
    what: 'Goethe-Zertifikat A2 (Erwachsene) · Prüfungsziele',
    why: 'Die freie A2-Strukturenliste hier stammt aus *Fit in Deutsch 2*, der Jugendprüfung. Beide zertifizieren dasselbe Niveau, aber keine Zeile darf behaupten, die Erwachsenenprüfung verlange etwas, weil die Jugendprüfung es führt.',
    how: 'nicht frei veröffentlicht',
  },
  {
    level: 'B1',
    what: 'Goethe-/ÖSD-Zertifikat B1 · Prüfungsziele, Testbeschreibung',
    why: 'B1 hat **keine** externe Quelle. Alle 32 B1-Zeilen sind `beyond` — sie ruhen auf dem Lehrwerksverlauf allein, und genau in diesem Zustand meldete A1 monatelang 100% gegen eine unvollständige Liste.',
    how: 'ISBN 978-3-19-031868-1 (Hueber), gedruckt zu kaufen',
  },
  {
    level: 'B2',
    what: 'Profile deutsch',
    why: 'Goethe verweist für B2 ausdrücklich weiter: „Eine Zusammenstellung der sprachlichen Mittel (Grammatik und Wortschatz) … findet sich auf der CD-ROM zu Profile deutsch (2005)" (Prüfungsziele B2, §4.4). Profile deutsch ist zugleich die vom Europarat geführte Reference Level Description für Deutsch und die einzige Quelle, die Grammatik über A1–C2 hinweg einem Niveau zuordnet.',
    how: 'ISBN 978-3-468-49410-9, Buch mit CD-ROM',
  },
  {
    level: 'C1+',
    what: '— es gibt keine',
    why: 'Goethe schreibt es selbst hin: „Wortschatz- und Grammatikinventare zum Goethe-Zertifikat C1 gibt es aus folgenden Gründen nicht …" (Prüfungsziele C1, §4.4). Ein fehlendes Inventar ist hier kein Versäumnis, sondern die Aussage der Norm.',
    how: 'existiert nicht',
  },
];

function sourceBlock(sourceId: string): string {
  const src = sources.find((s) => s.source.id === sourceId);
  if (!src) return '';
  const meta = src.source;

  const rows = src.sections.flatMap((section) =>
    section.entries.map((entry) => {
      const ref = `${meta.id}:${entry.key}`;
      const owners = claimsByEntry.get(ref) ?? [];
      const produced = owners
        .map((id) => pointById.get(id))
        .filter(Boolean)
        .map((p) => productionLevel(p!));
      const later = produced.filter((l) => l !== entry.level);
      return [
        owners.length ? '<span class="status-covered">✓</span>' : '<span class="status-missing">✗</span>',
        `<span class="tag lvl-${esc(entry.level)}">${esc(entry.level)}</span>`,
        `${esc(section.de)}${section.page ? ` <span class="muted">S. ${section.page}</span>` : ''}`,
        `${esc(entry.de)}${entry.specified ? `<div class="rownote">in der Quelle nur ${esc(entry.specified)}</div>` : ''}${entry.note ? `<div class="rownote">${esc(entry.note)}</div>` : ''}`,
        owners.length
          ? owners.map((id) => pointRef(id)).join(' ') +
            (later.length ? ` <span class="karte-early" title="Diese Norm führt die Struktur auf ${esc(entry.level)}; dieser Kurs lässt sie auf ${esc([...new Set(later)].join('/'))} produzieren">→ ${esc([...new Set(later)].join('/'))}</span>` : '')
          : '<span class="muted">keine Inventarzeile</span>',
      ];
    }),
  );

  const claimed = rows.filter((r) => r[0]!.includes('covered')).length;

  return `<div class="level-block" data-group data-search="${searchKey(meta.id, meta.title, meta.publisher, ...src.sections.flatMap((s) => s.entries.map((e) => e.de)))}">
    <h3 id="quellen-${esc(meta.id)}">${esc(meta.title)}
      <span class="muted">— ${rows.length} Zeilen, ${claimed} belegt</span>
      ${meta.status === 'retired' ? '<span class="chip warn">zurückgezogen</span>' : ''}
      ${meta.mode ? `<span class="chip info">${esc(meta.mode)}</span>` : ''}
    </h3>
    <p class="note">
      <code>${esc(meta.id)}</code> · ${esc(meta.publisher ?? '')}${meta.edition ? ` · ${esc(meta.edition)}` : ''}${meta.chapter ? ` · ${esc(meta.chapter)}` : ''}${meta.pages ? `, S. ${esc(meta.pages)}` : ''}
      ${meta.audience ? ` · Zielgruppe ${esc(meta.audience)}` : ''}
      ${meta.retrieved ? ` · geholt ${esc(meta.retrieved)}` : ''}<br>
      ${meta.url ? `<a class="doc" href="${esc(meta.url)}">${esc(meta.url)} ↗</a><br>` : ''}
      ${meta.local ? `lokal: <code>${esc(meta.local)}</code> (gitignored, ADR 0009)` : ''}
      ${meta.mode === 'reception' ? '<br><b>Diese Liste regelt das Verstehen, nicht das Produzieren</b> — so sagt es das Dokument über sich selbst. Eine Zeile, die dieser Kurs später produzieren lässt, ist eine Reihenfolgeentscheidung und keine Lücke.' : ''}
      ${meta.status === 'retired' ? '<br><b>Zurückgezogene Prüfung.</b> Keine Zeile hier ist eine geltende Anforderung; die Liste steht hier, weil ihr Strukturumfang breiter ist als die einzige frei verfügbare aktuelle A2-Liste.' : ''}
    </p>
    ${table(['', 'Niveau', 'Abschnitt', 'Zeile, wie veröffentlicht', 'belegt durch'], rows, 'inv')}
  </div>`;
}

export function renderQuellen(): string {
  const beyondBlocks = CONSOLE_LEVELS.map((level: Level) => {
    const s = structures.get(level);
    if (!s?.anchored || !s.beyond.length) return '';
    return `<div class="level-block" data-group>
      <h3 id="quellen-beyond-${esc(level)}">${esc(level)} · <span class="muted">${s.beyond.length} Zeilen ohne Quellenbeleg</span></h3>
      <p class="note">Legitim: dieser Kurs zielt auf B1 und folgt einem Lehrwerksverlauf, lehrt also Strukturen, die Start Deutsch nie geprüft hat. Aufgeführt, damit die Entscheidung sichtbar ist — nicht, damit sie behoben wird.</p>
      <div class="badges">${s.beyond.map((p) => pointRef(p.id)).join(' ')}</div>
    </div>`;
  }).join('');

  const missingRows = MISSING_SOURCES.map((m) => [
    `<span class="tag lvl-${esc(m.level.replace('+', ''))}">${esc(m.level)}</span>`,
    `<b>${esc(m.what)}</b><div class="rownote">${m.why}</div>`,
    `<span class="muted">${esc(m.how)}</span>`,
  ]);

  return `<section class="view" id="view-quellen" hidden>
    <h2>Quellen</h2>
    <p class="lede">Die veröffentlichten Normen, gegen die sich das Inventar dieses Kurses messen lässt — und, Zeile für Zeile, welche davon keine Inventarzeile belegt. Was hier <span class="status-missing">✗</span> trägt, ist eine Lücke im <b>Nenner</b>, nicht im Unterricht: eine Struktur, die eine Prüfung führt und die dieser Kurs nicht einmal aufgelistet hatte.</p>
    <p class="note">Übernommen wird ausschließlich die <b>Strukturbezeichnung</b> in der Reihenfolge des Dokuments; kein Beispielsatz aus einer Quelle steht in diesem Repository. Dieselbe Grenze halten die Wortlisten-Manifeste. Erzeugt aus <code>data/strukturenlisten/</code>, gemessen von <code>bun scripts/structures.ts</code>.</p>
    ${sources.map((s) => sourceBlock(s.source.id)).join('')}
    ${beyondBlocks}
    <div class="level-block" data-group>
      <h3 id="quellen-fehlend">Was fehlt, und was es kostet</h3>
      <p class="note">Der ehrliche Weltzustand, nicht eine vergessene Aufgabenliste. Ein Niveau ohne Quelle wird von <code>scripts/structures.ts</code> als <code>anchored: false</code> gemeldet und gerade <b>nicht</b> als „alles belegt".</p>
      ${table(['Niveau', 'Dokument', 'Zugang'], missingRows, 'inv')}
    </div>
  </section>`;
}
