import type { VisualDocument } from '../../lib/schemas';
import { withBase } from '../../lib/url';
import { pick } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  openFull: { en: 'Open document at full size', ru: 'Открыть документ крупно' },
  textVersion: { en: 'Text version of the document', ru: 'Текстовая версия документа' },
} as const satisfies Record<string, { en: string; ru: string }>;

export default function DocumentStimulus({ document }: { document: VisualDocument }) {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const description = pick(lang, document.description);
  return <figure className="rounded-lg border border-stone-300 bg-stone-50 p-3 dark:border-stone-600 dark:bg-stone-900/50">
    <figcaption className="mb-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-stone-400">{t('document.everyday', uiLang)} · {document.genre}</span>
      <strong lang="de" className="block">{document.title_de}</strong>
      <span className="text-sm text-stone-500">{description}</span>
    </figcaption>
    <a href={withBase(document.asset)} target="_blank" rel="noreferrer" className="block rounded border border-stone-200 bg-white p-2 focus-visible:outline-2 focus-visible:outline-amber-500 dark:border-stone-700 dark:bg-stone-950" aria-label={pick(lang, UI.openFull)}>
      <img src={withBase(document.asset)} alt={description} className="mx-auto h-auto max-h-[34rem] w-full object-contain" />
    </a>
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-300">{pick(lang, UI.textVersion)}</summary>
      <div lang="de" className="mt-2 space-y-1 border-l-2 border-stone-300 pl-3 dark:border-stone-600">
        {document.transcript.map((line, index) => <p key={index}>{line}</p>)}
      </div>
    </details>
  </figure>;
}

