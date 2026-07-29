# Focus tags — the confusion taxonomy

The allowlist of confusions this course can name, lifted out of [`CLAUDE.md`](../CLAUDE.md)
because it is a lookup table consulted while tagging an item, not a rule that applies everywhere.

A tag is the unit the whole personalization loop runs on: attempts carry it into progress
snapshots, `focusStats` aggregates error rates by it, mixed training prioritizes by it, drill
authoring is driven by it, and the grammar inventory counts a structure as taught only when a
`practice` or `drill` item carries the tag that names its confusion. A wrong tag is therefore
worse than no tag — it sends training and drill authoring after a confusion the learner does not
have.

Use existing tags whenever possible; add a new one only for a genuinely new confusion, and add it to this table in the same change. The table is an **allowlist**: `bun run validate` rejects a focus tag that is not also registered in `focusIntroducedBy` (`src/lib/focus-tags.ts`) with the topic that introduces it, so a typo or an undeclared confusion cannot slip through unchecked. The two lists are held equal **in both directions** by `tests/focus-tags.test.ts` — which matters because only one direction was ever loud: a tag registered but undocumented is invisible, so an author never learns the confusion exists and reaches for a near-miss tag instead.

| Tag | Confusion it names |
| --- | --- |
| `verbzweit` | conjugated verb must stay in position 2 (inversion after fronted element, W-questions) |
| `verb-endungen` | present-tense person endings, incl. stem changes (du sprichst) and sein/haben forms |
| `kopula-sein` | dropping sein like Russian drops «быть» (❌ Ich müde) |
| `genus` | noun gender / der–die–das, incl. -ung/-chen signals; no transfer from Russian |
| `plural-artikel` | plural article is always die |
| `artikel-pflicht` | dropping the article (❌ Ich habe Frage) |
| `kein-nicht` | negating nouns with kein-, not nicht |
| `nicht-position` | placing nicht correctly: after verb and object, before predicative adjectives/adverbs (❌ Ich nicht arbeite) |
| `possessivartikel` | choosing mein/dein/sein/ihr and matching nominative gender/plural endings |
| `akkusativ-artikel` | accusative article forms: der→den, ein→einen, kein→keinen; only masculine changes |
| `akkusativ-pronomen` | accusative pronoun forms: mich, dich, ihn |
| `akkusativ-praepositionen` | für/ohne/um always govern the accusative (für einen Freund, ohne mich) |
| `dativ-artikel` | dative article/noun forms: dem, der, den …-n (Dativ Plural) |
| `dativ-pronomen` | dative pronoun forms: mir, dir, ihm, ihr, Ihnen |
| `dativ-praepositionen` | aus/bei/mit/nach/seit/von/zu always govern the dative (incl. zum/zur/beim/vom) |
| `verben-mit-dativ` | dative-governing verbs: helfen, danken, gefallen, gehören, antworten, schmecken |
| `passen-dativ` | passen + Dativ (Passt es Ihnen? — ❌ Passt es Sie?) |
| `wechsel-akk-dat` | choosing Akkusativ vs Dativ (two-object sentences; later: two-way prepositions) |
| `trennbar-wortstellung` | separable prefix splits off and goes to the clause end |
| `trennbar-modal` | after a modal/möchte the separable verb stays whole at the end (… muss … aufstehen) |
| `trennbar-untrennbar` | separable vs inseparable prefixes (be-, ver-, er- … never split) |
| `modal-satzklammer` | modal in position 2, bare infinitive at the very end |
| `modal-konjugation` | modal forms: ich/er kann without -t, vowel change only in singular |
| `duerfen-muessen` | darf nicht (prohibition, «нельзя») vs muss nicht (no necessity) |
| `will-moechte` | blunt wollen vs polite möchte (vs mögen = general liking) |
| `gern-moegen` | expressing liking: verb + gern (Ich spiele gern Fußball), not a «люблю + инфинитив» calque; mögen only with nouns at A1 |
| `haben-sein` | Perfekt auxiliary choice: sein for A→B movement + bleiben/sein/passieren, else haben |
| `partizip2-form` | building the Partizip II: ge-…-t/-en, -ieren without ge-, separable -ge- inside, inseparable without ge- |
| `perfekt-satzklammer` | Perfekt bracket: haben/sein in position 2, participle at the very end |
| `haben-wendungen` | states expressed with haben + noun: Hunger/Durst/Feierabend haben (❌ Ich bin Hunger) |
| `um-am-zeit` | time prepositions: um + clock time, am + day/part of day, im + month/season, in der Nacht |
| `du-sie` | register: du vs Sie with strangers/officials |
| `wo-wohin` | two-way prepositions: Wo? + Dativ (position) vs Wohin? + Akkusativ (direction) |
| `stellen-stehen` | the placement/position verb pairs: stellen/stehen, legen/liegen, hängen |
| `komparativ-als` | comparison with *als*, incl. the irregulars (gut → besser, gern → lieber, viel → mehr) |
| `superlativ-am` | the superlative *am …-sten* |
| `adjektiv-praedikativ` | an adjective after *sein/werden/bleiben* takes **no** ending (❌ Das Zimmer ist kleines) |
| `adjektiv-bestimmt` | adjective endings after *der/die/das/dieser*: **-e** in the five nominative-singular and feminine/neuter-accusative boxes, **-en** everywhere else |
| `adjektiv-unbestimmt` | adjective endings after *ein/kein/mein*, where the adjective supplies the gender the article hides (ein neu**er** Tisch, ein neu**es** Bett) |
| `imperativ-form` | imperative forms for du, ihr and Sie (Nimm …, Nehmt …, Nehmen Sie …) |
| `seit-vor-zeit` | *seit* + Dativ (since/for — still true) vs *vor* + Dativ (ago — finished) |
| `reflexiv-dativ` | in body-part/personal-domain constructions, the affected person is dative while the body part is the accusative object (*Ich wasche **mir** die Hände*); the neutral form uses a plain article, while a possessive is possible under contrast |
| `futur-werden` |  Futur I is *werden* + bare infinitive in the bracket — and is used for a prediction or promise, not for a plan a time phrase already dates |
| `reflexiv-akkusativ` | reflexive pronouns in the accusative: ich fühle **mich**, er ruht **sich** aus |
| `verb-praeposition` | choosing the preposition governed by a verb: warten **auf**, träumen **von** |
| `da-wo-woerter` | wo(r)- questions, da(r)- references, linking r, and thing/person selection |
| `nebensatz-verbende` | the conjugated verb goes last in a weil-, dass- or wenn-clause |
| `weil-denn` | *weil* sends the verb to the end, *denn* does not |
| `nebensatz-vorfeld` | a fronted subordinate clause fills position 1, so the main verb comes straight after it |
| `zu-infinitiv` | an infinitive governed by an ordinary verb takes *zu* (and a modal's does not); in a separable verb the *zu* goes inside — an**zu**rufen |
| `um-zu-zweck` | purpose is the two-ended frame *um … zu*, never *für* + infinitive and never *um* alone |
| `konjunktionaladverb-inversion` | *deshalb*, *deswegen*, *trotzdem*, *dann*, *schließlich* are **adverbs**: they fill position 1, so the verb comes second (❌ *Deshalb ich komme*) |
| `als-wenn-vergangenheit` | past *when*: **als** for a single occasion, **wenn** for a repeated one — neither EN nor RU marks the difference |
| `indefinitpronomen` | *man* is a subject German cannot omit and takes the *er*-form; *jemand*/*niemand*/*etwas*/*nichts* carry their own negation, so no second negative joins them |
| `genitiv-eigenname` | A2 possession production: name + **-s** without an ordinary possessive apostrophe (*Annas Auto*), or the safe spoken route **von + Dativ** for noun phrases; full Genitiv is recognised, not rejected as ungrammatical |
| `passiv-rezeptiv` | reading *werden* + Partizip II as a passive (*Hier wird gebaut*) and telling it from *werden* + Infinitiv (Futur) and *werden* + noun (*to become*) — recognition only at A2 |
| `relativpronomen-kasus` | the relative pronoun takes its gender/number from the noun outside but its **case from the role inside** its own clause (*der Mann, **den** ich kenne*) |
| `aber-sondern` | *sondern* only after a negation, replacing what was denied (Nicht am Freitag, **sondern** am Samstag) — elsewhere it is *aber* |
| `praeteritum-sein-haben` | *war*, *hatte* and the modal Präteritum — the past German actually speaks, where Perfekt is not used |
| `indirekte-frage` | an indirect question sends the verb to the end (Wissen Sie, wo der Kurs **ist**?) |
| `hoeflich-konjunktiv` | the polite *könnte* and *würde gern*, learned as chunks — not as a Konjunktiv II paradigm |
| `praeteritum-vollverben` | the written-narrative Präteritum of full verbs — strong forms take no *-te* (❌ *gehte* → *ging*), mixed verbs change vowel *and* take weak endings (*wusste*) |
| `plusquamperfekt-nachdem` | the tense staircase after *nachdem*: Plusquamperfekt (*hatte/war* + Partizip II, conjugated verb at the clause end) one step before the main clause's past |
| `temporal-nebensatz` | *bevor, während, sobald, bis, seit(dem)* open a Nebensatz — verb at the end, and *bevor* needs no Plusquamperfekt |
| `relativpronomen-dativ` | the dative relative pronoun, demanded by the verb inside the clause (*helfen, gehören, gefallen*): *dem/der* stay article forms, the plural is ***denen*** — never the article's *den* |
| `relativ-praeposition` | preposition + relative pronoun open the clause as one glued pair (*die Wohnung, **in der** ich wohne*) — the preposition keeps its usual case and is never stranded at the clause end |
| `komparativ-attributiv` | the comparative in front of a noun declines like any adjective on top of its *-er* (*eine größer**e** Wohnung, in einer ruhiger**en** Gegend*) — never a frozen *-er* form, never *mehr* + adjective |
| `genitiv-form` | the full genitive paradigm: *des/der* (possessives likewise), weak *-en* on the adjective, and masculine/neuter nouns carry *-s/-es* themselves (*die Miete der neuen Wohnung, das Zimmer meines Bruders*) |
| `reflexiv-praeposition` | a reflexive verb's preposition frame is one vocabulary item — verb + *sich* + preposition + **case** (*sich freuen **auf den** Sommer, sich erholen **von der** Arbeit*); the wo/wohin question never applies inside a frame, and a two-way preposition there almost always takes the accusative |
| `konjunktiv2-ratschlag` | advice in the productive Konjunktiv II: *würde* + Infinitiv at the clause end as the default machine, the one-word *sollte/könnte/wäre/hätte* — the system behind the A2 chunks, and never the umlaut-less Präteritum *wurde* |
| `lassen-verwendung` | *lassen* as have-done / allow / *Lass uns* suggestion, with modal syntax: position 2, bare infinitive at the very end, no *zu* and never an English-style participle (❌ *Ich lasse mein Fahrrad repariert*) |
| `adjektiv-nullartikel` | with no article the adjective wears the missing article's strong ending (*frisch**es** Obst, stark**er** Kaffee, mit warm**em** Wasser, bei stark**en** Schmerzen*) — never the weak after-article ending |
| `n-deklination` | a small family of masculine **person** nouns declines along with its article and takes **-(e)n** in every case except the nominative singular (*den Kolleg**en**, dem Praktikant**en**, von Herr**n** Weber*) — nouns in *-e*, persons in *-ant/-ent/-ist*, and the list *Herr/Mensch/Nachbar*; all feminines (*die Kollegin*) and **most** masculine things in *-e* (*den Käse*) stay out — but not the A1 abstracts *Name/Buchstabe/Gedanke*, which take the *-(e)n* and add *-s* in the genitive (*den Namen, des Namens*); the ending is fixed to the word, so no article word ever moves it |
| `adjektiv-nomen` | an adjective or participle used as a noun keeps declining like an adjective, so its ending **moves with the article word** (*der Angestellte* but *ein Angestellter*, *mit dem Angestellten*, *die Auszubildende*) — and after *etwas/nichts/viel* it becomes a capitalized neuter with the strong *-es* (*etwas Neu**es***) |
| `nomen-verb-verbindung` | in a fixed noun–verb pair the noun carries the meaning and the verb is a fact about that noun, learned with it like a gender (*eine Frage **stellen**, einen Eindruck **machen**, Verantwortung **übernehmen**, zur Verfügung **stehen***) — never composed from parts and never carried over from EN/RU/UK |
| `verb-praeposition-b1` | the wider B1 frame inventory and the **case each preposition brings**, which is a fact about the preposition and not about the meaning (*es geht **um den** …, berichten **über den** …, sich äußern **zu dem** …, abhängen **von dem** …*) — *über* inside a verb frame is always accusative however it behaves as a preposition of place, and the *es* of *es geht um* is a grammatical subject that never leaves (❌ *Der Beitrag geht um …*). Distinct from the A2 `verb-praeposition`, which grades only *which* preposition a verb takes, on a small inventory |
| `da-weil` | *da* and *weil* are both verb-final causal conjunctions, and the choice is what the reason is **doing**, not how formal the sentence is: *weil* delivers it as new information and is the only one that can stand alone as an answer to a bare *warum?*; *da* treats it as already shared and normally goes in front, which then makes the main clause open with its finite verb (*Da alle wenig Zeit haben, **lesen** viele nur die Schlagzeilen*). "The formal *weil*" is the wrong summary — and *weil* is grammatical wherever *da* is, so an item may only grade the direction that is genuinely forced |
| `zweiteilige-konnektoren` | a two-part connector is one frame with an announcing half and a delivering half, and the first half chooses the partner: *nicht nur … **sondern** auch* (both hold; the *nicht* is the negation *sondern* requires), *entweder … **oder*** (one of the two; *entweder* may sit inside the sentence **or** take position 1 with the finite verb after it — both are correct), *zwar … **aber*** (concede, then object; never *sondern*, because *zwar* denies nothing). All of them are coordinating, so nothing goes to the clause end, and both halves should have the same shape |
| `passiv-bildung` | the **produced** werden-passive: *werden* conjugated in position 2, agreeing with the new subject, and the Partizip II at the clause end (*Der Müll wird getrennt*) — the *man*-sentence's accusative object becomes the nominative subject (*Man trennt **den** Müll → **Der** Müll wird getrennt*), and the doer re-enters only with *von* + Dativ. Never *ist* + Partizip for an event: that states a result, and never bare Partizip without an auxiliary, the L1 calque that leaves the sentence with no finite verb. Distinct from the A2 `passiv-rezeptiv`, which grades recognition only |
| `passiv-vergangenheit` | the past passive split by register: written *wurde/wurden* + Partizip II against spoken *ist … worden* — the auxiliary is always *sein*, never *haben* (the active *hat repariert* habit is the error), and inside a passive the participle of *werden* is ***worden***, never *geworden*, which is *werden* as a full verb — someone or something became something (*Er ist Lehrer geworden*, *das Wetter ist kälter geworden*) |
| `je-desto` | *je* + Komparativ opens a Nebensatz and drags its comparative to the front (*Je mehr wir **wegwerfen**, …* — verb at the end, never *je wir mehr*); *desto/umso* + Komparativ then fills position 1 of the main clause itself, so the finite verb comes immediately and the subject after it (*…, desto teurer **wird** die Entsorgung*) — never *desto* + subject-first, and never a verb-final desto-half. Not a coordinating pair: distinct from `zweiteilige-konnektoren`, whose frames move no verb |

**The tag is also what makes a `deepens` edge real.** Weakness is aggregated per tag and is blind to the topic an attempt came from (`focusStats` in `src/lib/weakness.ts` keys only by `focus`), so an error while practising a deepening topic marks that confusion weak *course-wide*; mixed training's second band then pulls every item carrying it out of the whole eligible pool — the base topic's practice and drill sets included. That is the entire runtime meaning of `deepens`, and nothing else reads the field. A spiral revisit whose two ends share no focus tag can therefore resurface nothing, so `bun run validate` requires each `deepens: [base]` edge to share at least one tag between the deepening topic's items and a `practice`/`drill` item of the base. Do **not** add `deepens`-aware special cases to weakness aggregation or training priority: scoping a tag to a topic would *narrow* a signal that is deliberately global.
