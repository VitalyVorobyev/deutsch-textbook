/**
 * View — Lernpfad: the spine, in `content/atlas.yaml` file order, with a presence chip per
 * shipping-checklist artifact. Unchanged by the navigator rework except that a topic row now also
 * links into its strand.
 */
import {
  CONSOLE_LEVELS,
  MIN_TRANSLATE,
  MAX_MC_PERCENT,
  MAX_SELECTION_PERCENT,
  introducedTags,
  itemMix,
  nodes,
  readings,
  sets,
  standaloneByTopic,
  topics,
  unitOfTopic,
  units,
  vocab,
  type ReadingFile,
  type SetFile,
} from '../model';
import { anchor, chip, esc, pct1, searchKey, topicRef, type ChipState } from '../html';

export interface Presence {
  article: SetPresenceChip;
  pretest: SetPresenceChip;
  primary: SetPresenceChip;
  extra: SetPresenceChip;
  probe: SetPresenceChip;
  reading: SetPresenceChip;
  vocabDeck: SetPresenceChip;
  outcomes: SetPresenceChip;
  tags: SetPresenceChip;
}
export interface SetPresenceChip {
  state: ChipState;
  label: string;
  title: string;
}

export function presence(id: string): Presence {
  const topic = topics.get(id);
  const data = topic?.data;
  const node = nodes.get(id);
  const listed = (data?.exercises ?? []).map((e) => sets.get(e)).filter(Boolean) as SetFile[];
  const practice = listed.filter((s) => s.data.role === 'practice');
  const primary = practice[0];
  const extra = [...practice.slice(1), ...listed.filter((s) => s.data.role === 'drill')];
  const standalone = standaloneByTopic.get(id) ?? [];
  const probes = standalone.filter((s) => s.data.role === 'probe');
  const pretestSet = data?.pretest ? sets.get(data.pretest) : undefined;
  const topicReadings = (data?.reading ?? []).map((r) => readings.get(r)).filter(Boolean) as ReadingFile[];
  const decks = (data?.vocab ?? []).map((v) => vocab.get(v)).filter(Boolean);
  const outcomes = node?.outcomes ?? [];
  const tags = introducedTags.get(id) ?? [];
  const armed = probes.reduce((n, p) => n + (p.data.arming?.length ?? 0), 0);

  return {
    article: topic
      ? {
          state: data?.status === 'reviewed' ? 'ok' : 'warn',
          label: `Artikel · ${data?.status ?? 'draft'}`,
          title: topic.file,
        }
      : { state: 'miss', label: 'Artikel', title: 'keine .mdx-Datei' },
    pretest: pretestSet
      ? { state: 'ok', label: `Pretest ${pretestSet.data.items?.length ?? 0}`, title: pretestSet.file }
      : { state: 'miss', label: 'Pretest', title: 'kein pretest: in der Frontmatter' },
    primary: primary
      ? {
          state: 'ok',
          label: `Praxis ${primary.data.items?.length ?? 0}`,
          title: `primaryPractice: ${primary.id} (${primary.file})`,
        }
      : { state: 'miss', label: 'Praxis', title: 'kein role: practice Satz — der Lernpfad käme nie weiter' },
    extra: extra.length
      ? {
          state: 'info',
          label: `+${extra.length} ${extra.length === 1 ? 'Satz' : 'Sätze'}`,
          title: extra.map((s) => `${s.id} (${s.data.role})`).join(', '),
        }
      : { state: 'none', label: 'keine weiteren', title: 'nur der primäre Praxissatz' },
    probe: probes.length
      ? {
          state: 'ok',
          label: `Probe ${probes.map((p) => p.data.items?.length ?? 0).join('+')} · arming ${armed}`,
          title: probes.map((p) => p.file).join(', '),
        }
      : { state: 'miss', label: 'Probe', title: 'keine probe-<id>.yaml Familie' },
    reading: topicReadings.length
      ? {
          state: 'ok',
          label: `Lesen ${topicReadings.length}`,
          title: topicReadings.map((r) => `${r.id} (${r.data.kind ?? 'intensive'}, ${r.words} Wörter, ${r.glosses} Glossen)`).join(', '),
        }
      : { state: 'miss', label: 'Lesen', title: 'kein reading: in der Frontmatter' },
    vocabDeck: decks.length
      ? {
          state: 'info',
          label: `Deck ${decks.length}`,
          title: decks.map((d) => `${d!.id} (${d!.data.entries?.length ?? 0})`).join(', '),
        }
      : { state: 'none', label: 'kein Deck', title: 'das Thema führt kein eigenes Wortfeld ein' },
    outcomes: outcomes.length
      ? { state: 'ok', label: `Outcomes ${outcomes.length}`, title: outcomes.map((o) => o.id).join(', ') }
      : { state: 'miss', label: 'Outcomes', title: 'kein Atlas-Knoten oder keine Outcomes' },
    tags: tags.length
      ? { state: 'info', label: `Fokus ${tags.length}`, title: tags.join(', ') }
      : { state: 'none', label: 'kein Fokus', title: 'führt keinen neuen Fokus-Tag ein' },
  };
}

export function mixLine(id: string): string {
  const mix = itemMix(id);
  if (!mix) return `<div class="mix muted">kein Praxis-Item</div>`;
  const flag = (f: string) => (f === 'over' ? ' <span class="flag over" title="über der Grenze">▲</span>' : f === 'at' ? ' <span class="flag at" title="genau an der Grenze">△</span>' : '');
  return `<div class="mix">
    <span class="mix-n">${mix.total} Praxis-Items</span>
    <span class="mix-f">translate <b>${mix.translate}</b><span class="cap">/ ≥ ${MIN_TRANSLATE}</span>${flag(mix.translateFlag)}</span>
    <span class="mix-f">mc <b>${pct1(mix.mcPercent)}</b><span class="cap">/ ≤ ${pct1(MAX_MC_PERCENT)}</span>${flag(mix.mcFlag)}</span>
    <span class="mix-f">Auswahl <b>${pct1(mix.selectionPercent)}</b><span class="cap">/ ≤ ${MAX_SELECTION_PERCENT}%</span>${flag(mix.selectionFlag)}</span>
  </div>`;
}

export function renderLernpfad(): string {
  const orphanTopics = [...topics.keys()].filter((id) => !unitOfTopic.has(id));
  const orphanNote = orphanTopics.length
    ? `<p class="note warnnote">${orphanTopics.length} Thema/Themen in keiner Einheit: ${orphanTopics.map(topicRef).join(', ')}</p>`
    : '';

  const levels = CONSOLE_LEVELS.map((level) => {
    const levelUnits = units.filter((u) => u.level === level);
    const unitBlocks = levelUnits
      .map((unit, i) => {
        const rows = (unit.topics ?? [])
          .map((id) => {
            const topic = topics.get(id);
            const node = nodes.get(id);
            const p = presence(id);
            const chips = [p.article, p.pretest, p.primary, p.extra, p.probe, p.reading, p.vocabDeck, p.outcomes, p.tags]
              .map((c) => chip(c.state, c.label, c.title))
              .join('');
            return `<div class="row" data-search="${searchKey(id, topic?.data.title_de, topic?.data.title_en, topic?.data.title_ru, unit.title_de)}">
              <div class="row-head">
                <span class="row-title">${anchor(id, topic?.data.title_de ?? id)}</span>
                <code class="row-id">${esc(id)}</code>
                <span class="tag">${esc(topic?.data.kind ?? node?.kind ?? '?')}</span>
                <span class="tag alt">${esc(node?.strand ?? '?')}</span>
              </div>
              <div class="badges">${chips}</div>
              ${mixLine(id)}
            </div>`;
          })
          .join('');
        return `<section class="unit" data-group>
          <h4><span class="unit-n">${i + 1}</span> ${esc(unit.title_de)} <code>${esc(unit.id)}</code></h4>
          ${rows}
        </section>`;
      })
      .join('');
    return `<div class="level-block" data-group><h3 id="lernpfad-${esc(level)}">${esc(level)} <span class="muted">— ${levelUnits.length} Einheiten, ${levelUnits.reduce((n, u) => n + (u.topics?.length ?? 0), 0)} Themen</span></h3>${unitBlocks}</div>`;
  }).join('');

  return `<section class="view" id="view-lernpfad" hidden>
    <h2>Lernpfad</h2>
    <p class="lede">Die Reihenfolge der Einheiten in <code>content/atlas.yaml</code> <b>ist</b> der empfohlene Weg — sie wird hier unverändert wiedergegeben. Ein fehlendes Artefakt erscheint als hohles Chip, nicht als Lücke.</p>
    <p class="note">Chips: <span class="chip ok">vorhanden</span> <span class="chip warn">vorhanden, aber draft</span> <span class="chip miss">fehlt (Checkliste verlangt es)</span> <span class="chip info">optional, vorhanden</span> <span class="chip none">optional, nicht vorhanden</span>. Item-Mix über die <code>role: practice</code>-Sätze des Themas, <code>audio-comprehension</code> auf beiden Seiten ausgenommen — dieselbe Zählweise wie <code>scripts/validate.ts</code>.</p>
    ${orphanNote}
    ${levels}
  </section>`;
}

