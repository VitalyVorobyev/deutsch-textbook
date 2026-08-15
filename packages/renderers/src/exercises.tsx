import type { ReactNode } from 'react';
import type { ContentLanguage } from '@da/content/preview';

type Row = Record<string, unknown>;

const asRows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((item): item is Row => !!item && typeof item === 'object') : [];
const text = (value: unknown): string => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2);
const local = (value: unknown, language: ContentLanguage): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return text(value);
  const row = value as Row;
  return text(row[language] ?? row.en ?? row.ru ?? row.uk ?? row.de);
};

function prompt(item: Row, language: ContentLanguage): ReactNode {
  const direct = item[`prompt_${language}`] ?? item.prompt ?? item.text ?? item.instruction;
  if (item.type === 'cloze' && typeof item.text === 'string')
    return item.text.replace(/\{\{([^}|]+)(?:\|[^}]*)?\}\}/g, '▢');
  if (item.type === 'mc') return text(direct);
  if (item.type === 'match') return `Paare: ${asRows(item.pairs).length}`;
  if (item.type === 'order') return text(item.tokens ?? direct);
  if (item.type === 'table') return local(item.instruction, language) || 'Tabelle ausfüllen';
  if (item.type === 'form') return local(item.instruction, language) || 'Formular ausfüllen';
  return local(direct, language);
}

function answers(item: Row, language: ContentLanguage): string[] {
  const result: string[] = [];
  if (typeof item.answer === 'string') result.push(item.answer);
  for (const candidate of asRows(item.choices)) if (candidate.correct) result.push(text(candidate.text ?? candidate.label ?? candidate.value));
  if (Array.isArray(item.answers)) result.push(...item.answers.map(text));
  if (Array.isArray(item.accept)) result.push(...item.accept.map(text));
  if (Array.isArray(item.model_answers)) result.push(...item.model_answers.map(text));
  if (item.model_answer) result.push(local(item.model_answer, language));
  if (typeof item.text === 'string' && item.type === 'cloze') {
    for (const match of item.text.matchAll(/\{\{([^}]+)\}\}/g)) result.push(match[1]!.split('|').join(' / '));
  }
  return [...new Set(result.filter(Boolean))];
}

export function ExerciseSetPreview({ value, language }: { value: Row; language: ContentLanguage }) {
  const items = asRows(value.items);
  return (
    <div className="atlas-exercise-preview">
      <header>
        <p>{local(value.title, language) || text(value.id) || 'Aufgabensatz'}</p>
        <span>{text(value.role)}{value.stage ? ` · ${text(value.stage)}` : ''}{value.activity ? ` · ${text(value.activity)}` : ''}</span>
      </header>
      <ol>
        {items.map((item, index) => {
          const models = answers(item, language);
          return (
            <li key={text(item.id) || String(index)}>
              <div className="atlas-exercise-preview__meta"><strong>{index + 1}. {text(item.type)}</strong><span>{text(item.id)}</span></div>
              <p className="atlas-exercise-preview__prompt">{prompt(item, language)}</p>
              {models.length ? <div className="atlas-exercise-preview__answer"><span>Modell / akzeptiert</span><ul>{models.map((answer) => <li key={answer} lang="de">{answer}</li>)}</ul></div> : null}
              {item.explain ? <p className="atlas-exercise-preview__explain"><strong>Erklärung:</strong> {local(item.explain, language)}</p> : null}
              <div className="atlas-exercise-preview__tags">
                {item.focus ? <span>Fokus: {text(item.focus)}</span> : null}
                {Array.isArray(item.outcomes) ? <span>Outcomes: {item.outcomes.map(text).join(' · ')}</span> : null}
                {Array.isArray(item.key_tokens) ? <span>Key tokens: {item.key_tokens.map(text).join(' · ') || '—'}</span> : null}
                {item.revision !== undefined ? <span>Revision {text(item.revision)}</span> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
