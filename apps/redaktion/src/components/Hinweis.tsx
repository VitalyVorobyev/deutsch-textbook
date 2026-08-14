/**
 * The interactive primitives, on Radix — and the boundary that decides where they live.
 *
 * WHY NOT IN `@da/ui`. That package is imported by the learner app's React islands, so anything
 * added to it ships to a learner's browser. Redaktion is dev-only (`apply: 'serve'`, never built,
 * never deployed), so a dependency here costs nothing anyone downloads. `@da/ui` keeps the
 * presentational primitives with zero dependencies; the ones that need real interaction behaviour
 * live here.
 *
 * WHY RADIX RATHER THAN THE HAND-ROLLED VERSIONS.
 *
 *   **Tooltip.** This app had **36 `title=` attributes** carrying the load-bearing half of its
 *   explanations — every finding's `why`, every density square's structure name, every truncated
 *   cell. `title` is the worst possible delivery for that: it never appears on touch, never appears
 *   for a keyboard user, waits about a second, and is truncated by the OS. So the text that says
 *   *why a defect matters* was effectively invisible to half the ways of reading the page.
 *
 *   **Tabs.** The hand-rolled version was a `role="tablist"` of buttons: correct roles, no arrow-key
 *   navigation, and no `aria-controls` tying a tab to its panel. Roving tabindex is exactly the
 *   thing not to write twice.
 *
 * `Filter` deliberately stays a native `<select>`. Radix Select would be a regression there — it
 * gives up the platform's own mobile picker and keyboard type-ahead to gain styling this app does
 * not need.
 */
import * as RadixTooltip from '@radix-ui/react-tooltip';
import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';

/** One provider at the root; `delayDuration` is short because these are reference, not discovery. */
export function HinweisProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={250} skipDelayDuration={400}>
      {children}
    </RadixTooltip.Provider>
  );
}

/**
 * A tooltip that a keyboard reaches and a screen reader announces.
 *
 * `asChild` means the trigger *is* the element you pass, so this adds no wrapper to a table cell.
 * Anything not already focusable gets `tabIndex={0}`, because a tooltip on an unfocusable element
 * is a tooltip with no keyboard path to it.
 */
export function Hinweis({
  inhalt,
  children,
  fokussierbar = true,
}: {
  inhalt: ReactNode;
  children: ReactNode;
  /** false when the child is already a button or a link. */
  fokussierbar?: boolean;
}) {
  if (!inhalt) return <>{children}</>;
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild {...(fokussierbar ? { tabIndex: 0 } : {})}>
        {children}
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-xs rounded-md border border-border-subtle bg-surface-raised px-2.5 py-1.5 text-xs leading-snug text-ink shadow-lg"
        >
          {inhalt}
          <RadixTooltip.Arrow className="fill-[var(--color-border-subtle)]" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

/**
 * Switching what a page shows without leaving it. Same visual treatment as the learner app's
 * segmented control (`CurriculumPath.tsx:230`), with the keyboard behaviour Radix brings.
 */
export function Reiter<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  children,
}: {
  value: T;
  options: readonly { id: T; label: ReactNode; count?: number }[];
  onChange: (next: T) => void;
  ariaLabel: string;
  /** `RadixTabs.Content` panels, when the caller wants Radix to own the switching too. */
  children?: ReactNode;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={(next) => onChange(next as T)}>
      <RadixTabs.List
        aria-label={ariaLabel}
        // WRAPS. `Bestand` has eight tabs and at 1024 px the eighth ("Wortnetze") was clipped by
        // the container's right edge — silently, because an `inline-flex` row neither scrolls nor
        // reflows, it just ends. A tab the reader cannot see is a kind of material the index does
        // not appear to hold.
        className="flex w-fit max-w-full flex-wrap rounded-md border border-border-subtle p-0.5 text-sm"
      >
        {options.map((option) => (
          <RadixTabs.Trigger
            key={option.id}
            value={option.id}
            className="rounded px-3 py-1 font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-brand data-[state=active]:bg-ink data-[state=active]:text-surface-raised"
          >
            {option.label}
            {option.count === undefined ? null : (
              <span className="tabular ml-1.5 text-xs opacity-70">{option.count}</span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}
