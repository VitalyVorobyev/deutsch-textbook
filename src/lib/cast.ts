/**
 * The cast's portraits, by the name a speaker label uses (ADR 0016, ADR 0021).
 *
 * A portrait tells speakers apart, so it is shown wherever a cast member is named as a speaker:
 * the lines of a listening transcript and the options of a "Wer sagt das?" item. The map is small
 * (one entry per cast member with a portrait) and the same on every page, so the build writes it
 * into the bundle as a constant (`vite.define` in `astro.config.mjs`, from the character records)
 * instead of threading it through every island's props. Outside a Vite build, in `bun test`, there
 * is no constant and no portrait: a speaker is shown by name alone, exactly as before.
 */
import { withBase } from './url';

declare const __CAST_PORTRAITS__: Readonly<Record<string, string>> | undefined;

const PORTRAITS: Readonly<Record<string, string>> =
  typeof __CAST_PORTRAITS__ === 'undefined' ? {} : __CAST_PORTRAITS__;

/** The portrait URL of the cast member a speaker name names, or undefined for anyone else. */
export function castPortrait(name: string): string | undefined {
  const path = PORTRAITS[name];
  return path ? withBase(path) : undefined;
}
