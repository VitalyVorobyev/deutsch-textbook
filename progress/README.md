# Progress snapshots

JSON snapshots of a learner's browser state, **one folder per local profile**:
`progress/<profile>/<date>.json` (e.g. `progress/vitaly/2026-07-10.json`). The folder name is
the slug of the name the learner gave at first run — there is no default profile. A snapshot
contains exercise `attempts`, FSRS `cards`, the daily
`sessions` log, and per-topic completion (`topics`: `readAt` + a manual `learned`/`reopened`
override). Current snapshots are `version: 4`; import tolerates v1/v2/v3/v4. Version 4 adds the
profile-scoped learning goal; older snapshots remain valid and read with no goal.

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

The agent first creates a compact audit instead of loading the raw JSON into its context:

```sh
bun run progress:audit --profile vitaly
```

The command selects the newest snapshot, joins attempts to the authored exercise items and
prints bounded Markdown. `--json` emits the same report as structured data;
`--item a2/perfekt-haben-sein:uebersetzen-pizza` loads the full evidence for one item only;
`--snapshot progress/vitaly/2026-07-13.json` selects an explicit export.

Rejected translations are a **grading-review queue**, not proof of a learner error. Review
their naturalness, meaning, register and preservation of the tested `key_tokens` before adding
an exact `accept` variant or changing a prompt. Only focus-attributed errors repeated across
distinct items, after grading artifacts are removed, justify targeted drill work — see
"Drills from progress" in [CLAUDE.md](../CLAUDE.md).
