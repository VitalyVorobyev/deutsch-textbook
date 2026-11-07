# Backlog · Content

Course content: articles, items, probes, vocabulary, readings and their language. The format and the ID rule are in the [backlog README](README.md).

- **C6-3 · RU/UK translation halves for the B1 German-first articles**
  ([ADR 0005](../adrs/0005-explanation-languages.md)). All 20 articles carry an English
  `<Translation>` per section; a Russian or Ukrainian reader falls back to it. Write `<Ru>` and `<Uk>`
  from the German, never from the English, all-or-none per file (`germanFirstTopicProblems`
  enforces it), and give them the same fresh sentence-level check against the German.
- **C6-1 · RU/UK calque review.** Instrument: the `textbook-text-reviewer` → `textbook-text-editor`
  loop ([article-prose.md](../authoring/article-prose.md)), then a fresh verify; two edit cycles at
  most. Eight B1 units remain — all but `digitales-leben`, `kultur-freizeit`, `geld-vertraege`,
  `erfahrungen-erzaehlen`, `leben-veraendern`, `meinung-medien`. Every unit reviewed so far had a
  material defect, usually a false fact inherited from the EN half. No structural screen predicts
  it, and authoring order does not either.
- **CON-1 · A name in a Cyrillic prompt leaves its spelling free.** «Айлин» is Aylin, Ailin or Eilin and
  «Клара» Clara or Klara, so a `translate` item whose answer names a person grades a spelling its
  RU/UK prompt never gave. Two items now write the name in Latin script
  (`a1/wortbildung-ausblenden:translate-fahrerin`,
  `a2/freunde-feste-produktion:uebersetzen-transfer-blumen-karte`). First step: list the translate
  items whose answer holds a name with more than one German spelling.
- **P26-11 · B1 has eight drill sets** against A2's thirteen (`grep -l '^role: drill'
  content/exercises/b1/*.yaml`), so the remediation channel is still thinner there; P23-3 sees it
  from the other end. B1 depth reads median 7 items per confusion, 2 tags at ≤3 items, 1 tag in a
  single file (`bun scripts/grammar-depth.ts B1`). New drills also raise the floors in
  `tests/grammar-depth.test.ts`. Stable misconceptions in the 2026-10-17 audit, each a candidate:
  *zu* after a modal (`a2/infinitiv-mit-zu:mc-modal-ohne-zu`, 8/10 wrong), verb second after
  *während* (`b1/erfahrungen-erzaehlen:uebersetzen-waehrend-regen`, 11/12), a dropped copula in
  *zwar … aber* (`b1/meinung-medien:uebersetzen-zwar-aber`, 7/8), *einladen an/auf* for *zu*.
- **P26-12 · B1 pretests carry no focus tags** (A1 27, A2 72, B1 0 tagged items). Nothing is
  mis-measured — pretests are never weakness evidence — but an instrument reading pretest tags sees
  one blind level. Decide the convention, then make the three levels match.
- **P18-3 · B1.1–B1.2 competences without delayed evidence.** One three-variant family per
  competence is the contract. First step: list each unit's points against its shipped families, and
  capture `armedAt` before and after any new one.
- **P18-1 · `explain` prose length.** Mean EN `explain` over `role: practice` sets runs A1 28 words,
  A2 53, about 110 in B1.4/B1.5 (whitespace-separated words over `explain.en`); feedback is read
  after an error, when attention is scarcest. First step: set a target in
  [item-authoring.md](../authoring/item-authoring.md), then revise the B1 non-`produktion` sets.
- **P19-3 · Irrealer Wunsch (*Wenn … doch/nur …!*) has no retrieval item.** B1.8 drills the
  two-clause condition only. First step: one `translate` in a later Konjunktiv II unit pinning the
  one-word form beside *doch*/*nur*.
- **P18-4 · RU/UK produktion-set titles say «Продукция»/«Продукція»** (goods, not speech) on all
  seven B1 `*-produktion` sets. Retitle all seven in one pass or none.
- **P18-2 · `Kurz gesagt` runs ~145 words** in `a2/freunde-feste` and `a2/arbeit-beruf` against the
  ~100 target (`bun scripts/prose-shape.ts content/topics --worst`).
- **P20-2 · Thin A1 backfill.** `du-sie` and `perfekt-satzklammer` rest on one item each, five more
  points on two (`bun scripts/grammar-depth.ts A1 --thin`). Thicken the `du/Sie` and Perfekt-bracket
  pair first; never pad.
- **P19-6 · A1 listening pack.** 15 original Goethe-style tasks (6/4/5) and two three-variant
  delayed listening families, with audio, transcripts, accessibility text and provenance. Until it
  ships, public copy describes exam practice as reading, writing and speaking only.
- **P29-4 · 149 long glosses in the mid-tier decks** (`bun scripts/gloss-shape.ts --long-only`):
  `gefuehle-reflexive-verben-b1` 16, `beziehungen-familie-b1` 13, `verben-handlungen-b1-*` 23,
  `redemittel-chunks-a2` 6, then a tail. A judgement pass — some are legitimate disambiguating
  parentheticals — lowering each deck's ratchet row in the same commit.
- **P25-10 · The «рівно як» / «ровно как» idiom** — a calque of "exactly like" — across vocab and
  A2/B1 exercises (`grep -rn 'рівно як\|ровно как' content`). One file-scoped pass, each
  replacement read in context.
- **C6-2 · `tatsächlich` stress.** `content/vocab/meinung-medien.yaml` has initial `ˈtaːtzɛçlɪç`; a
  review argued for `taːtˈzɛçlɪç`. Settle against Duden's primary entry, then apply to other
  `-lich` adjectives built on a compound.
- **CON-2 · Three Sprachhandlungen have no outcome** — interkulturelle Begegnung, Wissensdivergenz, Gefühle
  ausdrücken (`bun scripts/handlungen.ts B1 --unclaimed-only`). Not turn management, so not
  `gespraech-steuern`'s; they want a topic of their own.
- **CON-3 · B1 competences that do not survive the delay.** Seven B1 rows retain 0–20% at 21–30
  days: adjektiv-nomen, irreale-bedingung, lassen-verwendung, partizip-adjektiv,
  relativ-praeposition, passiv-modal, praeteritum-vollverben (`bun run progress:audit --profile
  vitaly`, *Retention by competence*). Each row except passiv-modal now has a remediation drill
  and a further probe family armed by that drill's items alone, so the next three readings of
  each row measure the drill. Next step: read those rows once their 21-day stage is taken
  (`--project` before the date). passiv-modal's misses are participle forms (*überwiesen*,
  *ausgeschaltet*, *unterschrieben*), so check `partizip2-form` depth before giving it its own
  drill.
- **CON-4 · A direction phrase stays beside its verb.** Four rulings in `data/grading-decisions.yaml`
  show the same slip — *heute zur Arbeit nicht kommen*, *zur Oma oft gefahren* — and no item
  grades it outside A1's `nicht-position`. First step: a drill under `nicht-position` with
  adverbs and *nicht* placed against *zu/nach/in* + noun phrases.
- **CON-5 · Original B1 practice sets.** `/pruefung/b1` serves the official sets only where the
  materials are local, so a clean build has nothing to practise there.
- **CON-10 · Roll the task shape out** ([ADR 0016](../adrs/0016-lessons-are-tasks-and-a-cast-carries-them.md)).
  Two topics are converted. `a2/freunde-feste-aufgabe` is a bakery scene with Lena and Mira.
  `b1/gesellschaft-zusammenleben-aufgabe` is a courtyard meeting with Lena and Frau Kern, and
  the first listening probe family, `probe-gesellschaft-zusammenleben-hoeren`, has three recordings
  of its own. 55 topics are left (A1 12, A2 24, B1 19), every one with a listening item, counted
  as manifests listing no `-aufgabe` set. Each costs one new scene, a task set and a retired
  `-hoeren` set. A topic with a listening outcome also needs three probe recordings.
  - **The evidence comes first.** The pilots exist to take listening off its 97% ceiling. Before
    converting in batches, read the two task sets in `bun run progress:audit --profile vitaly`
    once they have been done.
  - **The voices are an open question for the ear.** The QA's speaker similarity (WavLM, between
    voice centroids) separates men from women and little else. Every same-gender pair in the
    published provenance scores 0.84–0.99 and every mixed pair 0.24–0.66
    (`qa.speaker_qa.different_characters` in `data/audio-provenance/*/*.json`). Whether Lena,
    Mira and Frau Kern can be told apart is therefore the owner's judgement from listening. The
    figure cannot answer it.
  - No portraits exist yet. ADR 0016 gives them one job: the "who said it" item.
  - First step: the audit read, then the remaining B1 topics in batches of three.
- **CON-9 · Settle the cast's continuity debt** (`data/speaker-registry.yaml`, ADR 0016). 14 refs
  in `continuity_pending` name a cast member without having been read against the record. They
  are 7 recordings and the set that uses each one: `ls-relativsaetze-produktion-01`,
  `ls-menschen-familie-02`, `ls-infinitiv-mit-zu-produktion-01`, `ls-dativ-produktion-01`,
  `ls-alltag-tagesablauf-01`, `ls-arbeit-beruf-01` and `ls-modalverben-01`. Each is a different
  person under a cast name. Examples: Frau Kern at a Makler with her mother living with her; Mira
  with a partner and a child, or checking parcels for a Frau Behrens; Timo as a new flatmate; and
  Lena, for whom getting up at nine is early, against the serial's alarm at four. Renaming a
  speaker means re-recording, so each one is renamed to a role when its topic is converted
  (CON-10), which replaces the recording anyway. 104 more named speakers belong to nobody
  (`legacy_names`). Lower the ceilings in `tests/characters.test.ts` in the change that clears an
  entry. The legacy name Jonas recurs beside the cast (Lena's brother or friend, Mira's helper)
  while Timo speaks through the voice catalogued as `jonas`. A conversion that meets Jonas renames
  him too. First step: none of its own; each conversion clears its topic's pair.
- **CON-7 · A Krimi serial, B1–B2, extensive**
  ([ADR 0016](../adrs/0016-lessons-are-tasks-and-a-cast-carries-them.md)). The extensive strand has
  one serial, Lena (seven episodes, A1–A2, `ls content/reading/*/lena-*`), and B1 has only the
  Klassiker. *Ein Fall für den Hof* (`content/reading/b1/krimi-<n>-*`) is the crime serial cast
  from the characters, and it is how the cast grows past four. Each episode carries a manual
  continuity read against the character records, and a new fact joins the record it is about.
  Each episode hangs on a topic at or after `polizei-anzeige` in the spine, so the episodes come
  in order, and it recycles a topic the learner has met by then. Bicycles vanish from the new
  Fahrraddach in Lena's courtyard. The thief is a worker of the firm that built the roof, who
  kept the gate number, and a reader can name him after episode 4.
  1. **Das leere Dach**: done (owner `polizei-anzeige`, recycles it). Lena reports her stolen bike. The gate is undamaged, and only the residents, the Hausverwaltung and the roof firm know its number. Frau Kern suspects the newcomer Herr Hansen: a Verdacht, no Beweis. Hook: a black bike for sale online carries her father's bell.
  2. **Nur zwei Monate gefahren** (owner `polizei-anzeige`, recycles `digitales-leben` and `geld-vertraege`). Lena and Timo answer the advert. The seller says the bike is sold, but a second advert from the same account shows Frau Aydin's bike, and they hand both to the police. Clue: both photos show a white van with a ladder on its roof.
  3. **Die Zeugin** (owner `versicherungen-behoerden`, recycles `unfall-notruf`). At half past four Mira, on her way to the early shift, falls from her bike when that van reverses out of a courtyard gate in the next street. She calls 112 and has only a sore knee. Clue: she saw the driver type the gate's number, and that courtyard has a new Fahrraddach too.
  4. **Was die Versicherung wissen will** (owner `versicherungen-behoerden`, recycles it). Frau Kern helps Lena with the claim: Personalien, the Anzeige's number, a deadline, insured only if locked. Clue: the Sachbearbeiterin mentions three similar claims, all from courtyards whose new roofs the same firm built. Turn: Herr Hansen's cellar bikes are old children's bikes that he repairs for a school, and Frau Kern apologises.
  5. **Ein Kunde ohne Eile** (owner `gespraech-steuern`, recycles it). A young man in the firm's jacket brings a freshly painted black bike to Frau Beck's workshop. Lena checks the frame number from episode 1, keeps him talking, evades politely and books his pick-up for the next morning. New person: the customer, a described role.
  6. **Ein Dach für alle** (owner `gespraech-steuern`, recycles `polizei-anzeige`'s Polizeimeldung and `meinung-medien`). The police wait at the workshop, and a short newspaper report gives the rest in the passive and in reported speech. The courtyard changes its number and invites Herr Hansen. Lena gets her bike back.

  Herr Hansen is the candidate fifth cast member: a neighbour who repairs bikes, suspected and
  then cleared. He stays described, never voiced, until a task needs him (ADR 0016, 0018). Next
  step: episode 2.
- **CON-8 · Contract the B2 units** ([curriculum/b1-b2.md](../curriculum/b1-b2.md)). The anchors
  and the inherited rules are written, and no unit is. Each unit needs a mission, owned structures
  and exclusions, like B1's. Units wait on *Profile deutsch* (P26-7) for the structures they own.
  The Themen denominator is `data/themenlisten/goethe-b2.yaml` (the 14 Prüfungsthemen of §4.3, all
  `unclaimed`). Next step: the unit list in `b1-b2.md`, each unit naming the Prüfungsthemen its
  topics will claim.
- **P26-7 · Buy the stronger higher-level anchors:** the Goethe/ÖSD B1 *Prüfungsziele* (ISBN
  978-3-19-031868-1) and *Profile deutsch* (ISBN 978-3-468-49410-9), which is also B2's only
  lexical and structural anchor; also the adult Goethe A2 *Prüfungsziele* (the free A2 list is the
  youth exam), and the current Goethe B2 *Prüfungsziele*: the local copy is the 2007 handbook, and
  the 2025 Modellsatz cites a newer edition. Each becomes one
  `data/strukturenlisten/*.yaml` whose entries start `unclaimed`.

Findings on single files, below the material bar, live in the shared queue (`bun run queue`,
[ADR 0014](../adrs/0014-material-governance.md)), not here.
