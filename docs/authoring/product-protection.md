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
separate training-data evidence notes, versioned character voice profiles, script and audio hashes,
speaker-similarity QA model revision/results, and the human identity/separation listening checklist.
A permissive model licence is never presented as verified
training-data or speaker-consent provenance. Voice cloning, reference recordings, unverified
voices and music remain outside the supported authoring path. Short contextual effects may be
manually downloaded from Freesound only under the reviewed CC0/CC BY policy: the exact original,
source page, uploader, licence, retrieval date, hash, processing and an honest rights-risk note are
retained. CC BY-NC, Sampling+, speech, brands and doubtful uploads are rejected; the uploader's
licence assertion is never presented as independently verified ownership. Context cannot carry a
correct answer by itself. Continuous beds and finite events remain distinct, and assisted
placement stores its actual editorial reason rather than implying human authorship. No generated
or mixed audio may enter `content/listening/` until a named
human has approved that exact revision and WAV.

Contextual sound may also be **generated**, and that path is supported on the same terms as the
imported one. The engine is Stable Audio 3 Small-SFX through Stability's own MLX implementation,
with the weights repository and its revision, the adapter code repository and its commit, and the
model licence pinned in `tools/listening-studio/models.lock.json`; the engine refuses to run
against anything else. Every generated asset keeps its own provenance — prompt, negative prompt,
seed, duration, resolved engine parameters, engine name, model and adapter revisions and the
licence — in the asset-store sidecar beside the WAV and in the render manifest that shipped it.
The licence is the **Stability AI Community License**: free for research, non-commercial and
limited commercial use, terminating for a licensee whose annual revenue exceeds USD $1,000,000,
who must then obtain an enterprise licence; commercial use also requires registration with
Stability AI. The bundled T5Gemma text encoder is redistributed under the Gemma Terms of Use.
Stability's model card states that the training corpus is 1,278,902 recordings licensed from
AudioSparx and taken from Freesound under CC0, CC BY or CC Sampling+, with copyrighted music
screened out; that is recorded as **their statement, not an independently verified fact**, exactly
as a permissive model licence is never presented as verified training-data provenance. Generated
sound is subject to every rule the imported path already carries — a context sound must never
carry a correct answer by itself, beds and events stay distinct, and nothing enters
`content/listening/` until a named human has approved that exact revision and WAV. The sound
library lists imported and generated assets side by side, each row labelled with its origin and
keeping its own record: an import has an uploader, a source page and a reviewed rights note, a
generated file has a prompt and a seed, and neither is described in the other's terms.

A VoiceDesign-to-cloning comparison may run only in the non-publishing local benchmark workspace.
Its references must be synthetic, use fictional non-imitation descriptions, and retain prompts,
model revisions and hashes. Benchmark output and reference audio cannot enter the production cache,
bundle or export path; adoption would require a later explicit policy and production decision.
An identifiable human reference may be evaluated only through the separate
`experiment-human-voice-clone` path under the gitignored `.private/` boundary. Its consent record
must bind the exact reference hash, authorized purpose, retention rule and no-distribution scope;
the runner refuses missing consent, output outside `.private/` and overwriting an earlier run. A
minor additionally requires explicit guardian consent and child assent. Both were supplied for the
2026-08-03 private technology evaluation; this authorizes local evaluation, not publication,
production import, course export or general reuse. Any later casting or distribution decision
requires its own agreement and product-policy change.

## Deferred commercialization checklist

Before a commercial launch, obtain current professional advice and address:

- legal review of ownership, licensing and distribution terms;
- desktop code signing and notarization;
- consumer terms, withdrawal handling, Impressum and privacy disclosures;
- VAT and payment handling;
- applicable product-security and Cyber Resilience Act obligations.

Payments, accounts, proprietary content and commercial infrastructure are intentionally outside
the current project scope.
