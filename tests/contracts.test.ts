import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import YAML from 'yaml';
import { getCurriculum } from '../src/lib/curriculum';
import { gradeTranslation, verdictIsCorrect } from '../src/lib/production';
import { attemptScore, verifiedOnly } from '../src/lib/scoring';
import { isValidSnapshot, sanitizeAttempts, type Attempt } from '../src/lib/store';
import { parseProgressSnapshot } from '../src/lib/snapshot-schema';
import { buildDeck } from '../src/lib/srs';

/**
 * The real content files under content/<dir>, parsed — the same source the validator reads.
 *
 * `setId` is attached because (topic, role) is NOT a unique key: a topic may own several
 * probe families, and `.find()` on the pair silently returns whichever file sorts first.
 * When termine-vereinbaren gained a second family, these regression checks quietly began
 * grading a cloze set that has no `answer` at all — the assertion failed loudly, but a
 * subtler collision would not have. Select a set by its id.
 */
function contentFiles<T>(dir: string): (T & { setId: string })[] {
  const root = join(process.cwd(), 'content', dir);
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => ({
      ...(YAML.parse(readFileSync(join(root, f), 'utf8')) as T),
      setId: f.split(sep).join('/').replace(/\.yaml$/, ''),
    }));
}

describe('scoring and curriculum contracts', () => {
  test('partial credit is clamped and practice is excluded', () => {
    expect(attemptScore({ correct: false, correctParts: 5, totalParts: 6 })).toBeCloseTo(5 / 6);
    expect(attemptScore({ correct: false, correctParts: 9, totalParts: 6 })).toBe(1);
    expect(attemptScore({ correct: true, evidence: 'practice' })).toBe(0);
    expect(verifiedOnly([{ correct: true }, { correct: true, evidence: 'practice' }])).toHaveLength(1);
  });

  test('the real spine respects prerequisites and deepening order', () => {
    const curriculum = getCurriculum();
    const position = new Map(curriculum.spine.map((id, index) => [id, index]));
    const outcomes = new Set<string>();
    const groupIds = new Set(curriculum.groups.map((group) => group.id));
    const parentGroups = new Set(curriculum.groups.flatMap((group) => group.parent ? [group.parent] : []));
    for (const node of curriculum.nodes) {
      expect(groupIds.has(node.group)).toBe(true);
      expect(parentGroups.has(node.group)).toBe(false);
      for (const prerequisite of node.prerequisites)
        expect(position.get(prerequisite)!).toBeLessThan(position.get(node.id)!);
      for (const base of node.deepens)
        expect(position.get(base)!).toBeLessThan(position.get(node.id)!);
      for (const outcome of node.outcomes) {
        expect(outcomes.has(outcome.id)).toBe(false);
        outcomes.add(outcome.id);
      }
      for (const related of node.related)
        expect(curriculum.nodes.find((candidate) => candidate.id === related)?.related).toContain(node.id);
    }
  });

  // The length assertion is a tripwire, not a fact worth preserving: it makes any
  // insertion into the A2 spine a deliberate, reviewed act rather than a silent one.
  // Update it together with the unit you added. What the test actually protects is
  // the learner-led module's neighbours and its frozen outcome ids.
  test('the learner-led module keeps its required position in the A2 spine', () => {
    const curriculum = getCurriculum();
    const a2 = curriculum.spine.filter((id) => curriculum.nodes.find((node) => node.id === id)?.level === 'A2');
    expect(a2).toHaveLength(22);
    const position = a2.indexOf('verben-mit-praepositionen');
    expect(a2[position - 1]).toBe('gesundheit-arzttermin');
    expect(a2[position + 1]).toBe('arbeit-beruf');
    expect(curriculum.nodes.find((node) => node.id === 'verben-mit-praepositionen')?.outcomes.map((outcome) => outcome.id)).toEqual([
      'verb-praeposition-waehlen', 'da-wort-sache', 'wo-wort-fragen', 'person-sache-unterscheiden',
    ]);
  });

  test('the current A2 checkpoint has twenty-two stable item ids including both additive checks', () => {
    const checkpoint = contentFiles<{ topic: string; role: string; items: { id: string }[] }>('exercises')
      .find((set) => set.role === 'checkpoint' && set.topic === 'aemter-dienstleistungen')!;
    expect(checkpoint.items).toHaveLength(22);
    expect(checkpoint.items.map((item) => item.id)).toContain('tabelle-da-wo');
    expect(checkpoint.items.map((item) => item.id)).toContain('uebersetzen-sache-person');
  });

  test('every outcome in the real atlas is measured by practice, a drill or a reading', () => {
    // Only practice and drill items count, plus reading questions. A pretest is a guess
    // taken before the lesson; a checkpoint or probe tests an outcome rather than teaching
    // it — an outcome that is only ever tested was never practised. And an outcome nothing
    // measures at all can never light up on the progress page, nor arm its delayed probe.
    const measured = new Set<string>();
    for (const set of contentFiles<{ role?: string; items?: { outcomes?: string[] }[] }>(
      'exercises',
    )) {
      const role = set.role ?? 'practice';
      if (role !== 'practice' && role !== 'drill') continue;
      for (const item of set.items ?? []) for (const o of item.outcomes ?? []) measured.add(o);
    }
    for (const reading of contentFiles<{ questions?: { outcomes?: string[] }[] }>('reading'))
      for (const q of reading.questions ?? []) for (const o of q.outcomes ?? []) measured.add(o);

    const orphans = getCurriculum().nodes.flatMap((node) =>
      node.outcomes.filter((o) => !measured.has(o.id)).map((o) => `${node.id}: ${o.id}`),
    );
    expect(orphans).toEqual([]);
  });

  test('every pretest owns at least one non-mc item (diagnostic generation, not recognition)', () => {
    // A pretest is answered before the lesson and is meant to surface what the learner can
    // *produce*. All 96 items were once `mc`, the format the pilot scores ~93% on, so 22 of 26
    // attempted pretests came back a perfect 3/3 and the diagnostic told the lesson nothing.
    // `bun run validate` enforces this too; the test pins it so a future edit that reverts a
    // pretest to all-mc fails here and not only in the validator.
    const allMc = contentFiles<{ role?: string; items?: { type?: string }[] }>('exercises')
      .filter((set) => set.role === 'pretest')
      .filter((set) => (set.items ?? []).length > 0 && (set.items ?? []).every((i) => (i.type ?? 'mc') === 'mc'))
      .map((set) => set.setId);
    expect(allMc).toEqual([]);
  });

  // Both checks below guard one property with two faces: an item must never grade which
  // word the author had in mind. `docs/authoring/item-authoring.md` had stated it for cloze gaps
  // only; these are the two places it reached `translate` and `table` instead.
  test('no translate item pins one interchangeable connector without saying so', () => {
    // «потому что» renders as denn (V2) or weil (verb-final) with equal fidelity, so an
    // item accepting one and rejecting the other grades a coin flip. It hides behind
    // curriculum order — a2/arbeit-beruf teaches denn and says weil "comes later", which
    // is true on its own page and false in mixed training, where the item is served
    // without that context after weil has been taught.
    // Mirrors INTERCHANGEABLE_CONNECTORS. `darum` is absent on purpose — it is also the
    // pronominal adverb (Darum geht es), where deshalb/deswegen do not preserve the meaning.
    const GROUPS = [
      ['denn', 'weil'],
      ['deshalb', 'deswegen'],
    ];
    const introduces = (text: string, word: string) =>
      new RegExp(`(^|[,;.!?]\\s*)${word}\\b`, 'iu').test(text);

    type Item = {
      id: string;
      type?: string;
      answer?: string;
      accept?: string[];
      instruction?: Record<string, string>;
    };
    const offenders: string[] = [];
    for (const set of contentFiles<{ items?: Item[] }>('exercises')) {
      for (const item of set.items ?? []) {
        if (item.type !== 'translate' || !item.answer) continue;
        const ref = `${set.setId}:${item.id}`;
        const renderings = [item.answer, ...(item.accept ?? [])];
        const instruction = Object.values(item.instruction ?? {}).join(' ').toLowerCase();
        for (const group of GROUPS) {
          const pinned = group.filter((c) => renderings.every((r) => introduces(r, c)));
          if (pinned.length !== 1) continue;
          if (group.some((c) => c !== pinned[0] && renderings.some((r) => introduces(r, c)))) continue;
          // whole word: `dennoch` contains `denn`
          if (new RegExp(`\\b${pinned[0]}\\b`, 'iu').test(instruction)) continue;
          offenders.push(`${ref} pins "${pinned[0]}"`);
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('a table stub ending in an ellipsis is never repeated by the cell it sets up', () => {
    // `Ich komme nicht, weil …` followed by a graded `weil ich heute arbeite` reads back as
    // "…, weil weil ich heute arbeite". The learner who continues the sentence — the natural
    // reading, and the one the instruction asks for — was marked wrong on all three rows
    // while every word order the item drills was correct. The ellipsis is what separates
    // this from a paradigm table, where Nominativ `die` and Akkusativ `die` are both right.
    type Cell = { answer: string; given?: boolean };
    type Item = { id: string; type?: string; rows?: { label: string; cells: Cell[] }[] };
    const bare = (s: string) => s.replace(/[^\p{L}]/gu, '').toLowerCase();
    const offenders: string[] = [];
    for (const set of contentFiles<{ items?: Item[] }>('exercises')) {
      for (const item of set.items ?? []) {
        if (item.type !== 'table') continue;
        for (const row of item.rows ?? []) {
          for (let i = 0; i < row.cells.length - 1; i++) {
            const stub = row.cells[i]!;
            const next = row.cells[i + 1]!;
            if (!stub.given || next.given || !/[…]\s*$/u.test(stub.answer)) continue;
            const last = bare(stub.answer.replace(/[…\s]+$/u, '').split(/\s+/).pop() ?? '');
            const first = bare(next.answer.trim().split(/\s+/)[0] ?? '');
            if (last && last === first)
              offenders.push(`${set.setId}:${item.id} row "${row.label}" repeats "${last}"`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('every authored translation rendering is accepted, including the appointment regression', () => {
    type Translate = {
      id: string;
      type: string;
      answer: string;
      accept?: string[];
      focus?: string;
      key_tokens?: string[];
    };
    type Set = { topic?: string; role?: string; items?: Translate[] };
    const sets = contentFiles<Set>('exercises');
    const translations = sets
      .flatMap((set) => set.items ?? [])
      .filter((item) => item.type === 'translate');

    for (const item of translations) {
      const spec = {
        answer: item.answer,
        accept: item.accept,
        focus: item.focus,
        keyTokens: item.key_tokens,
      };
      for (const rendering of [item.answer, ...(item.accept ?? [])])
        expect(verdictIsCorrect(gradeTranslation(rendering, spec))).toBe(true);
    }

    // Keyed by setId rather than (topic, role): variant-a/b/c ids repeat across probe
    // families by design, so a topic with two families matches twice and .find() returns
    // whichever readdir happens to yield first.
    const alternativeTokenRegressions = [
      {
        setId: 'a1/probe-freizeit-koennen',
        id: 'variant-a',
        given: 'Morgen kann meine Schwester im Park Fotos mache.',
        focus: 'modal-satzklammer',
      },
      {
        setId: 'a1/drill-modal-satzklammer',
        id: 'uebersetzen-film',
        given: 'Wir können heute Abend einen Film schaue.',
        focus: 'modal-satzklammer',
      },
      {
        setId: 'a2/modalverben',
        id: 'uebersetzen-darf-nicht',
        given: 'Du darfs hier nicht rauchen.',
        focus: 'duerfen-muessen',
      },
      {
        setId: 'a2/gesundheit-arzttermin-produktion',
        id: 'uebersetzen-ratschlag-du',
        given: 'Gehee zum Arzt und nimm die Tabletten!',
        focus: 'imperativ-form',
      },
      {
        setId: 'a2/probe-perfekt-haben-sein',
        id: 'variant-a',
        given: 'Die Kinder sind zur Schule gerant.',
        focus: 'haben-sein',
      },
    ] as const;

    for (const regression of alternativeTokenRegressions) {
      const owner = sets.find((set) => set.setId === regression.setId);
      expect(owner).toBeDefined();
      const item = (owner!.items ?? []).find((candidate) => candidate.id === regression.id);
      expect(item).toBeDefined();
      expect(
        gradeTranslation(regression.given, {
          answer: item!.answer,
          accept: item!.accept,
          focus: item!.focus,
          keyTokens: item!.key_tokens,
        }),
      ).toEqual({ kind: 'wrong', focus: regression.focus });
    }

    const appointmentProbe = sets.find((set) => set.setId === 'a2/probe-termine-vereinbaren');
    const variant = appointmentProbe?.items?.find((item) => item.id === 'variant-a');
    expect(variant).toBeDefined();
    expect(
      verdictIsCorrect(
        gradeTranslation('Der Dienstag passt uns nicht. Geht es am Mittwoch?', {
          answer: variant!.answer,
          accept: variant!.accept,
          focus: variant!.focus,
          keyTokens: variant!.key_tokens,
        }),
      ),
    ).toBe(true);

    const everydayProbe = sets.find((set) => set.setId === 'a2/probe-alltag-tagesablauf');
    const everydayVariant = everydayProbe?.items?.find((item) => item.id === 'variant-a');
    const everydaySpec = {
      answer: everydayVariant!.answer,
      accept: everydayVariant!.accept,
      focus: everydayVariant!.focus,
      keyTokens: everydayVariant!.key_tokens,
    };
    expect(
      verdictIsCorrect(
        gradeTranslation('Am Donnerstag um sechs Uhr mache ich Sport.', everydaySpec),
      ),
    ).toBe(true);
    expect(
      verdictIsCorrect(
        gradeTranslation('Am Donnerstag um sechs Uhr Sport mache ich.', everydaySpec),
      ),
    ).toBe(false);

    const dativeProbe = sets.find((set) => set.setId === 'a2/probe-dativ');
    const dativeVariant = dativeProbe?.items?.find((item) => item.id === 'variant-a');
    expect(
      verdictIsCorrect(
        gradeTranslation('Ich fahre am Samstag mit meine Freunde nach Berlin.', {
          answer: dativeVariant!.answer,
          accept: dativeVariant!.accept,
          focus: dativeVariant!.focus,
          keyTokens: dativeVariant!.key_tokens,
        }),
      ),
    ).toBe(false);

    const pizza = sets
      .filter((set) => set.topic === 'perfekt-haben-sein' && set.role === 'practice')
      .flatMap((set) => set.items ?? [])
      .find((item) => item.id === 'uebersetzen-pizza');
    expect(pizza).toBeDefined();
    expect(
      verdictIsCorrect(
        gradeTranslation('Gestern sind wir eine Pizza gegessen.', {
          answer: pizza!.answer,
          accept: pizza!.accept,
          focus: pizza!.focus,
          keyTokens: pizza!.key_tokens,
        }),
      ),
    ).toBe(false);
  });

  test('the station prompt names a train station rather than an ambiguous station', () => {
    const sets = contentFiles<{
      topic?: string;
      items?: Array<{ id: string; prompt_en?: string }>;
    }>('exercises');
    const station = sets
      .filter((set) => set.topic === 'stadt-wege')
      .flatMap((set) => set.items ?? [])
      .find((item) => item.id === 'translate-bahnhof');
    expect(station?.prompt_en)
      .toBe('Excuse me, where is the train station?');
  });

  test('vocabulary distinguishes clothing frames and the two senses of live', () => {
    type Entry = {
      de: string;
      en: string;
      accept?: string[];
      valence?: string;
      note?: { en?: string };
    };
    const decks = contentFiles<{ id: string; entries: Entry[] }>('vocab');
    const clothing = decks.find((deck) => deck.id === 'kleidung-farben')!;
    const firstSteps = decks.find((deck) => deck.id === 'erste-schritte')!;

    expect(clothing.entries.find((entry) => entry.de === 'anziehen')).toMatchObject({
      accept: ['sich anziehen'],
      valence: '+ Akk / sich',
    });
    expect(clothing.entries.find((entry) => entry.de === 'ausziehen')).toMatchObject({
      accept: ['sich ausziehen'],
      valence: '+ Akk / sich',
    });
    expect(firstSteps.entries.find((entry) => entry.de === 'wohnen')?.en)
      .toContain('home or place');
    expect(firstSteps.entries.find((entry) => entry.de === 'leben')?.en)
      .toContain('be alive');
  });

  // Pinned here as well as in the validator, deliberately: the same redundancy
  // the connector-determinacy and table-ellipsis properties get. The defect this
  // guards was found by the learner, not by a gate — an x-de card whose meaning
  // side read "gladly; (verb + gern) to like doing something" and graded `gern`.
  test('no vocabulary gloss names its own headword in a metalinguistic aside', () => {
    type Entry = {
      de: string;
      en: string;
      en_compact?: string;
      ru: string;
      uk?: string;
      note?: unknown;
    };
    const offenders: string[] = [];
    for (const deck of contentFiles<{ id: string; entries: Entry[] }>('vocab')) {
      for (const entry of deck.entries) {
        const headwords = entry.de.split(/[^A-Za-zÄÖÜäöüß]+/).filter((w) => w.length > 2);
        for (const lang of ['en', 'en_compact', 'ru', 'uk'] as const) {
          const gloss = entry[lang];
          if (!gloss) continue;
          // An aside is a parenthetical or an em-dash restatement. The running
          // text is exempt: ~104 glosses ARE their headword (Kiosk → "kiosk"),
          // which costs German spelling and is not a leak.
          const asides = [...gloss.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
          const dash = gloss.indexOf('—');
          if (dash > 0) asides.push(gloss.slice(0, dash));
          for (const w of headwords) {
            // trailing letters too: `lang` was glossed "(variant of lange)",
            // which names the answer and then marks `lange` wrong.
            const re = new RegExp(
              `(^|[^A-Za-zÄÖÜäöüß])${w}[A-Za-zÄÖÜäöüß]{0,3}([^A-Za-zÄÖÜäöüß]|$)`,
              'i',
            );
            if (asides.some((aside) => re.test(aside)))
              offenders.push(`${deck.id}::${entry.de}::${lang}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('dual-language vocabulary commentary has a shorter English display half', () => {
    type Entry = { de: string; en: string; en_compact?: string; ru: string; uk?: string };
    const extended = (text: string | undefined) =>
      !!text && (/\([^)]{8,}\)/.test(text) || /\s[—–]\s/.test(text));
    const offenders: string[] = [];
    for (const deck of contentFiles<{ id: string; entries: Entry[] }>('vocab')) {
      for (const entry of deck.entries) {
        if (!extended(entry.en) || ![entry.ru, entry.uk].some(extended)) continue;
        if (!entry.en_compact || entry.en_compact.length >= entry.en.length)
          offenders.push(`${deck.id}::${entry.de}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the reported open/close family uses compact dual prompts and additive notes', () => {
    type Entry = {
      de: string;
      en: string;
      en_compact?: string;
      ru: string;
      note?: { en: string; ru: string };
    };
    const decks = contentFiles<{ id: string; entries: Entry[] }>('vocab');
    const separable = decks.find((deck) => deck.id === 'trennbare-verben')!;
    const zumachen = separable.entries.find((entry) => entry.de === 'zumachen')!;
    expect(zumachen.en_compact).toBe('to close, to shut');
    expect(`${zumachen.en_compact} · ${zumachen.ru}`).toBe(
      'to close, to shut · закрывать (окно, дверь, магазин — разговорный отделяемый глагол, не schließen)',
    );
    expect(zumachen.note?.ru).toStartWith('schließen — нейтральный');
    expect(zumachen.note?.ru).not.toContain('zumachen — разговорный');
  });

  // The usage note is the reason a gloss ever carried a construction hint: it
  // was visible in the Wortschatz table and nowhere on a card. buildDeck must
  // keep carrying it, or the pressure that produced the leak comes back.
  test('a usage note reaches the card, where it can only be read after answering', () => {
    type Entry = Parameters<typeof buildDeck>[1][number];
    const deck = contentFiles<{ id: string; entries: Entry[] }>('vocab')
      .find((candidate) => candidate.id === 'freizeit-koennen')!;
    const cards = buildDeck(deck.id, deck.entries);
    const production = cards.find((c) => c.de === 'gern' && c.dir === 'x-de')!;
    expect(production.note?.en).toContain('after the conjugated verb');
    // The prompt side of that same card must not contain the answer.
    expect(production.en).not.toMatch(/\bgern\b/i);
    expect(production.ru).not.toMatch(/\bgern\b/i);
    // `gerne` is called an equally correct variant in the note, so the card has
    // to accept it — otherwise the note promises German the grader marks wrong.
    expect(production.accept).toContain('gerne');
  });

  test('the da/wo deck creates exactly sixteen contextual cards with stable phrase identities', () => {
    type Entry = Parameters<typeof buildDeck>[1][number];
    const deck = contentFiles<{ id: string; entries: Entry[] }>('vocab')
      .find((candidate) => candidate.id === 'verben-mit-praepositionen')!;
    expect(deck.entries.map((entry) => entry.de)).toEqual([
      'daran denken', 'darauf warten', 'darüber sprechen', 'davon träumen',
      'sich dafür interessieren', 'damit arbeiten', 'sich daran erinnern', 'sich darauf freuen',
    ]);
    expect(buildDeck(deck.id, deck.entries)).toHaveLength(16);
    for (const entry of deck.entries) {
      expect(entry.en).not.toMatch(/^about it$|^with it$|^for it$/i);
      expect(entry.ru.length).toBeGreaterThan(8);
    }
  });

  test('v1-v5 snapshots remain accepted and malformed partial scores are sanitized', () => {
    for (const version of [1, 2, 3, 4, 5])
      expect(isValidSnapshot({ version, exportedAt: '', attempts: [], cards: {} })).toBe(true);
    const bad: Attempt = {
      setId: 'x', itemId: 'y', itemType: 'table', correct: false,
      correctParts: 2, totalParts: 0, given: '', ts: 1,
    };
    expect(sanitizeAttempts([bad])[0]?.totalParts).toBeUndefined();
  });

  // The regression this file previously could not see: the two halves above never met.
  // `isValidSnapshot` was only ever called with an EMPTY attempts array and `sanitizeAttempts`
  // directly on a hand-built object, so a parse boundary stricter than the sanitizer it feeds
  // passed both assertions while rejecting the whole import at runtime.
  test('a legacy snapshot carrying malformed partial credit survives the import boundary', () => {
    const legacy = {
      version: 4,
      exportedAt: '2026-01-01T00:00:00.000Z',
      cards: {},
      attempts: [
        {
          setId: 'a1/artikel', itemId: 'bad', itemType: 'table', correct: false,
          correctParts: 2, totalParts: 0, given: '', ts: 1,
        },
        {
          setId: 'a1/artikel', itemId: 'good', itemType: 'mc', correct: true, given: 'der', ts: 2,
        },
      ],
    };

    expect(isValidSnapshot(legacy)).toBe(true);

    const parsed = parseProgressSnapshot(legacy);
    const attempts = sanitizeAttempts(parsed.attempts);

    // the malformed row is normalized, not rejected — and the healthy sibling survives with it
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.totalParts).toBeUndefined();
    expect(attempts[0]?.correctParts).toBeUndefined();
    expect(attempts[1]?.correct).toBe(true);
  });
});

// The recognition-only mechanism is defaulted, never retrofitted: card identity is
// `<deck>::<de>::<direction>`, so flipping a shipped entry to `recognition` would delete
// the learner's SRS history for its production card. These two tests are the guard.
describe('cards: recognition | both', () => {
  test('no shipped entry has been retrofitted — every deck still builds two cards per entry', () => {
    type Entry = Parameters<typeof buildDeck>[1][number];
    let entries = 0;
    let cards = 0;
    for (const deck of contentFiles<{ id: string; entries: Entry[] }>('vocab')) {
      entries += deck.entries.length;
      cards += buildDeck(deck.id, deck.entries).length;
    }
    // If this ever fails, an existing entry was switched to recognition-only and a learner
    // lost the FSRS history of its x-de card. New B1 decks may of course lower the ratio —
    // update the assertion in the same change that ships them, deliberately.
    // B1.1 (erfahrungen-erzaehlen, 2026-07-24) ships the first two recognition-only
    // entries — geschehen and erschrecken — so two production cards fewer, by design.
    // B1.2 (leben-veraendern, 2026-07-24) adds three more — Wohngemeinschaft,
    // Grundstück and Wohnort: read in ads and on forms, not produced at B1.
    // B1.3 (gesundheit-wohlbefinden, 2026-07-24) adds three more — Schmerzmittel,
    // Tropfen and Wirkung: package-insert language, read on the box, not produced at B1.
    // B1.4 (arbeit-bewerbung, 2026-07-26) adds nineteen — the deck's whole receptive tail
    // (Betrieb … berufstätig): job-ad and workplace vocabulary a B1 learner must read off
    // an advertisement but is never asked to produce. This is the first deck built to the
    // level-wide two-tier policy, so the ratio drops sharply here by design.
    // B1.5 (meinung-medien, 2026-07-26) adds seventeen more — the deck's receptive tail
    // (Standpunkt … tatsächlich): media-institution and evaluation vocabulary a B1 learner
    // meets on a page or a screen and has to understand, but is not asked to produce.
    // Moderator and Kritik were drafted into that tail and taken back out in review: the
    // unit's own primaryPractice has the learner *type* both in a scored translate item,
    // and a word an exercise asks for is by definition one the deck has to train. The scan
    // that caught it — every translate answer, listen text and cloze gap under
    // content/exercises against every recognition-only headword in the corpus — now
    // returns zero.
    // B1.6 (konsum-umwelt, 2026-07-28) adds seventeen more — the deck's receptive tail
    // (Konsum … ökologisch): label, notice and report vocabulary a B1 learner reads on
    // packaging and on a bin but is not asked to produce.
    // B1.7 (regeln-verantwortung, 2026-07-29) adds seventeen more — the deck's receptive
    // tail (Vorschrift … Konflikt): notice, sign and safety-leaflet vocabulary a B1
    // learner reads on an Aushang or an Amt letter but is not asked to produce.
    // B1.8 (reisen-probleme, 2026-07-30) adds thirteen more — the deck's receptive tail
    // (klagen … Kontrolle): ticket, timetable and hotel-desk vocabulary a B1 learner
    // reads in the small print or hears in a Durchsage but is not asked to produce.
    // B1.9 (lernen-zukunft, 2026-07-31) adds nine more — the deck's receptive tail
    // (Zertifikat … Studie): course-catalogue and classroom-role vocabulary a B1
    // learner reads on a school's notice board or in its programme but is not asked
    // to produce.
    // B1.10 (gesellschaft-zusammenleben, 2026-08-03) adds twenty — eighteen are the
    // deck's receptive tail (Gesellschaft … gerecht): the courtyard, the notice board
    // and the people around a Hausversammlung, which a B1 learner reads on an Aushang
    // or hears across the room but is not asked to produce. The other two, `nachgeben`
    // and `gegenseitig`, are off the Goethe-B1 manifest and named by no frozen outcome,
    // so they earn one card rather than two; `Einwand` and `Meinungsverschiedenheit` are
    // off-manifest too and stay core, because the unit's own atlas outcomes contain
    // those words (`einwand-ausdruecken`, "bei einer Meinungsverschiedenheit").
    // The Wortliste completion pass (2026-08-03) starts here, and it is the first source
    // of recognition-only entries that is not a unit deck: `konnektoren-partikeln-b1`
    // adds twenty-two — the modal particles (eben, halt, wohl, bloß, gar, zwar, nun,
    // überhaupt), the discourse markers (okay, sowieso, selbstverständlich, meinetwegen,
    // offenbar) and the connectors whose EN/RU prompt more than one German word
    // answers (seitdem/seit, solange, indem, als ob, soviel, beziehungsweise, umso,
    // wieso, and daher against A2's shipped deshalb and also). A typed production card
    // cannot fairly grade "the particle meaning ведь", and per the amendment in
    // docs/curriculum/a2-b1.md recognition stays over half of every completion deck.
    // `graduierung-mengenwoerter-b1` (2026-08-03) adds twenty-four on the same argument,
    // and here it is almost entirely the shipped-synonym one: A1/A2 already sell `oft`,
    // `meistens`, `normalerweise`, `schon`, `nur`, `alle`, `wieder`, `fast`, `total`,
    // `ganz`, `unbedingt`, `vielleicht`, `wahrscheinlich` and `bisschen` as production
    // cards, so `häufig`, `meist`, `gewöhnlich`, `bereits`, `ausschließlich`, `sämtliche`,
    // `noch mal`, `nochmals`, `beinahe`, `völlig`, `absolut`, `bestimmt`, `eventuell`,
    // `vermutlich` and `ein bisschen` answer a prompt a shipped card already owns — which
    // no `accept` list can repair, because the two cards live in different decks. Four
    // more (`circa`, `etwa`, `je`, `jeweils`) would compete inside this very deck, and
    // three (`so viel wie`, `wie viele`, `noch mal`) would grade a space rather than a
    // word; `einzeln` and `folgend` are notice-and-packaging vocabulary.
    // `eigenschaften-bewertung-b1` (2026-08-03) adds twenty-six, and the shipped-synonym
    // argument again does most of the work — but here it lands on whole clusters rather
    // than on single pairs. A2's `bewertung-a2` alone sells `toll`, `super`,
    // `fantastisch`, `wunderbar`, `klar`, `richtig` and `echt` as production cards, so
    // the five-word "excellent" cluster collapses to one: `perfekt` keeps the typed card
    // on the narrow claim that nothing is left to correct, and `ausgezeichnet`, `ideal`,
    // `klasse`, `cool` and `wunderschön` answer prompts that are already owned —
    // `cool` twice over, because A2's `kühl` is glossed "cool" letter for letter.
    // The same test disqualifies `korrekt` (against `richtig`), `eindeutig` (`klar`,
    // `deutlich`), `unterschiedlich` (`verschieden`), `komplett` (`total`, `ganz`),
    // `still` (`leise`, `ruhig`), `vergeblich` (`umsonst`, whose second gloss is "in
    // vain"), `erforderlich` (`notwendig` and `nötig`, both glossed "necessary"),
    // `üblich` (`normal`, `normalerweise`, `meistens` — the ruling `gewöhnlich` already
    // got on the sibling deck, and the two notes now agree), `alltäglich` (`täglich`,
    // `Alltag`), `dicht` (`dick`), `fest` (`hart`) and `original` (`echt`). `fertig` is
    // the one that looks like an A1 word and is not: A2 ships the phrase `fertig sein`
    // glossed "to be ready, to be finished", and this headword IS that answer, in
    // another deck where no `accept` list can reach it. Six more are recognition on the
    // register argument alone — `begrenzt`, `einheitlich`, `allgemein`, `alternativ`,
    // `zugänglich`, `äußerlich`: Aushang, Beipackzettel, AGB and course-programme
    // vocabulary, read constantly and produced never at B1. `unheimlich` and `intensiv`
    // join them because each carries two unrelated senses one example cannot hold.
    // `ort-richtung-verweis-b1` (2026-08-03) adds twenty-four, and the collision test
    // does most of the work again — but this deck's collisions are with the *directional*
    // A1/A2 lexis rather than with adjectives. `richtung-position-a2` and
    // `funktionswoerter-chunks` already sell `drinnen`, `draußen`, `nirgends`, `raus`,
    // `rein`, `vorwärts`, `zurück`, `oben`, `unten`, `hier`, `da` and `dort` as production
    // cards, so `innen`, `außen`, `drin`, `nirgendwo`, `rauf`, `runter`, `aufwärts` and
    // `abwärts` answer prompts a shipped card already owns, two decks over. `nahe` is the
    // same word as A1 `nah`, `selber` the same word as A2 `selbst`, `ebenfalls` a written
    // A1 `auch`, `hinterher` an A2 `danach`, `nebenbei` the B1 `übrigens` already carded
    // in `konnektoren-partikeln-b1`, and `voraus` competes with both A2 `vorher` and A2
    // `vorwärts`. `heim` fails a different test: the form a B1 learner must produce for
    // "home(wards)" is `nach Hause`, so a typed card would train the wrong word.
    // Three are decided inside the deck. `ebenso` is the sharpest case in the pass so
    // far — `genauso` in `graduierung-mengenwoerter-b1` ships it in `accept`, so a
    // production card here would let two different prompts grade one rendering correct;
    // `gleichfalls` therefore takes the deck's single typed card for the likewise family,
    // on the reply formula no other card answers, and lists `ebenfalls` in its own
    // `accept`. `dahin` yields to `dorthin`, which accepts it. `derselbe` declines on both
    // halves at once and splits after a preposition (am selben Tag), so a typed card would
    // grade which of six forms was meant; `dabei`, `los` and `recht` each carry three or
    // more unrelated jobs that no single EN/RU prompt can name. `vor allem` was the close
    // call and lost twice over: A2 `besonders` already owns "especially", and the headword
    // is two words, so the card would grade the space against `vorallem`. `mitten` is the
    // twenty-fifth, added in review: it never stands alone, and neither English nor Russian
    // has a bare word for it, so every gloss of it is a prepositional phrase and a typed
    // prompt invites `mitten in` — the `so viel wie` defect with the space on the inside.
    // `zeit-b1` (2026-08-03) adds thirty, the largest recognition share of the pass so far
    // (30 of 40), and it is earned rather than chosen: time is the densest synonym field
    // A1/A2 has already sold. Run mechanically — YAML-parse every deck, index every
    // `de`/`en`/`ru`/`uk`/`accept` of every entry whose `cards` is absent or `both`, then
    // check the forty candidate glosses against it — the collision test flagged seventeen.
    // Sixteen of those became recognition: `Anfang`, `Moment`, `zuerst`, `danach`, `später`,
    // `dann`, `neulich`, `gerade`, `ständig`, `irgendwann`, `Alltag`, `Kalender`, `Werktag`,
    // `wahrscheinlich`, `Zukunft` and `sich beeilen` ship as production cards elsewhere, so
    // `Beginn`, `Augenblick`, `anfangs`, `zunächst`, `nachher`, `kürzlich`, `vorhin`,
    // `dauernd`, `jemals`, `Tagesablauf`, `Terminkalender`, `Wochentag`, `voraussichtlich`,
    // `zukünftig` and `eilen` answer a prompt that is already owned — unrepairable by
    // `accept`, because the two cards live in different decks and the grader only ever sees
    // one. `Wochentag` is the one no reading of the glosses would have caught: A2's `Werktag`
    // is glossed "weekday, working day (Mon–Sat)", and "weekday" is the standard English
    // rendering of both, which is exactly why a learner swaps them. The seventeenth,
    // `Zeitpunkt`, survives as `both`: it collided only on the glosses "moment" and "time",
    // which were then dropped — it ships glossed "point in time" alone, and no shipped card
    // answers that. Four more are ruled inside the deck, on tests the index cannot run.
    // `mittlerweile` and `inzwischen` are the
    // same word for every practical purpose, so `inzwischen` takes the family's one typed card
    // and lists `mittlerweile` in `accept` — the `ebenso`/`genauso` ruling from
    // `ort-richtung-verweis-b1`. `zurzeit` grades a space whose two sides mean different
    // things: solid it is "at present", split `zur Zeit` is "at the time of" and wants a
    // Genitiv, so a production card cannot signal which is wanted — the `so viel` case, this
    // time with the meanings rather than the spelling doing the splitting. `dreiviertel` grades
    // a space too (`drei viertel` is equally correct) on top of colliding with `viertel`. And
    // the `-lich` frequency series is priced as one rule rather than five words: `täglich`
    // (gesundheit-arzttermin) already sells the pattern at A2, so `monatlich` takes this deck's
    // single typed card — the member a B1 learner writes, on rent, salary and every
    // subscription — while `stündlich`, `wöchentlich`, `jährlich` and `wochentags` are derived
    // from `Stunde`, `Woche`, `Jahr` and `Woche`, all carded, by a rule the learner can see.
    // Five typed cards for one visible rule buys nothing the sixth does not already teach.
    // The remainder are recognition on register alone: `Eile`, `längst`, `vorläufig`,
    // `Jahrzehnt`, `Jahrhundert`, `Jahrtausend`, `Nationalfeiertag` and `Pfingsten` are
    // notice, contract, museum-label and calendar vocabulary — read at B1 and never produced.
    // `digitales-leben` (B1.11, 2026-08-04) adds sixteen, and the line falls where the
    // learner stops writing the word and only has to recognise it on a screen. The unit's
    // three outcomes are read an Anleitung, write a fault report, talk about media use, so
    // the twenty-two productive entries are exactly what those three tasks need to be
    // produced: `Anleitung`, `Schritt`, `Reihenfolge`, `Taste`, `Feld`, `Zugang`, `Akku`,
    // `Kabel`, `Netz`, `Technik` and the eleven verbs and adjectives a form, a fault and a
    // habit are described with. The sixteen recognition entries are what the *screen* says
    // back: `Software`, `Symbol`, `Menü`, `Stecker`, `Fernbedienung`, `Bedienungsanleitung`
    // and `Textnachricht` are label-and-box vocabulary, read constantly and written never;
    // `installieren`, `hochladen`, `sichern`, `anklicken`, `tippen` and `zuschauen` are
    // instruction verbs the learner obeys rather than issues — and `anklicken` additionally
    // collides with this deck's own `klicken`, which differs only in whether the object
    // arrives through `auf`, so a typed prompt could not name which of the two it wanted.
    // `Serie` loses the "what I watch" slot to cards that already ship: `Film`
    // (freizeit-koennen, A1) and `Sendung` (kultur-unterhaltung-a2), and the productive
    // core of the media-use outcome is the frequency-duration-purpose frame the article
    // teaches (`täglich`, `ungefähr zwei Stunden`, `zum Lesen`), not the genre noun.
    // `Unterhaltung` carries two unrelated senses one example cannot hold — entertainment
    // and conversation — and each already has a carded answer, `Spaß`
    // (kultur-unterhaltung-a2) and `Gespräch` (menschen-beziehungen-a2); that is the
    // `unheimlich`/`intensiv` ruling from `eigenschaften-bewertung-b1`. `abhängig` is
    // recognition on register: it is the word a screen-time article uses, while the
    // article's own model for saying the same thing is the plain
    // `Ich brauche das Handy auch für die Arbeit`.
    // `kultur-freizeit` (B1.12, 2026-08-04) adds sixteen on the same test, applied to a
    // flyer instead of a screen: the line falls where the learner stops writing the word
    // and only has to read it off a programme. The unit's three outcomes are read a
    // Programm, agree on an evening, write a short report of it, so the twenty-two
    // productive entries are what those three tasks have to say out loud — `Vorstellung`,
    // `Publikum`, `Bühne`, `Saal`, `Reservierung`, `Treffpunkt`, `Stimmung`, `Roman`,
    // `Figur`, `Wanderung`, the eight verbs of arranging and judging, and the four
    // evaluative words a report and a plan are built from. The sixteen recognition entries
    // are what the *programme* says back: `Oper`, `Orchester`, `Ballett`, `Szene`,
    // `Auftritt`, `Saison`, `Broschüre` and `Überschrift` are label-and-poster vocabulary,
    // read on every flyer and written on none; `aufführen`, `auftreten` and `ankündigen`
    // are what a venue does to an event, never what a learner reports doing. Three lose a
    // productive slot to a card that already ships or to this deck's own core: `Tanz` to
    // `tanzen` (freizeit-koennen, A1), which is the form the plan actually needs;
    // `Auswahl` to this deck's `aussuchen`, since a typed prompt for "choice" cannot say
    // which of the noun and the verb it wants — the `anklicken`/`klicken` ruling from
    // `digitales-leben`; and `Langeweile` to `sich langweilen`, the same pair one step
    // further, with `langweilig` (bewertung-a2) already carded. `verabredet` is the
    // participle of this deck's own `verabreden` and would grade the same word twice.
    // `Vergnügen` is recognition on register: `Viel Vergnügen!` is printed at the foot of
    // a programme, and the article's model for saying it is the plain `sich amüsieren`,
    // which does ship as a production card.
    // Wortliste completion wave 1, decks 6–11 (2026-08-04) add a hundred and thirty-two
    // across six unowned decks — `verben-handlungen-b1-1` (20 of 35),
    // `verben-handlungen-b1-2` (23 of 34), `verben-handlungen-b1-3` (20 of 34),
    // `verben-kommunikation-ausdruck-b1` (21 of 36), `charakter-verhalten-b1` (23 of 40)
    // and `zahlen-mengen-masse-b1` (25 of 39). Every split was run through the same
    // mechanical collision test as the five wave-1 decks before them: YAML-parse every
    // deck, index the `de`/`en`/`ru`/`uk`/`accept` of every entry whose `cards` is absent
    // or `both`, and check each candidate gloss against it.
    // The general-purpose verbs collide hardest, because A1/A2 already sell the plain
    // members of every family: `benutzen` owns "to use", so `anwenden`, `verwenden` and
    // `gebrauchen` are one prompt with three headwords; `bekommen`/`kriegen`/`holen` own
    // "to get", which retires `besorgen`, `erhalten` and `empfangen`; `laufen` owns "to
    // run" (`rennen`), `fallen` owns "to fall" (`stürzen`, and `sinken` in the numbers
    // deck), `wenden` owns "to turn" (`drehen`, `umdrehen`), `setzen`/`stellen`/`legen`
    // own "to put" (`stecken`), `erfahren` owns "to find out" (`herausfinden`),
    // `akzeptieren`/`zusagen` own "to accept" (`annehmen`), `prüfen` owns "to test"
    // (`testen`), `diskutieren` owns "to discuss" (`besprechen`), `notieren` owns "to
    // write down" (`aufschreiben`), `sich bemühen` owns "to make an effort"
    // (`sich anstrengen`), and `danken`/`bedanken` own "to thank" twice over, which is
    // why the B1 headword `sich bedanken` cannot have a typed card at all.
    // `neugierig` is the one no reading of the glosses would have caught: `gespannt`
    // (kultur-freizeit, shipped in the same tree) is glossed "eager to see what comes,
    // curious", and "curious" is the standard rendering of both — the `Wochentag`/`Werktag`
    // case from `zeit-b1`, in the other direction.
    // Four rulings are made inside a deck rather than against another one. `reichen` takes
    // the typed card for the enough-family and lists `ausreichen` and `genügen` in its
    // `accept`, the `dorthin`/`dahin` ruling from `ort-richtung-verweis-b1`; `verlangen`
    // takes it from `fordern`; `festlegen` from `festsetzen`; `Entfernung` from `Distanz`.
    // `ordnen` was drafted `both` and demoted in review: `organisieren` and `vereinbaren`
    // both ship "to arrange", `regeln` owns the sorting-out prompt and `aufräumen` the
    // tidying one — three owners in three other decks for one headword.
    // The rest are recognition on two arguments the corpus has used before. Multi-sense
    // headwords one example cannot hold: `aufheben`, `fassen`, `festhalten`, `treten`,
    // `brechen`, `leisten`, `einsetzen`, `ausrichten`, `handeln`, `aufhalten`, `behandeln`,
    // `vertreten`, `verraten`, `versichern`, `Ausdruck`, `locker`, `schuldig` — the
    // `unheimlich`/`intensiv` ruling from `eigenschaften-bewertung-b1`. And register: the
    // office and notice words (`benötigen`, `erstellen`, `unterlassen`, `beschränken`,
    // `festsetzen`, `feststehen`, `sich befinden`, `sich ereignen`, `Anrede`,
    // `Aufforderung`, `Begründung`, `bekannt geben`, `kreativ`, `flexibel`), the
    // instruction verbs a learner obeys rather than issues (`einfügen`, `zuordnen`,
    // `nachschlagen`, `unterstreichen` — the `installieren` ruling from `digitales-leben`),
    // and the units and figures that are read and never quoted (`Zentimeter`, `Kilometer`,
    // `Milliarde`, `Franken`, `Deka`, `Dekagramm`, `Pfund`, `Geschwindigkeit`).
    // `Zentimeter`, `Kilometer`, `durchschnittlich`, `Länge`, `Breite` and `vergrößern`
    // additionally lose their card to a rule the learner can see — they are `Meter`,
    // `Durchschnitt`, `lang`, `breit` and `groß` plus an affix, which is the `-lich`
    // frequency-series ruling from `zeit-b1`. `Null` is the sharpest of them: A1 ships the
    // numeral `null`, and the two differ by one capital letter.
    // `geld-vertraege` (B1.13, 2026-08-04) adds sixteen on the same test, applied to the
    // paper a household is sent: the line falls where the learner stops saying the word and
    // only has to read it off a bill or out of the small print. The unit's three outcomes
    // are check a Rechnung, ask about a Vertrag, compare what two things cost, so the
    // twenty-two productive entries are what those three tasks have to say out loud —
    // `Zeile`, `Kosten`, `Zahlung`, `Überweisung`, `Mahnung`, `Kündigung`, `Abo`,
    // `Anbieter`, `Alternative`, `Angabe`, `Auftrag`, `Material`, `Bargeld`,
    // `Kreditkarte`, `Leistung`, `Trinkgeld`, the two adjectives a payment date turns on
    // (`fällig`, `gültig`) and the four verbs the field has left unowned. The sixteen
    // recognition entries are what the *paper* says back: `verpflichtet`, `Anspruch`,
    // `Forderung`, `pauschal`, `Abschnitt` and `Urkunde` are terms-and-conditions and
    // Amt language, read in every contract and written in none; `Stempel`, `Girokonto`,
    // `Tabelle` and `ausstellen` are what a bill, a receipt and an estimate are printed
    // with. Four lose a productive slot to a card that already ships or to this deck's own
    // core: `Abonnement` to `Abo`, which lists it in `accept` — the `gleichfalls`/
    // `ebenfalls` ruling from `ort-richtung-verweis-b1`; `Kauf` to `kaufen` (A1) and to
    // `Einkauf` (einkaufen-geschaefte), both glossed "purchase"; `Erhöhung` to `erhöhen`
    // (zahlen-mengen-masse-b1), the noun-to-verb case of the `Auswahl`/`aussuchen` ruling
    // from `kultur-freizeit`; and `Schulden` on register — a Mahnung says it, a learner at
    // a counter does not. `Ausgabe` and `Nachfrage` carry two unrelated senses one example
    // cannot hold (spending and a newspaper's edition; asking again and market demand) —
    // the `unheimlich`/`intensiv` ruling from `eigenschaften-bewertung-b1`.
    // One `both` entry is kept over a collision, deliberately: `Kosten` case-folds onto
    // A1's verb `kosten` (essen-trinken). It is NOT the `Null`/`null` case, because that
    // pair shares a prompt — here nothing is shared but the letters: "to cost" and
    // "costs, what something comes to altogether" are different questions, and the unit's
    // own `kosten-vergleichen` outcome is unwritable without the noun.
    // `informationen-vermitteln` (B1.14, 2026-08-04) adds twenty-one, the largest receptive
    // share of any unit deck so far (21 of 38) — and it is a finding rather than a choice.
    // The mediation field is almost entirely owned before this unit opens: `mitteilen`
    // (regeln-verantwortung), `informieren` and `Nachricht` (kommunikation-medien),
    // `berichten` (verben-handlungen-a2-1), `melden` (arbeit-beruf), `zusammenfassen`,
    // `behaupten`, `Aussage`, `Meldung` and `Quelle` (meinung-medien), `ausrichten`
    // (verben-handlungen-b1-2), `ankündigen` (kultur-freizeit) and `Bescheid`
    // (redemittel-chunks-a2) are every one of them another deck's headword, so seventeen
    // productive entries is what the field has left. Five were drafted `both` and demoted by
    // the same mechanical collision test the pass before it used: `Neuigkeit` against
    // `Nachricht` (glossed "message; (pl.) the news"), `Sinn` against `Bedeutung`
    // ("meaning | значение, смысл"), `Zeichen` against `Schild` ("sign (road sign, notice)"),
    // `Dokument` against `Unterlagen` and `Papiere` (both glossed "documents"), and
    // `verständlich` against `klar` ("clear, plain | ясный, понятный") — the `eindeutig`
    // ruling from `eigenschaften-bewertung-b1`. `Detail` yields its productive slot to this
    // deck's own `Einzelheit`, which lists it in `accept`: the `dorthin`/`dahin` ruling from
    // `ort-richtung-verweis-b1`. The rest are recognition on register — `Schreiben`, `Anlage`,
    // `Einschreiben`, `Vermittlung`, `Vertretung`, `Darstellung`, `Einleitung`, `Fortsetzung`,
    // `Textaufbau`, `Ansage`, `Lautsprecher` and `Vortrag` are what a formal letter, a notice
    // board and a course handout say to you — plus `Botschaft`, `aufnehmen` and `anzeigen`,
    // which each carry two unrelated senses one example cannot hold (the
    // `unheimlich`/`intensiv` ruling from `eigenschaften-bewertung-b1`).
    expect(cards).toBe(entries * 2 - 448);
  });

  test('a recognition entry builds the DE→meaning card alone, with a stable id', () => {
    type Entry = Parameters<typeof buildDeck>[1][number];
    const base = {
      de: 'Zuschlag', pos: 'noun', gender: 'm', plural: 'die Zuschläge', ipa: 'ˈtsuːʃlaːk',
      en: 'surcharge', ru: 'доплата',
      example_de: 'Der Zuschlag kostet drei Euro.',
      example_en: 'The surcharge costs three euros.',
      example_ru: 'Доплата стоит три евро.',
    } as unknown as Entry;
    const both = buildDeck('d', [{ ...base, cards: 'both' } as Entry]);
    const recognition = buildDeck('d', [{ ...base, cards: 'recognition' } as Entry]);
    expect(both.map((c) => c.dir)).toEqual(['de-x', 'x-de']);
    expect(recognition.map((c) => c.dir)).toEqual(['de-x']);
    // The surviving card keeps the id it would have had either way, so switching an entry
    // BEFORE it ships costs nothing and the recognition card's history is never at risk.
    expect(recognition[0]!.id).toBe(both[0]!.id);
  });
});
