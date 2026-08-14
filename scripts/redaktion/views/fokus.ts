/**
 * View — Fokus: one confusion, every item that drills it.
 *
 * The focus tag is the unit the entire personalization loop runs on — attempts carry it into
 * snapshots, `focusStats` aggregates error rates by it, mixed training prioritises by it, drill
 * authoring is driven by it, and the grammar inventory counts a structure taught only when a tag
 * is carried. It had no page. Deciding whether a tag is over- or under-drilled meant grepping 336
 * YAML files.
 *
 * The row that matters most is the one showing **which roles** carry a tag. A confusion drilled
 * only by a probe is measured and never taught; one drilled only by a pretest is diagnosed and
 * never practised; one drilled in a single practice file is met once and never interleaved.
 */
import {
  depth,
  itemsByTag,
  inventory,
  tagDepth,
  type TagDepth,
} from '../model';
import { esc, path, pointRef, searchKey, table, topicRef } from '../html';

/** tag → the inventory rows naming it. A tag with none is an orphan and says so. */
const pointsByTag = new Map<string, string[]>();
for (const point of inventory)
  for (const tag of point.focus ?? [])
    pointsByTag.set(tag, [...(pointsByTag.get(tag) ?? []), point.id]);

function tagBlock(t: TagDepth): string {
  const items = itemsByTag.get(t.tag) ?? [];
  const bySet = new Map<string, typeof items>();
  for (const i of items) bySet.set(i.set.id, [...(bySet.get(i.set.id) ?? []), i]);

  const rows = [...bySet.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([setId, group]) => {
      const set = group[0]!.set;
      const types = new Map<string, number>();
      for (const g of group) types.set(g.type, (types.get(g.type) ?? 0) + 1);
      const previews = group.filter((g) => g.preview).length;
      return [
        `<span class="role role-${esc(set.data.role ?? 'practice')}">${esc(set.data.role ?? 'practice')}</span>`,
        `<code>${esc(setId)}</code>`,
        String(group.length),
        [...types.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `<span class="hist"><span class="hist-k">${esc(k)}</span><span class="hist-v">${n}</span></span>`)
          .join(''),
        previews ? `<span class="chip warn">preview ${previews}</span>` : '',
        path(set.file),
      ];
    });

  const owners = pointsByTag.get(t.tag) ?? [];
  const median = t.level ? (depth.get(t.level)?.medianTeaching ?? 0) : 0;
  const flags = [
    t.teaching === 0 ? '<span class="chip miss">kein Übungsitem</span>' : '',
    t.teaching > 0 && t.teaching < median
      ? `<span class="chip warn">unter dem Median (${median})</span>`
      : '',
    t.files === 1 ? '<span class="chip warn">nur eine Übungsdatei</span>' : '',
    t.teaching > 0 && t.probe === 0 ? '<span class="chip warn">keine Probe</span>' : '',
    !owners.length ? '<span class="chip miss">keine Inventarzeile</span>' : '',
  ]
    .filter(Boolean)
    .join('');

  return `<article class="topic-card" id="fokus-${esc(t.tag)}" data-search="${searchKey(t.tag, t.introducedBy, ...owners)}">
    <header class="topic-head">
      <h3><code>${esc(t.tag)}</code></h3>
      <div class="topic-meta">
        ${t.level ? `<span class="tag lvl-${esc(t.level)}">${esc(t.level)}</span>` : '<span class="status-missing">kein Niveau</span>'}
        <span class="muted">eingeführt von</span> ${t.introducedBy ? topicRef(t.introducedBy) : '<span class="status-missing">nicht registriert</span>'}
        <span class="muted">Inventarzeile</span> ${owners.length ? owners.map((id) => pointRef(id)).join(' ') : '<span class="status-missing">keine</span>'}
      </div>
      <div class="badges">${flags}</div>
      <div class="mix">
        <span class="mix-f">Items <b>${t.teaching}</b></span>
        <span class="mix-f">produktiv <b>${t.production}</b></span>
        <span class="mix-f">Auswahl <b>${t.selection}</b></span>
        <span class="mix-f">Dateien <b>${t.files}</b></span>
        <span class="mix-f">Probe <b>${t.probe}</b></span>
        <span class="mix-f">Checkpoint <b>${t.checkpoint}</b></span>
        <span class="mix-f">Placement <b>${t.placement}</b></span>
        <span class="mix-f">Pretest <b>${t.pretest}</b></span>
      </div>
    </header>
    ${
      rows.length
        ? table(['Rolle', 'Satz', 'Items', 'Typen', '', 'Datei'], rows, 'inv')
        : '<p class="note">Kein Item trägt diesen Tag. Bei einer registrierten Verwechslung heißt das: der Tag wurde angelegt und nie benutzt.</p>'
    }
  </article>`;
}

export function renderFokus(): string {
  const tags = [...tagDepth.values()].sort(
    (a, b) => (a.level ?? '').localeCompare(b.level ?? '') || a.tag.localeCompare(b.tag),
  );
  if (!tags.length)
    return `<section class="view" id="view-fokus" hidden><h2>Fokus-Tags</h2>
      <p class="note warnnote">Keine Tag-Tiefe messbar — siehe die Ladehinweise oben.</p></section>`;

  return `<section class="view" id="view-fokus" hidden>
    <h2>Fokus-Tags</h2>
    <p class="lede">Eine Seite je Verwechslung, mit jedem Item, das sie übt — nach Satz und Rolle. Der Tag ist die Einheit, auf der die gesamte Personalisierung läuft: Versuche tragen ihn in die Snapshots, die Schwächetabelle aggregiert nach ihm, gemischtes Training priorisiert nach ihm, und das Grammatik-Inventar zählt eine Struktur erst als gelehrt, wenn ein practice- oder drill-Item ihn trägt.</p>
    <p class="note">Die Rollenspalte ist die wichtigste: ein Tag, den nur Proben tragen, wird gemessen und nie gelehrt; einen, den nur ein Pretest trägt, diagnostiziert man und übt ihn nie; einer in einer einzigen Übungsdatei wird einmal geübt und nie verschachtelt wiederholt. Vollständige Definition jeder Verwechslung: <a class="doc" href="#">docs/authoring/focus-tags.md</a>.</p>
    ${tags.map(tagBlock).join('')}
  </section>`;
}
