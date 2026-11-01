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
2. **Redaktion is on it.** Its frame is `AppShell` with a `NavRail` and a `StatusBar`, its tabs,
   tooltips, badges, buttons and inputs are `@vitavision/ui`, and it uses the system's colours
   unchanged. `@da/ui` is the theme layer ADR 0011 describes: the source globs, the article and
   exercise preview styles, and the domain primitives (the toned panel, the callout, the stat). Its
   classes are written in the system's vocabulary, because the old names collided with it
   (`surface`, `warn`). A Deutsch-Atlas colour retune would be an override of the system's
   variables, with a contrast test, as Tonwerk's is.
3. **The learner app last.** It is Astro with React islands, and its look is the one to keep.

## Open decisions

- Whether the learner app's domain components (TierBadge, EvidenceChips, the exercise widgets) join
  `@da/ui` when it moves. Today `@da/ui` serves Redaktion alone.
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
