# Goethe exam trainer — operations

The operational half: what the trainer is, the expected local layout of the official materials,
how to run ingestion, and where its outputs land. The *decision* — why the materials never enter
the repository, why a build without them degrades honestly instead of failing, why exam results
are calibration and never mastery — is [ADR 0009](../adrs/0009-official-exam-materials-local-only.md).
Read that first if you are about to change anything here.

## What it is

A simulator for the official Goethe-Zertifikat sets (Modellsatz, Übungssätze) the learner already
owns as PDFs and audio, downloaded free from goethe.de: timed sessions against the real
Kandidatenblätter, playback of the real Tonträger, and an answer sheet that scores itself against
the real Prüferblätter key. It sits beside — and does not replace — the committed,
repeatable `/pruefung/<level>` practice sets (original Goethe-*style* items authored for this
course), which is where `/pruefung/<level>` already links out to it under "Prüfungssimulator".

What is committed: the manifest contract and scoring arithmetic (`src/lib/exam-sim.ts`), the
local result history it defines, the ingestion script below, and the trainer page itself —
`/pruefung/goethe-a1` with its simulator island, which fetches the manifest at runtime and
renders the absence state when no build-local materials exist.

## The local-only boundary

Official exam materials — PDFs, audio, video, every derived artifact (rendered pages, sliced
audio, the generated manifest) — never enter the repository. Two gitignored directories carry the
whole boundary:

| Path | Contents | Ignored by |
| --- | --- | --- |
| `docs/GeotheInstitute/` | The official PDFs and audio/video, plus `exam-sources.yaml` | `.gitignore` |
| `public/exams/` | Everything `scripts/exam-ingest.ts` generates: rendered pages, extracted audio, `manifest.json` | `.gitignore` |

A clean checkout — and every CI machine — has neither directory. One corollary binds the owner's
machine: a **local** `dist/` legitimately contains the exam assets, so never hand-deploy it
(`wrangler pages deploy dist` or any equivalent) — the public site deploys only from clean
checkouts. `bun run build` still succeeds;
it just never serves `/exams/manifest.json`. **This is the point, not a gap**: the trainer page
reads that 404 as the absence state and says plainly that the official materials are not present,
with no broken player and no shell pretending to load. Nothing here needs a runtime permission
check, because the deployed bytes simply do not exist.

## Expected layout of `docs/GeotheInstitute/`

```
docs/GeotheInstitute/
├── exam-sources.yaml              # the config below — the only file this script reads directly
├── sd_1_modellsatz.pdf            # Kandidatenblätter + Prüferblätter, as downloaded
├── sd_1_uebungssatz01.pdf
├── sd_1_uebungssatz02.pdf
└── pruefungstraining_2_hoeren_a1_erwachsene.mp4   # full Hören module recordings
```

Filenames are whatever goethe.de ships; `exam-sources.yaml` is the one place that names them.
`pdf` and `audio` paths in the config are relative to the config's own directory, so the whole
folder can be renamed or relocated without touching the config's other fields.

### `exam-sources.yaml`

One file, version 1, one entry per official set. The full shape — with a worked Hören module — is
documented in the comment at the top of `scripts/exam-ingest.ts`; the essentials:

- `sets[].id` is the set's stable identity — it becomes the `public/exams/<id>/` directory name
  and the key the local result history hangs off, so treat it as a permanent identifier once a
  learner has taken the set.
- `sets[].modules[].pdfPages` are 1-based indices into the PDF — the Kandidatenblätter pages for
  that module, in reading order.
- `sets[].modules[].teile[].items[].key` is the answer key, transcribed from the Prüferblätter.
  This is the one place a transcription error costs a wrong score, not a wrong lesson — there is
  no validator that can check it against the source, because the source is never in the repo.
- `audio` is optional per module (Schreiben/Sprechen modules have none) and names a video or
  audio file to extract from, not a pre-sliced clip.

This repo intentionally contains **no example of a filled-in `exam-sources.yaml`** — even a
plausible-looking one risks being read as a transcription of the real answer key. Author it
directly against the shape comment and the real Prüferblätter.

## Running ingestion

```
bun run exam:ingest                    # ingest using the default config path
bun run exam:ingest -- --check         # validate + report what would be generated, write nothing
bun run exam:ingest -- --force          # re-render every page / re-extract every audio track
bun run exam:ingest -- --sources <path> # use a config file somewhere other than the default
```

For each module, it renders the listed `pdfPages` to PNG at 150 dpi (`pdftoppm`) and, when
`audio` is set, extracts the audio stream without re-encoding (`ffmpeg -acodec copy` — the source
video is already AAC, so there is nothing to transcode). Idempotent: a page or audio file already
newer than its source is left alone, so editing one Teil's answer key and re-running does not
re-render pages that did not change. `--check` never touches disk and never requires `pdftoppm`
or `ffmpeg` to be installed — only the config and the referenced source files.

Needs `pdftoppm` (part of Poppler) and `ffmpeg`:

```
brew install poppler ffmpeg
```

Before writing `public/exams/manifest.json`, the script re-reads it and runs it through
`parseExamManifest` (`src/lib/exam-sim.ts`) — the same structural check the trainer page runs on
every fetch — and confirms every page/audio path it just wrote actually exists on disk. Either
check failing deletes the manifest and exits 1 naming the defect, rather than shipping a manifest
the page cannot read or that 404s on its own assets.

## Where outputs land

```
public/exams/
├── manifest.json
└── <setId>/
    ├── <module>.m4a
    └── pages/
        └── <module>-p<NN>.png
```

`manifest.json` is what `EXAM_MANIFEST_URL` (`/exams/manifest.json`) serves; its `pages` and
`audio` fields are the root-absolute URLs above, ready for `withBase`. None of it is validated by
`bun run validate` against a committed fixture, because there is no committed instance to check —
the self-check inside `scripts/exam-ingest.ts` is the only gate this manifest ever passes through.

## The one thing to remember

A build made from a clean checkout has no exam assets. That is not a bug to chase — it is the
trainer degrading honestly, exactly as ADR 0009 requires. Re-running `bun run exam:ingest` on a
machine that holds `docs/GeotheInstitute/` is what brings it back.
