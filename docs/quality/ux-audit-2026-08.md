# Three-form-factor UX audit — 2026-08-05

Status: findings ranked; fixes are backlog entries, not this document. New entries carry P25 ids;
known defects confirmed here keep their existing ids.

## Method

Playwright (Chromium, headless) against `bun run preview` of main at `8dd5270` (post-#149/#150/#152),
12 pages × 3 viewports — 390×844 (phone), 768×1024 (tablet), 1280×800 (desktop): Heute, Themen,
one B1 topic (`digitales-leben`), Session, Wiederholen, Training, Wortschatz, Proben, Fortschritt,
Referenz index, `/referenz/zeitformen`, Entdecken. A fresh profile was created through the
first-run gate; the sweep therefore sees empty-progress states, which audits layout but not
data-heavy states. Mechanical checks per page: `scrollWidth` vs viewport; elements protruding past
the right edge outside any `overflow-x` container; interactive elements under 44 px (phone only,
reported when height < 32, or both sides < 44); `<table>` elements outside overflow containers;
page height in viewport-heights. Screenshot review on the flagged phone pages. The owner's
real-iPhone findings (2026-08-04 screenshots) are folded in where emulation cannot see them.

## What holds

**No page scrolls horizontally at any of the three widths.** The #149 Fortschritt merge and both
disclosure patterns hold at 390 px. The one horizontal scroller is the top navigation's own
container — which is P24-7, confirmed below, not a new finding.

## Findings, ranked

### 1 · P25-1 (new) — `/ueben/wortschatz` is a ~19,000 px flat deck list on a phone

22.3 viewport-heights at 390 px (11.9 even on desktop): every deck in the corpus as one
undifferentiated card column. The Wortliste completion waves make this strictly worse — wave 2a
already added two cards, and ~30 more decks are scheduled. Same defect class as the Fortschritt
page the owner flagged: exhaustive rendering where a summary-first view belongs. Fix direction:
group by level with collapsed sections and/or a filter row; the per-deck card content is fine.

### 2 · P25-2 (new) — topic-page paradigm tables have no overflow container

Five `<table>`s per topic page at every viewport (measured on `b1/digitales-leben`), none wrapped
in `overflow-x-auto`. Today's three-column paradigms fit 390 px by squeezing; the failure is
silent — a four-or-five-column paradigm (B1 Konjunktiv rows, case tables) will clip or crush with
no gate seeing it. One fix at the rendering layer (the prose table style in the topic template),
never per-table.

### 3 · P24-7 (known, confirmed) — the nav scroller, and the Tippen card's viewport use

At 390 px the seven-link nav scrolls inside its own container with the last links off-screen and
no affordance (the audit's screenshots show it cut at "F…"). The owner's iPhone screenshots add
the Wiederholen Tippen-mode card spending most of the viewport on padding. Both stay under P24-7's
design session; nothing new to add, the measurements stand.

### 4 · P25-3 (new) — recurring sub-44 px touch targets on the surfaces the daily loop taps most

Measured at 390 px, heights in px: theme toggle 30, profile-menu button 30, Eingabe mode chips
(Tippen/Aufdecken/Hören) 28, "Mark as learned" 26, Referenz taught-in chips 22, breadcrumb and
unit-crumb links 17. The `min-h-11 sm:min-h-0` pattern already used by the exercise buttons is the
fix; this is one pass over the listed sites, not a redesign. (Nav links at 36 px height and the
40×40 speak buttons are borderline and can ride along where trivial.)

### 5 · P25-4 (new) — reference table pages run 9–13 screens with no in-page navigation

`/referenz/zeitformen`: 13.3 screens at 390 px, 9.7 at desktop — one long paradigm dump; the other
reference pages share the shape. Belongs to P24-5's Referenz IA pass: an anchor index at the top
(or sticky section nav) rather than any content change. Recorded there, not as separate work.

### 6 · P24-10 · P24-6 · P23-1 (known) — confirmed unchanged

Safari-bottom-bar rating row (P24-10) is not reproducible in emulation and stands on the owner's
device evidence. Input attributes (P24-6) unchanged — next PR. Page weight (P23-1): the wortschatz
height above is its visible face; the byte problem is measured in the entry already.

## Observation without an entry

A full topic page runs ~29 screens at 390 px (article + readings + exercises inline). That is the
designed lesson shape, not a defect — but it is the page class P23-1's fetch-per-view work will
touch, and an in-page section nav could ride on whatever P23-1 decides. Noted here so the option
is not lost; no entry until P23-1 is sized.
