# Progress persistence verification — 0.5.2

Date: 2026-09-18. Decision: [ADR 0020](../adrs/0020-owned-storage-recovery.md).

## Automated checks

- `bun test`: 1,055 passing tests across 96 files.
- `bun run validate`, `bun run check`, `bun run lint`: pass. Type checking retains one
  pre-existing Zod deprecation hint, with zero errors or warnings.
- `bun run build:desktop`: 230 pages, including the shipping audio bundle.
- `bun install --frozen-lockfile`: no dependency changes.

`managed-store.test.ts` drives actual fake-indexeddb transaction locks and abort events,
including an unacknowledged abort, late completion, a missing callback, and stale open results.
`progress-transition.test.ts` combines durable session completion, successive grades, snapshot
merge, and replay; it also verifies that timed-out manual retries share the original operation
and that storage/quarantine failures preserve pending entries.

## Native macOS check

The release-profile test bundle uses identifier `dev.nonvision.deutsch-atlas.persistence-test`
and profile `persistence-test`. This is a separate WebKit and application-data container; the
installed learner profile is not used for synthetic activity.

Using the native UI, open Erste Schritte, start the daily session, complete eight training items,
advance through its results to the session summary, then navigate directly to Üben → Wiederholen
and grade three cards. No persistence alert appeared. Read-only inspection of the test profile's
journal and generated backup confirmed:

- 8 attempts;
- 1 completed session, with `trained: 8`;
- 3 card states and 3 total repetitions;
- 0 pending journal entries.

After quitting through the normal desktop exit path and reopening the final isolated bundle,
Heute still showed the session as completed. Fortschritt showed 8 answers and 3 started cards;
Session history contained one row with 8 trained items. Daten showed the current backup and no
recorded storage delays. The journal remained empty.

These observations establish persistence for the exercised workflow. They do not establish the
original trigger of the intermittent WKWebView engine stall or guarantee it can never recur.
The adapter's fault-injection tests establish the abort/retry and late-confirmation behavior.

No database deletion, learner-journal clearing or synthetic writes to the installed learner
profile form part of this procedure. Installing the new app keeps the existing database and
journal identities; pending operations are replayed through the normal startup path.
