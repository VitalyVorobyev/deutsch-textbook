/**
 * The interactive primitives, on `@vitavision/ui` (ADR 0011): a tooltip a keyboard reaches, and a
 * tab strip with arrow-key navigation.
 *
 * WHY TOOLTIPS AT ALL. This app once carried 36 `title=` attributes holding the load-bearing half
 * of its explanations: every finding's `why`, every density square's structure name, every
 * truncated cell. `title` never appears on touch or for a keyboard user and is truncated by the
 * OS, so the text that says *why a defect matters* was invisible to half the ways of reading the
 * page. The system's `Tooltip` is Radix underneath and needs the one `TooltipProvider` in main.tsx.
 *
 * `Filter` deliberately stays a native `<select>`: a custom select gives up the platform's mobile
 * picker and keyboard type-ahead to gain styling this app does not need.
 */
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Tabs, Tooltip } from '@vitavision/ui';

/**
 * A tooltip that a keyboard reaches and a screen reader announces.
 *
 * The trigger *is* the element you pass, so this adds no wrapper to a table cell. Anything not
 * already focusable gets `tabIndex={0}`, because a tooltip on an unfocusable element is a tooltip
 * with no keyboard path to it.
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
  const trigger =
    fokussierbar && isValidElement(children)
      ? cloneElement(children as ReactElement<{ tabIndex?: number }>, { tabIndex: 0 })
      : children;
  return <Tooltip content={inhalt}>{trigger}</Tooltip>;
}

/**
 * Switching what a page shows without leaving it: the system's tab strip, which wraps rather than
 * clipping a ninth tab at 1024 px, and carries each count in mono beside its label.
 */
export function Reiter<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly { id: T; label: string; count?: number }[];
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <Tabs
      items={options.map((option) => ({
        id: option.id,
        label: option.label,
        ...(option.count === undefined ? {} : { count: option.count }),
      }))}
      active={value}
      onSelect={onChange}
      label={ariaLabel}
    />
  );
}
