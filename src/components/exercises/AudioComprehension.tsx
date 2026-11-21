import { useMemo, useState } from 'react';
import type { z } from 'zod';
import type { audioComprehensionItemSchema } from '@da/schema';
import type { RecordingScript } from '../../lib/audio';
import { shuffle } from '../../lib/shuffle';
import { ActionRow, Feedback, Instruction, Translation, type ItemProps } from './shared';
import { RecordingPlayer, type PlayBudget } from './RecordingPlayer';

export { SLOW_RATE, turnAt } from './RecordingPlayer';

type AudioItem = z.infer<typeof audioComprehensionItemSchema>;

interface Props extends ItemProps<AudioItem> {
  /**
   * The set recording of the task set this item belongs to. An item in a task set carries no
   * script of its own, so served alone — in mixed training — it plays this one.
   */
  recording?: RecordingScript;
  /**
   * The recording is the task set's shared panel, beside the item: the item shows only its
   * question and options, and the set owns the one player and the one play budget.
   */
  sharedRecording?: boolean;
  /**
   * The plays of this item's recording, held by the run that serves it, so the budget carries
   * across every question on the same recording. Absent, the item's player counts its own.
   */
  budget?: PlayBudget;
  /**
   * Whether answering this item reveals the transcript: false while a later question in the same
   * run is still to be answered from this recording, since the transcript would answer it.
   */
  revealOnAnswer?: boolean;
}

/** The script an item plays: its own `source`, or the set recording it was handed. */
export function itemScript(item: AudioItem, recording?: RecordingScript): RecordingScript | null {
  if (item.source)
    return {
      ...(item.recording ? { id: item.recording } : {}),
      turns: item.source.turns,
      rate: item.source.rate,
    };
  return recording ?? null;
}

export function AudioComprehension(props: Props) {
  const {
    item,
    lang,
    onResult,
    locked,
    onNext,
    nextLabel,
    recording,
    sharedRecording,
    budget,
    revealOnAnswer = true,
  } = props;
  const [chosen, setChosen] = useState<number | null>(null);
  const order = useMemo(() => shuffle(item.options.map((_, i) => i)), [item]);
  const script = sharedRecording ? null : itemScript(item, recording);
  const checked = chosen !== null;
  const correct = chosen === item.correct;

  function choose(index: number) {
    if (checked || locked) return;
    setChosen(index);
    onResult({ correct: index === item.correct, given: item.options[index]! });
  }

  const task = (
    <>
      <p lang="de" className="mb-3 text-lg font-medium">
        {item.question}
      </p>
      <div className="space-y-2">
        {order.map((index) => (
          <button
            key={index}
            type="button"
            disabled={checked}
            onClick={() => choose(index)}
            className={`block min-h-11 w-full rounded-md border px-4 py-2 text-left ${checked && index === item.correct ? 'border-green-500 bg-green-50 dark:bg-green-950' : checked && index === chosen ? 'border-red-500 bg-red-50 dark:bg-red-950' : 'border-stone-300 hover:border-amber-500 dark:border-stone-600'}`}
          >
            {item.options[index]}
          </button>
        ))}
      </div>
      <Translation text={item.translation} lang={lang} />
      <ActionRow checked={checked} correct={correct} onNext={onNext} nextLabel={nextLabel} />
      {checked && (
        <Feedback
          correct={correct}
          correctAnswer={item.options[item.correct]}
          explain={item.explain}
          lang={lang}
        />
      )}
    </>
  );

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      {script ? (
        // The question, its verdict and its feedback sit between the player and the transcript,
        // so the result is read without scrolling past the dialogue.
        <RecordingPlayer
          script={script}
          maxReplays={item.max_replays}
          revealed={checked && revealOnAnswer}
          lang={lang}
          budget={budget}
        >
          {task}
        </RecordingPlayer>
      ) : (
        task
      )}
    </div>
  );
}
