import { useEffect, useState } from 'react';
import { sessionDoneToday } from '../../lib/store';
import { useExplainLang } from '../hooks';

/** One quiet line inside the "Session starten" card once today's session is done. */
export default function SessionDoneBadge() {
  const lang = useExplainLang();
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
      ✓ <span lang="de">Heute schon erledigt</span>
      <span className="ml-1 font-normal text-amber-200">
        {lang === 'ru' ? '— можно повторить ещё раз' : '— repeating is always fine'}
      </span>
    </p>
  );
}
