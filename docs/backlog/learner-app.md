# Backlog · Learner app

Surfaces the learner uses, and the triaged learner feedback. The format and the ID rule are in the [backlog README](README.md).

- **P25-8 · Seven top-level nav tabs** (Heute, Themen, Entdecken, Referenz, Üben, Fortschritt,
  Über; `src/layouts/Base.astro`) is still too many, by owner ruling; required before the release
  that reports B1 complete. First step: inventory the seven and propose merges or demotions.
- **P25-1 · `/ueben/wortschatz` is ~22 viewport-heights at 390 px**, one card per deck. Group by
  level with collapsed sections, or a filter row; the Fortschritt per-level summary is the precedent.
- **P25-3 · Sub-44 px touch targets on the daily loop.** Re-measure at 390 px, then apply the
  `min-h-11 sm:min-h-0` pattern; one pass, no redesign.
- **P24-5 · Cross-links and Referenz IA, what remains.** In-page anchor navigation for the long
  reference pages, and finer per-section edges where the data supports them
  ([ADR 0001](../adrs/0001-repository-is-the-content-database.md): add the datum, never a link).
- **P26-14 · The topic → reference-page route table is hand-written** (`REFERENZ_ROUTES`,
  `src/pages/topics/[...slug].astro`), so a new reference page links from nowhere. Fix with a
  `route:`/`title:` pair on each reference-data file. First: is `praepositionen.yaml`'s absence a
  gap or a fold into `/referenz/kasus-praepositionen`?
- **P26-15 · Topic `tags:` has no consumer.** Give it a job (a Redaktion facet) or delete the field
  from `topicManifestSchema` and every manifest in one change.
- **P21-1 · Written forms are taught but never practised as forms** (Bewerbung, Beschwerde, formal
  e-mail; `content/reference-data/briefe.yaml`). An item grading structure, never wording, is the
  open design question.
- **P21-2 · The written-forms material has no index.** An Entdecken piece; small.
- **P20-1 · `/pruefung/a1` has one entry point**, and its sets declare `topic: freizeit-koennen`
  while their items span six topics — a navigation call and a schema question.
- **APP-4 · 88 of 841 `translate` items come back unchanged after a miss** (26 of the 419 ever
  failed): `scaffoldFor` (`src/lib/training.ts`) derives no lighter form for them — 73 form items
  whose `key_tokens` are absent, cover over half the sentence or differ jointly in an `accept`
  rendering, 12 word-order items over twelve words, 3 with no focus. Counted by running
  `scaffoldFor` over every exercise YAML parsed with the `yaml` package, failures from the
  learner's latest snapshot. First step: read the twelve long word-order items — an `order` of the
  clause the tag is about may be the lighter form.
- **APP-2 · Readings have no surface of their own.** All 85 readings, the 17 extensive readers
  included, are reachable only from their topic page (`src/pages/topics/[...slug].astro`; no other
  route renders `ReadingText`). An extensive reader is meant to be read straight through, so it
  wants a list a learner can browse by level. First step: decide whether it is a Lesen section in
  Entdecken or its own route, against P25-8's limit on top-level tabs.
- **APP-1 · Schreiben helper.** A learner-facing Goethe A1 Schreiben scoring and strategy note lived in the
  dev docs (`git show 6979c33:docs/a1-goethe-schreiben-helper.md`). If it is wanted, it becomes an
  in-app page.

## Learner feedback

Triaged from `feedback.md`, which holds only raw capture.

- **F-1 · In-text references are not links** ("Präteritum from B1.1",
  `content/topics/b1/kultur-freizeit.mdx:291`); `SeeAlso.astro` is a footer, not in-prose links.
  First step: authored markup or derived from the unit id it names — and a way back.
- **F-2 · There is no search** (`find src -iname "*search*"` is empty), and no `⌘F` on a phone.
  First step: scope — in-page find is a component, cross-page search a build-time index.
- **F-3 · Readings have no system** — no index, no stated role, an undecided boundary with
  Entdecken and Üben. First step: inventory what each reading is for, against `kind: intensive`
  versus `extensive`.
- **F-4 · The mastery checklist and Siehe auch belong in a desktop side panel**
  (`src/pages/topics/[...slug].astro`). First step: two columns, or a checklist popover.
- **F-6 · `-ch` versus `-g` endings.** Ambiguous: `-ig`/`-ich` pronunciation or the `-lich`/`-ig`
  suffixes. First step: ask the learner.
- **F-7 · Preposition choice as its own task type.** First step: check whether a `table` task
  already covers it before adding an eleventh item type.
- **F-8 · The separable-verb cloze answers itself** — separable verbs get two gaps, inseparable one
  (`content/exercises/a2/trennbare-verben.yaml`, `cloze-trennbar-untrennbar`). Re-author to one shape.
- **F-10 · No topic teaches that an event noun takes *zu*** (*zur Führung*). First step:
  `bun scripts/grammar-depth.ts --thin` for a tag to recycle.
- **F-11 · Mobile sweep.** A phone-width pass over Heute, Üben, a topic page and Fortschritt,
  listing what a hand reaches; with P25-3.
- **F-12 · Eight reflexive verbs ship two cards, one per Wortliste key** — an A2 bare key and a
  B1 `sich` key (`bewerben`, `bedanken`, `verlieben`, `beschweren`, `beeilen`, `freuen`, `kümmern`,
  `entscheiden`), all `cards: both`. Since the shown headword is derived (`shownHeadword`,
  `@da/schema/headword`), both cards of a pair read `sich freuen`. Flipping to recognition is not
  retrofittable. First step: disambiguating glosses versus merging; plain `entscheiden` is
  *to settle*, not *to make up one's mind*.
- **F-15 · A `table` cell has no slip allowance**, so a retyped word charges the row's focus
  (*Nine* for a printed *Nina*, four of five misses on
  `a2/nebensaetze-plaene:table-hauptsatz-zu-nebensatz`, which now avoids names). A shape heuristic
  does not fix it, and was measured: each logged wrong table attempt was rebuilt by splitting its
  `given` on ` / ` against the item's asked cells at the attempt's revision (read from `git log`),
  and the miss counted as moving off the tag when every wrong cell was a slip. 98 of 100 wrong
  attempts could be rebuilt. A cell of several words, one word off by one edit, no function-word
  swap and the last three letters intact moved 6 — and forgave real forms the table grades:
  stems behind *spricht*, *werde*, *sieht* and the superlatives *teuersten*, *billigsten*,
  *meisten*. Adding "the word is printed in the row" and "not a vowel-for-vowel edit" made it
  safe and moved 1, and still left *Nine* charged, because one vowel off is what *fahren* →
  *fähren* looks like. So a slip allowance needs a cell to say which of its tokens are graded.
  First step: per-cell `key_tokens`, then `dictationSlip` on the rest.

### Ruled, no change

Recorded so they are not re-triaged.

- *in die Führung* vs *zur Führung* is a curriculum gap (F-10), not an accept-list gap.
- `freunde-feste.yaml:266` rightly rejects a time outside the reason clause.
- *Katze*, *Hund*, *Pferd* stay at A2: the Goethe A2 Wortliste places them, and moving a word
  resets its cards.
- A Wortliste key stays bare even when the verb is used reflexively (`gewöhnen`, `kümmern`): the
  key is the manifest's. What the learner reads is derived — a `valence` that leads with `sich`
  shows `sich gewöhnen`; a dual valence (`beschäftigen`: `+ Akk / sich …`) stays bare.
- `a2/lernen-verstehen-produktion:uebersetzen-anfrage-sprachschule` asks two questions on purpose.
- *Bescheid sagen* is as correct as *Bescheid geben* and is taught: an A2 chunk
  (`content/vocab/redemittel-chunks-a2.yaml`) and a B1 card of its own
  (`content/vocab/kultur-freizeit.yaml`); the *Bescheid geben* card names it as the informal sibling.
- "Fortschritt konnte nicht geladen werden" is a local IndexedDB read, never the network
  ([ADR 0006](../adrs/0006-local-first-durable-learner-state.md)).
