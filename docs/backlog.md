# Backlog

The executable queue. The [roadmap](roadmap.md) owns direction. An entry is *what*, *why in one
line*, *where the evidence is* (a command or `file:line`) and *the first step*. A finished entry is
deleted in the change that finishes it; `git log` and [`../CHANGELOG.md`](../CHANGELOG.md) are the
record of what shipped.

## Doing

- **P27-3g · B1 topic-quality pass.** Every B1 topic gets the bounded whole-profile pass of the
  [content-quality contract](authoring/content-quality-audit.md), one topic per PR, in unit order;
  progress and per-topic results: [topic-quality-audit.md](curriculum/topic-quality-audit.md).
  Next: B1.16 `polizei-anzeige`.
- **P27 · Redaktion.** In [roadmap](roadmap.md#redaktion-p27) order: Themen workspaces (P27-3),
  the Materialien index (P27-4), Qualität and Referenzen (P27-5), hardening and macOS delivery
  (P27-6). Also owed: renderer parity — nine image and reference figures still use named semantic
  editor representations instead of the learner's React components; P27-1 close (subdividing
  over-broad grammar tracks, a persisted graph cache, point→focus→topic→material desktop tests,
  watcher tests, a packaged macOS smoke run); P27-2 next (structured controls over the same source
  buffer, visible background-job status). Track acceptance: traversal, symlink, type and size
  security tests; byte-exact no-op, stale-revision, invalid YAML/MDX and corpus-invalid-draft tests;
  all renderer fixtures; checkout, watcher, save, refetch and relaunch integration; keyboard and
  screen-reader navigation at 1440/1024/768; a `.app`/`.dmg` smoke build.
- **P9-2 · Entdecken pieces.** Recurring, one or two reviewed pieces per PR, each passing
  [future-content-directions.md](authoring/future-content-directions.md).

## Calendar gates

- **A2 checkpoint review.** Read the A2 checkpoint's 2/7/21-day evidence as a B1 revision trigger.
  `bun run progress:audit --profile vitaly --pull` says whether it can be read yet.
- **P5-11 · Evidence cadence.** Drain the grading queue, rerun `bun run progress:audit --profile
  vitaly`, then decide whether content or drills need revision — never from a pre-triage weak-focus
  table. Standing read: every persistent weak tag has a serving drill, so the owed action is the
  learner taking training; production assembly (`translate` under `cloze` and `mc`) is the durable
  weakness. Confirm both against the current audit before acting on either.

## Open

### Content

- **C6-1 · RU/UK calque review.** Instrument: the `textbook-text-reviewer` → `textbook-text-editor`
  loop ([article-prose.md](authoring/article-prose.md)), then a fresh verify; two edit cycles at
  most. Eight B1 units remain — all but `digitales-leben`, `kultur-freizeit`, `geld-vertraege`,
  `erfahrungen-erzaehlen`, `leben-veraendern`, `meinung-medien`. Every unit reviewed so far had a
  material defect, usually a false fact inherited from the EN half. No structural screen predicts
  it, and authoring order does not either. Rides on P27-3g.
- **A name in a Cyrillic prompt leaves its spelling free.** «Айлин» is Aylin, Ailin or Eilin and
  «Клара» Clara or Klara, so a `translate` item whose answer names a person grades a spelling its
  RU/UK prompt never gave. Two items now write the name in Latin script
  (`a1/wortbildung-ausblenden:translate-fahrerin`,
  `a2/freunde-feste-produktion:uebersetzen-transfer-blumen-karte`). First step: list the translate
  items whose answer holds a name with more than one German spelling.
- **P26-11 · B1 has one drill set** against A2's thirteen (`grep -l '^role: drill'
  content/exercises/b1/*.yaml`), so the remediation channel is unbuilt there; P23-3 sees it from the
  other end. B1 depth now reads median 6 items per confusion, 2 tags at ≤3 items, 1 tag in a single
  file (`bun scripts/grammar-depth.ts B1`). New drills also raise the floors in
  `tests/grammar-depth.test.ts`.
- **P26-12 · B1 pretests carry no focus tags** (A1 27, A2 72, B1 0 tagged items). Nothing is
  mis-measured — pretests are never weakness evidence — but an instrument reading pretest tags sees
  one blind level. Decide the convention, then make the three levels match.
- **P18-3 · B1.1–B1.2 competences without delayed evidence.** One three-variant family per
  competence is the contract. First step: list each unit's points against its shipped families, and
  capture `armedAt` before and after any new one.
- **P18-1 · `explain` prose length.** Mean EN `explain` over `role: practice` sets runs A1 28 words,
  A2 53, about 110 in B1.4/B1.5 (whitespace-separated words over `explain.en`); feedback is read
  after an error, when attention is scarcest. First step: set a target in
  [item-authoring.md](authoring/item-authoring.md), then revise the B1 non-`produktion` sets.
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
- **Three Sprachhandlungen have no outcome** — interkulturelle Begegnung, Wissensdivergenz, Gefühle
  ausdrücken (`bun scripts/handlungen.ts B1 --unclaimed-only`). Not turn management, so not
  `gespraech-steuern`'s; they want a topic of their own.
- **P26-7 · Buy the stronger higher-level anchors:** the Goethe/ÖSD B1 *Prüfungsziele* (ISBN
  978-3-19-031868-1) and *Profile deutsch* (ISBN 978-3-468-49410-9); also the adult Goethe A2
  *Prüfungsziele* (the free A2 list is the youth exam). Each becomes one
  `data/strukturenlisten/*.yaml` whose entries start `unclaimed`.
- **P26-13 · A2 and B1 exam trainers.** The material is in `docs/GeotheInstitute/`
  (`SOURCES.md`); extending `exam:ingest` is config plus a cue pass whose labels and boundaries must
  be verified by ear or word-level ASR. ADR 0009 holds: nothing from these files enters the repo.

**B1 findings below the material bar**, from the topic-quality pass:

- `b1/erfahrungen-erzaehlen`: "the thirteen verbs … cover most narration" overreaches; the
  `-produktion` header comments describe an interview no longer in the set; `hoeren-diktat-zug`
  claims `interview-verstehen`; `muendlich-nacherzaehlen` is tagged on a written cloze and two
  reading questions; the primary set's "participle first" instruction hands over the order its
  explain teaches; `frage-reihenfolge` can be answered by copying; the reading's EN gloss should
  be "What has Daniel been doing since then?"; `drill-temporal-nebensatz` blames a correct
  *Bevor er heimging* on the tag; the `nachdem` probe's variant-b rejects *ging alles ganz schnell*.
- `b1/leben-veraendern`: "-es when the noun has one syllable" (required only after an s-sound);
  *Kurz gesagt* omits weak nouns from the masculine/neuter -s rule; "*who* never changes" against
  the article's own *whom*; "no colloquial escape hatch" (regional *wo … mit*); a straight `"` in
  „wessen?"; the EN anti-model "the street we lived in"; `mc-auf-die` tense clash (*seit zwei
  Wochen warte*); "never *des Gartens Größe*" (literary, not impossible); probe header comments
  count three families where there are four; the listening set tags comprehension questions
  `spoken-production` and its scenario is not the unit's; the `gewöhnen` note says "always
  reflexive"; the `zentral` RU/UK example; the `Gegend` and `Wohngemeinschaft` glosses run long.
- `b1/gesundheit-wohlbefinden`: *Kurz gesagt* runs 116–125 words, 6 sentences; "it never changes
  … takes second position" against *Lass uns …* in the same section; RU/UK call «я проверяю зрение»
  reflexive; probe headers count three families of four; a comment in `klassiker-10-das-kalte-herz`
  calls *könne/müsse/sei* Konjunktiv II (they are Konjunktiv I) and an explain there adds "bought
  from rich men before Peter"; reading explains add claims the text does not
  make; the reflexive probe's *Schmerzmittel* reads as medication tolerance; `ls-…-hoeren` q2
  repeats the audio's last line; *Ich freue mich bereits auf* is rejected.
- `b1/arbeit-bewerbung`: "the verbs never survive translation" (rarely); the table note promises
  an address row it lacks; plural *mit den Kunden* cited as n-declension evidence; *Buchstabe*
  called abstract; a DE explain says *deinen* for *Ihren*; *Position* rejected though the *Stelle*
  card glosses "position"; probe headers claim carrier lexis is fresh when *Kunde* and
  *Verantwortung übernehmen* appear in arming items; `nomen-verb-verbindung` is thin (4 items, B1
  median 6); the reading's ad lacks (m/w/d); *Kündigungsfrist* in the listening script against the
  unit's labour-law exclusion; the unit has five casts rather than one mission scenario.
- `b1/konsum-umwelt`: *leeren* (*geleert* ×7, produced in `uebersetzen-tonne-august` with the
  verb named) is on no Wortliste and in no deck; the `regional` note puts *die Region* at A2 (it
  is B1) and the `Sonderangebot` note *das Angebot* at A2 (A1); the primary set's and two probe
  headers say outcomes arm the families (arming is by item key since P19-4), probe headers and
  the provenance record count three families of four; who drafted the UK/DE halves and the fourth probe family is not in the provenance record; C6-1
  still owed.
- `b1/regeln-verantwortung`: *brauchen nicht zu* (A2 `nicht-brauchen-zu`, the released duty) is
  rejected by every *muss nicht* translate item in the corpus — here `uebersetzen-miete` and the
  dürfen/müssen probe's variants a and c, at A2 `modalverben-produktion` and `probe-arbeit-beruf` —
  an accept ruling owed corpus-wide (this unit's predicates already read it as retained);
  *streichen* (now named), *sperren* (the dictation, two article examples) and *abstellen* (article,
  reading, write task, placement) are on no Wortliste and in no deck; *Treppenhaus* is produced in
  `uebersetzen-rauchen` but carded recognition-only; neither the article's agreement rule nor the
  `uebersetzen-rauchen` explain says why the modal stays singular in a subjectless passive (the
  logged *dürfen nicht geraucht*); the *Feinheiten* calls
  *so dass* the "ältere Schreibung" though it remains a current variant; the *werktags* note sets
  Monday–Saturday beside an everyday *Montag bis Freitag*; the primary set's and the three probe
  headers say outcomes arm the families (arming is by item key since P19-4); the `frage-aufzug` DE
  explain reads "mit der Verbkette und kann ganz am Ende"; C6-1 still owed.
- `b1/reisen-probleme`: the RU/UK *Häufige Fehler* say «бы» from the first half seems to cover the
  whole sentence, against their own *Erklärung* («бы» stands in both halves); *Ich an deiner Stelle
  würde …* is charged to `konjunktiv2-ratschlag`, and *bei dem Hotel* (ruled unobjectionable on
  2026-08-03) and *… beim Hotel sofort beschweren* are rejected in `uebersetzen-an-deiner-stelle`;
  the drill's `uebersetzen-bus-taxi` rejects *bräuchte … kein Taxi zu nehmen* (the corpus-wide
  *brauchen nicht zu* ruling above) and `uebersetzen-freier-tag` *einen Tag frei hätten*; the
  polite-form probe's variant-a EN explain reads "a plain konnten-less indicative"; the `Empfang`
  note puts *Rezeption* at A2 (it is an A1 card); the Hören script states compensation rules (25 %
  from 60 minutes, hotel costs up to 80 euros) against the brief's compensation-law exclusion, and
  Frau Kraus is a second cast beside Lena's arc; the primary set's and the three probe headers say
  outcomes arm the families (arming is by item key since P19-4); `focus-tags.md` still has
  *trotzdem* opening a new main clause (`praeposition-genitiv`) and filling its position 1
  (`obwohl-trotzdem`); C6-1 still owed.
- `b1/lernen-zukunft`: `damit-um-zu` is not in `insertionErrors`, so `validate` does not require
  predicates on its translate probes — `probe-bildungswege` variant-a reads *damit die Kinder es
  zu verstehen* as an unattributed miss today, which the retention table counts as retained; the
  production header describes a `hoeren-beratung` item the set does not hold; the primary,
  production and three probe headers say outcomes arm the families (arming is by item key since
  P19-4); the Hören q1 explain says advice sessions "almost always" end with an ordered pair; the
  EN article's "in case" for *falls* reads in British English as a precaution, not a condition;
  the `sprechen-abendkurs` DE prompt's "ohne was du nicht entschieden hast"; C6-1 still owed.
- `b1/gesellschaft-zusammenleben`: Herr Weber votes for the playground in `hoeren-abstimmung`,
  demands the whole courtyard as parking in `sprechen-einwand` and "war dagegen" in the *dagegen*
  card's example — one name, two positions; the `hoeren-abstimmung` instruction ("votes for
  something else") rules out one option before the audio plays, and its closing *Die Mehrheit ist
  für den Spielplatz* points at the answer without the *obwohl* decoding; `frage-einwand`'s key
  copies the reading's sentence word for word; the reading's *einen Kompromiss vorgeschlagen, was
  … alle überzeugt hat* reads more naturally with *der*, since the compromise convinced and not the
  proposing; *Bewohner*, *Spielplatz* and *Grill* are produced in translate items but carded
  recognition-only; the *dagegen* RU gloss «зато» names *dafür*'s
  compensation, not *dagegen*'s contrast; the *Gemeinschaft* note calls *gemeinsam handeln* "the
  verb behind it"; `match-redemittel`'s explain gives a discussion "five moves in a fixed order";
  the speaking checklist and the `konjunktionaladverb-inversion` tag row name only
  position 1 for *trotzdem*; the primary and production headers say outcomes arm the
  families (arming is by item key since P19-4); C6-1 still owed.
- `b1/digitales-leben`: the reading's *Schildern Sie …, sodass wir Ihnen schnell antworten
  können* states an aim after an imperative — *damit*'s job (B1.9) — and `frage-kontaktformular`'s
  explain and the *sodass* probe header lean on it; `uebersetzen-sodass-software` and the *sodass*
  probe's variant-c pin the lexical verb at the wall, and the passive items their named
  participles, so a swapped or passive verb in the right slot (*gestartet wird*, *gewählt*,
  *abgesendet*) is charged to `sodass-folge` or `passiv-bildung` — predicates owed if the log shows
  it; "never *ladet*" (*Feinheiten*, the *aufladen* note) against regional *ladet*; the EN *Häufige
  Fehler*'s "No English verb changes its stem vowel in the third person" (*does*, *says* in sound);
  the *Netz* note and *Feinheiten* row say everyday German does not separate reception, WLAN and
  internet (*kein WLAN*); the *Akku* note's "die Batterie you throw away" (*Autobatterie*); *Software*, *Menü* and
  *sichern* are produced in translate items (named in the instruction) but carded
  recognition-only, and *mitnehmen*, *abschicken* and *Neustart* are named and produced but on no
  Goethe list and in no deck; C6-1 still owed.
- `b1/kultur-freizeit`: `mc-eintritt-preise`'s key names *Schüler und Studenten*, which its
  programme line does not say, and its explain says the line defines the group; the speaking
  checklist's "*Bescheid* … closes the sentence" (an *ob*-clause follows it), the article's
  "everything else stands before it" and the card's "never after" against colloquial
  Ausklammerung; the *Vorstellung* note puts the idea sense only in *sich etwas vorstellen*
  (*keine Vorstellung haben*); the EN *Häufige Fehler* says *Wir haben gut amüsiert* means the
  audience was amused by us; still rejected, unattributed: the marked orders *Nur eine Stunde
  dauerte die Führung* and *Wir warteten vor dem Saal lange*, *Sitzplätze* and *Eintrittskarten*
  in the probe's variant-c, *den ersten Teil* for "the first half"; *Im kleinen Saal war es ein
  gemütlicherer Abend* (drops the "we" both prompts now carry) is charged with its comparative
  intact; a cloze charges its gap for a well-built comparative of the wrong adjective
  (*besseren* for *schöneren*) — no cloze predicates exist; C6-1 still owed.
- `b1/geld-vertraege`: the EN article's "Four lines out of ten are filing" is a ratio nobody
  counted (the RU/UK/DE halves name the head data instead), and its DE half says a low monthly
  price *versteckt* the extras where EN says "may"; `cloze-kunde-deklination`'s article gaps log a
  case slip (*den* for *dem*) under `n-deklination` — no cloze predicates exist; still rejected,
  unattributed: *Dem Kunden erklärt der Anbieter …* and *Erst prüfe ich …* (invited by no prompt),
  *ist auf der Quittung* for *steht*, *gezahlt werden* where `uebersetzen-passiv-frist` names
  *bezahlen* (*die Rechnung zahlen* is correct German and a course card); `pre-mc-tarife` asks
  what one pays and its options answer which plan is cheaper; the *versäumen* note gives a train
  only *verpassen*, against Austrian *den Zug versäumen*; the *Kündigung* gloss is definitional;
  the same missing "numbers as words" DE half sits in `b1/kultur-freizeit-produktion`
  `hoeren-diktat-treffpunkt` (*acht* typed as *8*).
- `b1/informationen-vermitteln`: the Angaben probe's variant-b charges *in de Küche*, a typo in a
  phrase its instruction prints — no cloze slip rule or predicates exist; per-gap alternatives in
  `cloze-angaben-reihenfolge` and that variant pass a doubled phrase; the article's te-ka-mo-lo
  section names two forces that move an Angabe, and the items now accept a third (a manner word
  before the participle); the showcase's *kurz* answers *wie lange?* as readily as *wie?*; the article's DE
  half and the `mc-konjunktiv1-lesen` DE explain still relay with "dass und Präsens"; the *Vortrag*
  note's "never *machen*" and the *Ansage* note's platform rule (*Bahnhofsansage*); the production
  header has the Hören's day and deadline two turns apart (they share one); the write model's
  "gut zwei Wochen" is a span its prompt never gives; C6-1 still owed.
- `b1/unfall-notruf`: a cloze, order or table item still charges any wrong gap or chip to its
  tag (`cloze-nachdem-sein`, `cloze-angaben`, `table-angaben`, `order-nachdem`) — no predicates
  exist for those islands; `cloze-nachdem-sein`'s *Nachdem wir angekommen waren, war die Straße
  schon gesperrt* (also in the article's table) reads more naturally with *als*, as its own
  translations do ("by the time", «к тому времени как»); the reading's third explain says the
  two tenses carry the sequence "on their own" (*nachdem* says it too); the `uebersetzen-angaben`
  and `uebersetzen-hergang` instructions keep every detail behind the verb while each accepts the
  fronted time; still rejected, unattributed: *heute früh* for "this morning", *Mein Kopf tut mir
  weh* (the course calls the doubled possessive unidiomatic); the *Tod* note's "an tut sterben is
  not German", the *körperlich* note's "do not use it of a physical object" (*körperliche
  Gegenstände*), the *Infektion* note's computer-virus rule; the `koerper-medizin-b1` header
  still calls the deck unowned, though this topic adopts it; C6-1 still owed.

**A2 findings below the material bar**, for the next time each file is touched:

- `a2/natur-wetter`: *Kurz gesagt* says every weather kind offers three words (its own table
  disagrees) and omits the comparison outcome; the table's Wind row has no verb while *weht*
  parallels *scheint*; "masculine measurement nouns" (neuter ones behave the same); the landscape
  explain says neither plural adds a syllable (*Bäume* does); `diktat-wetter` counts toward a
  reading outcome; the speak model lacks the *als* its checklist asks for; stale header comments
  in the production set and pretest; `uebersetzen-es-regnet` rejects *fast täglich*; *Wetterlage*
  and *ringsum* are above A2; the reading runs 163 words with an unglossed *roch*; the
  *wunderschön* example translates as "wonderful"; vocab notes say *bewölkt* has no -ig twin and
  some weather adjectives never stand without *es*.

- `a1/ort-richtung-praepositionen`: the *zu – bei – von* row is labelled **Person** only; the
  *zu*-taking buildings live as four Feinheiten exceptions.
- `a2/zeit-praepositionen`: `uebersetzen-von-bis` drills the A1 `von-bis-in-zeit` chunk under
  `zeitangaben-system` — resolvable only with P25-15; "Zeit ohne Präposition" lacks the duration
  member (*drei Tage*, *den ganzen Tag*).
- `a2/verben-mit-kasus`: add an an+Dativ Feinheiten line when *teilnehmen an* arrives.
- `a2/probe-man-und-besitz-genitiv::probe-genitiv-von-kollegin` rejects the correct genitive
  *das Buch meiner Kollegin*; accepting it drops the pinned `von` — a design decision.
- `a2/trennbare-verben`: the inseparable-prefix list reads as closed (no *emp-, miss-, zer-*).
- `a2/drill-dativ-ausloeser::cloze-nach-durch-park` and `a2/hoeren-dativ::hoeren-rufst-ihn` declare
  dative outcomes on accusative contrast items — decide whether contrast evidence counts.
- `a2/alltag-tagesablauf`: the sequencer list omits *zuletzt/später/schließlich*.
- `a2/modalverben`: no modal without infinitive (*Ich muss nach Hause*), no offer *Soll ich …?*.
- `a2/perfekt-haben-sein`: *werden* (*ist … geworden*) is in no *sein*-class list or table.
- `a2/drill-wo-wohin::uebersetzen-bahnhof` pins `am` while the article licenses emphatic *an dem*.
- `a2/einkaufen-reklamation`: "not *hundertundeins*" overstates — it is attested; one Feinheiten
  row mixes „ with a straight quote.
- `a2/adjektive-deklination`: heading "fast immer -en" (7 of 12 boxes); the `write-zimmer-beschreiben`
  model uses B1 *ein helleres Zimmer*.
- `ls-*-hoeren` sets carry above-A2 lexis in three topics (arbeit-beruf, nebensaetze-plaene,
  infinitiv-mit-zu); no key hinges on it — one family-wide pass.
- `a2/verben-mit-praepositionen` names *nach* as a dative governor with no *nach* verb anywhere.
- `a2/probe-verben-mit-praepositionen-wahl`: UK explains contrast with Russian, not Ukrainian.
- `a2/probe-arbeit-beruf-anrede` variant-a renders *können Sie* as "could" / «пришлите».
- `a2/arbeit-beruf`: "one letter apart in English"; "the one verb group with no ending" (*wissen*
  is the other Präteritopräsens).
- `content/vocab/arbeit-beruf.yaml` `melden`: `valence: "+ Akk"` beside a dative-recipient example.
- `a2/infinitiv-mit-zu`: the "auch nach gehen und fahren" table omits *bleiben/lassen/sehen/hören*.
- `a2/gesundheit-arzttermin` teaches the whole `da(r)-` system a topic early.
- `a2/relativsaetze-produktion::uebersetzen-definition-fahrrad` uses *jemanden* before it is taught.
- `a2/verbindungen-folgen`: "same meaning — *obwohl*" invites *Trotzdem es geregnet hat*.
- `a2/man-und-besitz`: endingless *jemand* allowed in the dative too; a B1 *keiner* distractor.
- `a2/lernen-verstehen-produktion`: a stale header comment describes a different recording task.
- `a2/lernen-verstehen`: "a Nebensatz may never begin with the verb" is an A2 simplification, not a
  law; UK half at `lernen-verstehen.mdx:203` calques the RU point.
- `a2/lernen-verstehen::cloze-du-oder-sie-fragen` rejects the politer *könnten Sie*.
- `a2/aemter-dienstleistungen::table-hoefliche-chunks` scores the article's own *Ich möchte* wrong;
  the `anmelden` note describes only the reflexive use.

### Learner feedback

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
- **F-5 / F-13 · Cloze grades capitalisation the gap position made unpredictable.** `answerMatches`
  (`packages/grading/src/cloze.ts`) is case-sensitive with no sentence-head fold, unlike
  `gradeTranslation`; 66 of 645 cloze items open a gap at a sentence head, three hand-patch both
  cases (`{{Der|der}}`), and `probe-reisen-probleme.yaml:72` gaps *Könnten* after a colon. First
  step: move `sentenceInitialIndices` into the cloze path or document the hand-patch, then re-author
  the probe.
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
- **F-14 · A `table` cell has no `accept`**, so a correct alternative form is wrong: the
  du-imperative *gehe*, *trinke*, *bleibe* beside *geh*, *trink*, *bleib*
  (`a1/stadt-wege-a1-grammatik:imperativ-drei-formen`, `a2/gesundheit-arzttermin:table-imperativ`).
  First step: an optional `accept` on a cell, read by `acceptedCellAnswers` (`src/lib/table.ts`) so
  `validate.ts` and `TableFill` cannot disagree.

**Ruled, no change** — so they are not re-triaged:

- *in die Führung* vs *zur Führung* is a curriculum gap (F-10), not an accept-list gap.
- `freunde-feste.yaml:266` rightly rejects a time outside the reason clause.
- *Katze*, *Hund*, *Pferd* stay at A2: the Goethe A2 Wortliste places them, and moving a word
  resets its cards.
- A Wortliste key stays bare even when the verb is used reflexively (`gewöhnen`, `kümmern`): the
  key is the manifest's. What the learner reads is derived — a `valence` that leads with `sich`
  shows `sich gewöhnen`; a dual valence (`beschäftigen`: `+ Akk / sich …`) stays bare.
- `a2/lernen-verstehen-produktion:uebersetzen-anfrage-sprachschule` asks two questions on purpose.
- "Fortschritt konnte nicht geladen werden" is a local IndexedDB read, never the network
  ([ADR 0018](adrs/0018-progress-reads-recover.md)).

### Product surfaces

- **P25-8 · Seven top-level nav tabs** (Heute, Themen, Entdecken, Referenz, Üben, Fortschritt,
  Über; `src/layouts/Base.astro`) is still too many, by owner ruling; required before the release
  that reports B1 complete. First step: inventory the seven and propose merges or demotions.
- **P25-1 · `/ueben/wortschatz` is ~22 viewport-heights at 390 px**, one card per deck. Group by
  level with collapsed sections, or a filter row; the Fortschritt per-level summary is the precedent.
- **P25-3 · Sub-44 px touch targets on the daily loop.** Re-measure at 390 px, then apply the
  `min-h-11 sm:min-h-0` pattern; one pass, no redesign.
- **P24-5 · Cross-links and Referenz IA, what remains.** In-page anchor navigation for the long
  reference pages, and finer per-section edges where the data supports them
  ([ADR 0007](adrs/0007-derived-cross-links-never-hand-maintained.md): add the datum, never a link).
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
- **P26-16 · Redaktion rebuilds the whole corpus after a one-field write** — ~6.6 s for the next
  `/__graph` plus ~6 s of validation. Invalidate per file and verify only the touched file's rules,
  before the editable-field allowlist grows.
- **Schreiben helper.** A learner-facing Goethe A1 Schreiben scoring and strategy note lived in the
  dev docs (`git show 2fbdfa2:docs/a1-goethe-schreiben-helper.md`). If it is wanted, it becomes an
  in-app page.

### Instruments and gates

- **P30-3 · TypeScript 7 waits on `astro check`.** TS 7.0.2 already checks the four projects with
  0 errors (`for p in tsconfig.json worker/tsconfig.json apps/tonwerk/tsconfig.json
  apps/redaktion/tsconfig.json; do bunx --package typescript@7.0.2 tsc --noEmit -p $p; done`), but
  `@astrojs/check` peers `^5 || ^6` (withastro/roadmap#1321;
  `npm view @astrojs/check peerDependencies`). When it allows 7, bump `typescript` in both
  `package.json` files. `bun audit` reports one moderate build-time advisory,
  `postcss-selector-parser` 6 via `@tailwindcss/typography`.
- **Grading rulings carry no item revision, so a probe cannot be repaired past one.** An
  `accept` ruling must pass today's grader (`packages/content/src/grading-decisions.ts`), so
  once a ruling accepts a rendering, the item can never stop accepting it. Found on
  `a2/probe-natur-wetter:variant-a`: *Am Dienstag regnet es den ganzen Tag* is almost the practice
  cloze `cloze-es-umgestellt` word for word, so the probe can be answered from memory of it — but
  the 2026-08-26 ruling accepting exactly that rendering blocks changing the carrier. First step:
  give a ruling an optional `revision` and check `accept` only against that revision.
- **Owner decision: does the `da-weil` probe grade a preference?** `focus-tags.md` says *weil* is
  grammatical wherever *da* is, so an item may grade only a forced choice, and practice
  (`cloze-da-weil-bekannt-neu`, `-produktion::cloze-da-weil-transfer`) accepts *Weil*; but
  `probe-meinung-medien-da-weil` variants b and c, under the same instruction, accept only *Da*.
  Either key the practice gaps `{{Da}}` and amend the tag rule to "or the direction the instruction
  constrains", or let the probe accept *Weil* (then only variant-a measures). Also: who drafted
  this unit's UK/DE halves and ran its C6-1 review is not in its provenance record.
- **The grader's closed-class guard lacks *dies-*, *jed-*, *welch-* and *euer*.** `CLOSED_CLASS`
  (`packages/grading/src/production.ts`) lists articles, possessives and pronouns, so `den` for
  `dem` is a choice; but *dieser* for *dieses* is one edit and forgiven as a slip, although
  `demonstrativartikel` and `interrogativartikel` grade exactly that ending. Found on
  `b1/drill-irreale-bedingung:uebersetzen-zimmer-balkon`. First step: add the four paradigms and
  run the determiner-twin sweep for renderings the change newly rejects.
- **The grading queue reads predicate-bearing items through `key_tokens` alone.** `gradingReview`
  (`scripts/progress-audit.ts`) queues a rejected rendering and re-attributes a confirmed one with
  `gradeTranslation`, while the runtime logs the item's `focus_evidence` verdict. Routing it through
  the predicates queues 2 more renderings today, both on `a2/drill-zu-infinitiv:uebersetzen-formular-auszufuellen`
  (a misspelt pin the predicates call `unknown`); no probe row moves. Decide whether such a miss
  belongs in the review queue before wiring it.
- **A probe's arming contract pins a tag on an item that should not carry it.**
  `b1/arbeit-bewerbung-produktion::hoeren-interview-verstehen` is a speaker-attribution listening
  item tagged `nomen-verb-verbindung` (its own explain says so), but it is in that probe family's
  `arming:` list, and the validator requires arming items to carry the family's focus. Removing it
  moves the family's clock: measure `armedAt` on a current snapshot before changing either.
- **A reordered main clause is blamed on the relative pronoun.** The misplaced-token check
  attributes a correct rendering whose main clause is reordered (*Jetzt helfen mir die Kollegen,
  denen …*) to the pinned token's focus, because the token count is unchanged. Every
  relative-clause translate item can hit it; `b1/leben-veraendern-produktion::uebersetzen-transfer-kollegen`
  now accepts the fronted order by hand. First step: measure how many confirmed rejections in
  the attempt log are reorderings of an unpinned clause.
- **P23-3 · Six of the seven tags the runtime prioritises have no drill, all B1.** Cross
  `weakFocuses` (`src/lib/weakness.ts`) with every `role: drill` item's `focus`. `weakFocuses` (last
  ~30 attempts, ≥35% errors) and the audit's `persistent` table disagree, and neither is wrong. Take
  one drill per evidence read, never six at once.
- **P25-9 · Band 1 re-deals a failed item ahead of its own drill.** `buildSession`
  (`src/lib/training.ts`) serves last-wrong items first, so `uebersetzen-waehrend-regen` was failed
  in nine sessions running while all eight items of `drill-temporal-nebensatz` sat unserved; the
  delayed probe on the same competence runs 2/2. The fix is selection — cap re-deals, or let a due
  drill item of the same weak focus preempt band 1 — measured on the deal distribution before and
  after.
- **P25-7 · Slip-forgiveness stops at `key_tokens`.** Four confirmed rows where every graded token
  was right and one typo elsewhere sank the rendering (`data/grading-decisions.yaml`, decided
  2026-08-11). Measure every historical confirm whose only divergence is outside `key_tokens` before
  changing the scorer — invented fixtures got this trade-off wrong twice.
- **P25-15 · A probe family logs a sub-confusion on its umbrella tag.** The validator holds variant
  `focus` equal to the arming set's, so `a2/probe-zeit-praepositionen` variant-a (seit/vor) and
  variant-b (am/um) both log as `zeitangaben-system`.
- **P23-2 · A revision bump that only widens `accept` stops the retention table re-grading.**
  `classifyProbe` (`scripts/progress-audit.ts`) replays an attempt only when `itemRevision` matches,
  else falls back to the stored tag. One measurement found no row affected; verify before acting.
- **P5-11b · Mode coverage is checked at A1 only** — items declare `target_mode` and validation
  requires each A1 outcome's mode to be practised. First step: decide whether an outcome must name
  the mode it is measured in, then extend the check to A2 and B1.
- **P12-6 · Dictation focus attribution at A2/B1** keeps `dictationSlip`; silencing unmatched misses
  without predicates inverted the weakness signal. First step: `focus_evidence` predicates for the
  ~50 focused A2/B1 `listen` items.
- **P12-7 · An accept list is closed by its declared product**, never by enumeration: the
  dimensions the item's own answer, accept and explain present as equivalent, each verified through
  `gradeTranslation`. Beyond that, name the token in the `instruction` when it carries the focus, or
  accept the sibling.
- **P5-11c · The connector-determinacy check does not reach cloze gaps.** Read the comment above
  `INTERCHANGEABLE_CONNECTORS` first (`da` is absent on purpose); a cloze version needs sense
  disambiguation.
- **P22-9 · Markdown emphasis in a YAML text field renders as asterisks.** `*` is also the
  ungrammaticality marker (64 correct uses); emphasis *closes*, the marker never does. Verify a rule
  against both sets.
- **P22-11 · No detector for two vocab entries answering one production prompt**
  (`Angebot`/`Sonderangebot` was found by the learner). Respect parentheticals, require mutual
  overlap, triage against the lapse table; `Stock`/`Stockwerk`/`Etage` needs an editorial ruling.
- **P22-19 · An audio-only topic escapes the item-mix bar** (`scripts/validate.ts`: the
  `practiceItems` guard runs on the audio-filtered list). Unreachable today. Decide *whether the topic
  has practice* from the unfiltered list.
- **P22-12 · The positional-option rule cannot see a bare ordinal**
  (`src/lib/option-references.ts`); needs sense disambiguation.
- **P24-8 · `bun run gen:ipa` writes a duplicate `ipa:` key when a comment precedes the field**, and
  YAML keeps the last one, silently replacing a reviewed transcription. Until fixed, run it with
  `--only <deck>`. Make the writer idempotent, and make duplicate keys fail `bun run validate`.
- **P24-9 · Article comprehensibility is measured but uncalibrated.**
  `bun scripts/comprehensibility.ts --rank` has never been checked against the owner's
  felt-difficulty list. Then learner evidence: a per-topic pretest → first-practice accuracy delta in
  `progress:audit`.
- **P25-13 · The real store round-trip test is skipped on CI** (`test.skipIf(CI)`): a fake-indexeddb
  scheduling race on Linux runners, never on macOS. On each bun upgrade, drop the `skipIf` in a draft
  PR and see whether it is gone.
- **P20-3 · The live card-id migration call site has no automated coverage.** Add `fake-indexeddb`
  coverage the next time profile-scoped storage changes.
- **P12-8 · The two answer highlights come from two LCS runs** in `Translate`, so a transposition
  can mark different words on each side. Display only; return both arrays from one traversal in
  `packages/grading/src/worddiff.ts`.

### Desktop and storage

- **P29-1 · A bundle-less run uses a second WebKit container** (`~/Library/WebKit/deutsch-atlas/`
  instead of `dev.nonvision.deutsch-atlas/`), holding a frozen copy of the profile. It is detected
  and reported on Fortschritt → Daten (`legacy_webkit_container`, `src-tauri/src/main.rs`); what the
  learner should do about it is undecided, and merging two histories must never be automatic.
- **P29-3 · `AccountPanel.bind()` decides a warning from an unguarded read.** A stalled
  `getAttempts()` reads as "nothing to merge" and binds a device with history silently. Fix with
  `withReadRetry` and an explicit failure that decides between warning and refusing.
- **P30-1 · A card grade rewrites the whole `cards` blob** (~784 KB), because progress lives under
  six keys. Per-record keys would touch every read path, the snapshot format and sync — worth it
  only if measured write latency says so.
- **P30-2 · `scheduleAutoSync()` fires once per queued waiter, not once per commit.** The debounce
  absorbs it; move the call to the batch boundary.

### Tonwerk and audio

- **P28-8 · `scripts/validate.ts` predates consented cloning and manifest v2.** Allow
  `voice_cloning_used: true` with a non-empty `consent_sha256` list, and check a v2 manifest's
  `version`/`scene_sha256`. Lands with the first real scene publish.
- **P28-3 · One `qa_json` per scene revision, but renders are per variant.** Key it by variant in
  `scene_revisions` before difficulty variants ship.
- **P28-4 · `renders/` has no reaper and no disk figure.** First a `renders du` figure in the
  dashboard, then a keep-last-N decision.
- **P28-2 · A scene ending on its last word has no reverb tail** (`afir` truncates at EOF). Pad the
  dialogue bus with silence ≥ the room's decay before convolution (`graph/render.py`).
- **P28-1 · Legacy `--json` CLI verbs can emit corrupted JSON** under a real engine (a banner on
  stdout). Apply `_only_json_on_stdout` (`scene/cli.py`) to the legacy verbs that survive, drop the
  rest.
- **P22-14 / P22-16 · Delivery timing.** Per-line lead and trail silence compound with
  `pause_after_ms` (~1.4 s dead air at a normal turn), and pace and pause do not vary by level.
  Both re-synthesise and invalidate approvals, so pay for them in one between-waves pass. Measure
  words per second of voiced audio (median 2.96).
- **P22-10 · Nothing compares a recording's length to its planned window**
  (`data/listening-plan.yaml` `duration_seconds`; `tools/listening-studio/authoring/audio_report.py`).
  Fix the script, never the window; start with `ls-lernen-zukunft-01` and `ls-arbeit-beruf-01`.
- **P22-20 · The Qwen download is unpinned** (`scripts/download-qwen3-tts.py` calls
  `snapshot_download` with no `revision`) while the loader accepts one revision only. Pass it.
- **P22-18 · `soundfile` is pinned at two versions** (`pyproject.toml`/`uv.lock` 0.13.1,
  `requirements-qwen-runtime.txt` 0.14.0). Pick one; do not refresh the committed manifests'
  `dependency_lock_sha256`.
- **P22-15 · The Studio cannot author a `uk` half**, so the 246 hand-authored `uk` fields exist only
  in the published YAML. Add the column to the question editor and `uk` to `draft_prompt`.
- **P22-5 · A rebuilt export keeps the previous revision's files.** Build into a clean directory.
- **P22-6 · Freesound URLs are matched by prefix** (`sources.py`). Parse the URL and require the
  sound-id segment to equal `sound_id`.

## Deferred

Each needs a measured learning or usability need first: committed neural-TTS expansion,
pronunciation assistance, runtime and branching missions, spoken-mode placement (P13-1), a
next-level placement offer (P13-2), the listening retention pilot after the A1 gate (P5-7), and the
DTZ §9.2 Wortliste cross-check (P26-17 — a one-off report whose extraction is a project).
