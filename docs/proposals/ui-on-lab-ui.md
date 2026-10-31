# Proposal: moving the apps onto `@vitavision/*`

Status: open · 2026-10-18. The decision to build on lab-ui is
[ADR 0011](../adrs/0011-shared-ui-from-vitavision-packages.md); this is the plan, which is not yet
scheduled.

## Order

1. **Tonwerk is on it.** Its shell is `@vitavision/workbench`, its controls are `@vitavision/ui`, and
   its palette is a theme: the system's own `signal`/`normal`/`defect` roles carry its
   person/machine/alarm thesis with three values retuned (`apps/tonwerk/ui/DESIGN.md`). The theme
   lives in the app, not in `@da/ui`, because nothing else renders with it. What is left is its
   domain components (Platte, Marke, the tables), which still use its own CSS on the system tokens.
2. **Redaktion next.** It is a professional tool, closest to lab-ui's *instrument* direction, and
   already uses `@da/ui` plus Radix. `@vitavision/workbench` provides the app shell, split panes and
   tree view it hand-builds today.
3. **The learner app last.** It is Astro with React islands, and its look is the one to keep.

## Open decisions

- What stays in `@da/ui`: theme tokens only, or also domain components (TierBadge, EvidenceChips,
  the exercise widgets)?
- Learner exercise components live in `src/components/`, so nothing outside the app can render
  them. Redaktion owes "renderer parity" and design-sync needs a hand-written entry for the same
  reason. Should they move into a package first?
- Fonts: lab-ui ships IBM Plex. Does the learner app keep its type?
- Dark mode: lab-ui sets a class on `<html>`, the learner app a `data-theme` attribute. Pick one
  pre-paint mechanism.

## Before the learner app moves

Write `docs/architecture/learner-visual-language.md`: the colour roles from
`packages/ui/src/tokens.css`, type, density, chips and exercise anatomy. Keep the design-sync
catalogue current as the reference rendering.
