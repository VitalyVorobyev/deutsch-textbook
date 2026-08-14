/**
 * The one path by which anything other than a human editor changes a content file.
 *
 * WHY IT IS THIS NARROW. `content/` is the source of truth and `git diff` on a topic is the
 * editorial process — both survive exactly as long as it takes one tool to reserialise a file and
 * lose its shape, or to write a value the schema would have rejected. So this is not a generic YAML
 * writer with guard rails bolted on: it is an **allowlist of (file class, field) pairs**, and a
 * field not on it cannot be written by any caller, at any path, ever.
 *
 * WHY IT SPLICES INSTEAD OF SERIALISING. The obvious implementation — `YAML.parseDocument`, `set`,
 * `toString` — is the one this repo has already been burned by: `String(doc)` reserialises with the
 * library's defaults, and 166 added citations to `grammar-inventory.yaml` arrived as 697 insertions
 * and 300 deletions. Tuning the options is not enough either. **Measured on the shipping corpus:
 * under the best options (`lineWidth: 0, flowCollectionPadding: false`) only 247 of 385 exercise
 * sets and topic manifests round-trip byte-for-byte; under the defaults, 18.** A writer built on
 * `toString` would silently reformat a third of the files it touched.
 *
 * So the write is a **splice into the source text** at the node's own range. Every byte outside the
 * value being changed is identical *by construction* rather than by luck, comments and quoting
 * included — and the post-condition below proves it structurally on every write.
 *
 * Five things every write must survive. Each has been broken on purpose once
 * (`tests/write-controller.test.ts`), because a rule nobody has watched fail is a rule nobody knows
 * the shape of:
 *
 *   1. **Containment** — the resolved path is inside `content/`. Resolved, not string-prefixed, so
 *      `../../.ssh/config` fails on the comparison rather than on the regex.
 *   2. **Class** — the path matches exactly one known file class, and the file exists.
 *   3. **Allowlist** — the field is one this class permits, and the value one the field permits.
 *   4. **Schema** — the patched text re-parses against the class's Zod schema. The backstop for
 *      everything an allowlist cannot express, because it sees the document and not one field.
 *   5. **Nothing else moved** — the old and new documents are compared as data, and the write is
 *      refused unless the *only* difference is the field that was asked for.
 *
 * WHAT IT DELIBERATELY CANNOT DO. Prose, items, `accept`, `key_tokens`, `focus`, `revision`,
 * anything under `progress/` or `data/`. Item-level fields change what is graded and carry a
 * `revision` contract a form cannot honour; they need their own review, not a row in this table.
 *
 * AND THE CORPUS CHECK IS NOT OPTIONAL EITHER. A per-file schema check cannot see a corpus-level
 * rule, and one of the two writable fields reaches one: marking a **B1** topic `reviewed` makes
 * `authorshipProvenanceProblems` demand provenance records it may not have, so a write that is
 * valid on its own turns `bun run validate` red. Callers therefore pass a `verify` hook; when it
 * reports a problem the original bytes are put back and the write is refused. `bun run validate`
 * takes about six seconds — the honest cost of not shipping a red gate by accident.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import * as YAML from 'yaml';
import {
  exerciseSetSchema,
  topicManifestSchema,
  LEARNING_ACTIVITIES,
  LESSON_STAGES,
} from '@da/schema';
import { repoRoot } from './repo-root';

interface WritableField {
  /** Values the field accepts. `null` always means "remove the key" and needs no entry. */
  values: readonly string[];
  /**
   * Where a new key goes when the file does not have one: after the first of these that exists.
   * A deterministic position, so two writes of the same field never produce two different diffs.
   */
  after: readonly string[];
}

interface FileClass {
  id: string;
  /** Tested against the repo-relative path. */
  match: RegExp;
  schema: { safeParse: (d: unknown) => { success: boolean; error?: unknown } };
  fields: Record<string, WritableField>;
}

const CLASSES: FileClass[] = [
  {
    id: 'exercise-set',
    match: /^content\/exercises\/[a-z0-9]+\/[a-z0-9-]+\.yaml$/,
    schema: exerciseSetSchema,
    fields: {
      stage: { values: LESSON_STAGES, after: ['role', 'topic'] },
      activity: { values: LEARNING_ACTIVITIES, after: ['stage', 'role', 'topic'] },
    },
  },
  {
    id: 'topic-manifest',
    match: /^content\/topics\/[a-z0-9]+\/[a-z0-9-]+\.topic\.yaml$/,
    schema: topicManifestSchema,
    fields: { status: { values: ['draft', 'reviewed'], after: ['title_uk', 'title_ru', 'kind'] } },
  },
];

export interface WritePatch {
  /** Repo-relative, POSIX-separated. */
  file: string;
  field: string;
  /** `null` removes the key — the only way back from a declared `stage` to the derived one. */
  value: string | null;
}

export type WriteResult =
  | { ok: true; file: string; field: string; before: string | null; after: string | null; changed: boolean }
  | { ok: false; error: string };

/** Every (class, field, values) the controller will write — a UI reads this, never a copy of it. */
export function writableFields(): { class: string; field: string; values: readonly string[] }[] {
  return CLASSES.flatMap((c) =>
    Object.entries(c.fields).map(([field, f]) => ({ class: c.id, field, values: f.values })),
  );
}

/** Which top-level keys differ between two parsed documents, one level deep. */
function changedKeys(before: unknown, after: unknown): string[] {
  const a = (before ?? {}) as Record<string, unknown>;
  const b = (after ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
}

export interface WriteOptions {
  /** Revision of the bytes the editor reviewed; a changed file must never be silently promoted. */
  expectedRevision?: string;
  /**
   * Runs after the bytes are written and reports what the corpus-level gate says. Returning a
   * string restores the file and refuses the write. Injected rather than imported because
   * `scripts/validate.ts` is a script — and because a test needs to make it fail on demand.
   */
  verify?: (root: string) => string | undefined;
}

export function applyPatch(patch: WritePatch, root = repoRoot(), opts: WriteOptions = {}): WriteResult {
  const { file, field, value } = patch;

  // 1. Containment. Resolve first, compare after: a `..` segment or an absolute path is only
  //    visible once resolved, and comparing raw strings is the classic way to miss both.
  const contentDir = resolve(root, 'content');
  const target = resolve(root, file);
  if (!target.startsWith(contentDir + sep)) return { ok: false, error: `"${file}" is outside content/` };

  // 2. Class.
  const klass = CLASSES.find((c) => c.match.test(file));
  if (!klass) return { ok: false, error: `no writable file class matches "${file}"` };
  if (!existsSync(target)) return { ok: false, error: `"${file}" does not exist` };

  // 3. Allowlist.
  const spec = klass.fields[field];
  if (!spec) return { ok: false, error: `field "${field}" is not writable on a ${klass.id}` };
  if (value !== null && !spec.values.includes(value))
    return { ok: false, error: `"${value}" is not one of ${spec.values.join(', ')} for ${klass.id}.${field}` };

  const source = readFileSync(target, 'utf8');
  if (opts.expectedRevision && createHash('sha256').update(source).digest('hex') !== opts.expectedRevision)
    return { ok: false, error: `"${file}" changed on disk; reload it before writing ${field}` };
  const doc = YAML.parseDocument(source);
  if (doc.errors.length) return { ok: false, error: `"${file}" is not valid YAML: ${doc.errors[0]!.message}` };
  if (!YAML.isMap(doc.contents)) return { ok: false, error: `"${file}" is not a mapping` };

  const pairs = doc.contents.items;
  const keyOf = (p: (typeof pairs)[number]) => (YAML.isScalar(p.key) ? String(p.key.value) : '');
  const existing = pairs.find((p) => keyOf(p) === field);
  const before = existing && YAML.isScalar(existing.value) ? String(existing.value.value) : null;

  // The splice. `range` on a node is `[start, valueEnd, nodeEnd]`; slicing `[start, valueEnd]`
  // replaces the value and leaves any trailing comment on the line untouched.
  let next: string;
  if (value === null) {
    if (!existing) return { ok: true, file, field, before: null, after: null, changed: false };
    const from = (existing.key as YAML.Scalar).range![0];
    const to = (existing.value as YAML.Node).range![2];
    next = source.slice(0, from) + source.slice(to);
  } else if (existing && YAML.isScalar(existing.value)) {
    const [from, to] = (existing.value as YAML.Scalar).range!;
    next = source.slice(0, from) + YAML.stringify(value).trim() + source.slice(to);
  } else if (existing) {
    return { ok: false, error: `${klass.id}.${field} is not a scalar in "${file}"` };
  } else {
    const anchorKey = spec.after.find((k) => pairs.some((p) => keyOf(p) === k));
    const anchor = pairs.find((p) => keyOf(p) === anchorKey);
    const at = anchor ? (anchor.value as YAML.Node).range![2] : 0;
    next = `${source.slice(0, at)}${field}: ${YAML.stringify(value).trim()}\n${source.slice(at)}`;
  }

  // 4. Schema — on the text that would actually be written, not on an in-memory object.
  const reparsed = YAML.parseDocument(next);
  if (reparsed.errors.length)
    return { ok: false, error: `the result would not be valid YAML: ${reparsed.errors[0]!.message}` };
  const parsed = klass.schema.safeParse(reparsed.toJS());
  if (!parsed.success)
    return {
      ok: false,
      error: `the result would not validate as a ${klass.id}: ${String(parsed.error).slice(0, 300)}`,
    };

  // 5. Nothing else moved. A splice cannot reformat by construction, but it can still be aimed at
  //    the wrong range, and this is what says so rather than committing the damage.
  const touched = changedKeys(doc.toJS(), reparsed.toJS());
  if (touched.length > 1 || (touched.length === 1 && touched[0] !== field))
    return { ok: false, error: `the write would also change ${touched.filter((k) => k !== field).join(', ')}` };

  const changed = next !== source;
  if (!changed) return { ok: true, file, field, before, after: value, changed: false };

  writeFileSync(target, next);
  const corpusProblem = opts.verify?.(root);
  if (corpusProblem !== undefined) {
    writeFileSync(target, source);
    return { ok: false, error: `the corpus would not validate: ${corpusProblem}` };
  }
  return { ok: true, file, field, before, after: value, changed: true };
}
