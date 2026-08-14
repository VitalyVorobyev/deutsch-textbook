/**
 * View — Überblick: the level cards.
 *
 * The one change from the pre-navigator console: the grammar metric now shows BREADTH AND DEPTH
 * side by side. `Grammatik-Inventar 24/28` alone was read for months as if it answered "how well
 * is this level taught", and it never did — the same 100% sat above medians of twelve, eight and
 * four practice items per confusion. Two numbers, neither substituting for the other.
 */
import {
  CONSOLE_LEVELS,
  depth,
  grammar,
  nodes,
  readings,
  sets,
  structures,
  topics,
  units,
  vocab,
  wortliste,
  type Level,
} from '../model';
import { esc, pct, table, topicRef } from '../html';
import { focusIntroducedBy } from '@da/content/focus-tags';

function levelStats(level: Level) {
  const levelTopics = [...topics.values()].filter((t) => t.data.level === level);
  const levelSets = [...sets.values()].filter((s) => s.level === level);
  const levelReadings = [...readings.values()].filter((r) => r.level === level);
  const levelVocab = [...vocab.values()].filter((v) => v.data.level === level);
  const byRole = new Map<string, number>();
  for (const s of levelSets) byRole.set(s.data.role ?? 'practice', (byRole.get(s.data.role ?? 'practice') ?? 0) + 1);
  return {
    units: units.filter((u) => u.level === level).length,
    topics: levelTopics,
    reviewed: levelTopics.filter((t) => t.data.status === 'reviewed').length,
    sets: levelSets,
    byRole,
    items: levelSets.reduce((n, s) => n + (s.data.items?.length ?? 0), 0),
    readings: levelReadings,
    intensive: levelReadings.filter((r) => (r.data.kind ?? 'intensive') === 'intensive').length,
    vocab: levelVocab,
    entries: levelVocab.reduce((n, v) => n + (v.data.entries?.length ?? 0), 0),
    outcomes: levelTopics.reduce((n, t) => n + (nodes.get(t.data.id)?.outcomes?.length ?? 0), 0),
  };
}

/**
 * Depth beside breadth. `24/28` says a structure is present; these four say how much of it is.
 * They sit inside the same metric block deliberately — separating them is how one came to be read
 * as the other.
 */
function depthLine(level: Level): string {
  const d = depth.get(level);
  if (!d) return '';
  return `<div class="metric-sub">Tiefe je Verwechslung — Median <b>${d.medianTeaching}</b> Items, <b>${d.medianProduction}</b> produktiv, <b>${d.medianFiles}</b> Übungsdateien
    · <a href="#luecken-thin-tag">${d.thinTags} ≤3 Items</a>
    · <a href="#luecken-single-file-tag">${d.singleFileTags} in nur einer Datei</a>
    · <a href="#luecken-no-probe">${d.pointsWithoutProbe} ohne Probe</a></div>`;
}

/** Whether the level's denominator is measured against anything outside this repo. */
function anchorLine(level: Level): string {
  const s = structures.get(level);
  if (!s) return '';
  if (!s.anchored)
    return `<div class="metric-sub"><span class="status-missing">ohne externe Quelle</span> — das Inventar dieses Niveaus misst sich nur an sich selbst (<a href="#quellen-fehlend">welches Dokument fehlt</a>)</div>`;
  return `<div class="metric-sub">Norm: <b>${s.claimed.length}/${s.total}</b> veröffentlichte Zeilen belegt${
    s.unclaimed.length ? ` · <a class="status-missing" href="#luecken-unclaimed-structure">${s.unclaimed.length} ohne Inventarzeile</a>` : ''
  } · ${s.beyond.length} Zeilen <span class="muted">beyond</span></div>`;
}

export function renderUeberblick(): string {
  const cards = CONSOLE_LEVELS.map((level) => {
    const s = levelStats(level);
    const g = grammar.get(level);
    const w = wortliste.get(level);

    const grammarRows = (g?.points ?? []).map((p) => {
      const owners = [...new Set((p.point.focus ?? []).map((t) => focusIntroducedBy[t]).filter(Boolean))] as string[];
      const taughtBy = p.point.reference_only ? (p.point.taught_in ?? []) : owners;
      const mark = p.status === 'covered' ? '✓' : p.status === 'late' ? '~' : '✗';
      return [
        `<span class="status-${p.status}">${mark}</span>`,
        `<code>${esc(p.point.id)}</code>`,
        esc(p.point.de),
        taughtBy.length ? taughtBy.map(topicRef).join(' ') : '<span class="muted">—</span>',
        p.status === 'late'
          ? `<span class="status-late">${esc(p.taughtAt ?? '')}</span>`
          : p.unmetTags.length
            ? `<span class="status-missing">${esc(p.unmetTags.join(', '))}</span>`
            : '<span class="muted">—</span>',
      ];
    });

    const wortlisteBlock = w
      ? `<div class="metric">
           <div class="metric-head"><span>Wortliste</span><b>${w.cards + w.grammar}/${w.total}</b><span class="pcttag">${pct(w.percent)}</span></div>
           <div class="bar"><span class="bar-cards" style="width:${(100 * w.cards) / w.total}%"></span><span class="bar-grammar" style="width:${(100 * w.grammar) / w.total}%"></span></div>
           <div class="metric-sub">${w.cards} als Karten · ${w.grammar} als Grammatik (<code>~</code>) · ${w.missing} fehlen${w.unearned.length ? ` · <span class="status-missing">${w.unearned.length} unbelegte <code>~</code></span>` : ''}</div>
         </div>`
      : `<div class="metric"><div class="metric-head"><span>Wortliste</span><b class="muted">keine Wortliste</b></div>
           <div class="metric-sub">Kein <code>data/goethe-${level.toLowerCase()}-wortliste.txt</code> — dieses Niveau hat keine Abdeckungszahl und darf keine behaupten.</div></div>`;

    const roleLine = [...s.byRole.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([role, n]) => `<span class="hist"><span class="hist-k">${esc(role)}</span><span class="hist-v">${n}</span></span>`)
      .join('');

    return `<section class="card" data-group>
      <h3 id="ueberblick-${esc(level)}">${esc(level)}</h3>
      <div class="kpis">
        <div class="kpi"><b>${s.units}</b><span>Einheiten</span></div>
        <div class="kpi"><b>${s.topics.length}</b><span>Themen</span></div>
        <div class="kpi"><b>${s.reviewed}/${s.topics.length}</b><span>reviewed</span></div>
        <div class="kpi"><b>${s.outcomes}</b><span>Outcomes</span></div>
        <div class="kpi"><b>${s.sets.length}</b><span>Übungssätze</span></div>
        <div class="kpi"><b>${s.items}</b><span>Items</span></div>
        <div class="kpi"><b>${s.readings.length}</b><span>Lesetexte</span></div>
        <div class="kpi"><b>${s.vocab.length}</b><span>Vokabeldecks</span></div>
        <div class="kpi"><b>${s.entries}</b><span>Vokabeln</span></div>
      </div>

      ${
        g
          ? `<div class="metric">
        <div class="metric-head"><span>Grammatik-Inventar</span><b>${g.taught}/${g.total}</b><span class="pcttag">${pct(g.percent)}</span></div>
        <div class="bar"><span class="bar-cards" style="width:${g.total ? (100 * g.covered) / g.total : 0}%"></span><span class="bar-late" style="width:${g.total ? (100 * g.late) / g.total : 0}%"></span></div>
        <div class="metric-sub">${g.covered} abgedeckt · ${g.late} spät gelehrt · ${g.missing} fehlen</div>
        ${depthLine(level)}
        ${anchorLine(level)}
        <details><summary>Punkt für Punkt — wer lehrt was</summary>
          ${table(['', 'Punkt', 'Struktur (de)', 'gelehrt von', 'Hinweis'], grammarRows, 'compact')}
        </details>
      </div>`
          : `<div class="metric"><div class="metric-head"><span>Grammatik-Inventar</span><b class="muted">nicht messbar</b></div>
        <div class="metric-sub">Das Inventar konnte nicht gelesen werden — siehe die Ladehinweise oben.</div></div>`
      }

      ${wortlisteBlock}

      <div class="metric">
        <div class="metric-head"><span>Sätze nach Rolle</span></div>
        <div class="metric-sub hists">${roleLine}</div>
        <div class="metric-sub">Lesetexte: ${s.intensive} intensiv · ${s.readings.length - s.intensive} extensiv</div>
      </div>
    </section>`;
  }).join('');

  return `<section class="view" id="view-ueberblick">
    <h2>Überblick</h2>
    <p class="lede">Jede Zahl auf dieser Seite wird beim Generieren aus <code>content/</code> und <code>data/</code> berechnet — keine ist von Hand geschrieben. Die beiden Abdeckungsmaße stammen aus denselben Modulen wie <code>bun scripts/grammar-coverage.ts</code> und <code>bun scripts/coverage.ts</code>.</p>
    <p class="note">Zählweise: Übungssätze und Lesetexte nach ihrem Verzeichnis (<code>content/exercises/&lt;level&gt;/</code>), Vokabeldecks nach ihrem deklarierten <code>level</code>, Themen nach der Frontmatter. Outcomes stammen aus dem Atlas-Knoten.</p>
    <div class="cards">${cards}</div>
  </section>`;
}

