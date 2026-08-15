import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Reading, ReadingAudioArtifact } from '@da/schema';
import { parseGlosses } from '@da/schema/gloss';
import { focusForAttempt, responseModeForItem } from '../../lib/evidence';
import { logAttempt } from '../../lib/store';
import { pick, pickLang } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';
import { ItemView } from '../exercises/ExerciseSet';
import type { ItemResult } from '../exercises/shared';
import SpeakerButton from '../SpeakerButton';
import { bundlesAudio, readingAudioUrl } from '../../lib/audio';
import { speakGermanSequence } from '../../lib/speech';
import { withBase } from '../../lib/url';

interface Props {
  /** reading path-id, e.g. "a2/termine-vereinbaren" */
  readingId: string;
  reading: Reading;
  narration?: ReadingAudioArtifact;
}

/** Explanation-language strings — one hoisted record per file (docs/adrs/0001-bilingual-explanation-halves.md). */
const UI = {
  extensiveNote: {
    en: 'A longer text, meant to be read for pleasure. Read it straight through once. Not knowing every word is fine — leave the glosses closed while the meaning still carries.',
    ru: 'Длинный текст для чтения ради удовольствия. Прочитайте его один раз, не останавливаясь. Незнакомые слова — это нормально: не открывайте подсказки, пока смысл понятен.',
  },
  comprehension: { en: 'comprehension questions correct.', ru: 'правильных ответов по тексту.' },
  results: { en: 'Results', ru: 'Результат' },
} as const satisfies Record<string, { en: string; ru: string }>;

/**
 * Renders a credit line's URLs as links showing only the hostname — a full
 * percent-encoded Wikisource URL wraps over three lines on a phone, and the
 * href keeps the whole address anyway.
 */
function renderCredit(text: string) {
  return text.split(/(https?:\/\/\S+)/).map((part, i) => {
    if (!/^https?:\/\//.test(part)) return <Fragment key={i}>{part}</Fragment>;
    let label = part;
    try {
      label = new URL(part).hostname;
    } catch {
      /* unparseable — show the raw text */
    }
    return (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-dotted underline-offset-2 hover:text-stone-600 dark:hover:text-stone-300"
      >
        {label}
      </a>
    );
  });
}

/**
 * A graded reading text with click-to-reveal glosses, followed by its
 * comprehension questions one at a time (same "Weiter →" flow as ExerciseSet).
 * Attempts are logged under `reading:<path-id>` so they are distinguishable
 * from exercise-set attempts in progress snapshots.
 */
export default function ReadingText({ readingId, reading, narration }: Props) {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const paragraphs = useMemo(() => reading.text.map((p) => parseGlosses(p).segments), [reading]);
  const [openGlosses, setOpenGlosses] = useState<ReadonlySet<string>>(new Set());
  const [audioFailed, setAudioFailed] = useState(false);
  const [activeParagraph, setActiveParagraph] = useState<number | null>(null);
  const [fallbackPlaying, setFallbackPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cancelSpeech = useRef<() => void>(() => {});
  const narrationUrl = narration && bundlesAudio(import.meta.env.PUBLIC_ATLAS_AUDIO_BUNDLE) && !audioFailed
    ? withBase(readingAudioUrl(narration.level, readingId.split('/').at(-1)!))
    : undefined;

  useEffect(() => () => cancelSpeech.current(), []);

  function paragraphText(index: number): string {
    return paragraphs[index]!.map((segment) => segment.kind === 'text' ? segment.text : segment.gloss.de).join('');
  }

  function playAll() {
    if (narrationUrl && audioRef.current) {
      void audioRef.current.play();
      return;
    }
    setFallbackPlaying(true);
    cancelSpeech.current = speakGermanSequence(
      paragraphs.map((_, index) => paragraphText(index)),
      {},
      () => setFallbackPlaying(false),
    );
  }

  function replayParagraph(index: number) {
    const cue = narration?.paragraphs[index];
    if (narrationUrl && cue && audioRef.current) {
      audioRef.current.currentTime = cue.start_ms / 1000;
      void audioRef.current.play();
    }
  }

  function syncParagraph() {
    const time = (audioRef.current?.currentTime ?? 0) * 1000;
    const cue = narration?.paragraphs.find((row) => time >= row.start_ms && time < row.end_ms);
    setActiveParagraph(cue?.paragraph_index ?? null);
  }

  const questions = reading.questions;
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<boolean[]>([]);
  const [currentDone, setCurrentDone] = useState(false);

  const finished = index >= questions.length;
  const question = questions[index];

  function toggleGloss(key: string) {
    setOpenGlosses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleResult(result: ItemResult) {
    if (!question) return;
    setCurrentDone(true);
    setAnswered((a) => [...a, result.correct]);
    void logAttempt({
      setId: `reading:${readingId}`,
      itemId: question.id,
      itemType: question.type,
      itemRevision: question.revision,
      correct: result.correct,
      given: result.given,
      focus: focusForAttempt(question, result),
      focusEvidence: result.focusEvidence,
      evidence: result.evidence,
      responseMode: result.responseMode ?? responseModeForItem(question),
      outcomes: question.outcomes,
      practice: result.practice,
      ts: Date.now(),
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setCurrentDone(false);
  }

  const correctCount = answered.filter(Boolean).length;

  const extensive = reading.kind === 'extensive';

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800 sm:p-6">
      <h3 lang="de" className="mb-1 text-xl font-semibold">
        {reading.title_de}
      </h3>

      {/*
        An extensive reader is told what it is, because otherwise a learner treats every
        German text on this site the same way — parsing each sentence, tapping every gloss,
        bracing for the questions. That is the intensive reading habit, and it is exactly
        what stops a longer text from ever being read at volume. Saying "read it once,
        keep going, you are meant not to know everything" is the intervention.
      */}
      {extensive && (
        <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
          {pick(lang, UI.extensiveNote)}
        </p>
      )}
      {!extensive && <div className="mb-4" />}

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-700 dark:bg-stone-900">
        <button type="button" onClick={playAll} disabled={fallbackPlaying}
          className="min-h-10 rounded-md bg-stone-800 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-stone-200 dark:text-stone-900">
          {fallbackPlaying ? '…' : '▶ Gesamten Text anhören'}
        </button>
        {narration ? (
          <span className="text-xs text-stone-500">{narration.style_id} · geprüfte Aufnahme</span>
        ) : (
          <span className="text-xs text-stone-500">Systemstimme · hochwertige Aufnahme folgt</span>
        )}
        {narrationUrl && <audio ref={audioRef} src={narrationUrl} controls className="h-9 min-w-64 flex-1"
          onTimeUpdate={syncParagraph} onEnded={() => setActiveParagraph(null)} onError={() => setAudioFailed(true)} />}
      </div>

      <div lang="de" className="flex flex-col gap-4 leading-relaxed">
        {paragraphs.map((segments, pi) => (
          <p key={pi} className={activeParagraph === pi ? '-mx-2 rounded-md bg-amber-50 px-2 py-1 dark:bg-amber-950/40' : ''}>
            {narrationUrl ? (
              <button type="button" onClick={() => replayParagraph(pi)} aria-label={`Absatz ${pi + 1} anhören`}
                className="float-right ml-2 inline-flex min-h-8 min-w-8 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700">▶</button>
            ) : (
              <SpeakerButton text={paragraphText(pi)} className="float-right ml-2 text-stone-400" />
            )}
            {segments.map((seg, si) => {
              if (seg.kind === 'text') return <Fragment key={si}>{seg.text}</Fragment>;
              const key = `${pi}:${si}`;
              const shown = openGlosses.has(key);
              // Destructured, never seg.gloss itself: the gloss record's `de`
              // key is the glossed German phrase, and under ExplainLang 'de'
              // pick() would reveal the phrase as its own gloss — 'de' falls
              // back to the EN gloss instead. pickLang stamps the language the
              // pick actually resolved to (a three-field gloss under 'uk', and
              // every gloss under 'de', shows English), so screen readers never
              // pronounce the EN fallback with Ukrainian/German rules.
              const glossText = { en: seg.gloss.en, ru: seg.gloss.ru, uk: seg.gloss.uk };
              return (
                <Fragment key={si}>
                  <button
                    type="button"
                    onClick={() => toggleGloss(key)}
                    aria-expanded={shown}
                    className="cursor-pointer underline decoration-amber-500 decoration-dotted underline-offset-4 hover:text-amber-700 dark:decoration-amber-400 dark:hover:text-amber-400"
                  >
                    {seg.gloss.de}
                  </button>
                  {shown && (
                    <span
                      lang={pickLang(lang, glossText)}
                      className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 text-sm text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                    >
                      {pick(lang, glossText)}
                    </span>
                  )}
                </Fragment>
              );
            })}
          </p>
        ))}
      </div>

      {questions.length === 0 ? null : (
      <div className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-700">
        <div className="mb-4 flex items-center justify-between">
          <p lang={uiLang} className="text-sm font-semibold text-stone-600 dark:text-stone-300">
            {/* one gist question, not an interrogation of every sentence */}
            {extensive ? t('reading.gist', uiLang) : t('reading.questions', uiLang)}
          </p>
          <div className="flex items-center gap-1" aria-label="progress">
            {questions.map((q, i) => (
              <span
                key={q.id}
                className={`h-2 w-2 rounded-full ${
                  i < answered.length
                    ? answered[i]
                      ? 'bg-green-500'
                      : 'bg-red-400'
                    : i === index
                      ? 'bg-amber-500'
                      : 'bg-stone-300 dark:bg-stone-600'
                }`}
              />
            ))}
          </div>
        </div>

        {finished ? (
          <p className="text-sm text-stone-600 dark:text-stone-300">
            <span className="font-bold">
              {correctCount} / {questions.length}
            </span>{' '}
            {pick(lang, UI.comprehension)}
          </p>
        ) : (
          question && (
            <ItemView
              instanceKey={question.id}
              item={question}
              lang={lang}
              onResult={handleResult}
              locked={currentDone}
              onNext={next}
              nextLabel={
                index + 1 < questions.length ? t('action.next', uiLang) : pick(lang, UI.results)
              }
            />
          )
        )}
      </div>
      )}

      {/* Provenance for adapted texts (ADR 0006) — data on the reading, always visible. */}
      {reading.attribution && (
        <p lang="de" className="mt-4 text-xs text-stone-400 dark:text-stone-500">
          {renderCredit(reading.attribution)} · {reading.license}
        </p>
      )}
    </div>
  );
}
