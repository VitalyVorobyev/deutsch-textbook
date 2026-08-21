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
training-data or speaker-consent provenance. Unverified voices and music remain outside the
supported authoring path; voice cloning from a consented reference is a supported path and is
governed by the section below. Short contextual effects may be
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

## Consent-gated voice cloning

A voice may be cloned from a real person's recording and cast in published course audio, and it may
be done **only** through a consent record that this repository can check. This is the "later
explicit policy and production decision" the research path reserved; it is stated here as current
truth, and everything that made the research path safe is kept and made stricter rather than
bypassed.

**A consent binds one recording and one scope.** The document names the SHA-256 of exactly the
reference recording it permits, and the engine refuses to store a recording whose bytes hash to
anything else — a consent that could be re-pointed at other audio is a permission slip with the name
left blank. `scope: evaluation` permits local evaluation and nothing else. `scope: publication`
permits the voice to be cast in course audio that ships, and costs more rather than less:

- a permitted use must explicitly allow publication **in this course**; permitting publication in
  general is a broader grant than this product asks for and is not accepted in its place;
- redistribution outside the course must still be prohibited;
- the retention rule must be stated;
- a minor additionally requires explicit guardian consent **and** guardian-attested child assent,
  at either scope.

The full rule vocabulary lives in `tools/listening-studio/src/listening_studio/generative/voices.py`
and is served by `GET /api/voices`, so the consent form in Tonwerk prints the rules it will be held
to. Every refusal names the rule it failed. The rules are enforced in one place and re-implemented
in none.

**Reference audio and consent documents live outside the repository.** They are written under the
studio's app-data directory (`voices/<sha256>.wav` beside `voices/<sha256>.consent.json`), never in
`content/`, never in git, and never in a database column. A checkout on another machine therefore
has the row and not the recording, and that state is reported as an absent reference rather than as
a withdrawal.

**Per-artifact claims are computed, not asserted.** A render manifest (`render.json`) carries a
top-level `voices` map — cast role to the bound voice identity, with the reference and consent
digests. The scene publisher writes `voice_cloning_used` as `bool(voices)` and the consent hash list
from that same map; the legacy dialogue publisher computes the same claim from the payload's own
adapter. A published artifact can therefore be checked against the consent that permitted it, by
hash, without anyone being asked to remember.

**Withdrawal.** Revoking a consent marks the row revoked with the date, deletes the reference
recording and every audition rendered from it, and makes the engine refuse all further synthesis
through that voice — in the render path as well as the API and the CLI. Renders already produced
keep their provenance unchanged: it is the record of what actually made those bytes, and a
provenance record that edited itself on withdrawal would be a false one. Artifacts already published
with a withdrawn voice are retired through the existing **republish/retirement path** —
`atlas-listening republish` for a corrected artifact, and removal from `content/listening/` with its
`data/audio-provenance/` manifest for one that is not replaced — which is a deliberate editorial act
and not a side effect of pressing revoke.

**The evaluation path is unchanged.** A VoiceDesign-to-cloning comparison may still run only in the
non-publishing local benchmark workspace, with synthetic references, fictional non-imitation
descriptions, and retained prompts, model revisions and hashes; benchmark output cannot enter the
production cache, bundle or export path. An identifiable human reference may still be evaluated
through the separate `experiment-human-voice-clone` path under the gitignored `.private/` boundary,
whose runner refuses missing consent, output outside `.private/` and overwriting an earlier run. The
2026-08-03 private technology evaluation ran under that path and authorized local evaluation only;
publication of any voice requires its own publication-scope consent under the rules above.

The cloning checkpoint is pinned in `tools/listening-studio/models.lock.json` beside the other
production models, with its licence and the same training-data honesty note they all carry. Its
Apache-2.0 licence says nothing about whose voices it was trained on, and is never presented as
if it did; consent for the voice it *clones* is the separate record described here.

## Deferred commercialization checklist

Before a commercial launch, obtain current professional advice and address:

- legal review of ownership, licensing and distribution terms;
- desktop code signing and notarization;
- consumer terms, withdrawal handling, Impressum and privacy disclosures;
- VAT and payment handling;
- applicable product-security and Cyber Resilience Act obligations.

Payments, accounts, proprietary content and commercial infrastructure are intentionally outside
the current project scope.
