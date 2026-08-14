# Active backlog

Status: active. The [roadmap](roadmap.md) owns direction; this file contains only executable or
calendar-blocked work. **A finished item leaves this file** — one line under *Recently completed*,
detail in an archive: [through 2026-07-26](archive/2026-07-backlog-full.md),
[2026-07-28 → 2026-08-02](archive/2026-08-backlog-shipped.md).

An entry is *what*, *why in one line*, *where the evidence is* (file:line or command) and *the first
step*. Measurement essays, dated reads and PR history live in
[the 2026-08 doc-slimming archive](archive/2026-08-doc-slimming.md).

## Doing

### P5-11 · Evidence-led operating cadence

After every two B1 units: drain the grading queue, rerun `bun run progress:audit --profile vitaly`,
then decide whether content or drills need revision. **Never author a drill from a pre-triage
weak-focus table** — a pre-triage table names confusions the scorer invented.

Standing conclusion across five reads: **every persistent tag has a serving drill, so the owed
action is the learner taking training, not authoring.** The one exception the 2026-08-03 read found
— `temporal-nebensatz` persistent with nothing drilling it — is closed by
`content/exercises/b1/drill-temporal-nebensatz.yaml`. Production assembly is the durable weakness:
`translate` runs well under `cloze` and `mc` on every read. That read, and the drill notes banked
from it but not yet authored: [archive](archive/2026-08-doc-slimming.md).

### P9-2 · Entdecken pieces

Recurring, at most one or two reviewed pieces per PR. Each must pass the editorial and provenance
contract in [future-content-directions.md](authoring/future-content-directions.md).

## Calendar gates

### A2 checkpoint review — approximately 2026-08-14

Review the checkpoint's completed 2/7/21-day evidence as a B1 revision trigger.

## Open

### Curriculum and content

**P26 · The six rows the 2026-08-14 anchor pass reopened.** Each exists in
`data/grammar-inventory.yaml` with a deliberately unregistered focus tag, so `bun scripts/grammar-coverage.ts`
reports it `✗` — the pattern B1 used at 0%. Closing one means: content, register the tag in
`focusIntroducedBy` **and** `docs/authoring/focus-tags.md`, and lower the number in
`tests/grammar-coverage.test.ts` in the same commit. Evidence and page citations:
[grammar-structure-audit.md](curriculum/grammar-structure-audit.md) · the console's Lücken view.

- **P26-1 · `koordination` (A1)** — *und / oder / aber / denn* joining two main clauses, with the
  conjunction occupying no sentence position. Listed at A1 **and** A2 by Goethe. The sharpest of the
  six: `~und`, `~oder` and `~aber` are ~-marked in `data/goethe-a1-wortliste.txt`, i.e. the lexical
  manifest has been claiming the curriculum teaches them as grammar while no grammar row existed at
  any level. The only systematic treatment anywhere is one comparison-table row in
  `a2/verbindungen-folgen`. Likely owner: `a1/praesens-wortstellung` (it owns `verbzweit`, and the
  contrast that makes A2's *weil*/*deshalb* learnable is that these four change nothing).
- **P26-2 · `wortbildung-nomen` (A1)** — Komposita, *-er*, *-ung*, feminine *-in*. Wortbildung is one
  of the eight top-level sections of **both** Goethe inventories and had no row at any level: the
  largest single hole found. Not decoration — the gender of a compound comes from its last member,
  *-ung* nouns are feminine without exception, and a learner who can decompose reads far more than
  the Wortliste alone predicts.
- **P26-3 · `wortbildung-adjektiv` (A1)** — *un-*, *-los*, *-bar*, *hellblau*. Kept separate from
  P26-2 because the confusion differs: a compound asks which member carries the gender, an affix
  asks what it does to the meaning. *-bar* is also the first passive-like form a learner meets.
- **P26-4 · `demonstrativartikel` (A1)** — *dieser/diese/dieses*, listed at A1 and again at A2. The
  confusion is not the meaning but that *dieser* takes the definite article's endings while a
  following adjective then takes the weak ones, so it belongs beside `adjektiv-bestimmt`.
- **P26-5 · `reziprokpronomen` (A2)** — *Wir sehen uns morgen*. Shares its FORM with the reflexive
  and none of its meaning; EN marks the difference lexically (`each other`), RU/UK with «друг друга»,
  so neither hand supplies the German syncretism. Reception A1, production A2.
- **P26-6 · `interrogativartikel` (A2)** — *welch-* as a determiner plus *alle*. The trap is the
  case: *Welchen Film…?* is where a nominative *Welcher* slips in, and EN `which` / RU «какой»
  decline for neither or differently. Distinct from `indefinitpronomen`, which owns the free-standing
  *welch-* pronoun.
- **P26-7 · Buy the two missing anchors** — the Goethe/ÖSD **B1 Prüfungsziele** (ISBN
  978-3-19-031868-1) and **Profile deutsch** (ISBN 978-3-468-49410-9). B1 currently reports 32/32
  against **no external list at all**, exactly the state A1 was in while missing four structures;
  Goethe delegates B2's inventory to Profile deutsch outright. Each becomes one
  `data/strukturenlisten/*.yaml` and every new entry starts life `unclaimed`, so the size of the job
  is visible before any of it is done. Also open: the adult **Goethe-Zertifikat A2 Prüfungsziele** —
  the free A2 list here is *Fit in Deutsch 2*, the youth exam.
- **P26-10 · The course never teaches turn-taking.** The first run of `bun scripts/handlungen.ts` (2026-08-14) reports 26/41 published Sprachhandlungen claimed, and **nine of the fifteen holes are one block**: the whole of DTZ §8.3 *Redeorganisation* — eine Äußerung einleiten/abschließen, um das Wort bitten, Zuhören signalisieren, zum Sprechen auffordern, gemeinsames Wissen andeuten, Beispiele geben, das Thema wechseln, Vermeidung. Six more: *Gefühle ausdrücken* (no outcome anywhere expresses feelings), *Wissen oder Nichtwissen ausdrücken*, *etwas bestätigen*, *Umgang mit der interkulturellen Begegnung*, *Umgang mit Wissensdivergenz*, *etwas hervorheben*. These are `spoken-interaction` competences and the corpus is already thin there; a discourse-strategy topic would close most of the block at once. Read the instrument before scoping — `beyond` is not a gap, only `unclaimed` is.
- **P26-8 · `über` as a duration marker — RULED 2026-08-14, row added, still untaught.** The DTZ
  Prüfungshandbuch §8.4 5.1 files it under *temporal*, so two published standards agree and it is
  not a quantifier. `ueber-dauer` is now an inventory row that **nothing teaches**: A2 grammar
  coverage reads 35/38. Closing it means authoring the items, not editing this line.
- **P26-9 · Twenty articles whose `## Erklärung` has no `###` subsections** — every case topic among
  them (`a1/akkusativ`, `a2/dativ`), plus `a1/praesens-wortstellung`, `a2/modalverben`,
  `a2/perfekt-haben-sein`, `a2/wohnen-umzug`, `a2/verben-mit-praepositionen`. CLAUDE.md states the
  rule; `packages/content/src/prose-shape.ts:200-206` leaves it to the author; `bun run validate` now **warns**
  (exit 0) and the console badges each topic. The heading is the only addressable place a structure
  is explained, so an inventory row, a cross-link and the Struktur page all currently have nowhere to
  point but the whole article. Content work, one article at a time; the warning count is the counter.
- **P26-10 · Thirteen taught structures no probe ever re-asks** — `bun scripts/grammar-depth.ts
  --by-point --no-probe`. Five at A1 (`gern`, `plural`, `negation-nicht`, `akkusativ-pronomen`,
  `haben-wendungen`), eight at A2 (`adjektiv-praedikativ`, `aber-sondern`, `reflexiv-akkusativ`,
  `reflexiv-dativ`, `um-zu`, `passiv-praesens`, `will-moechte`, `partizip2-system`). The lesson cycle
  ends before its last step for each of them. Probe families are ordinary work since P19-4, but
  **measure `armedAt` before and after** — a source reading is not a measurement.
- **P26-11 · B1 has one drill set (8 items) against A2's thirteen (170)** — the remediation channel
  is effectively unbuilt at B1, which is what P23-3 sees from the other end. Median practice per
  confusion is 4 at B1 against 12 at A1, and 10 of 35 B1 tags live in exactly one practice file, so a
  B1 confusion is drilled inside its own unit and never interleaved again. Authoring drills here also
  raises the floors in `tests/grammar-depth.test.ts`.
- **P26-12 · B1 pretests carry zero focus tags** (0 of 42) where A2's carry 72 of 72 — the same
  artifact class tagged differently per level. Pretests are never weakness evidence, so nothing is
  mis-measured today; but any instrument reading pretest tags sees two levels and one blind spot.
  Decide the convention, then make all three levels match it.

- **P25-14 · Non-material findings of the 2026-08-12 strand audit (batch 1)** — the material
  findings (false dative-club closure rule, missing plural in the A1 shape rule, six items
  rejecting or mis-attributing correct German) were fixed in the batch PR; these were real but
  below the material bar:
  - `a1/ort-richtung-praepositionen`: the main table's *zu – bei – von* row is labelled **Person**
    only, while the registered tag reads "a person or a point destination" — the *zu*-taking
    buildings (Bahnhof, Post, Arbeit) live as four Feinheiten exceptions instead of a row, and
    `diktat-zum-bahnhof` grades one of them.
  - `a2/zeit-praepositionen`: `uebersetzen-von-bis` drills exactly the chunk the A1 tag
    `von-bis-in-zeit` (#184) names but carries `zeitangaben-system`. Retagging was tried and
    reverted (2026-08-12): the item arms `probe-zeit-praepositionen`, and the P19-4
    arming-equality check requires an armer's focus to equal the family's — so this resolves
    only together with P25-15's umbrella-tag design note, not as an item edit. (`cloze-in-abstand`
    keeps the umbrella correctly either way: its first gap is im+month, not the A1 chunk.)
  - `a2/zeit-praepositionen` "Zeit ohne Präposition" lacks the duration member of the bare-accusative
    family (*Ich bleibe drei Tage*, *den ganzen Tag*) — both already appear in A1 item surfaces.
  - `a2/verben-mit-kasus`: the chunk table shows *auf/an/über* with the accusative only; when
    *teilnehmen an* / *arbeiten an* (an + Dativ frames) arrive, add the Feinheiten line. Nothing
    false is taught today.
  - `a2/probe-man-und-besitz-genitiv::probe-genitiv-von-kollegin`: a real genitive NP (*das Buch
    meiner Kollegin*) is correct German the item rejects; accepting it means an accepted rendering
    without the pinned `von`, so it needs a design decision, not a quick accept line.
  - `content/reading/a1/ort-richtung-praepositionen.yaml`: *zu Miras Tante* is the passage's only
    above-level structure (`genitiv-eigenname`, A2) — glossed, so receptively fine.
- **P25-16 · Non-material findings of the 2026-08-12 A2 audit, batch 2** (dativ, trennbare-verben,
  alltag-tagesablauf, modalverben, termine-vereinbaren) — the material findings (thirteen from the
  reviewer plus three same-class promotions) were fixed in the batch PR; these were real but below
  the material bar:
  - `a2/trennbare-verben`: the inseparable-prefix list (*be-, ver-, er-, ent-, ge-*) reads as
    closed in the article, the pretest and `mc-untrennbar`; the standard set adds *emp-, miss-,
    zer-* (*empfehlen* is A2 vocab). The stress rule of thumb covers them and no item grades one.
  - `a2/drill-dativ-ausloeser::cloze-nach-durch-park` declares `outcomes: [dativ-praepositionen]`
    on an `akkusativ-praepositionen` item, and `a2/hoeren-dativ::hoeren-rufst-ihn` declares
    `outcomes: [dativ-verben]` on an `akkusativ-pronomen` dictation — both are deliberate contrast
    items ("this trigger is NOT dative"), so decide whether contrast evidence should count toward
    the dative outcome before retagging.
  - `a2/drill-dativ-ausloeser::uebersetzen-fruehstueck-kueche` pins `der` after two-way *in*: a
    learner's *in die Küche* is a wo/wohin error (unit 7 material, later in the spine) logged as
    `dativ-artikel`. The surface error is a case error, so the attribution is defensible — revisit
    once `wechselpraepositionen` is armed.
  - `a2/alltag-tagesablauf.mdx`: the sequencer list omits *zuletzt/später/schließlich* — not
    stated as closed, and extending it is item-backed authoring, not a list edit (*schließlich*'s
    card lives in the late-A2 `verbindungen-folgen` deck).
  - `a2/modalverben.mdx` teaches no modal-without-infinitive (*Ich muss nach Hause*) and no
    *sollen* in an offer question (*Soll ich das Fenster öffnen?*) — both ordinary Goethe-A2 uses.
  - `a2/probe-alltag-tagesablauf::variant-a` ("On Thursday I do sport at six o'clock") carries no
    explicit habitual marker, but *donnerstags* remains a licensed rendering of the EN present
    simple; watch the grading queue before constraining a third probe variant.
- **P25-17 · Non-material findings of the 2026-08-12 A2 audit, batch 3** (perfekt-haben-sein,
  wohnen-umzug, reisen-verkehr, einkaufen-reklamation, adjektive-deklination) — the material
  findings (seven from the reviewer plus three same-class promotions from the determiner-twin
  grader sweep) were fixed in the batch PR; these were real but below the material bar:
  - `a2/perfekt-haben-sein.mdx`: *werden* appears in neither the *sein*-class lists nor the
    frequent-participle table, while *ist … geworden* occurs in A2 material
    (`gesundheit-arzttermin-pretest`, `lena-4-miras-fest`). "Change of state" arguably covers it;
    worth one table row when the topic is next touched.
  - `a2/perfekt-haben-sein.mdx`, `a2/wohnen-umzug.mdx`, `a2/einkaufen-reklamation.mdx` have no
    `### German subsections` under `## Erklärung` (the skeleton rule postdates them;
    `reisen-verkehr` and `adjektive-deklination` already comply). A level-wide retrofit pass, not
    a per-topic edit.
  - `a2/drill-wo-wohin::uebersetzen-bahnhof` pins `am` while the article itself licenses the
    uncontracted *an dem* for emphasis; a learner producing the marked full form is scored wrong.
    Low likelihood, but the pin and the article disagree.
  - `a2/wohnen-umzug-produktion::uebersetzen-stuhl-neben-den-schrank` is about a lamp, not a
    Stuhl. Do **not** rename: item ids are stable and the probe's `arming:` references this one.
  - `a2/einkaufen-reklamation.mdx` "Above a hundred the *und* disappears: *hunderteins*, not
    'hundertundeins'" — the "not" overstates; *hundertundeins* is attested standard usage. Nothing
    grades it.
  - `a2/einkaufen-reklamation.mdx` Feinheiten row `| 101 |` opens with „ and closes with an ASCII
    straight quote. Typography only.
  - `a2/probe-einkaufen-reklamation-superlativ`: all three variants print inflected NPs (*die
    graue*, *der schwarze*, *das kleine Handy*) that can reach the learner before
    `adjektive-deklination`; printed, never gapped, and the article announces the exposure.
  - `a2/adjektive-deklination.mdx` heading "Nach *der, die, das*: fast immer -en" — 7 of 12 boxes;
    the prose beneath gives the accurate five/seven split.
  - `a2/adjektive-deklination-produktion::write-zimmer-beschreiben` presents *ein helleres Zimmer*
    (komparativ-attributiv, a documented B1 deferral) as a model form to imitate; the audio item
    also carries attributive comparatives receptively. The one place the deferral is contradicted
    by material the learner is told to copy.
  - `a2/adjektive-deklination-produktion::translate-grosses-problem` and
    `probe-adjektive-deklination::v2` share the *Das ist …* frame, which pragmatically pins the
    indefinite; left without a constraining instruction by design (v2 got one anyway for family
    parallelism).
- **P25-18 · Non-material findings of the 2026-08-12 A2 audit, batch 4** (gesundheit-arzttermin,
  verben-mit-praepositionen, arbeit-beruf, nebensaetze-plaene, infinitiv-mit-zu) — the material
  findings (eleven from the reviewer plus five same-class promotions from the determiner-twin
  grader sweep) were fixed in the batch PR; these were real but below the material bar:
  - The generated `ls-*-hoeren` listening sets carry above-A2 lexis in three of the five topics —
    *Lieferung/Kartons/beschädigt* (arbeit-beruf), *sobald* + reportive *soll* (nebensaetze-plaene),
    *Anlage/Hausmeister/vermeiden* (infinitiv-mit-zu). No question key hinges on any of them and
    the pattern is uniform across the `ls-` family — a family-wide pass, not per-topic edits.
  - `a2/verben-mit-praepositionen.mdx` names *nach* among the dative-governing prepositions, but
    no verb governing *nach* appears in the table, the reference data, the deck or any item.
  - `a2/verben-mit-praepositionen::match-verb-praeposition` (primary practice) disambiguates with
    B1 lexis (*erwarten*, *besprechen*) — not answer-bearing; the set cannot grow.
  - `a2/probe-verben-mit-praepositionen-wahl`: all three UK explains contrast with Russian, not
    Ukrainian («ні з російської конструкції…») — calque residue; rides on the C6-1 triage.
  - `a2/probe-arbeit-beruf-anrede` variant-a translations render *können Sie…* as EN "could" and
    RU imperative «пришлите» — the können/könnten distinction is the topic's own teaching point.
  - `a2/arbeit-beruf.mdx`: "one letter apart in English" for *darf nicht*/*muss nicht* (rendered
    "not allowed to"/"don't have to"); "Modals are the one verb group with no ending in the third
    person singular" (*wissen* is the other Präteritopräsens).
  - `content/vocab/arbeit-beruf.yaml` (`melden`): `valence: "+ Akk"` while the example carries a
    dative recipient (*der Chefin*).
  - `a2/nebensaetze-plaene::uebersetzen-weil-krank`: RU perfective «заболела» against *krank ist*
    — aspect mismatch with no consequence for the graded token. `probe-nebensaetze-plaene-weil-denn`
    variant-c explain cites *arbeitet* while quoting the other clause's evidence.
  - `a2/nebensaetze-plaene::uebersetzen-dass-wetter`: RU/UK «будет» licenses the Futur rendering
    (*gut sein wird*) once `zukunft-werden` is armed — watch the grading queue before widening.
  - Bare-noun prompts in definite-leaning contexts left unaccepted by design (watch the queue):
    `arbeit-beruf::uebersetzen-denn-termin` (*den Termin*), `drill-zu-infinitiv::
    uebersetzen-formular-auszufuellen` (*ein Formular*), `gesundheit-arzttermin::
    uebersetzen-imperativ-sie` / `-produktion::uebersetzen-ratschlag-sie` (the 2026-08-11
    `confirm` ruling covers the class).
  - `a2/infinitiv-mit-zu.mdx`: the "auch nach gehen und fahren" table omits *bleiben/lassen/
    sehen/hören*, which the prose and a drill item do require; the productive/receptive boundary
    is stated in prose only.
  - `a2/gesundheit-arzttermin.mdx` teaches the whole `da(r)-` system as a preview of the next
    topic — the same paradigm authored twice.
- **P25-19 · Non-material findings of the 2026-08-12 A2 audit, batch 5** (relativsaetze,
  biografie-erfahrungen, verbindungen-folgen, man-und-besitz, freunde-feste) — the material
  findings (ten from the reviewer plus three same-class promotions from the determiner-twin
  grader sweep) were fixed in the batch PR; these were real but below the material bar:
  - `a2/relativsaetze-produktion::uebersetzen-definition-fahrrad` uses *jemanden* three units
    before `man-und-besitz` introduces it, with no `preview: true`; its only card lives in the
    unowned `kleine-woerter-a2` deck.
  - `a2/relativsaetze.mdx` "they are the same table:" — the promised table appears only after
    two further paragraphs and all three language halves. Reading-order nit.
  - `a2/verbindungen-folgen.mdx` "There is a conjunction with the same meaning — obwohl" —
    *obwohl*/*trotzdem* attach to opposite clauses; "same meaning" invites *Trotzdem es
    geregnet hat*. The vocab note states it correctly; align the article's wording when next
    touched.
  - `content/reading/a2/verbindungen-folgen.yaml` mixes unglossed full-verb Präteritum (*ging*)
    with Perfekt one clause apart, after the article restricted Präteritum to war/hatte/modals.
    Receptive; consistent with "written narration uses it widely".
  - `a2/biografie-erfahrungen-produktion`: «семью» without possessive licenses *die Familie*
    (unlisted, not the graded token); the grow-up question accepts only *du* (settled by the
    classmate instruction). Watch the queue.
  - `a2/man-und-besitz.mdx` restricts the endingless *jemand* variant to the accusative; Duden
    also allows an endingless dative. Under-narrow, not false.
  - `a2/man-und-besitz-produktion` distractor "Keiner hat nichts gesagt." uses B1 *keiner*;
    meaning-transparent, distractor only. `probe-man-und-besitz::probe-man-anmelden` id says
    *anmelden* but the item is about lunch — ids are stable, do **not** rename.
  - The double-negative distractor class and the `ls-*` above-A2 lexis stay under their
    standing entries (P25-18).
- **P25-21 · done (2026-08-12)** — the unpinned-accepted-synonym class is now a validator
  hard-fail (`scripts/validate.ts`: every rendering of a focus-tagged translate must carry ≥1
  graded position); the rule was watched failing on the 8 residual items (11 renderings) before
  their pin unions landed with it.
- **P25-20 · Non-material findings of the 2026-08-12 A2 audit, batch 6** (lernen-verstehen,
  aemter-dienstleistungen) — the material findings (thirteen from the reviewer plus one
  determiner-twin promotion) were fixed in the batch PR; these were real but below the bar:
  - `a2/lernen-verstehen-produktion` opens with a stale comment describing a recording task that
    contradicts the actual `ls-` transcript and sits above an `mc` item with no recording. Delete.
  - `a2/lernen-verstehen.mdx` W-word tables never list *wie viel* (used by a drill answer) or
    *wer/wen/wem/warum/welch-* as indirect-question openers; nothing the learner meets uses them
    either — a completeness opportunity, not a gap.
  - `a2/lernen-verstehen.mdx` "a Nebensatz may never begin with the verb" — false as an absolute
    (verb-first conditionals), correct as the A2 simplification. Leave unless B1 contradicts it.
  - UK half at `lernen-verstehen.mdx:203` — «але» contrast does not follow from its own clause
    (calque of the RU half's point about «если»); the Häufige Fehler UK half states it right.
  - `a2/lernen-verstehen::cloze-du-oder-sie-fragen` accepts only *können Sie / kannst du*; the
    politer *könnten Sie* (taught in arbeit-beruf) is rejected on an item grading du/Sie, not mood.
  - `a2/aemter-dienstleistungen-produktion` model answer carries a fourth *hätte* chunk (*Ich
    hätte noch eine Frage*) the article's "exactly three" framing never presents; guidance-only.
  - `content/vocab/aemter-dienstleistungen.yaml`: «бюргерамт» transliterates the answer on a
    production card's question side (repo-wide convention for this word, no other RU equivalent);
    the `anmelden` note describes only the reflexive use while the topic uses it transitively.
  - `a2/aemter-dienstleistungen::table-hoefliche-chunks` cells accept a single string, so the
    article's own neutral *Ich möchte* is scored wrong; if fixed, it is an instruction constraint.
  - `a2/aemter-dienstleistungen-dokument::dokument-formular-unterlagen` is an untagged translate
    keying *Wohnungsgeberbestätigung*/*nachreichen* (above A2, supported by the stimulus).
  - Definite-leaning bare-noun prompts left unaccepted by design (watch the grading queue):
    *das Formular* items in both aemter sets, *der Kurs*/*der Test* in the lernen enquiry items.
- **P18-3 · B1.1–B1.2 competences without delayed evidence** — the contract requires one
  3-variant probe family per competence. B1.3 closed 2026-08-12: `adjektiv-nullartikel` gained
  family 4 of 4 (`probe-gesundheit-wohlbefinden-adjektiv-nullartikel`), so all four of its points
  now have a clock. Next step: enumerate B1.1's and B1.2's points against their shipped families
  (the original "one family each" note predates the #169–#178 loop, so the remaining gap has to be
  measured, not read off this entry). P19-4's explicit `arming:` lists keep new families from
  moving existing clocks — measured again for family 4: all three siblings' `armedAt` unchanged.
- **P18-6 · done (2026-08-12)** — `probe-konsum-umwelt-passiv-position`, translate ×3 on the frame's
  two walls; sibling clocks measured unmoved, the family arms retroactively at 2026-07-29.
- **P19-3 · Irrealer Wunsch (*Wenn … doch/nur …!*) has no retrieval item** — B1.8 drills only the
  two-clause condition; the wish form sits in `### Feinheiten` with no item. First step: a later
  KII-touching unit owns one `translate` pinning the one-word form beside *doch*/*nur*.
- **P19-6 · Reviewed A1 listening pack and delayed listening probes** — 15 original Goethe-style
  tasks in the official 6/4/5 structure plus two three-variant delayed families (telephone/number
  information, public directions/announcements), with committed audio, transcripts, accessibility
  text and provenance. The Listening Studio supplies the pipeline; this is the content half. Until
  it ships, public copy must describe exam practice as reading/writing/speaking only.
- **P20-2 · Four of the five backfilled A1 grammar points rest on one or two items** — `du-sie` and
  `perfekt-satzklammer` have exactly one each, five more have two: honest against the instrument,
  thin against the A2 norm. Not to be fixed by padding. First step: thicken what a stop-at-A1
  learner leans on hardest, the `du/Sie` and Perfekt-bracket pair.
- **P18-1 · `explain` prose drifted the way the articles did** — mean EN `explain` runs A1 28 w →
  A2 53 w → ~110 w in B1.4/B1.5 (max 167), counted as whitespace-separated words over `explain.en`
  across each level's `role: practice` sets. Explanatory feedback is read *after* an error, where
  attention is scarcest. First step: decide a target, put it in
  [item-authoring.md](authoring/item-authoring.md), then revise the two B1 units' non-`produktion`
  sets; `-produktion` model answers are legitimately longer and need their own line.
- **P18-2 · `Kurz gesagt` exceeds its own target in two A2 files** — `a2/freunde-feste` and
  `a2/arbeit-beruf` run ~145 words against the ~100-word target, well outside the corpus median
  (`bun scripts/prose-shape.ts content/topics --worst`). Editing work, not a build failure.
- **P18-4 · The RU/UK produktion-set titles name goods, not speech** — all seven B1 `*-produktion`
  sets title themselves «Продукция»/«Продукція», which reads as manufactured output. If retitled,
  do all seven in one pass so the convention stays uniform.
- **C6-1 · RU/UK calque triage with the prose-reviewer skill** — was "Ukrainian calque audit";
  widened 2026-08-05 when a learner report caught calqued *Russian* in `b1/digitales-leben` (RU and
  UK failed in the same sentences — both shaped by the EN template). Instrument: the
  `textbook-text-reviewer` skill loop (`docs/authoring/article-prose.md`). Language quality, not
  alphabet parity, is the target. **Eight B1 units remain** — every unit except `digitales-leben`,
  `kultur-freizeit`, `geld-vertraege`, and the 2026-08-12 batch `erfahrungen-erzaehlen` /
  `leben-veraendern` / `meinung-medien` (7+6+2 material findings, all repaired and fresh-verified
  PASS; the entry previously said "twelve remain" — the topic list says eleven did, now eight).
  Hit rate is now **5 of 5**, and one pattern note joined the tally: `meinung-medien`'s false
  universal about the *oder*-half lived in **all four halves including `<De>`** — the first
  defect to cross the "EN enters, De stays clean" line. Three things are measured rather than
  assumed:
  - **Authoring order does not predict it.** This entry used to say "worst-suspects first (units
    authored earliest in the B1 pipeline)". The confirmed case, `digitales-leben`, was authored
    2026-08-04 — 11th of 14 — while `leben-veraendern` (07-24, first) and `informationen-vermitteln`
    (08-05, last) both spot-checked clean. Order the queue some other way, or not at all.
  - **No cheap structural screen exists.** A prototype scoring EN↔RU/UK sentence-count parity and
    per-sentence length lockstep (`## Beispiele` excluded) was calibrated against the one labelled
    case and failed: pre-repair `digitales-leben` scored *below* two units that reviewed clean, and
    the repair *raised* its score. The corpus is authored paragraph-parallel by design, so parity
    runs 0.72–0.85 everywhere and carries no signal. The calque is rhetorical, not structural. The
    script was deleted rather than tuned to agree with a 1-positive sample.
  - **Hit rate so far is 2 of 2**, and the reviewer pass is what finds it. Both units reviewed
    2026-08-06 returned REVISE on both halves, each with a Critical or Major *factual* defect
    inherited from the EN half, not merely awkward prose. A per-unit pass costs ~8–10k tokens of
    input (RU + UK + the German spec); a reviewer verdict of PASS *is* the triage, so no separate
    screening stage is needed. Budget three subagents per unit: review → edit → fresh verify, two
    edit cycles maximum.
- **C6-2 · Verify the citation stress of `tatsächlich`** — `content/vocab/meinung-medien.yaml` has
  initial `ˈtaːtzɛçlɪç` (derivation from *Tatsache*, parallel `hauptsächlich`); a review argued for
  `taːtˈzɛçlɪç`, which is the emphatic realisation. Settle against Duden's primary entry and apply
  to any other `-lich` adjective built on a compound.

### Instruments and gates

- **P25-15 · Instrument note from the strand audit (2026-08-12)** — verified against
  `packages/grading/src/production.ts`, not fixed there yet (the audit's other two notes — the position-0-only
  case fold and the validator guard blind to it — were fixed the same day: sentence-head fold +
  `gradedTokenPositions` mirror, with the three corpus items the new guard caught):
  - The validator holds a probe family's item `focus` equal to the arming set's, so a variant that
    grades a pure sub-confusion logs its failure on the umbrella tag: `a2/probe-zeit-praepositionen`
    `variant-a` is seit-vs-vor and `variant-b` am-vs-um, both logged as `zeitangaben-system`.
- **P25-13 · The real store round-trip test is quarantined on CI (`test.skipIf(CI)`)** — on ubuntu
  runners the `getCardStates`/`setCardState` composition through the real `getStore()` dies at bun
  test's 5000ms budget with a promise that never settles, while every ingredient passes there in
  milliseconds: raw fake-indexeddb, a fresh `IDBFactory`, idb-keyval `get`/`set`/`update`, the
  `getStore` body rebuilt inline, and the same op through `withVisibilityRetry` at the production
  timeout (PR #179's diagnostic-ladder runs, 2026-08-12). The hang point moved between runs
  (`getCardStates` once, `setCardState` later) — a scheduling race in the fake-indexeddb/bun event
  loop on Linux, not app logic; macOS passes every time on the same bun 1.3.14. Decomposed CI
  coverage lives beside the quarantined test in `tests/store-visibility-retry.test.ts`. First
  step on each bun upgrade: delete the `skipIf` locally, push a draft, and see whether the runtime
  race is gone.
- **P25-11 · `erfahrungen-erzaehlen`: zero L1 contrast in a four-half calque-parallel article** —
  the 2026-08-12 C6-1 fresh verify passed the unit on falsehood triage but measured what no other
  reviewed B1 unit shows: `grep -c "русск|English|англ|українськ"` returns 0 against 27/9/5 in
  `leben-veraendern`/`reisen-probleme`/`meinung-medien`, on the one topic where the L1 gap (RU/UK
  have a single past tense; German splits Perfekt/Präteritum by register plus the Plusquamperfekt
  step) is the strongest hook available. Repair is a rewrite of four halves — its own work item,
  not a review-round edit. While there: one sentence on adverbial `seitdem` (V2 — the unit's own
  reading and write model both use it unremarked, and the während-as-adverb sibling trap has 9
  attributed learner errors).
- **P25-10 · «рівно як» / «ровно как» idiom sweep** — the C6-1 review of `erfahrungen-erzaehlen`
  (2026-08-12) fixed «рівно як» ×3 as a Russism calquing "exactly like"; the corpus-wide grep then
  found ~20 more occurrences across 17 files (vocab + a2/b1 exercises), plus the RU sibling «ровно
  как» in similar volume. Out of scope for a single unit's repair (an idiom sweep, not a falsehood),
  and the unit's own drill already uses the idiomatic «точно як». One mechanical pass, file-scoped,
  with each replacement read in context — not a blind sed.
- **P25-7 · Slip-forgiveness does not reach a typo outside `key_tokens`** — the 2026-08-11 triage
  confirmed four rows where every `key_tokens` token was perfect and one non-graded-token typo
  still sank the rendering and re-enters the focus signal as an error on confirm: bliebt/bleibt
  (`b1/digitales-leben:uebersetzen-sodass-bildschirm` row a), zech/zehn
  (`b1/probe-informationen-vermitteln:variant-a` row a), mit/mir
  (`b1/geld-vertraege:uebersetzen-nachfrage-indirekt` row a), Merr/Meer
  (`a2/probe-verben-mit-praepositionen:probe-haus-am-meer` row a) — rulings and notes in
  `data/grading-decisions.yaml` (decidedAt 2026-08-11). **Do not change the scorer without
  measuring against the attempt log first** — the two `key_tokens: []` reversals both came from an
  invented fixture, not the corpus, and were wrong twice. First step: pull every historical confirm
  where the only divergence sits outside `key_tokens`, and measure whether widening
  slip-forgiveness there would move real attribution.
- **P25-9 · Band 1 re-deals a failed item before the drill that remediates it can ever be dealt** —
  `buildSession` (`src/lib/training.ts`) serves last-answer-wrong items first, then seen weak-focus
  items, then never-seen items. Consequence, measured 2026-08-11:
  `b1/erfahrungen-erzaehlen:uebersetzen-waehrend-regen` was dealt and failed in nine sessions
  running (2026-07-24 → 2026-08-10, the learner's «Während warteten wir» re-anchoring each time),
  while all eight items of `b1/drill-temporal-nebensatz` — shipped 2026-08-03 (#137), attached to
  the topic, same focus tag — sat in band 3 with zero attempts ever. A fossilizing item cannot be
  broken by re-serving itself, and any new drill would join the same band-3 queue, so the fix is
  selection, not content (candidates: cap consecutive re-deals of one item; let a due drill item of
  the same weak focus preempt band 1). The delayed probe runs 2/2 on this competence, so the loop
  is measurably an item-serving artifact, not lost competence. Fix alongside the PR-4 session work
  or PR-8 remediation design; measure the deal distribution before and after.
  lexis wave 4b (2026-08-06) B1 coverage is 3343/3416: 3279 cards, 64 grammar `~`, 73 open. The 73
  (the `NOCARD` set in the wave-4 partition) are bound morphemes (`hell-`, `-weise`, `irgend-`),
  abbreviations (`bzw.`, `EG`, `vgl.`), correlative frames (`je … desto`, `sowohl … als auch`,
  `um … zu`), and full forms whose short forms ship (`Personenkraftwagen`, `Akkumulator`). Several
  of the frames are grammar-taught, so they may earn `~` markers — but a `~` must be earned (the
  validator requires the word in the taught surface) and each needs a manifest line. Go row by row;
  the rest stay open with this entry as the reason, and no coverage figure may round them away.
  **The correlative frames are settled as of 2026-08-14 and are not lexis:** the DTZ
  Prüfungshandbuch §8.4 lists *entweder … oder*, *weder … noch*, *sowohl … als auch*, *nicht nur …
  sondern auch* and *je … desto* as **6.8 Doppelkonjunktionen**, and *um … zu* as a 6.5
  Nebensatz-Konjunktion — structures, in a grammar inventory, all six claimed by
  `zweiteilige-konnektoren`, `proportionalsatz-je-desto` and `um-zu`. So they are eligible for `~`;
  what remains is the per-row manifest work and the taught-surface check the validator runs, which
  is real work and is what is still open here. — when an existing
  `ipa` sits below a comment block it fails to see it and writes a second key
  (`charakter-eigenschaften-a2`, `eigenschaften-dinge-a2`, `erfahrungen-erzaehlen`,
  `infinitiv-mit-zu`, `ort-richtung-verweis-b1`; hit and reverted during wave 2b, 2026-08-05).
  Until fixed, run it only with `--only <deck>`; the fix is in the writer's did-I-already-fill-this
  check, and duplicate-key YAML should also fail `bun run validate`.
- **P23-3 · Six of the seven tags the runtime prioritises have no drill, and all six are B1** —
  cross `weakFocuses` (`src/lib/weakness.ts`) against every `role: drill` item's `focus`; fifteen of
  the sixteen drill sets are A1 or A2. **Read both instruments before deciding**: `weakFocuses`
  takes the last ~30 attempts per focus at a ≥35% bar and drives what mixed training serves *now*,
  while the audit's `persistent` table asks whether a confusion is durable across ≥2 items. They
  disagree and neither is wrong ([archive](archive/2026-08-doc-slimming.md)). **Do not author six
  drills at once** — a serving drill the learner never opens changes nothing (P5-11); take the next
  one from the next read.
- **P23-2 · A revision bump that only widens `accept` makes the retention table stop re-grading** —
  `classifyProbe` (`scripts/progress-audit.ts:769`) re-grades a probe attempt against the item's
  current spec only when the attempt's `itemRevision` still matches (`:386`); otherwise it falls
  back to the stored historical tag, which CLAUDE.md elsewhere says must never be trusted. A widened
  `accept` list does not change the question, so replaying against it is the only way a false
  negative is ever corrected. **Verify against the corpus before acting** — this is a mechanism
  read, and the one measurement taken found no row affected
  ([archive](archive/2026-08-doc-slimming.md)).
- **P5-11b · Mode coverage is unchecked** — `bun run validate` enforces the item-mix bar but never
  asks whether an outcome has a task in the mode it names. **A1 is resolved**: items declare
  `target_mode`, and validation requires every A1 outcome's claimed mode to be practised. Every
  topic at every level now owns an `audio-comprehension` item, so listening is practised everywhere
  and claimed almost nowhere — only `erfahrungen-erzaehlen` declares a listening outcome. First
  step: decide whether an outcome must name the mode it is measured in, write it down, then extend
  the A1 validator check to B1.
- **P24-8 · `bun run gen:ipa` writes a duplicate `ipa:` key when a comment line precedes the
  field** — observed 2026-08-04 on five decks (`erfahrungen-erzaehlen`, `infinitiv-mit-zu`,
  `charakter-eigenschaften-a2`, `eigenschaften-dinge-a2`, `ort-richtung-verweis-b1`) and reverted by
  hand; YAML keeps the last key, so a reviewed transcription is silently replaced by a generated
  one. First step: make the writer idempotent, and add the comment-preceded case to its test.
- **P24-9 · Article comprehensibility is felt, not measured** — perceived difficulty varies
  substantially between topics (owner, 2026-08-04) and no instrument sees it: `prose-shape` checks
  paragraph *shape*, and CEFR discipline binds only at authoring time. **(a) is shipped**:
  `bun scripts/comprehensibility.ts <level>/<topic-id>` reports ahead-of-the-learner tokens per
  section with the words listed, sentence length and Nebensatz density, and terminology density per
  explanation half; `--rank` ranks a level or all three against medians read off the corpus
  (`packages/content/src/comprehensibility.ts`, [doc](authoring/coverage-instruments.md)). It is read-only and
  gates nothing. Two things remain. **Calibrate before trusting it**: rank all 46 topics against
  the owner's felt-difficulty list, because a ranking nobody has checked against the feeling it was
  built to explain is still an assertion. The four known false-positive classes (proper names,
  strong-verb ablaut, glossed reading words, per-language glosses inside German tables) are listed
  in the doc and are only worth chasing if calibration says they move the order. Then **(b) learner
  evidence** — a per-topic pretest→first-blocked-practice accuracy delta in `progress:audit`, since
  an article that taught reads as a positive delta. Outliers are the product, never caps.
- **P12-6 · Dictation focus attribution** — A1 is resolved; A2/B1 dictations keep `dictationSlip`,
  because extending the A1 silence to items without predicates dropped 145 of 291 free-typed tags
  and took `weakFocuses` from 7 to 1 — an inverted signal, not an honest gap
  ([archive](archive/2026-08-doc-slimming.md)). First step: author `focus_evidence` predicates for
  the ~50 focused A2/B1 `listen` items, then give them the A1 treatment item by item.
- **P12-7 · An accept list cannot be completed by enumeration** — standing policy: close an item's
  *declared* product in one pass (the dimensions its own `answer`/`accept`/`explain` present as
  equivalent), verify every cell through `gradeTranslation`, then stop. Renderings outside that
  product belong to `data/grading-decisions.yaml`. Prefer the two mitigations to a longer list:
  **name the token in the `instruction`** when the pin carries the focus, and **accept the sibling**
  when it does not.
- **P5-11c · The connector-determinacy check does not reach cloze gaps** — the rule reads
  `item.answer`/`item.accept`, which is the `translate` shape, so a cloze gap accepting one
  interchangeable connector and rejecting its sibling is unguarded. Read the comment above
  `INTERCHANGEABLE_CONNECTORS` first: `da` is deliberately absent because clause-initial *Da* is
  more often "then/there" than causal. A cloze equivalent needs sense disambiguation, not a longer
  list.
- **P22-9 · Markdown emphasis in a YAML text field reaches the learner as asterisks** — no exercise
  component runs a markdown pass; `explain` lands in a plain `<p>` (`shared.tsx`). A blanket rule is
  wrong: `*` is also the ungrammaticality marker, used correctly in 64 places. The distinguishing
  test is that emphasis *closes* — a `*` preceded by a non-space and followed by space, punctuation
  or end-of-string — while the linguistic marker never does. Verify a candidate rule against both
  sets before landing it.
- **P22-14 · Per-line silence compounds with the inter-line pause, and nothing measures it** — each
  synthesised line carries its own lead and trail (corpus medians 0.43 s and 0.46 s) and `assemble`
  then adds `pause_after_ms` (450 ms), so a normal turn boundary is ~1.4 s of dead air and an
  unlucky pair runs past 2 s. Fix by trimming each take's lead and trail at assembly and letting
  `pause_after_ms` be the whole gap — which re-synthesises all 41 artifacts and **invalidates every
  approval**, so it is between-waves work, best paid for in the same pass as P22-16. Measure in
  words per second of *voiced* audio (median 2.96), never of wall clock.
- **P22-10 · Nothing in the repo compares a recording's length to the length the plan asked for** —
  `duration_seconds` is authored per artifact in `data/listening-plan.yaml` and
  `tools/listening-studio/authoring/audio_report.py` measures the gap, but neither `bun run validate`
  nor `bun run listening:inventory` can see it; that read (2026-08-04) put **twelve of forty-one
  outside their window**. **Do not amend a window to match what shipped** — decide per artifact
  whether the script is short, and fix the script. Start with the two worst by proportion,
  `ls-lernen-zukunft-01` (44.4 s against 65–85) and `ls-arbeit-beruf-01` (23.7 s against 40–50).
- **P22-11 · Nothing detects two vocab entries that answer the same production prompt** — two
  entries whose glosses reduce to the same content words are two correct answers to one question;
  `Angebot`/`Sonderangebot` was found by the learner, not by a gate. A throwaway scan's 129
  candidate pairs are **not** a defect count ([archive](archive/2026-08-doc-slimming.md)). First
  step: build the detector to respect parentheticals and require mutual overlap, then triage against
  the lapse table. `Stock`/`Stockwerk`/`Etage` is verified genuine and needs an editorial ruling.
- **P22-19 · An audio-only topic escapes the item-mix bar entirely** — `scripts/validate.ts:751`
  builds `practiceItems` with `audio-comprehension` filtered out and then guards the whole block
  with `if (practiceItems.length > 0)`, so a topic whose `role: practice` sets held only recorded
  items would skip the two ratios *and* the two-translate minimum. Not reachable today — every topic
  pairs its `-hoeren` set with written practice — but it is a hole in the gate, and the next
  audio-first topic walks through it. Fix: decide *whether the topic has practice* from the
  unfiltered list, and use the filtered list only as the ratios' denominator.
- **P22-20 · The documented Qwen download is unpinned and the loader is not** —
  `scripts/download-qwen3-tts.py:55` calls `snapshot_download` with no `revision`, while
  `QwenTTS.revision` fixes `85e237c1…` and `locked_snapshot` accepts only that metadata. Today
  upstream `main` happens to match; once it advances, `install-qwen.sh` pulls a multi-gigabyte
  checkpoint, exits 0, and the Studio then reports the model as not found — a failure that appears
  nowhere near the command that caused it. Fix: pass the pinned revision to the downloader.
- **P22-18 · `soundfile` is pinned twice, at two versions** — `pyproject.toml` and `uv.lock` say
  `0.13.1`; `requirements-qwen-runtime.txt` says `0.14.0`. The documented order (`uv sync`, then
  `install-qwen.sh`) therefore leaves an environment that disagrees with its own package metadata,
  and a later `uv sync` downgrades it back. Two lines; pick one version and use it in both. While
  there: the 41 committed manifests record `dependency_lock_sha256` as it stood when the audio was
  approved, which is what a provenance record should say — do **not** refresh those hashes.
- **P22-17 · `draft-wave` cannot draft a Qwen-seeded project** — `cli.py`'s `ENGINE` is now
  `qwen_tts`, so `seed-wave` writes payloads carrying Qwen voices, but `generate_drafts` still
  forces `"tts_adapter": "parler_tts"` into the final payload (`adapters.py:298`) without
  reassigning them; Parler validates only its own voice set, so every draft is rejected and the wave
  stays undrafted. The seeded payload's adapter is authoritative — the line should read
  `payload.tts_adapter`. Verifying it end to end needs the MLX generation stack; it blocks the next
  wave's first command, so do it before seeding Wave 3.
- **P22-15 · The Studio cannot author a `uk` half, so the repo's copy is the only one** —
  `RevisionPayload` carries `Bilingual.uk` and it is `None` on all 41 artifacts, because no editor
  surface writes it. The 246 uk fields were authored by hand into the published YAML, so the Studio
  and the repo now disagree about those artifacts; nothing silently loses them (`publish` refuses to
  overwrite), but the next wave repeats the exercise. Fix: a third column in the question editor and
  `uk` in `draft_prompt`'s shape. Until then, budget the manual pass into the wave, not after it.
- **P22-16 · Delivery settings do not vary by level** — `pace` and `pause_after_ms` are flat across
  A1, A2 and B1 (450 ms between every line in all 41 artifacts), and nothing in `scripts/validate.ts`
  or `data/listening-plan.yaml` checks them against the artifact's level. An A1 listener needs more
  room between turns than a B1 listener. Fix with a per-level delivery profile in
  `data/listening-plan.yaml` plus validator enforcement — but either field changes `line_cache_key`,
  so it re-synthesises that level and **invalidates its approval**. Between-waves work; pair it with
  P22-14 so the approval cost is paid once.
- **P22-12 · The positional-option rule cannot see a bare ordinal** — `src/lib/option-references.ts`
  anchors on an option noun, because scanning every ordinal in the shuffled-option corpus returns
  203 occurrences of which most are correct grammar prose. A field whose *only* positional reference
  is a bare ordinal is therefore invisible; fields with a flagged sibling phrase are covered, since
  the rule reports the whole field. Needs sense disambiguation to go further.
- **P22-5 · A rebuilt export keeps the previous revision's files** — `write_bundle` reuses the
  export directory, so a contextual source dropped by a new revision survives under `sources/`,
  enters `exported_files` and the ZIP, and is published although the manifest's `contextual_sources`
  no longer describes it. Build into a clean directory.
- **P22-6 · Freesound source URLs are matched by prefix** — `sources.py` accepts
  `https://freesound.org/s/1234` for `sound_id: 123`, so a metadata typo can credit a different
  upload while every validation step passes. Parse the URL; require the sound-id segment to equal
  `sound_id`.
- **P12-8 · The two answer highlights come from two LCS runs** — `Translate` calls
  `diffExpectedWords` twice with the arguments swapped, and each traversal picks its own
  direction-dependent alignment, so a transposition can mark different words on the two sides.
  Display only — scoring and attribution are untouched. Return both flag arrays from one traversal
  in `packages/grading/src/worddiff.ts`.
- **P18-8 · `review:gate` cannot see a review whose body omits the Reviewed-commit line** —
  `scripts/pr-review-gate.ts` proves review-of-HEAD only by parsing "Reviewed commit: `sha`" out of
  review bodies, and a review can carry the exact HEAD sha in its API `commit_id` while omitting the
  line. Also read `commit_id`; keep the body regex as fallback. Until then verify by hand:
  `gh api "repos/{owner}/{repo}/pulls/<n>/reviews" --jq '[.[] | select(.user.login == "chatgpt-codex-connector[bot]")] | last | .commit_id'`
- **P20-3 · The live card-id migration's call site has no automated coverage** — the test
  environment has no IndexedDB, so `tests/card-id-migration.test.ts` cannot execute `getStore`'s
  call into `migrateStoredCardIds`, and that seam is where a shipped P1 defect lived. Add
  `fake-indexeddb` the next time anything touches profile-scoped storage.

### Product surfaces

- **P25-8 · Seven top-level nav tabs is still past comfortable — finish the IA consolidation pass** —
  `nav` in `src/layouts/Base.astro` lists Heute, Themen, Entdecken, Referenz, Üben, Fortschritt,
  Über; Prüfung was folded into Üben as its fourth sub-tab (PR #179, 2026-08-12) on the owner's
  ruling that exam training is training, not a destination. Owner judgement, 2026-08-11: "8 nav
  tabs is way too much" — the count is now seven, and the remaining pass is still **required before
  the next tagged release — the one that reports B1 complete**. First step: inventory the seven
  against actual necessity/traffic and propose a consolidated set (merge candidates, demote to a
  menu, or fold into an existing tab).
- **P25-1 · `/ueben/wortschatz` is a ~19,000 px flat deck list on a phone** — 22.3 viewport-heights
  at 390 px, one card per deck for the whole corpus, and every Wortliste wave makes it longer.
  Group by level with collapsed sections and/or a filter row. Evidence and method:
  [ux-audit-2026-08.md](quality/ux-audit-2026-08.md). First step: pick grouping vs filter (the
  Fortschritt vocab section's per-level summary is the in-house precedent).
- **P25-2 · Topic-page paradigm tables have no overflow container** — five per topic page, no
  viewport excepted; three-column paradigms fit 390 px by squeezing, and a wider paradigm clips
  with no gate seeing it. Fix once at the prose-table rendering layer in the topic template, never
  per-table. Evidence: [ux-audit-2026-08.md](quality/ux-audit-2026-08.md).
- **P25-3 · Sub-44 px touch targets on the daily loop's surfaces** — measured at 390 px: theme
  toggle 30 px, profile button 30, Eingabe mode chips 28, "Mark as learned" 26, taught-in chips 22,
  crumb links 17. Apply the existing `min-h-11 sm:min-h-0` pattern to the listed sites; one pass,
  no redesign. Evidence: [ux-audit-2026-08.md](quality/ux-audit-2026-08.md).

- **P24-5 · The one-pass derived cross-link graph, and a structured Referenz IA** — **subsumes
  P21-3**, and carries **P25-4** (reference pages run 9–13 screens with no in-page navigation — an
  anchor index rides on the IA pass, [ux-audit-2026-08.md](quality/ux-audit-2026-08.md)): no link
  from a topic to a Referenz page, none from Referenz back into the topics that
  teach a form, no topic-to-topic "see also".
  [ADR 0007](adrs/0007-derived-cross-links-never-hand-maintained.md) settles the how — every edge is
  **derived** from `focusIntroducedBy` (`packages/content/src/focus-tags.ts`), `deepens` edges and reference-data
  keys, never a hand-maintained list. **Shipped 2026-08-06** in two passes: five reference files
  carry a validator-checked page-level `focus` list rendered by `TaughtIn.astro`, `/referenz` is
  grouped by function, and every topic page carries a derived "Siehe auch" footer
  (`SeeAlso.astro` — Referenz pages whose keys the topic introduces, builds-on from drilled tags,
  both deepens directions). The same pass fixed the level-less `/topics/<id>` links that had the
  `TenseSystem` chips and the MixedTraining per-topic rows 404ing (`topicPath`, `src/lib/url.ts`).
  What remains here: the P25-4 in-page anchor nav, and finer-grained per-section edges where a
  page's data supports them (sentence-connector relations already have ids). Where an editorial
  relation has no data behind it, add the datum, not a link.
- **P23-1 · Six pages inline most of the corpus and run 4.6–10.7 MB of HTML** —
  `find dist -name '*.html' -exec wc -c {} + | sort -rn` over a current build: 162 pages at a
  137 KB median, but `/ueben/wortschatz`, `/session`, `/progress`, `/`, `/ueben/wiederholen` and
  `/ueben/training` carry **42 MB of the 68 MB** between them, and those six are the pages the daily
  loop starts from. Fix by not inlining the whole deck/item set into the island's props and fetching
  it per view; sizing that is its own task. Do **not** treat the service worker's byte budget as the
  fix.
- **P21-1 · Standard written forms are taught but never practised as forms** — the course teaches
  the parts (`content/reference-data/briefe.yaml`) and names the situations, but nothing asks the
  learner to *assemble* a Bewerbung, Beschwerde or formal e-mail with meaningful feedback. `write`
  cannot do it: minimal-ceremony by contract. Open question, not a decided design — an item type
  grading *structure* (required sections, in order, at one register) stays inside what a program can
  check, but a form task that graded *wording* would reject correct German at scale, so the seven
  placement-style rules need thinking through before any schema.
- **P21-2 · The written-forms material has no index** — `briefe`, the register conventions and the
  topics that use them are reachable only by knowing they exist. An Entdecken piece is the natural
  home. Sized small.
- **P20-1 · The A1 exam-practice surface has one entry point and one owner topic** — `/pruefung/a1`
  is linked only from `/about`, and all three sets declare `topic: freizeit-koennen` while their
  items name outcomes from six topics: accurate for `role: exam-practice`, but the `topic:` field
  then says something untrue. Both are shape questions — where exam practice belongs in navigation
  is a product call, and giving the role a level instead of a topic is a schema change.
- **P26-13 · The A2 and B1 exam trainers are unblocked** — the owner downloaded the remaining free
  goethe.de material on 2026-08-14, so `docs/GeotheInstitute/` now also holds `A2_Modellsatz_Erwachsene`,
  `A2_Uebungssatz_Erwachsene`, `b1_modellsatz_erwachsene`, `B1_Uebungssatz_Erwachsene` and four
  Hören tracks (A2 ×2, B1 ×2). `bun run exam:ingest` reads `exam-sources.yaml`, so extending the
  trainer past A1 is config plus the cue pass — and the cue pass is the expensive half: labels and
  boundaries proposed by `bun scripts/exam-cues-scan.ts` are guesses and must be **verified by ear**
  (or against word-level ASR, per the exam-cue note) before they ship. ADR 0009 holds unchanged:
  nothing these files contain, and no manifest reproducing their task texts, enters the repo.
  Inventory: `docs/GeotheInstitute/SOURCES.md`. **They anchor no grammar** — their "Strukturen" hits
  are Schreiben/Sprechen marking criteria, not inventories; the grammar anchors are the
  *Prüfungsziele*, and B1's is still unbought (P26-7).
- **P13-1 · Spoken-mode placement evidence** — document or prototype only when the app can collect
  mode-valid evidence; written selection must never masquerade as speech.
- **P13-2 · Next-level placement offer** — surface a newly available level test without hard-locking.
- **P5-7 · Listening retention pilot** — after the A1 gate, pilot only `termine-vereinbaren` and
  `reisen-verkehr`, then observe a complete 2/7/21-day cycle.

## Deferred

- committed neural-TTS expansion;
- pronunciation assistance;
- runtime mission grouping;
- branching missions.

These require a measured learning or usability need. They do not block the curriculum.

## Recently completed

- **P24-4 · Klassiker wave** (2026-08-06) — all ten classics live as extensive readings on their
  owning topics; four trimmed into the band; corpus source moved to `sources/klassiker/` (the
  home decision ADR 0006 deferred); `klassiker-lesen` Entdecken piece indexes the strand.

Detail in [the 2026-08 archive](archive/2026-08-backlog-shipped.md); closures before 2026-07-28 in
[the 2026-07-26 archive](archive/2026-07-backlog-full.md).

- **P24-7 (2026-08-06):** below 640 px the seven-link nav is a `<details>` disclosure — the trigger
  shows the active tab, the panel holds all seven links at equal weight (44 px targets, outside-tap
  and Escape dismiss, works without JS), ≥640 px unchanged; plus the Tippen-card spacing tightened
  (~35 px reclaimed) so prompt-through-insert-bar fits with the iOS keyboard up (real-device
  confirmation rides on the owner's next walk, same caveat as P24-10). The audit half of the entry
  shipped 2026-08-05 as [ux-audit-2026-08.md](quality/ux-audit-2026-08.md).
- **P24-6 · P24-10 (2026-08-05):** the mobile quick wins — `autoCorrect="off"` on all five exercise
  inputs (plus `lang`/`autoCapitalize` on FormFill), `Write`'s textarea suppresses autocorrect while
  **spellcheck stays on deliberately** (advisory-only assist boundary; flagged in the code); and the
  flashcard rating row is sticky above `env(safe-area-inset-bottom)` on phones — sticky over
  scroll-into-view because it also holds when the card back is taller than one viewport. Verified at
  390×844 with a long-note card.
- **P24-1 (2026-08-05):** the first-run gate offers optional sign-in below the first-class local
  path — providers from the session, absent when the deployment has none and in the desktop app;
  OAuth display name prefills the editable name field and nothing more; pending stated with the
  AccountPanel wording. The entry's one server-side question answered: **no Worker change** —
  `safeReturnTo` already accepts any same-origin path, so the gate signs in with the current page
  as `returnTo` and lands back in the gate.
- **P24-2 (2026-08-05):** sync state visible in the profile menu — pending/blocked from the session
  the menu already fetches on open, bound/never/synced-N-ago from the persisted sync state, no
  network request added. No persisted error variant on purpose: outcomes are ephemeral, and a stale
  "synced N ago" is the honest outage signal ADR 0004 wants. The force button was demoted in P24-3.
- **P24-3 (2026-08-05):** the merged Fortschritt/Konto surface — Konto merged into the Daten tab
  (no fourth tab, per [ADR 0005](adrs/0005-one-surface-for-fortschritt-and-konto.md) as settled),
  `/konto` now a query-preserving redirect, one snapshot-load path whose cloud push follows account
  state, and Übersicht reordered summary-first: activity card (stats + heatmap) on top, topic/POS
  vocab detail and the session table behind disclosures, the developer intro paragraph cut to one
  learner-facing line.

- **P22-1 (2026-08-02):** the reviewed unit listening corpus, **published** — 41 artifacts across
  all live units, every one human-approved and hash-bound to the bytes that shipped, with 17
  superseded TTS items retired against a per-item ledger
  ([audio-retirement-ledger.md](quality/audio-retirement-ledger.md)). The A1 Goethe pack (P19-6)
  remains open as its own task.
- **P22-2 · P22-3 · P22-4 (2026-08-02):** master/derivative split decided before the first commit;
  adapter switch can no longer save an unloadable payload; `bun tauri dev` serves recordings.
- **P3-6 (2026-08-02):** A1 retention cohort read on its gate date — missed both bars, rule amended
  to advisory. See [roadmap.md](roadmap.md#retention-gate).
- **P12-4 · P12-5 · P19-4 · P5-11d (2026-07-31):** focus evidence separated from answer constraints,
  inserted-token attribution, and probe arming keyed to exact verified items.
- **P19-1 · P19-2 · P17-6 (2026-07-31):** A1 backfill of the five late grammar points; honest audit
  label for the untagged A1 probe family; item-scoped document stimuli.
