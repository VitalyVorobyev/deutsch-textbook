/**
 * The course: every unit in teaching order, every topic inside it, and the state of each.
 *
 * WHAT THE FIRST ONE DID. A 49-row table with one number per topic (`met`). It was accurate and it
 * was a directory listing — reading it told you which files exist, never which topic is in trouble.
 *
 * WHAT THIS ONE ASKS. *Where along the path is the work?* Each topic is a panel toned by its own
 * state, carrying the three things that decide whether it is finished:
 *
 *   - **the lesson-cycle arc**, six dots — the skeleton `CLAUDE.md` requires of every topic
 *     (pretest → model → scaffold → fade → transfer → delayed check) and which nothing else in the
 *     repo renders. A hollow dot is a stage with no element, and it is the finding: **48 of 49
 *     topics have no transfer task**, which is what the `Element` layer was built to be able to
 *     say.
 *   - **`met`/`total`** against the level median, which is printed beside it — the
 *     `grammar-depth.ts` discipline. There is no threshold and no score; a count of yes/no answers
 *     read against what the rest of the level manages.
 *   - **its findings**, so a topic that fails something says so on the card rather than in a
 *     different route.
 *
 * `graph.topics` already arrives sorted by `spine`, so grouping by unit in that same order
 * reproduces the recommended path without re-deriving it.
 */
import { useState } from 'react';
import { Empty, Filter, Panel, SearchBox } from '@da/ui/primitives';
import { PROBLEM_LABELS } from '@da/content/profile';
import { Hinweis } from '../components/Hinweis';
import type { GraphPayload } from '../data';
import { href } from '../router';

type Level = GraphPayload['levels'][number];
type Topic = GraphPayload['topics'][number];

/** The arc, in order. Rendered even where empty — an absent stage is the finding. */
const ARC = ['pretest', 'modell', 'geruest', 'ausblenden', 'transfer', 'nachpruefung'] as const;
const ARC_LABEL: Record<string, string> = {
  pretest: 'Pretest',
  modell: 'Modell',
  geruest: 'Gerüst',
  ausblenden: 'Ausblenden',
  transfer: 'Transfer',
  nachpruefung: 'Nachprüfung',
};

const STATUS_LABEL: Record<string, string> = { draft: 'Entwurf', reviewed: 'geprüft' };

export function Themen({ graph }: { graph: GraphPayload }) {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<Level | 'alle'>('alle');
  const [track, setTrack] = useState<string | 'alle'>('alle');
  const [nurBefunde, setNurBefunde] = useState(false);
  const q = search.trim().toLowerCase();

  const problemsByTopic = new Map<string, GraphPayload['problems']>();
  for (const p of graph.problems) {
    if (!p.topic) continue;
    if (!problemsByTopic.has(p.topic)) problemsByTopic.set(p.topic, []);
    problemsByTopic.get(p.topic)!.push(p);
  }

  const shown = graph.topics.filter(
    (t) =>
      (level === 'alle' || t.level === level) &&
      (track === 'alle' || (graph.profiles.find((profile) => profile.topic === t.id)?.points ?? []).some((id) => graph.inventory.find((point) => point.id === id)?.track === track)) &&
      (!q || t.title.toLowerCase().includes(q) || t.id.includes(q)) &&
      (!nurBefunde || (problemsByTopic.get(t.id)?.length ?? 0) > 0),
  );

  /*
   * Grouped by LEVEL, not by unit — and that is a measurement, not a preference. All 49 units hold
   * exactly one topic today (`units:` is a 1:1 relabelling of the topic list; it stays because a
   * unit is meant to be able to hold more later), so grouping by unit rendered 49 sections of one
   * card each and used a screen to show three topics. The unit name lives on the card instead.
   * Spine order is preserved inside each level, because `graph.topics` already arrives in it.
   */
  const levels: { level: string; topics: Topic[] }[] = [];
  for (const topic of shown) {
    const last = levels.at(-1);
    if (last && last.level === topic.level) last.topics.push(topic);
    else levels.push({ level: topic.level, topics: [topic] });
  }

  const withFindings = graph.topics.filter((t) => (problemsByTopic.get(t.id)?.length ?? 0) > 0).length;

  return (
    <>
      <header className="mb-5">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">Themen</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {graph.topics.length} Themen auf dem empfohlenen Weg · {withFindings} mit Befunden
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-56 flex-1">
          <SearchBox value={search} onChange={setSearch} placeholder="Thema suchen …" />
        </div>
        <Filter label="Niveau" value={level} options={graph.levels} onChange={setLevel} />
        <Filter label="Grammatiklinie" value={track} options={graph.grammarTracks.map((item) => item.id)} onChange={setTrack} />
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={nurBefunde}
            onChange={(e) => setNurBefunde(e.target.checked)}
            className="accent-[var(--color-brand)]"
          />
          nur mit Befunden
        </label>
      </div>

      {!levels.length ? <Empty>Kein Thema passt zu diesem Filter.</Empty> : null}

      {levels.map((group) => (
        <section key={group.level} className="mb-8">
          <div className="mb-3 flex items-baseline gap-2 border-b border-border-subtle pb-2">
            <h2 className="text-base font-semibold text-ink">{group.level}</h2>
            <span className="tabular text-xs text-ink-muted">
              {group.topics.length} Themen
              {(() => {
                const par = graph.reports.find((r) => r.level === group.level)?.medians?.met;
                return par === undefined ? '' : ` · Median ${par} Anforderungen`;
              })()}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.topics.map((topic) => (
              <ThemaKarte
                key={topic.id}
                topic={topic}
                profile={graph.profiles.find((p) => p.topic === topic.id)}
                median={graph.reports.find((r) => r.level === topic.level)?.medians}
                problems={problemsByTopic.get(topic.id) ?? []}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function ThemaKarte({
  topic,
  profile,
  median,
  problems,
}: {
  topic: Topic;
  profile?: GraphPayload['profiles'][number];
  median?: GraphPayload['reports'][number]['medians'];
  problems: GraphPayload['problems'];
}) {
  const met = profile?.met ?? 0;
  const total = profile?.total ?? 0;
  const par = median?.met;
  /*
   * Toned by `met` against the LEVEL MEDIAN, not by whether findings exist. Every one of the 49
   * topics has at least one finding, so a warn tone keyed on that was on for all of them — a signal
   * that never varies is decoration. Read against the median is the rule every distributional
   * figure in this repo follows, and it is the one that actually separates these cards.
   */
  const tone = par === undefined ? 'neutral' : met < par ? 'warn' : met > par ? 'ok' : 'neutral';
  const kinds = [...new Set(problems.map((p) => p.kind))];

  return (
    <Panel tone={tone} className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <a
          href={href('thema', topic.id)}
          className="min-w-0 flex-1 font-semibold text-ink underline-offset-2 hover:text-brand-ink hover:underline"
        >
          {topic.title}
        </a>
        <span className="shrink-0 whitespace-nowrap pt-0.5 text-xs text-ink-muted">
          {STATUS_LABEL[topic.status] ?? topic.status}
        </span>
      </div>
      {/* Units are 1:1 with topics today, so the unit title repeats the topic title on most cards.
          Compared LOOSELY, because an exact test let "Präsens und Wortstellung" print under
          "Präsens & Wortstellung" on nine of the forty-nine cards — a difference of one conjunction,
          rendered as if it were information. */}
      {topic.unitTitle && !gleicherName(topic.unitTitle, topic.title) ? (
        <p className="-mt-1.5 truncate text-xs text-ink-muted">{topic.unitTitle}</p>
      ) : null}

      <div>
        <div className="flex items-center gap-1.5" role="img" aria-label={arcLabel(profile)}>
          {ARC.map((stage) => {
            const n = profile?.arc[stage] ?? 0;
            return (
              <span
                key={stage}
                title={`${ARC_LABEL[stage]}: ${n || 'nichts'}`}
                // Neutral when present, rose only where the stage is missing — the same rule the
                // density block follows, and for the same reason: a filled dot is the ordinary case.
                className={`h-2.5 w-2.5 rounded-full ${n ? 'bg-ink-muted' : 'border border-warn'}`}
              />
            );
          })}
          <span className="ml-1 text-[0.65rem] text-ink-muted">Lernzyklus</span>
        </div>
      </div>

      {/* The median is the LEVEL's, so it is printed once in the level heading rather than on all
          forty-nine cards. A constant repeated per row is noise that reads as data. */}
      <p className="tabular text-xs text-ink-muted">
        <span className={par !== undefined && met < par ? 'text-warn-ink' : 'text-ink'}>
          {met}/{total}
        </span>{' '}
        Anforderungen · {profile?.depth.items ?? 0} Aufgaben, {profile?.depth.production ?? 0} produktiv
      </p>

      {/* A COUNT, not a stack of chips.
          All 49 topics carry findings, so six red chips per card painted the whole page red and
          made the differences between cards impossible to see. The number varies; the classes are
          one hover away and live in full on the topic page. */}
      {kinds.length ? (
        <Hinweis
          inhalt={
            <ul className="space-y-0.5">
              {kinds.map((k) => (
                <li key={k}>{PROBLEM_LABELS[k]?.de ?? k}</li>
              ))}
            </ul>
          }
        >
          <p className="w-fit text-xs text-ink-muted underline decoration-dotted underline-offset-2">
            <span className="tabular text-warn-ink">{problems.length}</span> Befunde in {kinds.length} Klasse
            {kinds.length === 1 ? '' : 'n'}
          </p>
        </Hinweis>
      ) : (
        <p className="text-xs text-ok-ink">keine Befunde</p>
      )}
    </Panel>
  );
}

/** `&` and `und` are the same word, and a card that prints both has told the reader nothing. */
function gleicherName(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/&/g, 'und').replace(/[^a-zäöüß]/g, '');
  return norm(a) === norm(b);
}

/** The dots are decorative to a screen reader; this is what they say. */
function arcLabel(profile?: GraphPayload['profiles'][number]): string {
  const missing = ARC.filter((s) => !(profile?.arc[s] ?? 0)).map((s) => ARC_LABEL[s]);
  return missing.length ? `Lernzyklus — es fehlt: ${missing.join(', ')}` : 'Lernzyklus vollständig';
}
