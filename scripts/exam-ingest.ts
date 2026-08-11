/**
 * Ingest official Goethe exam PDFs (ADR 0009) into the local exam-trainer manifest.
 *
 * Reads docs/GeotheInstitute/exam-sources.yaml (override: --sources <path>) — a config that
 * exists only on a machine holding the official materials and is never committed. For every
 * set/module it lists, renders the named Kandidatenblätter pages to PNG (`pdftoppm`) and, when
 * a recording is named, extracts its audio without re-encoding (`ffmpeg -acodec copy`). Writes
 * public/exams/<setId>/pages/<module>-p<NN>.png, public/exams/<setId>/<module>.m4a, and
 * public/exams/manifest.json — the one shape src/lib/exam-sim.ts's `parseExamManifest` reads.
 * Both docs/GeotheInstitute/ and public/exams/ are gitignored; nothing this script produces
 * ever enters the repo. Operational picture: docs/architecture/exam-trainer.md.
 *
 * Idempotent: a page/audio file already newer than its source PDF/video is left alone
 * (`--force` redoes everything). Safe to re-run after editing exam-sources.yaml — only what
 * changed, or what `--force` names, gets redone.
 *
 * Usage:
 *   bun scripts/exam-ingest.ts                    ingest using the default config path
 *   bun scripts/exam-ingest.ts --check             validate + report, write nothing
 *   bun scripts/exam-ingest.ts --force              re-render/re-extract everything
 *   bun scripts/exam-ingest.ts --sources <path>     use a different config file
 *   bun scripts/exam-ingest.ts --help               usage
 *
 * exam-sources.yaml shape (version 1):
 *
 *   version: 1
 *   sets:
 *     - id: sd1-modellsatz                  # stable identity — becomes public/exams/<id>/
 *       title: "Start Deutsch 1 — Modellsatz"
 *       level: a1
 *       pdf: sd_1_modellsatz.pdf            # relative to this file's own directory
 *       modules:
 *         - module: hoeren                  # hoeren | lesen | schreiben | sprechen
 *           timeLimitMin: 20                # from the Kandidatenblätter instruction page
 *           audio: pruefungstraining_2_hoeren_a1_erwachsene.mp4   # optional, relative path
 *           pdfPages: [8, 9, 10, 11, 12, 13, 14]   # 1-based PDF page indices to render
 *           answerPdfPages: [33, 34]        # optional Prüferblätter pages (Transkriptionen,
 *                                           # Bewertung, Leistungsbeispiele) — shown after a run
 *           maxScaled: 25                   # module maximum as the source's Antwortbogen states it
 *           teile:
 *             - teil: 1
 *               plays: twice                # once | twice, per the instruction line
 *               items:
 *                 - { nr: 1, shape: abc, key: b }   # shape: abc | ab | rf; key: a/b/c, a/b, or r/f
 *                 - { nr: 2, shape: abc, key: a }
 *
 *   Schreiben Teil 1 blanks are text items, compared against `answer` + `accept` variants:
 *                 - { nr: 1, shape: text, answer: "Lyon", accept: ["Lyon, Frankreich"] }
 *   Schreiben Teil 2 is a free part — no key exists, the printed criteria grade it:
 *             - teil: 2
 *               free:
 *                 label: "Kurze Mitteilung schreiben, ca. 30 Wörter"
 *                 points: 10
 *                 criteria:                 # the printed steps, for the self-assessment panel
 *                   - { label: "Inhaltspunkt 1", points: [3, 1.5, 0] }
 *   A practice-only module (Sprechen — Gruppenprüfung, nothing auto-gradable) has `teile: []`:
 *   its pages become study cards, and no answer sheet or history exists for it.
 *
 * Failure modes are first-class: a missing config, a missing pdftoppm/ffmpeg, a missing
 * referenced pdf/audio file, or a manifest that fails `parseExamManifest` each print one
 * specific, actionable message and exit 1 — none of them throws a stack trace at the author.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import YAML from 'yaml';
import {
  isExamAnswer,
  parseExamManifest,
  shapeAllows,
  type ExamFreeSpec,
  type ExamItemSpec,
  type ExamManifest,
  type ExamModuleId,
  type ExamModuleSpec,
  type ExamSetSpec,
  type ExamTeilSpec,
} from '../src/lib/exam-sim';

const ROOT = join(import.meta.dirname, '..');
const DEFAULT_SOURCES = join(ROOT, 'docs', 'GeotheInstitute', 'exam-sources.yaml');
const OUT_DIR = join(ROOT, 'public', 'exams');
const README_POINTER = 'docs/architecture/exam-trainer.md';

// pdftoppm/ffmpeg are looked up on PATH first; these are the fallback locations named in the
// spec (a Homebrew install on Apple Silicon), so a shell with a trimmed PATH still works.
const PDFTOPPM_FALLBACK = '/opt/homebrew/bin/pdftoppm';
const FFMPEG_FALLBACK = '/opt/homebrew/bin/ffmpeg';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface Options {
  sourcesPath: string;
  check: boolean;
  force: boolean;
  help: boolean;
}

export function parseArgs(argv: string[]): Options {
  const options: Options = { sourcesPath: DEFAULT_SOURCES, check: false, force: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--sources') {
      const value = argv[++i];
      if (!value) throw new Error('--sources needs a path.');
      options.sourcesPath = resolve(value);
    } else if (arg === '--check') options.check = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function printHelp(): void {
  console.log(`Ingest official Goethe exam PDFs into the local exam-trainer manifest (ADR 0009).

Usage:
  bun scripts/exam-ingest.ts [--sources <path>] [--check] [--force] [--help]

  --sources <path>  Source config to read (default: docs/GeotheInstitute/exam-sources.yaml)
  --check           Validate the config and report what would be generated. Writes nothing
                     and never requires pdftoppm/ffmpeg to be installed.
  --force           Re-render pages / re-extract audio even when the output on disk is
                     already newer than its source.
  --help            Show this message.

Reads docs/GeotheInstitute/<...>, writes public/exams/<setId>/... and
public/exams/manifest.json. Both directories are gitignored — see ${README_POINTER}.`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Source config — validated shape
// ---------------------------------------------------------------------------

interface SourceModule {
  module: ExamModuleId;
  timeLimitMin: number;
  audio?: string;
  pdfPages: number[];
  /** Prüferblätter pages, rendered like task pages but surfaced only after a run. */
  answerPdfPages?: number[];
  maxScaled: number;
  teile: ExamTeilSpec[];
}

interface SourceSet {
  id: string;
  title: string;
  level: string;
  pdf: string;
  modules: SourceModule[];
}

interface SourceConfig {
  version: 1;
  sets: SourceSet[];
}

const MODULE_IDS: ExamModuleId[] = ['hoeren', 'lesen', 'schreiben', 'sprechen'];

const isPositiveInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0;
const isPositiveNumber = (v: unknown): v is number => typeof v === 'number' && v > 0;
const isAnswer = isExamAnswer;

interface ValidationResult {
  config: SourceConfig | null;
  errors: string[];
  warnings: string[];
}

/**
 * Hand validator, deliberately not Zod — this mirrors `parseExamManifest`
 * (src/lib/exam-sim.ts), which is the manifest's real contract; this function only needs to
 * add the ingest-only fields (`pdf`, `pdfPages`, `audio` as a source path) around the same
 * teile/items shape and report exactly where a config breaks that shape.
 */
export function validateConfig(raw: unknown, label: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    errors.push(`${label}: does not parse as a YAML mapping`);
    return { config: null, errors, warnings };
  }
  const top = raw as Record<string, unknown>;
  if (top.version !== 1) errors.push(`${label}: "version" must be 1, got ${JSON.stringify(top.version)}`);
  if (!Array.isArray(top.sets) || top.sets.length === 0) {
    errors.push(`${label}: "sets" must be a non-empty array`);
    return { config: null, errors, warnings };
  }

  const sets: SourceSet[] = [];
  const seenSetIds = new Set<string>();

  top.sets.forEach((rawSet: unknown, si: number) => {
    const where = `${label}: sets[${si}]`;
    if (typeof rawSet !== 'object' || rawSet === null) {
      errors.push(`${where} is not a mapping`);
      return;
    }
    const s = rawSet as Record<string, unknown>;
    if (typeof s.id !== 'string' || !s.id) {
      errors.push(`${where}.id must be a non-empty string`);
      return;
    }
    if (seenSetIds.has(s.id)) {
      errors.push(`${label}: duplicate set id "${s.id}"`);
      return;
    }
    seenSetIds.add(s.id);
    const setWhere = `set "${s.id}"`;

    if (typeof s.title !== 'string' || !s.title) errors.push(`${setWhere}: title must be a non-empty string`);
    if (typeof s.level !== 'string' || !s.level) errors.push(`${setWhere}: level must be a non-empty string`);
    if (typeof s.pdf !== 'string' || !s.pdf) {
      errors.push(`${setWhere}: pdf must be a non-empty string, relative to ${label}`);
      return;
    }
    if (!Array.isArray(s.modules) || s.modules.length === 0) {
      errors.push(`${setWhere}: modules must be a non-empty array`);
      return;
    }

    const modules: SourceModule[] = [];
    const seenModuleIds = new Set<string>();

    s.modules.forEach((rawModule: unknown, mi: number) => {
      const mWhere = `${setWhere}, modules[${mi}]`;
      if (typeof rawModule !== 'object' || rawModule === null) {
        errors.push(`${mWhere} is not a mapping`);
        return;
      }
      const m = rawModule as Record<string, unknown>;
      if (typeof m.module !== 'string' || !MODULE_IDS.includes(m.module as ExamModuleId)) {
        errors.push(`${mWhere}.module must be one of ${MODULE_IDS.join('|')}, got ${JSON.stringify(m.module)}`);
        return;
      }
      const moduleId = m.module as ExamModuleId;
      if (seenModuleIds.has(moduleId)) {
        errors.push(`${setWhere}: duplicate module "${moduleId}"`);
        return;
      }
      seenModuleIds.add(moduleId);
      const mWhere2 = `${setWhere}/${moduleId}`;

      if (!isPositiveNumber(m.timeLimitMin)) errors.push(`${mWhere2}: timeLimitMin must be a positive number`);
      if (!isPositiveNumber(m.maxScaled)) errors.push(`${mWhere2}: maxScaled must be a positive number`);
      if (m.audio !== undefined && (typeof m.audio !== 'string' || !m.audio)) {
        errors.push(`${mWhere2}: audio must be a non-empty string when present`);
      }
      if (
        !Array.isArray(m.pdfPages) ||
        m.pdfPages.length === 0 ||
        m.pdfPages.some((p) => !isPositiveInt(p))
      ) {
        errors.push(`${mWhere2}: pdfPages must be a non-empty array of positive 1-based page numbers`);
        return;
      }
      if (
        m.answerPdfPages !== undefined &&
        (!Array.isArray(m.answerPdfPages) ||
          m.answerPdfPages.length === 0 ||
          m.answerPdfPages.some((p) => !isPositiveInt(p)))
      ) {
        errors.push(
          `${mWhere2}: answerPdfPages must be a non-empty array of positive 1-based page numbers when present`,
        );
        return;
      }
      if (!Array.isArray(m.teile)) {
        errors.push(`${mWhere2}: teile must be an array (empty only for a practice-only module like Sprechen)`);
        return;
      }

      const teile: ExamTeilSpec[] = [];
      const allNrs: number[] = [];
      const seenTeilNrs = new Set<number>();

      m.teile.forEach((rawTeil: unknown, ti: number) => {
        const tWhere = `${mWhere2}, teile[${ti}]`;
        if (typeof rawTeil !== 'object' || rawTeil === null) {
          errors.push(`${tWhere} is not a mapping`);
          return;
        }
        const t = rawTeil as Record<string, unknown>;
        if (!isPositiveInt(t.teil)) {
          errors.push(`${tWhere}.teil must be a positive integer`);
          return;
        }
        if (seenTeilNrs.has(t.teil)) {
          errors.push(`${mWhere2}: duplicate teil ${t.teil}`);
          return;
        }
        seenTeilNrs.add(t.teil);
        if (t.plays !== undefined && t.plays !== 'once' && t.plays !== 'twice') {
          errors.push(`${tWhere}.plays must be "once" or "twice" when present`);
        }
        const rawItems = t.items ?? [];
        if (!Array.isArray(rawItems)) {
          errors.push(`${tWhere}.items must be an array when present`);
          return;
        }

        let free: ExamFreeSpec | undefined;
        if (t.free !== undefined) {
          if (typeof t.free !== 'object' || t.free === null) {
            errors.push(`${tWhere}.free is not a mapping`);
            return;
          }
          const f = t.free as Record<string, unknown>;
          if (typeof f.label !== 'string' || !f.label) {
            errors.push(`${tWhere}.free.label must be a non-empty string`);
            return;
          }
          if (!isPositiveNumber(f.points)) {
            errors.push(`${tWhere}.free.points must be a positive number`);
            return;
          }
          let criteria: ExamFreeSpec['criteria'];
          if (f.criteria !== undefined) {
            if (!Array.isArray(f.criteria) || f.criteria.length === 0) {
              errors.push(`${tWhere}.free.criteria must be a non-empty array when present`);
              return;
            }
            const parsed: { label: string; points: number[] }[] = [];
            let broken = false;
            f.criteria.forEach((rawCriterion: unknown, ci: number) => {
              const cWhere = `${tWhere}.free.criteria[${ci}]`;
              if (typeof rawCriterion !== 'object' || rawCriterion === null) {
                errors.push(`${cWhere} is not a mapping`);
                broken = true;
                return;
              }
              const c = rawCriterion as Record<string, unknown>;
              if (typeof c.label !== 'string' || !c.label) {
                errors.push(`${cWhere}.label must be a non-empty string`);
                broken = true;
                return;
              }
              if (
                !Array.isArray(c.points) ||
                c.points.length === 0 ||
                c.points.some((p) => typeof p !== 'number' || p < 0)
              ) {
                errors.push(`${cWhere}.points must be a non-empty array of numbers ≥ 0`);
                broken = true;
                return;
              }
              parsed.push({ label: c.label, points: c.points as number[] });
            });
            if (broken) return;
            criteria = parsed;
            const criteriaMax = parsed.reduce((sum, c) => sum + Math.max(...c.points), 0);
            if (criteriaMax !== f.points) {
              warnings.push(
                `${tWhere}: criteria maxima sum to ${criteriaMax}, free.points is ${f.points} — check the Bewertung page`,
              );
            }
          }
          free = { label: f.label, points: f.points, ...(criteria ? { criteria } : {}) };
        }
        if (rawItems.length === 0 && !free) {
          errors.push(`${tWhere}: a Teil needs items, a free part, or both`);
          return;
        }

        const items: ExamItemSpec[] = [];
        rawItems.forEach((rawItem: unknown, ii: number) => {
          const iWhere = `${tWhere}, items[${ii}]`;
          if (typeof rawItem !== 'object' || rawItem === null) {
            errors.push(`${iWhere} is not a mapping`);
            return;
          }
          const it = rawItem as Record<string, unknown>;
          if (!isPositiveInt(it.nr)) {
            errors.push(`${iWhere}.nr must be a positive integer`);
            return;
          }
          if (it.shape === 'text') {
            if (typeof it.answer !== 'string' || !it.answer) {
              errors.push(`${iWhere}.answer must be a non-empty string for shape "text"`);
              return;
            }
            if (
              it.accept !== undefined &&
              (!Array.isArray(it.accept) ||
                it.accept.length === 0 ||
                it.accept.some((a) => typeof a !== 'string' || !a))
            ) {
              errors.push(`${iWhere}.accept must be a non-empty array of non-empty strings when present`);
              return;
            }
            items.push({
              nr: it.nr,
              shape: 'text',
              answer: it.answer,
              ...(it.accept !== undefined ? { accept: it.accept as string[] } : {}),
            });
          } else if (it.shape === 'abc' || it.shape === 'ab' || it.shape === 'rf') {
            if (!isAnswer(it.key) || !shapeAllows(it.shape, it.key)) {
              errors.push(`${iWhere}.key ${JSON.stringify(it.key)} is not a valid answer for shape "${it.shape}"`);
              return;
            }
            items.push({ nr: it.nr, shape: it.shape, key: it.key });
          } else {
            errors.push(`${iWhere}.shape must be "abc", "ab", "rf" or "text"`);
            return;
          }
          allNrs.push(it.nr);
        });

        teile.push({
          teil: t.teil,
          plays: t.plays as 'once' | 'twice' | undefined,
          items,
          ...(free ? { free } : {}),
        });
      });

      // Consecutive-ish item numbering across the whole module — a warning, not a failure:
      // Start Deutsch 1's Lesen renumbers per Teil in some sets, which is a legitimate gap.
      if (allNrs.length > 1) {
        const sorted = [...allNrs].sort((a, b) => a - b);
        const gaps: string[] = [];
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i]! - sorted[i - 1]! > 1) gaps.push(`${sorted[i - 1]}→${sorted[i]}`);
        }
        if (gaps.length) {
          warnings.push(`${mWhere2}: item numbering has gap(s) ${gaps.join(', ')} — check against the Kandidatenblätter`);
        }
      }

      modules.push({
        module: moduleId,
        timeLimitMin: m.timeLimitMin as number,
        maxScaled: m.maxScaled as number,
        audio: m.audio as string | undefined,
        pdfPages: m.pdfPages as number[],
        answerPdfPages: m.answerPdfPages as number[] | undefined,
        teile,
      });
    });

    if (modules.length) {
      sets.push({ id: s.id, title: s.title as string, level: s.level as string, pdf: s.pdf, modules });
    }
  });

  if (errors.length) return { config: null, errors, warnings };
  return { config: { version: 1, sets }, errors, warnings };
}

/** Every `pdf`/`audio` the config names, resolved and checked against disk before anything runs. */
export function missingSourceFiles(config: SourceConfig, sourcesDir: string): string[] {
  const problems: string[] = [];
  for (const set of config.sets) {
    const pdfPath = resolve(sourcesDir, set.pdf);
    if (!existsSync(pdfPath)) problems.push(`set "${set.id}": pdf not found at ${pdfPath}`);
    for (const module of set.modules) {
      if (!module.audio) continue;
      const audioPath = resolve(sourcesDir, module.audio);
      if (!existsSync(audioPath)) {
        problems.push(`set "${set.id}"/${module.module}: audio not found at ${audioPath}`);
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Binaries
// ---------------------------------------------------------------------------

/** PATH lookup without executing anything, plus the Homebrew fallback named in the spec. */
function resolveBinary(name: string, fallback: string): string | null {
  const dirs = (process.env.PATH ?? '').split(':').filter(Boolean);
  for (const dir of dirs) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return existsSync(fallback) ? fallback : null;
}

// ---------------------------------------------------------------------------
// Output paths (pure — no I/O)
// ---------------------------------------------------------------------------

const pagePngName = (module: ExamModuleId, page: number) => `${module}-p${String(page).padStart(2, '0')}.png`;
const pagesDirFor = (setId: string) => join(OUT_DIR, setId, 'pages');
const pagePngUrl = (setId: string, module: ExamModuleId, page: number) =>
  `/exams/${setId}/pages/${pagePngName(module, page)}`;
const audioFileFor = (setId: string, module: ExamModuleId) => join(OUT_DIR, setId, `${module}.m4a`);
const audioUrl = (setId: string, module: ExamModuleId) => `/exams/${setId}/${module}.m4a`;

const isFresh = (outPath: string, sourcePath: string): boolean =>
  existsSync(outPath) && statSync(outPath).mtimeMs >= statSync(sourcePath).mtimeMs;

// ---------------------------------------------------------------------------
// Rendering (side-effecting)
// ---------------------------------------------------------------------------

/**
 * `pdftoppm -f N -l N <pdf> <prefix>` names its output `<prefix>-<N>.png`, but the padding
 * width of N depends on the source PDF's total page count, not on the page requested — so the
 * exact filename cannot be predicted from `page` alone. Render to a page-unique temp prefix,
 * find the one file it produced, and rename it to the fixed name the manifest will reference.
 */
function renderPage(
  pdftoppmBin: string,
  pdfPath: string,
  page: number,
  setId: string,
  module: ExamModuleId,
  force: boolean,
): 'rendered' | 'skipped' {
  const dir = pagesDirFor(setId);
  const targetPath = join(dir, pagePngName(module, page));
  if (!force && isFresh(targetPath, pdfPath)) return 'skipped';

  mkdirSync(dir, { recursive: true });
  const tempBase = `.ingest-${module}-p${String(page).padStart(2, '0')}`;
  try {
    execFileSync(
      pdftoppmBin,
      ['-png', '-r', '150', '-f', String(page), '-l', String(page), pdfPath, join(dir, tempBase)],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
  } catch (err) {
    throw new Error(`pdftoppm failed on page ${page} of ${pdfPath}: ${(err as Error).message}`);
  }

  const produced = readdirSync(dir).filter((f) => f.startsWith(`${tempBase}-`) && f.endsWith('.png'));
  if (produced.length !== 1) {
    for (const f of produced) rmSync(join(dir, f));
    throw new Error(
      `pdftoppm produced ${produced.length} file(s) for page ${page} of ${pdfPath} (expected 1)`,
    );
  }
  renameSync(join(dir, produced[0]!), targetPath);
  return 'rendered';
}

function extractAudio(
  ffmpegBin: string,
  videoPath: string,
  setId: string,
  module: ExamModuleId,
  force: boolean,
): 'extracted' | 'skipped' {
  const outPath = audioFileFor(setId, module);
  if (!force && isFresh(outPath, videoPath)) return 'skipped';

  mkdirSync(dirname(outPath), { recursive: true });
  try {
    execFileSync(ffmpegBin, ['-y', '-i', videoPath, '-vn', '-acodec', 'copy', outPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (err) {
    throw new Error(`ffmpeg failed extracting audio from ${videoPath}: ${(err as Error).message}`);
  }
  return 'extracted';
}

interface IngestStats {
  pagesRendered: number;
  pagesSkipped: number;
  audioExtracted: number;
  audioSkipped: number;
}

function ingest(
  config: SourceConfig,
  sourcesDir: string,
  opts: { force: boolean; pdftoppmBin: string; ffmpegBin: string | null },
): IngestStats {
  const stats: IngestStats = { pagesRendered: 0, pagesSkipped: 0, audioExtracted: 0, audioSkipped: 0 };
  for (const set of config.sets) {
    const pdfPath = resolve(sourcesDir, set.pdf);
    for (const module of set.modules) {
      for (const page of [...module.pdfPages, ...(module.answerPdfPages ?? [])]) {
        const result = renderPage(opts.pdftoppmBin, pdfPath, page, set.id, module.module, opts.force);
        if (result === 'rendered') stats.pagesRendered++;
        else stats.pagesSkipped++;
      }
      if (module.audio) {
        if (!opts.ffmpegBin) {
          throw new Error(`ffmpeg is required for set "${set.id}"/${module.module} (audio: ${module.audio})`);
        }
        const videoPath = resolve(sourcesDir, module.audio);
        const result = extractAudio(opts.ffmpegBin, videoPath, set.id, module.module, opts.force);
        if (result === 'extracted') stats.audioExtracted++;
        else stats.audioSkipped++;
      }
    }
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Manifest (pure — no I/O)
// ---------------------------------------------------------------------------

export function buildManifest(config: SourceConfig): ExamManifest {
  const sets: ExamSetSpec[] = config.sets.map((set) => {
    const modules: ExamModuleSpec[] = set.modules.map((module) => ({
      module: module.module,
      timeLimitMin: module.timeLimitMin,
      pages: module.pdfPages.map((page) => pagePngUrl(set.id, module.module, page)),
      answerPages: module.answerPdfPages
        ? module.answerPdfPages.map((page) => pagePngUrl(set.id, module.module, page))
        : undefined,
      audio: module.audio ? audioUrl(set.id, module.module) : undefined,
      maxScaled: module.maxScaled,
      teile: module.teile,
    }));
    return { id: set.id, title: set.title, level: set.level, modules };
  });
  return { version: 1, generatedAt: new Date().toISOString(), sets };
}

/** Every file path the written manifest names, checked against disk. */
export function missingOutputs(manifest: ExamManifest): string[] {
  const problems: string[] = [];
  const onDisk = (url: string) => existsSync(join(ROOT, 'public', url.replace(/^\//, '')));
  for (const set of manifest.sets) {
    for (const module of set.modules) {
      for (const pageUrl of [...module.pages, ...(module.answerPages ?? [])]) {
        if (!onDisk(pageUrl)) problems.push(`${set.id}/${module.module}: missing ${pageUrl}`);
      }
      if (module.audio && !onDisk(module.audio)) {
        problems.push(`${set.id}/${module.module}: missing ${module.audio}`);
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let options: Options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (err) {
  fail(`${(err as Error).message}\n\nRun with --help for usage.`);
}

if (options.help) {
  printHelp();
  process.exit(0);
}

if (!existsSync(options.sourcesPath)) {
  fail(
    `No exam source config at ${options.sourcesPath}.\n\n` +
      `Official Goethe exam materials are local-only (ADR 0009) — the config that tells this\n` +
      `script which local PDFs and audio to slice is never committed, so a clean checkout (and\n` +
      `every CI machine) has none. See ${README_POINTER} for the expected layout of\n` +
      `docs/GeotheInstitute/ and the exam-sources.yaml shape. Nothing to do here without it.`,
  );
}

const sourcesLabel = relative(ROOT, options.sourcesPath) || options.sourcesPath;
let rawConfig: unknown;
try {
  rawConfig = YAML.parse(readFileSync(options.sourcesPath, 'utf8'));
} catch (err) {
  fail(`${sourcesLabel}: not valid YAML — ${(err as Error).message}`);
}

const { config, errors, warnings } = validateConfig(rawConfig, sourcesLabel);
if (warnings.length) {
  console.log(`⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ${w}`);
}
if (errors.length || !config) {
  console.error(`\n✗ ${errors.length} error(s) in ${sourcesLabel}:`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

const sourcesDir = dirname(options.sourcesPath);
const missingFiles = missingSourceFiles(config, sourcesDir);
if (missingFiles.length) {
  console.error(`\n✗ ${missingFiles.length} referenced source file(s) not found:`);
  for (const m of missingFiles) console.error(`  ${m}`);
  process.exit(1);
}

const totalSets = config.sets.length;
const totalModules = config.sets.reduce((n, s) => n + s.modules.length, 0);
const totalPages = config.sets.reduce(
  (n, s) => n + s.modules.reduce((mn, m) => mn + m.pdfPages.length + (m.answerPdfPages?.length ?? 0), 0),
  0,
);
const totalAudio = config.sets.reduce((n, s) => n + s.modules.filter((m) => m.audio).length, 0);

if (options.check) {
  console.log(
    `✓ ${sourcesLabel} is valid: ${totalSets} set(s), ${totalModules} module(s), ` +
      `${totalPages} page render(s), ${totalAudio} audio extraction(s).\n`,
  );
  for (const set of config.sets) {
    console.log(`  ${set.id} — ${set.title} (${set.level})`);
    for (const module of set.modules) {
      const items = module.teile.reduce((n, t) => n + t.items.length, 0);
      const freeParts = module.teile.filter((t) => t.free).length;
      console.log(
        `    ${module.module}: ${module.pdfPages.length} page(s)` +
          `${module.answerPdfPages ? ` + ${module.answerPdfPages.length} answer page(s)` : ''}` +
          `${module.audio ? ', 1 audio track' : ''}, ${module.teile.length} Teil(e), ${items} item(s)` +
          `${freeParts ? `, ${freeParts} free part(s)` : ''}`,
      );
    }
  }
  console.log('\n--check: nothing was rendered or written.');
  process.exit(0);
}

const pdftoppmBin = resolveBinary('pdftoppm', PDFTOPPM_FALLBACK);
if (!pdftoppmBin) fail('pdftoppm not found on PATH or at ' + PDFTOPPM_FALLBACK + '. Install it with:  brew install poppler');

const ffmpegBin = totalAudio > 0 ? resolveBinary('ffmpeg', FFMPEG_FALLBACK) : null;
if (totalAudio > 0 && !ffmpegBin) {
  fail('ffmpeg not found on PATH or at ' + FFMPEG_FALLBACK + '. Install it with:  brew install ffmpeg');
}

let stats: IngestStats;
try {
  stats = ingest(config, sourcesDir, { force: options.force, pdftoppmBin, ffmpegBin });
} catch (err) {
  fail((err as Error).message);
}

const manifest = buildManifest(config);
const manifestPath = join(OUT_DIR, 'manifest.json');
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const reparsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!parseExamManifest(reparsed)) {
  rmSync(manifestPath);
  fail(
    `The manifest this script just wrote does not satisfy parseExamManifest (src/lib/exam-sim.ts).\n` +
      `Deleted ${relative(ROOT, manifestPath)} rather than ship a manifest the trainer page cannot\n` +
      `read. Check exam-sources.yaml against the shape documented at the top of this script.`,
  );
}

const outputProblems = missingOutputs(manifest);
if (outputProblems.length) {
  rmSync(manifestPath);
  console.error(
    `\n✗ ${outputProblems.length} file(s) the manifest references are missing on disk — deleted\n` +
      `${relative(ROOT, manifestPath)} rather than ship a manifest that 404s:`,
  );
  for (const p of outputProblems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(
  `✓ wrote ${relative(ROOT, manifestPath)} — ${totalSets} set(s), ${totalModules} module(s)\n` +
    `  pages: ${stats.pagesRendered} rendered, ${stats.pagesSkipped} already fresh (skipped)\n` +
    `  audio: ${stats.audioExtracted} extracted, ${stats.audioSkipped} already fresh (skipped)`,
);
