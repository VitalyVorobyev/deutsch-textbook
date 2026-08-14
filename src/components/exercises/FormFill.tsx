import { useState } from 'react';
import type { z } from 'zod';
import type { formItemSchema } from '@da/schema';
import { answerMatches } from '@da/grading/cloze';
import { ActionRow, Feedback, Instruction, type ItemProps } from './shared';

type FormItem = z.infer<typeof formItemSchema>;

export function FormFill({ item, lang, onResult, locked, onNext, nextLabel }: ItemProps<FormItem>) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const asked = item.fields.filter((field) => !field.given);
  const ok = (field: FormItem['fields'][number]) =>
    answerMatches(values[field.id] ?? '', [field.answer, ...field.accept]);
  const correctParts = asked.filter(ok).length;
  const allCorrect = correctParts === asked.length;
  const allFilled = asked.every((field) => (values[field.id] ?? '').trim().length > 0);

  function check() {
    if (checked || locked || !allFilled) return;
    setChecked(true);
    onResult({
      correct: allCorrect,
      correctParts,
      totalParts: asked.length,
      given: asked.map((field) => `${field.id}=${values[field.id] ?? ''}`).join(' / '),
    });
  }

  return <div>
    <Instruction text={item.instruction} lang={lang} />
    {item.title && <h3 lang="de" className="mb-3 font-semibold">{item.title}</h3>}
    <div lang="de" className="mb-4 rounded-md border-l-4 border-sky-500 bg-sky-50 p-3 text-sm dark:bg-sky-950/30">
      {item.source.map((line) => <p key={line}>{line}</p>)}
    </div>
    <div lang="de" className="space-y-3 rounded-lg border border-stone-300 bg-stone-50 p-4 dark:border-stone-600 dark:bg-stone-900/40">
      {item.fields.map((field) => <label key={field.id} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-center">
        <span className="text-sm font-medium">{field.label}</span>
        {field.given ? <span className="text-sm text-stone-600 dark:text-stone-300">{field.answer}</span> : <input
          type="text"
          lang="de"
          value={values[field.id] ?? ''}
          onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
          disabled={checked || locked}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className={`min-h-11 rounded-md border bg-white px-3 py-2 outline-none dark:bg-stone-800 ${checked ? ok(field) ? 'border-green-500' : 'border-red-500' : 'border-stone-300 focus:border-amber-500 dark:border-stone-600'}`}
        />}
      </label>)}
    </div>
    <ActionRow checked={checked} correct={allCorrect} onCheck={check} checkDisabled={!allFilled} onNext={onNext} nextLabel={nextLabel} />
    {checked && <Feedback
      correct={allCorrect}
      correctAnswer={allCorrect ? undefined : asked.filter((field) => !ok(field)).map((field) => `${field.label}: ${field.answer}`).join(' · ')}
      explain={item.explain}
      lang={lang}
    />}
  </div>;
}
