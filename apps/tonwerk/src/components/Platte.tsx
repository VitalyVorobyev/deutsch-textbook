/**
 * Platte — a rack unit. One panel, with its legend silkscreened on the top rule.
 *
 * `zaehler` is on the header rather than inside the body because a panel whose count is the first
 * thing you need (how many exercises have no recording?) should not make you read its contents to
 * find out.
 */
import type { ReactNode } from 'react';

export interface PlatteProps {
  /** The legend. Rendered in the apparatus face, so keep it short and nominal. */
  titel: string;
  /** A figure the legend earns: a row count, a duration, a verdict. */
  zaehler?: ReactNode;
  /** One sentence under the legend, when the panel's job is not obvious from its name. */
  erklaerung?: string;
  /** `true` when the body owns its own padding — tables and lists do. */
  randlos?: boolean;
  children: ReactNode;
}

export function Platte({ titel, zaehler, erklaerung, randlos, children }: PlatteProps): React.JSX.Element {
  return (
    <section className="platte">
      <header className="platte-kopf">
        <div>
          <h2 className="tafel">{titel}</h2>
          {erklaerung ? (
            <p className="entfernt" style={{ fontSize: 'var(--ton-grad-12)', marginTop: 'var(--ton-mass-1)', maxWidth: '62ch' }}>
              {erklaerung}
            </p>
          ) : null}
        </div>
        {zaehler === undefined ? null : <span className="zahl leise">{zaehler}</span>}
      </header>
      <div className={randlos ? 'platte-leib-eng' : 'platte-leib'}>{children}</div>
    </section>
  );
}

/** The three things a read can be doing, said in one place so no view invents its own wording. */
export function Zustand({ art, text }: { art: 'laedt' | 'leer' | 'fehler'; text: string }): React.JSX.Element {
  return (
    <p className="zustand" data-art={art} role={art === 'fehler' ? 'alert' : undefined}>
      {text}
    </p>
  );
}

/** A small fact attached to a row: a flag, a kind, a count. */
export function Marke({
  ton = 'ruhig',
  titel,
  children,
}: {
  ton?: 'ruhig' | 'messung' | 'signal' | 'alarm';
  titel?: string;
  children: ReactNode;
}): React.JSX.Element {
  const klasse = ton === 'ruhig' ? 'marke' : `marke marke-${ton}`;
  return (
    <span className={klasse} title={titel}>
      {children}
    </span>
  );
}
