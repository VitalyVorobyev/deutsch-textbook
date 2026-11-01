/**
 * Editorial previews of a reading text and a vocabulary deck: the material as the learner meets
 * it, with what the learner has to click for (glosses, translations) laid open for the reviewer.
 */
import { parseGlosses } from '@da/schema/gloss';
import type { ContentLanguage } from '@da/content/preview';
import { ExerciseSetPreview } from './exercises';

type Row = Record<string, unknown>;

const rows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((item): item is Row => !!item && typeof item === 'object')
    : [];
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
/** A translation in the reader's language; a German reader gets English, as in the app. */
const translated = (row: Row, field: string, language: ContentLanguage): string =>
  str(row[`${field}${language === 'de' ? 'en' : language}`]) || str(row[`${field}en`]);

function Paragraph({ text, language }: { text: string; language: ContentLanguage }) {
  const { segments } = parseGlosses(text);
  return (
    <p lang="de" className="text-[0.95rem] leading-7 text-fg">
      {segments.map((segment, index) =>
        segment.kind === 'text' ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span key={index}>
            <span className="underline decoration-signal/60 decoration-dotted underline-offset-4">
              {segment.gloss.de}
            </span>
            <span lang={language === 'de' ? 'en' : language} className="ml-1 text-xs text-signal">
              ({(language !== 'de' && segment.gloss[language]) || segment.gloss.en})
            </span>
          </span>
        ),
      )}
    </p>
  );
}

export function ReadingPreview({ value, language }: { value: Row; language: ContentLanguage }) {
  const paragraphs = Array.isArray(value.text)
    ? value.text.filter((p) => typeof p === 'string')
    : [];
  const questions = rows(value.questions);
  return (
    <article className="space-y-5">
      <header className="border-b border-line pb-3">
        <h2 lang="de" className="font-serif text-xl font-semibold text-fg">
          {str(value.title_de)}
        </h2>
        <p className="mt-1 text-xs text-fg-muted">
          {str(value.kind) || 'intensive'} · {paragraphs.length} Absätze
        </p>
      </header>
      <div className="space-y-4">
        {paragraphs.map((paragraph, index) => (
          <Paragraph key={index} text={paragraph} language={language} />
        ))}
      </div>
      {value.attribution ? (
        <p className="text-xs text-fg-muted">
          {str(value.attribution)} · {str(value.license)}
        </p>
      ) : null}
      {questions.length ? (
        <ExerciseSetPreview
          value={{ title: { de: 'Fragen zum Text' }, role: 'Lesefragen', items: questions }}
          language={language}
        />
      ) : null}
    </article>
  );
}

const GENDER: Record<string, string> = { m: 'der', f: 'die', n: 'das' };

export function VocabPreview({ value, language }: { value: Row; language: ContentLanguage }) {
  const entries = rows(value.entries);
  return (
    <article className="space-y-4">
      <header className="border-b border-line pb-3">
        <h2 lang="de" className="font-serif text-xl font-semibold text-fg">
          {str(value.title_de)}
        </h2>
        <p className="mt-1 text-xs text-fg-muted">
          {str(value.level)} · {entries.length} Einträge
        </p>
      </header>
      <ol className="divide-y divide-line">
        {entries.map((entry, index) => {
          const forms = [
            str(entry.plural) && `Pl. ${str(entry.plural)}`,
            str(entry.praesens_3sg),
            str(entry.partizip2) && `${str(entry.aux) || 'hat'} ${str(entry.partizip2)}`,
            str(entry.valence),
          ].filter(Boolean);
          return (
            <li
              key={`${str(entry.de)}-${index}`}
              className="grid gap-1 py-2.5 sm:grid-cols-[14rem_1fr]"
            >
              <div>
                <p lang="de" className="font-semibold text-fg">
                  {GENDER[str(entry.gender)] ? (
                    <span className="mr-1 font-normal text-fg-muted">
                      {GENDER[str(entry.gender)]}
                    </span>
                  ) : null}
                  {str(entry.de)}
                </p>
                <p className="text-xs text-fg-muted">
                  {[str(entry.pos), ...forms].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-fg">{translated(entry, '', language)}</p>
                <p lang="de" className="mt-1 text-sm italic text-fg">
                  {str(entry.example_de)}
                </p>
                <p className="text-xs text-fg-muted">{translated(entry, 'example_', language)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
