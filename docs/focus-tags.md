# Focus tags — the confusion taxonomy

The allowlist of confusions this course can name, lifted out of [`CLAUDE.md`](../CLAUDE.md)
because it is a lookup table consulted while tagging an item, not a rule that applies everywhere.

A tag is the unit the whole personalization loop runs on: attempts carry it into progress
snapshots, `focusStats` aggregates error rates by it, mixed training prioritizes by it, drill
authoring is driven by it, and the grammar inventory counts a structure as taught only when a
`practice` or `drill` item carries the tag that names its confusion. A wrong tag is therefore
worse than no tag — it sends training and drill authoring after a confusion the learner does not
have.

Use existing tags whenever possible; add a new one only for a genuinely new confusion, and add it to this table in the same change. The table is an **allowlist**: `bun run validate` rejects a focus tag that is not also registered in `focusIntroducedBy` (`scripts/validate.ts`) with the topic that introduces it, so a typo or an undeclared confusion cannot slip through unchecked.

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

**The tag is also what makes a `deepens` edge real.** Weakness is aggregated per tag and is blind to the topic an attempt came from (`focusStats` in `src/lib/weakness.ts` keys only by `focus`), so an error while practising a deepening topic marks that confusion weak *course-wide*; mixed training's second band then pulls every item carrying it out of the whole eligible pool — the base topic's practice and drill sets included. That is the entire runtime meaning of `deepens`, and nothing else reads the field. A spiral revisit whose two ends share no focus tag can therefore resurface nothing, so `bun run validate` requires each `deepens: [base]` edge to share at least one tag between the deepening topic's items and a `practice`/`drill` item of the base. Do **not** add `deepens`-aware special cases to weakness aggregation or training priority: scoping a tag to a topic would *narrow* a signal that is deliberately global.
