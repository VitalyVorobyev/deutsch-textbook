# Material governance in Redaktion

**Question.** How should Redaktion give the owner a true overview of every kind of material in the
course, a status that means the same thing for every kind, and a working queue that both the owner
and Claude read and write?

The owner's brief: Redaktion should provide "clear overview, management, governance of material",
because reading material, grammar summaries and lesson exercises are "still a mess". It should also
carry designed workflows for the cooperation between the owner and Claude. This proposal is the
review that brief asked for and the design that follows from it. It authorizes nothing; an ADR
records whatever is accepted.

Every figure below names its command. Most come from the content graph, through the snippets in
the [appendix](#appendix-how-the-figures-were-counted).

## What the review found

### The material, kind by kind

| Kind | Count | Owner | How the learner reaches it | Status today |
| --- | ---: | --- | --- | --- |
| Topic article (`.mdx`), `Kurz gesagt` first | 57 | its topic | topic page | topic `status`: 10 `reviewed`, 47 `draft` |
| Teaching set (`practice`, `drill`) | 227 | a topic | topic page, training, session | none |
| Pretest | 57 | a topic | topic page, before the article | none |
| Probe family | 158 | a topic | session step 0, Proben | none |
| Checkpoint, placement | 3 + 3 | a level (anchored to a topic) | `/checkpoint`, `/einstufung` | none |
| Exam practice set | 12 | a level (anchored to a topic) | `/pruefung/<level>` | none |
| Reading, intensive | 68 | a topic | topic page only | none |
| Reading, extensive | 17 | a topic | topic page only | none |
| Listening scene | 76 | a topic, or an exam set | inside sets (`audio-comprehension`) | own plan: 76 published, 1 drafted, 16 planned |
| Document | 17 | a topic | inside sets | none |
| Discovery piece | 12 | none (links 19 topic slots) | `/entdecken` | `status`, and only `reviewed` ships |
| Referenz page + `reference-data` file | 9 + 7 | none | `/referenz` | none |
| Vocab deck | 129 (3572 entries) | 47 owned by a topic, 82 completion decks unowned | `/vocab`, Wortschatz, review | none |
| Wortfeld, Wortnetz | 2 + 10 | Wortfeld a topic; Wortnetz none | topic page, `/referenz/wortnetze` | none |
| LiD bank, notes, lessons | 310 + 18 + 12 | none | `/pruefung/leben` | none |
| Reading audio (`content/reading-audio/`) | 0 | — | — | the folder holds only `.gitkeep` |

### F1 · The work queue is empty, and the work is elsewhere

Redaktion's **Qualität** view shows **0** findings (`graphPayload(contentGraph()).problems`). The
editorial debt exists; it lives in Markdown that Redaktion does not read:

- `docs/backlog/content.md`: 20 entries with IDs, plus **45 per-file findings** under "findings
  below the material bar" (the lines starting with a topic path).
- `docs/backlog/instruments.md` 25 entries, `learner-app.md` 22, and the other four area files 14.
- `data/authorship-provenance.yaml`: 20 records, **every one `humanReview: pending`**.

So the tool built for the editorial overview reports a clean corpus. The owner cannot see the debt
without reading the backlog files, and Claude cannot see what the owner noticed unless it is said
in a chat.

### F2 · "Reviewed" exists for one kind, and means little outside B1

Only topics and discovery pieces carry a status. Topics: A1 5/12, A2 3/25, B1 2/20 `reviewed`. What
the status certifies differs by level. A B1 topic needs a completed human review in its provenance
record (`reviewedTopicAuthorshipProblems`); an A1 or A2 topic needs only a green validator. No set,
reading, deck, listening scene, document or Referenz page has any review state. The status also
does not expire: a `reviewed` topic whose sets were rewritten last week still reads `reviewed`.

### F3 · The content graph does not model six kinds

`contentGraph()` has no node for `reference-data`, the LiD bank, notes and lessons, the listening
plan (`data/listening-plan.yaml`), recordings (`data/audio-provenance/`), grading rulings
(`data/grading-decisions.yaml`, 363 entries) or authorship provenance. Redaktion is built on the
graph ("every figure comes from `@da/content`"), so these are invisible there by construction.
Each is governed by its own script, file or habit instead.

### F4 · Redaktion's own index has holes

Counted from the payload's `elements` against the filters in `apps/redaktion/src/views/Bestand.tsx`:

- **Materialien → Wortnetze** filters for kinds `wortnetz` and `wortfeld`. No element has kind
  `wortnetz`, so the tab lists the 2 Wortfelder and none of the 10 Wortnetze.
- **Materialien → Entdecken** also filters for kind `referenz`, which no element has. The 9 Referenz
  pages appear nowhere in Materialien.
- **Exam practice** (12 sets, element kind `pruefungspraxis`) is in no Materialien tab.

### F5 · Set names stopped carrying their owner

Of the 227 teaching sets, 122 follow the canonical names (`<topic>`, `<topic>-produktion`,
`drill-*`), 28 are prefixed by their topic, and **77 are not prefixed by their topic at all**:
`hoeren-dativ`, `ls-akkusativ-01-hoeren`, `alltag-ueber-dauer`, `praesens-koordination-anwenden`
among them. 47 teaching sets are listening sets with `hoeren` in the name, in at least two conventions
(`hoeren-<x>` and `ls-<scene>-hoeren`).
Teaching sets per topic run from 2 to 9 (median 4), and `bun run activity:audit` lists 16 dense
topics, 15 of them in A1 and A2.

Renaming is not free. A set id is half of every attempt key (`setId::itemId`) in the learner's log,
in probe `arming:` lists and in grading rulings, so a rename strands history unless it ships with a
migration. This is a reason to show ownership in Redaktion rather than to rename files.

### F6 · Some ownership is a convenience, not a fact

- The 12 exam practice sets are anchored to topics they have nothing to do with:
  `pruefung-a2-1-*` to `freunde-feste`, `pruefung-a2-2-*` to `lernen-verstehen`, `pruefung-a1-*` to
  `freizeit-koennen`. The anchor exists for spine position.
- 82 completion decks are unowned by rule (`content/CLAUDE.md`: "Wortliste completion decks stay
  unowned"), and B1 topics adopt some of them by owner decision. Neither state is visible as a
  decision anywhere.
- 16 of the 17 documents are A2; B1 has one.

### F7 · Grammar is summarised in three places, linked one way

- **Kurz gesagt**: all 57 articles have one.
- **Referenz**: 9 pages, 7 of them built from `content/reference-data/`. Each page links to the
  topics that teach it through focus tags (`TaughtIn.astro`), so that direction cannot go stale.
- **Article → Referenz**: one `<Siehe to="referenz/…">` link in the whole corpus
  (`grep -rhoE 'to="referenz/' content/topics`). Articles link to earlier topics 12 times.

Nothing records which grammar point each Referenz page covers, so "is every B1 point in a Referenz
table?" has no answer short of reading the pages.

### F8 · Planned material has no queue

- The listening plan lists 16 scenes `planned` and 1 `drafted` (`bun run listening:inventory`).
  17 topics have no listening scene, 11 of them in B1. B1 has 9 scenes for 20 topics.
- `content/reading-audio/` is an empty slot: no narration has been made, and nothing lists which
  readings should get one first.
- The Tonwerk backlog counts the TTS-only `audio-comprehension` and `listen` items. That is a third
  queue for the same question: which audio is owed.

### F9 · Reading has no surface of its own

All 85 readings, extensive ones included, are reachable only from their topic page. An extensive
reader ("meant to be read straight through", `docs/authoring/authoring-checklists.md`) has no
library, no list and no place in Entdecken. This is a learner-app gap rather than a Redaktion one,
and it belongs in the learner-app backlog; it is listed here because it surfaced in this review.

## The design

Three parts, in dependency order: a census Redaktion can trust, one review lifecycle for every
kind, and one queue both parties read and write.

### 1. A census that covers every kind

Extend `contentGraph()` so that every kind in the table above is an element, with an `owner`
(topic, level or none), a `kind` and a `file`: Referenz pages (with the focus tags they cover),
LiD lessons and note files, exam practice sets as level-owned, listening plan rows (including the
planned ones, as absences) and reading-audio slots. Grading rulings and provenance stay data, but
the graph indexes them by topic, so a topic profile can show its rulings and its provenance state.

Redaktion's **Materialien** then derives its tabs from the element kinds rather than a hand-written
list, which removes F4 as a class: a kind added to the graph is in the index without a second edit.

### 2. One review lifecycle: `draft → claude-reviewed → owner-reviewed`

Every element gets a review state from one committed ledger, `data/review-ledger.yaml`, keyed by
file path:

```yaml
- file: content/exercises/b1/drill-lassen-verwendung.yaml
  state: claude-reviewed
  revision: 3f2a9c1e        # hash of the bytes that were reviewed
  by: Claude Code
  at: 2026-11-01
  note: "Seven items from the failed lassen probes; check the RU prompts of the translate items"
```

- **`revision` makes a review expire.** When the file changes, the hash stops matching and
  Redaktion shows the element as *changed since review*. That is the property today's topic status
  lacks (F2).
- **`claude-reviewed`** means Claude read the file against the authoring rules and its gates, and
  says in `note` what the owner should look at. It is a hand-off, not a verdict.
- **`owner-reviewed`** is only ever set by the owner, in Redaktion. For a B1 topic it also writes
  the provenance record's `humanReview`, so the existing strict gate keeps working unchanged.
- An element with no ledger row is `draft`. Nothing is backfilled; the debt is shown, not hidden.

Topic `status: reviewed` becomes derived: a topic is reviewed when its own manifest and article
and every element it owns are `owner-reviewed` at their current revision. The manifest field stays
until an ADR retires it.

### 3. One queue: `data/redaktion-queue.yaml`

```yaml
- id: q-0042
  target: b1/drill-irreale-bedingung::uebersetzen-tom-fahrer   # file, set::item, topic, or kind
  type: finding            # finding | request | question
  from: owner              # owner | claude
  text: "The RU prompt does not say who drives."
  state: open              # open | in-progress | answered
  answer: null             # filled when it is answered; the entry is deleted when it is closed
```

- **Owner → Claude.** The owner files a finding, request or question against any target in
  Redaktion; it is written to the queue file. Claude reads the queue at the start of every session
  (one line in the root `CLAUDE.md`), works the open entries, and answers each in the same PR as
  the fix.
- **Claude → owner.** A PR that changes material writes `claude-reviewed` ledger rows for the files
  it touched. Redaktion's new **Prüfen** view is the owner's inbox: every element whose state is
  `claude-reviewed` or *changed since review*, with Claude's note and a diff against the reviewed
  revision. The owner marks it `owner-reviewed` or files a queue entry against it.
- **Backlog findings move in.** The 45 per-file findings in `docs/backlog/content.md` become queue
  entries with `from: claude`, so they appear on the files they concern, in Qualität and in the
  topic profile. Area backlog entries with IDs stay in `docs/backlog/` because they are work
  items, not findings on a file.
- **Closed entries are deleted**, like a finished backlog line. `git log` is the archive.

Redaktion still does no Git: no staging, no commits, no PR UI. Both files are ordinary text the
owner commits, or that Claude commits in its PR.

## The workflows, end to end

**A Claude session.** Read `data/redaktion-queue.yaml` → take the open entries the session can
close → author → gates → write `claude-reviewed` rows for every touched material file → PR with
the queue answers → merge.

**An owner review pass.** Open **Prüfen** → read Claude's note and the diff → either mark
`owner-reviewed`, or file a queue entry and leave the state as it is. Nothing the owner does in
Redaktion needs a terminal.

**Learner evidence.** Progress stays out of Redaktion (ADR 0010). Drills and probe families
written from the audit enter the ledger like any other material, so the owner sees them in Prüfen.

## Open decisions

1. **Ledger or in-file status.** A ledger keeps 460 set files untouched and lets a review expire by
   hash. A `status:` field in each file is visible in the file itself but cannot expire and churns
   every file once. This proposal recommends the ledger.
2. **Review granularity.** Per file (recommended, and what the hash supports), or per item for
   exercise sets. Per item is closer to how the owner reads a set and costs a hash per item.
3. **What `owner-reviewed` asks of the owner for A1 and A2.** Either the same human review as B1,
   or a lighter read the owner defines.
4. **Exam practice ownership.** Keep the arbitrary topic anchors, or give the graph a level owner,
   which touches validation and the spine.
5. **The 77 off-convention set names.** Leave them and show ownership in Redaktion (recommended),
   or rename them with an attempt-log migration.

## What this proposal does not change

The repository stays the content database (ADR 0001). Redaktion stays an editor without Git, with
explicit, revision-checked saves (ADR 0010, ADR 0012). `bun run validate` stays the gate, and no
review state becomes a validator failure except the existing B1 provenance rule.

## After the owner's review

An ADR for the accepted parts, then a replacement for the P27 list in
`docs/backlog/redaktion.md`. The likely order is P26-16 first, because per-file invalidation is
what makes a ledger row cheap to recompute; then the census (part 1); then the ledger and Prüfen
(part 2); then the queue (part 3).

## Appendix: how the figures were counted

Material counts, by kind and level:

```sh
bun -e 'import {contentGraph} from "@da/content/graph"; const g=contentGraph();
const t=x=>{const m={};for(const k of x)m[k]=(m[k]??0)+1;return m};
console.log(t([...g.topics.values()].map(x=>x.data.level+":"+x.data.status)));
console.log(t([...g.sets.values()].map(x=>x.level+":"+x.data.role)));
console.log(t([...g.readings.values()].map(x=>x.level+":"+x.data.kind)));
console.log(t(g.elements.map(e=>e.kind)))'
```

Qualität findings: `graphPayload(contentGraph()).problems.length` from `@da/content/payload`.
Set-name conformance: each teaching set's file basename compared with its `topic:` (the same graph,
`role` in `practice`/`drill`). Listening statuses: `bun run listening:inventory`. Dense topics:
`bun run activity:audit`. Backlog findings: `grep -cE '^- \`[ab][12]/' docs/backlog/content.md`.
Provenance: `grep -c 'status: pending' data/authorship-provenance.yaml`.
