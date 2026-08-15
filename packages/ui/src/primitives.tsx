/**
 * The primitives both apps can use.
 *
 * Seeded from what already existed and was genuinely generic — the `Filter<T>` select at the foot
 * of `atlas/TopicDetail.tsx`, the four-state pill in `topic/TierBadge.tsx`, the chip row in
 * `topic/EvidenceChips.tsx`, and the `CARD` / `PRIMARY_BUTTON` / `QUIET_BUTTON` class-string
 * constants in `pruefung/shared.tsx`, which are what a design system looks like just before someone
 * writes one. Nothing here knows about learners, attempts or IndexedDB: a component that reads
 * `src/lib/store.ts` on mount is a learner-flow component and stays in the app that owns it.
 *
 * WHAT THE FIRST VERSION GOT WRONG, AND WHY IT MATTERED. It shipped `Table`, `Card`, `Chip`,
 * `Heading`, `Bar`, `SearchBox`, `Filter` and `Empty` — and the editorial app was then assembled
 * from the only three shapes available, nine times over, until its author called it "a useless set
 * of tables, not a modern working tool". He was right, and the cause was here rather than there:
 * a package that holds one container and one heading level can only produce pages that are one
 * container and one heading level. Blame the instrument first.
 *
 * So the second version lifts the learner app's **actual** vocabulary, which was never colour. It
 * is the amber left rule that means *this is the thing*; sections that carry their state in their
 * border; a segmented control for switching a view in place; and a type scale with more than one
 * step in it. Every entry below cites where it already exists, because a "shared primitive" nobody
 * shares is just a second implementation with better manners.
 */
import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'brand' | 'ok' | 'info' | 'warn';

/** `leer` is a container for an absence: dashed, unfilled, and never coloured. */
export type PanelTone = Tone | 'leer';

/*
 * A chip is a LABEL, and a label is read, not obeyed.
 *
 * The first version filled every tone at full strength and coloured the text with the fill colour
 * — `bg-warn-soft text-warn-ink` — putting rose-600 on a rose tint at 12 px. Measured: 3.72:1 on the
 * dark page, under the 4.5 floor. And because every one of the forty-nine topics carries at least
 * one finding, that treatment was on for the whole page: a screen where everything is an alarm has
 * no alarms.
 *
 * So the ground is a whisper, the ring does the identifying, and the text uses the `-ink` half of
 * the role — the half measured against the surface it actually sits on.
 */
const TONE_CHIP: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted ring-border-subtle',
  brand: 'bg-brand-soft text-brand-ink ring-brand/25',
  ok: 'bg-ok-soft text-ok-ink ring-ok/25',
  info: 'bg-info-soft text-info-ink ring-info/25',
  warn: 'bg-warn-soft text-warn-ink ring-warn/25',
};

export function Chip({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${TONE_CHIP[tone]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ type scale */

/**
 * Three steps, because two headings that look identical are one heading.
 *
 * Every section title in the first editorial app was `text-sm font-medium text-ink` — the card
 * titles, the page's own `Elemente (7)`, and the group labels inside it. A reader scanning that
 * page has no way to tell which of them contains the others, and the fix is not more whitespace.
 */
export function Heading({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-ink-muted">{sub}</p> : null}
    </header>
  );
}

/** A section of a page. `CurriculumPath.tsx:274` — `font-semibold` at body size, not a shrunken h1. */
export function Section({ children, count, action }: { children: ReactNode; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-10 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold text-ink">
        {children}
        {count === undefined ? null : <span className="ml-1.5 tabular text-sm font-normal text-ink-muted">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

/**
 * The eyebrow. `CurriculumPath.tsx:357` uses it for strand names above a card grid, and it is the
 * one label style that reads as structural rather than as content.
 */
export function Label({ children }: { children: ReactNode }) {
  return <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">{children}</p>;
}

/* ------------------------------------------------------------------ containers */

/*
 * Tone is carried by a 2 px left rule, not by a tint.
 *
 * Tinting the whole card was the chips' mistake at a larger size: with forty-nine cards on a page
 * and most of them in one state, a coloured ground reads as a page-wide wash rather than a signal.
 * The rule is the learner app's own device (`border-l-4` on the next-step section,
 * `CurriculumPath.tsx:250`) at half weight, and it leaves every card's ground identical so the
 * CONTENT is what differs.
 */
const PANEL_TONE: Record<PanelTone, string> = {
  neutral: 'border-border-subtle bg-surface-raised',
  // An INSET SHADOW, not `border-l-<colour>`: that competes with `border-border-subtle` for
  // border-left-color at equal specificity, so which one won depended on Tailwind's utility order
  // — and it lost, silently, which is how the tone shipped invisible.
  brand: 'border-border-subtle bg-surface-raised shadow-[inset_3px_0_0_var(--color-brand)]',
  ok: 'border-border-subtle bg-surface-raised shadow-[inset_3px_0_0_var(--color-ok)]',
  info: 'border-border-subtle bg-surface-raised shadow-[inset_3px_0_0_var(--color-info)]',
  warn: 'border-border-subtle bg-surface-raised shadow-[inset_3px_0_0_var(--color-warn)]',
  leer: 'border-dashed border-border-subtle',
};

/**
 * A section that carries its own state.
 *
 * The learner app has had this for as long as it has had a curriculum path: an emerald-bordered
 * section means the checkpoint is passed (`CurriculumPath.tsx:272`), a dashed one means it is
 * waiting (`:295`), a plain one is neutral (`:257`). Reading state off a border costs the reader
 * nothing, which is why it survives in a view holding forty-nine of them.
 */
export function Panel({
  tone = 'neutral',
  title,
  action,
  children,
  className = '',
}: {
  tone?: PanelTone;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border p-5 ${PANEL_TONE[tone]} ${className}`}>
      {title ? (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Kept for callers that want a container and no state. `Panel` with no tone is the same thing. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Panel className={className}>{children}</Panel>;
}

/**
 * The left rule. This is the learner app's single most recognisable device — every "do this next",
 * every "continue where you left off", every "the checkpoint is ready" is
 * `border-l-4 border-amber-500 bg-amber-50` (`CurriculumPath.tsx:250,306,314`). It appears at most
 * once per screen, which is the whole reason it works.
 */
export function Callout({
  tone = 'brand',
  eyebrow,
  title,
  action,
  children,
}: {
  tone?: Tone;
  eyebrow?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  /*
   * THE RULE CARRIES THE TONE; THE GROUND DOES NOT. The learner app tints the whole block, and that
   * works there because the block is small and the page is warm and light. Here the callout runs
   * the full 1184 px content width, and a 14 % rose over a cool slate ground mixes to plum: measured
   * `oklab(0.645 0.236 0.070 / 0.14)`, which is a large purple slab wearing a red stripe. Dose, not
   * hue, was the error — the same mistake as the forty-nine tinted cards, at one-per-page scale.
   */
  // Inset shadow rather than `border-l-<colour>`, for the reason PANEL_TONE records: the two
  // border-colour utilities collide at equal specificity and the winner depends on utility order.
  const rule: Record<Tone, string> = {
    neutral: 'shadow-[inset_4px_0_0_var(--color-border-subtle)]',
    brand: 'shadow-[inset_4px_0_0_var(--color-brand)]',
    ok: 'shadow-[inset_4px_0_0_var(--color-ok)]',
    info: 'shadow-[inset_4px_0_0_var(--color-info)]',
    warn: 'shadow-[inset_4px_0_0_var(--color-warn)]',
  };
  return (
    <section
      className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface-raised p-5 pl-6 ${rule[tone]}`}
    >
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <Label>{eyebrow}</Label> : null}
        {title ? <h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2> : null}
        {children ? <div className="mt-1 text-sm text-ink-muted">{children}</div> : null}
      </div>
      {action}
    </section>
  );
}

/* ------------------------------------------------------------------ figures */

/**
 * One figure and what it means. `ProgressPanel.tsx:371,405` builds these by hand out of a `<dl>`;
 * so did three of the editorial views, each with its own idea of how big the number should be.
 */
export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  const ink: Record<Tone, string> = {
    neutral: 'text-ink',
    brand: 'text-brand-ink',
    ok: 'text-ok-ink',
    info: 'text-info-ink',
    warn: 'text-warn-ink',
  };
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`tabular mt-0.5 text-2xl font-semibold leading-none ${ink[tone]}`}>{value}</dd>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function StatGroup({ children, columns = 3 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[columns];
  return <dl className={`grid grid-cols-1 gap-5 ${cols}`}>{children}</dl>;
}

/**
 * A proportion, drawn. Deliberately without a "good" colour threshold: the caller passes the tone,
 * because whether 60 % is good depends on what is being measured and this component cannot know.
 */
export function Bar({ value, max, tone = 'brand', label }: { value: number; max: number; tone?: Tone; label?: string }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const fill: Record<Tone, string> = {
    neutral: 'bg-stone-400',
    brand: 'bg-brand',
    ok: 'bg-ok',
    info: 'bg-info',
    warn: 'bg-warn',
  };
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-border-subtle">
        <div className={`h-full ${fill[tone]}`} style={{ width: `${percent}%` }} />
      </div>
      {label ? <span className="tabular text-xs text-ink-muted">{label}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ controls */

export function SearchBox({
  value,
  onChange,
  placeholder = 'Suchen …',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
    />
  );
}

export function Filter<T extends string>({
  label,
  value,
  options,
  onChange,
  labels,
}: {
  label: string;
  value: T | 'alle';
  options: readonly T[];
  onChange: (next: T | 'alle') => void;
  labels?: Record<string, string>;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | 'alle')}
        className="rounded-md border border-border-subtle bg-surface-raised px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
      >
        <option value="alle">alle</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * An action. Quiet by default, inverted when it is the one thing to do.
 *
 * IT IS NEVER TONED BY THE THING IT ACTS ON, which is the mistake it exists to stop: the
 * Sprachkarte's "open in the findings inbox" button sat inside a warn `Callout`, on a warn ground,
 * wearing a warn border and warn text — three statements of the same alarm, one of them on a
 * control, where the reader has to decide whether red means *danger* or means *press me*. A callout
 * has already said what is wrong; its button only has to say what to do.
 *
 * `stark` inverts to the ink colour: unmissable, and no role hue at all, so it works inside a
 * callout of any tone.
 */
export function Button({
  href,
  onClick,
  stark = false,
  pressed,
  disabled = false,
  children,
}: {
  href?: string;
  onClick?: () => void;
  stark?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const className = `inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45 ${
    stark || pressed
      ? 'bg-ink text-surface hover:opacity-90'
      : 'border border-border-subtle bg-surface-raised text-ink hover:border-ink-muted'
  }`;
  return href ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} aria-pressed={pressed} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border-subtle px-3 py-6 text-center text-sm text-ink-muted">
      {children}
    </p>
  );
}
