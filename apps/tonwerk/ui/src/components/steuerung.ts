/**
 * The class strings of Tonwerk's native controls, built on the system's `controlClasses` so a
 * text field, a number, a choice and the German being typed all share one border, focus ring and
 * disabled state with every `@vitavision` control.
 *
 * Native elements on purpose: a `<select>` is a value the keyboard can type into, a number field
 * keeps an empty string apart from zero (`end_ms: null` against `0`), and both are what the specs
 * drive. What differs between them is the face — `DESIGN.md`'s rule that an id, a seed or a gain is
 * apparatus and set in mono, while the German being manufactured is set in the script face.
 */
import { cn, controlClasses } from '@vitavision/ui';

/** An id, a path, a seed: apparatus, in mono. */
export const FELD = cn(controlClasses, 'h-8 font-mono text-[13px]');

/** A number: mono, with the unit printed on the legend. */
export const ZAHL_FELD = FELD;

/** The German being manufactured: the script face, a reading size, and it may be resized. */
export const SKRIPT_FELD = cn(controlClasses, 'resize-y py-2 font-skript text-base leading-normal');

/** A choice among named options. */
export const WAHL = cn(controlClasses, 'h-8 w-auto cursor-pointer pr-7');
