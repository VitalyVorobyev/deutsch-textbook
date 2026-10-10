# Leben in Deutschland (Bavaria) — Research and Implementation Brief for Deutsch Atlas

**Status:** research report + implementation handoff  
**Research checked:** 10 October 2026  
**Target:** Deutsch Atlas  
**Exam:** *Leben in Deutschland* (LiD) / *Einbürgerungstest*, with the Bavaria (`BY`) question subset  
**Language of this document:** English; learning content should be in German, with the existing Deutsch Atlas explanation/translation languages where appropriate.

> **Instruction to Codex:** Treat this as a research brief, not as a description of the existing repository. First inspect the current Deutsch Atlas architecture, schemas, Redaktion/editorial workflows, learning graph, progress synchronization, and Tonwerk/audio capabilities. Reuse what exists. Do not introduce a parallel content model, a new framework, or a second progress system without a demonstrated need. Identify gaps and propose a small integration plan before large changes.

## 1. Executive summary

**Recommended approach:** add *Leben in Deutschland* as a self-contained course within Deutsch Atlas, built around (1) the official BAMF examination question bank, (2) authored explanatory lessons sourced primarily from the official Orientierungskurs curriculum and bpb educational content, and (3) integration with Deutsch Atlas vocabulary, exercise, progress, and audio systems.

Most required research sources are free. A commercial textbook is optional and should be treated as a **personal reference**, not content to ingest into a distributed product.

**Essential source set:**

1. **BAMF Gesamtfragenkatalog:** authoritative published questions, answers offered in the questions, and graphics; the PDF itself is not a reliable machine-readable answer key.
2. **BAMF Online-Testcenter:** official answer-checking reference.
3. **`YehorAltshuler/bamf-lid-dataset`:** convenient independent machine-readable extraction that combines the official PDF with answers retrieved from BAMF's test center. Verify and version it; do not treat it as an official dataset or proof of reuse rights.
4. **BAMF Curriculum für einen bundesweiten Orientierungskurs:** authoritative thematic curriculum.
5. **bpb `einfach POLITIK`:** accessible explanations, glossaries, and downloadable PDFs; many texts are `CC BY-SA 4.0`, subject to per-asset rights and attribution.

**High-level recommendation:** deliver a validated **310-question Bavaria trainer and mock exam first**, then link those questions to curated educational units, vocabulary, and explanations. A complete *100 Unterrichtseinheiten* classroom-equivalent course is not necessary for initial exam readiness.

## 2. Confirmed examination specification

| Attribute | Finding | Primary reference |
|---|---|---|
| Pool for one state | 300 general + 10 state-specific = **310** | [BAMF online question catalogue](https://oet.bamf.de/ords/oetut/f?p=534:1:0) |
| Complete Germany-wide question pool | 300 + 16 × 10 = **460** | [Independent dataset README](https://github.com/YehorAltshuler/bamf-lid-dataset) |
| Test sheet | **33** questions, comprising **30 general + 3 state-specific** | [EinbTestV §1](https://www.gesetze-im-internet.de/einbtestv/__1.html) |
| Answer selection | Four choices; one correct answer | [EinbTestV §1](https://www.gesetze-im-internet.de/einbtestv/__1.html) |
| Time limit | **60 minutes** | [EinbTestV §1](https://www.gesetze-im-internet.de/einbtestv/__1.html) |
| Citizenship-test threshold | **17/33** correct | [EinbTestV §1](https://www.gesetze-im-internet.de/einbtestv/__1.html) |
| Orientation-course LiD threshold | **15/33** correct; 17/33 also satisfies the relevant knowledge requirement for subsequent naturalization | [BAMF Integrationskurse overview](https://www.bamf.de/SharedDocs/Dossiers/DE/Integration/integrationskurse-im-fokus.html?nn=453952&pos=2) |
| Current source document located | BAMF Gesamtfragenkatalog, **Stand 07.05.2025** | [Official BAMF PDF](https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.pdf?__blob=publicationFile&v=22) |

**Important distinctions:**

- LiD and Einbürgerungstest share the underlying question material, but the 15/33 orientation-course passing criterion and 17/33 citizenship-proof criterion are different. The product should explicitly distinguish them.
- *Do not claim to reproduce a genuine official examination sheet.* German regulation states that official test sheets are not published. An app can simulate their question mix and timing, but generates its own combinations.
- The BAMF PDF cautions that some wording and visual descriptions may differ slightly from actual examination questions. Retain official attribution and never promise character-for-character equivalence with the examination paper.
- Restrict the default launch configuration to `BY`, but represent `stateCode` generically to make the architecture extendable to other states.

## 3. Source inventory — direct links and intended use

### 3.1 Tier A — mandatory official examination sources

| ID | Source / URL | Format | What we use it for | Import policy |
|---|---|---|---|---|
| `BAMF-QUESTIONS` | [Gesamtfragenkatalog PDF](https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.pdf?__blob=publicationFile&v=22) | PDF | Canonical reference for wording, alternatives, diagrams, numbering | Store citation/metadata; verify rights before redistribution |
| `BAMF-ANSWERS` | [BAMF online question catalogue](https://oet.bamf.de/ords/oetut/f?p=534:1:0) | Web | Reference for correct answers | Prefer verified extracted answers; audit samples directly |
| `BAMF-MOCK` | [BAMF sample question sheet](https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/musterbogen_lebenindeutschland.pdf?__blob=publicationFile&v=6) | PDF | Exam layout and instructions | Reference only |
| `BAMF-LID-DEMO` | [BAMF interactive test site](https://oet.bamf.de/ords/oetut/f?p=532:1::::::) | Web | Compare user flow and practice modes | Reference only; confirm endpoint if redirected |
| `LEGAL-RULES` | [Einbürgerungstestverordnung §1](https://www.gesetze-im-internet.de/einbtestv/__1.html) | HTML | Exam count, regional mix, timing, citizenship threshold | Link/reference |
| `BAMF-CURRICULUM` | [Curriculum für einen bundesweiten Orientierungskurs](https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Integrationskurse/Kurstraeger/KonzepteLeitfaeden/curriculum-orientierungskurs-pdf.html?nn=401656) / [direct PDF](https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Integrationskurse/Kurstraeger/KonzepteLeitfaeden/curriculum-orientierungskurs-pdf.pdf?__blob=publicationFile) | PDF | Course taxonomy and coverage | Analyze structure; author our own lessons |

The referenced Orientierungskurs curriculum is an April 2017 revision for **100 Unterrichtseinheiten (UE)**. This is a curriculum for classroom teaching, not a requirement to create 100 application lessons.

### 3.2 Tier A/B — machine-readable BAMF question extraction

**Repository:** <https://github.com/YehorAltshuler/bamf-lid-dataset>  
**Manifest:** <https://yehoraltshuler.github.io/bamf-lid-dataset/manifest.json>  
**Question JSON:** <https://yehoraltshuler.github.io/bamf-lid-dataset/questions.json>  
**Visual review:** <https://yehoraltshuler.github.io/bamf-lid-dataset/review.html>  
**Images:** `https://yehoraltshuler.github.io/bamf-lid-dataset/images/<filename>`

Verified manifest on **10 October 2026**:

```yaml
schemaVersion: 1
datasetVersion: '2026-10-05.103327'
lastCheckedAt: '2026-10-05T10:33:27Z'
questionCount: 460
generalCount: 300
stateQuestionCount: 160
imageCount: 100
questionsWithImages: 43
questionsSha256: 805d904aabfc009192f666ceaeeff9408ada78c0d7af15637bde03f52f877111
sourcePdfSha256: edd3ed5e56a35241b6cc61aa0630482dc9e64498db508a7d6892ccee2ec707a9
```

These image counts cover **all 460 questions across Germany**, not just the Bavaria subset.

Published question shape (abbreviated; read the live JSON before writing an adapter):

```json
{
  "id": "general-001",
  "officialNumber": 1,
  "scope": "general",
  "stateCode": null,
  "question": "...",
  "answers": { "a": "...", "b": "...", "c": "...", "d": "..." },
  "images": [],
  "sourcePage": 2,
  "solution": "d",
  "bamfInternalId": "18476"
}
```

State question IDs are `BY-01` through `BY-10` according to the repository's documented scheme. Image items have `path`, `sha256`, `width`, `height`, and **`mime_type`** in the current live JSON. Do not blindly implement the slightly different `mimeType` spelling shown in the repository README example.

**Why use this source:** it reduces a laborious parsing/answer-matching task to a versioned, testable import. The repository reports extraction from the BAMF PDF and verification of correct choices against the BAMF Online-Testcenter, without OCR or generated answer keys.

**Limits:** it is an independent project, not a BAMF service. Its landing page does not expose an explicit license grant for unrestricted reuse of the dataset; public availability is not equivalent to an open license. Treat question text/images and dataset code as separately reviewable rights issues. Do not publish redistributed source material until appropriate use rights have been assessed.

**Import behavior:**

1. Request manifest, then question JSON; verify checksum before use.
2. Record manifest version, source PDF hash, fetch timestamp, and import provenance.
3. Assert exactly 460 questions, of which 300 are general and each state has ten; ensure 310 remain after selecting general + `BY`.
4. Reject duplicate IDs, missing choices, invalid solution keys, nonexistent images, image hash mismatches, and unsupported schema versions.
5. Preserve the four answer choices and their original `a`–`d` ordering, as well as all graphics linked to a question.
6. Use `id` as the source-stable identity; never rely on array position.
7. Maintain an explicit source-to-domain mapping rather than coupling the live product directly to a third-party JSON schema.
8. Record an independently reviewed, approved **content release** to the product. Do not hot-swap exam answers in production simply because the upstream manifest changed.

### 3.3 Tier B — free education material: bpb `einfach POLITIK`

**Index:** <https://www.bpb.de/themen/politisches-system/politik-einfach-fuer-alle/>  
**Free booklet collection:** <https://www.bpb.de/shop/materialien/einfach-politik/>

High-priority modules:

| Subject | Link | Relevance |
|---|---|---|
| *Das Grundgesetz. Über den Staat* | <https://www.bpb.de/themen/politisches-system/politik-einfach-fuer-alle/236649/das-grundgesetz-ueber-den-staat/> | Republic, federalism, branches of government, Bundestag, Bundesrat, cabinet, presidency, courts |
| *Das Grundgesetz. Die Grundrechte* | <https://www.bpb.de/themen/politisches-system/politik-einfach-fuer-alle/236616/das-grundgesetz-die-grundrechte/> | Fundamental rights, equality, speech and belief, family, assembly |
| *Nationalsozialismus* | <https://www.bpb.de/themen/politisches-system/politik-einfach-fuer-alle/508004/nationalsozialismus/> | National Socialism, dictatorship, WWII, crimes and memory |
| *Deutsche Einheit* | <https://www.bpb.de/themen/politisches-system/politik-einfach-fuer-alle/316549/deutsche-einheit/> | Postwar division, GDR/FRG, reunification |
| *Zusammenleben und Diskriminierung* | <https://www.bpb.de/themen/politisches-system/politik-einfach-fuer-alle/561689/zusammenleben-und-diskriminierung/> | Social life, coexistence, discrimination |
| *einfach POLITIK Lexikon* | <https://www.bpb.de/system/files/dokument_pdf/einfach_POLITIK_Lexikon_barrierefrei_2021_12.pdf?download=1> | Definitions and candidate vocabulary |
| *Einmischen. Mitentscheiden.* | <https://www.bpb.de/themen/politisches-system/politik-einfach-fuer-alle/573709/wer-hat-einmischen-mitentscheiden-gemacht/> | Political participation; linked attribution/licensing page |
| *Europa / EU* | <https://www.bpb.de/themen/politisches-system/politik-einfach-fuer-alle/279793/einfach-politik-lesen-und-hoeren-ueber-europa/> | European institutions and civic context |

Many module landing pages link to **downloadable accessible PDFs, online texts, and audiobooks**. Prefer the HTML text for traceable attribution and selectively acquire PDFs for offline authoring/reference. Be careful with editions: the Nationalsozialismus booklet has a more recent 2025 edition, and bpb occasionally updates content.

**Rights:** bpb states that text from the `einfach POLITIK` series is generally **Creative Commons Attribution–ShareAlike 4.0 (`CC BY-SA 4.0`)**. The bpb pages explicitly distinguish rights to images, graphics, photos and videos; these may have separate copyrights. The printed PDF may contain protected third-party images. For adaptations or redistribution of bpb text:

- Record title, author(s), publisher, edition/date, canonical URL, license URL, and any edits/translations.
- Provide attribution and change notices, and honor the ShareAlike terms for the adapted material.
- Preserve a clear boundary between bpb-derived CC BY-SA content and unrelated proprietary parts of Deutsch Atlas; get a rights review before combining them into shipped product content.
- Never infer that bpb recordings, photography, maps, or illustrations are licensed just because adjacent text is CC BY-SA.

Reference for the licensing statement: <https://www.bpb.de/themen/politisches-system/politik-einfach-fuer-alle/247462/wer-hat-die-seiten-einfach-politik-gemacht/>. License text: <https://creativecommons.org/licenses/by-sa/4.0/>.

### 3.4 Tier B — Bavaria-specific background

| Material | URL | Use |
|---|---|---|
| *Das politische System des Freistaats Bayern*, 2024 | <https://www.blz.bayern.de/die-politische-ordnung-in-bayern_p_174.html> | Overview of Bavarian Landtag, state government, local government, regional democracy |
| *Verfassung des Freistaates Bayern + Grundgesetz* | <https://www.blz.bayern.de/verfassung-des-freistaates-bayern-grundgesetz-fuer-die-bundesrepublik-deutschland-neuauflage-2021_p_39.html> | Readable official constitutional background; downloadable PDF linked from page |

The political-system book is available for order. The constitutional publication page describes an updated 2025 edition despite its older URL slug. **Check the displayed edition, not the URL name.** Neither listing should be treated as a blanket reuse license.

**Scope control:** Bavaria has only ten test-pool questions. Add one compact Bavaria knowledge unit and question explanations; avoid spending weeks building a comprehensive Bavarian civics course before the general question bank is complete.

### 3.5 Tier C — interactive learning benchmark, not ingestion source

**VHS-Lernportal, Orientierungskurs Test-Trainer:**  
<https://www.vhs-lernportal.de/wws/orientierungskurs-testtrainer.php>

The operator states that it includes about **100 exercises** and **80 original questions**, with vocabulary help and explanations, focused on *Politik in der Demokratie*. Use it to study the pedagogical format, especially assistance with difficult German phrasing. It is **not** a complete 310-question package and no transferable content license was established.

### 3.6 Optional purchased textbooks — use as reference, not import content

| Rank | Title | Verified product reference | Notes |
|---|---|---|---|
| **1** | **Klett: 100 Stunden Deutschland neu (2026)** | <https://www.klett-sprachen.de/100-stunden-deutschland-neu> — ISBN **978-3-12-670060-3** | Recent A2–B1 hybrid book; allango license (24 months), audio/video, explanations, quizzes, vocabulary, podcasts; typical listed retail price **€19.99** at the time researched. Recommended single purchase. |
| **2** | **Cornelsen: Orientierungskurs, Ausgabe 2024** | <https://www.cornelsen.de/reihen/orientierungskurs-120001330000/ausgabe-2024-120001330004/kaufen> — ISBN **978-3-06-123212-2** | A2/B1 book + e-book / PagePlayer; two model exams; current listing **€18.99**. Some audio is downloadable. |
| **3** | **Hueber: Mein Leben in Deutschland** | <https://www.hueber.de/reihe/mein-leben-in-deutschland> — ISBN **978-3-19-081499-2** | A2–B1 book and interaktiv; publisher offers supplementary and updated resources. |

These prices can change. Product pages were checked in October 2026. The Klett publication is also documented by a contemporary [Institut für Interkulturelle Kommunikation recommendation](https://www.iik.de/node/2250) dated 27 August 2026.

**Do not** download, scrape, copy, summarize at chapter scale for publication, or redistribute commercial textbook prose, exercises, figures or recordings as if purchase conferred those rights. Books serve individual study and **inspiration for educational coverage**; write original lessons from licensed/independently verified sources.

## 4. Recommended instructional design

### 4.1 Three thematic modules

Use the BAMF framework and make smaller app-native units:

1. **Politik in der Demokratie**: constitutional principles; Grundrechte; federal structure; checks and balances; Bundestag/Bundesrat; Bundespräsident/Bundesregierung; political parties; elections; social state; EU basics.
2. **Geschichte und Verantwortung**: National Socialism and remembrance; World War II; occupation and postwar Germany; FRG and GDR; Berlin Wall; peaceful revolution; reunification.
3. **Mensch und Gesellschaft**: equality and family; education and children; religion; pluralism; coexistence; integration; discrimination; civic participation.
4. **Bayern add-on**: Bavarian state symbols, geography, elections, Landtag, Ministerpräsident/in, local districts and institutions.

The Bavaria add-on is an implementation unit, not a fourth official BAMF curriculum module.

### 4.2 Per-question learning experience

Each question should have:

- Verbatim source question, four original options, and official correct option.
- Optional sourced graphics positioned and labeled correctly.
- A short **original** plain-German explanation at roughly A2/B1 reading complexity.
- A distinct answer-rationale field: why the answer is correct; optionally address common distractors.
- Vocabulary items mapped to the existing Deutsch Atlas lexicon/flashcard system.
- Links to one or more course lessons and broader concepts in the learning graph.
- Optional translations or bilingual hints consistent with current Deutsch Atlas language infrastructure (English/Russian/Ukrainian are existing content languages), **not** translations mistaken for official exam wording.
- Audio/TTS of the German question and, optionally, explanation, using existing Tonwerk or app TTS capabilities.
- Per-item source provenance and editorial verification status.

Practice and test mode should be **separate user experiences**:

| Practice | Mock exam |
|---|---|
| Explanations and vocabulary hints visible after answering | No hints during the timed session |
| Select by module, topic, unanswered, incorrect, or spaced repetition | 33 questions: 30 general + 3 Bavaria |
| Feedback and linked lessons | One 60-minute session, timer and final results |
| Can replay audio and show translations | Keep close to German-only official conditions by default |
| Can focus on wrong items | Report both 15/33 and 17/33 thresholds separately |

Recommend four top-level entry points: **Learn**, **Practice 310**, **Review mistakes**, **Mock exam**. Favor existing navigation patterns over new bespoke UI.

### 4.3 Progress and readiness

Avoid an invented single pass-probability metric. Track instead:

- Coverage: encountered / answered / mastered across the 310 BY-relevant questions.
- Accuracy overall, by module, by topic, and for the ten Bavaria-specific questions.
- Recent attempts and time since last correct answer; use existing spaced-repetition machinery if available.
- Mock exam scores as a distribution, plus clear result thresholds of 15 and 17.
- A transparent readiness indicator, e.g. “last 5 timed mock exams all ≥17”, explicitly identified as product guidance rather than a guarantee of passing.

Preserve learning history across question-content releases: stable source IDs plus version-aware progress rules. If a substantive question or answer changes, mark affected mastery as requiring review; do not silently wipe all progress.

## 5. Suggested domain/content model (logical only)

**Do not create these as new tables/types until Codex has matched them against the actual repository.** The following describes necessary semantics rather than implementation language.

```yaml
Question:
  sourceId: 'general-001'        # or BY-01
  exam: 'LiD'
  scope: 'general'               # general | state
  stateCode: null                # BY for Bavaria items
  officialNumber: 1
  originalGerman: '...'
  options:                       # preserve source order and labels
    a: '...'
    b: '...'
    c: '...'
    d: '...'
  correctOption: 'd'
  images: []                     # each asset linked with rights/provenance
  sourceVersion: '2026-10-05.103327'
  sourcePage: 2
  bamfInternalId: '18476'
  topicIds: []                   # curated association, not inferred as fact
  lessonIds: []
  editorialStatus: 'unreviewed'  # unreviewed | reviewed | approved

Explanation:
  questionSourceId: 'general-001'
  originalGerman: '...'
  translations: {}
  rationale: '...'
  terminologyRefs: []
  sourceRefs: []
  editorialStatus: 'draft'

SourceProvenance:
  canonicalUrl: '...'
  retrievedAt: '...'
  sourceEdition: '...'
  sha256: '...'
  license: 'UNVERIFIED'         # do not default to permissive
  rightsNotes: '...'
  attribution: '...'

ExamAttempt:
  localeState: 'BY'
  itemSourceIds: []              # 30 general + 3 Bavaria
  questionSetVersion: '...'
  startedAt: '...'
  submittedAt: '...'
  durationSeconds: 0
  answers: {}                    # keyed by stable source ID
  correctCount: 0
```

**Architecture rules:**

- The external JSON is an **import format**, not necessarily the internal storage format.
- Learning assets (`Lesson`, `Concept`, `Vocabulary`, `Audio`, `Exercise`) should reuse Deutsch Atlas domain entities and knowledge-graph links.
- Store **exam-source content** separately from **authored explanation content** so a source update does not overwrite editorial work.
- Source/rights provenance should be a first-class property of imported and adapted content, ideally integrated into existing Redaktion controls.
- Treat `BY` as a configurable region rather than hard-code it into general logic; launch only Bavaria initially.
- Enable offline operation if supported by current app architecture; avoid runtime dependence on third-party GitHub Pages uptime for an already published content release.
- Existing Cloudflare-backed learner progress sync should remain the single source of truth for user history if that is the current implementation.

## 6. Ingestion and QA pipeline

### Step 1: repository reconnaissance

Codex should first identify the actual modules for content creation, question-based exercises, knowledge-graph links, asset storage, localization, editorial approval, audio production, and progress sync. Report what can be reused. Do **not** assume a particular backend/frontend stack from this document.

### Step 2: source acquisition and immutable snapshots

- Fetch the manifest and the referenced question JSON.
- Validate schema and checksum, then persist or record a **pinned input snapshot** in a reproducible location permitted by repository policy. A build must not silently change when upstream JSON updates.
- Record source URLs and `datasetVersion`, `pdfSha256`, JSON checksum, retrieval timestamp, plus a reproducible import report.
- Follow the project's existing policy for large binary assets. Do not commit large images or PDF sources unless expressly appropriate; keep stable metadata references.

### Step 3: strict filtering and validation

- `question.scope === 'general'` → exactly 300.
- `question.scope === 'state' && question.stateCode === 'BY'` → exactly 10. Confirm actual `scope` values in live data during implementation; map them explicitly.
- Question set for Bavaria → **310 unique IDs**.
- Every question has nonempty German text, exactly `a`/`b`/`c`/`d`, one valid `solution`, preserved image references, and resolvable assets as applicable.
- Check images for the actual selected set; do not assume the global 100 image objects are all needed for Bavaria.
- Verify a curated sample, including image-based and all ten Bavaria questions, against BAMF's official sites.
- Maintain a checksum/diff report at each new import. Changes to correct answers are **high-priority editorial blockers**, not automatic updates.

### Step 4: rights and editorial gate

Before publishing imported materials, require a recorded decision for the question bank and extracted image rights. A safe development option is to build private tooling and links first while reuse is under review. For bpb-derived lessons, record per-page attribution, actual terms, and asset rights. For anything with unclear rights, prefer a link to the source or independently authored explanatory material.

### Step 5: curriculum mapping

Map all 310 questions to one or more curriculum topics using a repeatable draft-assisted workflow. Allow AI-assisted suggestions, but require human review of topic and lesson associations. Record mapping coverage in Redaktion. One lesson should cover related concepts rather than duplicating the same explanation across many questions.

### Step 6: learning content

- Draft short original A2–B1 German lessons, using authoritative facts and citeable sources.
- Draft succinct correct-answer explanations and optional distractor explanations.
- Extract candidate vocabulary with POS, lemma, relevant sense, and context; deduplicate against existing entries.
- Use the existing editorial pipeline to verify language level, history/politics correctness, and media rights.
- Feed approved German content to Tonwerk/local audio workflow if useful. Imported third-party audiobooks are **not** assumed to be redistributable.

### Step 7: mock exam generator

- Select without replacement: 30 from general pool + 3 from BY pool.
- Keep each question's option ordering and source graphics intact in exam mode.
- Run a 60-minute timer; allow submit before timeout; define timeout finalization in line with existing UX.
- Score deterministically: one point only for the correct answer; unanswered = zero.
- Show both orientation-course (15/33) and citizenship-knowledge (17/33) thresholds accurately, with context.
- Make source version visible in test results or diagnostics.
- Test different RNG seeds and ensure uniqueness, counts, and repeatability when seeded for testing.

### Step 8: scheduled source-diff workflow

- Check upstream `manifest.json` periodically, not on every user session.
- If manifest or official source hash changed, generate a diff: question added/removed, text or option changed, answer changed, asset changed, law-sensitive statement affected.
- Stage for editorial approval and then publish as a versioned release.
- Avoid triggering automatic content deployment if validation fails.
- Preserve existing attempts against the source version used when they were taken.

## 7. Implementation milestones for Codex

### M0 — investigate and propose (no heavy coding)

Deliver a concise repository-specific plan identifying reuse points, missing abstractions, target folders/files, migrations (if any), and test strategy. Identify legal/reuse approval gating separately from engineering readiness.

**Acceptance:** no duplicate content/flashcard/progress pipeline proposed without justification.

### M1 — validated BY question dataset

Implement a deterministic adapter/importer, source metadata, image support, strict schema/count/hash checks, and a human-review report or inspectable view.

**Acceptance:** exactly 300 general + 10 BY questions; all 310 can be rendered; original answer keys retained; incorrect checksums or missing images fail loudly. The import is repeatable from a pinned snapshot.

### M2 — practice and mock exam

Integrate with existing quiz infrastructure; implement question-by-question practice, mistake review, and a 33-question BY mock exam with timer.

**Acceptance:** every generated exam contains 30 distinct general IDs and 3 distinct BY IDs; correct answer scoring; thresholds 15/33 and 17/33 clearly distinguished; results persist and sync using existing mechanisms.

### M3 — curriculum connections and language support

Introduce/seed module-topic mappings and a first curated set of question explanations; attach existing vocabulary and lessons.

**Acceptance:** at least one fully reviewed vertical slice in each major thematic module, plus Bavaria; editorial staff can see unmapped/unchecked items; mixed-language hints never alter official German item text.

### M4 — full educational enrichment

Complete curated mappings and progressively fill 310 question explanations, optional vocabulary, and compact topic lessons. Add approved audio via existing Tonwerk workflow where pedagogically valuable.

**Acceptance:** all questions have an approved explanation; curriculum-to-question coverage report is complete; all published adaptations have source/rights attribution; all third-party media used in production are rights-cleared.

### M5 — maintenance and regression safeguards

Automated upstream change detection, editorial review of diffs, content release pinning, and progress migration behavior for changed questions.

**Acceptance:** simulated upstream changes produce diffs without silently changing live answers; old exam attempts remain reproducible; rejected updates do not affect production.

## 8. Tests and acceptance checklist

**Data contracts**

- [ ] Import fails on manifest checksum mismatch or unsupported schema version.
- [ ] Full source count = 460; general = 300; BY = 10; BY study set = 310.
- [ ] IDs unique; no question missing the four choices or a solution in `a`–`d`.
- [ ] All selected images load; dimensions/hash/type checked where supplied; ordering/layout inspected for figure questions.
- [ ] Source version and official PDF hash are recorded with release metadata.

**Mock exam**

- [ ] 33 items: exactly 30 general + 3 BY, all distinct.
- [ ] Exactly 60 minutes, correct timer behaviors for submission/expiry.
- [ ] Source answer order preserved in exam mode.
- [ ] Every score from 0 to 33 handles both cutoffs correctly; explicit tests at 14, 15, 16, 17, 18.
- [ ] A saved attempt retains the source version, user selections, timestamp and score.

**Learning content**

- [ ] Questions link to topics/lessons and existing vocabulary where relevant.
- [ ] Explanation text does not alter or overwrite an official question.
- [ ] Each published explanation has human editorial approval or the repository's equivalent quality gate.
- [ ] German-only mock test works even when multilingual explanations exist.
- [ ] Narration is optional, and the original exam does not require audio.

**Governance and quality**

- [ ] Licenses and rights are reviewed before redistributing BAMF question texts/graphics or upstream dataset assets.
- [ ] bpb text attribution + edition + CC BY-SA obligations recorded, with separate image/audio checks.
- [ ] Commercial textbooks are **reference-only**; no copyrighted text/media copied into application content without permission.
- [ ] Changes to answer keys are never published without verification.
- [ ] No destructive reset of progress on source refresh.

## 9. Explicit non-goals for the initial implementation

- Rebuilding the entire 100-UE instructor-led curriculum as a prerequisite for a functioning trainer.
- Support for all 16 German states at launch (the adapter should be extensible, but the current scope is Bavaria).
- A new generic content management system, vocabulary database, TTS stack, or progress service.
- Live scraping of BAMF or bpb from the learner's device.
- Hosting full scans or copying copyrighted commercial textbooks.
- Making an official-test certification claim for an independently generated mock exam.

## 10. Practical acquisition priorities

**Download first:** BAMF PDF, the current pinned JSON/manifest, and the official curriculum. Acquire bpb text and associated source metadata for the specific lessons planned. Use the ten Bavaria-specific questions to constrain the regional scope.

**Buy optionally:** one copy of **Klett, *100 Stunden Deutschland neu* (2026), ISBN 978-3-12-670060-3**. Its value is pedagogical and personal; it does not fill a technical gap in the dataset.

**Research/approval blocker:** confirm legal reuse conditions for publicly shipped BAMF-derived texts and especially diagram images. Confirm whether `CC BY-SA 4.0` text reuse fits the intended Deutsch Atlas licensing/distribution model; do not rely on generic government ownership as a license.

## 11. Reference index and verification notes

- [BAMF LiD online catalogue](https://oet.bamf.de/ords/oetut/f?p=534:1:0) — 310-per-state statement and immediate-answer interface; accessed 10 Oct 2026.
- [BAMF Gesamtfragenkatalog PDF](https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.pdf?__blob=publicationFile&v=22) — listed version *Stand 07.05.2025*. BAMF downloads may reject automated fetches; use normal browser download if needed.
- [Einbürgerungstestverordnung §1](https://www.gesetze-im-internet.de/einbtestv/__1.html) — 33 items, 3 regional, 60 minutes, 17 threshold.
- [BAMF Integrationskurse overview](https://www.bamf.de/SharedDocs/Dossiers/DE/Integration/integrationskurse-im-fokus.html?nn=453952&pos=2) — 15/33 vs 17/33 contextual distinction.
- [BAMF Curriculum](https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Integrationskurse/Kurstraeger/KonzepteLeitfaeden/curriculum-orientierungskurs-pdf.html?nn=401656) — edited April 2017 for 100 UE.
- [Independent dataset repository](https://github.com/YehorAltshuler/bamf-lid-dataset) — schema and extraction method; independent project.
- [Live dataset manifest](https://yehoraltshuler.github.io/bamf-lid-dataset/manifest.json) and [JSON](https://yehoraltshuler.github.io/bamf-lid-dataset/questions.json) — checked 10 Oct 2026, published 5 Oct 2026.
- [bpb einfach POLITIK portal](https://www.bpb.de/themen/politisches-system/politik-einfach-fuer-alle/) and [license statement](https://www.bpb.de/themen/politisches-system/politik-einfach-fuer-alle/247462/wer-hat-die-seiten-einfach-politik-gemacht/) — text generally CC BY-SA 4.0; pictures and multimedia require separate rights check.
- [VHS Orientation Test Trainer](https://www.vhs-lernportal.de/wws/orientierungskurs-testtrainer.php) — about 100 exercises, 80 original questions in one curriculum module.
- [Bavarian political system](https://www.blz.bayern.de/die-politische-ordnung-in-bayern_p_174.html) and [Bavarian constitution](https://www.blz.bayern.de/verfassung-des-freistaates-bayern-grundgesetz-fuer-die-bundesrepublik-deutschland-neuauflage-2021_p_39.html).
- [Klett textbook](https://www.klett-sprachen.de/100-stunden-deutschland-neu), [Cornelsen textbook](https://www.cornelsen.de/reihen/orientierungskurs-120001330000/ausgabe-2024-120001330004/kaufen), [Hueber textbook](https://www.hueber.de/reihe/mein-leben-in-deutschland).

---

## 12. Suggested initial Codex task

> Read `leben_in_deutschland_bayern_deutsch_atlas.md`. Inspect Deutsch Atlas before writing implementation code, paying particular attention to existing course/lesson models, question exercises, Redaktion editorial tools, knowledge-graph associations, Tonwerk audio workflow, localization, and persisted learner progress. Propose the smallest architecture-compatible plan for milestone M1 (versioned ingestion and validation of the 310 Bavaria-relevant LiD questions) and M2 (practice/mock exam). Explicitly identify reuse-rights dependencies and keep them separate from engineering tasks. Preserve source provenance and existing content models. Then implement the approved scope with tests, matching the repository's existing conventions and verification commands. Do not assume an unverified license permits public redistribution.

**End of report.**
