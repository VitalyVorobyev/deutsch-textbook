# Changelog

What changed for the people who use Deutsch-Atlas, release by release. An entry says what a
learner sees or can now do; a release that changes only tooling gets one plain line. How things
work inside belongs in the developer documentation, not here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Releases are cut by pushing a `vX.Y.Z` tag; the section below the matching version becomes the
GitHub Release notes.

## [Unreleased]

### Added

- **Three Goethe-style practice sets for A2**, on the A2 exam page: Lesen in the exam's four parts
  (newspaper article, store or office directory, e-mail, ads with one "keine passende Anzeige"),
  each beside its document, and Schreiben with an SMS and an e-mail and a model answer for each.
  They are original tasks, always available, and work without the official materials.
- **Hören for the three A2 practice sets**: the exam's four parts — five short announcements and
  phone messages, one conversation matched to nine answers, five short conversations, a radio
  interview with Ja/Nein — read aloud by your browser's German voice. Each part says how often the
  exam plays its text, and a question allows no more plays than that.

### Changed

- **Prüfung is one place for every exam.** Üben now has four tabs (Wiederholen, Training,
  Wortschatz, Prüfung) that fit a phone without sideways scrolling. Prüfung opens an overview with
  Goethe A1, A2, B1 and Leben in Deutschland. Leben in Deutschland moved there; old links still
  work, and your LiD progress is untouched. Pages inside Prüfung show a breadcrumb instead of
  another row of tabs.
- **Goethe-Zertifikat A2 and B1 in the exam simulator**, when the official practice sets are on
  your device: timed Hören, Lesen and Schreiben with the real answer sheets, Sprechen as task cards.
  The answer sheet now offers Ja/Nein and lettered matching with "keine Lösung". B1 converts your
  points with the booklet's own table and shows the 60-point pass mark; A1 and A2 modules show
  none, because the booklets print none per module.
- **Articles link back to what they build on.** "Auf A2 stand der Komparativ nach *ist*" now opens
  the A2 section it means, and a *Zurück zu …* button there returns you to the same sentence,
  even inside a folded explanation. Twelve back-references in the B1 articles are linked.
- **German inside the explanations is easier to spot**: inline examples are now set in a darker
  amber at medium weight, not just in italic.
- **Alle Themen folds every mastered topic**, not only those at the top of a level.
- ***Erste Schritte* lists the letter names you cannot guess** (*Ha, Jot, Vau, We, Ypsilon, Zett,
  Eszett*), and its spelling exercise now gives the letters and asks for the name.
- ***Konsum und Umwelt* shows the three questions every verb form answers** — when (Zeitform), how
  it is meant (Modus), who acts (Genus Verbi) — with a link to the full overview in the Referenz.
- **Russian and Ukrainian explanations no longer call a form "безопасный" / "безпечний"** (an
  English "safe choice" in disguise); they say what they mean. *Biografie und Erfahrungen* no
  longer claims Russian differs from German in *Seit wann wohnst du hier?* — it works the same.
- **Leben in Deutschland: practice deals its questions in random order** — the due ones first, then
  today's new ones, each group shuffled — instead of walking the catalogue topic by topic.
- **Leben in Deutschland: each question now shows whether you really know it.** "Right last time"
  was right almost always, because a missed question comes back until you answer it. Now each day
  counts once, and a day is right only if every answer that day was: a question is *sicher* when
  you got it right on two days running, *unsicher* when right once, and a *Fehler* when you got it
  wrong on its last day — even if you put it right a few questions later. The overview shows the
  three per subject area, and *Fehler wiederholen* brings a mistake back the next day until you
  answer it right again.
- Repository housekeeping: learner snapshots are no longer committed and are purged from the
  repository history (existing clones must be re-cloned), oversized files are refused, the
  Worker's D1 migrations moved to `worker/migrations/`, and Tonwerk's own tests now run in CI.
- Developer docs: the architecture decisions are rewritten as eleven foundational records, and
  open directions (lesson tasks, characters and stories, the shared UI) become proposals. The
  roadmap now runs past B1, and the backlog is split by area.
- Tonwerk is one folder: the UI moved to `apps/tonwerk/ui/` and the engine to
  `apps/tonwerk/engine/` (was `tools/listening-studio/`). Run the engine from there with
  `--repo ../../..`.
- Agent instructions are layered: a short root `CLAUDE.md` plus one per working directory, and all
  project skills live in `.claude/skills/`, with new ones for the PR cycle, releases, shipping a
  topic and translating from the German.
- Code and content comments no longer cite development milestones — backlog IDs, PR numbers,
  release versions, dated passes — and a test keeps it that way.

### Changed

- **B1 articles are being rewritten to read in German first.** The explanation is German text, and
  each section ends with two folds: *Übersetzung*, an English translation of the German, and
  *Ausführliche Erklärung*, the full explanation in your language as before. Switch the Lernsprache
  to *Deutsch* to hide both. All twenty B1 articles read this way now. Six of them — *Bildungswege*,
  *Gespräche steuern*, *Polizei und Anzeige*, *Sucht und Lebensstil*, *Unfall und Notruf* and
  *Versicherungen und Behörden* — had no German explanation at all before; they have one now, and
  every B1 exercise, reading and listening set explains itself in German too when the Lernsprache is
  *Deutsch*.
- ***Unfall und Notruf*:** *passieren* takes *sein* because nobody does a happening — not because it
  is a "change of state"; *nachdem* says one event came first, not that it made the other possible;
  *Ich habe meinen Arm verletzt* is possible, just less usual than *mir den Arm*.
- ***Gespräche steuern*: *sollte* and *wollte* take no umlaut in the Konjunktiv II** — the article
  had said every modal does.
- ***Gesellschaft und Zusammenleben* no longer says the A2 pronouns *man* and *jemand* never change**
  — they decline (*jemanden*, *niemandem*); what sets them apart is that they stand without a noun.
- **Smaller corrections in B1 articles:** a stray comma in a corrected *Präteritum* sentence
  (*Kultur und Freizeit*); the genitive *-es* is common, not required, on one-syllable nouns, and
  *-s* is the usual, not the only, ending (*Leben verändern*); *über* in a fixed verb combination is
  almost always, not always, accusative (*Meinung und Medien*).
- ***Lernen & Zukunft* no longer says *um … zu* and *damit* split one-to-one by subject.** Two
  subjects require *damit*; with one subject *damit* is correct too, and the course uses the shorter
  *um … zu*. *Bildungswege* now builds on that rule instead of teaching it a second time.

### Fixed

- **Correct answers that were marked wrong are accepted now:** *…, und ich kann heute nicht zur
  Arbeit kommen*; *mit meinem Kollegen*; *den Anschluss verpasst*; *ob es versichert ist*;
  *Ich schreibe meine Tochter ein*; *damit die Kinder alles verstehen*. The sick-note exercise also
  explains where *nicht* goes: before *zur Arbeit kommen*, not between them.
- **Exercises that printed their own answer ask for it now:** the spelling gap that showed *Lena*,
  the email question that named *Punkt*, the *rein* question that quoted *rein*, the plural gap
  whose instruction stated the rule, and a reading question whose right option was the only exact
  quote. The bus-driver exercise asks for one compound word.
- **Desktop app: no more “Einträge warten auf Wiederherstellung” after switching pages quickly.**
  Clicking to another page while an answer was still being saved could lock local storage for up
  to half an hour, and a restart helped only if you waited before the first click. Now the save is
  handed back as you leave the page and finishes on the next one.
- **Exercises that asked you to guess the author's word now name it.** The A1 imperative and
  separable-verb checks give the infinitive (*Kinder, ___ hier rechts! (gehen)*), the *als*-clause
  exercise names *kommen* and *wohnen* and also takes *wohnten*, the bike-and-taxi exercise gives
  both genders, and the *nachdem* check names *die Werkstatt*.
- **The *wo-* and *da-* dialogues no longer print the preposition** you are meant to recall —
  *Woran denkst du? — ___ die Tickets* — and a translation under each fixes the meaning.
- **More correct answers count:** *Ich bringe dir die Getränke* without *mit*, *Als ich ein Kind
  war …* with *zur Oma*, and *In Hamburg ist das Wetter kälter als in Berlin*.
- **The weil-clause table no longer retypes names**, so a typo in *Nina* is not marked as a word-order
  error.
- ***losfahren* and *abfahren* cards ask different questions** — *to set off, to get going* against
  *to depart (bus, train)* — so the prompt says which word it wants.
- **Articles:** the *deshalb* table in *Verbindungen und Folgen* now sits where the text points to it;
  the *zwei Objekte* table in *Freunde und Feste* follows the section that explains it; *Natur und
  Wetter* drops two claims it could not back; the Leben-in-Deutschland lesson *Europa* says
  «граничит с девятью странами» in natural Russian (and Ukrainian).

### Changed

- Tooling: TypeScript 7, Astro 7.4, Oxlint 1.88, Oxfmt formatting and current dependency patches.

## [0.6.19] — 2026-10-14

### Added

- **Three B1 drills for weak spots your answers show.** Each has 8 exercises:
  - *damit* or *um … zu* — one subject or two;
  - the Präteritum of strong, weak and mixed verbs (*sprach*, *gefiel*, *wusste*);
  - an unreal condition with Konjunktiv II in both halves.

  Training serves them while the weakness lasts.

- **Leben in Deutschland lessons have maps and pictures.** Bayern shows its seven
  Regierungsbezirke, its coat of arms beside the three it is confused with, both flags, and the
  exam's own map with Bayern marked. Seven lessons in all gain 18 figures: the Länder and
  Germany's neighbours, the occupation zones and Berlin's sectors, the Wall, the DDR flag, the
  EU, the Reichstag and a Stolperstein. Every picture has a German caption with a translation in
  your language, and names its author and licence.
- **Three more pictures for Leben in Deutschland.** Wahlen und Parteien shows two sample ballots
  from the exam's own question — one valid, one not. Verfassungsorgane gains two diagrams: who
  elects whom, step by step, and how a law is made.

### Fixed

- **A missing capital at the start of a sentence is no longer a grammar mistake.** Typing
  *wenn ich Zeit habe, …* where the answer starts *Wenn* now counts as right in a translation,
  with the capital shown as a spelling note. A gap or table cell that opens a sentence, or comes
  after a colon, now takes either case.
- **Gap, table and word-order exercises blame a grammar point only for its own mistakes.** In 24
  B1 exercises, a typo in a word the task prints or a slip in an unrelated gap no longer counts
  against the grammar point. The wrong form the exercise is about still does.
- **B1 Lernen & Zukunft:** *wenn* where the instruction asks for *falls* is still marked wrong,
  but no longer counts as a *falls*/*wenn* mistake, since *wenn* is correct German there.
- **The word-field panel no longer ends with a note about how cards are made.** It was a note
  for the authors, not for you.
- **Reflexive verbs show *sich* on their cards.** The card for "to get used to" printed
  *gewöhnen*; it now reads *sich gewöhnen*, and so do 22 other verbs whose Wortliste entry is
  written without *sich* (*sich freuen*, *sich kümmern*, *sich bewerben* …). Your review history for
  them is kept.
- **The Imperativ table in Stadt & Wege (A1) says what to write.** It asks for the verb form only,
  with *Sie* where it belongs, and accepts *geh* as well as *Geh!* — the right forms typed in lower
  case were marked wrong.
- **Leben in Deutschland — Wahlen und Parteien lists the parties in today's Bundestag.** The table
  adds the AfD and Die Linke, and says which parties have sat in the Bundestag since the 2025
  election: the FDP has not, and the test still asks what its name means.
- **Leben in Deutschland — who elects whom reads as one procedure.** The table listed the
  Bundespräsident twice, in an order that hid why; it is now six numbered steps, from the vote for
  the Bundestag to the appointment of the ministers.
- **Leben in Deutschland — what a majority in the Bundesrat is.** The lesson now explains that the
  Bundesrat has no coalitions: each Land votes as one block, a divided Land government abstains,
  and a law that needs the Bundesrat's consent needs 35 of its 69 votes.
- **Leben in Deutschland — Bayern.** The three Freistaaten have no more rights than the other
  Länder because the name grants none, not "therefore"; the sentence is corrected in German and in
  every translation.
- **Delayed checks no longer count an added word as the skill kept.** *Ich muss zu gehen*, *ich
  lasse das Fahrrad zu reparieren*, *am jeden Tag* and *die Mareks Wohnung* now count against the
  rule they break, in 11 delayed-check sentences across A1, A2 and B1. Before, a wrong answer that
  only added a word was counted as the rule still mastered.
- **The B1 dictation *etwas Neues* now counts a small *n* or a missing ending as that mistake.**
  Before, both were forgiven as typos, so the weakness they show never reached your training.
- **Eight translation exercises accept German they used to reject.** Examples:
  - *ob die Tür geöffnet war*, *bis zur Kreuzung*, *in den Supermarkt*;
  - *statt einfach Videos zu schauen*, *Kinder laufen in den Garten*;
  - *den Film* where the Russian says only «фильм»;
  - a clause joined with *dann* alone.
  
  Two prompts now write the person's name as German spells it (*Aylin*, *Clara*), and one says
  *einen Film*.
- **Two B1 gap exercises stop marking the wrong thing.**
  - *Wenn der Zug pünktlich wäre, könnten wir …* is now accepted alongside *würden*.
  - The *sich gewöhnen an* gap now gives *das Aufstehen* with its article. Before, a wrong gender
    counted against the verb's preposition.
- **Meinung & Medien (B1.5), checked end to end.** An explanation showed the word order after
  *denn* backwards; it is *denn sie ist*. A delayed check printed its own answer in the
  instructions. Two exercises accept correct answers they rejected (*In der Meldung geht es um …*,
  *am Morgen*, *sich die Nachrichten ansehen*). Explanations no longer claim a reason someone asks
  for is always new information.
- **B1.6 Konsum & Umwelt — quality pass.**
  - The lesson no longer says German always keeps the verb in a *je … desto* half. A short line
    can drop both verbs: *Je billiger das Produkt, desto schlechter die Qualität*.
  - The four *je … desto* translations now ask for two full clauses. Before, a correct short
    answer was marked wrong and counted against the word order.
  - *die Mülltonne* is accepted beside *die Tonne*.
  - Three explanations now describe their own text and recording correctly.
- **B1.7 Regeln & Verantwortung — quality pass.**
  - A *dürfen/müssen* exercise counts against that choice only when you pick the wrong modal.
    Before, a wrong ending (*dürfen nicht geraucht werden*), a missing modal, or the right modal
    in an active sentence all counted as that mistake.
  - Correct answers now accepted:
    - bare *Fahrräder* where the Russian has no article;
    - *so dass* beside *sodass*, in a dictation and a placement question;
    - *geparkt* for "parked";
    - *Geschäft* and *um sechs Uhr*.
  - One exercise now names *streichen*, a verb no list teaches.
  - The lesson no longer says the subject must follow *sodass* directly. Its own example
    (*sodass sich die Nachbarn beschwert haben*) shows otherwise.
  - Three explanations now describe their own model text or recording correctly.
- **B1.8 Reisen & Probleme — quality pass.**
  - Twelve exercises accept correct German they used to reject. Several had also counted that
    answer as the very mistake they drill. Examples:
    - the *wenn*-clause first;
    - *wegen* after the object;
    - *einer Verspätung*, *des Unfalls*;
    - the Präteritum where no tense was asked;
    - *haben … stehen müssen*, *im Hotel anrufen*.
  - The *wegen* gap no longer asks you to type the word its own instruction prints.
  - *würden … gefahren* in a delayed check now counts against the Konjunktiv. Before, it counted
    as the form kept.
  - The lesson no longer says:
    - that German keeps *würde* out of every *wenn*-clause;
    - that *trotzdem* can only stand first;
    - that *fände* or *käme* are written-only.
  - Five explanations are corrected, including where Russian and Ukrainian put «бы».
- **B1.9 Lernen & Zukunft — quality pass.**
  - *damit … zu* + infinitive (*damit alle sie zu verstehen*) now counts as the *damit/um … zu*
    mistake in delayed checks and in the new drill. Before, it was read as the form kept.
  - Correct German now accepted in eleven exercises:
    - *jeder … kann* for "everyone";
    - the *werden*-future for a plan;
    - *den Kurs*, *eine Prüfung* where the Russian has no article;
    - the *damit*-clause put first;
    - the fronted *ohne*-clause.
  - Names in Russian and Ukrainian prompts are written as German spells them (*Marta*, *Frau Weber*).
  - A gap no longer asks for the word its own instruction prints.
  - The lesson no longer says that *ohne* and *statt* always take *zu*, or that only *um* has that
    shape.
- **B1.10 Gesellschaft & Zusammenleben — quality pass.**
  - *trotzdem* inside the clause (*Die Mehrheit stimmt trotzdem …*) no longer counts as a
    word-order mistake. The lesson stops saying *trotzdem* can only stand first.
  - The Präteritum is accepted in the *obwohl* placement question.
  - Correct German is accepted in seven other exercises, for example *die Party*, *die Feier* and
    *noch immer*.
  - Four names in Russian and Ukrainian prompts are written as German spells them.
  - Cards:
    - *abstimmen* and *sich beteiligen* now ask for their own meaning, not the one *wählen* and
      *teilnehmen* already ask for.
    - *Respekt*, *Einwand*, *Gemeinschaft* and *Verständnis* get a note on their gender or sense.
  - The lesson no longer calls *einige*, *manche* and *viele* always plural.
- **B1.11 Digitales Leben — quality pass.**
  - Correct German is accepted in six exercises, and no longer counted as the mistake the
    exercise drills:
    - the Präteritum *Früher las ich …*;
    - *Würden Sie …* as a polite request;
    - *Vor allem nutze ich …* and *um vor allem mit … zu sprechen*;
    - *aufmachen* for "open";
    - *Antwort* for "reply".
  - The *sodass* exercises stop saying the subject always comes right after it.
  - The *einschalten* card now asks for its own word, not *anmachen*'s.
  - Four card notes no longer teach something false (*Taste*, *ausdrucken*, *aufladen*,
    *hochladen*).
- **B1.12 Kultur & Freizeit — quality pass.**
  - Correct German is accepted in seven exercises, and no longer counted as a Präteritum or
    comparative mistake:
    - another word order (*Um sieben begann das Stück*, *Erst am Abend kauften wir …*,
      *…, und dann saßen wir ganz hinten*);
    - the course's own words (*Aufführung*, *Stück*, *Tickets*, *Sitzplätze*);
    - the Perfekt where no tense is asked (*haben … gehabt*).
  - In the Präteritum report sentences, only a wrong or missing verb form counts against the
    Präteritum. A slip in agreement (*wir saß*, *das Publikum fanden*) no longer does.
  - Two Russian and Ukrainian prompts now say "there is" and "we had", so they ask for the
    comparison in front of the noun as the instruction does. One delayed check's translation
    no longer says "better" where the gap wants *schöner*.
  - The lesson no longer says that *holen* is only for things and *abholen* only for people,
    that leftover tickets are sold only at the box office, or (RU/UK) that German never
    compares with *mehr*.
  - The *Bescheid sagen* and *gratis* cards now ask for their own word, not *Bescheid geben*'s
    or *kostenlos*'s. Three card notes no longer teach something false (*Roman*, *Ballett*,
    *Tanz*).
- **B1.13 Geld & Verträge — quality pass.**
  - Correct German is accepted in nine exercises:
    - *billiger* beside *günstiger*;
    - *einmal pro Jahr*, *einmal jährlich*;
    - *bis zum Freitag*;
    - *in dieser Rechnung*;
    - *die beiden Beträge*;
    - *wie lang*;
    - the word orders the English prompts use.
  - A mistake somewhere else in the sentence no longer counts against the rule an exercise
    drills. In 14 exercises only the drilled form decides it: the genitive, the *-n* of
    *Kunden*, *als* after a comparative, or the passive with a modal verb.
  - The comparison exercise now says to write *im Jahr*. The German instruction of the due-date
    dictation now says to write numbers as words, as the other languages always did.
  - The lesson no longer says that *enthalten* is never used with *sich*, that a tip never
    appears on a bill, or that a corrected bill almost never gets a new due date. The spoken
    model answer no longer picks an offer for a reason both offers share.
  - The *Alternative* card's note now puts the stress where its pronunciation does, and the
    *Schulden* note no longer calls *die Schuld* a different word.
- **B1.14 Informationen vermitteln — quality pass.**
  - Te-ka-mo-lo is a default, not a law. Four exercises now also accept a manner word right
    before the participle (*heute Morgen im Hof schnell nachgefragt*).
    The word-order exercise had a duration (*lange*) where it meant "how", so it now uses
    *zusammen*.
  - Correct German is accepted in seven more exercises:
    - the Präteritum;
    - the future;
    - *dass er morgen im Büro den Schlüssel abgibt*;
    - *die Versammlung* for «собрание»;
    - *um sieben Uhr*;
    - *dass man den Aufzug repariert*.
  - A mistake somewhere else no longer counts against the rule an exercise drills. In 13
    exercises only the drilled decision counts, so a misspelt verb (*abgebt*, *angeruft*) is
    no longer a word-order or reported-speech mistake.
  - The German instructions for passing on a notice now say *Indikativ*, as the other
    languages did. Five exercises now name the words they grade around: *es*,
    *im Büro anrufen*, *fahren*, *Termin* and *Zug*. Two delayed checks name the pair to
    order, and one gets a fresh sentence instead of a near-copy of a practice item.
  - The lesson no longer says that:
    - *wenn* is only for a repeated time;
    - every *sein*-verb makes a participle you can put before a noun (not *der gelaufene
      Mann*);
    - English always shifts the tense back.

    One exercise gave *heut-* as the stem of *heutige*; it is *heutig-*.
  - The *Rückmeldung* and *hinterlassen* cards now ask for their own word, not *Antwort*'s
    or *lassen*'s.
- **B1.15 Unfall & Notruf — quality pass.**
  - Emergency numbers:
    - The exercise that keyed 110 for a bicycle stolen overnight now shows a theft
      happening in front of you. A theft you find later is reported at a police station or
      online.
    - 112 is now described as the number for an accident with someone injured, not "for
      anyone who is hurt".
  - Correct German is accepted in nine exercises:
    - the Präteritum (*Ich fuhr …*, *Der Radfahrer stürzte …*);
    - the main clause first;
    - *abgefahren*;
    - *Mein Kopf tut weh*.
  - Several exercises now name the words they grade around: *untersuchen*, *ein Pflaster
    anlegen*, *stürzen*, *wehtun*, *abschließen*, *der Beamte*, *der Pass*.
  - Only the Plusquamperfekt itself now counts against *nachdem*:
    - a case slip or an unfinished answer no longer does;
    - the word-order exercise no longer offers two articles to swap.
  - One delayed check could be answered from memory of a practice sentence. It now has a
    fresh one. Another one now notices *hat* or *war* in place of *hatte*.
  - The lesson calls the order of time, reason, manner and place a default rather than a
    fixed law, and explains why a direction (*über die Straße*) still stays last.
  - Twelve notes in the body and medicine deck no longer teach something false, for example:
    - that *Schweiß* and *weiß* have different vowels;
    - that *erkältet* always needs *sein*;
    - that *Herz* is the last irregular noun.
- **B1.16 Polizei & Anzeige — quality pass.**
  - Correct German was marked as a reported-speech mistake. It is now accepted in eight
    exercises:
    - the Präteritum (*dass sie Lärm hörte*, *dass sie die Geldbörse fand*);
    - *gewesen ist*;
    - *sollte*;
    - *die Geldbörse*, the course's own word for "wallet";
    - *meine Nachbarin*;
    - *ein Formular*.
  - Reported speech is now judged on what it teaches: the word that opens the reported part
    and its tense. Where the verb stands is judged elsewhere, and the present tense in *ob die
    Tür offen ist* now counts as the mistake it is.
  - The reported-questions table no longer asks about *gestanden*, so *ist gestanden* (southern)
    and *hat gestanden* are no longer marked wrong.
  - *aufbrechen* is named where "broken door" left the verb open.
  - The lesson no longer says that:
    - *wenn* is only for conditions;
    - a bare participle only follows *sein* or *werden*;
    - every participle before a noun is passive;
    - a police report has exactly five questions.
  - Eight law and crime card notes no longer teach something false. For example:
    - *einbrechen* takes *haben* as well as *sein*;
    - the BKA is not "above" the Kriminalpolizei.
- **B1.17 Versicherungen & Behörden — quality pass.**
  - The exercises on adjectives without an article now contain an adjective
    (*aktuelle Nachweise*, *weitere Unterlagen*). The lesson explains the ending.
    Before, an added *die*, or a different word for "documents", was marked as that mistake.
  - *des Vertrag* and *der Untersuchungs* were accepted as typos. They now count as the
    genitive mistakes they are, and *des Vertrages* is accepted beside *des Vertrags*.
  - Correct German is accepted:
    - the *wegen* phrase after the object;
    - *meines Vertrags*;
    - the Präteritum;
    - *sich verändern*;
    - *darf man* and *du*.
  - Fixed facts: the AOK insures against illness, not accidents. Someone who finds
    something must report it, not hand it in.
  - Ten card notes, three card prompts and one pronunciation no longer teach something
    false.
- **B1.18 Rauchen, Alkohol & Gewohnheiten — quality pass.**
  - An unreal condition without *wenn* (*Würde er weniger Zucker essen, wäre er
    schlanker*) is accepted, and so is the main clause first. Before, it was marked as the
    Konjunktiv mistake.
  - *Wenn ich nicht rauche, hätte ich …* no longer slips through as a typo for *rauchte*.
  - Correct German with *lassen* is accepted: a fronted *Auf dem Balkon* or *In der
    Werkstatt*, *unser*, *das Rad* and *durch eine Firma*.
  - Fixed facts: a *Droge* is not illegal by definition, since alcohol is one too. Verbs
    like *käme* do have one-word forms. *gelassen* also occurs after *liegen* or *stehen*,
    and *zu lassen* exists after *raten*.
  - Two reading explanations no longer contradict the text, and eleven card notes no
    longer teach something false.
- **B1.19 Bildungswege — quality pass.**
  - Fixed facts: the Grundschule lasts six years in Berlin and Brandenburg, not four
    everywhere. The Fachhochschule does not require the Abitur, and the Volkshochschule
    also offers school certificates.
  - Correct German is accepted, where several renderings were marked as the
    *falls*/*damit* mistake before:
    - the main clause before the *falls* or *wenn* clause;
    - a *damit* clause at the start;
    - the *werden*-future;
    - *unser*, *das Studium*, *die Dokumente*.
  - In the placement test, *Wenn* is accepted where a place may or may not come free.
  - The purpose table no longer asks for the one row where *damit* would also be correct.
  - Twelve card notes no longer teach something false.
- **B1.20 Gespräche steuern — quality pass.**
  - The lesson no longer calls *Darf ich …?* and *Können Sie …?* impolite. Both are polite,
    and the Konjunktiv II makes them one step softer.
  - Items that want the Konjunktiv II now say so. Before, a polite *Darf ich* was marked as
    the Konjunktiv mistake.
  - Correct German is accepted:
    - *bitte* and *mal* in other positions;
    - *darüber* for "about that";
    - *Vor allem ist es …*;
    - *Nun* and *doch* in two gaps.
  - The placement test checks *übrigens* + verb as a translation. Before, it was a gap
    that showed both words.
  - Several lines no longer state a tendency as a rule: a missing listener signal, and
    *Ich weiß nicht* on its own. Two reading explanations no longer contradict the text.

## [0.6.18] — 2026-10-11

### Fixed

- **Arbeit & Bewerbung (B1.4), checked end to end.** Three exercises accept correct answers
  they rejected: *Bankangestellter*, *mit dem Kollegen*, *Einladung zum Vorstellungsgespräch*. The
  application-letter task named a different contact person than the job ad printed beside it; it
  now clearly describes a different shop. The article no longer calls *Für weitere Fragen stehe ich
  Ihnen gern zur Verfügung* the one fixed closing line. And it now mentions *der Friede* beside
  *der Name*.

## [0.6.17] — 2026-10-11

### Fixed

- **Gesundheit & Wohlbefinden (B1.3), checked end to end.** The delayed check for *lassen*
  counted its most typical mistake, *ich lasse meine Wohnung zu putzen*, as the rule
  remembered. It now counts it as forgotten, along with the other *lassen* errors. Several
  exercises accept correct answers they used to reject: *Ich lasse mir die Wohnung putzen*,
  *Ein paar Wochen solltest du …*, *mehrere Wochen*, *eine kleine Pause*. One gap exercise no
  longer prints its answer in the instructions. And the article no longer says *Obst* never
  takes an article.

## [0.6.16] — 2026-10-11

### Fixed

- **Leben verändern (B1.2), checked end to end.** Seven exercises and delayed checks accept correct
  answers they rejected: *günstigere* or *preiswertere* for "cheaper", other word orders, *unserer
  früheren Wohnung*, *Freundinnen* and *Kolleginnen*, *Kinds* beside *Kindes*, and *mit der* for
  "the doctor I have the appointment with". One exercise let *Wohnungs* through as a typo, though a
  feminine noun never takes that *-s*. It now marks it wrong. The Russian and Ukrainian
  explanations no longer say German never compares with *mehr*.

## [0.6.15] — 2026-10-11

### Fixed

- **Natur & Wetter (A2), checked end to end.** The delayed check and one exercise graded the
  adjective instead of *es*. So *kaltes* or *heiß* counted as forgetting *es*, while a sentence
  that actually dropped *es* was not counted as that mistake. Both now grade *es*. Three
  exercises accept correct answers they used to reject (*eine ganze Woche lang*, *Hinter dem Haus
  gibt es alte Bäume*), and the word-family table no longer asks for one specific word where
  *wolkig* is just as right.
- **The article no longer overstates its rules.** *Die Sonne scheint* is not the only weather
  sentence without *es*, and an adjective after *sein* takes no ending. Not every short vowel gets
  an Umlaut (*trocken → trockener*). *Es gewittert* exists. The *Pflanze* card now names
  *pflanzen* as its verb.

## [0.6.14] — 2026-10-11

### Changed

- **The daily practice pages no longer re-download the whole course on every visit.** Session,
  Wiederholen, Training and Probe-Rückstand each carried every flashcard or every exercise —
  7 to 18 MB of page — and fetched it again on each visit. They now share two content files that
  are downloaded once and kept until the course content changes. The pages themselves are
  19–118 KB. A repeat visit on a mobile-speed connection opens 4–6 times faster: 0.35–0.58 s
  instead of 1.5–3.3 s. In the installed web app the files are stored at installation, so these
  pages work offline from the first launch.

## [0.6.13] — 2026-10-11

### Fixed

- **Erfahrungen erzählen (B1.1), checked end to end.** Eleven exercises and delayed checks marked
  correct German wrong, or blamed a correct answer on the wrong rule. Examples: *meine Freundin*
  for "my friend", *auf dem Hof*, *verließ sie das Zimmer*, a spoken Perfekt where the task never
  asked for the Präteritum. They now accept these answers, or say which form they want. Two gap
  exercises now name the verb they ask for. A listening explanation described the story wrongly,
  and *Ereignis* had the wrong pronunciation.
- **The article explains more.** It now contrasts German tenses with English, Russian and
  Ukrainian. It also shows that *nachdem, bevor, während, bis* and *seitdem* each have an adverb
  partner with the opposite word order: *Seitdem ich hier arbeite, …* versus *Seitdem spreche
  ich …*. And it no longer marks a correct sentence about the past wrong.

## [0.6.12] — 2026-10-10

### Changed

- **Fortschritt is 1.37 MB instead of 12.2 MB.** Its vocabulary section received every
  flashcard in the course to draw per-level, per-deck and per-word-type bars. It now draws them
  from the cards' identities. All 143 rows show the same word counts as before.

## [0.6.11] — 2026-10-10

### Changed

- **Heute, the page the app opens on, is 0.51 MB instead of 11.3 MB.** Its review tile carried
  every flashcard in the course, glosses and examples included, to work out one number. It now
  counts from the cards' identities alone, by the same rule the review session uses, so the
  numbers still agree. Topic pages lose the same weight from their per-deck due badges, 3.2 MB
  across all of them.

## [0.6.10] — 2026-10-10

### Changed

- **The Wortschatz page is about 42 times smaller: 264 KB instead of 11.1 MB.** It drew one mastery
  bar per deck from 129 separate islands, and each was handed its deck's complete flashcards
  (glosses, examples, notes) to count words. One island now draws every bar, from the
  headwords alone, and reads your progress once instead of 129 times. The bars show the same
  counts.

## [0.6.9] — 2026-10-10

### Changed

- **A Leben-in-Deutschland question you get wrong now comes back later, not 4 questions later.**
  It follows the rule flashcards have used since 0.6.6. A question that was new or still being
  learned is asked again after 8 others; one you had already learned, after 50, or at the end of
  the sitting if fewer are left. Each further miss halves the wait, down to 3. Asked again only
  4 questions later, you were answering from the explanation still in mind rather than from
  memory. This applies to practice and to *Fehler wiederholen*.

## [0.6.8] — 2026-10-10

### Maintenance

- Linting moves from ESLint to **Oxlint**: about 0.1 s instead of 7.8 s. ESLint's rules carry over,
  including React's compiler rules, which Oxlint now runs natively, and Oxlint's own correctness
  rules join them. `eslint-plugin-astro`'s eight rules are dropped; `astro check` and the build
  already fail on most of what they catch. Warnings now fail the lint too. The 13 places the new
  rules flagged are rewritten without changing behaviour. Only the script
  bundles changed; all 252 built HTML files are identical once hashed bundle names are normalised.
  With ESLint gone, so is the one high-severity `bun audit` advisory (`braces`).
- TypeScript moves to 6.0.3, and the configuration drops what TypeScript 7 rejects. TypeScript 7
  itself waits only on `astro check` (backlog P30-3).

## [0.6.7] — 2026-10-10

### Changed

- **Every Leben-in-Deutschland lesson section now has a translation you can open.** The lessons
  stay German — the exam is German — but each section, the summary included, ends with a collapsed
  *Übersetzung* in your Lernsprache (English, Russian or Ukrainian), translated from the German
  with nothing added or left out. Under Lernsprache *Deutsch* the translations are hidden. Before,
  only the summary was in your language and the sections were German only, which left a hard
  paragraph with nothing to check it against.
- **Each lesson's *Kurz gesagt* now has a German version**, shown first, with its translation in
  your Lernsprache open right under it — the summary is read in both languages at once; only the
  sections below translate on demand.

### Fixed

- *Ministerpräsident* was rendered "state premier" / «премьер-министр земли» in the Bayern lesson's
  glossary and in four lesson translations, and «премьер-министр» in one Russian answer option —
  next to an exam question whose wrong answer is "Premierminister". It now reads
  "Minister-President" / «министр-президент» throughout, as the other question notes already did.
- *Rosenmontag* was «Розовый понедельник» ("pink Monday") in the Russian notes and glossary; it is
  «Розенмонтаг», as in Russian and in the Ukrainian half. *Stolpersteine* is «камни преткновения»
  in the Russian lesson, matching the question note.

## [0.6.6] — 2026-10-10

### Changed

- **A missed flashcard comes back later, not four cards later.** "Again" still shows the answer
  at once, but the retry now waits 8 cards for a word you could not retrieve at all and 50 for a
  word you had learned before or nearly got (only the article or an umlaut wrong); every further
  miss halves the wait, never below 3, and a short queue puts the card last. The old four-card
  retry came back within about a minute and was answered from working memory; delaying the next
  retrieval is what carries to long-term memory. The counts are heuristics, the delay is the
  research — `src/lib/requeue.ts` names the studies.
- **Page headers no longer repeat the navigation.** Wiederholen, Training, Wortschatz, Leben in
  Deutschland and its sub-pages, Themen, Entdecken, Referenz, Fortschritt and the daily session
  drop the heading that restated the tab or breadcrumb above it and the standing description under
  it; the description is now the tooltip of the tab or link that leads there, in your Lernsprache.
  Heute opens on the session card (the greeting and the quick-access row, whose links the
  navigation already has, are gone). Chips, eyebrows and breadcrumb tails that repeated a page's
  own title are gone too, and Wortschatz deck cards show one due count instead of two in different
  units. On the pages that changed, content starts up to 216 px higher on a 1280 px screen and up
  to 378 px higher on a phone.
- **One header row on every screen.** On a phone the section menu moves into the top row and the
  profile button shows only its icon: the sticky header is 57 px instead of 103. The menu now
  serves every width below 768 px, where the link row used to wrap onto a second line.
- The flashcard toolbar drops its "Eingabe:" label, and the direction label shows only where
  nothing else says it (listening, and revealing a German answer).
- The installed app no longer offers "App installieren" in its own footer.

### Fixed

- Tables nested inside an article block now scroll inside themselves instead of pushing the page
  sideways on a narrow phone, as do the Zahlen reference grid and a lesson's question list; no page
  scrolls horizontally at 360 px.
- The vocabulary progress note no longer says A1 and A2 are "still being completed".

## [0.6.5] — 2026-10-10

### Maintenance

- The site's MDX and React integrations move a major version (`@astrojs/mdx` 8, which hands MDX to
  Astro's new Markdown processor; `@astrojs/react` 7 and `@vitejs/plugin-react` 6, which compile
  JSX with Oxc instead of Babel). All 252 built HTML files are identical to the previous build's
  once hashed bundle names are normalised; only the script bundles changed. Tonwerk's tests move to vitest 5, and CI's uv setup to
  `setup-uv` v10.2.0. ESLint 10 and TypeScript 7 wait on upstream plugins (backlog P30-3).

## [0.6.4] — 2026-10-10

### Added

- **Leben in Deutschland in Ukrainian.** Under Lernsprache *Українська*, the unofficial
  translation of every one of the 310 questions, its four options and its key terms now shows a
  Ukrainian half beside the English, and every lesson has a Ukrainian orientation and glossary.
  The Ukrainian was written from the official German, not from the Russian. LiD material counts
  toward the UK-coverage figure again.

## [0.6.3] — 2026-10-10

### Added

- **Leben in Deutschland: the last five lessons** — Deutschland in Europa; Recht, Behörden und
  Alltag; Arbeit und soziale Sicherung; Familie, Kinder und Bildung; Staatssymbole, Religion und
  Feste. With them, all 18 topics and every one of the 310 questions belong to a lesson, and each
  author mapped every question to the section that teaches it. Where Bavarian practice differs
  from the simplified key — the optional or abolished Widerspruch — the lesson teaches the key and
  says how to read the letter's own instructions.

## [0.6.2] — 2026-10-10

### Added

- **Leben in Deutschland: seven lessons** under *Lernen* — Bayern, Wahlen und Parteien, Wer
  regiert Deutschland?, Demokratie/Rechtsstaat/Sozialstaat/Bundesstaat, Grundrechte, Teilung und
  Einheit, Nationalsozialismus und Erinnerung. Each teaches the system behind its exam questions in
  simple German, with an EN/RU orientation, a glossary in the learner's language, and a button to
  practise exactly its questions. Together their topics hold 206 of the 310 questions, and each
  author mapped every one of them to the section that teaches it. Each question's explanation links
  to its lesson.
- Practice can be scoped to a lesson (`/leben/ueben?lektion=…`): last mistakes first, then unseen
  questions, then the rest.

### Fixed

- Tests of timer-driven storage recovery polled for the outcome instead of sleeping a guessed
  duration, which the slower Windows release lane overran (#246).

## [0.6.1] — 2026-10-10

### Added

- **Every Leben-in-Deutschland question now explains itself.** After answering in practice, all
  310 show a short rationale in simple German with its source, the key terms, and an unofficial
  English/Russian translation on request. Written in four topic waves, each read against the
  official key; an independent fact-check of all 310 found three errors, now fixed.

### Fixed

- The Windows release lane failed a keyboard test that pressed its key before the listener was
  bound. The test now waits for effects to flush.

## [0.6.0] — 2026-10-10

### Added

- **Leben in Deutschland (Bayern)** under Üben: practice with spaced review of all 310 official
  questions, a mistakes queue, a timed 33-question mock exam scored against both pass marks
  (17 for the Einbürgerungstest, 15 for the Orientierungskurs), and the full catalogue. The bank
  is the official text, verified on import; LiD progress syncs as snapshot v8 (ADR 0021).
  **Update every device:** a 0.5.x app cannot read a v8 snapshot, so it stops syncing (it never
  overwrites one) until it is updated.

### Maintenance

- Dependencies refreshed within their ranges across the workspace, Tauri 2.11 → 2.12 on both
  the JavaScript and the Rust side of both desktop apps. `bun audit` reports 2 advisories instead
  of 51; the remaining two are build-time only. Major upgrades are deferred (backlog P30-3).

## [0.5.2] — 2026-10-10

### Fixed

- Progress writes now abort stalled local transactions before retrying, instead of opening
  connections behind the same lock. Retries share one ordered journal drain; daily-session
  completion is journaled too. If the database cannot recover, the app requests a restart
  while keeping pending entries. Storage failures no longer quarantine valid answers.
- Storage diagnostics include transaction phase, recovery outcome, queue depth and build
  version. The underlying WKWebView stall trigger is not yet established.

- **Themen said "Загружаем ваш прогресс…" forever, and Heute said progress could not be
  loaded, while 824 cards and 3919 attempts sat in the store.** An IndexedDB read in the
  desktop webview stalled, and the app had no way back from it: reads had a 10 s deadline but
  — unlike writes since 0.5.0 — no timed retry, so nothing ever tried again; the Lernpfad was
  the one daily-loop surface with neither a deadline nor a rejection handler, so its loading
  line was permanent; and `getStore()` awaited a 784 KB card-id migration that had been a
  no-op for this learner since it ran, putting a deadline-less read in front of the page's
  first data. Reads now retry at 2 s and 5 s inside the same deadline, every load surface
  distinguishes *still reading* from *read failed* from *confirmed empty* — with a retry
  button where it makes a claim about progress, and an explicit unknown rather than a
  confident `0` where it is only a badge — and the migration has moved out of the store's
  open path entirely, to one owner that runs it once per profile in a single transaction, so
  it can no longer sit in front of a page nor drop a grade written beside it. Nothing here claims the stall itself is gone; it claims the app can no longer
  render one as an absence of progress. → [ADR 0018](docs/adrs/0018-progress-reads-recover.md)
- **Ten rejected renderings, ruled — seven of them correct German.** `feedback.md` had gone
  untriaged since 2026-08-28, so the whole capture is decided in
  `data/grading-decisions.yaml` and the file is empty again. Seven renderings were correct
  German the prompt left free and are now accepted, each paid for by the item's `accept` list
  and a `revision` bump: *Man darf hier nicht parken* for an impersonal Russian prompt (the
  course teaches that very sentence elsewhere); *Darf ich etwas fragen?* where «Можно мне …?»
  asks permission; *um acht Uhr* and *um neun Uhr*, since a clock time is written either way;
  and *Die Nachbarin* / *ein Geräusch* / *den Geldbeutel*, where a bare Russian noun marks no
  possessor and «шум»/«кошелёк» have two ordinary German words each. Where a pin decided which
  word the item graded, the synonym joined it — `darf`, `Darf` — so the tag still fires on the
  rendering it now accepts. One ruling went the other way: `uebersetzen-kaltes-wetter` shipped
  with **no instruction at all**, and *Kaltes Wetter gefällt mir nicht* is good German that
  answers a different question from the one the item teaches, so the instruction now names the
  construction. Two rejections were confirmed, with the reason recorded.
- **`{{der}} Kuchen` marked "Der Kuchen" wrong.** The item was a bare two-word fragment whose
  gap *was* the first token, under an instruction that said "Complete the whole word" — nothing
  told the learner whether the article opened a sentence or sat inside one, and the cloze grader
  compares case-sensitively. It is now a sentence like every sibling in its set, with the true
  diminutive beside the false one. The general case — 66 cloze items open a gap at a sentence
  head, three of them hand-patched as `{{Der|der}}` — is filed as F-13.
- **A dictation rejected `04879` for `null vier acht sieben neun`.** The validator has always
  forbidden the *author* from writing digits in a `listen` text; nothing told the *learner*.
  Thirteen shipped items carried that trap. Each now says so in all three languages, and a new
  validator rule fails any `listen` item that spells a cardinal without telling the learner —
  watched to fail before it was kept.
- **A reason-chunk card graded which connector the author had in mind.** `Ich komme später,
  denn …` is prompted as "because …", which *weil* and *da* render just as well; both are
  accepted now, and the *denn* frame stays the answer shown.
- **The progress-load banner said only that progress could not be loaded**, which sent the
  learner looking for a Cloudflare outage. Nothing on that path touches the network: it is
  IndexedDB on the device, already retried at 0/2/5 s behind a 10 s deadline. The message names
  the local store and says the data is not lost.
- **`gewöhnen`'s flashcard never said it was reflexive.** `valence` renders in the Wortschatz
  table and nowhere on a card, so the answer-side `note` now states *sich an etwas gewöhnen*.
  The headword stays as it is — it is the Goethe Wortliste key, and renaming it would reset the
  card's SRS history.

### Added

- **Fortschritt → Daten shows storage diagnostics.** The failure above left no evidence at
  all: no record of which read stalled, how long it waited, or whether it ever came back, and
  nothing in the app to say that a 1.7 MB backup written two hours earlier was sitting on
  disk. Stalled reads are now recorded per profile (surface, wait, attempt count, timestamp —
  **counters only, never learner content**, and a late arrival is marked as a recovery so
  "the store unstuck itself" is distinguishable from "the store never answered"), shown
  beside the newest local backup's date, card and attempt counts, and path.
- **Three desktop guards**, each against a plausible cause rather than a proven one: a
  single-instance lock, so a second launch focuses the existing window instead of putting a
  second process on one WebKit container's SQLite files; devtools enabled in release builds,
  because the app whose storage can stall is the installed one and it could not be inspected;
  and a report of the second WebKit container that bundle-less runs of the binary create
  (named in ADR 0016 and deferred then) — **reported, never read, moved or merged.**

## [0.5.1] — 2026-08-26

**The flashcards say "heart" again.** Content release so the desktop bundle carries the day's
repairs: the B1 gloss repair (31 decks, ~1030 riddle-style definitional glosses rewritten to
concise idiomatic EN/RU/UK translations — no card identities touched, no SRS history lost), the
drained 30-rendering grading queue with eight accept-payments, and the repaired
`probe-natur-wetter` prompt (the «весь день» sentence now accepts *den ganzen Tag* because the
item finally asks for it in all three languages).

## [0.5.0] — 2026-08-26

**A desktop app that can no longer lose a session silently — and everything shipped since 0.4.0:
the full B1 catalog, the closed lexical/structural/thematic denominators, cloud accounts and sync,
the exam trainer, Redaktion, Tonwerk and the published listening corpus.**

This is the first tagged release since 0.4.0 (2026-07-19); the learner had been running
working-tree builds in between. Highlights of this tag's own changes:

### Fixed

- **Progress writes are durable (ADR 0016).** The desktop app could lose a whole session's
  answers to a silent WKWebView IndexedDB stall (the daily backup for 2026-08-19 simply does not
  exist). Every card grade and attempt is now journaled synchronously before the database write,
  retried on a timer with a hard deadline, replayed on the next launch when it never settled, and
  loud in the UI once it is late. A stalled or implausibly empty read renders an explicit error
  instead of a fresh-looking "no progress" view.
- **A transient server failure can no longer silently stop cloud sync.** The session probe used
  to cache any non-2xx as "signed out" for the lifetime of the app window (#143's four-hour
  outage was this class); a 5xx now reports a sync error and is never cached.
- **Quitting the app flushes the session.** The shell intercepts window close and Cmd+Q once,
  gives the frontend a bounded window to write the local snapshot and push to the cloud, then
  closes — `pagehide` never reliably fired in the webview.
- **The desktop snapshot writer can no longer shrink a daily backup.** An incoming snapshot with
  fewer attempts than the existing file is parked as a sibling `.conflict-*.json` instead of
  overwriting it — the same invariant `progress:pull` and the dev middleware already held.

## [0.4.0] — 2026-07-19

**A course that now speaks to Ukrainian learners, teaches the complete A2 grammar standard, and
has had every A1 and A2 grammar claim read by a human rather than merely accepted by a schema.**

### Added

- **The complete Ukrainian explanation half for A1 and A2.** All 266 content files that carry a
  Russian explanation now carry an idiomatic Ukrainian one too: articles, exercises, readings,
  vocabulary, checkpoints and supporting material. A single *Lernsprache* selector switches among
  English, Russian and Ukrainian while the German examples and course chrome stay visible.
- **The rest of the A2 grammar curriculum.** Adjective declension, `zu`-infinitives and
  `um … zu`, nominative and accusative relative clauses, conjunctional adverbs with inversion,
  `als` versus `wenn`, Futur I, dative reflexives, `man`/`jemand`/`niemand`, possession and
  receptive passive close the measured A2 standard from 20/30 to **30/30**. The new material has
  pretests, productive practice, readings, vocabulary and delayed probes rather than reference
  prose alone.
- **A linguistic QA gate for both completed levels.** Every one of the 22 A1 and 30 A2 grammar
  points has been checked across its EN/RU/UK teaching text, prompts, accepted answers, feedback
  and readings. The resulting ledgers distinguish structural coverage, corpus correctness and
  learner mastery instead of treating one as proof of another.
- **Seven focused reference pages:** cases and prepositions, pronominal `da`/`wo` words, verb
  forms, numbers/dates/time, sentence connections, meaning-contrast *Wortnetze*, and their index.
  The connector reference tells the full A2-to-B2 story in one place while labelling the level at
  which each form becomes a learning target.
- **Ten multilingual Wortnetze** for distinctions a dictionary translation tends to flatten:
  among them *kennen/wissen/können*, *machen/tun*, *denken/glauben/meinen*,
  *sagen/erzählen*, *sprechen/reden* and *wohnen/leben*. Compact reminders also appear on relevant
  vocabulary cards.
- **Five A2 Entdecken pieces** built around real language in context: Berlin's U-Bahn map,
  Pfand and waste sorting, the Deutschlandticket, the migration history of the Döner, and regional
  greetings from *Moin* to *Grüß Gott*. Opening them creates no review debt.
- **The Schreib-Assistent.** Open writing can request advisory hints before submission in both the
  browser and desktop app. Its suggestions remain visibly unverified and never become mastery
  evidence.
- A compact progress audit, a committed queue of grading rulings, catch-up pacing for overdue
  delayed probes, and targeted production drills for persistent dative, verb-form, location and
  noun-gender weaknesses.
- The official Goethe-B1 Wortliste manifest (3,416 headwords), ready to measure B1 coverage when
  B1 authoring begins.

### Changed

- **Grading now asks one honest question: right or not yet.** The exercise result surface uses two
  actions rather than a confidence scale, and open writing/speaking use a single-pass flow with
  optional repetition instead of requiring a ceremonial second attempt.
- **Punctuation and typography are presentation, not hidden answer keys.** Quotes, commas,
  sentence-final punctuation, apostrophes and dash variants no longer turn an otherwise correct
  target rendering into a grammar failure; actual words, endings and word order remain graded.
- Correct alternative renderings found in the grading-review queue and the two linguistic corpus
  passes are now accepted without weakening the focus being measured. Any scoring-contract change
  carries an item revision so old evidence is not silently reinterpreted.
- *Alle Themen* is quieter: mastered rows collapse into a persisted summary, practised rows show
  only what is still missing, and completed evidence is not repeated beside the mastery badge.
- Discovery content now supports provenance-checked images and clearly online-only external links.

### Fixed

- The delayed-probe step could re-grade the previous answer after advancing to the next item.
- Desktop writing assistance now uses Tauri's HTTP transport instead of relying on browser fetch
  behaviour inside the webview.
- Entdecken feedback buttons persisted a click without showing a pressed state.
- A long corpus pass corrected over-broad or false explanations around case, movement/location,
  adjective endings, comparisons, subordinate clauses, reflexive and prepositional verbs,
  imperatives, modal verbs, time expressions, negation, passive and register. It also removed
  underdetermined prompts that could record valid German as a false weakness.

## [0.3.0] — 2026-07-13

**A complete A2.** Sixteen units, a cumulative checkpoint, and every word of the
Goethe-Institut's A2 Wortliste — measured, not asserted.

### Added

- **All sixteen A2 units.** *Wohnen & Umzug*, *Reisen & Verkehr*, *Einkaufen & Reklamation*,
  *Gesundheit & Arzttermin*, *Arbeit & Beruf*, *Nebensätze & Pläne*, *Biografie & Erfahrungen*,
  *Freunde & Feste*, *Lernen & Verstehen*, *Ämter & Dienstleistungen* — each with a diagnostic
  pretest, a full article, a graded reading, listening, writing and speaking tasks, and a delayed
  probe that asks the same competence again weeks later.
- **The whole Goethe-A2 Wortliste.** All 1449 headwords: 1358 as flashcards, 91 taught as grammar
  in an article rather than drilled as vocabulary. That last number used to be a promise the course
  made to itself — now it is checked, and the build fails if a word the course claims to teach
  without a flashcard does not actually appear in an article, a reading or a practice item. Nine of
  those claims turned out to be false when the check was first run, including one at A1.
- **A cumulative A2 checkpoint** — twenty items across all sixteen units, offered only once the
  whole level is behind you, and never mixed into ordinary practice.
- **New cards are rationed by the day, not by the sitting.** Reloading the review page used to hand
  you fifteen more new words, and fifteen more after that — a debt the scheduler would then deliver
  faithfully for months. Fifteen a day is now fifteen a day, however many times you come back.
- **Three more long reads.** Lena finds work she actually wants, and goes to her first German
  party — read straight through, with the glosses closed.

- **Delayed outcome probes.** Two, seven and twenty-one days after you learn a topic, the same
  competence is asked again — in a task you have not seen — and it opens the session, before
  review and training. A probe answered after twenty minutes of practice on the same material would
  measure the practice, not the interval. Ten A1 probe families, three parallel variants each.
  Fortschritt reports the results apart from practice accuracy, at the interval that *actually*
  elapsed rather than the one that was scheduled.
- **Delayed probes for A2 as well.** Sixteen families, one per unit — production-led, not multiple
  choice. The six A2 topics that predated this release had none at all, so weeks of dative and
  Perfekt practice had produced no evidence that any of it survived; those families arm off the
  practice already in your log, so the first checks fell due immediately.
- **A2 can now be listened to, written and spoken.** Six A2 topics were built before the rest of the
  course was, and you had been practising them entirely by typing into boxes: no listening with the
  transcript hidden, no writing that gets revised, and no speaking at all. Every A2 unit now has
  a listening task, a writing task with a checklist and a second draft, a speaking task you record
  and replay, and exercises that make you *choose* the rule rather than apply the one you were just
  shown — with the whole set built around one real situation, so the listening, the writing and the
  speaking are the same story rather than six unrelated drills.
- **Lena's second episode.** A2's first long read: she has a bakery job that starts at five, an
  alarm at four, and a German course at six in the evening. Something has to give.
- **An A2 vocabulary figure that is measured rather than claimed.** The Über page reports A2 against
  the official Goethe-Institut A2 Wortliste, exactly as it already did for A1. The number is computed
  from the content, so it cannot flatter the course — and when this release began it read 51%.
- **An extensive reader.** "Lena in Bremen" — a longer text meant to be read straight through for
  meaning, with sparse glosses and no line-by-line quiz. Readings now declare whether they are
  intensive or extensive, and the validator holds the two apart.
- **A reserved share of broad retrieval.** A quarter of every mixed session now goes to material you
  answered correctly a long time ago. Recency and weakness are the loudest signals, not the most
  informative ones, and they used to take the whole session.
- Local record/replay speaking practice with self-check and a required improved attempt; recordings
  never leave the current browser tab and never produce verified mastery.
- Actual response modes on new attempts, so progress distinguishes selected, written, listening and
  spoken activity from the curriculum outcome's intended skill.

### Changed

- **Typing a German sentence is graded honestly.** A one-letter slip in an otherwise correct
  sentence used to fail the item *and* be recorded as a failure of the grammar it was drilling. It
  is now shown as a spelling note and scored correct. Articles and pronouns are never forgiven this
  way — `den` for `dem` is a choice, not a slip.
- **A mistake is only blamed on the confusion it is actually about.** `Sie ist zu Hause gebliebt`
  was being logged as a *haben-sein* error although the auxiliary was right. Errors that cannot be
  attributed are now recorded as unattributed rather than mislabelled, because the weakness signal
  drives which drills you are given — and it had been sending them after confusions the learner did
  not have.
- **More writing, less picking.** Every topic's practice now has to include real sentence
  production, and multiple choice can no longer carry a topic. Thirty new production items.
- Open writing now uses a draft → checklist → revision loop and preserves both versions as
  unverified practice evidence.

### Fixed

- The dev server could overwrite a day's progress snapshot with an emptier one from any browser that
  happened to use the same profile name. It now refuses to shrink a snapshot and parks the incoming
  state in a conflict file instead of discarding it, and a refused sync is reported rather than
  silently swallowed.
- Writing drafts were shared between profiles on the same device.
- Reading comprehension answers were not recording their evidence quality or response mode.
- **Mixed training sometimes served two exercises from the same topic back to back.** Interleaving is
  the whole point of mixed training — meeting a rule out of its own context is what forces you to
  choose it rather than merely apply it — and a third of sessions were quietly failing to do it. The
  queue is now built so that consecutive items come from different topics whenever the session's
  composition allows it at all. It also used to count two exercise files from the *same* topic as
  different topics, which let two dative questions sit side by side; the dative alone owns four such
  files.
- **The delayed checks could not have shown whether anything stuck.** A check is supposed to ask the
  same question again after two days, a week and three weeks, so that you can see what fades. They
  were instead asking a *different* question each time — word order at two days, verb endings at a
  week, negation at three weeks. Each skill was therefore tested exactly once, at exactly one delay,
  and nothing could be compared with anything. Every check was rewritten so its three versions test
  one skill in three different situations, and the result is the curve it was always meant to be.
  Caught before a single check had been answered, so no history was lost.
- **The delayed checks were also being made easier at exactly one interval.** Every check comes in
  three versions, one served after two days, one after a week, one after three weeks — and the
  middle one was a fill-in-the-gap while the other two asked you to build the whole sentence from
  nothing. The week-old result would have looked stronger than the others no matter what you
  actually remembered. All three versions now ask for the same kind of answer, so the only thing
  that changes between them is how long it has been.
- **A word-order variant could switch off the grading it was meant to be generous about.** When an
  exercise accepts more than one correct word order, the alternative often starts with the very word
  the exercise is grading — *am Samstag* becomes *Am Samstag*. The capital letter made the scorer stop
  recognizing it, so typing *Um* instead of *Am* was quietly forgiven as a typo rather than recorded as
  the mistake it is. Fixed, with a test that fails without the fix.
- **Four A2 can-dos were promised and never asked about.** *I can use the dative pronouns*, *…the
  dative prepositions*, *…verbs like helfen and gefallen* and *…the modal forms* were listed on the
  topic pages but tagged on no exercise, so they could never be marked as learned and no delayed
  check could ever fire on them. The exercises that had been drilling them all along are now tagged
  correctly, and a rule was added so a topic can no longer advertise a skill nothing measures.

## [0.2.0] — 2026-07-12

The A1 release. Version 0.1.0 shipped the desktop shell; almost the entire course arrived after it.

### Added

- **A1 is complete.** Ten units, from Erste Schritte to Freizeit & Können. Each has a diagnostic
  pretest, a full bilingual article, a graded reading with in-place glosses, exercises across
  several task types, and its own vocabulary with reviewed Lautschrift.
- **Cumulative A1 checkpoint** (`/checkpoint/a1`) — one pass over the whole level across listening,
  reading, grammar and free production. Excluded from ordinary training; results appear on
  Fortschritt broken down by skill.
- **Full Goethe-A1 Wortliste coverage** — every headword on the official list is either taught as a
  flashcard or addressed as grammar. `bun scripts/coverage-a1.ts` reports the live figure.
- **Curriculum spine and Atlas** — `content/atlas.yaml` is the ordered teaching path plus the
  relationships between topics (prerequisites, `deepens`, `related`), with learner-facing "Ich
  kann …" outcomes per topic.
- **Alle Themen** — a new tab on Themen showing every topic in curriculum order with its measured
  status, the evidence behind it, and its next action. Expanding a row shows how the topic connects
  to the rest.
- **Über page** — the learning principles the course is built on, and an honest statement of how
  complete each CEFR level actually is. Every figure on it is measured from the content at build
  time.
- **Reading texts** on every topic — comprehensible input at the topic's own level.
- **`write` and `audio-comprehension` tasks.** Open writing is stored as unverified practice and
  never counted as a correct answer.
- Split licensing: MIT for the app, CC BY-SA 4.0 for the course material.

### Changed

- **Wiederholen no longer deals the same cards in the same order.** Ties are broken at random, and
  a word's two flashcards (recognition and production) can no longer land next to each other —
  seeing "Brot → bread" immediately before being asked to produce *Brot* turned a retrieval into a
  copy.
- Üben is one section (Wiederholen · Training · Wortschatz) instead of three separate pages.
- Heute teaches itself to a learner with no history instead of showing three zeros.
- Mixed training and fresh flashcards are gated on material the learner has actually opened, so
  automatic practice can never surface untaught content.

### Fixed

- **The recommended next lesson could be a topic already marked "Gemeistert".** The path advanced a
  topic only when every item of its practice set had been attempted, so deepening a topic — adding
  items to a set the learner had already finished — silently un-finished the lesson. The same gate
  hid the A1 checkpoint from a learner who had mastered all of A1.
- Marking a topic "gelernt" now moves the path along, and reopening a mastered topic brings it back
  until it is worked through again.
- The Fortschritt topic list counted a pretest as practice, so a topic could show "✓ Geübt" beside a
  "Neu" badge.

## [0.1.0] — 2026-07-11

### Added

- Desktop app (Tauri v2) for Windows, Linux and macOS, with automatic progress sync to a folder of
  your choosing.
- Local learner profiles — no accounts, no server. Several people can share a device with fully
  separate progress, and the browser's own databases are the source of truth for who has learned
  here.
- FSRS flashcards with typed production, Lautschrift (IPA) and tap-to-hear audio.
- Progress snapshots: export, and a non-destructive merge on import.

[0.4.0]: https://github.com/VitalyVorobyev/deutsch-textbook/releases/tag/v0.4.0
[0.3.0]: https://github.com/VitalyVorobyev/deutsch-textbook/releases/tag/v0.3.0
[0.2.0]: https://github.com/VitalyVorobyev/deutsch-textbook/releases/tag/v0.2.0
[0.1.0]: https://github.com/VitalyVorobyev/deutsch-textbook/releases/tag/v0.1.0
