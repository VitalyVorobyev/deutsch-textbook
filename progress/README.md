# Progress snapshots

JSON snapshots of a learner's browser state, **one folder per local profile**:
`progress/<profile>/<date>.json` (e.g. `progress/vitaly/2026-07-10.json`). The default
profile id is `vitaly`. A snapshot contains exercise `attempts`, FSRS `cards`, the daily
`sessions` log, and per-topic completion (`topics`: `readAt` + a manual `learned`/`reopened`
override). Current snapshots are `version: 3`; import tolerates v1/v2/v3.

## How snapshots get here

- On the site's **Fortschritt** page, **Export** writes the active profile's snapshot to
  `progress/<profile>/<date>.json`. While `bun run dev` is running this happens directly,
  via a dev-only `POST /__progress/<profile>` middleware (`src/integrations/progress-writer.ts`);
  a built/preview site has no such endpoint, so Export falls back to a file download that you
  drop into the matching folder yourself.
- **Import** is a non-destructive **merge** by default (attempts/sessions unioned, the
  more-advanced FSRS card kept, latest manual override wins). A confirm-gated **Replace**
  restores the old destructive behaviour.

## What the agent does with them

The agent reads the newest snapshot in the relevant profile folder to find weak spots and
generate targeted drill sets — see "Drills from progress" in [CLAUDE.md](../CLAUDE.md).
