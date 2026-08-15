import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  exerciseLevelFromPath,
  grammarCoverage,
  loadGrammarInventory,
} from '@da/content/grammar-coverage';

/** A throwaway content tree, so the escape-hatch rules can be tested on shapes
 *  the real inventory must never contain. */
function fixture(points: unknown[], topics: Record<string, string[]> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'grammar-coverage-'));
  mkdirSync(join(root, 'data'), { recursive: true });
  const tracked = points.map((point) => ({ track: 'fixture', ...(point as Record<string, unknown>) }));
  writeFileSync(join(root, 'data', 'grammar-inventory.yaml'), JSON.stringify({
    tracks: [{ id: 'fixture', strand: 'verbformen', de: 'Fixture', en: 'Fixture', order: 1 }],
    points: tracked,
  }));
  mkdirSync(join(root, 'content', 'exercises'), { recursive: true });
  for (const [level, ids] of Object.entries(topics)) {
    mkdirSync(join(root, 'content', 'topics', level), { recursive: true });
    for (const id of ids) writeFileSync(join(root, 'content', 'topics', level, `${id}.mdx`), '');
  }
  return root;
}

describe('grammar coverage', () => {
  test('exercise levels resolve with POSIX and Windows path separators', () => {
    expect(
      exerciseLevelFromPath(
        '/repo/content/exercises/a2/practice.yaml',
        '/repo/content/exercises',
      ),
    ).toBe('A2');
    expect(
      exerciseLevelFromPath(
        String.raw`C:\repo\content\exercises\a2\practice.yaml`,
        String.raw`C:\repo\content\exercises`,
      ),
    ).toBe('A2');
  });

  test('inventory point ids are unique and every point can be marked taught', () => {
    const points = loadGrammarInventory();
    const ids = points.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    // A point with neither focus tags nor reference_only could never be covered,
    // so it would sit in the report as a permanent gap nobody can close.
    for (const point of points)
      expect(Boolean(point.reference_only) || (point.focus?.length ?? 0) > 0).toBe(true);
  });

  // The 2026-08-14 anchor pass reopened four honest gaps: coordinating conjunctions, both
  // Wortbildung sections and the demonstrative determiner. The A1 quality wave closed them with
  // owner articles, scaffold/fade/transfer practice and delayed probes. This is a ratchet again:
  // adding an inventory row without evidence must reopen it visibly.
  test('A1 is complete against its explicit internal inventory', () => {
    const coverage = grammarCoverage('A1');
    const missing = coverage.points.filter((p) => p.status === 'missing').map((p) => p.point.id).sort();
    expect(missing).toEqual([]);
    expect(coverage.covered).toBe(28);
    expect(coverage.percent).toBe(100);
    expect(coverage.late).toBe(0);
  });

  // The 2026-08-14 anchor pass deliberately reopened reciprocal pronouns, interrogative
  // determiners and temporal `über`: the rows existed before their teaching evidence. The A2
  // source-led wave then paid for each with an addressable article section, scaffold, transfer and
  // a parallel three-variant probe family. This is a ratchet again: a new internal row without
  // learner-facing evidence must make the test fail.
  test('A2 is complete against its explicit internal inventory', () => {
    const coverage = grammarCoverage('A2');
    const missing = coverage.points.filter((p) => p.status === 'missing').map((p) => p.point.id).sort();
    expect(missing).toEqual([]);
    expect(coverage.covered).toBe(46);
    expect(coverage.percent).toBe(100);
    expect(coverage.late).toBe(0);
  });

  // The B1 counterpart of the A2 ratchet, pointing the other way. A2's number was lowered
  // ten times, once per unit; B1's `covered` gets *raised* the same way. What is pinned here
  // is that the instrument exists and is honest about being empty — the failure this whole
  // file guards against is a level calling itself complete with nothing measuring it, and a
  // level with no manifest cannot even notice the question. When the first B1 unit ships,
  // the tags it registers close their points and this assertion comes up with them.
  test('B1 reports exactly what has shipped — units 1–14 cover all thirty-two points', () => {
    const coverage = grammarCoverage('B1');
    expect(coverage.total).toBeGreaterThanOrEqual(30);
    // The ratchet: raised in the same commit that ships a unit, never ahead of content.
    // Unit B1.1 (erfahrungen-erzaehlen, 2026-07-24) closed its three contract points;
    // unit B1.2 (leben-veraendern, 2026-07-24) closed genitiv-vollstaendig,
    // komparativ-attributiv and relativsatz-dativ; unit B1.3 (gesundheit-wohlbefinden,
    // 2026-07-24) closed adjektiv-nullartikel, konjunktiv2-ratschlag, lassen and
    // reflexiv-praeposition; unit B1.4 (arbeit-bewerbung, 2026-07-26) closed
    // n-deklination, adjektiv-nomen and nomen-verb-verbindungen; unit B1.5 (meinung-medien,
    // 2026-07-26) closed verb-praeposition-erweitert, kausalsatz-da and
    // zweiteilige-konnektoren. That last point also *gained* a sibling in the same
    // commit: je … desto was split out as proportionalsatz-je-desto, because the tag
    // B1.5 drills covers the three coordinating pairs only, and a covered point would
    // have hidden the fourth frame from --missing-only for good. So 16 of 32, not 31 —
    // the denominator moves when the manifest is wrong, and it moved the honest way.
    // Unit B1.6 (konsum-umwelt, 2026-07-29) closed passiv-produktion (passiv-bildung),
    // passiv-vergangenheit and proportionalsatz-je-desto (je-desto) — the split point's
    // debt paid by the unit the amendment assigned it to. Unit B1.7 (regeln-verantwortung,
    // 2026-07-29) closed passiv-modal and konsekutivsatz-sodass (sodass-folge). Unit B1.8
    // (reisen-probleme, 2026-07-30) closed konjunktiv2-irreal (konjunktiv2-form,
    // irreale-bedingung — the paradigm B1.3's chunks were waiting for) and
    // praeposition-genitiv. Unit B1.9 (lernen-zukunft, 2026-07-31) closed
    // finalsatz-damit (damit-um-zu), konditionalsatz-falls (falls-wenn) and
    // infinitivsatz-ohne-statt (ohne-statt-zu) — the purpose clause under the subject
    // test, expectancy against A2's wenn, and um … zu's two siblings. Unit B1.10
    // (gesellschaft-zusammenleben, 2026-08-03) closed konzessivsatz-obwohl
    // (obwohl-trotzdem), indefinitpronomen-erweitert and relativ-was-wo — the
    // conjunction beside A2's trotzdem adverb, the quantifiers that decline beside A2's
    // invariant set, and the two relative words that are not der/die/das. Units B1.11–B1.13
    // (digitales-leben, kultur-freizeit, geld-vertraege, 2026-08-04) are genre units and
    // moved this number by design: they own no manifest point, register no tag, and recycle
    // the ones earlier units drilled. Unit B1.14 (informationen-vermitteln, 2026-08-04)
    // closes the last three and the level with them: indirekte-rede (indirekte-rede — the
    // connector a report opens with and the tense it keeps, with Konjunktiv I receptive
    // only), wortstellung-angaben (angaben-reihenfolge AND pronomen-stellung — the point
    // whose two tags must BOTH be drilled before it counts) and partizip-adjektiv
    // (partizip-adjektiv). This assertion has now stopped being a countdown for B1 too, and
    // becomes a ratchet of the A2 kind: 32/32 is where it stays.
    expect(coverage.covered).toBe(32);
    expect(coverage.late).toBe(0);
    expect(coverage.percent).toBe(100);
    const covered = coverage.points.filter((p) => p.status !== 'missing').map((p) => p.point.id).sort();
    expect(covered).toEqual([
      'adjektiv-nomen',
      'adjektiv-nullartikel',
      'finalsatz-damit',
      'genitiv-vollstaendig',
      'indefinitpronomen-erweitert',
      'indirekte-rede',
      'infinitivsatz-ohne-statt',
      'kausalsatz-da',
      'komparativ-attributiv',
      'konditionalsatz-falls',
      'konjunktiv2-irreal',
      'konjunktiv2-ratschlag',
      'konsekutivsatz-sodass',
      'konzessivsatz-obwohl',
      'lassen',
      'n-deklination',
      'nomen-verb-verbindungen',
      'partizip-adjektiv',
      'passiv-modal',
      'passiv-produktion',
      'passiv-vergangenheit',
      'plusquamperfekt',
      'praeposition-genitiv',
      'praeteritum-vollverben',
      'proportionalsatz-je-desto',
      'reflexiv-praeposition',
      'relativ-was-wo',
      'relativsatz-dativ',
      'temporalsatz',
      'verb-praeposition-erweitert',
      'wortstellung-angaben',
      'zweiteilige-konnektoren',
    ]);
    // Nothing is left missing, and the assertion stays rather than being deleted: it is
    // what would notice a point being ADDED to the inventory without the content to pay
    // for it, which is how a level stops being complete without anybody editing a number.
    expect(coverage.points.filter((p) => p.status === 'missing')).toHaveLength(coverage.total - 32);
  });

  test('a shipped structure counts as covered, and every taught point resolves a level', () => {
    const coverage = grammarCoverage('A2');
    const adjective = coverage.points.find((p) => p.point.id === 'adjektiv-unbestimmt')!;
    expect(adjective.status).toBe('covered');
    // Regression: a point whose tags are drilled at different levels must still
    // resolve to the level where the *last* of them is taught, not to undefined.
    for (const result of coverage.points)
      if (result.status !== 'missing') expect(result.taughtAt).toBeDefined();
  });

  // `preview: true` remains exposure rather than teaching evidence even though
  // du/Sie now also has genuine A1 practice elsewhere in the real curriculum.
  test('a preview item is exposure, not teaching evidence', () => {
    const root = fixture([{
      id: 'preview-only', standard_level: 'A1', de: 'x', en: 'x', focus: ['preview-focus'],
    }]);
    mkdirSync(join(root, 'content', 'exercises', 'a1'), { recursive: true });
    writeFileSync(join(root, 'content', 'exercises', 'a1', 'preview.yaml'), JSON.stringify({
      role: 'practice', items: [{ id: 'p', focus: 'preview-focus', preview: true }],
    }));
    try {
      expect(grammarCoverage('A1', root).points[0]?.status).toBe('missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  describe('reference_only points are paid for', () => {
    const ref = (taught_in?: string[]) => [
      { id: 'p', standard_level: 'A2', de: 'x', en: 'x', reference_only: true, taught_in },
    ];

    test('an empty or absent taught_in is missing, not vacuously covered', () => {
      // [].every(...) is true, so the escape hatch used to cover a point with
      // no evidence at all — a self-certifying claim.
      for (const taught of [undefined, []]) {
        const root = fixture(ref(taught));
        try {
          expect(grammarCoverage('A2', root).points[0].status).toBe('missing');
        } finally {
          rmSync(root, { recursive: true, force: true });
        }
      }
    });

    test('a topic that does not exist cannot cover a point', () => {
      const root = fixture(ref(['nirgendwo']));
      try {
        expect(grammarCoverage('A2', root).points[0].status).toBe('missing');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    test('it is late when the topic teaching it sits above the standard level', () => {
      const root = fixture(ref(['spaeter']), { b1: ['spaeter'] });
      try {
        const result = grammarCoverage('A2', root).points[0];
        expect(result.status).toBe('late');
        expect(result.taughtAt).toBe('B1');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    test('it is covered when a topic at or below the standard level teaches it', () => {
      const root = fixture(ref(['frueher']), { a1: ['frueher'] });
      try {
        expect(grammarCoverage('A2', root).points[0].status).toBe('covered');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
