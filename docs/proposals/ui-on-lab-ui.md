# Proposal: moving the apps onto `@vitavision/*`

Status: open · 2026-10-18. The decision to build on lab-ui is
[ADR 0011](../adrs/0011-shared-ui-from-vitavision-packages.md); this is the plan, which is not yet
scheduled.

## Order

1. **Redaktion first.** It is a professional tool, closest to lab-ui's *instrument* direction, and
   already uses `@da/ui` plus Radix. `@vitavision/workbench` provides the app shell, split panes and
   tree view it hand-builds today.
2. **Tonwerk second.** Its design thesis (`apps/tonwerk/DESIGN.md`) spends hue only on
   machine-measured versus person-approved. Decide whether that palette becomes a lab-ui theme, or
   whether lab-ui's own signal/normal/defect roles already carry it.
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
