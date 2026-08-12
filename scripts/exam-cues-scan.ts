/**
 * Propose Hören cue points for one already-ingested module, by finding the answer pauses.
 *
 *   bun scripts/exam-cues-scan.ts sd1-modellsatz/hoeren
 *   bun scripts/exam-cues-scan.ts sd1-modellsatz/hoeren --min-gap 6
 *   bun scripts/exam-cues-scan.ts --help
 *
 * Reads public/exams/<setId>/<module>.m4a — the file `scripts/exam-ingest.ts` already
 * extracted, never the original video — runs `ffmpeg -af silencedetect` over it, and prints a
 * candidate `cues:` YAML block on stdout for pasting into docs/GeotheInstitute/exam-sources.yaml.
 * It writes nothing, anywhere. Like `bun run gen:ipa`, this is a one-off dev tool: nothing
 * about ffmpeg ships, and nothing it reads or prints may enter the repo (ADR 0009 — both
 * public/exams/ and docs/GeotheInstitute/ are gitignored).
 *
 * ALWAYS VERIFY BY EAR BEFORE PASTING. Everything this prints is a PROPOSAL:
 *
 *   - **The labels are placeholders.** `Marke 1`, `Marke 2`, … in file order. Only listening
 *     tells you which mark is "Teil 2" and which is "Nr. 7"; a Start Deutsch 1 Hören opens
 *     with a Beispiel whose pause looks exactly like Nummer 1's, so a purely mechanical
 *     numbering is off by one whenever the Beispiel is scored as a Nummer.
 *   - **The boundaries are approximate.** A cue is placed one second before the silence ends,
 *     inside the pause, so the next announcement is heard from its first word — but a speaker
 *     who breathes mid-sentence, a musical sting, or a quiet passage under the noise floor all
 *     move that edge. Adjust `at:` after listening.
 *   - **Only long gaps are reported.** The answer pauses of a Start Deutsch 1 Hören run ~13–17 s;
 *     the 2–5 s gaps between an item's two plays are deliberately below the default threshold,
 *     because a cue per repetition is navigation nobody wants. The per-line comment prints each
 *     gap's length, so the longest ones — the Teil boundaries, where an instruction is read out
 *     — stand out from the per-Nummer pauses around them.
 *
 * The cue schema itself (`label`, `at`) is documented at the top of `scripts/exam-ingest.ts`;
 * how the trainer renders cues is in docs/architecture/exam-trainer.md.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import type { ExamModuleId } from '../src/lib/exam-sim';

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'exams');
const FFMPEG_FALLBACK = '/opt/homebrew/bin/ffmpeg';

const MODULE_IDS: ExamModuleId[] = ['hoeren', 'lesen', 'schreiben', 'sprechen'];

/** Answer pauses of a Start Deutsch 1 Hören run ~13–17 s; an item's two plays are 2–5 s apart. */
const DEFAULT_MIN_GAP_S = 8;
/** What `silencedetect` calls silence: quieter than this, for at least this long. */
const DEFAULT_NOISE_DB = -30;
const DEFAULT_DETECT_S = 2;
/** A cue lands this far before the silence ends, so the next announcement starts intact. */
const LEAD_IN_S = 1;

interface Options {
  setId: string;
  module: ExamModuleId;
  minGapS: number;
  noiseDb: number;
  detectS: number;
  help: boolean;
}

const EMPTY: Options = {
  setId: '',
  module: 'hoeren',
  minGapS: DEFAULT_MIN_GAP_S,
  noiseDb: DEFAULT_NOISE_DB,
  detectS: DEFAULT_DETECT_S,
  help: false,
};

function numberArg(argv: string[], i: number, flag: string): number {
  const value = Number(argv[i]);
  if (!Number.isFinite(value)) throw new Error(`${flag} needs a number.`);
  return value;
}

export function parseArgs(argv: string[]): Options {
  const options: Options = { ...EMPTY };
  let target: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--min-gap') options.minGapS = numberArg(argv, ++i, '--min-gap');
    else if (arg === '--noise') options.noiseDb = numberArg(argv, ++i, '--noise');
    else if (arg === '--detect') options.detectS = numberArg(argv, ++i, '--detect');
    else if (arg.startsWith('-')) throw new Error(`Unknown argument: ${arg}`);
    else if (target !== null) throw new Error(`Only one <setId>/<module> target at a time (got "${target}" and "${arg}").`);
    else target = arg;
  }
  if (options.help) return options;
  if (!target) throw new Error('Needs a target: <setId>/<module>, e.g. sd1-modellsatz/hoeren');
  const [setId, module, ...rest] = target.split('/');
  if (!setId || !module || rest.length) {
    throw new Error(`Target must be <setId>/<module>, got "${target}".`);
  }
  if (!MODULE_IDS.includes(module as ExamModuleId)) {
    throw new Error(`Unknown module "${module}" — one of ${MODULE_IDS.join('|')}.`);
  }
  options.setId = setId;
  options.module = module as ExamModuleId;
  return options;
}

function printHelp(): void {
  console.log(`Propose Hören cue points from the answer pauses of an ingested recording.

Usage:
  bun scripts/exam-cues-scan.ts <setId>/<module> [--min-gap <s>] [--noise <dB>] [--detect <s>]

  --min-gap <s>  Report only silences at least this long (default ${DEFAULT_MIN_GAP_S}). The answer pauses
                  run ~13–17 s; the gaps between an item's two plays run 2–5 s.
  --noise <dB>   silencedetect threshold (default ${DEFAULT_NOISE_DB}).
  --detect <s>   silencedetect minimum duration (default ${DEFAULT_DETECT_S}).
  --help         Show this message.

Reads public/exams/<setId>/<module>.m4a and prints a candidate cues: block on stdout.
Writes nothing. Every label and every timestamp it prints is a PROPOSAL — verify by ear
before pasting into docs/GeotheInstitute/exam-sources.yaml.`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** PATH lookup without executing anything, plus the Homebrew fallback `exam-ingest.ts` uses. */
function resolveBinary(name: string, fallback: string): string | null {
  for (const dir of (process.env.PATH ?? '').split(':').filter(Boolean)) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return existsSync(fallback) ? fallback : null;
}

export interface Silence {
  start: number;
  end: number;
  duration: number;
}

/**
 * silencedetect reports through the log, one `silence_start:` line and one
 * `silence_end: … | silence_duration: …` line per gap. A silence still open at the end of the
 * file gets no `silence_end` — that trailing pause is not a cue, so an unclosed start is
 * dropped rather than guessed at.
 */
export function parseSilences(log: string): Silence[] {
  const silences: Silence[] = [];
  let open: number | null = null;
  for (const line of log.split('\n')) {
    const start = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (start) {
      open = Number(start[1]);
      continue;
    }
    const end = /silence_end:\s*(-?[\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/.exec(line);
    if (end && open !== null) {
      silences.push({ start: open, end: Number(end[1]), duration: Number(end[2]) });
      open = null;
    }
  }
  return silences;
}

/** `m:ss`, the form `at:` accepts and the form a player's own position readout uses. */
export const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/** Same, with tenths — for the comments, where the raw edge is what a human checks against. */
const clockTenths = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  const tenths = Math.round((Math.max(0, seconds) - whole) * 10);
  return `${clock(whole)}.${tenths === 10 ? 9 : tenths}`;
};

export interface Candidate {
  label: string;
  at: number;
  silence: Silence;
}

/** Every gap at least `minGapS` long, as a cue one second before the audio comes back. */
export function candidates(silences: Silence[], minGapS: number): Candidate[] {
  return silences
    .filter((silence) => silence.duration >= minGapS)
    .map((silence, index) => ({
      label: `Marke ${index + 1}`,
      at: Math.max(0, Math.floor(silence.end - LEAD_IN_S)),
      silence,
    }));
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

const audioPath = join(OUT_DIR, options.setId, `${options.module}.m4a`);
if (!existsSync(audioPath)) {
  fail(
    `No recording at ${relative(ROOT, audioPath)}.\n\n` +
      `This tool scans what ingestion already extracted, not the original video. Run\n` +
      `  bun run exam:ingest\n` +
      `on a machine holding docs/GeotheInstitute/ first (ADR 0009), and check that the module\n` +
      `names an "audio:" file in exam-sources.yaml.`,
  );
}

const ffmpegBin = resolveBinary('ffmpeg', FFMPEG_FALLBACK);
if (!ffmpegBin) {
  fail(`ffmpeg not found on PATH or at ${FFMPEG_FALLBACK}. Install it with:  brew install ffmpeg`);
}

// silencedetect reports through the log on stderr and produces no output file; `-f null -`
// decodes the whole track and discards it. `spawnSync`, not `execFileSync`, because the log
// *is* stderr — the thing execFileSync throws away on success.
const run = spawnSync(
  ffmpegBin,
  [
    '-hide_banner',
    '-nostats',
    '-i',
    audioPath,
    '-af',
    `silencedetect=noise=${options.noiseDb}dB:d=${options.detectS}`,
    '-f',
    'null',
    '-',
  ],
  { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 64 * 1024 * 1024 },
);
if (run.error || run.status !== 0) {
  fail(
    `ffmpeg failed scanning ${relative(ROOT, audioPath)}:\n${run.stderr || run.error?.message || `exit ${run.status}`}`,
  );
}
const log = run.stderr ?? '';

const silences = parseSilences(log);
const found = candidates(silences, options.minGapS);
const durationMatch = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(log);
const totalS = durationMatch
  ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
  : 0;

console.log(`# ${options.setId}/${options.module} — ${clock(totalS)} total, ${silences.length} silence(s)`);
console.log(
  `# proposed from silence scan (exam-cues-scan.ts): gaps ≥ ${options.minGapS}s at ` +
    `${options.noiseDb}dB/${options.detectS}s, cue placed ${LEAD_IN_S}s before the audio returns.`,
);
console.log('# LABELS AND BOUNDARIES ARE PROPOSALS — listen before pasting into exam-sources.yaml.');
console.log('# Rename "Marke N" to "Teil N" / "Nr. N" by ear: the Beispiel pause looks like a Nummer pause.');

if (found.length === 0) {
  console.log(
    `#\n# No gap reached ${options.minGapS}s. Longest silence: ` +
      `${silences.length ? `${silences.reduce((a, b) => (b.duration > a.duration ? b : a)).duration.toFixed(1)}s` : 'none'}` +
      ` — try a smaller --min-gap or a different --noise.`,
  );
  process.exit(0);
}

console.log('cues:');
for (const candidate of found) {
  const comment =
    `# gap ${candidate.silence.duration.toFixed(1)}s ` +
    `(${clockTenths(candidate.silence.start)} → ${clockTenths(candidate.silence.end)})`;
  console.log(`  - { label: "${candidate.label}", at: "${clock(candidate.at)}" }   ${comment}`);
}
