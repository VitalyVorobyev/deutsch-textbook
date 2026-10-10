/**
 * One official Leben-in-Deutschland question (ADR 0021), in one of two instruments:
 *
 *  - **practice** — options shuffled per presentation when `shouldShuffleOptions` allows (so a
 *    position cannot be memorised), no letters, answered by the first choice, then feedback:
 *    the verdict, the key, the course's rationale, and an unofficial translation on request.
 *  - **exam** — the options exactly as printed, lettered a–d, the choice controlled by the mock
 *    exam island and changeable until submission. No translation, no read-aloud, no hint.
 *    `reveal` turns it into the results view of one question: key, the learner's choice, and
 *    the rationale, read-only.
 *
 * The text is the catalogue's and is never edited here. Nothing is sized or captioned from the
 * answer (CLAUDE.md runtime invariant): every option button has the same shape whatever it says.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { LidImage, LidOptionKey, LidQuestion as LidQuestionData } from '@da/schema/lid';
import { shouldShuffleOptions } from '../../lib/lid';
import { pickSecond } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { withBase } from '../../lib/url';
import { ActionRow } from '../exercises/shared';
import { useExplainLang, useUiLang } from '../hooks';
import SpeakerButton from '../SpeakerButton';
import { LID_OPTION_ORDER, lidText, questionLabel, type LidEntry, type LidNoteView } from './shared';

interface CommonProps {
  entry: LidEntry;
  /** BAMF's catalogue PDF — where a withheld photo can still be seen */
  pdfUrl: string;
}

interface PracticeProps extends CommonProps {
  mode: 'practice';
  /** Called exactly once, with the SOURCE key of the option chosen. */
  onAnswer: (chosen: LidOptionKey, correct: boolean) => void;
  onNext: () => void;
  nextLabel?: string;
  /** Shuffle source, injectable so a test can pin an order. */
  rng?: () => number;
}

interface ExamProps extends CommonProps {
  mode: 'exam';
  chosen: LidOptionKey | null;
  /** Absent in the read-only results view. */
  onChoose?: (key: LidOptionKey) => void;
  /** Enter — the next question. */
  onNext?: () => void;
  /** Results: mark the key and the learner's choice, show the rationale, take no input. */
  reveal?: boolean;
}

export type LidQuestionProps = PracticeProps | ExamProps;

function shuffled(keys: readonly LidOptionKey[], rng: () => number): LidOptionKey[] {
  const out = [...keys];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** True when a keystroke belongs to a text field rather than to the question. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * The question's pictures. One image sits above the options; several form a grid labelled
 * "Bild 1…n", which is what options reading "Bild 1"… point at. A withheld press photo (ADR 0021)
 * is never requested: its credit and a link to the catalogue page stand in its place.
 */
export function LidImages({ question, pdfUrl }: { question: LidQuestionData; pdfUrl: string }) {
  const uiLang = useUiLang();
  const { images } = question;
  if (images.length === 0) return null;
  const label = questionLabel(question, uiLang);
  const several = images.length > 1;

  const picture = (image: LidImage, index: number) => {
    if (image.withheld) {
      return (
        <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600 dark:border-stone-600 dark:bg-stone-900/50 dark:text-stone-300">
          <p>{lidText('lid.imageWithheld', uiLang, { page: question.sourcePage, credit: image.withheld })}</p>
          <a
            href={`${pdfUrl}#page=${question.sourcePage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-11 items-center font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            {t('lid.imageOpenPdf', uiLang)}
          </a>
        </div>
      );
    }
    const caption = several ? lidText('lid.imageLabel', uiLang, { n: index + 1 }) : label;
    // In a grid every picture gets the same box, so the "Bild n" captions line up.
    return (
      <a
        href={withBase(image.path)}
        target="_blank"
        rel="noopener noreferrer"
        className={several ? 'flex h-36 items-center justify-center' : 'block'}
      >
        <img
          src={withBase(image.path)}
          width={image.width}
          height={image.height}
          loading="lazy"
          alt={lidText('lid.imageAlt', uiLang, { question: caption })}
          // A lone picture gets a definite width before it loads (its own, the column's, or what
          // 55vh of height allows), so the height follows from the width/height attributes and
          // nothing below it jumps when the file arrives. Grid pictures sit in a fixed box.
          style={several ? undefined : { width: `min(100%, ${image.width}px, calc(55vh * ${image.width / image.height}))` }}
          className={`mx-auto h-auto max-w-full rounded-md border border-stone-200 bg-white object-contain dark:border-stone-700 ${
            several ? 'max-h-full w-auto' : ''
          }`}
        />
      </a>
    );
  };

  if (!several) return <div className="mt-4">{picture(images[0]!, 0)}</div>;
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {images.map((image, index) => (
        <figure key={image.path} className="flex flex-col gap-1">
          {picture(image, index)}
          <figcaption className="text-center text-sm font-semibold">
            {lidText('lid.imageLabel', uiLang, { n: index + 1 })}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** The course's rationale and its source — or a quiet line saying there is none yet. */
function Rationale({ note }: { note: LidNoteView | undefined }) {
  const uiLang = useUiLang();
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
        {t('lid.explanation', uiLang)}
        {note?.rationale_de && note.status === 'draft' && (
          <span className="ml-2 font-normal normal-case tracking-normal">({t('lid.draft', uiLang)})</span>
        )}
      </p>
      {note?.rationale_de ? (
        <>
          <p className="mt-1">{note.rationale_de}</p>
          {note.source && (
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {t('lid.source', uiLang)}: {note.source}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-stone-500 dark:text-stone-400">{t('lid.noExplanation', uiLang)}</p>
      )}
    </div>
  );
}

/**
 * The unofficial translation, behind a toggle. EN surface rule: English always, plus the
 * explanation language's own half through `pickSecond` — Russian under `ru`, nothing under
 * `en`, `de` or `uk` (the notes carry no Ukrainian, and a UK reader is never handed Russian).
 */
function Translation({ note, order }: { note: LidNoteView; order: readonly LidOptionKey[] }) {
  const uiLang = useUiLang();
  const lang = useExplainLang();
  const [open, setOpen] = useState(false);
  const regionId = useId();
  if (!note.question || !note.options) return null;
  const { question, options } = note;
  const second = (text: { ru: string }) => pickSecond(lang, { ru: text.ru });

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
      >
        {open ? '▾' : '▸'} {t('lid.translation', uiLang)}
      </button>
      {open && (
        <div id={regionId} className="mt-1 space-y-2 text-stone-600 dark:text-stone-300">
          <div>
            <p lang="en">{question.en}</p>
            {second(question) && <p lang="ru">{second(question)}</p>}
          </div>
          <ul className="list-disc space-y-1 pl-5">
            {order.map((key) => (
              <li key={key}>
                <span lang="en">{options[key].en}</span>
                {second(options[key]) && (
                  <span lang="ru" className="block">
                    {second(options[key])}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Terms({ note }: { note: LidNoteView }) {
  const uiLang = useUiLang();
  const lang = useExplainLang();
  if (!note.terms?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
        {t('lid.terms', uiLang)}
      </p>
      <dl className="mt-1 space-y-1">
        {note.terms.map((term) => {
          const ru = pickSecond(lang, { ru: term.ru });
          return (
            <div key={term.de}>
              <dt className="inline font-medium">{term.de}</dt>
              <dd className="inline text-stone-600 dark:text-stone-300">
                {' — '}
                <span lang="en">{term.en}</span>
                {ru && (
                  <span lang="ru" className="block pl-4">
                    {ru}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export default function LidQuestion(props: LidQuestionProps) {
  const { entry, pdfUrl, mode } = props;
  const { question, note } = entry;
  const uiLang = useUiLang();
  const textId = useId();
  const rng = props.mode === 'practice' ? props.rng : undefined;
  // Fixed for the life of one presentation; the parent remounts (a new `key`) to present again.
  const [order] = useState<LidOptionKey[]>(() =>
    mode === 'practice' && shouldShuffleOptions(question)
      ? shuffled(LID_OPTION_ORDER, rng ?? Math.random)
      : [...LID_OPTION_ORDER],
  );
  // Practice keeps its own answer: the first choice is final, as in the exam it trains for.
  const [practiceChoice, setPracticeChoice] = useState<LidOptionKey | null>(null);

  const chosen = props.mode === 'practice' ? practiceChoice : props.chosen;
  const reveal = props.mode === 'practice' ? practiceChoice !== null : props.reveal === true;
  const interactive = props.mode === 'practice' ? practiceChoice === null : !props.reveal && !!props.onChoose;

  function choose(key: LidOptionKey) {
    if (props.mode === 'practice') {
      if (practiceChoice !== null) return;
      setPracticeChoice(key);
      props.onAnswer(key, key === question.solution);
    } else if (!props.reveal) {
      props.onChoose?.(key);
    }
  }

  function next() {
    if (props.mode === 'practice') {
      if (practiceChoice !== null) props.onNext();
    } else if (!props.reveal) {
      props.onNext?.();
    }
  }

  // 1–4 choose the option in that DISPLAYED position; Enter is Weiter. The handler is re-bound
  // every render so it always sees the current choice. A focused control keeps its native Enter
  // (that is how a keyboard user picks the option they tabbed to), except an exam option that is
  // already the chosen one, where Enter can only mean "next".
  const latest = useRef({ choose, next, order, chosen });
  useEffect(() => {
    latest.current = { choose, next, order, chosen };
  });
  const keyboard = !(props.mode === 'exam' && props.reveal);
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const current = latest.current;
      if (event.key >= '1' && event.key <= '4') {
        const key = current.order[Number(event.key) - 1];
        if (key) {
          event.preventDefault();
          current.choose(key);
        }
        return;
      }
      if (event.key !== 'Enter') return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const control = target?.closest('button, a, summary');
      if (control) {
        const option = control.getAttribute('data-lid-option');
        if (!option || option !== current.chosen) return;
      }
      event.preventDefault();
      current.next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard]);

  // The exam names no topic — that would be a hint the real sheet does not give — and marks the
  // catalogue number as such, beside the island's own "Frage 4 / 33".
  const header =
    mode === 'practice'
      ? `${entry.topicTitle} · ${questionLabel(question, uiLang)}`
      : lidText('lid.catalogueRef', uiLang, { label: questionLabel(question, uiLang) });

  return (
    <article lang="de" aria-labelledby={textId}>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">{header}</p>
      <div className="mt-2 flex items-start gap-1">
        <p id={textId} className="text-lg font-semibold leading-snug">
          {question.question}
        </p>
        {mode === 'practice' && <SpeakerButton text={question.question} className="-mt-1 shrink-0" />}
      </div>

      <LidImages question={question} pdfUrl={pdfUrl} />

      <div role="group" aria-labelledby={textId} className="mt-4 flex flex-col gap-2">
        {order.map((key) => {
          const isChosen = chosen === key;
          const isKey = key === question.solution;
          let tone =
            'border-stone-300 hover:border-amber-500 dark:border-stone-600 dark:hover:border-amber-400';
          if (reveal && isKey) tone = 'border-green-600 bg-green-50 text-green-900 dark:border-green-500 dark:bg-green-950/40 dark:text-green-200';
          else if (reveal && isChosen) tone = 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200';
          else if (reveal) tone = 'border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400';
          else if (isChosen) tone = 'border-amber-600 bg-amber-50 ring-1 ring-amber-600 dark:bg-amber-950/40';
          return (
            <button
              key={key}
              type="button"
              data-lid-option={key}
              aria-pressed={mode === 'exam' && !reveal ? isChosen : undefined}
              disabled={!interactive}
              onClick={() => choose(key)}
              className={`flex min-h-11 w-full items-start gap-3 rounded-md border px-4 py-2.5 text-left text-base disabled:cursor-default ${tone}`}
            >
              {mode === 'exam' && (
                <span
                  aria-hidden="true"
                  className={`mt-px w-4 shrink-0 font-semibold ${isChosen && !reveal ? 'text-amber-700 dark:text-amber-400' : 'text-stone-400'}`}
                >
                  {key}
                </span>
              )}
              <span className="min-w-0 flex-1">
                {mode === 'exam' && <span className="sr-only">{key}) </span>}
                {question.answers[key]}
              </span>
              {reveal && (isKey || isChosen) && (
                <span className="shrink-0 text-sm font-semibold">
                  <span aria-hidden="true">{isKey ? '✓' : '✗'}</span>
                  <span className="sr-only">
                    {isKey ? t('lid.correctAnswer', uiLang) : t('lid.yourAnswer', uiLang)}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {props.mode === 'practice' && (
        <>
          <ActionRow
            checked={practiceChoice !== null}
            correct={practiceChoice === question.solution}
            onNext={props.onNext}
            nextLabel={props.nextLabel ?? t('action.next', uiLang)}
          />
          {practiceChoice !== null && (
            <div className="mt-4 space-y-3 rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-900/50">
              <Rationale note={note} />
              {note && <Terms note={note} />}
              {note && <Translation note={note} order={order} />}
            </div>
          )}
        </>
      )}

      {props.mode === 'exam' && props.reveal && (
        <div className="mt-3 space-y-1 text-sm">
          {chosen === null && (
            <p className="font-medium text-red-700 dark:text-red-400">
              {t('lid.yourAnswer', uiLang)}: {t('lid.noAnswer', uiLang)}
            </p>
          )}
          <Rationale note={note} />
        </div>
      )}
    </article>
  );
}
