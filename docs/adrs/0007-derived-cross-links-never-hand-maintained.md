# ADR 0007: Cross-links are derived, never hand-maintained

Status: accepted · 2026-08-04

## Context

The Atlas has almost no cross-links. There is no edge from a topic to the Referenz page that
tabulates what it teaches, none from a Referenz page back into the topics that teach a form, and no
topic-to-topic "see also" — the gap backlog P21-3 has been naming. A half-linked graph reads as an
oversight, and the reference pages in particular are dead ends: `/referenz` is a flat grid of eight
cards (`src/pages/referenz/index.astro`), each of which leads out of the learning path and offers
no way back into it.

The obvious fix is a link list per topic and per reference page. It is also the wrong one, and the
repo already knows why: **a hand-maintained list of relationships is a second copy of data the
curriculum already owns, and a second copy drifts silently.** Nothing fails when a topic is
renamed, a focus tag moves to a different owning topic, or a reference page grows a section — the
list just becomes quietly wrong, and no gate in this repo can tell a stale link from a deliberate
one.

**The pattern that does not drift already ships.** `/referenz/zeitformen`
(`src/pages/referenz/zeitformen.astro`) renders `TenseSystem`
(`src/components/reference/TenseSystem.astro`), whose per-form "taught-in" chips are computed at
build time from `focusIntroducedBy` (`src/lib/focus-tags.ts`, imported at `:13`) crossed with the
topics collection: `taughtIn()` at `:28`–`:29` maps each form's focus tags to the topic that
introduces them. The component's own header comment states the rule — "the YAML names focus tags
only, never a topic and never a lesson". The reference data cannot name a topic, so it cannot name
a wrong one.

Three data sources already carry the relationships a cross-link graph needs, and all three are
validated:

- **`focusIntroducedBy`** (`src/lib/focus-tags.ts`) — every registered confusion mapped to the
  topic that introduces it. `bun run validate` rejects an unregistered tag, and
  `tests/focus-tags.test.ts` holds the allowlist and
  [`../authoring/focus-tags.md`](../authoring/focus-tags.md) equal in both directions.
- **`deepens` edges** (`content/atlas.yaml`) — and the edge must share a focus tag the base topic
  drills, because the tag is the edge's only runtime channel.
- **Reference-data keys** (`content/reference-data/`) — the canonical tables the Referenz pages
  project, which already name focus tags rather than topics.

## Decision

**Any topic→Referenz, Referenz→topic or topic→topic "see also" edge is derived at build time from
data the curriculum already owns. A hand-maintained link list is not an acceptable implementation
of a cross-link, at any size.**

Concretely:

- A **topic→Referenz** edge is derived from the topic's focus tags and outcomes matching a
  reference page's declared keys — never from a `see_also:` list in the topic's frontmatter.
- A **Referenz→topic** edge is derived the way `TenseSystem` already derives it: reference data
  names focus tags; `focusIntroducedBy` turns them into topics. This is the edge that does not
  exist anywhere else yet, and it is the cheaper half.
- A **topic→topic** edge is derived from `deepens` and from shared focus tags — relations the atlas
  already validates.
- Where a genuinely editorial relation has no data behind it, **the fix is to give the curriculum
  the data**, not to hand-write the link: a new focus tag, a `deepens` edge, or a key on the
  reference table. Adding the datum is also what makes the relation visible to training, drills and
  the coverage instruments, which a link list never is.

**The Referenz index gets a structured information architecture**, grouped by the function a page
serves — forms and paradigms, sentence structure, lookup tables, written genres — rather than the
current flat list of eight equal cards. A flat list is navigable at eight entries and stops being
navigable somewhere shortly after.

## Consequences

- **This subsumes backlog P21-3.** That entry described the gap; this ADR decides how it is closed.
  The work is **P24-5**, which states the subsumption; P21-3's text folds into it.
- **A rename cannot produce a wrong link.** If a topic id changes, the derivation either produces
  the new id or produces nothing and the build says so — the failure mode is a missing chip, never
  a link that confidently points at the wrong lesson.
- **The cost is paid in derivation code, once, not in per-page maintenance forever.** The direction
  of the trade is the point: hand lists are cheap to add and expensive to keep, and this repo has
  already run that experiment on a coverage figure and lost.
- **Some edges will not exist, and that is a correct outcome.** A relation nobody encoded is a
  relation the course does not actually teach; the honest response is an empty section, not an
  invented link.
- **It constrains authoring, mildly**: the way to make two topics link is to give them a shared tag
  or a `deepens` edge — and both of those carry runtime meaning, so this is a constraint that pays
  for itself. It also means a cross-link cannot be used to paper over a missing curriculum
  relation, which is precisely the shortcut a link list makes easy.
- **It does not decide rendering.** Chip, card, footer section, sidebar — a design pass, and part of
  P24-5's one-pass scope along with the Referenz IA.
