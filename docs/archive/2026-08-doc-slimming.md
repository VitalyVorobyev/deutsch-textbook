# Archived detail: the 2026-08-04 documentation lean pass

Companion to [backlog.md](../backlog.md), [roadmap.md](../roadmap.md), [design.md](../design.md)
and [cloud-sync.md](../architecture/cloud-sync.md). **Nothing here is an active contract.** It is
the dated evidence, resolved incidents, measurement essays and PR play-by-play those four documents
carried inline until the detail buried the instruction. Each block names the entry it came from, so
a reader who wants the reasoning behind a surviving one-line verdict can find it.

Figures are as they stood on the date in their block and are **not maintained**. A figure worth
having again is worth re-earning with the command beside it.

## From docs/backlog.md

### P5-11 · the read of 2026-08-03

Queue drained at 188 ruled / 0 awaiting (23 rulings, 3 accept, 20 confirm) — the first read taken
against a corpus the learner had opened in full: 41 touched topics, 2696 attempts. Production
assembly remained the bottleneck for the fifth consecutive read (`translate` 42% against `cloze`
85%, `mc` 92%).

One thing changed that four previous reads did not show: `temporal-nebensatz` (9/21, 2 items, no
recovery) became persistent and was, at that moment, the only persistent tag with no serving drill.
The other nine all had one — fifteen drill sets, A1 and A2 only, B1 owning none at all, which is
what made the exception possible. `content/exercises/b1/drill-temporal-nebensatz.yaml` has since
closed it, so the standing conclusion (*the owed action is the learner taking training, not
authoring*) again holds without exception.

Four tags showed no recovery after their last error: `dativ-praepositionen` (21/84),
`nebensatz-verbende` (18/54), `da-wo-woerter` (11/49), `temporal-nebensatz` (9/21).

The table was post-triage and differed from the pre-triage one, which is the rule working:
`adjektiv-nomen` (8/19) left the top ten and `temporal-nebensatz` entered it once the 20 confirms
re-entered the signals.

Drill notes banked from that round, none of them yet authored: the reflexive pronoun dropped from a
governed reflexive verb (*sich anmelden*, *sich treffen* — twice in one round); *stellen/legen/setzen*
taking **wohin** even when the result is a location; *antworten auf* + Akkusativ against *jemandem
antworten*; a separable prefix dropped at the end of the main clause (*anrufen*); and **aber in
position 0 never triggering inversion** — the exact mirror of the *deshalb* rule the learner has
already met.

### P23-3 · the runtime weak-focus table of 2026-08-03

Measured against `progress/vitaly/2026-08-03.json` by running `weakFocuses` (`src/lib/weakness.ts`)
and crossing it with every `role: drill` item's `focus`: `komparativ-attributiv` 45% (n=11),
`temporal-nebensatz` 43% (n=21, drilled since), `damit-um-zu` 43% (n=7), `je-desto` 42% (n=12),
`adjektiv-nomen` 39% (n=19), `genitiv-eigenname` 38% (n=12), `lassen-verwendung` 36% (n=11).

`komparativ-attributiv` topped the runtime list and did not appear in the audit's persistent top ten
at all — the concrete case behind the surviving rule that the two instruments answer different
questions and a drill decision reads both.

### P23-2 · the revision-bump measurement of 2026-08-03

`classifyProbe` drops an attempt whose `itemRevision` no longer matches to
`attempt.focus ? 'failed' : 'retained'` — the stored historical tag.

Measured on the 2026-08-03 triage and worth nothing at the time: the two probe accepts
(`a1/probe-wohnen:variant-c`, `a1/probe-menschen-familie:variant-c`) reclassify `correct` ↔
`retained` with the bump on and off, and both count toward retention either way —
`akkusativ-artikel` 56% and `possessivartikel` 83%. The hazard is the case where the stored tag says
`failed`; it did not occur in that corpus.

### P22-9 · what the missing markdown pass cost, 2026-08-02

A rewrite pass over the published `-hoeren` sets emphasised German with `*…*` before anyone checked
whether `explain` renders markdown. It does not — `shared.tsx` puts it in a plain `<p>`. Caught by
reading the component, not by a gate.

### P22-14 · the instances, and the measurement trap

Two lines in `ls-gesundheit-wohlbefinden-01` were re-rolled by seed after Vitaly heard them, which
is treating instances rather than the cause. `ls-wohnen-01` line 6 alone carries 2.83 s of
lead+trail.

The trap: words per second of wall clock ranks "Und heute?" as the corpus's slowest line, because
short utterances are dominated by fixed pause overhead. Words per second of *voiced* audio is the
metric that finds real defects.

### P22-10 · the out-of-window artifacts, 2026-08-04

Twelve of forty-one outside their window: ten of Wave 1's twelve, unchanged, plus
`ls-trennbare-verben-01` (33.4 s against 35–45) and `ls-man-und-besitz-01` (46.9 s against 35–45),
which the voice-drift re-seeding pushed out of a window they used to sit inside. Steadier delivery
is faster; the windows were written before the corpus existed.

`ls-lernen-zukunft-01` at 44.4 s against 65–85 was flagged by Codex on #131 — it is the shortest B1
take against the longest B1 window, so the unit gets roughly half the sustained listening its brief
asked for.

### P22-11 · why 129 candidate pairs is not a defect count

The throwaway scan strips parentheticals, which is exactly where the corpus puts its disambiguators
(`öffnen`/`aufmachen` name each other and are correctly separated), and it scores a subset as a full
collision (`drei` vs `dreimal`). `aufmachen`, `Aufgabe`, `Anweisung` and `Empfehlung` sit high on
both that scan and the lapse table, which is where a real triage would start.

### P12-6 · the inverted-signal measurement

Extending the A1 dictation silence to items without predicates dropped 145 of 291 free-typed tags
and took `weakFocuses` from 7 to 1 — error rates driven to zero at an unchanged denominator, with
`um-am-zeit` reading 1% error at n = 30 against a real 21%. An inverted signal, not an honest gap.

### P12-7 · where the standing accept-list policy came from

PRs #116 and #117 became a ten-round loop of enumerating renderings. The policy exists so nobody
re-runs it: close an item's *declared* product in one pass and stop.

### P22-* · PR attributions

P22-19, P22-20, P22-18 and P22-17 were found by Codex on #131; P22-19 and P22-18 were introduced by
#131. P18-8 was found on #124, P20-3 on #128. None of that changes what the fix is.

### Recently completed, before 2026-07-28

Detail in [the 2026-07-26 archive](2026-07-backlog-full.md).

- **P17-1–4 · P9-2 (2026-07-26):** semantic visual families and two Entdecken pieces.
- **B1.1–B1.3 (2026-07-24/25)** and **A2 close (2026-07-24)**.

## From docs/roadmap.md

### Retention gate · the read of 2026-08-02 in full

Snapshot `progress/vitaly/2026-08-02.json`, taken after the grading queue was drained to
165 ruled / 0 awaiting.

- **1 of 8 readable A1 competences at ≥80% retention** (12.5%, bar 80%). Only `verbzweit` clears
  it. `genus` 33%; `akkusativ-artikel` and `dativ-praepositionen` 50%; `kein-nicht` and
  `verb-endungen` 67%; `possessivartikel` and `um-am-zeit` 75%.
- **Free production at 60%** (bar 70%) — 12 of 20 translate-format probe attempts across those
  same readable rows.

Half of A1 was not in that verdict. Eight competences sat at zero attempts because their lessons had
never been opened — `du-sie`, `duerfen-muessen`, `haben-sein`, `imperativ-form`, `partizip2-a1`,
`perfekt-satzklammer`, `trennbar-modal`, `trennbar-wortstellung`, all from the P19-1 backfill. Three
more needed one attempt each. So the honest statement was *A1 retention is weak on what has been
measured*, not *A1 retention is 12.5%*.

The rule that a miss stops B1 authoring was amended to advisory on the same day, with the first
result in hand rather than quietly after it failed: applied literally it would have halted the
curriculum on evidence covering under half of A1.

### Track 5 · the published listening corpus, as it stood at publication

41 artifacts, one per live unit, 29.5 minutes of speech, every one passing QA on both the dry take
and the final mix and every one carrying named human approval of the exact bytes. 14.2 MB of MP3 in
`content/listening/`, 13.7 MB of Freesound provenance in `data/`, carried by both shipping builds
(the desktop app and Cloudflare Pages); an unflagged build reports `bundled: false` and falls back
to browser TTS. Seventeen legacy TTS items were retired against a per-item ledger and twenty-four
kept with reasons — [audio-retirement-ledger.md](../quality/audio-retirement-ledger.md) is the live
record.

The terms neural audio remains publishable on: volume is not a substitute for intelligibility, and
automatic transcription is a defect detector, never proof of natural pronunciation.

## From docs/design.md

### What `PUBLIC_ATLAS_AUDIO_BUNDLE` originally encoded

The flag was introduced to split recordings onto the desktop and leave browser TTS on the web. The
corpus is 14.2 MB against a ~69 MB site, so the split bought nothing worth the worse demo, and both
shipping builds now set the flag. What it distinguishes today is a shipping build from a lean one
with no binaries.

### The predicate-additivity measurement

`focus_evidence` predicates are additive rather than a corpus-wide silence because silencing every
unmatched free-typed miss was measured against the learner's log and inverts the signal: 145 of 291
wrong free-typed attempts lose their tag and `weakFocuses` falls 7 → 1, with error rates driven to
zero at an unchanged denominator. Same measurement as backlog P12-6.

## From docs/architecture/cloud-sync.md

### The test that passed for the wrong reason

Of the mechanisms watched failing, one check found a defect in the test rather than the code: the
original "tampered state" test passed with the HMAC comparison deleted, because a mangled base64
payload fails to parse anyway. It was rewritten to substitute a payload that decodes to *valid*
state under the original signature, so only the HMAC can reject it.

### Why the app no longer looks broken during a sign-in outage

`AccountPanel` used to map over an empty provider list and produce a page that ended mid-thought. It
now renders an explicit "sign-in is not available right now" line when `providers` is empty.
