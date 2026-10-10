/**
 * Local calendar date — not UTC, so a late-evening session still counts for its own day.
 *
 * Its own module, re-exported by `store.ts` for every existing importer, so that `srs.ts` can use
 * it without a value import of the store: `store.ts` imports the LiD trainer's pure logic
 * (`lid.ts`), which grades through `srs.ts`, and a value import back into the store would close
 * that into a static cycle — the kind `autosync.ts` already defers an import to avoid.
 */
export function localDateString(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
