# ADR 0022: The account is its own page; Fortschritt is one page

Status: accepted · 2026-11-22

## Context

[ADR 0007](0007-opaque-snapshot-sync-and-approval-accounts.md) put the account and sync surface on
Fortschritt → Daten and kept `/konto` as a redirect. Fortschritt then held three sub-tabs:
Übersicht, Nachweise and Daten. The owner never used Nachweise or the session history, and Daten
was playing the role of an account page: export, import, the sync folder, storage diagnostics and
the cloud account sit there beside a page about learning. A page that mixes "how am I doing" with
"where does my data live" serves neither, and its figures never fit one screen.

## Decision

1. **`/konto` is the page for where progress lives and how it moves.** It holds the local copy
   (export and import), the desktop sync folder, the storage diagnostics and the cloud account. It
   is reached from the profile menu in the header, never from the nav tabs, and it is again the
   OAuth return target.
2. **Fortschritt is a single page and describes learning only.** It has no sub-tabs and fits one
   screen at a full desktop window: the activity figures and heatmap, the vocabulary bars, and the
   delayed checks.
3. **Of the measurement surfaces only delayed-check failures stay in the app**, listed per topic.
   Checkpoint results, evidence by actual response, weakness trends and the session history are
   read through `bun run progress:audit`, not in the app.
4. **An old `/progress?tab=daten` link forwards to `/konto`** and keeps every other query
   parameter, so a failed sign-in's `?auth=<reason>` still arrives.

## Consequences

- Everything in ADR 0007 other than the sentence that placed the account on Fortschritt → Daten
  stands: opaque snapshots, conditional writes, approval, device tokens.
- The evidence is still recorded and still read, by the owner and by Claude, through
  `progress:audit` ([ADR 0003](0003-the-evidence-model.md)); only the learner's view of it is
  smaller. Re-adding a measurement surface to Fortschritt is a new decision.
- A new account or storage feature goes on `/konto`; a new learning figure goes on Fortschritt only
  if the page still fits one screen.
- Hints on figures are a component, not `title` attributes, because the desktop webview shows no
  `title` tooltip and touch never does.
