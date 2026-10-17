/**
 * Import the official Leben-in-Deutschland question bank. ADR 0021.
 *
 *   bun run lid:import                  fetch, verify, write data/lid/bank.yaml + public/lid/*.png
 *   bun run lid:import -- --check       verify and report the diff against the committed bank; write nothing
 *   bun run lid:import -- --from <dir>  read manifest.json, questions.json and images/ from a local copy
 *   bun run lid:import -- --pdf <file>  also prove the BAMF PDF you hold is the one the dataset was built from
 *   bun run lid:import -- --crosscheck  compare all answer keys against two independent public keys
 *   bun run lid:import -- --accept-changes   allow a changed answer key or BAMF id through (after review)
 *   bun run lid:import -- --states BY,BE     which states' questions to carry (default BY)
 *
 * The source is an independent machine-readable extraction of the BAMF catalogue
 * (github.com/YehorAltshuler/bamf-lid-dataset): text from the official PDF, answers checked
 * against BAMF's online test centre. It is an IMPORT FORMAT, never a runtime dependency — the
 * app reads only the committed bank. Every count, checksum and image hash is verified before
 * anything is written, and a re-import that would change a correct answer stops: an answer key
 * is never hot-swapped.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { LID_OPTION_KEYS, lidBankSchema, type LidBank, type LidQuestion } from '@da/schema/lid';
import { repoRoot } from '@da/content/repo-root';

const DATASET = 'https://yehoraltshuler.github.io/bamf-lid-dataset/';
/** Which states' ten questions to carry. A second state is `--states BY,BE` and a topic for it. */
const STATES = (
  process.argv.includes('--states') ? process.argv[process.argv.indexOf('--states') + 1]! : 'BY'
).split(',');
const ALL_STATES = 16;
const ROOT = repoRoot();
const BANK = join(ROOT, 'data/lid/bank.yaml');
const IMAGES = join(ROOT, 'public/lid');

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const from = value('--from');

const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
function die(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function fetchBytes(path: string): Promise<Uint8Array> {
  if (from) return new Uint8Array(readFileSync(join(from, path)));
  const res = await fetch(new URL(path, DATASET));
  if (!res.ok) die(`${path}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// --- the upstream shapes, read defensively: this is a third party's schema ---
interface UpstreamImage {
  path: string;
  sha256: string;
  width: number;
  height: number;
  mime_type: string;
}
interface UpstreamQuestion {
  id: string;
  officialNumber: number;
  scope: 'general' | 'state';
  stateCode: string | null;
  question: string;
  answers: Record<string, string>;
  images: UpstreamImage[];
  sourcePage: number;
  solution: string;
  bamfInternalId: string;
}

const manifest = JSON.parse(new TextDecoder().decode(await fetchBytes('manifest.json')));
if (manifest.schemaVersion !== 1)
  die(`unsupported dataset schemaVersion ${manifest.schemaVersion}`);
const questionsBytes = await fetchBytes(manifest.questions.url);
if (sha(questionsBytes) !== manifest.questions.sha256)
  die(
    `questions.json SHA-256 ${sha(questionsBytes)} does not match the manifest's ${manifest.questions.sha256}`,
  );
const upstream = JSON.parse(new TextDecoder().decode(questionsBytes)) as {
  questions: UpstreamQuestion[];
};
const all = upstream.questions;

// --- counts and shape over the WHOLE dataset, before selecting anything ---
const ids = new Set(all.map((q) => q.id));
if (ids.size !== all.length) die('duplicate question ids in the dataset');
const general = all.filter((q) => q.scope === 'general');
const byState = new Map<string, UpstreamQuestion[]>();
for (const q of all.filter((q) => q.scope === 'state')) {
  if (!q.stateCode) die(`${q.id}: state question without a stateCode`);
  byState.set(q.stateCode, [...(byState.get(q.stateCode) ?? []), q]);
}
if (all.length !== 460 || general.length !== 300 || byState.size !== ALL_STATES)
  die(
    `expected 460 = 300 general + 16 × 10, got ${all.length} = ${general.length} + ${byState.size} states`,
  );
for (const [state, qs] of byState)
  if (qs.length !== 10) die(`${state} has ${qs.length} questions, not 10`);
for (const q of all) {
  const keys = Object.keys(q.answers).sort().join('');
  if (keys !== 'abcd') die(`${q.id}: answers are ${keys}, not a–d`);
  if (!LID_OPTION_KEYS.includes(q.solution as never))
    die(`${q.id}: solution "${q.solution}" is not a–d`);
  if (!q.question.trim() || LID_OPTION_KEYS.some((k) => !q.answers[k]!.trim()))
    die(`${q.id}: empty text`);
}

// --- select, then fetch and verify every image the selection needs ---
const selected = [
  ...general,
  ...STATES.flatMap((s) => byState.get(s) ?? die(`no questions for ${s}`)),
];
const imageBytes = new Map<string, Uint8Array>();
for (const q of selected) {
  for (const image of q.images) {
    if (image.mime_type !== 'image/png' && image.mime_type !== 'image/jpeg')
      die(`${q.id}: ${image.path} is ${image.mime_type}, expected PNG or JPEG`);
    const bytes = await fetchBytes(image.path);
    if (sha(bytes) !== image.sha256) die(`${q.id}: ${image.path} SHA-256 mismatch`);
    const [w, h] = dimensions(bytes, image.path);
    if (w !== image.width || h !== image.height)
      die(`${q.id}: ${image.path} is ${w}×${h}, the dataset says ${image.width}×${image.height}`);
    imageBytes.set(image.path, bytes);
  }
}

/** Pixel size from the file itself, so the dataset's stated dimensions are checked, not trusted. */
function dimensions(bytes: Uint8Array, path: string): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG: the IHDR chunk carries width and height as big-endian u32 at offsets 16 and 20.
  if (view.getUint32(0) === 0x89504e47) return [view.getUint32(16), view.getUint32(20)];
  // JPEG: walk the marker segments to the first start-of-frame (SOF0–SOF15, not DHT/JPG/DAC).
  if (view.getUint16(0) === 0xffd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      const marker = view.getUint16(at);
      const length = view.getUint16(at + 2);
      if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker))
        return [view.getUint16(at + 7), view.getUint16(at + 5)];
      at += 2 + length;
    }
  }
  die(`${path}: neither a PNG nor a JPEG with a readable frame header`);
}

const toBank = (q: UpstreamQuestion): LidQuestion => ({
  id: q.id,
  officialNumber: q.officialNumber,
  scope: q.scope,
  stateCode: q.stateCode,
  bamfInternalId: q.bamfInternalId,
  sourcePage: q.sourcePage,
  question: q.question,
  answers: { a: q.answers.a!, b: q.answers.b!, c: q.answers.c!, d: q.answers.d! },
  solution: q.solution as LidQuestion['solution'],
  images: q.images.map((i) => ({
    path: `/lid/${i.path.split('/').pop()}`,
    sha256: i.sha256,
    width: i.width,
    height: i.height,
    ...(photoCredit(q) ? { withheld: photoCredit(q) } : {}),
  })),
});

/**
 * The catalogue prints a photographer's credit at the end of the question text (`… © Deutscher
 * Bundestag/Achim Melde`). Such a picture is a third party's photograph inside the official
 * work, and §5 UrhG does not free it — so it is verified like every image but never written.
 */
function photoCredit(q: UpstreamQuestion): string | undefined {
  const match = q.question.match(/©\s*([^©]+)$/);
  return match ? `© ${match[1]!.trim()}` : undefined;
}

const previous: LidBank | undefined = existsSync(BANK)
  ? lidBankSchema.parse(YAML.parse(readFileSync(BANK, 'utf8')))
  : undefined;

const bank: LidBank = lidBankSchema.parse({
  version: 1,
  source: {
    title: 'Gesamtfragenkatalog zum Test „Leben in Deutschland“ und zum „Einbürgerungstest“',
    publisher: 'Bundesamt für Migration und Flüchtlinge (BAMF)',
    edition: 'Stand: 07.05.2025',
    legalBasis:
      'Anlage 1 der Verordnung zu Einbürgerungstest und Einbürgerungskurs (EinbTestV), BGBl. I 2008 S. 1649, zuletzt geändert durch Art. 1 V v. 21.6.2024 (BGBl. I Nr. 211)',
    pdfUrl: manifest.source.pdfUrl,
    pdfSha256: manifest.source.pdfSha256,
    attribution:
      'Fragen, Antworten und Abbildungen: Bundesamt für Migration und Flüchtlinge (BAMF), Gesamtfragenkatalog „Leben in Deutschland“, Stand 07.05.2025 — unverändert übernommen. Übersetzungen und Erklärungen sind inoffiziell.',
  },
  dataset: {
    url: DATASET,
    version: manifest.datasetVersion,
    questionsSha256: manifest.questions.sha256,
    retrievedAt:
      previous && previous.dataset.version === manifest.datasetVersion
        ? previous.dataset.retrievedAt
        : new Date().toISOString().slice(0, 10),
  },
  states: STATES,
  questions: selected.map(toBank),
});
if (bank.questions.length !== 300 + 10 * STATES.length)
  die(`selected ${bank.questions.length} questions`);

// --- the diff a re-import must survive ---
const blockers: string[] = [];
const report: string[] = [];
if (previous) {
  const before = new Map(previous.questions.map((q) => [q.id, q]));
  const after = new Map(bank.questions.map((q) => [q.id, q]));
  for (const id of before.keys()) if (!after.has(id)) blockers.push(`${id}: removed`);
  for (const [id, q] of after) {
    const old = before.get(id);
    if (!old) {
      report.push(`${id}: added`);
      continue;
    }
    if (old.bamfInternalId !== q.bamfInternalId)
      blockers.push(
        `${id}: BAMF id ${old.bamfInternalId} → ${q.bamfInternalId} (a different question under the same number?)`,
      );
    if (old.solution !== q.solution) blockers.push(`${id}: ANSWER ${old.solution} → ${q.solution}`);
    if (old.question !== q.question) report.push(`${id}: question text changed`);
    for (const k of LID_OPTION_KEYS)
      if (old.answers[k] !== q.answers[k]) report.push(`${id}: option ${k} changed`);
    if (JSON.stringify(old.images) !== JSON.stringify(q.images))
      report.push(`${id}: images changed`);
  }
}

console.log(
  `dataset ${manifest.datasetVersion}: 460 verified · selected ${bank.questions.length} (${STATES.join(', ')}) · ` +
    `${bank.questions.filter((q) => q.images.length).length} with images, ${imageBytes.size} image files`,
);
for (const line of report) console.log(`  · ${line}`);
for (const line of blockers) console.log(`  ✗ ${line}`);

// --- optional evidence ---
const pdf = value('--pdf');
if (pdf) {
  const actual = sha(readFileSync(pdf));
  if (actual !== bank.source.pdfSha256)
    die(`${pdf} is ${actual}; the dataset was built from ${bank.source.pdfSha256}`);
  console.log(`✓ ${pdf} is the PDF the dataset was extracted from`);
}
if (flag('--crosscheck')) await crosscheck(bank);

if (blockers.length && !flag('--accept-changes'))
  die(
    `${blockers.length} change(s) need review — verify each against the BAMF online test centre, then rerun with --accept-changes`,
  );
if (flag('--check')) {
  console.log('✓ check only — nothing written');
  process.exit(0);
}

mkdirSync(IMAGES, { recursive: true });
let written = 0;
for (const q of bank.questions)
  for (const image of q.images) {
    const target = join(ROOT, 'public', image.path);
    if (image.withheld) {
      rmSync(target, { force: true });
      continue;
    }
    const upstreamPath = selected
      .find((s) => s.id === q.id)!
      .images.find((i) => i.sha256 === image.sha256)!.path;
    writeFileSync(target, imageBytes.get(upstreamPath)!);
    written++;
  }
mkdirSync(join(ROOT, 'data/lid'), { recursive: true });
writeFileSync(
  BANK,
  `# GENERATED by scripts/lid-import.ts — never edit by hand. Official text, ADR 0021.\n` +
    YAML.stringify(bank, { lineWidth: 0 }),
);
console.log(
  `✓ wrote ${BANK.replace(`${ROOT}/`, '')} and ${written} image(s) under public/lid/ ` +
    `(${imageBytes.size - written} credited photo(s) verified but withheld)`,
);

/**
 * Compare every answer key against two independent public keys. A disagreement is evidence
 * to resolve by hand on the BAMF online test centre; a question a source words differently
 * is reported as unmatched rather than guessed at.
 */
async function crosscheck(b: LidBank): Promise<void> {
  const norm = (s: string) =>
    s
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^0-9a-zäöüß]+/g, '');
  type Key = { question: string; options: string[]; correct: number };
  const sources: { name: string; url: string; keys: (json: unknown) => Map<string, Key> }[] = [
    {
      name: 'must1d/einbuergerungs-test',
      url: 'https://raw.githubusercontent.com/must1d/einbuergerungs-test/HEAD/data.json',
      keys: (json) => {
        const list = json as { question: string; answers: string[]; correct: number }[];
        const map = new Map<string, Key>();
        // 300 general questions in catalogue order, then each state's ten.
        list.slice(0, 300).forEach((q, i) =>
          map.set(`general-${String(i + 1).padStart(3, '0')}`, {
            question: q.question,
            options: q.answers,
            correct: q.correct,
          }),
        );
        for (const state of b.states) {
          const first = b.questions.find((q) => q.id === `${state}-01`)!;
          const start = list.findIndex((q) => norm(q.question) === norm(first.question));
          if (start >= 0)
            list.slice(start, start + 10).forEach((q, i) =>
              map.set(`${state}-${String(i + 1).padStart(2, '0')}`, {
                question: q.question,
                options: q.answers,
                correct: q.correct,
              }),
            );
        }
        return map;
      },
    },
    {
      name: 'abdullahbutt/leben-in-deutschland-test',
      url: 'https://raw.githubusercontent.com/abdullahbutt/leben-in-deutschland-test/HEAD/quiz-data.json',
      keys: (json) => {
        const data = json as {
          general: { id: number; de: string; options: { de: string }[]; correct: number }[];
          states: Record<
            string,
            { questions: { de: string; options: (string | { de: string })[]; correct: number }[] }
          >;
        };
        const map = new Map<string, Key>();
        for (const q of data.general)
          map.set(`general-${String(q.id).padStart(3, '0')}`, {
            question: q.de,
            options: q.options.map((o) => o.de),
            correct: q.correct,
          });
        const names: Record<string, string> = { BY: 'bayern' };
        for (const state of b.states)
          data.states[names[state] ?? '']?.questions.forEach((q, i) =>
            map.set(`${state}-${String(i + 1).padStart(2, '0')}`, {
              question: q.de,
              options: q.options.map((o) => (typeof o === 'string' ? o : o.de)),
              correct: q.correct,
            }),
          );
        return map;
      },
    },
  ];
  for (const source of sources) {
    const res = await fetch(source.url);
    if (!res.ok) {
      console.log(`  ? ${source.name}: HTTP ${res.status}, skipped`);
      continue;
    }
    const keys = source.keys(await res.json());
    let agree = 0;
    const unmatched: string[] = [];
    const disagree: string[] = [];
    for (const q of b.questions) {
      const k = keys.get(q.id);
      const ours = LID_OPTION_KEYS.map((o) => norm(q.answers[o]));
      if (!k || k.options.map(norm).sort().join('|') !== [...ours].sort().join('|')) {
        unmatched.push(q.id);
        continue;
      }
      if (norm(k.options[k.correct]!) === norm(q.answers[q.solution])) agree++;
      else
        disagree.push(
          `${q.id} (ours ${q.solution}: "${q.answers[q.solution]}", theirs "${k.options[k.correct]}")`,
        );
    }
    console.log(
      `  ${disagree.length ? '✗' : '✓'} ${source.name}: ${agree} agree · ${disagree.length} disagree · ` +
        `${unmatched.length} worded differently, not compared`,
    );
    for (const d of disagree) console.log(`      ${d}`);
    if (unmatched.length && unmatched.length <= 10)
      console.log(`      not compared: ${unmatched.join(', ')}`);
  }
}
