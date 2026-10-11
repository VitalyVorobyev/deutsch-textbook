# Topic-quality pass

The bounded, topic-by-topic content pass of P27-3g, run under the
[content-quality contract](../authoring/content-quality-audit.md). One pass reads the whole topic
profile together: manifest and outcomes, article, pretest, every teaching set, probe families,
readings, audio and documents, and the owned vocabulary.

`Pass complete` means those surfaces were read together and every material defect found was
corrected. It is **not** human editorial approval and not a claim about learning; the manifest's
`status` and the provenance records stay the approval source of truth, so a pass never sets
`reviewed`.

| Level | Topics | Pass |
| --- | ---: | --- |
| A1 | 12 | complete |
| A2 | 25 | complete |
| B1 | 20 | in progress — rows below |

An empty derived findings queue is never the stop condition: the A1 and the A2 waves each found
material defects that no instrument could see.

**Dense profiles.** Five or more sets on one topic is a review trigger, not a defect. Each set must
name its own learning activity, stage and decision or medium; a set that cannot is merged or
removed, even when the topic's item count then falls.

`natur-wetter` (A2, added after the A2 pass): corrected — the probe and one production item
pinned the adjective instead of *es*, so *kaltes* and *heiß* were logged as the *es* confusion
while a dropped *es* went unattributed; three items rejected correct German (*eine ganze Woche
lang*, *gibt es … darin*, a Perfekt or *es*-first rendering the instruction allowed); a table
cell rejected *wolkig*; a pretest explain named options a translate item does not have; the
*Pflanze* note gave *gießen* as its verb; the article claimed *die Sonne scheint* is the one
weather sentence without *es*, that an adjective always needs an ending, that every short vowel
takes an Umlaut in the comparative, that *Gewitter* has no verb, and (RU) that Russian does not
separate «чем» and «как». Status stays `draft`.

## B1

Unit order from `content/atlas.yaml`. Beyond the common contract, a B1.4+ topic also has its
provenance record in `data/authorship-provenance.yaml` checked, and the human creative and
editorial sign-off is kept distinct from agent assistance. Units still owed the RU/UK calque review
(backlog C6-1) receive it in the same pass.

| Topic | Result | Status |
| --- | --- | --- |
| `erfahrungen-erzaehlen` | corrected — 11 items (3 primary practice, 1 production, 5 drill, 2 probe) rejected correct German or blamed a correct rendering on the tag: accepts widened, instructions ask for the Präteritum where a Perfekt rendering is also correct German, two clozes now name their verbs; a listening explain contradicted its transcript; *Ereignis* IPA [ɡ]→[k]; the article gained L1 contrast in three halves and the conjunction/adverb pairs (adverbial *seitdem*, verb second, was modelled but never taught), and no longer marks a correct past-narrative *seitdem* sentence ❌. One finding rejected: the *schon … als* Plusquamperfekt cloze matches the article. | `draft` |
| `leben-veraendern` | corrected — 7 items rejected correct German or mis-attributed: word orders and synonyms of the attributive comparative (*günstigere*, *preiswertere*, fronted place phrase), *früheren/ehemaligen Wohnung*, *Freundinnen* and *Kolleginnen* for gender-open plurals, a fronted main clause blamed on *denen*, *Kinds* beside *Kindes*, and *mit der Ärztin* in a probe whose EN prompt says "appointment with"; the genitive item forgave *Wohnungs* as a spelling slip — the one error it exists to catch — because *Wohnung* was unpinned; RU/UK still said German never compares with *mehr*, and an explain said a comparative is never frozen before a noun (*mehr Geld*). | `reviewed` kept — the owner's sign-off predates this pass; the changes widen accepts, pin *Wohnung* and narrow the RU/UK *mehr* claim, for the owner to re-confirm |
| `gesundheit-wohlbefinden` | corrected — the *lassen* probe counted its signature error as retention: *lasse … zu putzen* is unattributable to a pinned token, and an unattributed probe miss reads `retained`; all three variants now carry `focus_evidence` predicates (zu, participle, infinitive out of the bracket, wrong or missing *lassen*), each checked against the error it names; the same probe rejected *mir die Wohnung* and *unseren Schrank*, and its RU/UK variant-c left the possessive open; three items rejected correct German (*Ein paar Wochen solltest du …*, *mehrere*, *eine kleine Pause*); a cloze printed its own answer (*würde*) in the instruction; the article said *Obst* takes no article (*das frische Obst*), and RU that Russian government never carries over. | `reviewed` kept — the owner's sign-off predates this pass; the probe predicates and accept changes are for the owner to re-confirm |
| `arbeit-bewerbung` | corrected — three translate items rejected correct German (*Bankangestellter*, blamed on `adjektiv-nomen`; *mit dem Kollegen*; *Einladung zum Vorstellungsgespräch*); the writing task quoted an ad with Herr Weber as contact while the set's stimulus — shown beside it — is the Nordlicht ad with Frau Berger; the article called *Für weitere Fragen …* "the fixed closing line … unbreakable" against its own "useful option", and closed the n-declension exceptions at three (*der Friede*). Provenance record checked: consistent with `draft`; this pass's tools line added; "one employment mission" is met as a genre, not one cast. Two findings deferred to the backlog (the listening item's tag is held by the probe's arming contract; dictation slips swallow the adjektiv-nomen errors). | `draft` |
| `meinung-medien` | corrected — the *denn* explain reversed the word order (*ist sie, not sie ist*) in four halves; a probe instruction printed its own answer (*dieser*); two items rejected correct German (*In der Meldung …*, *am Morgen*, *sich … ansehen*); three explains still called a requested reason "new by definition" after the article narrowed it to a convention; the reading explain misdescribed its distractors. Provenance: this pass's tools line added. Deferred: practice accepts *weil* where the *da-weil* probe rejects it under the same instruction — an owner decision (backlog). | `draft` |
| `konsum-umwelt` | corrected — the article example and three explains (`uebersetzen-je-desto`, je-desto probe variants a and c) taught that German keeps the *je*-half's *ist* where English and Russian drop it — in all four halves; a terse German line drops both verbs (*Je billiger das Produkt, desto schlechter die Qualität*), now said; the RU/UK prompts of those four translate items are verbless in one half, so that correct terse German was rejected **and charged to `je-desto`** with its word order intact — the instructions now ask for two full clauses, each with its own verb (revision 2, no position named); `uebersetzen-tonne-august` rejected *die Mülltonne*, the unit's own production card for "bin" and the Wortliste form; the `hoeren-durchsage` explain said every option quotes the announcement (option c's *geleert* never occurs); the reading's `frage-batterien` explain read *vorher* as "before autumn" (it is before the next collection, whose date comes in autumn); Hören q1's explain called *wenig Energie* the first half misheard (it inverts *sehr viel Energie*). Verified: outcomes, *Kurz gesagt*, the passive and *worden/geworden* sections, *Feinheiten*, pretest, the other teaching items, the Hören set against its recording's transcript, the passive probe families per prompt language, the reading's questions, every vocab form, gender, plural and IPA. No change: *Früchte* for «фрукты» and *Couch* for «диван» (recognition-only cards; *Obst*, *Sofa* are the trained productions); the placement cloze's *desto* (its instruction names it); the off-mode outcomes on the past-passive items and the Hören set (P5-11b). Provenance: this pass's tools line added. RU/UK calque review (C6-1) not run. Deferred: backlog. | `draft` |
