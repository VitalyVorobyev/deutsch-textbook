/**
 * Exam simulator contract — the one shape `scripts/exam-ingest.ts` writes and the
 * `/pruefung/goethe-a1` island reads.
 *
 * The manifest instance is NOT in the repo. Official Goethe exam sets are copyrighted, so the
 * materials, the sliced audio, the rendered task pages and the generated manifest all live in
 * gitignored paths (`docs/GeotheInstitute/`, `public/exams/`) and exist only on a machine that
 * holds the sources (ADR 0009). A build made without them serves no `/exams/manifest.json`,
 * and the island renders the absence state instead. Committed here: the schema, the scoring
 * arithmetic, and the local result history — all testable without any copyrighted byte.
 */

/**
 * a/b/c single choice, a/b two-way matching (SD1 Lesen Teil 2), Richtig/Falsch, Ja/Nein
 * (B1 Lesen Teil 4), or `letters`: matching against a printed list — a–f, a–i, a–j — where the
 * list may include a "no solution" mark (`x` in A2 Lesen Teil 4, `0` in B1 Lesen Teil 3).
 */
export type ExamOptionShape = 'abc' | 'ab' | 'rf' | 'jn' | 'letters';

/** One mark on the answer sheet: a letter, r/f, j/n, or a no-solution mark (`x`, `0`). */
export type ExamAnswer = string;

export interface ExamChoiceItemSpec {
  /** Item number as printed on the Kandidatenblätter — stable identity within set+module. */
  nr: number;
  shape: ExamOptionShape;
  key: ExamAnswer;
  /** `letters` only: the marks the Antwortbogen offers for this item, in printed order. */
  options?: string[];
}

/** A typed blank (Schreiben Teil 1) — graded by normalized comparison against the answer(s). */
export interface ExamTextItemSpec {
  nr: number;
  shape: 'text';
  /** The official answer as the Lösungen print it — what the result table shows. */
  answer: string;
  /**
   * Accepted renderings besides `answer` (all compared via `normalizeExamText`). The Lösungen
   * mark several blanks "o. Ä." — a literal comparison can only approximate that, which is why
   * every surface showing a text blank's verdict also shows the official answer beside it.
   */
  accept?: string[];
}

export type ExamItemSpec = ExamChoiceItemSpec | ExamTextItemSpec;

export interface ExamFreeCriterion {
  label: string;
  /** The point steps this criterion can award, as printed (e.g. 3 / 1.5 / 0). */
  points: number[];
}

/** A free-production part (Schreiben Teil 2): no key exists — the printed criteria grade it. */
export interface ExamFreeSpec {
  /** What the part asks for, as the Kandidatenblätter put it ("Kurze Mitteilung, ca. 30 Wörter"). */
  label: string;
  /** Official maximum of this part — reachable only through the criteria, never automatically. */
  points: number;
  /** The printed grading criteria, for the result screen's self-assessment. */
  criteria?: ExamFreeCriterion[];
}

export interface ExamTeilSpec {
  teil: number;
  /** How often the recording presents each text in this Teil, per its instruction line. */
  plays?: 'once' | 'twice';
  items: ExamItemSpec[];
  free?: ExamFreeSpec;
}

export type ExamModuleId = 'hoeren' | 'lesen' | 'schreiben' | 'sprechen';

/**
 * A named jump point in the module's recording — "Teil 2", "Nr. 7" — in seconds from its
 * start. Üben only: the whole argument for Prüfungsmodus is that the recording runs the way
 * the real Tonträger does, and a per-Nummer jump list is exactly the listening budget the exam
 * withholds. Authored by hand in `exam-sources.yaml`, from an ear-checked silence scan
 * (`scripts/exam-cues-scan.ts`), never derived at runtime.
 */
export interface ExamCue {
  label: string;
  /** Seconds from the start of the recording. */
  at: number;
}

export interface ExamModuleSpec {
  module: ExamModuleId;
  /** Official time limit from the Kandidatenblätter instruction page. */
  timeLimitMin: number;
  /** Root-absolute URLs of the rendered task pages, in reading order (apply `withBase`). */
  pages: string[];
  /** Root-absolute URL of the full-module recording, when the module has one. */
  audio?: string;
  /** Jump points into `audio`, in order — rendered in Üben and nowhere else. */
  cues?: ExamCue[];
  /**
   * Rendered Prüferblätter pages that answer or grade the module — Transkriptionen for Hören,
   * Bewertungskriterien and Leistungsbeispiele for Schreiben, Hinweise for Sprechen. Shown
   * only after a run (or in a practice view), never beside a live answer sheet.
   */
  answerPages?: string[];
  /**
   * Maximum as the source's Antwortbogen states it. In the Start Deutsch 1 booklets on hand
   * that is the raw count — 15 per written module, "Ergebnis (Hören+Lesen+Schreiben) …/45" —
   * with no rescaling printed anywhere in them (read at extraction). Carried in
   * data, never hardcoded, so the number on screen is always the number the source states.
   */
  maxScaled: number;
  /**
   * The source's own conversion from raw points to the module score, when it prints one
   * (B1: "Umrechnungstabelle Hören und Lesen"): `scoreTable[raw]` is the score for `raw`
   * correct items, so it has one entry per possible raw score. Without it the raw score is
   * scaled linearly and exactly (A2: "mit 1,25 multipliziert"), never rounded to a grid the
   * source does not print.
   */
  scoreTable?: number[];
  /**
   * The module's pass mark in module points, only where the source prints one (B1: 60 per
   * module). Absent, the result shows no verdict: the UI never invents a pass percentage.
   */
  passMark?: number;
  teile: ExamTeilSpec[];
}

export interface ExamSetSpec {
  /** e.g. `sd1-modellsatz` — stable identity; result history hangs off it. */
  id: string;
  title: string;
  level: string;
  modules: ExamModuleSpec[];
}

export interface ExamManifest {
  version: 1;
  generatedAt?: string;
  sets: ExamSetSpec[];
}

/** Where a shipping-with-assets build serves the manifest, before `withBase`. */
export const EXAM_MANIFEST_URL = '/exams/manifest.json';

export const isExamAnswer = (value: unknown): value is ExamAnswer =>
  typeof value === 'string' && /^[a-z0-9]$/.test(value);
const isAnswer = isExamAnswer;

export const isExamOptionShape = (value: unknown): value is ExamOptionShape =>
  value === 'abc' || value === 'ab' || value === 'rf' || value === 'jn' || value === 'letters';

/** A `letters` list: 2–12 distinct single marks. */
export const validLetterOptions = (options: unknown): options is string[] =>
  Array.isArray(options) &&
  options.length >= 2 &&
  options.length <= 12 &&
  options.every(isExamAnswer) &&
  new Set(options).size === options.length;

/** The marks an item's sheet offers — the one list the runner, the result and the key share. */
export const shapeOptions = (
  shape: ExamOptionShape,
  options?: readonly string[],
): readonly string[] => {
  if (shape === 'abc') return ['a', 'b', 'c'];
  if (shape === 'ab') return ['a', 'b'];
  if (shape === 'rf') return ['r', 'f'];
  if (shape === 'jn') return ['j', 'n'];
  return options ?? [];
};

/** Exported for `scripts/exam-ingest.ts` — one source of truth, so the two cannot drift. */
export const shapeAllows = (
  shape: ExamOptionShape,
  answer: ExamAnswer,
  options?: readonly string[],
): boolean => shapeOptions(shape, options).includes(answer);

/**
 * A printed conversion table fits its module: one entry per raw score from 0 to the item
 * count, never falling, ending at the share of the maximum the items can reach.
 */
export const scoreTableFits = (
  table: unknown,
  items: number,
  scaledMax: number,
): table is number[] =>
  Array.isArray(table) &&
  table.length === items + 1 &&
  table.every(
    (v, i) => typeof v === 'number' && v >= 0 && (i === 0 || v >= (table[i - 1] as number)),
  ) &&
  table[0] === 0 &&
  table[items] === scaledMax;

export const isTextItem = (item: ExamItemSpec): item is ExamTextItemSpec => item.shape === 'text';

/**
 * How a typed blank is compared: case-insensitive, whitespace collapsed, spacing around
 * hyphens dropped ("9-12 Uhr" = "9 - 12 Uhr"), trailing punctuation dropped. Nothing smarter
 * on purpose — the official answer is shown beside every mismatch, so a near-miss is the
 * learner's call to make, not a fuzzy matcher's.
 */
export const normalizeExamText = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/[\s.,;:!?]+$/, '')
    .trim()
    .toLowerCase();

/** The one rule for "is this given answer correct", across letter keys and typed blanks. */
export function itemCorrect(item: ExamItemSpec, given: string | null | undefined): boolean {
  if (given == null) return false;
  if (isTextItem(item)) {
    const normalized = normalizeExamText(given);
    if (!normalized) return false;
    return [item.answer, ...(item.accept ?? [])].some(
      (accepted) => normalizeExamText(accepted) === normalized,
    );
  }
  return given === item.key;
}

/**
 * Structural check for a fetched manifest. Deliberately a hand validator, not Zod: this runs in
 * the island on every visit to a page that usually 404s, and the schema is five small shapes.
 */
export function parseExamManifest(value: unknown): ExamManifest | null {
  if (typeof value !== 'object' || value === null) return null;
  const manifest = value as Record<string, unknown>;
  if (manifest.version !== 1 || !Array.isArray(manifest.sets)) return null;
  for (const set of manifest.sets as unknown[]) {
    if (typeof set !== 'object' || set === null) return null;
    const s = set as Record<string, unknown>;
    if (
      typeof s.id !== 'string' ||
      !s.id ||
      typeof s.title !== 'string' ||
      typeof s.level !== 'string'
    )
      return null;
    if (!Array.isArray(s.modules)) return null;
    for (const module of s.modules as unknown[]) {
      if (typeof module !== 'object' || module === null) return null;
      const m = module as Record<string, unknown>;
      if (
        m.module !== 'hoeren' &&
        m.module !== 'lesen' &&
        m.module !== 'schreiben' &&
        m.module !== 'sprechen'
      )
        return null;
      if (typeof m.timeLimitMin !== 'number' || m.timeLimitMin <= 0) return null;
      if (typeof m.maxScaled !== 'number' || m.maxScaled <= 0) return null;
      if (!Array.isArray(m.pages) || m.pages.some((p) => typeof p !== 'string')) return null;
      if (m.audio !== undefined && typeof m.audio !== 'string') return null;
      if (
        m.answerPages !== undefined &&
        (!Array.isArray(m.answerPages) || m.answerPages.some((p) => typeof p !== 'string'))
      ) {
        return null;
      }
      // Cues are structurally checked here and ordered by the ingest validator: a jump list
      // out of order is a config defect worth naming at authoring time, never a reason for a
      // whole set to fall back to the absence state on the learner's screen.
      if (m.cues !== undefined) {
        if (!Array.isArray(m.cues)) return null;
        for (const cue of m.cues as unknown[]) {
          if (typeof cue !== 'object' || cue === null) return null;
          const c = cue as Record<string, unknown>;
          if (typeof c.label !== 'string' || !c.label) return null;
          if (typeof c.at !== 'number' || !Number.isFinite(c.at) || c.at < 0) return null;
        }
      }
      if (!Array.isArray(m.teile)) return null;
      const seen = new Set<number>();
      for (const teil of m.teile as unknown[]) {
        if (typeof teil !== 'object' || teil === null) return null;
        const t = teil as Record<string, unknown>;
        if (typeof t.teil !== 'number' || !Array.isArray(t.items)) return null;
        if (t.plays !== undefined && t.plays !== 'once' && t.plays !== 'twice') return null;
        if (t.free !== undefined) {
          if (typeof t.free !== 'object' || t.free === null) return null;
          const f = t.free as Record<string, unknown>;
          if (typeof f.label !== 'string' || !f.label) return null;
          if (typeof f.points !== 'number' || f.points <= 0) return null;
          if (f.criteria !== undefined) {
            if (!Array.isArray(f.criteria)) return null;
            for (const criterion of f.criteria as unknown[]) {
              if (typeof criterion !== 'object' || criterion === null) return null;
              const c = criterion as Record<string, unknown>;
              if (typeof c.label !== 'string' || !c.label) return null;
              if (
                !Array.isArray(c.points) ||
                c.points.length === 0 ||
                c.points.some((p) => typeof p !== 'number' || p < 0)
              ) {
                return null;
              }
            }
          }
        }
        // A Teil must ask for something: scored items, a free part, or both.
        if (t.items.length === 0 && t.free === undefined) return null;
        for (const item of t.items as unknown[]) {
          if (typeof item !== 'object' || item === null) return null;
          const i = item as Record<string, unknown>;
          if (typeof i.nr !== 'number' || seen.has(i.nr)) return null;
          if (i.shape === 'text') {
            if (typeof i.answer !== 'string' || !i.answer) return null;
            if (
              i.accept !== undefined &&
              (!Array.isArray(i.accept) || i.accept.some((a) => typeof a !== 'string' || !a))
            ) {
              return null;
            }
          } else {
            if (!isExamOptionShape(i.shape)) return null;
            if (i.shape === 'letters' && !validLetterOptions(i.options)) return null;
            if (i.shape !== 'letters' && i.options !== undefined) return null;
            const options = i.options as string[] | undefined;
            if (!isAnswer(i.key) || !shapeAllows(i.shape, i.key, options)) return null;
          }
          seen.add(i.nr);
        }
      }
      const freeMax = (m.teile as ExamTeilSpec[]).reduce(
        (sum, t) => sum + (t.free?.points ?? 0),
        0,
      );
      if (
        m.scoreTable !== undefined &&
        !scoreTableFits(m.scoreTable, seen.size, m.maxScaled - freeMax)
      )
        return null;
      if (
        m.passMark !== undefined &&
        (typeof m.passMark !== 'number' || m.passMark <= 0 || m.passMark > m.maxScaled)
      )
        return null;
    }
  }
  return value as ExamManifest;
}

export const moduleItems = (module: ExamModuleSpec): ExamItemSpec[] =>
  module.teile.flatMap((teil) => teil.items);

/** The official maximum of the module's free parts — the share no automatic score can reach. */
export const moduleFreeMax = (module: ExamModuleSpec): number =>
  module.teile.reduce((sum, teil) => sum + (teil.free?.points ?? 0), 0);

export interface ExamModuleScore {
  raw: number;
  rawMax: number;
  /** Raw converted to the auto-gradable share of the maximum: the printed table, else exact. */
  scaled: number;
  scaledMax: number;
}

/**
 * One point per auto-gradable item, converted to the item share of the module maximum: through
 * the source's printed table when the module carries one, otherwise linearly and exactly (to
 * the hundredth, so A2's ×1,25 shows 16.25, not a rounded 16.5). A free part (Schreiben)
 * stays deliberately outside this number: its points exist only as a criteria-based
 * self-assessment, recorded separately (`selfScore`) and never silently summed into it.
 */
export function scoreModule(
  module: ExamModuleSpec,
  answers: Record<number, string | undefined>,
): ExamModuleScore {
  const items = moduleItems(module);
  const scaledMax = module.maxScaled - moduleFreeMax(module);
  const raw = items.filter((item) => itemCorrect(item, answers[item.nr])).length;
  const scaled =
    items.length === 0
      ? 0
      : (module.scoreTable?.[raw] ?? Math.round(((raw * scaledMax) / items.length) * 100) / 100);
  return { raw, rawMax: items.length, scaled, scaledMax };
}

// ---------------------------------------------------------------------------
// Result history — calibration data, deliberately outside the learner snapshot.
//
// ADR 0009: exam runs never feed mastery, tiers or weakness, and never sync. Plain
// localStorage under its own key, not the profile store, so no snapshot migration can ever
// be forced by this feature and no instrument can accidentally read it as evidence.
// ---------------------------------------------------------------------------

export interface ExamRunRecord {
  setId: string;
  module: ExamModuleId;
  mode: 'pruefung' | 'ueben';
  startedAt: string;
  finishedAt: string;
  raw: number;
  rawMax: number;
  scaled: number;
  scaledMax: number;
  answers: Record<number, string | null>;
  /** The learner's text for each free Teil (by Teil number), so a later look can re-compare. */
  texts?: Record<number, string>;
  /**
   * Criteria-based self-assessment of the free part, entered on the result screen. Kept apart
   * from `raw`: the automatic score and a self-report are different kinds of evidence, and
   * every surface that shows their sum says the sum contains a self-assessment.
   */
  selfScore?: number;
  selfScoreMax?: number;
}

export const EXAM_HISTORY_KEY = 'da:exam-history:v1';
const HISTORY_LIMIT = 200;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const defaultStorage = (): StorageLike | null =>
  typeof localStorage === 'undefined' ? null : localStorage;

export function loadExamHistory(storage: StorageLike | null = defaultStorage()): ExamRunRecord[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(EXAM_HISTORY_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as ExamRunRecord[]) : [];
  } catch {
    return [];
  }
}

export function recordExamRun(
  run: ExamRunRecord,
  storage: StorageLike | null = defaultStorage(),
): ExamRunRecord[] {
  const history = [...loadExamHistory(storage), run].slice(-HISTORY_LIMIT);
  storage?.setItem(EXAM_HISTORY_KEY, JSON.stringify(history));
  return history;
}

/** Attach a later patch (the self-assessment) to an already-recorded run, found by identity. */
export function updateExamRun(
  run: ExamRunRecord,
  patch: Partial<Pick<ExamRunRecord, 'selfScore' | 'selfScoreMax'>>,
  storage: StorageLike | null = defaultStorage(),
): ExamRunRecord[] {
  const history = loadExamHistory(storage).map((entry) =>
    entry.setId === run.setId &&
    entry.module === run.module &&
    entry.startedAt === run.startedAt &&
    entry.finishedAt === run.finishedAt
      ? { ...entry, ...patch }
      : entry,
  );
  storage?.setItem(EXAM_HISTORY_KEY, JSON.stringify(history));
  return history;
}

/** Earlier finished runs of this set+module — the repeat warning reads this. */
export const priorRuns = (
  history: ExamRunRecord[],
  setId: string,
  module: ExamModuleId,
): ExamRunRecord[] => history.filter((run) => run.setId === setId && run.module === module);
