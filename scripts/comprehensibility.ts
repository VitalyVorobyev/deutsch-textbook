/**
 * Input load report — what a topic asks the learner to read, against what the
 * spine says they have met by then.
 *
 * Read-only, like scripts/lang-cost.ts and scripts/prose-shape.ts: no gate, no
 * threshold, nothing in `bun run validate` calls this. The measurement lives in
 * packages/content/src/comprehensibility.ts and states its counting method there; this is the
 * report around it.
 *
 * Usage:
 *   bun scripts/comprehensibility.ts b1/geld-vertraege   # one topic, in detail
 *   bun scripts/comprehensibility.ts geld-vertraege      # the level prefix is optional
 *   bun scripts/comprehensibility.ts --rank B1           # one level, ranked
 *   bun scripts/comprehensibility.ts --rank              # all three levels
 *
 * What to do with it: **outliers are the product**. A topic whose article sits
 * far above its level's median is a place to look — the median is printed under
 * every table for exactly that comparison, and is read off the corpus rather
 * than chosen. The `ahead` word lists in the detailed report are the actionable
 * half: they name the words to gloss, to move into a deck, or to cut.
 *
 * What it is not: an absolute claim. The matcher folds inflections without a
 * lemmatizer and the Nebensatz count is a word list rather than a parse, so
 * "8.1 ahead per 100" means "more than the 5.4 next to it", never "8% of this
 * article is unknown to the learner".
 */
import {
  HALVES,
  RANKED_LEVELS,
  SECTIONS,
  loadCorpus,
  maxTerminology,
  measureSpine,
  median,
  type RankedLevel,
  type TopicLoad,
} from '@da/content/comprehensibility';

const args = process.argv.slice(2);
const rank = args.includes('--rank');
const positional = args.filter((a) => !a.startsWith('--'));

const corpus = loadCorpus();
const loads = measureSpine(corpus);

if (!rank && positional.length === 0) {
  process.stderr.write(
    'Usage: bun scripts/comprehensibility.ts <level>/<topic-id>\n' +
      '       bun scripts/comprehensibility.ts --rank [A1|A2|B1]\n',
  );
  process.exit(1);
}

const pad = (s: string, n: number) => s.padEnd(n);
const num = (v: number, n: number, digits = 1) => v.toFixed(digits).padStart(n);

// ---------------------------------------------------------------------------
// --rank: one table per level, with the level's own medians under it
// ---------------------------------------------------------------------------

if (rank) {
  const requested = positional[0]?.toUpperCase() as RankedLevel | undefined;
  const levels = requested ? [requested] : [...RANKED_LEVELS];
  if (requested && !(RANKED_LEVELS as readonly string[]).includes(requested)) {
    process.stderr.write(`No spine for ${requested}. Levels: ${RANKED_LEVELS.join(', ')}.\n`);
    process.exit(1);
  }

  const out: string[] = [
    'Input load per topic — ahead-of-the-learner tokens per 100, by section.',
    'Sorted by `all` (article+reading pooled), the provisional primary indicator.',
    'Read against the MEDIAN row, not against zero. Method: packages/content/src/comprehensibility.ts.',
  ];

  for (const level of levels) {
    const rows = loads.filter((l) => l.level === level).sort((a, b) => b.overall.per100 - a.overall.per100);
    if (rows.length === 0) continue;
    const width = Math.max(20, ...rows.map((r) => r.id.length));
    out.push(
      '',
      `## ${level} — ${rows.length} topics`,
      '',
      `${pad('#', 4)}${pad('topic', width + 2)}${'all'.padStart(6)}${'artic'.padStart(7)}${'read'.padStart(7)}${'items'.padStart(7)}${'sent'.padStart(7)}${'neben'.padStart(7)}${'term'.padStart(7)}`,
    );
    for (const row of rows) {
      out.push(
        pad(String(row.position), 4) +
          pad(row.id, width + 2) +
          num(row.overall.per100, 6) +
          num(row.sections.article.per100, 7) +
          num(row.sections.reading.per100, 7) +
          num(row.sections.items.per100, 7) +
          num(row.sentences.meanWords, 7) +
          num(row.sentences.nebensatzPerSentence, 7, 2) +
          num(maxTerminology(row), 7, 2),
      );
    }
    out.push(
      pad('', 4) +
        pad('MEDIAN', width + 2) +
        num(median(rows.map((r) => r.overall.per100)), 6) +
        num(median(rows.map((r) => r.sections.article.per100)), 7) +
        num(median(rows.map((r) => r.sections.reading.per100)), 7) +
        num(median(rows.map((r) => r.sections.items.per100)), 7) +
        num(median(rows.map((r) => r.sentences.meanWords)), 7) +
        num(median(rows.map((r) => r.sentences.nebensatzPerSentence)), 7, 2) +
        num(median(rows.map((r) => maxTerminology(r))), 7, 2),
    );
  }

  out.push(
    '',
    '#      spine position (content/atlas.yaml `units:` order, A1→A2→B1)',
    'all    ahead tokens per 100, article+reading pooled — the sort key',
    'artic  / read / items   the same figure per section (items = practice+drill sets)',
    'sent   mean words per sentence, over article examples + reading',
    'neben  Nebensatz markers per sentence (a word list, not a parse)',
    'term   grammar terms per 100 words, highest of the explanation halves present',
    '',
  );
  process.stdout.write(out.join('\n'));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// One topic, in detail
// ---------------------------------------------------------------------------

const wanted = positional[0]!.split('/').pop()!;
const load: TopicLoad | undefined = loads.find((l) => l.id === wanted);
if (!load) {
  process.stderr.write(
    `No topic "${wanted}" on the spine. It must be listed in a unit of content/atlas.yaml.\n`,
  );
  process.exit(1);
}

const peers = loads.filter((l) => l.level === load.level);
const out: string[] = [
  `# ${load.id} (${load.level})`,
  '',
  `spine position ${load.position} of ${loads.length - 1}; ${peers.length} topics at this level.`,
  `known set: ${load.known.priorSurface} tokens of prior taught surface, ` +
    `${load.known.vocab} from attached decks (own included), ` +
    `${load.known.wortliste} from the ≤${load.level} Wortliste.`,
  '',
  '## Ahead of the learner, by section',
  '',
  `${pad('section', 10)}${'tokens'.padStart(8)}${'ahead'.padStart(8)}${'per100'.padStart(9)}${'median'.padStart(9)}`,
];

for (const section of SECTIONS) {
  const s = load.sections[section];
  out.push(
    pad(section, 10) +
      String(s.tokens).padStart(8) +
      String(s.ahead).padStart(8) +
      num(s.per100, 9) +
      num(median(peers.map((p) => p.sections[section].per100)), 9),
  );
}
out.push(
  pad('pooled', 10) +
    String(load.overall.tokens).padStart(8) +
    String(load.overall.ahead).padStart(8) +
    num(load.overall.per100, 9) +
    num(median(peers.map((p) => p.overall.per100)), 9),
  '',
  `(the median column is over the ${peers.length} ${load.level} topics — the norm is the corpus, never a chosen number)`,
);

for (const section of SECTIONS) {
  const s = load.sections[section];
  out.push('', `### ${section}: ${s.distinct.length} distinct ahead tokens`);
  if (s.distinct.length === 0) {
    out.push('  (none)');
    continue;
  }
  const line: string[] = [];
  for (const { token, count } of s.distinct) line.push(count > 1 ? `${token}×${count}` : token);
  // wrap at ~92 columns so the list stays readable in a terminal
  let row = ' ';
  for (const entry of line) {
    if (row.length + entry.length + 2 > 92) {
      out.push(row);
      row = ' ';
    }
    row += ` ${entry}`;
  }
  if (row.trim() !== '') out.push(row);
}

out.push(
  '',
  '## Sentence shape (article examples + reading)',
  '',
  `  sentences            ${load.sentences.sentences}`,
  `  mean words           ${load.sentences.meanWords.toFixed(1)}   (${load.level} median ${median(peers.map((p) => p.sentences.meanWords)).toFixed(1)})`,
  `  longest              ${load.sentences.maxWords}`,
  `  Nebensatz/sentence   ${load.sentences.nebensatzPerSentence.toFixed(2)}   (${load.level} median ${median(peers.map((p) => p.sentences.nebensatzPerSentence)).toFixed(2)})`,
  '',
  '## Grammar terminology per explanation half',
  '',
  `${pad('half', 8)}${'words'.padStart(8)}${'terms'.padStart(8)}${'per100'.padStart(9)}`,
);
for (const half of HALVES) {
  const t = load.terminology[half];
  if (!t) continue;
  out.push(pad(half, 8) + String(t.words).padStart(8) + String(t.terms).padStart(8) + num(t.per100, 9, 2));
}
out.push(
  '',
  'A number here ranks this topic against its level, and nothing more —',
  'the matcher folds inflections without a lemmatizer and the Nebensatz count is',
  'a word list, not a parse. See the module doc in packages/content/src/comprehensibility.ts.',
  '',
);

process.stdout.write(out.join('\n'));
