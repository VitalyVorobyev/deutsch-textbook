# Beyond the textbook: future content directions

Status: product-direction note, not an implementation commitment (2026-07-12).

Deutsch-Atlas is becoming consistent, measurable and pedagogically careful. That is necessary, but
it is not sufficient. A course can have correct German, complete metadata, good explanations,
retrieval practice and a coherent curriculum while still feeling like an endless sequence of
lesson artifacts. German then appears as material to process rather than a language through which
something interesting happens.

The internet makes the contrast sharper. Outside the course there are voices, places, documents,
arguments, jokes, histories, maps, timetables, advertisements and people. Inside the course, the
learner often sees an article, a short invented reading and a set of exercises. The current system
protects quality well, but it does not yet make enough use of the world around the language.

The answer is not to add random media. Authentic content can be incomprehensible, unstable,
legally awkward and educationally empty. The direction should be **more contact with life, under
the same discipline that currently protects the curriculum**.

## A working product model

Different artifacts should do different jobs:

- **Missions** give a unit a reason to exist: arrange an appointment, choose a flat, recover from a
  cancelled train, understand a local event.
- **Lessons** teach the language needed for that work.
- **Stories and media** make German a source of information, pleasure and cultural contact.
- **Documents** train the visual and pragmatic reading required outside a textbook.
- **References** organize the language for later lookup and comparison.
- **Vocabulary fields** expose lexical structure, useful chunks and optional breadth.
- **Exercises, production and SRS** create and preserve learning evidence.

These layers should cooperate, but they should not share one false definition of progress. Reading
a cultural story, consulting a case table and successfully producing a sentence are three different
events. All may be valuable; only the last two become learning evidence when they actually demand
retrieval or production.

## 1. Use missions as an authoring constraint

A mission does not need a schema, a new screen or a branching engine. It can simply be the question
that disciplines authoring:

> What should the learner be able to accomplish by the end of this unit, and what would make that
> accomplishment feel real?

For example, a unit about appointments might culminate in this situation:

> A voicemail changes your appointment. Understand the new time, compare it with your calendar,
> call back to negotiate another time and write a confirmation.

This naturally connects listening, time expressions, modal language, interaction and writing. It
also exposes missing content: if the learner knows the dative table but cannot respond to the call,
the unit is not complete.

The mission should guide selection, not decorate a checklist. A weak mission merely places a story
around unrelated multiple-choice questions. A strong mission changes what the learner must notice,
retrieve and produce.

For now:

- write one mission sentence for every new or substantially revised unit;
- make the final task use a fresh context rather than repeat a drilled sentence;
- preserve the existing content IDs and evidence model;
- do not build mission-specific progress, rewards or branching;
- review whether the sequence actually supports model → scaffold → fade → transfer.

## 2. Bring in the real world, but prefer authentic tasks over authentic difficulty

“Authentic” is not a synonym for “good.” A native newspaper article may contain realistic German
and still be a poor A2 learning artifact. The learner can spend ten minutes decoding names, idioms
and background assumptions without practising the intended skill.

The more useful target is an authentic act:

- find a viable train connection;
- identify what a landlord is asking for;
- interpret opening hours and exceptions;
- choose between two offers;
- extract the action required by a notice;
- relay the important part of a message;
- respond appropriately to an invitation or cancellation.

The source may be real, adapted or course-created. A well-designed fictional voicemail can be more
educationally authentic than an uncontrolled real recording.

Use three source classes deliberately:

1. **Real:** openly reusable, stable material whose original form matters.
2. **Adapted:** shortened, anonymized or simplified material that preserves the genre and task.
3. **Simulated:** original material that behaves like the real artifact while remaining
   level-controlled, accessible and durable.

Core learning should not depend on an arbitrary YouTube upload, changing news page or region-locked
video. External media can enrich the course, but disappearance must not break the path.

## 3. Make visual documents a first-class form of input

This is probably the highest-value expansion. Real life presents information spatially. A ticket,
form, timetable, menu or advertisement communicates through layout, hierarchy, icons and small
print as well as sentences. Converting it into a paragraph removes part of the skill.

Promising artifacts include:

- train tickets, timetables and disruption notices;
- menus, receipts, labels and opening-hours signs;
- apartment advertisements, floor plans and house rules;
- appointment letters, confirmations and forms;
- event posters, maps and weather graphics;
- chat screenshots and short email threads;
- simple public notices and instructions.

Tasks should operate on the artifact rather than use it as decoration:

- locate the relevant field or region;
- extract a date, price, address or restriction;
- compare two documents;
- transfer information from one format to another;
- decide what action is required;
- write or speak the next response.

Keep the document visible during the task unless memory is intentionally being tested. Otherwise a
reading exercise quietly becomes an irrelevant working-memory exercise.

Most core documents should probably be original simulations inspired by real genres. Real examples
are worth using when their provenance, reuse rights, attribution and long-term availability are
clear. “Publicly visible online” is not a content licence.

## 4. Add an editorial layer for stories, places, people and history

Deutsch-Atlas should contain German worth reading even when no exercise is due. A lightweight
**Entdecken** or **Magazin** layer could make the language feel connected to a world.

Possible formats:

- `geschichte` — a graded cultural or historical story;
- `ort` — a visual portrait of a city, region or landscape;
- `person` — a short biography with a human question, not a list of dates;
- `alltagsdokument` — a practical visual artifact and a task;
- `bildgeschichte` — a visual sequence for narration or prediction;
- `sprachfundstueck` — an expression, sign, ambiguity or joke worth unpacking.

Good subjects are concrete and generative: divided Berlin through a U-Bahn map, Bauhaus through an
everyday object, migration through the history of a familiar food, the Rhine through a place and a
legend, regional German through an actual encounter. Germany should not become a museum of castles,
sausages and famous dead men. Contemporary life and the wider German-speaking world belong here too.

Each piece should have a language reason to exist: understand a sequence, describe a place, retell
an event, compare perspectives, extract evidence or explain the main point. Culture is strongest
when it changes what the learner can understand or do.

At A1, pieces should be short, visual and concrete. A2 can support connected stories and simple
historical explanation. Broader argument, ambiguity and competing perspectives belong mainly to B1
and above.

Magazine content should normally remain optional. Curiosity is part of the value. Requiring every
interesting story would turn discovery into another obligation.

## 5. Treat humour as a delicacy, not a syllabus

Jokes expose ambiguity, idiom, register, timing and cultural assumptions. That makes them
interesting, but also unusually difficult. Failure to understand a pun is weak evidence about
grammar mastery.

A useful humour item could show:

1. the joke, comic or curious sign;
2. a chance to interpret it;
3. a literal explanation;
4. the linguistic or cultural mechanism;
5. one nearby example using the same mechanism.

Everyday misunderstandings, compounds, false friends and literal readings will usually work better
than decontextualized joke collections. These pieces should invite delight and noticing, not create
accuracy penalties.

## 6. Build dense grammar references for lookup, not instruction

Topic articles explain one concept at the learner's current stage. A reference answers a different
question: “Show me the whole system so I can compare it.” Useful references might cover:

- cases across articles, pronouns, prepositions and verb government;
- German clause and word-order patterns;
- adjective endings;
- pronoun systems;
- Perfekt formation and auxiliary selection;
- major verb classes and conjugation patterns;
- connectors grouped by communicative function.

References should be compact, table-rich, bilingual where explanation helps, and connected to the
lessons that teach each part. They should be outside the spine and carry no mastery status. Looking
at a table is support, not evidence.

The main engineering risk is duplication. If a form or rule exists in canonical structured data,
the reference should derive or reuse it. A second manually maintained textbook will eventually
contradict the first.

## 7. Show vocabulary as a field, not only as cards

Flashcards are good at preserving associations. They are not a satisfying representation of a
lexical domain. Learners also need to see collocations, families, contrasts, register and the
difference between words they should produce and words they only need to recognize.

A **Wortfeld** could contain 30–100 related entries while separating:

- **Aktiv lernen:** a small, high-value productive core;
- **Verstehen:** receptive vocabulary likely to appear in the domain;
- **Chunks:** phrases and collocations used as units;
- **Kontraste:** confusable or easily overgeneralized words;
- **Wortbildung:** useful families and compositional patterns;
- **In Situationen:** short examples or mini-scenes;
- **Optional vormerken:** learner-selected additions to later review.

For appointments, `einen Termin vereinbaren`, `verschieben` and `absagen` are more useful together
than three isolated headwords. For travel, `abfahren`, `ankommen`, `umsteigen`, `der Fahrplan` and
`Der Zug fällt aus` form a working system.

Do not automatically turn every visible word into a fresh card. A giant queue lets rare vocabulary
compete with language the learner actually needs and converts exploration into debt. Missions,
models and readings should introduce the productive core; SRS should preserve it. The larger field
supports orientation and voluntary breadth.

### Enrich word cards without changing what is learned

The default card should still have one stable lexical target: a word, or a genuinely formulaic
chunk that must be retrieved as a unit. It should not become a test of an entire example sentence.
The surrounding material can nevertheless become much richer:

- one short, natural phrase that shows the most useful construction or valence;
- one contrasting phrase when the word is commonly confused with a neighbour;
- the forms needed for production, such as plural, Partizip II or governed case;
- optional later examples from different situations, registers or grammatical frames;
- a link back to the Wortfeld and readings in which the word does real work.

This gives context without creating false precision in progress. The **lexical entry remains the
unit of scheduling and status**; its existing recognition and production cards remain the evidence.
Example phrases are models attached to that entry, not independent mastered objects. Merely seeing
the word in a phrase or reading must not count as a successful review.

Context should normally appear after retrieval, on the answer side. Putting a highly diagnostic
sentence on the front can turn recall of the word into recognition of one memorized sentence. If a
context cue is needed on the production side, use a brief situation or sense disambiguator and vary
it over time. The target answer and card identity must remain stable even when examples change.

There is one important exception: some language is genuinely stored and used as a unit. `Wie wäre
es mit …?`, `Es kommt darauf an` or `einen Termin vereinbaren` may deserve their own phrase entry
when the learner needs to produce the whole expression and cannot reliably derive it word by word.
That is a deliberate curricular decision, not an automatic card for every collocation. A phrase
entry has its own status because the phrase itself is the learning target; an example attached to
`vereinbaren` does not.

### Make lexical connections visible, but typed

“Related words” is too vague to be useful. German connections should be shown by the job they do:

- **Formen:** `fahren – fährt – fuhr – ist gefahren`, noun plural and case-sensitive valence;
- **Wortfamilie:** `fahren – die Fahrt – der Fahrer – das Fahrrad`;
- **Wortbildung:** separable prefixes, productive suffixes and transparent compounds;
- **Kollokationen:** `eine Entscheidung treffen`, `starker Regen`, `sich um eine Stelle bewerben`;
- **Bedeutung:** near-synonyms and antonyms, with the difference in use rather than an equals sign;
- **Kontraste:** `kennen / wissen`, `lernen / studieren`, `leihen / ausleihen`;
- **Register und Situation:** neutral, formal, colloquial, regional or domain-specific use.

These relations should help the learner predict, compare and choose. They should not become a
decorative thesaurus graph or imply that every neighbour is equally important. Show a small number
of high-value relations progressively, attach a short example to semantic distinctions, and keep
above-level branches folded or optional.

The identity rules need to remain explicit. Inflected forms belong to one lexeme and share its
status. Derived words are separate lexemes and get separate status only if they enter the
productive curriculum. Synonyms, antonyms, family membership and collocations are typed edges for
navigation and authoring; the edge itself has no mastery state. When a contrast is important enough
to measure, test the learner's choice in a fresh sentence and record that exercise evidence rather
than inventing “relation learned” progress.

## 8. Build reading strands that are worth following

Deutsch-Atlas should deliberately commission level-controlled readings whose subject is genuinely
worth the learner's attention. “Interesting” cannot be guaranteed by a schema, but it can be an
editorial requirement: each text needs a question, tension, discovery, useful explanation or human
detail that would justify reading it in translation too. A thin story whose only purpose is to
contain ten target words is still an exercise wearing a costume.

The existing distinction between intensive and extensive reading should remain decisive:

- **Intensive lesson readings** are short, supported and dense with the unit's target language.
  They build comprehension and noticing, then feed a specific task.
- **Extensive reader strands** are longer, easier and sparsely interrupted. Their purpose is fluent
  meaning-focused reading and voluntary continuation, not line-by-line testing.

A strand can use recurring people, places or questions so that background knowledge and familiar
language carry forward. This creates room for richer content without increasing linguistic load on
every page. Good strands might follow a person settling in a city, an object through German
history, a journey along one railway line, an everyday scientific mystery or connected portraits
of life across the German-speaking world.

Level control applies to the whole reading experience, not only sentence grammar. Most of the
running language should already be known or transparently inferable; the small remainder should be
selectively glossed. A text becomes difficult through topic assumptions, names, chronology and
visual clutter as well as vocabulary. Interest is not a licence to push an A2 reader through B1
prose with a dictionary.

Readings should reuse productive vocabulary across new contexts, including its collocations and
word-family members. That repeated contact strengthens the learner's representation, but it is
input evidence, not proof of recall. Opening or finishing a story does not advance word status and
never creates cards automatically. The learner may explicitly save a useful new word or chunk for
later review; until then, it remains receptive support.

Evaluation must match the kind. For intensive reading, check comprehension and later use of the
target language in a fresh context. For extensive strands, look first at successful gist
comprehension, readability and voluntary continuation; occasional delayed retelling or transfer can
provide stronger evidence, but a completion count alone is not mastery.

## 9. Use online media selectively

The web can provide voices, current places, maps, public data and genuine genres. It can also
provide unstable links, advertisements, tracking, inaccessible players, unexplained difficulty and
copyright problems.

### YouTube, films and television

Short clips can expose connected speech, timing, gesture and pragmatic context. They are most
useful when the visual channel helps comprehension and the task is narrow. A full native scene is
usually too dense for A1–A2 core instruction.

Use external video primarily as optional enrichment unless the source is stable and reuse is
explicitly permitted. For core listening, purpose-written natural audio often gives better control
over vocabulary, speed and the intended listening problem.

### News and newspapers

General news prose is compressed and assumes substantial cultural knowledge. At early levels,
prefer weather, local events, classified advertisements, headlines for scanning and very short
human-interest material. Later A2 learners may extract a few practical facts from a real fragment;
they should not be expected to decode an entire article.

### Maps and live information

Maps, transit data, museum pages and event listings can support excellent tasks. When live data is
used, capture or author a stable learning version as well. A lesson should not silently change
because an external service changed its interface or schedule.

## 10. Do not attach a quiz to everything

The current system is good at recording answers, which creates a temptation to make every content
touch produce one. That would flatten the new layer back into the old problem.

Some artifacts exist primarily for input, orientation or pleasure. They may offer a prompt without
scoring it. Anything labelled practice or review must demand retrieval or production, but an
interesting story is not defective because it allows the learner simply to read.

When exercises are included, they should follow the real use of the material:

- a timetable leads to a decision;
- a notice leads to an action;
- a story leads to retelling, sequencing or interpretation;
- a biography leads to a short summary or comparison;
- an advertisement leads to evaluation and a response;
- a video leads to identifying intent, relationship or the next turn.

Generic detail questions are sometimes useful for checking comprehension, but they should not be
the default endpoint.

## 11. Protect the product from attractive failure modes

This direction can make Deutsch-Atlas much better, but it can also produce a larger and less
coherent content pile. The main risks are:

### The media scrapbook

Interesting links accumulate without curriculum purpose, level control or maintenance ownership.
The result looks rich but teaches little.

**Guardrail:** every core artifact names its learner action, level, language load and downstream
task. Optional discovery content still needs editorial quality and a reason to belong.

### Authenticity theatre

A screenshot or native video is added to make a lesson look realistic, while the exercise remains
an ordinary vocabulary quiz.

**Guardrail:** judge authenticity by what the learner does with the material.

### Content debt

Large word lists, duplicated reference tables and external assets multiply review and validation
work. Quality declines because the surface grows faster than editorial capacity.

**Guardrail:** pilot manually, identify stable repeated structure, and only then introduce schemas
or automation. Prefer fewer strong artifacts that are reused across input, practice and transfer.

### Accidental difficulty

Native media introduces unknown language, background knowledge, poor audio or visual clutter. The
learner's failure says nothing about the intended outcome.

**Guardrail:** control the task, gloss selectively, adapt when needed and state when material is an
optional stretch.

### Exploration becoming debt

Opening a story creates cards, incomplete tasks or another progress bar. Curiosity becomes a queue
to clear.

**Guardrail:** discovery stays soft. Only explicit learner choices or curricular introduction add
new review obligations.

### Culture as trivia or stereotype

The course collects monuments, foods and festivals without helping the learner understand people
or communication.

**Guardrail:** prefer situated stories, multiple regions, contemporary life and cultural-pragmatic
knowledge that changes interpretation or action.

## 12. Small experiments before new platforms

The next step should not be a large generic content framework. Five pilots would reveal most of the
important design constraints:

1. **One mission-authored unit revision**  
   Use an existing A1/A2 unit such as appointments. Connect input, retrieval, response and a fresh
   final task without adding mission code.

2. **One visual everyday document**  
   Create a realistic appointment letter, train disruption notice or apartment advertisement. Keep
   it visible while the learner extracts information and responds.

3. **One Entdecken story**  
   Publish a short, visual, level-controlled piece about a place, person or historical trace. Make
   exercises optional and test whether the piece is enjoyable without them.

4. **One lexical-network and rich-card pilot**

   Try a structured appointment or rail-travel Wortfeld, then enrich the productive core's card
   backs with phrases, forms and typed relations. Keep the existing word card identities and create
   phrase entries only for deliberately taught chunks.

5. **One small reading strand**

   Publish one intensive text and two connected extensive episodes in the same setting. Test
   whether the language stays comfortably level-controlled and whether the subject earns voluntary
   continuation without manufacturing a reading mastery bar.

Evaluate pilots by different criteria:

- **Learning artifacts:** later retention and success in a fresh transfer context.
- **Input/editorial artifacts:** comprehension, voluntary continuation and qualitative usefulness.
- **References:** successful lookup and return usage, not time spent on the page.
- **Documents:** correct extraction and an appropriate real-world response.
- **Engineering:** editorial cost, accessibility, rights clarity, stability and duplication.

Engagement matters here, but it is not mastery. A story that people choose to finish has succeeded
as input; it has not proved that they learned the dative.

## Editorial test for future ideas

Before adding a new artifact, answer:

1. What does the learner do with it?
2. Is it input, retrieval, interaction, production, reference or discovery?
3. Why is this form better than a normal paragraph or exercise?
4. Is the German comprehensible at the declared level?
5. What support is present, and when does it fade?
6. Does it lead to a new-context action rather than item memorization?
7. Is it core or optional?
8. Does opening it create any review obligation?
9. Who owns factual accuracy, attribution, reuse rights and link durability?
10. What existing data or content would it duplicate?
11. What is the learning object, and exactly what acquires status?
12. Is the subject worth reading, hearing or exploring apart from the target language it contains?
13. How will we know whether it worked?
14. If it disappears tomorrow, does the learning path still function?

## Direction

Deutsch-Atlas should remain a disciplined learning system, but it should stop behaving as if the
language ends at the boundary of the textbook. The opportunity is not “more content.” It is a more
varied relationship with German: sometimes studying it, sometimes using it to solve a problem,
sometimes looking up its structure, and sometimes reading or watching because the subject itself is
worth attention.

The quality bar should stay. The progress model should stay honest. The curriculum should stay
coherent. Around that core, however, the course needs documents, voices, stories, places, humour,
history and surprise. Those are not distractions from language learning. Properly selected, they
are the reason the language is worth learning.
