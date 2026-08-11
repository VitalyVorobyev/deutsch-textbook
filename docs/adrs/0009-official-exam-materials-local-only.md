# ADR 0009: Official exam materials are local-only, and the trainer degrades honestly without them

Status: accepted · 2026-08-11

## Context

The learner is preparing for the Goethe-Zertifikat A1 (Start Deutsch 1) with the exam under four
weeks away, and holds the official preparation sets — Modellsatz and two Übungssätze as PDFs,
plus full Hören modules as audio — downloaded free from goethe.de. Practising them on paper
against a printed answer key wastes what the app already does well: timed sessions, audio
playback, an answer sheet that scores itself, and a record of which set was taken when.

The materials are copyrighted. The repository already refuses this class of content — the
`.gitignore` bans the official Wortliste PDFs as "copyrighted transcription sources — never
committed" — and the repo is public: committing the sets, sliced audio derived from them, or a
manifest that reproduces their task texts would be redistribution. At the same time, the existing
committed exam surface (`/pruefung/a1`, original Goethe-*style* items authored for this course)
serves a different job — repeatable practice — and must not be displaced by material that
saturates after three passes.

The app is a static site: whatever lands in `dist/` ships. So the boundary cannot be a runtime
permission check; it has to be that the deployed build **never contains the bytes**.

## Decision

- **Official exam materials never enter the repository** — not the PDFs, not audio, not video,
  not sliced segments, not rendered page images, and not the manifest's task texts. The ignore
  rules cover the materials directory (`docs/GeotheInstitute/`, future `sources/goethe-exams/`)
  and every derived artifact (`public/exams/`).
- **The trainer is code plus a local manifest.** Committed: the surface, the session/scoring
  logic, the manifest schema, the ingestion script, and a README describing the expected local
  layout. Local-only: the assets and the manifest instance (answer keys, timings, page maps) —
  authored on the owner's machine, reproducible from the PDFs by re-running ingestion.
- **Absence is a first-class state.** A build made from a clean checkout has no exam assets;
  the trainer page then states plainly that the official materials are not present and points to
  the README — no broken players, no empty shells pretending to load.
- **Exam results are calibration, never mastery.** Attempts and scores live in a separate local
  store, outside the snapshot, never synced, and never feed tiers, mastery counters or
  `weakFocuses`. Playback is never evidence (standing rule). With only three official sets, a
  repeat measures memory of the items, not the skill — the results view names which set was taken
  when and says so on a repeat.
- **The committed original-style sets remain the repeatable channel.** The simulator
  familiarizes: format, timing, the feel of the real Tonträger. It does not replace P19-6 (the
  original listening pack) or the `/pruefung/<level>` practice sets.

## Consequences

- The public deployment can never leak the materials: the build machine does not have them, so
  no gate has to catch them. The one guard that matters is the ignore rule, and it is committed.
- The owner's machine (and any personal Tauri build made on it) is the only place the trainer is
  fully alive. That is the intended shape: the materials are licensed for personal exam
  preparation, and the trainer is a personal instrument.
- Losing the machine loses only re-derivable state: assets re-download from goethe.de, the
  manifest re-derives from the PDFs via the ingestion script.
- The manifest cannot be validated by `bun run validate` against committed fixtures, because its
  instance is not in the repo; the schema ships with a self-check in the ingestion script
  instead.
- A future level (B2 materials are already in the folder) reuses the same mechanics: new manifest
  entries, zero new policy.
