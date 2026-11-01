/**
 * Deutsch-Atlas's domain primitives, on `@vitavision/ui` (ADR 0011).
 *
 * Generic controls are the system's: `Chip` is its `Badge`, `Button` its `Button`/`ButtonLink`,
 * `SearchBox` its `Input`, `Empty` its empty state, and `Filter` a native select in its control
 * style. What stays local is the vocabulary no generic library owns: a panel that carries its state
 * in a left rule, the callout that marks *the one thing to do* on a page, the stat with its hint,
 * the eyebrow label and the section heading with its count. All of them are written against the
 * system's tokens, so a theme retune reaches them too.
 *
 * Nothing here knows about learners, attempts or IndexedDB: a component that reads
 * `src/lib/store.ts` on mount is a learner-flow component and stays in the app that owns it.
 */
import type { ReactNode } from 'react';
import {
  Badge,
  Button as SystemButton,
  ButtonLink,
  Empty as SystemEmpty,
  Input,
  controlClasses,
  type Tone as BadgeTone,
} from '@vitavision/ui';

export type Tone = 'neutral' | 'brand' | 'ok' | 'info' | 'warn';

/** `leer` is a container for an absence: dashed, unfilled, and never coloured. */
export type PanelTone = Tone | 'leer';

/**
 * A chip is a LABEL, and a label is read, not obeyed: the system's `Badge`, whose ground is a
 * whisper and whose ring does the identifying. Deutsch-Atlas's tones map onto the system's verdict
 * vocabulary: brand and info are the one accent (the system's `info` tone), ok is `normal`, warn is
 * `defect`.
 */
const BADGE_TONE: Record<Tone, BadgeTone> = {
  neutral: 'neutral',
  brand: 'info',
  ok: 'normal',
  info: 'info',
  warn: 'defect',
};

export function Chip({
  tone = 'neutral',
  children,
  title,
  kurz = false,
}: {
  tone?: Tone;
  children: ReactNode;
  title?: string;
  /** At most two lines, cut with an ellipsis at the width its container allows: for a chip in a
      table cell, where a label wrapping freely inside its ring turns the row into a paragraph. */
  kurz?: boolean;
}) {
  return (
    <Badge
      tone={BADGE_TONE[tone]}
      className={kurz ? 'min-w-0 max-w-full' : undefined}
      {...(title ? { title } : {})}
    >
      {kurz ? <span className="line-clamp-2 break-words">{children}</span> : children}
    </Badge>
  );
}

/* ------------------------------------------------------------------ type scale */

/**
 * Three steps, because two headings that look identical are one heading.
 *
 * Every section title in the first editorial app was `text-sm font-medium text-fg` — the card
 * titles, the page's own `Elemente (7)`, and the group labels inside it. A reader scanning that
 * page has no way to tell which of them contains the others, and the fix is not more whitespace.
 */
export function Heading({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight text-fg">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-fg-muted">{sub}</p> : null}
    </header>
  );
}

/** A section of a page. `CurriculumPath.tsx:274` — `font-semibold` at body size, not a shrunken h1. */
export function Section({
  children,
  count,
  action,
}: {
  children: ReactNode;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 mt-10 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold text-fg">
        {children}
        {count === undefined ? null : (
          <span className="ml-1.5 tabular text-sm font-normal text-fg-muted">{count}</span>
        )}
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
  return (
    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-fg-muted">
      {children}
    </p>
  );
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
  neutral: 'border-line bg-surface',
  // An INSET SHADOW, not `border-l-<colour>`: that competes with `border-line` for
  // border-left-color at equal specificity, so which one won depended on Tailwind's utility order
  // — and it lost, silently, which is how the tone shipped invisible.
  brand: 'border-line bg-surface shadow-[inset_3px_0_0_var(--color-signal)]',
  ok: 'border-line bg-surface shadow-[inset_3px_0_0_var(--color-normal)]',
  info: 'border-line bg-surface shadow-[inset_3px_0_0_var(--color-signal)]',
  warn: 'border-line bg-surface shadow-[inset_3px_0_0_var(--color-defect)]',
  leer: 'border-dashed border-line',
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
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
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
    neutral: 'shadow-[inset_4px_0_0_var(--color-line)]',
    brand: 'shadow-[inset_4px_0_0_var(--color-signal)]',
    ok: 'shadow-[inset_4px_0_0_var(--color-normal)]',
    info: 'shadow-[inset_4px_0_0_var(--color-signal)]',
    warn: 'shadow-[inset_4px_0_0_var(--color-defect)]',
  };
  return (
    <section
      className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface p-5 pl-6 ${rule[tone]}`}
    >
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <Label>{eyebrow}</Label> : null}
        {title ? <h2 className="mt-1 text-lg font-semibold text-fg">{title}</h2> : null}
        {children ? <div className="mt-1 text-sm text-fg-muted">{children}</div> : null}
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
    neutral: 'text-fg',
    brand: 'text-signal',
    ok: 'text-normal',
    info: 'text-signal',
    warn: 'text-defect',
  };
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={`tabular mt-0.5 text-2xl font-semibold leading-none ${ink[tone]}`}>{value}</dd>
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </div>
  );
}

export function StatGroup({ children, columns = 3 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[
    columns
  ];
  return <dl className={`grid grid-cols-1 gap-5 ${cols}`}>{children}</dl>;
}

/**
 * A proportion, drawn. Deliberately without a "good" colour threshold: the caller passes the tone,
 * because whether 60 % is good depends on what is being measured and this component cannot know.
 */
export function Bar({
  value,
  max,
  tone = 'brand',
  label,
}: {
  value: number;
  max: number;
  tone?: Tone;
  label?: string;
}) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const fill: Record<Tone, string> = {
    neutral: 'bg-fg-subtle',
    brand: 'bg-signal',
    ok: 'bg-normal',
    info: 'bg-signal',
    warn: 'bg-defect',
  };
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-line">
        <div className={`h-full ${fill[tone]}`} style={{ width: `${percent}%` }} />
      </div>
      {label ? <span className="tabular text-xs text-fg-muted">{label}</span> : null}
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
    <Input
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
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
    <label className="flex items-center gap-1.5 text-xs text-fg-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | 'alle')}
        className={`${controlClasses} h-7 w-auto pr-7 text-xs`}
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
 * An action. Quiet by default (`secondary`); the system's `primary`, the one accent, when it is the
 * one thing to do.
 *
 * IT IS NEVER TONED BY THE THING IT ACTS ON, which is the mistake it exists to stop: the
 * Sprachkarte's "open in the findings inbox" button sat inside a warn `Callout`, on a warn ground,
 * wearing a warn border and warn text — three statements of the same alarm, one of them on a
 * control, where the reader has to decide whether red means *danger* or means *press me*. A callout
 * has already said what is wrong; its button only has to say what to do.
 *
 * `stark` is the accent, which means "you can act here" and is never a verdict colour, so it works
 * inside a callout of any tone.
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
  const variant = stark || pressed ? 'primary' : 'secondary';
  return href ? (
    <ButtonLink href={href} variant={variant}>
      {children}
    </ButtonLink>
  ) : (
    <SystemButton
      type="button"
      variant={variant}
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
    >
      {children}
    </SystemButton>
  );
}

/** An absence, said in a sentence: the system's empty state, in a dashed frame so it reads as a
    place where something would be rather than as a gap in the layout. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <SystemEmpty className="rounded-panel border border-dashed border-line py-6">
      {children}
    </SystemEmpty>
  );
}
