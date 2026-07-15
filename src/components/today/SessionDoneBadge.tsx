import { useEffect, useState } from 'react';
import { sessionDoneToday } from '../../lib/store';
import { pick } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  repeatFine: { en: '— repeating is always fine', ru: '— можно повторить ещё раз' },
} as const satisfies Record<string, { en: string; ru: string }>;

/** One quiet line inside the "Session starten" card once today's session is done. */
export default function SessionDoneBadge() {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void sessionDoneToday().then((d) => {
      if (!cancelled) setDone(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!done) return null;
  return (
    <p className="mt-2 text-sm font-semibold text-amber-100">
      ✓ <span lang={uiLang}>{t('session.doneToday', uiLang)}</span>
      <span className="ml-1 font-normal text-amber-200">
        {pick(lang, UI.repeatFine)}
      </span>
    </p>
  );
}
