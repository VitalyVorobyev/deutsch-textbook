# Backlog · Desktop and storage

The desktop shell and the learner store. The format and the ID rule are in the [backlog README](README.md).

- **P29-1 · A bundle-less run uses a second WebKit container** (`~/Library/WebKit/deutsch-atlas/`
  instead of `dev.nonvision.deutsch-atlas/`), holding a frozen copy of the profile. It is detected
  and reported on Fortschritt → Daten (`legacy_webkit_container`, `src-tauri/src/main.rs`); what the
  learner should do about it is undecided, and merging two histories must never be automatic.
- **P29-3 · `AccountPanel.bind()` decides a warning from an unguarded read.** A stalled
  `getAttempts()` reads as "nothing to merge" and binds a device with history silently. Fix with
  `withReadRetry` and an explicit failure that decides between warning and refusing.
- **P30-1 · A card grade rewrites the whole `cards` blob** (~784 KB), because progress lives under
  six keys. Per-record keys would touch every read path, the snapshot format and sync — worth it
  only if measured write latency says so.
- **P30-2 · `scheduleAutoSync()` fires once per queued waiter, not once per commit.** The debounce
  absorbs it; move the call to the batch boundary.
