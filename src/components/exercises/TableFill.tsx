import { useState } from 'react';
import type { z } from 'zod';
import type { tableItemSchema } from '../../lib/schemas';
import { answerMatches } from '../../lib/cloze';
import { CheckButton, Feedback, Instruction, type ItemProps } from './shared';

type TableItem = z.infer<typeof tableItemSchema>;

export function TableFill({ item, lang, onResult, locked }: ItemProps<TableItem>) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const cellKey = (r: number, c: number) => `${r}:${c}`;
  const askedCells: Array<{ r: number; c: number; answer: string }> = [];
  item.rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      if (!cell.given) askedCells.push({ r, c, answer: cell.answer });
    }),
  );

  const cellOk = (r: number, c: number, answer: string) =>
    answerMatches(values[cellKey(r, c)] ?? '', [answer]);

  const allCorrect = askedCells.every(({ r, c, answer }) => cellOk(r, c, answer));
  const allFilled = askedCells.every(({ r, c }) => (values[cellKey(r, c)] ?? '').trim() !== '');

  function check() {
    if (checked || locked) return;
    setChecked(true);
    onResult({
      correct: allCorrect,
      given: askedCells.map(({ r, c }) => values[cellKey(r, c)] ?? '').join(' / '),
    });
  }

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      {item.title && <p lang="de" className="mb-2 font-medium">{item.title}</p>}
      <div className="overflow-x-auto">
        <table lang="de" className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-stone-300 bg-stone-100 px-3 py-1.5 text-left dark:border-stone-600 dark:bg-stone-800"></th>
              {item.columns.map((col) => (
                <th
                  key={col}
                  className="border border-stone-300 bg-stone-100 px-3 py-1.5 text-left font-semibold dark:border-stone-600 dark:bg-stone-800"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {item.rows.map((row, r) => (
              <tr key={row.label}>
                <td className="border border-stone-300 px-3 py-1.5 font-medium dark:border-stone-600">
                  {row.label}
                </td>
                {row.cells.map((cell, c) => (
                  <td key={c} className="border border-stone-300 px-2 py-1 dark:border-stone-600">
                    {cell.given ? (
                      <span className="px-1 text-stone-500 dark:text-stone-400">{cell.answer}</span>
                    ) : (
                      <input
                        type="text"
                        lang="de"
                        value={values[cellKey(r, c)] ?? ''}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [cellKey(r, c)]: e.target.value }))
                        }
                        disabled={checked}
                        className={`w-full min-w-20 rounded border-b-2 bg-transparent px-1 py-0.5 outline-none ${
                          checked
                            ? cellOk(r, c, cell.answer)
                              ? 'border-green-500 text-green-700 dark:text-green-400'
                              : 'border-red-500 text-red-700 dark:text-red-400'
                            : 'border-stone-300 focus:border-amber-500 dark:border-stone-600'
                        }`}
                        autoCapitalize="off"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!checked && <CheckButton onClick={check} disabled={!allFilled} />}
      {checked && (
        <Feedback
          correct={allCorrect}
          correctAnswer={
            allCorrect
              ? undefined
              : askedCells
                  .filter(({ r, c, answer }) => !cellOk(r, c, answer))
                  .map(({ answer }) => answer)
                  .join(', ')
          }
          explain={item.explain}
          lang={lang}
        />
      )}
    </div>
  );
}
