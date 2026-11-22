/**
 * Bring the owner's character images into the course (ADR 0021).
 *
 *   bun run characters:import                  every known character with a folder
 *   bun run characters:import -- lena mira     only these
 *   bun run characters:import -- --check       report what would change; write nothing
 *
 * The owner generates the images in ChatGPT and saves them, private and full size, as
 * `assets/images/<id>/<id>.png` (the portrait) and `<id>-1.png`, `<id>-2.png`, … (scenes or
 * variants of the same person). `assets/` is gitignored. For each image this writes the WebP the
 * site serves, `public/characters/<id>/<stem>.webp`, and its record in
 * `data/asset-provenance.yaml`, naming the saved prompt. A scene is written twice: at full size,
 * and as `<stem>-640.webp` for the place it has at the head of an episode on a desktop window.
 *
 * - A known id is a cast record (`content/characters/`) or a roster voice
 *   (`data/listening-characters.yaml`). A known id without a folder is reported, not an error:
 *   the images arrive one character at a time.
 * - A file that does not follow the naming is skipped and reported, never guessed at.
 * - A character the prompt file does not name is skipped: a generated image's record names the
 *   prompt it was made from, and that prompt is saved before the image is imported.
 * - Idempotent: the same originals give the same bytes, an unchanged file is not rewritten, and a
 *   record that exists keeps every field but its hash.
 *
 * It never edits a character record. Where a record exists and does not yet name an imported
 * image, the report says what to add: a scene needs a German alt text, which is authored.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import { loadCast } from '@da/content/characters';
import { repoRoot } from '@da/content/repo-root';

export const SOURCE_DIR = join('assets', 'images');
export const TARGET_DIR = join('public', 'characters');
export const PROMPT_FILE = 'data/prompts/2026-11-21-character-images.md';
const PROVENANCE_FILE = join('data', 'asset-provenance.yaml');

/** The long side of each kind, in pixels; a portrait is square. */
export const PORTRAIT_SIZE = 512;
export const SCENE_SIZE = 1024;
/** The scene as an episode shows it beside its text: twice the 320 px it is drawn at. */
export const SCENE_SMALL_SIZE = 640;
/** The small rendition's own ceiling: it exists to be lighter than the full-size file. */
export const SCENE_SMALL_MAX_BYTES = 60 * 1024;
/** What the small rendition's file name adds to the scene's stem. */
export const SCENE_SMALL_SUFFIX = `-${SCENE_SMALL_SIZE}`;
/** Every file stays under this, well below the 150 KB budget; the encoder steps its quality down until it does. */
export const MAX_BYTES = 120 * 1024;
const QUALITIES = [80, 75, 70, 65, 60, 55, 50];

const INPUT = /\.(png|jpe?g|webp)$/i;

export interface Classified {
  /** the portrait's file name in the folder, if there is one */
  portrait?: string;
  /** scenes in number order: the file name and the stem the WebP is written under */
  scenes: { file: string; stem: string }[];
  skipped: { file: string; reason: string }[];
}

/**
 * Which file in `assets/images/<id>/` is what. `<id>.png` is the portrait and `<id>-<n>.png`
 * (n ≥ 1, no leading zero) a scene; anything else is skipped with the reason. `.jpg`, `.jpeg` and
 * `.webp` originals are read too. Two originals that would write the same WebP are both skipped.
 */
export function classifyImages(id: string, files: readonly string[]): Classified {
  const result: Classified = { scenes: [], skipped: [] };
  const byStem = new Map<string, string[]>();
  for (const file of [...files].sort()) {
    if (file.startsWith('.')) continue;
    if (!INPUT.test(file)) {
      result.skipped.push({ file, reason: 'not a PNG, JPEG or WebP image' });
      continue;
    }
    const stem = basename(file, extname(file));
    if (stem !== id && !new RegExp(`^${id}-[1-9][0-9]*$`).test(stem)) {
      result.skipped.push({ file, reason: `not named ${id}.png or ${id}-<n>.png` });
      continue;
    }
    byStem.set(stem, [...(byStem.get(stem) ?? []), file]);
  }
  for (const [stem, found] of byStem) {
    if (found.length > 1) {
      for (const file of found)
        result.skipped.push({ file, reason: `${found.join(' and ')} would both be ${stem}.webp` });
      continue;
    }
    if (stem === id) result.portrait = found[0]!;
    else result.scenes.push({ file: found[0]!, stem });
  }
  const number = (stem: string) => Number(stem.slice(id.length + 1));
  result.scenes.sort((a, b) => number(a.stem) - number(b.stem));
  return result;
}

/** Every id an image folder may have: the cast records and the roster voices. */
export function knownCharacterIds(root: string): string[] {
  const ids = new Set(loadCast(root).cast.map((record) => record.data.id));
  const roster = join(root, 'data', 'listening-characters.yaml');
  if (existsSync(roster)) {
    const data = YAML.parse(readFileSync(roster, 'utf8')) as { characters?: { id: string }[] };
    for (const row of data.characters ?? []) ids.add(row.id);
  }
  return [...ids].sort();
}

/** Does the prompt file give this character's prompt? It names each id as `` `<id>` ``. */
export function promptNames(promptText: string, id: string): boolean {
  return promptText.includes(`\`${id}\``);
}

export interface ProvenanceEntry {
  path: string;
  sha256: string;
  id: string;
  kind: 'portrait' | 'scene';
  file: string;
  /** the long side the file was scaled to, where it is not its kind's own size */
  size?: number;
}

const quote = (text: string) => JSON.stringify(text);

/** A new record for an imported image, in the manifest's own form. */
export function provenanceBlock(entry: ProvenanceEntry): string {
  const what =
    entry.kind === 'portrait'
      ? `as the portrait of ${entry.id}`
      : `as ${basename(entry.path, '.webp')}, a further image of ${entry.id}`;
  const size =
    entry.kind === 'portrait' ? `${PORTRAIT_SIZE} px square` : `${entry.size ?? SCENE_SIZE} px`;
  return [
    `  - path: ${entry.path}`,
    `    sha256: ${entry.sha256}`,
    '    creationMode: ai-generated-base',
    '    generationTool: ChatGPT image generation (OpenAI)',
    `    prompt: ${PROMPT_FILE}`,
    '    candidateCount: null',
    '    candidateCountUnavailable: true',
    `    humanSelectionReason: ${quote(`Vitaly generated the image in ChatGPT from the saved prompt and chose it ${what}, by saving it as assets/images/${entry.id}/${entry.file}. How many candidates he generated before keeping it was not recorded.`)}`,
    '    humanEdits:',
    `      - ${quote(`Vitaly asked for a portrait and further images per character and kept this one. \`bun run characters:import\` scaled it to ${size} and encoded it as WebP; nothing in the picture was changed.`)}`,
    `    licenseReview: ${quote('Course-specific generated asset covered by content/LICENSE; the prompt forbids text, logos, brands and any resemblance to a real person.')}`,
    '    legacy: false',
    '    promptUnavailable: false',
  ].join('\n');
}

/**
 * The manifest with each entry's record added or its hash brought up to date. Text in, text out:
 * the file is hand-formatted, so only the lines that change are touched.
 */
export function upsertProvenance(manifest: string, entries: readonly ProvenanceEntry[]): string {
  let text = manifest;
  for (const entry of entries) {
    const existing = new RegExp(
      `(\\n  - path: ${entry.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n    sha256: )([0-9a-f]{64})`,
    );
    if (existing.test(text)) text = text.replace(existing, `$1${entry.sha256}`);
    else text = `${text.replace(/\n*$/, '\n')}${provenanceBlock(entry)}\n`;
  }
  return text;
}

/** The WebP for one original: the highest quality in the ladder that stays under the limit. */
async function encode(
  source: string,
  kind: 'portrait' | 'scene',
  size: number = kind === 'portrait' ? PORTRAIT_SIZE : SCENE_SIZE,
  maxBytes: number = MAX_BYTES,
): Promise<{ bytes: Buffer; quality: number }> {
  const resized =
    kind === 'portrait'
      ? sharp(source).resize(size, size, { fit: 'cover' })
      : sharp(source).resize(size, size, { fit: 'inside', withoutEnlargement: true });
  let last: Buffer | undefined;
  for (const quality of QUALITIES) {
    last = await resized.clone().webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
    if (last.byteLength <= maxBytes) return { bytes: last, quality };
  }
  throw new Error(`${source}: still ${last!.byteLength} bytes at quality ${QUALITIES.at(-1)}`);
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function main(args: string[]): Promise<void> {
  const root = repoRoot();
  const check = args.includes('--check');
  const known = knownCharacterIds(root);
  const asked = args.filter((arg) => !arg.startsWith('--'));
  for (const id of asked)
    if (!known.includes(id)) throw new Error(`"${id}" is neither a cast record nor a roster voice`);
  const ids = asked.length ? asked : known;
  const sourceRoot = join(root, SOURCE_DIR);
  const promptText = readFileSync(join(root, PROMPT_FILE), 'utf8');
  const cast = new Map(loadCast(root).cast.map((record) => [record.data.id, record]));

  const missing: string[] = [];
  const notes: string[] = [];
  const entries: ProvenanceEntry[] = [];
  let written = 0;
  let unchanged = 0;

  if (existsSync(sourceRoot))
    for (const folder of readdirSync(sourceRoot, { withFileTypes: true }))
      if (folder.isDirectory() && !known.includes(folder.name))
        notes.push(`${SOURCE_DIR}/${folder.name}/: no cast record or roster voice has this id`);

  for (const id of ids) {
    const folder = join(sourceRoot, id);
    if (!existsSync(folder)) {
      missing.push(id);
      continue;
    }
    if (!promptNames(promptText, id)) {
      notes.push(`${id}: ${PROMPT_FILE} gives no prompt for \`${id}\`; save it there first`);
      continue;
    }
    const found = classifyImages(id, readdirSync(folder));
    for (const { file, reason } of found.skipped)
      notes.push(`${SOURCE_DIR}/${id}/${file}: skipped, ${reason}`);
    const images = [
      ...(found.portrait ? [{ file: found.portrait, stem: id, kind: 'portrait' as const }] : []),
      ...found.scenes.flatMap((scene) => [
        { ...scene, kind: 'scene' as const },
        {
          file: scene.file,
          stem: `${scene.stem}${SCENE_SMALL_SUFFIX}`,
          kind: 'scene' as const,
          size: SCENE_SMALL_SIZE,
        },
      ]),
    ];
    for (const image of images) {
      const { bytes, quality } = await encode(
        join(folder, image.file),
        image.kind,
        'size' in image ? image.size : undefined,
        'size' in image ? SCENE_SMALL_MAX_BYTES : undefined,
      );
      const path = `${TARGET_DIR}/${id}/${image.stem}.webp`;
      const target = join(root, path);
      const same = existsSync(target) && readFileSync(target).equals(bytes);
      if (same) unchanged += 1;
      else {
        written += 1;
        if (!check) {
          mkdirSync(join(root, TARGET_DIR, id), { recursive: true });
          writeFileSync(target, bytes);
        }
      }
      console.log(
        `${same ? '  =' : check ? '  ~' : '  +'} ${path}  ${(bytes.byteLength / 1024).toFixed(0)} KB, quality ${quality}`,
      );
      entries.push({
        path,
        sha256: sha256(bytes),
        id,
        kind: image.kind,
        file: image.file,
        ...('size' in image ? { size: image.size } : {}),
      });
    }

    const record = cast.get(id);
    if (record) {
      const src = (stem: string) => `/characters/${id}/${stem}.webp`;
      if (found.portrait && record.data.portrait !== src(id))
        notes.push(`${record.file}: add \`portrait: ${src(id)}\``);
      const listed = new Set(record.data.scenes.map((scene) => scene.src));
      for (const scene of found.scenes)
        if (!listed.has(src(scene.stem)))
          notes.push(
            `${record.file}: ${scene.stem} is no scene yet; list it with \`src: ${src(scene.stem)}\` and a German \`alt_de\` to use it`,
          );
    }
  }

  const manifestPath = join(root, PROVENANCE_FILE);
  const before = readFileSync(manifestPath, 'utf8');
  const after = upsertProvenance(before, entries);
  if (after !== before && !check) writeFileSync(manifestPath, after);

  console.log(
    `\n${check ? 'Would write' : 'Wrote'} ${written}, unchanged ${unchanged}; ${PROVENANCE_FILE} ${after === before ? 'unchanged' : check ? 'would change' : 'updated'}.`,
  );
  if (missing.length) console.log(`No folder yet under ${SOURCE_DIR}/: ${missing.join(', ')}`);
  for (const note of notes) console.log(`- ${note}`);
}

if (import.meta.main) await main(process.argv.slice(2));
