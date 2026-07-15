/**
 * Schreib-Assistent: local advisory feedback on `write` drafts via Ollama.
 *
 * Contract: docs/assist-design.md. The one rule everything here is shaped by:
 * assist output is **advisory only, never evidence** — nothing returned by this
 * module may touch accuracy, mastery, attempts or the snapshot. The feature
 * self-hides when no local model answers, so the course is complete without it.
 *
 * Transport is plain browser fetch to http://localhost:11434 (dev server or any
 * http: origin). On a deployed https page the probe never runs — an https page
 * cannot call http://localhost (mixed content) — unless the app runs under
 * Tauri, whose transport is P7-3 and not wired yet.
 */
import { z } from 'zod';
import { getAssistModel } from './prefs';
import { isTauri } from './syncdir';

export const OLLAMA_BASE = 'http://localhost:11434';
const PROBE_TIMEOUT_MS = 1200;
const REVIEW_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// The hints shape
// ---------------------------------------------------------------------------

export const WRITE_HINT_CATEGORIES = [
  'grammar',
  'word-order',
  'word-choice',
  'spelling',
  'task',
] as const;
export type WriteHintCategory = (typeof WRITE_HINT_CATEGORIES)[number];

/**
 * At most four hints: a wall of feedback gets skimmed, and the revise stage
 * should stay a revision, not a correction transcript.
 */
export const writeHintsSchema = z.object({
  /** one genuine sentence, in the explanation language */
  praise: z.string(),
  hints: z
    .array(
      z.object({
        /** a verbatim substring of the learner's draft — the hint's anchor to reality */
        quote: z.string(),
        category: z.enum(WRITE_HINT_CATEGORIES),
        /** a question or rule pointer — never a corrected sentence */
        nudge: z.string(),
      }),
    )
    .max(4),
});
export type WriteHints = z.infer<typeof writeHintsSchema>;

/**
 * Hints pinned to the exact text they reviewed. `forText` is what keeps a hint
 * from outliving its subject: the panel retires any hint whose quote no longer
 * occurs in the current revision, and a restore from SavedWriting discards the
 * whole set when the saved revision is not the text the hints were made for.
 */
export const reviewedHintsSchema = writeHintsSchema.extend({ forText: z.string() });
export type ReviewedHints = z.infer<typeof reviewedHintsSchema>;

/**
 * Is `quote` still a verbatim substring of `text`, after trivial whitespace
 * normalization? The reviewDraft hallucination filter and the panel's live
 * hint retirement are the same question, so they share this one predicate.
 */
export function quoteAnchored(quote: string, text: string): boolean {
  const needle = normalize(quote);
  return needle.length > 0 && normalize(text).includes(needle);
}

/**
 * Hand-written JSON-schema mirror of writeHintsSchema for Ollama's `format`
 * structured-output constraint (kept literal — no schema-conversion dependency).
 */
const WRITE_HINTS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    praise: { type: 'string' },
    hints: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          quote: { type: 'string' },
          category: { type: 'string', enum: [...WRITE_HINT_CATEGORIES] },
          nudge: { type: 'string' },
        },
        required: ['quote', 'category', 'nudge'],
      },
    },
  },
  required: ['praise', 'hints'],
} as const;

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

export interface AssistProbe {
  reachable: boolean;
  /** installed model tags, e.g. "gemma4:e4b" */
  models: string[];
}

/** Probe result cached per page load — Ollama does not appear mid-session. */
let probeCache: Promise<AssistProbe> | null = null;

/**
 * Is a local Ollama answering, and with which models? Skipped entirely on a
 * deployed https page outside Tauri: probing would only produce console noise
 * (mixed content), so there the assistant simply does not exist.
 */
export function probeAssist(): Promise<AssistProbe> {
  probeCache ??= runProbe();
  return probeCache;
}

async function runProbe(): Promise<AssistProbe> {
  if (typeof location !== 'undefined' && location.protocol === 'https:' && !isTauri()) {
    return { reachable: false, models: [] };
  }
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return { reachable: false, models: [] };
    const body = (await res.json()) as { models?: Array<{ name?: unknown }> };
    const models = (body.models ?? [])
      .map((m) => m.name)
      .filter((name): name is string => typeof name === 'string');
    return { reachable: true, models };
  } catch {
    return { reachable: false, models: [] };
  }
}

/**
 * The model reviewDraft should use: the learner's stored choice while it is
 * still installed, else the first gemma tag, else the first tag at all.
 */
export function chooseAssistModel(models: string[]): string | null {
  const stored = getAssistModel();
  if (stored && models.includes(stored)) return stored;
  return models.find((m) => m.toLowerCase().startsWith('gemma')) ?? models[0] ?? null;
}

// ---------------------------------------------------------------------------
// Session state: a feature that visibly fails twice is worse than none at all
// ---------------------------------------------------------------------------

let failures = 0;
let hidden = false;

/** True once assist has failed enough this page load to stay hidden. */
export function assistHiddenForSession(): boolean {
  return hidden;
}

/** The reviewer produced nothing usable despite its one retry — hide at once. */
export function hideAssistForSession(): void {
  hidden = true;
}

/** A timeout/abort failure. The second one hides the feature for the session. */
export function noteAssistFailure(): void {
  failures += 1;
  if (failures >= 2) hidden = true;
}

/** Test seam: clears the probe cache and the session failure state. */
export function resetAssistForTests(): void {
  probeCache = null;
  failures = 0;
  hidden = false;
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export interface ReviewRequest {
  /** the text under review, verbatim — quotes are filtered against it */
  draft: string;
  /** the item's prompt, in the learner's explanation language */
  taskPrompt: string;
  goal: string;
  requirements: string[];
  /** context only — the model is told not to critique or reveal it */
  modelAnswer: string;
  /** the topic's CEFR level, e.g. "A2" — the ceiling the review must respect */
  level: string;
  /** praise and nudges are written in this language */
  hintLang: 'en' | 'ru';
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type Attempt =
  | { kind: 'ok'; hints: WriteHints }
  /** malformed JSON, schema miss, or every quote hallucinated — worth one corrective retry */
  | { kind: 'unusable'; raw: string }
  /** HTTP/network failure — retrying with a corrective message cannot help */
  | { kind: 'error' };

/**
 * Ask the local model for praise + hints on a draft. Returns the quote-filtered
 * hints, or null when nothing usable came back despite one corrective retry —
 * the caller then hides the assistant for the session. Rejects with the abort
 * reason when `signal` fires or the 60-second overall budget runs out, so the
 * panel can tell its own Abbrechen from a silent failure.
 */
export async function reviewDraft(
  request: ReviewRequest,
  { model, signal }: { model: string; signal?: AbortSignal },
): Promise<WriteHints | null> {
  const { signal: combined, cleanup } = combineWithTimeout(REVIEW_TIMEOUT_MS, signal);
  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt(request) },
      { role: 'user', content: userPrompt(request) },
    ];
    const first = await attempt(request.draft, messages, model, combined);
    if (first.kind === 'ok') return first.hints;
    if (first.kind === 'error') return null;
    // Structured output constrains the shape, not the truth: retry exactly once,
    // restating that quotes must appear verbatim in the draft.
    const second = await attempt(
      request.draft,
      [
        ...messages,
        { role: 'assistant', content: first.raw },
        { role: 'user', content: CORRECTIVE_MESSAGE },
      ],
      model,
      combined,
    );
    return second.kind === 'ok' ? second.hints : null;
  } finally {
    cleanup();
  }
}

async function attempt(
  draft: string,
  messages: ChatMessage[],
  model: string,
  signal: AbortSignal,
): Promise<Attempt> {
  let raw: string;
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        // The pilot (docs/assist-design.md) found reasoning buys no hint quality
        // here and quadruples latency; Ollama ignores `think` on non-reasoning models.
        think: false,
        options: { temperature: 0.2 },
        format: WRITE_HINTS_JSON_SCHEMA,
      }),
      signal,
    });
    if (!res.ok) return { kind: 'error' };
    const body = (await res.json()) as { message?: { content?: unknown } };
    raw = typeof body.message?.content === 'string' ? body.message.content : '';
  } catch (error) {
    // Aborts (the learner's Abbrechen, or the 60 s budget) propagate to the caller.
    if (signal.aborted) throw signal.reason ?? error;
    return { kind: 'error' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'unusable', raw };
  }
  const checked = writeHintsSchema.safeParse(parsed);
  if (!checked.success) return { kind: 'unusable', raw };

  // Hallucination filter: the quote is the only thing anchoring a hint to
  // reality — a hint about words the learner never wrote is noise at best.
  const anchored = checked.data.hints.filter((hint) => quoteAnchored(hint.quote, draft));
  // Zero hints *returned* is a legitimate outcome (a good draft earns praise
  // only); zero hints *surviving* means every quote was hallucinated.
  if (checked.data.hints.length > 0 && anchored.length === 0) {
    return { kind: 'unusable', raw };
  }
  return { kind: 'ok', hints: { praise: checked.data.praise, hints: anchored } };
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** One signal that fires on the caller's abort or the overall timeout. */
function combineWithTimeout(
  timeoutMs: number,
  outer?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('The review timed out.', 'TimeoutError')),
    timeoutMs,
  );
  const onOuterAbort = () => controller.abort(outer?.reason);
  if (outer?.aborted) onOuterAbort();
  else outer?.addEventListener('abort', onOuterAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    },
  };
}

// ---------------------------------------------------------------------------
// Prompt design (English: small local models follow English instructions most
// reliably). The rules were earned in the 2026-07-15 pilot against gemma4:e4b —
// see docs/assist-design.md — where the model quoted flawlessly but padded a
// near-perfect draft with invented problems until told that an empty hints
// array is a good outcome.
// ---------------------------------------------------------------------------

function languageName(lang: 'en' | 'ru'): string {
  return lang === 'ru' ? 'Russian' : 'English';
}

function systemPrompt(req: ReviewRequest): string {
  const lang = languageName(req.hintLang);
  return [
    `You are a supportive German teacher. The learner is at CEFR level ${req.level}. Review their short German text and return JSON with one sentence of genuine praise and at most 4 hints on the most important problems.`,
    'Rules:',
    `- Comment within the ${req.level} ceiling: do not demand structures above ${req.level}, and do not flag correct ${req.level} German for lacking sophistication.`,
    `- Each hint's "quote" must be a verbatim substring of the learner's text — copy their exact words, never paraphrase and never fix the quote.`,
    `- NEVER rewrite the learner's text. Never supply a corrected word, form or sentence, and never write a model text. The learner must find the fix themselves.`,
    `- Each "nudge" is one short question or rule pointer in ${lang} (for example: "Which case does *mit* take?"). German may be quoted from the learner's text, never corrected.`,
    `- Write the praise and every nudge in ${lang}.`,
    `- Do not comment on the model answer; it is context for what the task asked, nothing more.`,
    `- Flag only real errors. Before writing a hint, name the error to yourself precisely (wrong case after this preposition, verb not in second position, wrong article form…). If you cannot name a definite error in the quoted words, do not give the hint.`,
    `- A main clause may begin with a time phrase followed by verb, then subject (Am Abend komme ich …) — that is correct German, not an error. A separable prefix at the end of the sentence is correct, not an error.`,
    `- Returning "hints": [] is a good and common outcome — many texts are already correct. Never pad the list; never invent problems in a good text.`,
  ].join('\n');
}

function userPrompt(req: ReviewRequest): string {
  return [
    `Task: ${req.taskPrompt}`,
    `Goal: ${req.goal}`,
    'Requirements:',
    ...req.requirements.map((r) => `- ${r}`),
    `Model answer (context only): ${req.modelAnswer}`,
    '',
    "The learner's text:",
    req.draft,
  ].join('\n');
}

const CORRECTIVE_MESSAGE =
  'Some of your quotes were not copied verbatim from the learner\'s text. Re-read the text above and return the JSON again: every "quote" must appear in the learner\'s text character for character. Do not invent words the learner did not write.';
