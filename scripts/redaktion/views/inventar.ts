/**
 * View — Inventar: every row of `data/grammar-inventory.yaml`, grouped by the level this course
 * authors PRODUCTION for.
 *
 * Three changes from the pre-navigator console, each closing a way the file lied about itself:
 *
 *   - **`note:` is always rendered.** `scripts/grammar-coverage.ts` prints a note only when a
 *     point is not covered, so at 100% the fifteen rows carrying "A1 teaches X, A2 deepens it"
 *     were unprintable. The console has no reason to hide the reasoning of a row that passes.
 *   - **Strand, source and depth stand beside the status.** A ✓ says the structure exists; it took
 *     four more numbers to say how much of it does.
 *   - **The ⌛ marker** shows where a published standard expects comprehension earlier than this
 *     course asks for production — a sequencing decision that a single `standard_level` could not
 *     express and that therefore looked like a defect.
 */
import {
  CEFR_COLUMNS,
  depth,
  grammar,
  inventory,
  productionLevel,
  receptionLevel,
  structures,
  topics,
  type GrammarPoint,
  type Level,
} from '../model';
import { chip, esc, pointRef, searchKey, strandRef, tagRef, topicRef } from '../html';
import { STRAND_LABELS } from './sprachkarte';
import { focusIntroducedBy } from '@da/content/focus-tags';

export function renderInventar(): string {
  const byLevel = new Map<string, GrammarPoint[]>();
  for (const p of inventory) {
    const lvl = productionLevel(p);
    byLevel.set(lvl, [...(byLevel.get(lvl) ?? []), p]);
  }

  const blocks = [...byLevel.keys()]
    .sort((a, b) => CEFR_COLUMNS.indexOf(a as Level) - CEFR_COLUMNS.indexOf(b as Level))
    .map((level) => {
      const points = byLevel.get(level)!;
      const cov = grammar.get(level as Level);
      const d = depth.get(level as Level);
      const s = structures.get(level as Level);
      const statusOf = new Map((cov?.points ?? []).map((r) => [r.point.id, r]));

      const rows = points.map((point) => {
        const result = statusOf.get(point.id);
        const dep = d?.points.find((p) => p.point.id === point.id);
        const median = d?.medianTeaching ?? 0;
        const teachers = point.reference_only
          ? (point.taught_in ?? []).map((t) => ({ topic: t, tag: undefined as string | undefined }))
          : (point.focus ?? []).map((tag) => ({ topic: focusIntroducedBy[tag], tag }));
        const teacherCells = teachers.length
          ? teachers
              .map(({ topic, tag }) => {
                if (!topic)
                  return `<div class="teacher"><span class="status-missing">nicht registriert</span>${tag ? ` ${tagRef(tag)}` : ''}</div>`;
                const tLevel = topics.get(topic)?.data.level;
                const mismatch = tLevel && tLevel !== level;
                return `<div class="teacher${mismatch ? ' mismatch' : ''}">${topicRef(topic)} <span class="tag lvl-${esc(tLevel ?? '')}">${esc(tLevel ?? '?')}</span>${mismatch ? `<span class="flag over" title="Zeile wird auf ${esc(level)} produziert, gelehrt wird sie im ${esc(tLevel)}-Material">▲</span>` : ''}${tag ? ` ${tagRef(tag)}` : ''}</div>`;
              })
              .join('')
          : '<span class="muted">—</span>';
        const marks = [
          point.reference_only ? chip('info', 'reference_only', 'benennt keine Verwechslung — bezahlt mit taught_in') : '',
          result
            ? chip(
                result.status === 'covered' ? 'ok' : result.status === 'late' ? 'warn' : 'miss',
                result.status === 'covered' ? 'abgedeckt' : result.status === 'late' ? `spät (${result.taughtAt})` : 'fehlt',
                result.unmetTags.length ? `kein practice/drill-Item trägt: ${result.unmetTags.join(', ')}` : '',
              )
            : '',
          (point.claims ?? []).length
            ? chip('ok', `${(point.claims ?? []).length} Quellen`, (point.claims ?? []).join('\n'))
            : chip('none', 'beyond', 'keine veröffentlichte Norm führt diese Zeile'),
        ]
          .filter(Boolean)
          .join('');

        return [
          `${pointRef(point.id)}${marks ? `<div class="badges">${marks}</div>` : ''}`,
          point.strand ? strandRef(point.strand, STRAND_LABELS[point.strand]?.de ?? point.strand) : '<span class="status-missing">—</span>',
          `<span class="lvl-pair"><span class="tag lvl-${esc(productionLevel(point))}">${esc(productionLevel(point))}</span>${
            receptionLevel(point) !== productionLevel(point)
              ? `<span class="karte-early" title="Die Norm erwartet Verstehen ab ${esc(receptionLevel(point))}">⌛${esc(receptionLevel(point))}</span>`
              : ''
          }</span>`,
          // `note:` unconditionally — see the module comment. It carries the reasoning a row cannot
          // encode as data, and it was invisible in every report at exactly the moment everything passed.
          `<div><b>${esc(point.de)}</b></div><div class="muted">${esc(point.en)}</div>${point.note ? `<div class="rownote">${esc(point.note)}</div>` : ''}${
            (point.deepens ?? []).length
              ? `<div class="rownote">vertieft ${(point.deepens ?? []).map((x) => pointRef(x)).join(' ')}</div>`
              : ''
          }`,
          dep
            ? `<span class="${dep.teaching > 0 && dep.teaching < median ? 'status-missing' : ''}">${dep.teaching}</span> · ${dep.production} prod · ${
                dep.probe === 0 && dep.teaching > 0 ? '<span class="status-missing">0</span>' : dep.probe
              } Probe`
            : '<span class="muted">—</span>',
          teacherCells,
        ];
      });

      return `<div class="level-block" data-group>
        <h3 id="inventar-${esc(level)}">${esc(level)} <span class="muted">— ${points.length} Zeilen${cov ? `, ${cov.taught}/${cov.total} gelehrt` : ''}${d ? `, Median ${d.medianTeaching} Items je Verwechslung` : ''}</span></h3>
        ${
          s
            ? `<p class="note">${
                s.anchored
                  ? `Externe Norm: <b>${s.claimed.length}/${s.total}</b> veröffentlichte Zeilen belegt, ${s.unclaimed.length} ohne Inventarzeile, ${s.beyond.length} Zeilen <code>beyond</code>. <a href="#view-quellen">Quellen ansehen</a>.`
                  : '<span class="status-missing">Ohne externe Quelle</span> — dieses Niveau misst sich nur an sich selbst. <a href="#quellen-fehlend">Welches Dokument fehlt.</a>'
              }</p>`
            : ''
        }
        <div class="scroll"><table class="inv"><thead><tr><th>Punkt</th><th>Strang</th><th>Niveau</th><th>Struktur, Beschreibung &amp; Begründung</th><th>Tiefe</th><th>eingeführt von</th></tr></thead><tbody>
        ${rows
          .map(
            (r, i) =>
              `<tr data-search="${searchKey(points[i]!.id, points[i]!.de, points[i]!.en, points[i]!.strand, ...(points[i]!.focus ?? []), ...(points[i]!.taught_in ?? []))}">${r.map((c) => `<td>${c}</td>`).join('')}</tr>`,
          )
          .join('')}
        </tbody></table></div>
      </div>`;
    })
    .join('');

  return `<section class="view" id="view-inventar" hidden>
    <h2>Inventar</h2>
    <p class="lede">Jede Zeile aus <code>data/grammar-inventory.yaml</code>, gruppiert nach dem Niveau, auf dem <b>dieser Kurs sie produzieren lässt</b>. ⌛ markiert die Zeilen, deren veröffentlichte Norm das Verstehen früher erwartet — eine Reihenfolgeentscheidung, die ein einziges <code>standard_level</code> nicht ausdrücken konnte und die deshalb wie ein Fehler aussah.</p>
    <p class="note">▲ heißt: die Zeile wird auf diesem Niveau produziert, das lehrende Material liegt aber auf einem anderen. Das <code>note:</code>-Feld steht hier <b>immer</b>: der Bericht zeigt es nur bei nicht abgedeckten Punkten, also verschwand die Begründung genau dann, wenn alles bestand.</p>
    <p class="note">Regierende Dokumente:
      <a class="doc" href="https://github.com/VitalyVorobyev/deutsch-textbook/blob/main/docs/curriculum/a2-b1.md">docs/curriculum/a2-b1.md ↗</a> (der eingefrorene Kontrakt) ·
      <a class="doc" href="https://github.com/VitalyVorobyev/deutsch-textbook/blob/main/docs/curriculum/level-completeness-audit.md">level-completeness-audit.md ↗</a> ·
      <a class="doc" href="https://github.com/VitalyVorobyev/deutsch-textbook/blob/main/data/strukturenlisten/README.md">data/strukturenlisten/README.md ↗</a> ·
      <a class="doc" href="https://github.com/VitalyVorobyev/deutsch-textbook/blob/main/docs/authoring/focus-tags.md">docs/authoring/focus-tags.md ↗</a>
    </p>
    ${blocks}
  </section>`;
}
