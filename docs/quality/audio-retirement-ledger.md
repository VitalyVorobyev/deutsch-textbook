# Retiring the legacy TTS audio items

`content/listening/` now holds 41 reviewed recordings. The `audio-comprehension` items that
predate them were written against browser TTS reading a script, and the question was which of
them the recordings supersede.

**The bar, set by Vitaly: the new ones must do the teaching job better, not worse.** That is a
per-item test, not a per-topic one, and it is stricter than "the outcome is still measured
somewhere".

## Scope

`audio-comprehension` items by the role of the set they sit in — only the first column was ever a
candidate:

| Role | Items | Treated as |
| --- | --- | --- |
| `practice` (excluding the new `-hoeren` sets) | 41 | candidates |
| `placement` | 10 | untouched — placement carries its own seven rules |
| `checkpoint` | 6 | untouched — a different role, measured differently |

## The test, in three passes

1. **Does the outcome survive at all?** Every `outcome` and `focus` the item carries must still be
   measured by a `practice`/`drill` item on the same topic after removal. This is the floor, and
   `bun run validate` re-checks it independently.
2. **Does it survive *in listening*?** The stronger test, and the one that does the work here: the
   topic's reviewed recording must carry the same outcome. Where it does not, retiring the item
   leaves that outcome measured only in writing — a mode regression, which is exactly "worse".
3. **Is anything else anchored to it?** `primaryPractice` completion advances the Lernpfad, and a
   probe family's `arming:` list starts its clock.

## Result — 17 retired, 24 kept

**Retired (17).** The topic's recording carries the identical outcome, so the same competence is
still measured by ear — by reviewed human-quality audio instead of a TTS voice reading a script:

`a1/hoeren-alltag-zeit` (2) · `a1/hoeren-freizeit` (1) · `a1/hoeren-stadt-wege` (2) ·
`a2/aemter-dienstleistungen-produktion` · `a2/arbeit-beruf-produktion` ·
`a2/einkaufen-reklamation-produktion` · `a2/gesundheit-arzttermin-produktion` ·
`a2/lernen-verstehen-produktion` · `a2/modalverben-produktion` · `a2/reisen-verkehr-produktion` ·
`a2/termine-produktion` · `b1/erfahrungen-erzaehlen-produktion` · `b1/lernen-zukunft-produktion` ·
`b1/regeln-verantwortung-produktion` · `b1/reisen-probleme-produktion`

No set was emptied — the three A1 `hoeren-*` sets keep their `listen` items.

**Kept (24), each with its reason.** A silent retention reads as an oversight:

| Reason | Items | Why |
| --- | --- | --- |
| Outcome not in the recording | 18 | Retiring would leave the outcome measured only in writing. `a2/man-und-besitz-passiv:audio-durchsage-passiv`, `a2/relativsaetze-produktion:audio-wohnungssuche` and `a2/wohnen-umzug-produktion:hoeren-wohin-kommt-das-regal` are typical: the recording is on the topic, but about something else. |
| `primaryPractice` | 4 | `a1/erste-schritte`, `a1/essen-trinken`, `a1/menschen-familie`, `a2/verben-mit-praepositionen`. Completion of the first `role: practice` set advances the Lernpfad; `CLAUDE.md` pins that list against growth and shrinking is the untested direction. |
| Arms a probe family | 2 | `b1/arbeit-bewerbung-produktion:hoeren-interview-verstehen` and `b1/meinung-medien-produktion:hoeren-radio-umfrage` appear in an `arming:` list. Removing either moves that family's clock, and the recorded items carry no `focus`, so there is nothing to re-point the key at. Found by `bun run validate`, not by the ledger — the arming reference is a fourth anchor the first three passes do not see. |

## What retirement costs

Logged attempts on a retired item keep their result and are never replayed (`CLAUDE.md`,
runtime invariants) — they are orphaned, which is the documented behaviour rather than a
regression. `revision` is a per-*item* field, so removing an item bumps nothing: no surviving
item's contract changed.

## Reproducing

The ledger is a scratch script, not a committed gate — the three passes it runs are each already
enforced elsewhere (`bun run validate` for outcome coverage and arming keys, the item-mix bar for
type ratios). Its one non-obvious rule: **find a topic's recording through the set's `topic:`
field, never by guessing the slug.** `ls-essen-einkaufen-01` attaches to `essen-trinken`, and
deriving the id from the topic name reported two topics as unrecorded that are not.
