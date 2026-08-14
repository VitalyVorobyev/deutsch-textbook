/**
 * View — Themen-Detail: the full editorial spec of every topic, in spine order.
 *
 * Two additions from the navigator rework, both about making a topic reachable from the grammar
 * side and vice versa: an `Erklärung ohne ###-Abschnitte` badge (the confusions a topic teaches
 * have no addressable anchor in its prose — true of twenty of forty-nine articles), and inventory
 * rows that now link into the Struktur view instead of ending here.
 */
import {
  deepenedBy,
  inventoryByTopic,
  introducedTags,
  neededBy,
  nodes,
  readings,
  relatedFrom,
  sets,
  spineIndex,
  spineOrder,
  standaloneByTopic,
  topics,
  unitOfTopic,
  productionLevel,
  receptionLevel,
  vocab,
  type ReadingFile,
  type SetFile,
  type VocabFile,
} from '../model';
import { chip, esc, histogram, path, pointRef, searchKey, table, tagRef, topicRef } from '../html';
import { mixLine, presence } from './lernpfad';

export function setBlock(set: SetFile, primaryId?: string): string {
  const items = set.data.items ?? [];
  const types = new Map<string, number>();
  const focus = new Map<string, number>();
  let untagged = 0;
  let preview = 0;
  for (const item of items) {
    types.set(item.type, (types.get(item.type) ?? 0) + 1);
    if (item.focus) focus.set(item.focus, (focus.get(item.focus) ?? 0) + 1);
    else untagged++;
    if (item.preview) preview++;
  }
  const flags = [
    set.id === primaryId ? chip('ok', 'primaryPractice', 'Der erste role: practice Satz — seine Item-Liste darf nicht mehr wachsen') : '',
    set.data.arming?.length ? chip('info', `arming ${set.data.arming.length}`, (set.data.arming ?? []).join('\n')) : '',
    set.data.stimulus ? chip('info', `stimulus ${set.data.stimulus}`) : '',
    preview ? chip('warn', `preview ${preview}`, 'absichtliche Vorgriffe — zählen nicht als Lehrbeleg') : '',
  ]
    .filter(Boolean)
    .join('');
  return `<div class="set">
    <div class="set-head"><span class="role role-${esc(set.data.role ?? 'practice')}">${esc(set.data.role ?? 'practice')}</span>
      <code>${esc(set.id)}</code><span class="muted">${items.length} Items</span>${flags}</div>
    <div class="set-body">
      <div class="hists"><span class="hist-label">Typen</span>${histogram(types)}</div>
      <div class="hists"><span class="hist-label">Fokus</span>${focus.size ? histogram(focus) : '<span class="muted">keiner</span>'}${untagged ? `<span class="hist muted"><span class="hist-k">ohne Tag</span><span class="hist-v">${untagged}</span></span>` : ''}</div>
      ${path(set.file)}
    </div>
  </div>`;
}

function renderTopicDetail(id: string): string {
  const topic = topics.get(id);
  const data = topic?.data;
  const node = nodes.get(id);
  const unit = unitOfTopic.get(id);
  const listed = (data?.exercises ?? []).map((e) => sets.get(e)).filter(Boolean) as SetFile[];
  const primaryId = listed.find((s) => s.data.role === 'practice')?.id;
  const pretestSet = data?.pretest ? sets.get(data.pretest) : undefined;
  const standalone = standaloneByTopic.get(id) ?? [];
  const topicReadings = (data?.reading ?? []).map((r) => readings.get(r)).filter(Boolean) as ReadingFile[];
  const decks = ((data?.vocab ?? []).map((v) => vocab.get(v)).filter(Boolean)) as { id: string; data: VocabFile; file: string }[];
  const rows = inventoryByTopic.get(id) ?? [];
  const tags = introducedTags.get(id) ?? [];
  const p = presence(id);

  const outcomeRows = (node?.outcomes ?? []).map((o) => [
    `<code>${esc(o.id)}</code>`,
    `<span class="tag">${esc(o.mode)}</span>`,
    o.domain ? `<span class="tag alt">${esc(o.domain)}</span>` : '<span class="muted">—</span>',
    `<div class="lang"><b>de</b> ${esc(o.de)}</div><div class="lang"><b>en</b> ${esc(o.en)}</div><div class="lang"><b>ru</b> ${esc(o.ru)}</div>${o.uk ? `<div class="lang"><b>uk</b> ${esc(o.uk)}</div>` : '<div class="lang muted"><b>uk</b> —</div>'}`,
  ]);

  const edge = (label: string, ids: string[], hint: string) =>
    `<div class="edge"><span class="edge-label" title="${esc(hint)}">${esc(label)}</span>${ids.length ? ids.map(topicRef).join(' ') : '<span class="muted">—</span>'}</div>`;

  const inventoryRows = rows.map((r) => [
    pointRef(r.id),
    `<span class="lvl-pair"><span class="tag lvl-${esc(productionLevel(r))}">${esc(productionLevel(r))}</span>${
      receptionLevel(r) !== productionLevel(r)
        ? `<span class="karte-early" title="Die Norm erwartet Verstehen ab ${esc(receptionLevel(r))}">⌛${esc(receptionLevel(r))}</span>`
        : ''
    }</span>`,
    `<div><b>${esc(r.de)}</b></div><div class="muted">${esc(r.en)}</div>${r.note ? `<div class="rownote">${esc(r.note)}</div>` : ''}`,
    (r.focus ?? []).map(tagRef).join(' ') || (r.reference_only ? '<span class="tag alt">reference_only</span>' : '<span class="muted">—</span>'),
  ]);

  /**
   * CLAUDE.md: `## Erklärung` splits into `### German subsections`, one per named confusion. The
   * rule is unenforced (`packages/content/src/prose-shape.ts` says the judgement stays with the author), and
   * twenty of forty-nine articles have none — so the confusion an inventory row names has nowhere
   * in the prose to point at. The mechanical half of the rule is checkable and is checked here.
   */
  const erklaerungChip =
    topic && topic.headings.some((h) => h.depth === 2 && h.text.trim().startsWith('Erklärung'))
      ? topic.erklaerungSubsections.length
        ? chip('ok', `Erklärung ${topic.erklaerungSubsections.length}×###`, topic.erklaerungSubsections.join('\n'))
        : chip(
            'warn',
            'Erklärung ohne ###',
            'CLAUDE.md verlangt einen ###-Abschnitt je benannter Verwechslung — ohne ihn ist die erklärende Stelle nicht adressierbar',
          )
      : '';

  const headingOutline = (topic?.headings ?? [])
    .map((h) => `<span class="chip ${h.depth === 2 ? 'info' : 'none'}" title="H${h.depth}">${esc(h.text)}</span>`)
    .join('');

  return `<article class="topic-card" id="topic-${esc(id)}" data-search="${searchKey(id, data?.title_de, data?.title_en, data?.title_ru, ...(data?.tags ?? []), ...tags)}">
    <header class="topic-head">
      <h3>${esc(data?.title_de ?? id)}</h3>
      <div class="topic-meta">
        <code class="row-id">${esc(id)}</code>
        <span class="tag lvl-${esc(data?.level ?? '')}">${esc(data?.level ?? '?')}</span>
        <span class="tag">${esc(data?.kind ?? '?')}</span>
        <span class="tag alt">${esc(node?.strand ?? '?')}</span>
        <span class="tag alt">${esc(node?.group ?? '?')}</span>
        <span class="tag ${data?.status === 'reviewed' ? 'ok-tag' : 'warn-tag'}">${esc(data?.status ?? 'draft')}</span>
        ${unit ? `<span class="muted">Einheit <a class="topic-link" href="#lernpfad-${esc(data?.level ?? '')}">${esc(unit.title_de)}</a> (<code>${esc(unit.id)}</code>, Position ${(spineIndex.get(id) ?? 0) + 1} im Pfad)</span>` : '<span class="status-missing">in keiner Einheit</span>'}
      </div>
      <div class="titles">
        <div class="lang"><b>en</b> ${esc(data?.title_en)}</div>
        <div class="lang"><b>ru</b> ${esc(data?.title_ru)}</div>
        ${data?.title_uk ? `<div class="lang"><b>uk</b> ${esc(data.title_uk)}</div>` : '<div class="lang muted"><b>uk</b> —</div>'}
      </div>
      <div class="badges">${[p.article, p.pretest, p.primary, p.extra, p.probe, p.reading, p.vocabDeck, p.outcomes, p.tags].map((c) => chip(c.state, c.label, c.title)).join('')}${erklaerungChip}</div>
      ${mixLine(id)}
      ${topic ? path(topic.file) : '<span class="status-missing">keine .mdx-Datei</span>'}
    </header>

    <h4>Artikel-Gliederung</h4>
    <div class="badges">${headingOutline || '<span class="muted">keine Überschriften</span>'}</div>
    ${data?.tags?.length ? `<div class="edge"><span class="edge-label">tags</span>${data.tags.map((t) => `<code class="tagcode">${esc(t)}</code>`).join(' ')}</div>` : ''}

    <h4>Kanten</h4>
    <div class="edges">
      ${edge('braucht (prerequisites)', node?.prerequisites ?? data?.prerequisites ?? [], 'Was vorher gekonnt sein muss')}
      ${edge('wird gebraucht von', neededBy.get(id) ?? [], 'Themen, die dieses als prerequisite führen')}
      ${edge('vertieft (deepens)', node?.deepens ?? [], 'Basisthemen, die dieses erneut aufgreift — die Kante trägt einen gemeinsamen Fokus-Tag')}
      ${edge('wird vertieft von', deepenedBy.get(id) ?? [], 'Themen, die dieses vertiefen')}
      ${edge('verwandt (related)', [...new Set([...(node?.related ?? []), ...(relatedFrom.get(id) ?? [])])], 'symmetrisch, nicht blockierend')}
    </div>

    <h4>Outcomes <span class="muted">${outcomeRows.length}</span></h4>
    ${outcomeRows.length ? table(['id', 'mode', 'domain', 'Can-do'], outcomeRows, 'outcomes') : '<p class="muted">keine — kein Atlas-Knoten?</p>'}

    <h4>Übungssätze</h4>
    ${pretestSet ? setBlock(pretestSet, primaryId) : '<p class="status-missing">kein Pretest</p>'}
    ${listed.length ? listed.map((s) => setBlock(s, primaryId)).join('') : '<p class="status-missing">keine gelisteten Sätze</p>'}
    ${standalone.length ? `<div class="sub">Eigenständige Sätze (Probe, Checkpoint, Placement — bewusst in keiner <code>exercises:</code>-Liste)</div>${standalone.map((s) => setBlock(s, primaryId)).join('')}` : ''}

    <h4>Lesetexte</h4>
    ${
      topicReadings.length
        ? table(
            ['id', 'Art', 'Wörter', 'Glossen', 'Fragen', 'Datei'],
            topicReadings.map((r) => [
              `<code>${esc(r.id)}</code>`,
              `<span class="tag">${esc(r.data.kind ?? 'intensive')}</span>`,
              String(r.words),
              String(r.glosses),
              String(r.data.questions?.length ?? 0),
              path(r.file),
            ]),
          )
        : '<p class="status-missing">kein Lesetext</p>'
    }

    <h4>Vokabeldecks</h4>
    ${
      decks.length
        ? table(
            ['id', 'Niveau', 'Einträge', 'Datei'],
            decks.map((d) => [
              `<code>${esc(d.id)}</code>`,
              `<span class="tag lvl-${esc(d.data.level)}">${esc(d.data.level)}</span>`,
              String(d.data.entries?.length ?? 0),
              path(d.file),
            ]),
          )
        : '<p class="muted">kein eigenes Wortfeld</p>'
    }

    <h4>Fokus-Tags, die dieses Thema einführt <span class="muted">${tags.length}</span></h4>
    <div class="badges">${tags.length ? tags.map((t) => `<code class="tagcode">${esc(t)}</code>`).join(' ') : '<span class="muted">keine</span>'}</div>

    <h4>Grammatik-Inventar <span class="muted">${rows.length} Zeile(n)</span></h4>
    <p class="note">Zeilen, deren Fokus-Tag dieses Thema einführt oder deren <code>taught_in</code> es nennt. Die <code>note:</code> trägt die Quellenangabe und steht darum vollständig hier.</p>
    ${inventoryRows.length ? table(['Punkt', 'Standard', 'Struktur & Quelle', 'Fokus'], inventoryRows, 'inv') : '<p class="muted">keine Inventarzeile</p>'}
  </article>`;
}

export function renderDetail(): string {
  const ordered = [
    ...spineOrder.filter((id) => topics.has(id)),
    ...[...topics.keys()].filter((id) => !spineIndex.has(id)),
  ];
  return `<section class="view" id="view-detail" hidden>
    <h2>Themen-Detail</h2>
    <p class="lede">Die vollständige Spezifikation je Thema, in Pfadreihenfolge. Jeder Pfad verlinkt auf GitHub; jede Kante ist in beide Richtungen aufgeführt.</p>
    ${ordered.map(renderTopicDetail).join('')}
  </section>`;
}
