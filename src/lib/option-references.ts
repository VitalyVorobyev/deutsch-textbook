/**
 * Explanations that name an option by its position, in a UI that shuffles options.
 *
 * `MultipleChoice.tsx`, `AudioComprehension.tsx` and `Match.tsx` all render their choices through
 * `shuffle()` on mount, so there is no first, second or third option — there is a different order
 * for every learner and every visit. An `explain` that says "the second option copies the English
 * order" is therefore wrong for most of the people who read it, in the one field whose entire job
 * is to teach after an error. Twenty-two items shipped that way across A2 and B1.
 *
 * **The rule anchors on an option noun, and deliberately cannot see a bare ordinal.** Scanning
 * every ordinal in the shuffled-option corpus returns 203 occurrences, and the overwhelming
 * majority are correct grammar prose that must never be flagged: "the verb comes second",
 * "position 2", "the second verb", "verb-second", "the infinitive first", "second-to-last",
 * "die erste Straße rechts", "vierter Stock is the fourth floor", "the first line", "for first
 * contact". Against that background a bare ordinal carries no signal, so requiring the noun
 * (option/answer/choice · вариант/ответ · варіант/відповідь · Option/Antwort/Variante) is what
 * keeps the rule usable at all.
 *
 * That leaves a real residual, and it is handled by scope rather than by cleverness: the check
 * reports the **whole field**, not the match, because a field that says "The first option puts two
 * elements in front of the verb; the third leaves the bracket open" needs both halves rewritten.
 * Fields whose only positional reference is a bare ordinal are invisible here — see the backlog.
 *
 * Authoring-time only; never imported by runtime. Same contract as `prose-shape.ts`.
 */

/** Item types whose choices are shuffled before rendering, and so have no stable order. */
export const SHUFFLED_OPTION_TYPES = new Set(['mc', 'audio-comprehension', 'match']);

/**
 * Ordinal + option-noun, per language.
 *
 * Russian and Ukrainian ordinals are matched by stem with a loose ending class, because the noun
 * that follows fixes the case anyway (`во втором варианте`, `первый вариант`, `третьего варианта`).
 * German needs the article-driven endings for the same reason. English is positionally rigid, so
 * `the second option` and `the last one` are both spelled out.
 */
const PATTERNS: readonly RegExp[] = [
  // English — "the second option", "the last answer", "the middle one".
  /\b(?:the\s+)?(?:first|second|third|fourth|fifth|last|final|middle)\s+(?:one|option|answer|choice|alternative)\b/i,
  // Russian — "первый вариант", "во втором варианте", "третьего ответа".
  // `\p{L}` and a lookbehind, not `\w`/`\b`: JavaScript's `\w` is ASCII-only, so `\b` finds no
  // boundary before a Cyrillic letter and `\w*` matches nothing after one. Written with `\b\w*`
  // these two patterns are syntactically valid, never throw, and silently match nothing — which
  // is exactly how they shipped in the first draft of this file and passed a corpus with a dozen
  // Russian instances in it.
  /(?<!\p{L})(?:перв|втор|трет|четв[её]рт|пят|последн|средн)\p{L}*\s+(?:вариант|ответ)\p{L}*/iu,
  // Ukrainian — "перший варіант", "у другому варіанті", "третя відповідь".
  /(?<!\p{L})(?:перш|друг|трет|четверт|п'ят|остан|середн)\p{L}*\s+(?:варіант|відповід)\p{L}*/iu,
  // German — "die zweite Option", "der letzten Antwort", "eine dritte Variante".
  /\b(?:erst|zweit|dritt|viert|f[üu]nft|letzt|mittler)(?:e|en|er|es|em)\s+(?:Option|Antwort|Variante|M[öo]glichkeit|Auswahl)/i,
  // The number on the *other* side of the noun, which every ordinal pattern above misses:
  // "Option 2", "Вариант 3", "Antwort 1". Found only because a rewrite pass turned up
  // "Option 1 is the neutral everyday pattern" sitting untouched in fields the rule had just
  // declared clean — 13 more fields across 5 items, in a corpus the ordinal rule called done.
  /(?<!\p{L})(?:option|answer|choice|variante?|antwort|m[öo]glichkeit|вариант|ответ|варіант|відповідь)\s*\d(?!\p{L})/iu,
  // Spelled-out, and deliberately narrower: only nouns that cannot also be verbs. "answer" and
  // "choice" are dropped here because "you only need to answer one question" is ordinary prose
  // and would be rejected as a defect.
  /(?<!\p{L})(?:option|variante?|вариант|варіант)\s+(?:one|two|three|four|five)(?!\p{L})/iu,
];

/** True when the text names a choice by where it sits in a list that is shuffled. */
export function namesOptionByPosition(text: string): boolean {
  return PATTERNS.some((pattern) => pattern.test(text));
}

/** The matched phrase, for a message that shows the author what tripped the rule. */
export function positionalReference(text: string): string | undefined {
  for (const pattern of PATTERNS) {
    const match = pattern.exec(text);
    if (match) return match[0].trim();
  }
  return undefined;
}
