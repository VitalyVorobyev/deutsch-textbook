import { useEffect, useState } from 'react';
import { getExplainLang, type ExplainLang } from '../lib/prefs';

/** Current explanation language, kept in sync with the header toggle. */
export function useExplainLang(): ExplainLang {
  const [lang, setLang] = useState<ExplainLang>('en');
  useEffect(() => {
    setLang(getExplainLang());
    const handler = (e: Event) => setLang((e as CustomEvent<ExplainLang>).detail);
    window.addEventListener('da:langchange', handler);
    return () => window.removeEventListener('da:langchange', handler);
  }, []);
  return lang;
}
