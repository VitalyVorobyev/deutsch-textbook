# Product protection and authorship provenance

Status: authoritative process and licence-boundary record. This is an engineering and editorial
contract, not legal advice.

## Ownership and authorship

Deutsch-Atlas is a project by **Vitaly Vorobyev**, its owner, creative director and human editor.
AI systems may draft prose, propose alternatives, analyze the corpus and generate base artwork.
They are tools, not authors, and must never be credited as authors or used to fabricate a human
review history.

The process aims to preserve evidence of Vitaly's identifiable creative direction, selection,
arrangement, rewriting and visual composition. It does not claim that every raw AI output is
independently protected. The course is presented primarily as a human-edited compilation and a
body of human editorial contributions.

## Licence boundaries

The current open model remains unchanged:

| Material | Licence | Boundary |
| --- | --- | --- |
| Application code in `src/`, `scripts/` and `src-tauri/` | MIT | Excludes the two course-visual directories below; see [`../LICENSE`](../../LICENSE) |
| Course content and course-specific instructional assets named in `content/LICENSE`, including `src/assets/illustrations/` and `src/components/visuals/` | CC BY-SA 4.0 only | Not dual-licensed under MIT; attribution and share-alike apply, including to commercial reuse |
| Real or adapted third-party sources | Their recorded licence | Attribution and licence metadata are mandatory |
| Vitaly Vorobyev's name, likeness and endorsement | Not granted by either project licence | Credit does not imply endorsement |

An open licence grants reuse under stated conditions; it does not surrender ownership. Previously
published versions remain reusable under their published terms even if a future distribution
model changes.

## Provenance is not copyrightability

`sourceClass` records where an artifact came from:

- `real`: an external work used in substantially its original form;
- `adapted`: an external work modified for the course;
- `simulated`: a course-created artifact that imitates the communicative function of a genre.

Real and adapted sources require attribution and licence metadata. `simulated` does **not** mean
`original`, `human-authored`, `copyrighted` or guaranteed protectable. Creation mode, generation
tool, retained brief, candidate selection and human editing are recorded separately in
`data/asset-provenance.yaml`.

## Enforced editorial process

For B1.4 and later, `data/authorship-provenance.yaml` begins with a human-approved creative brief.
AI output remains a draft. A topic may exist with review pending, but it cannot ship with
`status: reviewed` until Vitaly explicitly completes the record with concrete selection,
rewriting or arrangement decisions and a review date.

Generated and simulated assets use the parallel asset manifest. Exact prompts that were not saved
for legacy assets are marked unavailable rather than reconstructed. New generated assets must
retain their brief or prompt, candidate count, selection reason and subsequent composition/edit
decisions. Legacy assets keep frozen baseline hashes; any later edit requires its own current-hash
change record with the real tool, saved brief and human direction. `sourceClass` and the manifest
together describe process; neither predicts a court's copyright assessment.

The repository skill [`.agents/skills/authorship-provenance/SKILL.md`](../../.agents/skills/authorship-provenance/SKILL.md)
is the operational handoff for authors and visual generators.

Generated listening audio has its own per-artifact manifest under `data/audio-provenance/`.
It retains the exact generation brief, immutable model and adapter revisions, model licences,
separate training-data evidence notes, official voice profile, script and audio hashes, QA results,
and the human listening checklist. A permissive model licence is never presented as verified
training-data or speaker-consent provenance. Voice cloning, reference recordings, unverified
voices and music remain outside the supported authoring path. Short contextual effects may be
manually downloaded from Freesound only under the reviewed CC0/CC BY policy: the exact original,
source page, uploader, licence, retrieval date, hash, processing and an honest rights-risk note are
retained. CC BY-NC, Sampling+, speech, brands and doubtful uploads are rejected; the uploader's
licence assertion is never presented as independently verified ownership. Context cannot carry a
correct answer by itself. No generated or mixed audio may enter `content/listening/` until a named
human has approved that exact revision and WAV.

## Deferred commercialization checklist

Before a commercial launch, obtain current professional advice and address:

- legal review of ownership, licensing and distribution terms;
- desktop code signing and notarization;
- consumer terms, withdrawal handling, Impressum and privacy disclosures;
- VAT and payment handling;
- applicable product-security and Cyber Resilience Act obligations.

Payments, accounts, proprietary content and commercial infrastructure are intentionally outside
the current project scope.
