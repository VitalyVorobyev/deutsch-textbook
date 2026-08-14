# Learning-activity audit

Status: normalized · 2026-08-14 · contract: [ADR 0014](../adrs/0014-learning-activity-architecture.md)

## Question and method

The audit did not ask whether each YAML file has eight items. It asked four independent questions:

1. What learner job does this set perform: core, extension, application or remediation?
2. Where does that job sit: scaffold, fade or transfer?
3. Through which medium is it delivered: mixed items, listening or a document?
4. Is the file a coherent activity, or only a repository-history fragment?

`bun run activity:audit` inventories every topic-owned practice/drill set and names only three
review queues: core outside the 8–15 cognitive-load band, missing productive application, and dense
topics worth human inspection. `bun run validate` enforces the actual contract. Neither command
adds file counts into a quality score.

## Normalization performed

- All 168 existing teaching sets received an explicit activity, authored stage and German activity
  title. Medium remains derived so it cannot drift from the items.
- The 86 `set-zu-klein` and 50 `set-zu-eng` findings were retired. Short listening, document and
  open-production activities are now judged by their job; item-mix protection remains per topic.
- Twenty-one free-production items moved out of six overloaded core sets into application sets.
  The six cores now all sit inside 8–15 items. Probe arming and grading-decision references moved
  with the items.
- Akkusativ gained a separate everyday application for the three moved translations.
- `ort-richtung-praepositionen`, `verben-mit-kasus` and `zeit-praepositionen` gained nine new
  fresh-context write/speak/translate tasks. Every topic now has a productive application.
- Five A1 follow-on sets whose real job was productive use—not optional explanation—were promoted
  from extension/scaffold to application/transfer.
- The learner page now shows one required Grundübung and collapses Vertiefen, Anwenden and Gezielt
  üben as optional groups. Redaction presents function, stage and medium separately and filters the
  material index by learning function.

The move intentionally changes 21 set/item evidence keys. This was accepted because the current
cohort is one consenting test learner and a coherent course is the higher-priority asset.

## Current inventory

Reproduce with `bun run activity:audit`:

| Purpose | Sets | Interpretation |
| --- | ---: | --- |
| core | 49 | exactly one required Grundübung per topic |
| extension | 12 | optional contrasts/subskills, including focused dictation |
| application | 94 | productive missions and additional listening transfer |
| remediation | 17 | targeted confusion banks, available on demand |

Medium: 120 mixed · 47 listening · 5 document. There are 172 teaching sets after the four new
application files. Zero core activities are outside 8–15; zero topics lack productive application.

The Redaction profile queue fell from the 265-opening baseline to **81**. The reduction is not a
KPI; it means 184 invalid or now-closed claims disappeared. The remaining queue is specific:
20 articles without addressable explanation subsections, 19 focus tags without a probe, 17 reading
length reviews, 9 translations without `key_tokens`, 7 unpractised tags, 7 inventory points without
an owner and 2 missing outcome modes.

## Dense-topic decisions

Five topics still own at least five sets. Density locates a review; it is not itself a defect.

| Topic | Decision |
| --- | --- |
| A1 Alltag und Zeit | Keep: one core, two distinct extensions (`von … bis` and auditory dictation), and two applications (productive separable-verb routine plus contextual listening). The page no longer presents all five as required. |
| A1 Freizeit und können | Keep: core ability/free-time work, one auditory extension, productive Perfekt application, contextual listening, and one modal-bracket remediation. Each answers a different learner need. |
| A2 Dativ | Keep all eight source sets, but expose only the 14-item core as required. Four drills isolate genuinely different confusions—`mir/mich`, `der/dem/den`, triggers, fixed prepositions—and belong to targeted remediation, not the lesson sequence. Production moved into the application block. |
| A2 Infinitiv mit zu | Keep: Futur I is an explicit extension, `zu` placement is a targeted remediation, and production/listening are separate transfer media. They should not be collapsed into a 34-item linear run. |
| A2 Wohnen & Umzug | Keep: the production scenario, document mission and listening artifact are three complementary application media; the `wo/wohin` drill remains optional remediation. |

This audit establishes architecture and activity boundaries. It is not a new claim that every
sentence in 2,000+ exercise items has received a fresh linguistic copy-edit; those language-level
findings remain governed by topic review and the validation/progress loops.
