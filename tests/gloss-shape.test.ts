/**
 * Gloss-shape ratchet — the tripwire behind the gloss rule in
 * docs/authoring/item-authoring.md (a gloss is a concise translation, the
 * retrieval cue — never a definition).
 *
 * The table pins today's measured count of `long` entries (EN gloss ≥
 * LONG_GLOSS_WORDS words) per deck. The numbers may only go DOWN: each gloss
 * repair wave lowers its decks' rows in the same commit, exactly the
 * grammar-coverage discipline ("closing a gap means lowering the number in the
 * same commit"). A deck not in the table is held at zero, so a new deck (or a
 * regressed one) cannot ship definitional glosses without an author consciously
 * adding a row here — the focus-tag allowlist pattern.
 *
 * The baseline was measured on 2026-08-26 (`bun scripts/gloss-shape.ts`),
 * the day the learner reported the B1 lexis waves' riddle-style glosses
 * ("das Herz → the organ in the chest that pumps…"). The 31 tail decks carry
 * the bulk (19–46 each); the small counts on A1/A2 decks are mostly legitimate
 * disambiguating parentheticals — a wave may leave a row at a small non-zero
 * value on judgement, but never raise one.
 */
import { describe, expect, test } from 'bun:test';
import { glossShapeReport } from '@da/content/gloss-shape';
import { repoRoot } from '@da/content/repo-root';

const PINNED_LONG: ReadonlyArray<readonly [string, number]> = [
  ['abstrakte-begriffe-b1', 37],
  ['alltag-tagesablauf', 1],
  ['alltag-zeit', 1],
  ['arbeit-ausbildung-a2', 3],
  ['arbeit-beruf', 2],
  ['arbeit-bewerbung', 1],
  ['beziehungen-familie-b1', 13],
  ['bildung-schulsystem-b1', 28],
  ['biografie-erfahrungen', 3],
  ['charakter-verhalten-b1', 1],
  ['computer-internet-b1', 27],
  ['digitales-leben', 5],
  ['eigenschaften-bewertung-b1', 4],
  ['einkaufen-geld-b1', 30],
  ['einkaufen-reklamation', 1],
  ['erste-schritte', 3],
  ['essen-trinken-a2', 2],
  ['freunde-feste', 2],
  ['gefuehle-reflexive-a2', 1],
  ['gefuehle-reflexive-verben-b1', 16],
  ['geld-vertraege', 5],
  ['gesellschaft-migration-b1', 24],
  ['gesellschaft-zusammenleben', 5],
  ['gesundheit-arzttermin', 1],
  ['gesundheit-wohlbefinden', 1],
  ['graduierung-mengenwoerter-b1', 1],
  ['haushalt-geschirr-a2', 1],
  ['informationen-vermitteln', 20],
  ['koerper-pflege-a2', 2],
  ['konnektoren-partikeln-b1', 2],
  ['konsum-umwelt', 2],
  ['kultur-freizeit', 1],
  ['kultur-literatur-presse-b1', 21],
  ['leben-veraendern', 2],
  ['lernen-verstehen', 1],
  ['medien-digital-b1', 25],
  ['meinung-medien', 2],
  ['menschen-beziehungen-a2', 1],
  ['nebensaetze-plaene', 1],
  ['ort-richtung-verweis-b1', 2],
  ['politik-staat-b1', 36],
  ['recht-kriminalitaet-b1', 38],
  ['redemittel-chunks-a2', 6],
  ['regeln-verantwortung', 3],
  ['reisen-laender-b1', 21],
  ['reisen-orte-a2', 2],
  ['reisen-verkehr', 3],
  ['schule-arbeit', 1],
  ['schule-faecher-a2', 4],
  ['sport-freizeit-a2', 1],
  ['sprechen-lernen-b1', 22],
  ['text-schreiben-b1', 21],
  ['trennbare-a1-verben', 1],
  ['trennbare-verben', 2],
  ['varianten-at-ch-essen-alltag-b1', 44],
  ['varianten-at-ch-institutionen-b1', 43],
  ['verben-grundwortschatz', 2],
  ['verben-handlungen-a2-1', 1],
  ['verben-handlungen-a2-2', 2],
  ['verben-handlungen-b1-1', 5],
  ['verben-handlungen-b1-2', 11],
  ['verben-handlungen-b1-3', 7],
  ['verben-kommunikation-ausdruck-b1', 3],
  ['verwaltung-behoerden-b1', 30],
  ['wirtschaft-handel-b1', 19],
  ['wissenschaft-technik-b1', 20],
  ['zahlen-masse-a2', 1],
  ['zahlen-mengen-masse-b1', 4],
  ['zeit-b1', 1],
];

describe('gloss-shape ratchet', () => {
  const report = glossShapeReport(repoRoot());
  const pinned = new Map(PINNED_LONG);

  test('no deck exceeds its pinned long-gloss count (unlisted decks are held at zero)', () => {
    const regressions = report
      .filter((d) => d.long > (pinned.get(d.id) ?? 0))
      .map((d) => `${d.id}: ${d.long} > ${pinned.get(d.id) ?? 0}`);
    expect(regressions).toEqual([]);
  });

  test('every pinned row still names a real deck (a repaired-to-zero or renamed deck leaves the table)', () => {
    const ids = new Set(report.map((d) => d.id));
    const stale = PINNED_LONG.filter(([id]) => !ids.has(id)).map(([id]) => id);
    expect(stale).toEqual([]);
  });
});
