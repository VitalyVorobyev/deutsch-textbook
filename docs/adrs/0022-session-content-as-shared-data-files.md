# ADR 0022: The session pages fetch the corpus as two shared, content-hashed data files

Status: accepted · 2026-10-11

## Context

Four pages — `/session`, `/ueben/wiederholen`, `/ueben/training` and `/ueben/proben` — each
inlined the whole corpus into one React island's props: every flashcard (5,745 cards, 8.3 MB of
JSON) or every exercise set (438 sets, 5.7 MB), or both. The pages ran 7.0–18.2 MB of HTML
(`find dist -name '*.html' -exec wc -c {} +`), 1.6–3.4 MB after gzip. HTML is network-first in
the service worker, so a learner downloaded it again on every visit, and the same bytes sat in the
document cache four times.

These pages need the content, not just identities, so the fix that served the other heavy pages
(ship card refs, 0.6.10–0.6.12) does not apply. Five alternatives were measured against the
2026-10-11 build, with decoded island props compared byte for byte:

| Option | Measured effect |
| --- | --- |
| **A. Two shared files, cached by hash** | page HTML 7.0–18.2 MB → 19–118 KB; total site HTML 91.2 → 48.1 MB |
| B. Split by support language | an EN+RU learner downloads 70% of the gzipped bytes |
| C. Ship vocab entries once, derive both card directions | −33% raw, −7% gzipped (gzip already removes the duplication) |
| D. Probe sets only for `/ueben/proben` | 1.07 MB raw instead of 5.7 MB; subsumed by A |
| E. Fetch only the decks a planned queue needs | fewer bytes per session, but offline-from-install then needs every deck anyway |

Load time, Chromium, 390 px, 10 Mbit/s with 60 ms latency, 4× CPU slowdown, gzip like the CDN,
service worker blocked (so plain HTTP caching):

| Page | Cold, old → new | Warm, old → new | Warm bytes, old → new |
| --- | --- | --- | --- |
| `/ueben/wiederholen` | 2.17 → 1.85 s | 1.75 → 0.42 s | 1.76 → 0.02 MB |
| `/ueben/training` | 1.92 → 1.73 s | 1.53 → 0.35 s | 1.62 → 0.02 MB |
| `/session` | 3.70 → 3.15 s | 3.26 → 0.58 s | 3.39 → 0.02 MB |

Cold loads cost about the same, because the content must arrive once either way. Every later
visit to any of the four pages is where the time went.

## Decision

**The session pages fetch their content from two static files: `data/cards-<hash>.json` and
`data/sets-<hash>.json`.** `src/lib/corpus-payload.ts` builds them once per build from the same
assemblies the pages used (`getAllCards`, `getTrainingSets`), and `src/pages/data/[name].json.ts`
emits them. The hash is of the body, so a file is immutable: changed content is a new URL, and an
unchanged file keeps its URL — and every cached copy — across deploys.

- **The pages pass a URL, not the content.** Each island is wrapped
  (`src/components/session/CorpusIslands.tsx`), and the wrapper mounts the original component with
  the props it always had once the files arrive. `<link rel="preload">` starts the request while the
  HTML is still parsing.
- **A failed or pending fetch never mounts a session on an empty list.** The wrapper shows a
  loading line, or an error with a retry. An empty card list would plan "nothing due", which is the
  ADR 0018 rule applied to content.
- **The service worker keeps the files in their own unversioned cache.** They are precached on
  install, so the daily loop works offline from the first launch, and served cache-first. A
  deploy that leaves a file unchanged does not download it again, and activation deletes files the
  new build no longer lists. `public/_headers` marks `/data/*` immutable for browsers without the
  worker.
- **`scripts/page-weight.ts` runs in CI after the build** and fails any HTML page over 1.5 MB, so
  page weight cannot regrow unseen.

B, C and E are not adopted. Their savings are real but secondary once A shares and caches the
files, and each adds a mechanism. B is the one to revisit if a cold first load matters: it saves
about 30% of the gzipped bytes for a two-language learner.

## Consequences

- One more request on a cold load, made in parallel with the island's JavaScript. On a warm visit
  that request is answered from cache.
- The desktop app reads the files from its bundle over the same scheme that serves `_astro/`
  modules. Its CSP is `null`, so `fetch` is unrestricted. The app has no service worker; it has no
  network cost to save.
- In dev, the files are rebuilt per request, so an edited exercise appears without a restart.
- The exercise sets carry each set's own `title` everywhere, which only `/session` used to
  receive; and every page now refuses a set naming an unknown topic, which only `/training` did.
  Validation already guarantees neither case occurs.
