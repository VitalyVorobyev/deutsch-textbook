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
- **P26-11 · B1 has four drill sets** against A2's thirteen (`grep -l '^role: drill'
  content/exercises/b1/*.yaml`), so the remediation channel is thin there; P23-3 sees it from the
  other end. B1 depth reads median 6 items per confusion, 2 tags at ≤3 items, 1 tag in a single
  file (`bun scripts/grammar-depth.ts B1`). New drills also raise the floors in
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
- **CON-3 · B1 competences that do not survive the delay.** Seven B1 rows retain 0–17% at 21–30
  days: adjektiv-nomen, irreale-bedingung, lassen-verwendung, partizip-adjektiv,
  relativ-praeposition, passiv-modal, praeteritum-vollverben (`bun run progress:audit --profile
  vitaly`, *Retention by competence*). Each is carried by one probe family, so it caps at three
  attempts. First step: `bun scripts/grammar-depth.ts B1 --thin` for these tags, then a drill set
  per confusion that is thin.
- **CON-4 · A direction phrase stays beside its verb.** Four rulings in `data/grading-decisions.yaml`
  show the same slip — *heute zur Arbeit nicht kommen*, *zur Oma oft gefahren* — and no item
  grades it outside A1's `nicht-position`. First step: a drill under `nicht-position` with
  adverbs and *nicht* placed against *zu/nach/in* + noun phrases.
- **CON-5 · Original Goethe-style A2 Hören and B1 practice sets.** A2 has three Lesen and
  Schreiben sets (`content/exercises/a2/pruefung-a2-*.yaml`) and no Hören; `/pruefung/b1` serves
  the official sets only where the materials are local, so a clean build has nothing to practise
  there. First step: the three A2 Hören sets on browser TTS, then their Tonwerk recordings, which
  need `data/listening-plan.yaml` to accept artifacts that belong to no unit.
- **P26-7 · Buy the stronger higher-level anchors:** the Goethe/ÖSD B1 *Prüfungsziele* (ISBN
  978-3-19-031868-1) and *Profile deutsch* (ISBN 978-3-468-49410-9); also the adult Goethe A2
  *Prüfungsziele* (the free A2 list is the youth exam). Each becomes one
  `data/strukturenlisten/*.yaml` whose entries start `unclaimed`.

## B1 findings below the material bar

From the topic-quality pass, for the next time each file is touched.

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
- `b1/informationen-vermitteln`: per-gap alternatives in
  `cloze-angaben-reihenfolge` and that variant pass a doubled phrase; the article's te-ka-mo-lo
  section names two forces that move an Angabe, and the items now accept a third (a manner word
  before the participle); the showcase's *kurz* answers *wie lange?* as readily as *wie?*; the article's DE
  half and the `mc-konjunktiv1-lesen` DE explain still relay with "dass und Präsens"; the *Vortrag*
  note's "never *machen*" and the *Ansage* note's platform rule (*Bahnhofsansage*); the production
  header has the Hören's day and deadline two turns apart (they share one); the write model's
  "gut zwei Wochen" is a span its prompt never gives; C6-1 still owed.
- `b1/unfall-notruf`: `cloze-nachdem-sein`'s *Nachdem wir angekommen waren, war die Straße
  schon gesperrt* (also in the article's table) reads more naturally with *als*, as its own
  translations do ("by the time", «к тому времени как»); the reading's third explain says the
  two tenses carry the sequence "on their own" (*nachdem* says it too); the `uebersetzen-angaben`
  and `uebersetzen-hergang` instructions keep every detail behind the verb while each accepts the
  fronted time; still rejected, unattributed: *heute früh* for "this morning", *Mein Kopf tut mir
  weh* (the course calls the doubled possessive unidiomatic); the *Tod* note's "an tut sterben is
  not German", the *körperlich* note's "do not use it of a physical object" (*körperliche
  Gegenstände*), the *Infektion* note's computer-virus rule; the `koerper-medizin-b1` header
  still calls the deck unowned, though this topic adopts it; C6-1 still owed.
- `b1/polizei-anzeige`: no `table-indirekt` cell takes an alternative; still rejected, unattributed: *das Geräusch*
  (off the Wortliste), the Konjunktiv I *gehört habe* / *solle* in practice and probe items,
  *zuhause* for *zu Hause*, *die Tür auf war*; a victim more often *macht* or *erstattet* an
  Anzeige than *schreibt* one (the article's example, `cloze-anzeige`, the named
  `uebersetzen-weitergeben`), and the write task's online report is modelled as a letter; the
  dictation explain's "miss *wurde* and you have said *ist gestohlen*" describes a mishearing,
  not an omission; the 2026-09-15 ruling note's "never *einen Lärm*" (*einen Heidenlärm*); the
  `recht-kriminalitaet-b1` header still calls the deck unowned, though this topic adopts it;
  C6-1 still owed.
- `b1/versicherungen-behoerden`: still rejected, unattributed: *innerhalb der gesetzten Frist* and its siblings for
  «установленного срока», the fronted *Innerhalb der Frist antworten Sie bitte*, *ob es versichert
  ist* for «это»; *Nachweis*, the topic's key noun, is on no Goethe list and in no deck, so it is
  named wherever it must be produced; the article's form table, its example and
  `table-formular` label the marital-status box *Personenstand*, while the deck's own note says
  the box a learner fills in reads *Familienstand*; *Feinheiten*' *Personalien* "immer ohne
  Artikel im Formularkopf"; the `mc-wogegen` prompt's *ob Ihr Fahrrad … bezahlt wird*; vocab
  notes: *verboten*'s "capitalised infinitive" pattern led by *Zutritt*, *städtisch*'s urban
  sense "carried by … *städtisches Leben*", *Vorwahl*'s "Germany writes … which is exactly what
  the example shows" over a Vienna example, *Bürger*'s *-burg* town names, *Förderung*'s
  *Förderschule* "officially" (it varies by Land), *Bürgerin*'s feminine-first order "fixed";
  the `verwaltung-behoerden-b1` header still calls the deck unowned, though this topic adopts
  it; C6-1 still owed.
- `b1/sucht-lebensstil`: still rejected, unattributed: *würde …
  sein* and *würde … haben* (the tag keeps the one-word forms), *Lasse das Rauchen sein!*, *Lass
  doch das Rauchen sein!*, *Lass das Rauchen!* (the instruction asks for *sein lassen*); variant-a's RU/UK explains say «отдать в ремонт» / «віддати в ремонт» suggests a
  participle; vocab notes: *Alkohol*'s "*Alkohol am Steuer* is the offence in the example" (the
  example avoids it), *Zahnpasta*'s "nobody counts it", the *Suchtmittel* example's superlative
  "am leichtesten zu bekommen"; the `koerperpflege-lebensstil-b1` header still calls the deck
  unowned, though this topic adopts it; C6-1 still owed.
- `b1/bildungswege`: still rejected, unattributed: *zehn Jahre alt wird*, *es auf dem Gymnasium nicht schafft*, *noch ein Jahr länger*,
  *noch mal*, *nicht den Bus verpasst*, a modal the prompt does not have (*erklären kann*, *lernen
  kann*), and *zuhause* — a spelling the rules allow beside *zu Hause*, owed to the grader rather
  than to accept lists; the `sprechen-kita` explain says *um besser
  Deutsch zu lernen* would mean you go to the Kita (it means you learn); the reading's *damit sie
  das Zeugnis erklärt* leaves *sie* to context; `mc-falls-eventualitaet`'s option and the reading
  have the family decide the next school, which a binding recommendation limits in some Länder;
  *Feinheiten*' Swiss *Mittelschule* as "das Gymnasium" (it also covers the Fachmittelschule); the
  reading's *Hauptschule* gloss "leading straight into a trade"; the `bildung-schulsystem-b1`
  header still calls the deck unowned, though this topic adopts it; C6-1 still owed.
- `b1/gespraech-steuern`: still rejected, unattributed: *noch mal*, *Könnten Sie es …*,
  *Hätten Sie kurz Zeit …*, *Mensa*, *was* for *etwas*, *ein Raum*; the placement header's counts
  (32 tasks, 14 topics, the mix line) predate several B1 topics; the article's *Also* as "the most
  ordinary" opener and giving the floor that "needs no softening" are unsourced tendencies, as is
  `table-konjunktiv2`'s "*sagen* has no polite one-word form in everyday use"; the
  `sprechen-besprechung` explain's stressed *ja* that "turns a reminder into a contradiction";
  the reading gloss "the polite Konjunktiv II is what asks for the floor"; C6-1 still owed.

## A2 findings below the material bar

For the next time each file is touched.

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
