# ADR 0021: The Leben-in-Deutschland bank ships verbatim, and practising it is learning, not calibration

Status: accepted · 2026-10-10

## Context

The learner is preparing for the *Leben in Deutschland* test / *Einbürgerungstest* (Bayern)
within about a month. The test draws 33 questions — 30 general, 3 from the learner's state — from
a published pool of 310 (EinbTestV §1); 17 correct pass the Einbürgerungstest, 15 the
Orientierungskurs test. The research brief is
[`../curriculum/leben-in-deutschland-brief.md`](../curriculum/leben-in-deutschland-brief.md).

Two questions had to be settled before any code: may the official questions be committed to a
public repository whose every merge deploys a public site, and is practising them the kind of
activity ADR 0009 fences off from the learner's progress?

## Decision

**The bank is an official work and ships verbatim.** The catalogue is not merely a BAMF
publication: it is **Anlage 1 of the Verordnung zu Einbürgerungstest und Einbürgerungskurs**
(BGBl. I 2008 S. 1649, last amended by Art. 1 V v. 21.6.2024, BGBl. I Nr. 211 — verified on
gesetze-im-internet.de on 2026-10-10, where the annex carries the general and the Bayern
questions). A Verordnung is unprotected under §5 Abs. 1 UrhG. BAMF's current PDF (*Stand
07.05.2025*) is its edition of that annex, not a copy of it: compared after folding case and
punctuation, 266 of the 310 question stems and 1095 of the 1240 options appear verbatim in the
Verordnung's XML, and the rest are reworded — mostly gender order (*Ausländer / Ausländerinnen* →
*Ausländerinnen/Ausländer*). The edition is what BAMF's online test centre uses, so the bank
follows it. As an official work published for general information it falls under §5 Abs. 2 at
the least, whose two conditions — no alteration, the source named — are kept. So:

- `data/lid/bank.yaml` and `public/lid/` hold the 300 general and 10 Bayern questions, their
  options in source order, the answer key and 20 image files, **unchanged** — outside
  `content/`, whose CC BY-SA licence they do not share. Every LiD page names the source.
- **Five pictures are withheld.** Questions 55, 70, 181, 216 and 235 carry press photographs the
  catalogue itself credits (`© Deutscher Bundestag/Achim Melde`, `© Bundesregierung/Engelbert
  Reineke`, …). §5 frees the official text, not a photographer's work placed in it — and the
  Verordnung's own annex prints question 216 with no photo at all. The importer verifies these
  files like every other and then does not write them (`withheld` carries the credit); the
  validator fails if one appears under `public/lid/`. The page shows the credit and links the
  question's page in BAMF's PDF. Four of the five are answerable from their text; only 55
  (*Was zeigt dieses Bild?*) needs the picture, which the link supplies. The other eight image
  questions are emblems, flags, maps and a ballot sample *in Anlehnung an* the
  Bundeswahlordnung, with no third-party credit.
- The text is never edited. Practice may *present* the options in another order (so position
  cannot be memorised); the mock exam shows them exactly as printed. The PDF's own typo
  (*Niedersachen*, question 201) is kept: the bank is the catalogue, not a corrected copy of it.
- The machine-readable extraction it is imported from
  ([`bamf-lid-dataset`](https://github.com/YehorAltshuler/bamf-lid-dataset), no licence
  declared) is an **import format only**: nothing of its own is shipped, and the app never
  fetches it.

**The answer key is earned, not trusted.** `bun run lid:import -- --check --crosscheck --pdf <file>`
re-derives every figure here:

- the dataset's `sourcePdfSha256` equals the SHA-256 of the BAMF PDF downloaded on 2026-10-10
  (`edd3ed5e…`, *Stand 07.05.2025*), and `questions.json` matches its manifest's hash;
- all 460 dataset questions pass the count and shape checks (300 + 16 × 10, options a–d, a
  solution in a–d), and all 25 image files of the selection — the 5 withheld ones included —
  match their hashes and pixel sizes;
- against two independent public keys the 310 answers show **zero disagreements**: 308 agree
  with `must1d/einbuergerungs-test` and 258 with `abdullahbutt/leben-in-deutschland-test`; the
  rest are worded differently in those sources and are not compared. The two `must1d` leaves
  out — 7 and 201 — were checked by hand against the BAMF PDF and the Verordnung: same correct
  option, the difference is option wording in the third-party copy.

A re-import that would change a correct answer, remove a question or attach a different BAMF id
to a number **stops** and must be accepted explicitly after checking the BAMF online test centre.
An answer key is never hot-swapped.

**Practice is learning; the pool is the curriculum.** ADR 0009 keeps official Goethe sets out of
progress because three sets measure memory of the items, not the skill. Here the opposite holds:
knowing these 310 questions *is* the competence the test certifies. So LiD answers are graded by
FSRS and sync like every other progress record. The mock exam is calibration — its score is
never a mastery figure — but a question missed in a mock is scheduled for review all the same.

**LiD progress has its own store key, never the course's.** Putting question states in `cards`
would count them as vocabulary on Fortschritt, spend the shared 15-a-day new-card budget
(`introducedToday`) and show a fake deck in `progress:audit`; logging them as `attempts` would
inflate verified accuracy and the activity counts. The `lid` key holds question states, the
answer log and mock runs; snapshot **v8** carries it. The version bump is deliberate: a v7
client would silently strip an unknown `lid` field and push the stripped copy, while a v8
snapshot makes it refuse instead.

**The notes are ours and live apart.** `content/lid/topics.yaml` groups the questions into the
regulation's three Themenfelder plus Bayern; `content/lid/notes/<topic>.yaml` places each
question in exactly one topic and carries the course's rationale (simple German) and
**unofficial** EN/RU translations. A re-import never touches them. Translations appear in
practice on request and never in the mock exam.

**Lessons are reading material, not spine topics.** `content/lid/lessons/<id>.mdx` teaches, in
simple German, the system behind the questions of one or more topics: `## Kurz gesagt` with one
EN/RU orientation, then German sections and a glossary. A lesson owns no exercises, probes or
outcomes and enters no Themen, grammar or Wortliste denominator — its practice is its topics'
official questions (`/leben/ueben?lektion=<id>`, every one of them, no daily cap). A topic belongs
to **at most one** lesson, so a question links back to exactly one lesson or none; `bun run
validate` enforces that, unique `order`, and the body's shape (`lidLessonProblems`).

**The Ukrainian half came second (owner decision, 2026-10-10).** The notes and the lessons
first shipped with EN and RU only, and `content/lid/` sat outside the UK-parity ratchet
(`ukHalfCoverage`) until their UK half was authored. It was written from the German, in the same
release cycle. The exemption is gone: every notes file and lesson is held all-or-none per file
(`lidNotesUkProblems`, and the lessons' frontmatter–body bridge), and the corpus ratchet counts
them.

## Consequences

- The trainer works everywhere the app does — web, phone, desktop release — with no local-only
  state; nothing of ADR 0009's boundary applies.
- The mock exam is a simulation: the real Fragebögen are not published (EinbTestV §1 Abs. 2), so
  the app draws its own 30 + 3 and must never call a draw an official sheet.
- Readiness is reported as facts — questions seen, correct on the last spaced answers, mock
  scores against both thresholds — never as a pass probability.
- A second state is data: `--states` in the importer and a new `bayern`-like topic; the runtime
  reads `bank.states`.
- One shipped image is a 1.6 MB original (the ballot sample, question 130); it loads only with
  its question. A resized web copy would need its own provenance record and is not worth that
  today.
