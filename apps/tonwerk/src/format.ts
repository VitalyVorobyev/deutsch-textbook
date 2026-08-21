/**
 * How a number or an id is written down. German locale throughout — the app's language is German,
 * and a decimal comma in one place and a point in another is the kind of inconsistency an editorial
 * tool cannot afford.
 */

/** `1:04.320` — minutes, seconds, milliseconds. Timings here are read against each other. */
export function dauer(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '–';
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const rest = total % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(rest).padStart(3, '0')}`;
}

/** `12,4 s` — for a span the reader compares to speech rather than aligns to a timeline. */
export function sekunden(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '–';
  return `${(ms / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}

/** `−18,0 dB`. A gain is always signed: the sign is the reading. */
export function dezibel(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dB`;
}

/** `4,2 %` — WER and coverage ratios. */
export function prozent(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '–';
  return `${(fraction * 100).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
}

/**
 * The first seven characters of a digest.
 *
 * Seven and not eight or twelve: it is what `git` shows, so a sha read here can be recognised in a
 * commit without counting characters.
 */
export function kurzSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : '–';
}

/** `14.08.2026, 09:12` — an ISO timestamp as a person reads it. */
export function zeitpunkt(iso: string | null | undefined): string {
  if (!iso) return '–';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

/** A plain integer with a German thousands separator. */
export function zahl(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '–' : value.toLocaleString('de-DE');
}
