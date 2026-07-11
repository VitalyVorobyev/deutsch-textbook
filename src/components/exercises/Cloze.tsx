import { useMemo, useState } from 'react';
import type { z } from 'zod';
import type { clozeItemSchema } from '../../lib/schemas';
import { answerMatches, parseCloze } from '../../lib/cloze';
import { ActionRow, Feedback, Instruction, Translation, type ItemProps } from './shared';

type ClozeItem = z.infer<typeof clozeItemSchema>;

export function Cloze({ item, lang, onResult, locked, onNext, nextLabel }: ItemProps<ClozeItem>) {
  const parts = useMemo(() => parseCloze(item.text), [item]);
  // part index → gap ordinal (-1 for text parts), so render needs no mutable counter
  const gapNumbers = useMemo(() => {
    let g = 0;
    return parts.map((p) => (p.type === 'gap' ? g++ : -1));
  }, [parts]);
  const gapCount = parts.filter((p) => p.type === 'gap').length;
  const [values, setValues] = useState<string[]>(() => Array(gapCount).fill(''));
  const [checked, setChecked] = useState(false);

  const gapResults = useMemo(() => {
    let gi = 0;
    return parts
      .filter((p) => p.type === 'gap')
      .map((p) => answerMatches(values[gi++] ?? '', (p as { answers: string[] }).answers));
  }, [parts, values]);

  function check() {
    if (checked || locked) return;
    setChecked(true);
    onResult({ correct: gapResults.every(Boolean), given: values.join(' / ') });
  }

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      <p lang="de" className="text-lg leading-loose">
        {parts.map((p, i) => {
          if (p.type === 'text') return <span key={i}>{p.value}</span>;
          const gi = gapNumbers[i]!;
          const ok = gapResults[gi];
          const width = Math.max(4, p.answers[0]!.length + 2);
          return (
            <input
              key={i}
              type="text"
              lang="de"
              value={values[gi] ?? ''}
              onChange={(e) => setValues((v) => v.map((x, j) => (j === gi ? e.target.value : x)))}
              onKeyDown={(e) => e.key === 'Enter' && check()}
              disabled={checked}
              style={{ width: `${width}ch` }}
              className={`mx-1 min-h-10 rounded border-b-2 bg-transparent px-1 text-center outline-none sm:min-h-0 ${
                checked
                  ? ok
                    ? 'border-green-500 text-green-700 dark:text-green-400'
                    : 'border-red-500 text-red-700 dark:text-red-400'
                  : 'border-stone-400 focus:border-amber-500'
              }`}
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
            />
          );
        })}
      </p>
      <Translation text={item.translation} lang={lang} />
      <ActionRow
        checked={checked}
        correct={gapResults.every(Boolean)}
        onCheck={check}
        checkDisabled={values.some((v) => v.trim() === '')}
        onNext={onNext}
        nextLabel={nextLabel}
      />
      {checked && (
        <Feedback
          correct={gapResults.every(Boolean)}
          correctAnswer={parts
            .filter((p) => p.type === 'gap')
            .map((p) => (p as { answers: string[] }).answers[0])
            .join(', ')}
          explain={item.explain}
          lang={lang}
          speakText={parts
            .map((p) => (p.type === 'text' ? p.value : p.answers[0]))
            .join('')}
        />
      )}
    </div>
  );
}
