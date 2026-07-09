import { useMemo, useState } from 'react';
import type { z } from 'zod';
import type { clozeItemSchema } from '../../lib/schemas';
import { answerMatches, parseCloze } from '../../lib/cloze';
import { CheckButton, Feedback, Instruction, Translation, type ItemProps } from './shared';

type ClozeItem = z.infer<typeof clozeItemSchema>;

export function Cloze({ item, lang, onResult, locked }: ItemProps<ClozeItem>) {
  const parts = useMemo(() => parseCloze(item.text), [item]);
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

  let gapIndex = -1;
  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      <p lang="de" className="text-lg leading-loose">
        {parts.map((p, i) => {
          if (p.type === 'text') return <span key={i}>{p.value}</span>;
          gapIndex += 1;
          const gi = gapIndex;
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
              className={`mx-1 rounded border-b-2 bg-transparent px-1 text-center outline-none ${
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
      {!checked && <CheckButton onClick={check} disabled={values.some((v) => v.trim() === '')} />}
      {checked && (
        <Feedback
          correct={gapResults.every(Boolean)}
          correctAnswer={parts
            .filter((p) => p.type === 'gap')
            .map((p) => (p as { answers: string[] }).answers[0])
            .join(', ')}
          explain={item.explain}
          lang={lang}
        />
      )}
    </div>
  );
}
