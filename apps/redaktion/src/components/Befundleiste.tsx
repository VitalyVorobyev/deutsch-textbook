/**
 * The defect strip: what is wrong on *this* screen, before the rows that are fine.
 *
 * THE THING THIS FIXES IS NOT VISUAL. `packages/content/src/profile.ts` computes thirteen named
 * defect classes and `PROBLEM_LABELS` gives every one of them a German label **and a `why`** — and
 * the first editorial app rendered all of it into a single `Lücken` route and nowhere else. So the
 * Fokus-Tags table printed a red `0` in its fifth column, one hundred and two times, and the reader
 * was left to notice which. A finding that has to be spotted is a finding the tool did not report.
 *
 * Each class here is a filter, not an alert. Clicking `18 ohne Probe` scopes the list beneath to
 * exactly those rows, which is the difference between being told something is wrong and being put
 * in front of it. The `why` rides along as the title, because the label alone
 * ("Fokus-Tag ohne Probe") says what is missing and never why it matters.
 *
 * Deliberately no total, no score and no ordering by severity. Thirteen classes measuring
 * incommensurable things do not sum to a number, and this repo has a standing rule against
 * inventing one — the strip ranks by count, which is a fact, and stops there.
 */
import { PROBLEM_LABELS } from '@da/content/profile';
import { Label } from '@da/ui/primitives';
import { Hinweis } from './Hinweis';

export interface Befund {
  kind: string;
  message: string;
  topic?: string;
  level?: string;
  file?: string;
}

export function Befundleiste({
  befunde,
  aktiv,
  onWaehlen,
  leer = 'keine Befunde',
}: {
  befunde: Befund[];
  /** The class currently scoping the list, or undefined for all of them. */
  aktiv?: string;
  onWaehlen: (kind: string | undefined) => void;
  leer?: string;
}) {
  const counts = new Map<string, number>();
  for (const b of befunde) counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  if (!ranked.length) {
    return (
      <div className="mb-6">
        <Label>Befunde</Label>
        <p className="mt-1.5 text-sm text-ok-ink">{leer}</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <Label>Befunde</Label>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {ranked.map(([kind, count]) => {
          const label = PROBLEM_LABELS[kind];
          const on = aktiv === kind;
          return (
            // A filter at rest is a control, not an alarm: the resting chip is neutral and only the
            // count carries the warn ink, so the strip reads as "here are your filters" rather than
            // as nine simultaneous alerts. Selected inverts, which is unambiguous.
            <Hinweis key={kind} inhalt={label?.why} fokussierbar={false}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onWaehlen(on ? undefined : kind)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
                  on
                    ? 'bg-warn text-white ring-warn'
                    : 'bg-surface-raised text-ink-muted ring-border-subtle hover:text-ink hover:ring-warn/50'
                }`}
              >
                <span className={`tabular font-semibold ${on ? '' : 'text-warn-ink'}`}>{count}</span>
                <span>{label?.de ?? kind}</span>
              </button>
            </Hinweis>
          );
        })}
        {aktiv ? (
          <button type="button" onClick={() => onWaehlen(undefined)} className="ml-1 text-xs text-ink-muted hover:text-ink">
            Filter aufheben
          </button>
        ) : null}
      </div>
    </div>
  );
}
