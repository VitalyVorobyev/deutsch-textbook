/**
 * Where a topic sits in the graph — what it needs, what needs it, and what deepens what.
 *
 * All four edges have been in the payload since the manifests landed (`TopicSummary.prerequisites`,
 * `neededBy`, `deepens`, `deepenedBy`) and **not one of them reached a screen**. The topic page
 * opened with three stat cards and a table of files: everything the topic *contains*, nothing about
 * where it stands. That is the half of "context" a file listing cannot give you, and it is the half
 * that decides whether a topic may be reordered, retired or taught earlier.
 *
 * Two relations, kept visually distinct because they are not the same claim:
 *
 *   - **Voraussetzung / gebraucht von** is the spine's hard ordering — a topic may never precede a
 *     prerequisite, and `validate.ts` enforces it. Drawn as a line, left to right.
 *   - **vertieft / vertieft von** is the optional deepening edge, and it carries a rule worth
 *     surfacing here: it **must share a focus tag the base topic drills**, because the tag is the
 *     edge's only runtime channel. An edge without one is inert — present in the file, invisible to
 *     the learner — so a shared-tag count is shown rather than assumed.
 */
import { Chip, Label } from '@da/ui/primitives';

export interface Nachbar {
  id: string;
  title: string;
  href: string;
  /** Focus tags this edge actually shares. Only meaningful for a `deepens` edge. */
  sharedTags?: string[];
}

function Spalte({ label, items, leer }: { label: string; items: Nachbar[]; leer: string }) {
  return (
    <div className="min-w-0 flex-1">
      <Label>{label}</Label>
      {items.length ? (
        <ul className="mt-1.5 space-y-1">
          {items.map((n) => (
            <li key={n.id} className="truncate text-sm">
              <a href={n.href} className="text-ink underline-offset-2 hover:text-brand-ink hover:underline">
                {n.title}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-ink-muted">{leer}</p>
      )}
    </div>
  );
}

export function Kontextleiste({
  titel,
  level,
  voraussetzungen,
  gebrauchtVon,
  vertieft,
  vertieftVon,
}: {
  titel: string;
  level: string;
  voraussetzungen: Nachbar[];
  gebrauchtVon: Nachbar[];
  vertieft: Nachbar[];
  vertieftVon: Nachbar[];
}) {
  const deepening = [...vertieft, ...vertieftVon];
  return (
    <section className="mb-6 rounded-lg border border-border-subtle bg-surface-sunken/50 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <Spalte label="Voraussetzung" items={voraussetzungen} leer="steht am Anfang" />
        <div aria-hidden="true" className="hidden shrink-0 pt-6 text-ink-muted md:block">
          →
        </div>
        <div className="min-w-0 shrink-0 rounded-md bg-surface-raised px-3 py-2 text-center md:w-52">
          <p className="text-sm font-semibold text-ink">{titel}</p>
          <p className="text-xs text-ink-muted">{level}</p>
        </div>
        <div aria-hidden="true" className="hidden shrink-0 pt-6 text-ink-muted md:block">
          →
        </div>
        <Spalte label="gebraucht von" items={gebrauchtVon} leer="nichts baut darauf auf" />
      </div>

      {deepening.length ? (
        <div className="mt-4 border-t border-border-subtle pt-3">
          <Label>Vertiefung</Label>
          <ul className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {vertieft.map((n) => (
              <li key={`v-${n.id}`} className="flex items-center gap-1.5">
                <span className="text-xs text-ink-muted">vertieft</span>
                <a href={n.href} className="text-ink hover:text-brand-ink hover:underline">
                  {n.title}
                </a>
                <SharedTags tags={n.sharedTags} />
              </li>
            ))}
            {vertieftVon.map((n) => (
              <li key={`vv-${n.id}`} className="flex items-center gap-1.5">
                <span className="text-xs text-ink-muted">vertieft von</span>
                <a href={n.href} className="text-ink hover:text-brand-ink hover:underline">
                  {n.title}
                </a>
                <SharedTags tags={n.sharedTags} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The edge's only runtime channel, counted rather than assumed. Zero shared tags is not a
 * cosmetic detail: the edge exists in the manifest and does nothing at all.
 */
function SharedTags({ tags }: { tags?: string[] }) {
  if (tags === undefined) return null;
  if (!tags.length)
    return (
      <Chip tone="warn" title="Diese Kante teilt keinen Fokus-Tag und ist damit ohne Wirkung">
        kein geteilter Tag
      </Chip>
    );
  return (
    <Chip tone="neutral" title={tags.join(', ')}>
      {tags.length} Tag{tags.length === 1 ? '' : 's'}
    </Chip>
  );
}
