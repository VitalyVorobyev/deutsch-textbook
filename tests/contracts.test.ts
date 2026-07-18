import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { getCurriculum } from '../src/lib/curriculum';
import { gradeTranslation, verdictIsCorrect } from '../src/lib/production';
import { attemptScore, verifiedOnly } from '../src/lib/scoring';
import { isValidSnapshot, sanitizeAttempts, type Attempt } from '../src/lib/store';
import { parseProgressSnapshot } from '../src/lib/snapshot-schema';
import { buildDeck } from '../src/lib/srs';

/** The real content files under content/<dir>, parsed — the same source the validator reads. */
function contentFiles<T>(dir: string): T[] {
  const root = join(process.cwd(), 'content', dir);
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => YAML.parse(readFileSync(join(root, f), 'utf8')) as T);
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
    expect(a2).toHaveLength(19);
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

    const appointmentProbe = sets.find(
      (set) => set.topic === 'termine-vereinbaren' && set.role === 'probe',
    );
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

    const everydayProbe = sets.find(
      (set) => set.topic === 'alltag-tagesablauf' && set.role === 'probe',
    );
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

    const dativeProbe = sets.find((set) => set.topic === 'dativ' && set.role === 'probe');
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
