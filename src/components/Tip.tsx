import type { ReactNode } from 'react';

/**
 * A hint that opens on hover, on keyboard focus and on tap.
 *
 * The native `title` attribute does none of the last two, and the desktop shell's webview
 * shows no `title` tooltip at all, so a figure explained only by one is unexplained there.
 * The text is in the DOM for a screen reader; the trigger is focusable so a tap opens it.
 */
export function Tip({
  text,
  className = '',
  align = 'right',
  children,
}: {
  text: string;
  className?: string;
  /** which edge of the trigger the bubble hangs from; pick the side with room */
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <span tabIndex={0} className={`group/tip relative cursor-help outline-none ${className}`}>
      <span className="rounded-sm group-focus-visible/tip:outline-2 group-focus-visible/tip:outline-amber-500">
        {children}
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-30 mt-1 hidden w-60 whitespace-normal rounded-md bg-stone-800 px-2.5 py-1.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg group-hover/tip:block group-focus/tip:block dark:bg-stone-100 dark:text-stone-900 ${align === 'right' ? 'right-0' : 'left-0'}`}
      >
        {text}
      </span>
    </span>
  );
}
