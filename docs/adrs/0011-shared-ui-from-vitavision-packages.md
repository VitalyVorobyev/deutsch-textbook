# ADR 0011: Shared UI comes from the `@vitavision/*` packages, and each app's identity is a theme

Status: accepted · 2026-10-18

## Context

The workspace has three visual languages: the learner app (stone/amber, hand-applied Tailwind),
Tonwerk (graphite/cyan/brass with its own tokens) and Redaktion (`@da/ui` plus Radix). `@da/ui` is
one file of primitives. The owner maintains a published design system, lab-ui (`@vitavision/ui`,
`@vitavision/workbench`, `@vitavision/charts`, …): semantic CSS-variable tokens on Tailwind v4,
Storybook-documented, versioned per package. Building a fourth set of primitives here would
duplicate it.

## Decision

**Redaktion and Tonwerk build on the published `@vitavision/*` packages, pinned from npm like any
dependency.** A local link to a lab-ui checkout is for developing a lab-ui feature only, never
committed.

**An app's visual identity is a theme layer, not a component fork.** `@da/ui` becomes that layer:
token values (colour roles, type, density) mapped onto the `@vitavision/ui` semantic variables, plus
the few domain components no generic library should own. A component that is generic belongs
upstream in lab-ui.

**The learner app keeps its look.** Its migration comes after the tools'. It starts from a written
specification of its current visual language, with the design-sync catalogue (`.design-sync/`) as
the reference rendering, so that "keep the design" is checkable rather than remembered.

## Consequences

- Upgrading a `@vitavision/*` minor version can break (0.x) and is a deliberate change with its own
  PR.
- Tailwind must scan the packages' sources. A package invisible to `@source` renders unstyled with
  every class present in the DOM, so the design-token test guards it.
- The migration plan and order live in [the proposal](../proposals/ui-on-lab-ui.md) until they are
  scheduled.
