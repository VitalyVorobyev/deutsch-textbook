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

/** a/b/c single choice, a/b two-way matching (Lesen Teil 2), or Richtig/Falsch. */
export type ExamOptionShape = 'abc' | 'ab' | 'rf';

export type ExamAnswer = 'a' | 'b' | 'c' | 'r' | 'f';

export interface ExamItemSpec {
  /** Item number as printed on the Kandidatenblätter — stable identity within set+module. */
  nr: number;
  shape: ExamOptionShape;
  key: ExamAnswer;
}

export interface ExamTeilSpec {
  teil: number;
  /** How often the recording presents each text in this Teil, per its instruction line. */
  plays?: 'once' | 'twice';
  items: ExamItemSpec[];
}

export type ExamModuleId = 'hoeren' | 'lesen' | 'schreiben' | 'sprechen';

export interface ExamModuleSpec {
  module: ExamModuleId;
  /** Official time limit from the Kandidatenblätter instruction page. */
  timeLimitMin: number;
  /** Root-absolute URLs of the rendered task pages, in reading order (apply `withBase`). */
  pages: string[];
  /** Root-absolute URL of the full-module recording, when the module has one. */
  audio?: string;
  /**
   * Maximum as the source's Antwortbogen states it. In the Start Deutsch 1 booklets on hand
   * that is the raw count — 15 per written module, "Ergebnis (Hören+Lesen+Schreiben) …/45" —
   * with no rescaling printed anywhere in them (extraction read of 2026-08-11). Carried in
   * data, never hardcoded, so the number on screen is always the number the source states.
   */
  maxScaled: number;
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
  value === 'a' || value === 'b' || value === 'c' || value === 'r' || value === 'f';
const isAnswer = isExamAnswer;

/** Exported for `scripts/exam-ingest.ts` — one source of truth, so the two cannot drift. */
export const shapeAllows = (shape: ExamOptionShape, answer: ExamAnswer): boolean => {
  if (shape === 'abc') return answer === 'a' || answer === 'b' || answer === 'c';
  if (shape === 'ab') return answer === 'a' || answer === 'b';
  return answer === 'r' || answer === 'f';
};

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
    if (typeof s.id !== 'string' || !s.id || typeof s.title !== 'string' || typeof s.level !== 'string') return null;
    if (!Array.isArray(s.modules)) return null;
    for (const module of s.modules as unknown[]) {
      if (typeof module !== 'object' || module === null) return null;
      const m = module as Record<string, unknown>;
      if (m.module !== 'hoeren' && m.module !== 'lesen' && m.module !== 'schreiben' && m.module !== 'sprechen') return null;
      if (typeof m.timeLimitMin !== 'number' || m.timeLimitMin <= 0) return null;
      if (typeof m.maxScaled !== 'number' || m.maxScaled <= 0) return null;
      if (!Array.isArray(m.pages) || m.pages.some((p) => typeof p !== 'string')) return null;
      if (m.audio !== undefined && typeof m.audio !== 'string') return null;
      if (!Array.isArray(m.teile)) return null;
      const seen = new Set<number>();
      for (const teil of m.teile as unknown[]) {
        if (typeof teil !== 'object' || teil === null) return null;
        const t = teil as Record<string, unknown>;
        if (typeof t.teil !== 'number' || !Array.isArray(t.items) || t.items.length === 0) return null;
        if (t.plays !== undefined && t.plays !== 'once' && t.plays !== 'twice') return null;
        for (const item of t.items as unknown[]) {
          if (typeof item !== 'object' || item === null) return null;
          const i = item as Record<string, unknown>;
          if (typeof i.nr !== 'number' || seen.has(i.nr)) return null;
          if (i.shape !== 'abc' && i.shape !== 'ab' && i.shape !== 'rf') return null;
          if (!isAnswer(i.key) || !shapeAllows(i.shape, i.key)) return null;
          seen.add(i.nr);
        }
      }
    }
  }
  return value as ExamManifest;
}

export const moduleItems = (module: ExamModuleSpec): ExamItemSpec[] =>
  module.teile.flatMap((teil) => teil.items);

export interface ExamModuleScore {
  raw: number;
  rawMax: number;
  /** Raw scaled to the module's official maximum, to the half point the Prüferblätter use. */
  scaled: number;
  scaledMax: number;
}

/**
 * One point per item, scaled to the module maximum and rounded to the nearest half point —
 * Start Deutsch 1 grades in half points (raw 15 × 5/3 → 25).
 */
export function scoreModule(module: ExamModuleSpec, answers: Record<number, ExamAnswer | undefined>): ExamModuleScore {
  const items = moduleItems(module);
  const raw = items.filter((item) => answers[item.nr] === item.key).length;
  const scaled = Math.round(((raw * module.maxScaled) / items.length) * 2) / 2;
  return { raw, rawMax: items.length, scaled, scaledMax: module.maxScaled };
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
  answers: Record<number, ExamAnswer | null>;
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

export function recordExamRun(run: ExamRunRecord, storage: StorageLike | null = defaultStorage()): ExamRunRecord[] {
  const history = [...loadExamHistory(storage), run].slice(-HISTORY_LIMIT);
  storage?.setItem(EXAM_HISTORY_KEY, JSON.stringify(history));
  return history;
}

/** Earlier finished runs of this set+module — the repeat warning reads this. */
export const priorRuns = (history: ExamRunRecord[], setId: string, module: ExamModuleId): ExamRunRecord[] =>
  history.filter((run) => run.setId === setId && run.module === module);
